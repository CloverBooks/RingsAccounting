use std::str::FromStr;

use axum::{
    extract::{Path, State},
    Json,
};
use chrono::NaiveDate;
use rust_decimal::Decimal;
use sqlx::{query, query_as};
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::{Bill, CreateBillRequest},
    AppState,
};

#[derive(serde::Serialize)]
struct DisabledResponse {
    ok: bool,
    status: &'static str,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    bill_id: Option<String>,
}

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
) -> AppResult<Json<DisabledResponse>> {
    let bill_id = Uuid::parse_str(&id)
        .map_err(|_| AppError::Validation("invalid bill id".to_string()))?;

    let exists = query("SELECT 1 FROM bills WHERE id = $1")
        .bind(bill_id)
        .fetch_optional(&state.db)
        .await?
        .is_some();

    if !exists {
        return Err(AppError::NotFound("bill not found".to_string()));
    }

    Ok(Json(DisabledResponse {
        ok: true,
        status: "disabled",
        message: "This capability is disabled in the current backend profile.".to_string(),
        bill_id: Some(bill_id.to_string()),
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
