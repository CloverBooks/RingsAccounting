//! Reconciliation API endpoints
//!
//! Provides bank account reconciliation functionality.
//! Currently returns stub data to prevent frontend errors.

#![allow(dead_code)]

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::AppState;

// ============================================================================
// Reconciliation Types
// ============================================================================

#[derive(Debug, Serialize)]
pub struct ReconciliationAccount {
    pub id: i64,
    pub name: String,
    pub bank_name: String,
    pub last_reconciled_date: Option<String>,
    pub unreconciled_count: i64,
}

#[derive(Debug, Serialize)]
pub struct ReconciliationPeriod {
    pub period: String,
    pub start_date: String,
    pub end_date: String,
    pub transaction_count: i64,
    pub is_reconciled: bool,
}

#[derive(Debug, Serialize)]
pub struct ReconciliationSession {
    pub id: i64,
    pub bank_account_id: i64,
    pub status: String,
    pub statement_balance: Option<f64>,
    pub calculated_balance: f64,
    pub difference: f64,
    pub transactions: Vec<ReconciliationTransaction>,
}

#[derive(Debug, Serialize)]
pub struct ReconciliationTransaction {
    pub id: i64,
    pub date: String,
    pub description: String,
    pub amount: f64,
    pub is_matched: bool,
    pub is_excluded: bool,
    pub match_type: Option<String>,
}

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
    State(_state): State<AppState>,
) -> impl IntoResponse {
    tracing::info!("Listing reconciliation accounts");
    
    let account_list = serde_json::json!([
        {
            "id": "1",
            "name": "1000 · Cash (Main)",
            "bankLabel": "RBC Business #1",
            "currency": "CAD",
            "isDefault": true,
        },
        {
            "id": "2",
            "name": "1010 · Business Savings",
            "bankLabel": "RBC Savings #2",
            "currency": "CAD",
            "isDefault": false,
        },
        {
            "id": "3",
            "name": "2000 · AMEX Corporate",
            "bankLabel": "AMEX Corporate Gold",
            "currency": "CAD",
            "isDefault": false,
        },
    ]);
    
    (StatusCode::OK, Json(account_list))
}

/// GET /api/reconciliation/accounts/:id/periods/
/// Get available reconciliation periods for an account
pub async fn list_periods(
    State(_state): State<AppState>,
    Path(account_id): Path<String>,
) -> impl IntoResponse {
    tracing::info!("Listing reconciliation periods for account {}", account_id);
    
    let periods = match account_id.as_str() {
        "1" => serde_json::json!([
            {"id": "p1", "label": "January 2026", "startDate": "2026-01-01", "endDate": "2026-01-31", "isCurrent": true, "isLocked": false},
            {"id": "p2", "label": "December 2025", "startDate": "2025-12-01", "endDate": "2025-12-31", "isCurrent": false, "isLocked": true},
        ]),
        "2" => serde_json::json!([
            {"id": "p3", "label": "Q4 2025", "startDate": "2025-10-01", "endDate": "2025-12-31", "isCurrent": true, "isLocked": false},
        ]),
        "3" => serde_json::json!([
            {"id": "p4", "label": "January 2026", "startDate": "2026-01-01", "endDate": "2026-01-31", "isCurrent": true, "isLocked": false},
        ]),
        _ => serde_json::json!([]),
    };
    
    (StatusCode::OK, Json(serde_json::json!({
        "periods": periods
    })))
}

/// GET /api/reconciliation/session/
/// Get or create a reconciliation session
pub async fn get_session(
    State(_state): State<AppState>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    tracing::info!("Getting reconciliation session: {:?}", params);
    
    let account = params.get("account").map(|s| s.as_str()).unwrap_or("1");
    let start = params.get("start").map(|s| s.as_str()).unwrap_or("2026-01-01");
    let end = params.get("end").map(|s| s.as_str()).unwrap_or("2026-01-31");

    let period = serde_json::json!({
        "id": "p1", 
        "label": "January 2026", 
        "startDate": start, 
        "endDate": end, 
        "isCurrent": true, 
        "isLocked": false
    });

    let session = serde_json::json!({
        "id": "s1",
        "status": "DRAFT",
        "opening_balance": 45000.00,
        "statement_ending_balance": 52000.00,
        "cleared_balance": 45000.00,
        "difference": 7000.00,
        "total_transactions": 5,
        "reconciled_count": 0,
        "excluded_count": 0,
        "unreconciled_count": 5,
        "reconciled_percent": 0.0,
    });

    let txs = serde_json::json!([
        {"id": 1001, "date": "2026-01-15", "description": "Client Payment - Acme Corp", "amount": 5000.00, "status": "new", "ui_status": "NEW", "is_cleared": false},
        {"id": 1002, "date": "2026-01-16", "description": "Starbucks Coffee", "amount": -15.50, "status": "new", "ui_status": "NEW", "is_cleared": false},
        {"id": 1003, "date": "2026-01-18", "description": "AWS Hosting Plans", "amount": -240.00, "status": "new", "ui_status": "NEW", "is_cleared": false},
        {"id": 1004, "date": "2026-01-20", "description": "Office Rent - Downtown", "amount": -2500.00, "status": "new", "ui_status": "NEW", "is_cleared": false},
        {"id": 1005, "date": "2026-01-22", "description": "Apple Store - Laptop", "amount": -1800.00, "status": "new", "ui_status": "NEW", "is_cleared": false},
    ]);

    let bank_acc = serde_json::json!({
        "id": account, 
        "name": if account == "1" { "1000 · Cash (Main)" } else { "Unknown" }, 
        "currency": "CAD"
    });

    (StatusCode::OK, Json(serde_json::json!({
        "session": session,
        "period": period,
        "bank_account": bank_acc,
        "feed": {
            "new": txs,
            "matched": [],
            "partial": [],
            "excluded": [],
        }
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
