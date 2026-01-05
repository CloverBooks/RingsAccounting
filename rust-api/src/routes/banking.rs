//! Banking and reconciliation routes for Clover Books API
//!
//! Proxies requests to Django backend for bank matching and reconciliation services.
//! This provides a unified API surface while leveraging Django's mature accounting logic.

use axum::{
    extract::{Json, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

// Django backend URL (in production, use environment variable)
const DJANGO_BACKEND_URL: &str = "http://localhost:8000";

// ============================================================================
// Shared State for HTTP Client
// ============================================================================

#[derive(Clone)]
pub struct BankingState {
    pub http_client: reqwest::Client,
}

impl Default for BankingState {
    fn default() -> Self {
        Self {
            http_client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
        }
    }
}

// ============================================================================
// Request/Response Types
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct FindMatchesRequest {
    pub bank_transaction_id: i64,
    #[serde(default = "default_limit")]
    pub limit: i32,
    #[serde(default)]
    pub extended_lookback: bool, // QBO parity: 180-day window
}

fn default_limit() -> i32 {
    5
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MatchCandidate {
    pub match_type: String, // RULE, ONE_TO_ONE, TRANSFER
    pub confidence: f64,
    pub reason: String,
    pub journal_entry_id: Option<i64>,
    pub rule_id: Option<i64>,
    pub auto_confirm: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct FindMatchesResponse {
    pub ok: bool,
    pub matches: Vec<MatchCandidate>,
    pub bank_transaction_id: i64,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ConfirmMatchRequest {
    pub bank_transaction_id: i64,
    pub journal_entry_id: i64,
    pub match_confidence: f64,
    pub adjustment_amount: Option<f64>,
    pub adjustment_account_id: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ConfirmMatchResponse {
    pub ok: bool,
    pub bank_transaction_id: i64,
    pub status: String,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AllocateRequest {
    pub bank_transaction_id: i64,
    pub allocations: Vec<AllocationItem>,
    pub fees: Option<AllocationItem>,
    pub rounding: Option<AllocationItem>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct AllocationItem {
    pub kind: String, // INVOICE, BILL, DIRECT_INCOME, DIRECT_EXPENSE, CREDIT_NOTE
    pub amount: f64,
    pub id: Option<i64>,
    pub account_id: Option<i64>,
    pub tax_rate_id: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct AllocateResponse {
    pub ok: bool,
    pub journal_entry_id: Option<i64>,
    pub bank_transaction_status: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReconciliationProgress {
    pub total_transactions: i64,
    pub reconciled: i64,
    pub unreconciled: i64,
    pub total_reconciled_amount: f64,
    pub total_unreconciled_amount: f64,
    pub reconciliation_percentage: f64,
}

#[derive(Debug, Deserialize)]
pub struct DuplicateCheckRequest {
    pub transactions: Vec<TransactionToCheck>,
}

#[derive(Debug, Deserialize)]
pub struct TransactionToCheck {
    pub amount: f64,
    pub date: String,
    pub description: String,
}

#[derive(Debug, Serialize)]
pub struct DuplicateCheckResponse {
    pub ok: bool,
    pub duplicates: Vec<DuplicateInfo>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DuplicateInfo {
    pub index: usize,
    pub existing_transaction_id: i64,
    pub match_reason: String,
}

// ============================================================================
// Route Handlers
// ============================================================================

/// POST /api/banking/find-matches
///
/// Find potential matches for a bank transaction using 3-tier matching engine.
/// Supports extended 180-day lookback for QBO parity.
pub async fn find_matches(
    State(state): State<Arc<BankingState>>,
    Json(payload): Json<FindMatchesRequest>,
) -> impl IntoResponse {
    tracing::info!(
        "Finding matches for bank_transaction_id={}, extended_lookback={}",
        payload.bank_transaction_id,
        payload.extended_lookback
    );

    // Proxy to Django backend
    let django_url = format!(
        "{}/api/banking/find-matches/",
        DJANGO_BACKEND_URL
    );

    match state
        .http_client
        .post(&django_url)
        .json(&serde_json::json!({
            "bank_transaction_id": payload.bank_transaction_id,
            "limit": payload.limit,
            "extended_lookback": payload.extended_lookback,
        }))
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<serde_json::Value>().await {
                    Ok(data) => {
                        let matches: Vec<MatchCandidate> = data
                            .get("matches")
                            .and_then(|m| serde_json::from_value(m.clone()).ok())
                            .unwrap_or_default();

                        (
                            StatusCode::OK,
                            Json(FindMatchesResponse {
                                ok: true,
                                matches,
                                bank_transaction_id: payload.bank_transaction_id,
                                error: None,
                            }),
                        )
                    }
                    Err(e) => (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(FindMatchesResponse {
                            ok: false,
                            matches: vec![],
                            bank_transaction_id: payload.bank_transaction_id,
                            error: Some(format!("Failed to parse response: {}", e)),
                        }),
                    ),
                }
            } else {
                (
                    StatusCode::from_u16(response.status().as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
                    Json(FindMatchesResponse {
                        ok: false,
                        matches: vec![],
                        bank_transaction_id: payload.bank_transaction_id,
                        error: Some("Django backend returned error".to_string()),
                    }),
                )
            }
        }
        Err(e) => {
            tracing::error!("Failed to connect to Django backend: {}", e);
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(FindMatchesResponse {
                    ok: false,
                    matches: vec![],
                    bank_transaction_id: payload.bank_transaction_id,
                    error: Some(format!("Backend unavailable: {}", e)),
                }),
            )
        }
    }
}

/// POST /api/banking/confirm-match
///
/// Confirm a suggested match between bank transaction and journal entry.
/// Supports adjustment entries for bank fees, FX differences.
pub async fn confirm_match(
    State(state): State<Arc<BankingState>>,
    Json(payload): Json<ConfirmMatchRequest>,
) -> impl IntoResponse {
    tracing::info!(
        "Confirming match: bank_tx={} -> journal_entry={}",
        payload.bank_transaction_id,
        payload.journal_entry_id
    );

    let django_url = format!("{}/api/banking/confirm-match/", DJANGO_BACKEND_URL);

    match state
        .http_client
        .post(&django_url)
        .json(&payload)
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                (
                    StatusCode::OK,
                    Json(ConfirmMatchResponse {
                        ok: true,
                        bank_transaction_id: payload.bank_transaction_id,
                        status: "MATCHED".to_string(),
                        error: None,
                    }),
                )
            } else {
                (
                    StatusCode::BAD_REQUEST,
                    Json(ConfirmMatchResponse {
                        ok: false,
                        bank_transaction_id: payload.bank_transaction_id,
                        status: "ERROR".to_string(),
                        error: Some("Failed to confirm match".to_string()),
                    }),
                )
            }
        }
        Err(e) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ConfirmMatchResponse {
                ok: false,
                bank_transaction_id: payload.bank_transaction_id,
                status: "ERROR".to_string(),
                error: Some(format!("Backend unavailable: {}", e)),
            }),
        ),
    }
}

/// POST /api/banking/allocate
///
/// Allocate a bank transaction to invoices, bills, or direct income/expense.
/// Creates proper journal entries following double-entry bookkeeping.
pub async fn allocate(
    State(state): State<Arc<BankingState>>,
    Json(payload): Json<AllocateRequest>,
) -> impl IntoResponse {
    tracing::info!(
        "Allocating bank_tx={} with {} allocations",
        payload.bank_transaction_id,
        payload.allocations.len()
    );

    let django_url = format!("{}/api/banking/allocate/", DJANGO_BACKEND_URL);

    match state
        .http_client
        .post(&django_url)
        .json(&payload)
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<serde_json::Value>().await {
                    Ok(data) => (
                        StatusCode::OK,
                        Json(AllocateResponse {
                            ok: true,
                            journal_entry_id: data.get("journal_entry_id").and_then(|v| v.as_i64()),
                            bank_transaction_status: data
                                .get("status")
                                .and_then(|v| v.as_str())
                                .unwrap_or("MATCHED")
                                .to_string(),
                            error: None,
                        }),
                    ),
                    Err(_) => (
                        StatusCode::OK,
                        Json(AllocateResponse {
                            ok: true,
                            journal_entry_id: None,
                            bank_transaction_status: "MATCHED".to_string(),
                            error: None,
                        }),
                    ),
                }
            } else {
                (
                    StatusCode::BAD_REQUEST,
                    Json(AllocateResponse {
                        ok: false,
                        journal_entry_id: None,
                        bank_transaction_status: "ERROR".to_string(),
                        error: Some("Allocation failed".to_string()),
                    }),
                )
            }
        }
        Err(e) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(AllocateResponse {
                ok: false,
                journal_entry_id: None,
                bank_transaction_status: "ERROR".to_string(),
                error: Some(format!("Backend unavailable: {}", e)),
            }),
        ),
    }
}

