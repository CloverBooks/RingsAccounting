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
    models::{CreateInvoiceRequest, Invoice},
    AppState,
};

#[derive(serde::Serialize)]
struct DisabledResponse {
    ok: bool,
    status: &'static str,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    invoice_id: Option<String>,
}

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
) -> AppResult<Json<DisabledResponse>> {
    let invoice_id = Uuid::parse_str(&id)
        .map_err(|_| AppError::Validation("invalid invoice id".to_string()))?;

    let exists = query("SELECT 1 FROM invoices WHERE id = $1")
        .bind(invoice_id)
        .fetch_optional(&state.db)
        .await?
        .is_some();

    if !exists {
        return Err(AppError::NotFound("invoice not found".to_string()));
    }

    Ok(Json(DisabledResponse {
        ok: true,
        status: "disabled",
        message: "This capability is disabled in the current backend profile.".to_string(),
        invoice_id: Some(invoice_id.to_string()),
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
