use axum::{body::Bytes, extract::State, http::HeaderMap, Json};

use crate::{error::AppResult, AppState};

#[derive(serde::Serialize)]
pub struct DisabledWebhookResponse {
    pub ok: bool,
    pub status: &'static str,
    pub message: String,
    pub received: bool,
    pub size_bytes: usize,
}

pub async fn payment_status(
    State(_state): State<AppState>,
    _headers: HeaderMap,
    body: Bytes,
) -> AppResult<Json<DisabledWebhookResponse>> {
    Ok(Json(DisabledWebhookResponse {
        ok: true,
        status: "disabled",
        message: "This capability is disabled in the current backend profile.".to_string(),
        received: true,
        size_bytes: body.len(),
    }))
}