/// GET /api/banking/progress/:account_id
///
/// Get reconciliation progress for a bank account.
pub async fn get_progress(
    State(state): State<Arc<BankingState>>,
    Path(account_id): Path<i64>,
) -> impl IntoResponse {
    tracing::info!("Getting reconciliation progress for account_id={}", account_id);

    let django_url = format!(
        "{}/api/banking/progress/{}/",
        DJANGO_BACKEND_URL, account_id
    );

    match state.http_client.get(&django_url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<ReconciliationProgress>().await {
                    Ok(progress) => (StatusCode::OK, Json(serde_json::json!({
                        "ok": true,
                        "progress": progress,
                    }))),
                    Err(_) => (StatusCode::OK, Json(serde_json::json!({
                        "ok": true,
                        "progress": {
                            "total_transactions": 0,
                            "reconciled": 0,
                            "unreconciled": 0,
                            "total_reconciled_amount": 0.0,
                            "total_unreconciled_amount": 0.0,
                            "reconciliation_percentage": 100.0
                        }
                    }))),
                }
            } else {
                (StatusCode::NOT_FOUND, Json(serde_json::json!({
                    "ok": false,
                    "error": "Account not found"
                })))
            }
        }
        Err(e) => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({
            "ok": false,
            "error": format!("Backend unavailable: {}", e)
        }))),
    }
}

