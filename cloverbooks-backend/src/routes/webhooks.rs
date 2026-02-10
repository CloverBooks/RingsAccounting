use axum::{body::Bytes, extract::State, http::HeaderMap, Json};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use subtle::ConstantTimeEq;

use crate::{
    error::{AppError, AppResult},
    models::{Payment, WebhookPayload},
    AppState,
};

pub async fn payment_status(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> AppResult<Json<Payment>> {
    let signature = extract_signature(&headers)?;
    let secret = &state.config.webhook_secret;

    if !verify_signature(secret, &body, signature) {
        return Err(AppError::Unauthorized);
    }

    let payload: WebhookPayload = serde_json::from_slice(&body)
        .map_err(|_| AppError::Validation("invalid webhook payload".to_string()))?;

    let status = normalize_payment_status(&payload.status)?;

    let mut tx = state.db.begin().await?;

    let payment = if let Some(payment_id) = payload.payment_id {
        sqlx::query_as::<_, Payment>(
            r#"UPDATE payments
            SET status = $1, raw_response = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING id, bill_id, invoice_id, status, gateway_transaction_id, raw_response, created_at, updated_at"#,
        )
        .bind(status)
        .bind(serde_json::to_value(&payload).unwrap_or_default())
        .bind(payment_id)
        .fetch_one(&mut *tx)
        .await?
    } else if let Some(gateway_id) = payload.gateway_transaction_id.clone() {
        sqlx::query_as::<_, Payment>(
            r#"UPDATE payments
            SET status = $1, raw_response = $2, updated_at = NOW()
            WHERE gateway_transaction_id = $3
            RETURNING id, bill_id, invoice_id, status, gateway_transaction_id, raw_response, created_at, updated_at"#,
        )
        .bind(status)
        .bind(serde_json::to_value(&payload).unwrap_or_default())
        .bind(gateway_id)
        .fetch_one(&mut *tx)
        .await?
    } else {
        return Err(AppError::Validation("payment_id or gateway_transaction_id required".to_string()));
    };

    let bill_id = payload.bill_id.or(payment.bill_id);
    let invoice_id = payload.invoice_id.or(payment.invoice_id);

    if let Some(bill_id) = bill_id {
        sqlx::query("UPDATE bills SET status = $1 WHERE id = $2")
            .bind(map_bill_status(status))
            .bind(bill_id)
            .execute(&mut *tx)
            .await?;
    }

    if let Some(invoice_id) = invoice_id {
        sqlx::query("UPDATE invoices SET status = $1 WHERE id = $2")
            .bind(map_bill_status(status))
            .bind(invoice_id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;

    Ok(Json(payment))
}

fn extract_signature(headers: &HeaderMap) -> AppResult<&str> {
    let header = headers
        .get("x-webhook-signature")
        .or_else(|| headers.get("x-signature"))
        .ok_or(AppError::Unauthorized)?;

    header
        .to_str()
        .map_err(|_| AppError::Unauthorized)
}

fn verify_signature(secret: &str, body: &[u8], signature: &str) -> bool {
    let mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes());
    if mac.is_err() {
        return false;
    }

    let mut mac = mac.expect("hmac initialized");
    mac.update(body);
    let expected = mac.finalize().into_bytes();

    let provided = hex::decode(signature).unwrap_or_default();
    if provided.len() != expected.len() {
        return false;
    }

    expected.ct_eq(&provided).into()
}

fn normalize_payment_status(status: &str) -> AppResult<&'static str> {
    match status.trim().to_lowercase().as_str() {
        "succeeded" | "paid" | "success" => Ok("succeeded"),
        "failed" | "error" => Ok("failed"),
        _ => Err(AppError::Validation("invalid payment status".to_string())),
    }
}

fn map_bill_status(payment_status: &str) -> &'static str {
    if payment_status == "succeeded" {
        "paid"
    } else {
        "failed"
    }
}
