use std::str::FromStr;

use axum::{extract::{Path, State}, Json};
use chrono::{Months, NaiveDate};
use rust_decimal::Decimal;
use sqlx::{query, query_as};
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::{CreateInvoiceRequest, Customer, Invoice, Mandate, PaymentResponse},
    payments::adapter::{BankAccount, CustomerChargeRequest, PaymentStatus},
    AppState,
};

pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/", axum::routing::post(create_invoice))
        .route("/:id/charge", axum::routing::post(charge_invoice))
}

async fn create_invoice(
    State(state): State<AppState>,
    Json(payload): Json<CreateInvoiceRequest>,
) -> AppResult<Json<Invoice>> {
    let amount = parse_amount(&payload.amount)?;
    let currency = normalize_currency(&payload.currency)?;
    let frequency = normalize_frequency(&payload.frequency)?;
    let next_due = parse_date(&payload.next_due)?;

    let customer_exists = query("SELECT 1 FROM customers WHERE id = $1")
        .bind(payload.customer_id)
        .fetch_optional(&state.db)
        .await?
        .is_some();

    if !customer_exists {
        return Err(AppError::NotFound("customer not found".to_string()));
    }

    let invoice = query_as::<_, Invoice>(
        r#"INSERT INTO invoices (customer_id, amount, currency, frequency, next_due, status)
        VALUES ($1, $2, $3, $4, $5, 'pending')
        RETURNING id, customer_id, amount, currency, frequency, next_due, status, created_at"#,
    )
    .bind(payload.customer_id)
    .bind(amount)
    .bind(currency)
    .bind(frequency)
    .bind(next_due)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(invoice))
}

async fn charge_invoice(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<PaymentResponse>> {
    let invoice_id = Uuid::parse_str(&id)
        .map_err(|_| AppError::Validation("invalid invoice id".to_string()))?;

    let mut tx = state.db.begin().await?;

    let invoice = query_as::<_, Invoice>(
        r#"SELECT id, customer_id, amount, currency, frequency, next_due, status, created_at
        FROM invoices
        WHERE id = $1
        FOR UPDATE"#,
    )
    .bind(invoice_id)
    .fetch_one(&mut *tx)
    .await?;

    if invoice.status != "pending" {
        return Err(AppError::Validation("invoice is not pending".to_string()));
    }

    let customer = query_as::<_, Customer>(
        r#"SELECT id, name, email, country, fin, transit, account, aba_routing, created_at
        FROM customers
        WHERE id = $1"#,
    )
    .bind(invoice.customer_id)
    .fetch_one(&mut *tx)
    .await?;

    let mandate_type = match customer.country.as_str() {
        "CA" => "PAD",
        "US" => "ACH",
        _ => {
            return Err(AppError::Validation("customer country must be CA or US".to_string()));
        }
    };

    let mandate = query_as::<_, Mandate>(
        r#"SELECT id, customer_id, mandate_type, signed_at, metadata, created_at
        FROM mandates
        WHERE customer_id = $1 AND mandate_type = $2
        ORDER BY signed_at DESC
        LIMIT 1"#,
    )
    .bind(customer.id)
    .bind(mandate_type)
    .fetch_optional(&mut *tx)
    .await?;

    if mandate.is_none() {
        return Err(AppError::Validation(
            "customer must have a valid mandate".to_string(),
        ));
    }

    let account = match customer.country.as_str() {
        "CA" => BankAccount::Canada {
            fin: customer.fin.clone().unwrap_or_default(),
            transit: customer.transit.clone().unwrap_or_default(),
            account: customer.account.clone(),
        },
        "US" => BankAccount::UnitedStates {
            aba_routing: customer.aba_routing.clone().unwrap_or_default(),
            account: customer.account.clone(),
        },
        _ => {
            return Err(AppError::Validation("customer country must be CA or US".to_string()));
        }
    };

    let request = CustomerChargeRequest {
        customer_id: customer.id,
        amount: invoice.amount,
        currency: invoice.currency.clone(),
        account,
    };

    let result = state
        .payment_processor
        .charge_customer(request)
        .await
        .map_err(|err| AppError::Internal(err.to_string()))?;

    let payment_status = result.status.as_str();
    let invoice_status = match result.status {
        PaymentStatus::Succeeded => "paid",
        PaymentStatus::Failed => "failed",
    };

    let payment = query_as::<_, crate::models::Payment>(
        r#"INSERT INTO payments (invoice_id, status, gateway_transaction_id, raw_response)
        VALUES ($1, $2, $3, $4)
        RETURNING id, bill_id, invoice_id, status, gateway_transaction_id, raw_response, created_at, updated_at"#,
    )
    .bind(invoice.id)
    .bind(payment_status)
    .bind(result.gateway_transaction_id)
    .bind(result.raw_response)
    .fetch_one(&mut *tx)
    .await?;

    let next_due = calculate_next_due(&invoice.frequency, invoice.next_due)?;
    if invoice.frequency != "ONE_TIME" {
        query("UPDATE invoices SET status = $1, next_due = $2 WHERE id = $3")
            .bind(invoice_status)
            .bind(next_due)
            .bind(invoice.id)
            .execute(&mut *tx)
            .await?;
    } else {
        query("UPDATE invoices SET status = $1 WHERE id = $2")
            .bind(invoice_status)
            .bind(invoice.id)
            .execute(&mut *tx)
            .await?;
    }

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

fn normalize_frequency(value: &str) -> AppResult<String> {
    let freq = value.trim().to_uppercase();
    match freq.as_str() {
        "ONE_TIME" | "MONTHLY" | "QUARTERLY" | "YEARLY" => Ok(freq),
        _ => Err(AppError::Validation(
            "frequency must be ONE_TIME, MONTHLY, QUARTERLY, or YEARLY".to_string(),
        )),
    }
}

fn calculate_next_due(frequency: &str, current: NaiveDate) -> AppResult<NaiveDate> {
    let next = match frequency {
        "MONTHLY" => current.checked_add_months(Months::new(1)),
        "QUARTERLY" => current.checked_add_months(Months::new(3)),
        "YEARLY" => current.checked_add_months(Months::new(12)),
        _ => Some(current),
    };

    next.ok_or_else(|| AppError::Validation("next_due overflow".to_string()))
}
