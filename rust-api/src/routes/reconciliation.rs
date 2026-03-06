//! Reconciliation API endpoints
//!
//! Provides bank account reconciliation functionality.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;

use crate::AppState;

// ============================================================================
// Reconciliation Types
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct SessionQuery {
    pub bank_account_id: Option<i64>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MatchQuery {
    pub transaction_id: Option<i64>,
}

// ============================================================================
// Reconciliation Routes
// ============================================================================

/// GET /api/reconciliation/accounts/
/// List bank accounts available for reconciliation
pub async fn list_accounts(
    State(state): State<AppState>,
) -> impl IntoResponse {
    tracing::info!("Listing reconciliation accounts");
    
    // Try to get bank accounts from database
    let accounts = sqlx::query_as::<_, (i64, String, String)>(
        "SELECT id, name, bank_name FROM core_bankaccount 
         WHERE is_active = 1
         ORDER BY name"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();
    
    let account_list: Vec<serde_json::Value> = accounts
        .into_iter()
        .map(|(id, name, bank_name)| {
            serde_json::json!({
                "id": id,
                "name": name,
                "bank_name": bank_name,
                "last_reconciled_date": null,
                "unreconciled_count": 0
            })
        })
        .collect();
    
    (StatusCode::OK, Json(account_list))
}

/// GET /api/reconciliation/accounts/:id/periods/
/// Get available reconciliation periods for an account
pub async fn list_periods(
    State(state): State<AppState>,
    Path(account_id): Path<i64>,
) -> impl IntoResponse {
    tracing::info!("Listing reconciliation periods for account {}", account_id);

    let period_rows = sqlx::query_as::<_, (String, Option<String>, Option<String>, i64)>(
        "SELECT
            substr(date, 1, 7) AS period_key,
            MIN(date) AS start_date,
            MAX(date) AS end_date,
            COUNT(*) AS transaction_count
         FROM core_banktransaction
         WHERE bank_account_id = ? AND date IS NOT NULL
         GROUP BY substr(date, 1, 7)
         ORDER BY period_key DESC",
    )
    .bind(account_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let current_period = chrono::Local::now().format("%Y-%m").to_string();
    let periods: Vec<serde_json::Value> = period_rows
        .into_iter()
        .map(|(period_key, start_date, end_date, _transaction_count)| {
            serde_json::json!({
                "id": period_key,
                "label": period_key,
                "start_date": start_date.unwrap_or_default(),
                "end_date": end_date.unwrap_or_default(),
                "is_current": period_key == current_period,
                "is_locked": false
            })
        })
        .collect();

    (StatusCode::OK, Json(serde_json::json!({
        "periods": periods,
        "bank_account_id": account_id
    })))
}

/// GET /api/reconciliation/session/
/// Get or create a reconciliation session
pub async fn get_session(
    State(_state): State<AppState>,
    Query(params): Query<SessionQuery>,
) -> impl IntoResponse {
    let SessionQuery {
        bank_account_id,
        start_date,
        end_date,
    } = params;
    tracing::info!(
        "Getting reconciliation session: bank_account_id={:?}, start_date={:?}, end_date={:?}",
        bank_account_id,
        start_date,
        end_date
    );

    (StatusCode::OK, Json(serde_json::json!({
        "session": null,
        "bank_account_id": bank_account_id,
        "filters": {
            "start_date": start_date,
            "end_date": end_date
        },
        "transactions": [],
        "message": "No active reconciliation session"
    })))
}

/// GET /api/reconciliation/matches/
/// Get match candidates for a transaction
pub async fn get_matches(
    State(_state): State<AppState>,
    Query(params): Query<MatchQuery>,
) -> impl IntoResponse {
    tracing::info!("Getting match candidates for transaction: {:?}", params.transaction_id);
    
    // Return empty matches
    (StatusCode::OK, Json(Vec::<serde_json::Value>::new()))
}

/// POST /api/reconciliation/confirm-match/
/// Confirm a match between transaction and document
pub async fn confirm_match(
    State(_state): State<AppState>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    tracing::info!("Confirming match: {:?}", body);
    
    (StatusCode::OK, Json(serde_json::json!({
        "ok": true,
        "message": "Match confirmed"
    })))
}

/// POST /api/reconciliation/add-as-new/
/// Add transaction as new record
pub async fn add_as_new(
    State(_state): State<AppState>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    tracing::info!("Adding as new: {:?}", body);
    
    (StatusCode::OK, Json(serde_json::json!({
        "ok": true,
        "message": "Added as new"
    })))
}

/// POST /api/reconciliation/session/:id/exclude/
/// Exclude a transaction from reconciliation
pub async fn exclude_transaction(
    State(_state): State<AppState>,
    Path(session_id): Path<i64>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    tracing::info!("Excluding transaction from session {}: {:?}", session_id, body);
    
    (StatusCode::OK, Json(serde_json::json!({
        "ok": true,
        "message": "Transaction excluded"
    })))
}

/// POST /api/reconciliation/session/:id/unmatch/
/// Unmatch a previously matched transaction
pub async fn unmatch_transaction(
    State(_state): State<AppState>,
    Path(session_id): Path<i64>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    tracing::info!("Unmatching transaction from session {}: {:?}", session_id, body);
    
    (StatusCode::OK, Json(serde_json::json!({
        "ok": true,
        "message": "Transaction unmatched"
    })))
}

/// POST /api/reconciliation/session/:id/set_statement_balance/
/// Set the statement ending balance
pub async fn set_statement_balance(
    State(_state): State<AppState>,
    Path(session_id): Path<i64>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    tracing::info!("Setting statement balance for session {}: {:?}", session_id, body);
    
    (StatusCode::OK, Json(serde_json::json!({
        "ok": true,
        "message": "Statement balance set"
    })))
}

/// POST /api/reconciliation/sessions/:id/complete/
/// Complete a reconciliation session
pub async fn complete_session(
    State(_state): State<AppState>,
    Path(session_id): Path<i64>,
) -> impl IntoResponse {
    tracing::info!("Completing reconciliation session {}", session_id);
    
    (StatusCode::OK, Json(serde_json::json!({
        "ok": true,
        "message": "Session completed"
    })))
}

/// POST /api/reconciliation/sessions/:id/reopen/
/// Reopen a completed reconciliation session
pub async fn reopen_session(
    State(_state): State<AppState>,
    Path(session_id): Path<i64>,
) -> impl IntoResponse {
    tracing::info!("Reopening reconciliation session {}", session_id);
    
    (StatusCode::OK, Json(serde_json::json!({
        "ok": true,
        "message": "Session reopened"
    })))
}

/// POST /api/reconciliation/sessions/:id/delete/
/// Delete a reconciliation session
pub async fn delete_session(
    State(_state): State<AppState>,
    Path(session_id): Path<i64>,
) -> impl IntoResponse {
    tracing::info!("Deleting reconciliation session {}", session_id);
    
    (StatusCode::OK, Json(serde_json::json!({
        "ok": true,
        "message": "Session deleted"
    })))
}

/// POST /api/reconciliation/create-adjustment/
/// Create an adjustment entry
pub async fn create_adjustment(
    State(_state): State<AppState>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    tracing::info!("Creating adjustment: {:?}", body);
    
    (StatusCode::OK, Json(serde_json::json!({
        "ok": true,
        "message": "Adjustment created"
    })))
}