/// POST /api/banking/check-duplicates
///
/// QBO parity: Check for duplicate transactions before import.
pub async fn check_duplicates(
    State(state): State<Arc<BankingState>>,
    Json(payload): Json<DuplicateCheckRequest>,
) -> impl IntoResponse {
    tracing::info!(
        "Checking {} transactions for duplicates",
        payload.transactions.len()
    );

    let django_url = format!("{}/api/banking/check-duplicates/", DJANGO_BACKEND_URL);

    match state
        .http_client
        .post(&django_url)
        .json(&payload)
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<DuplicateCheckResponse>().await {
                    Ok(result) => (StatusCode::OK, Json(result)),
                    Err(_) => (
                        StatusCode::OK,
                        Json(DuplicateCheckResponse {
                            ok: true,
                            duplicates: vec![],
                            error: None,
                        }),
                    ),
                }
            } else {
                (
                    StatusCode::BAD_REQUEST,
                    Json(DuplicateCheckResponse {
                        ok: false,
                        duplicates: vec![],
                        error: Some("Duplicate check failed".to_string()),
                    }),
                )
            }
        }
        Err(e) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(DuplicateCheckResponse {
                ok: false,
                duplicates: vec![],
                error: Some(format!("Backend unavailable: {}", e)),
            }),
        ),
    }
}

/// GET /api/banking/health
///
/// Health check for banking service.
pub async fn health() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "ok",
        "service": "banking",
        "version": "1.0.0"
    }))
}
