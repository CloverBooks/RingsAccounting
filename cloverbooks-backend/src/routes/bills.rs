use std::str::FromStr;

use axum::{extract::{Path, State}, Json};
use chrono::NaiveDate;
use rust_decimal::Decimal;
use sqlx::{query, query_as};

use crate::{
    error::{AppError, AppResult},
    models::{Bill, CreateBillRequest, PaymentResponse, Vendor},
    payments::adapter::{BankAccount, PaymentStatus, VendorPaymentRequest},
    AppState,
};

pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/", axum::routing::post(create_bill).get(list_pending_bills))
        .route("/:id/pay", axum::routing::post(pay_bill))
}

async fn create_bill(
    State(state): State<AppState>,
    Json(payload): Json<CreateBillRequest>,
) -> AppResult<Json<Bill>> {
    let amount = parse_amount(&payload.amount)?;
    let currency = normalize_currency(&payload.currency)?;
    let due_date = parse_date(&payload.due_date)?;

    let vendor_exists = query("SELECT 1 FROM vendors WHERE id = $1")
        .bind(payload.vendor_id)
        .fetch_optional(&state.db)
        .await?
        .is_some();

    if !vendor_exists {
        return Err(AppError::NotFound("vendor not found".to_string()));
    }

    let bill = query_as::<_, Bill>(
        r#"INSERT INTO bills (vendor_id, amount, currency, due_date, status)
        VALUES ($1, $2, $3, $4, 'pending')
        RETURNING id, vendor_id, amount, currency, due_date, status, created_at"#,
    )
    .bind(payload.vendor_id)
    .bind(amount)
    .bind(currency)
    .bind(due_date)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(bill))
}

async fn list_pending_bills(State(state): State<AppState>) -> AppResult<Json<Vec<Bill>>> {
    let bills = query_as::<_, Bill>(
        r#"SELECT id, vendor_id, amount, currency, due_date, status, created_at
        FROM bills
        WHERE status = 'pending'
        ORDER BY due_date ASC"#,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(bills))
}

async fn pay_bill(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<PaymentResponse>> {
    let bill_id = id.parse().map_err(|_| AppError::Validation("invalid bill id".to_string()))?;

    let mut tx = state.db.begin().await?;

    let bill = query_as::<_, Bill>(
        r#"SELECT id, vendor_id, amount, currency, due_date, status, created_at
        FROM bills
        WHERE id = $1
        FOR UPDATE"#,
    )
    .bind(bill_id)
    .fetch_one(&mut *tx)
    .await?;

    if bill.status != "pending" {
        return Err(AppError::Validation("bill is not pending".to_string()));
    }

    let vendor = query_as::<_, Vendor>(
        r#"SELECT id, name, email, country, fin, transit, account, aba_routing, created_at
        FROM vendors
        WHERE id = $1"#,
    )
    .bind(bill.vendor_id)
    .fetch_one(&mut *tx)
    .await?;

    let account = match vendor.country.as_str() {
        "CA" => BankAccount::Canada {
            fin: vendor.fin.clone().unwrap_or_default(),
            transit: vendor.transit.clone().unwrap_or_default(),
            account: vendor.account.clone(),
        },
        "US" => BankAccount::UnitedStates {
            aba_routing: vendor.aba_routing.clone().unwrap_or_default(),
            account: vendor.account.clone(),
        },
        _ => {
            return Err(AppError::Validation("vendor country must be CA or US".to_string()));
        }
    };

    let request = VendorPaymentRequest {
        vendor_id: vendor.id,
        amount: bill.amount,
        currency: bill.currency.clone(),
        account,
    };

    let result = state
        .payment_processor
        .pay_vendor(request)
        .await
        .map_err(|err| AppError::Internal(err.to_string()))?;

    let payment_status = result.status.as_str();
    let bill_status = match result.status {
        PaymentStatus::Succeeded => "paid",
        PaymentStatus::Failed => "failed",
    };

    let payment = query_as::<_, crate::models::Payment>(
        r#"INSERT INTO payments (bill_id, status, gateway_transaction_id, raw_response)
        VALUES ($1, $2, $3, $4)
        RETURNING id, bill_id, invoice_id, status, gateway_transaction_id, raw_response, created_at, updated_at"#,
    )
    .bind(bill.id)
    .bind(payment_status)
    .bind(result.gateway_transaction_id)
    .bind(result.raw_response)
    .fetch_one(&mut *tx)
    .await?;

    query("UPDATE bills SET status = $1 WHERE id = $2")
        .bind(bill_status)
        .bind(bill.id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(PaymentResponse {
        payment_id: payment.id,
        status: payment.status,
    }))
}

fn parse_amount(amount: &str) -> AppResult<Decimal> {
    Decimal::from_str(amount)
        .map_err(|_| AppError::Validation("amount must be a decimal string".to_string()))
}

fn parse_date(value: &str) -> AppResult<NaiveDate> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| AppError::Validation("date must be YYYY-MM-DD".to_string()))
}

fn normalize_currency(currency: &str) -> AppResult<String> {
    let currency = currency.trim().to_uppercase();
    match currency.as_str() {
        "CAD" | "USD" => Ok(currency),
        _ => Err(AppError::Validation("currency must be CAD or USD".to_string())),
    }
}
