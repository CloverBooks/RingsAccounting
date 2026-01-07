//! Agentic AI endpoints for Invoice and other AI processing
//!
//! Stub endpoints that prevent frontend errors while the full implementation
//! is being developed.

#![allow(dead_code)]

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Serialize;

use crate::AppState;
use crate::companion_autonomy::store as autonomy_store;
use axum::http::HeaderMap;
use chrono::TimeZone;

// ============================================================================
// Invoice AI Types
// ============================================================================

#[derive(Debug, Serialize)]
pub struct InvoiceRun {
    pub id: i64,
    pub status: String,
    pub created_at: String,
    pub file_count: i32,
    pub processed_count: i32,
    pub invoices: Vec<ExtractedInvoice>,
}

#[derive(Debug, Serialize)]
pub struct ExtractedInvoice {
    pub id: i64,
    pub vendor_name: Option<String>,
    pub invoice_number: Option<String>,
    pub issue_date: Option<String>,
    pub due_date: Option<String>,
    pub subtotal: f64,
    pub tax_total: f64,
    pub grand_total: f64,
    pub status: String,
    pub confidence: f64,
}

// ============================================================================
// Invoice AI Routes
// ============================================================================

/// GET /api/agentic/invoices/runs
/// List all invoice processing runs
pub async fn list_runs(
    State(_state): State<AppState>,
) -> impl IntoResponse {
    tracing::info!("Listing invoice AI runs");
    
    // Return empty list - no runs yet
    (StatusCode::OK, Json(serde_json::json!({
        "runs": [],
        "total": 0
    })))
}

/// GET /api/agentic/invoices/run/:id
/// Get details of a specific run
pub async fn get_run(
    State(_state): State<AppState>,
    Path(run_id): Path<i64>,
) -> impl IntoResponse {
    tracing::info!("Getting invoice run id={}", run_id);
    
    (StatusCode::NOT_FOUND, Json(serde_json::json!({
        "error": "Run not found",
        "run_id": run_id
    })))
}

/// POST /api/agentic/invoices/run
/// Upload and process invoice files
pub async fn create_run(
    State(_state): State<AppState>,
) -> impl IntoResponse {
    tracing::info!("Creating new invoice AI run");
    
    // Return stub response - would normally create a run and start processing
    (StatusCode::OK, Json(serde_json::json!({
        "ok": true,
        "run": {
            "id": 1,
            "status": "processing",
            "created_at": "2026-01-06T00:00:00Z",
            "file_count": 0,
            "processed_count": 0,
            "invoices": []
        },
        "message": "Invoice processing is not yet implemented in the Rust API"
    })))
}

/// POST /api/agentic/invoices/:id/approve
/// Approve an extracted invoice for posting
pub async fn approve_invoice(
    State(_state): State<AppState>,
    Path(invoice_id): Path<i64>,
) -> impl IntoResponse {
    tracing::info!("Approving invoice id={}", invoice_id);
    
    (StatusCode::OK, Json(serde_json::json!({
        "ok": true,
        "invoice_id": invoice_id,
        "message": "Invoice approval not yet implemented"
    })))
}

/// POST /api/agentic/invoices/:id/discard
/// Discard an extracted invoice
pub async fn discard_invoice(
    State(_state): State<AppState>,
    Path(invoice_id): Path<i64>,
) -> impl IntoResponse {
    tracing::info!("Discarding invoice id={}", invoice_id);
    
    (StatusCode::OK, Json(serde_json::json!({
        "ok": true,
        "invoice_id": invoice_id,
        "message": "Invoice discarded"
    })))
}

// ============================================================================
// Receipts AI Routes
// ============================================================================

/// GET /api/agentic/receipts/runs
/// List all receipt processing runs
pub async fn list_receipt_runs(
    State(_state): State<AppState>,
) -> impl IntoResponse {
    tracing::info!("Listing receipt AI runs");
    
    // Return empty list - no runs yet
    (StatusCode::OK, Json(serde_json::json!({
        "runs": [],
        "total": 0
    })))
}

/// GET /api/agentic/receipts/run/:id
/// Get details of a specific receipt run
pub async fn get_receipt_run(
    State(_state): State<AppState>,
    Path(run_id): Path<i64>,
) -> impl IntoResponse {
    tracing::info!("Getting receipt run id={}", run_id);
    
    (StatusCode::NOT_FOUND, Json(serde_json::json!({
        "error": "Run not found",
        "run_id": run_id
    })))
}

/// POST /api/agentic/receipts/run
/// Upload and process receipt files
pub async fn create_receipt_run(
    State(_state): State<AppState>,
) -> impl IntoResponse {
    tracing::info!("Creating new receipt AI run");
    
    (StatusCode::OK, Json(serde_json::json!({
        "ok": true,
        "run": {
            "id": 1,
            "status": "processing",
            "created_at": "2026-01-06T00:00:00Z",
            "file_count": 0,
            "processed_count": 0,
            "receipts": []
        },
        "message": "Receipt processing is not yet implemented in the Rust API"
    })))
}

/// POST /api/agentic/receipts/:id/approve
/// Approve an extracted receipt for posting
pub async fn approve_receipt(
    State(_state): State<AppState>,
    Path(receipt_id): Path<i64>,
) -> impl IntoResponse {
    tracing::info!("Approving receipt id={}", receipt_id);
    
    (StatusCode::OK, Json(serde_json::json!({
        "ok": true,
        "receipt_id": receipt_id,
        "message": "Receipt approval not yet implemented"
    })))
}

/// POST /api/agentic/receipts/:id/discard
/// Discard an extracted receipt
pub async fn discard_receipt(
    State(_state): State<AppState>,
    Path(receipt_id): Path<i64>,
) -> impl IntoResponse {
    tracing::info!("Discarding receipt id={}", receipt_id);
    
    (StatusCode::OK, Json(serde_json::json!({
        "ok": true,
        "receipt_id": receipt_id,
        "message": "Receipt discarded"
    })))
}

// ============================================================================
// Companion AI Routes (for Control Tower)
// ============================================================================

/// GET /api/agentic/companion/summary
/// Returns comprehensive AI companion summary for the Control Tower
pub async fn companion_summary(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    tracing::info!("Getting companion summary");
    
    let business_id = crate::routes::auth::extract_claims_from_header(&headers)
        .ok()
        .and_then(|claims| claims.business_id)
        .unwrap_or(1);
    let engine_snapshot_meta = fetch_engine_snapshot_meta(&state.db, business_id).await;

    // Return comprehensive mock data that matches the frontend expected structure
    (StatusCode::OK, Json(serde_json::json!({
        "ai_companion_enabled": true,
        "generated_at": chrono::Utc::now().to_rfc3339(),
        "voice": {
            "greeting": "Good morning",
            "focus_mode": "watchlist",
            "tone_tagline": "Your books look healthy. A few items need your attention.",
            "primary_call_to_action": "Review 2 bank transactions that need categorization."
        },
        "radar": {
            "cash_reconciliation": { "score": 92, "open_issues": 2 },
            "revenue_invoices": { "score": 98, "open_issues": 0 },
            "expenses_receipts": { "score": 85, "open_issues": 3 },
            "tax_compliance": { "score": 100, "open_issues": 0 }
        },
        "coverage": {
            "receipts": { "coverage_percent": 85, "total_items": 20, "covered_items": 17 },
            "invoices": { "coverage_percent": 98, "total_items": 50, "covered_items": 49 },
            "banking": { "coverage_percent": 92, "total_items": 100, "covered_items": 92 },
            "books": { "coverage_percent": 95, "total_items": 200, "covered_items": 190 }
        },
        "playbook": [
            {
                "label": "Categorize bank transactions",
                "description": "2 transactions need categories",
                "severity": "medium",
                "surface": "banking",
                "url": "/banking",
                "requires_premium": false
            },
            {
                "label": "Upload missing receipts",
                "description": "3 expenses without receipts",
                "severity": "low",
                "surface": "receipts",
                "url": "/receipts",
                "requires_premium": false
            }
        ],
        "close_readiness": {
            "status": "not_ready",
            "period_label": "January 2026",
            "progress_percent": 75,
            "blocking_items": [
                { "reason": "2 unreconciled transactions", "surface": "banking", "severity": "medium" },
                { "reason": "Missing receipt documents", "surface": "receipts", "severity": "low" }
            ]
        },
        "llm_subtitles": {
            "banking": "2 transactions need attention",
            "receipts": "",
            "invoices": "",
            "books": ""
        },
        "finance_snapshot": {
            "ending_cash": 45250.00,
            "monthly_burn": 12500.00,
            "runway_months": 3.6,
            "months": [
                { "m": "Oct", "rev": 28000, "exp": 22000 },
                { "m": "Nov", "rev": 32000, "exp": 24000 },
                { "m": "Dec", "rev": 35000, "exp": 26000 }
            ],
            "ar_buckets": [
                { "bucket": "Current", "amount": 8500 },
                { "bucket": "1-30 days", "amount": 2200 },
                { "bucket": "31-60 days", "amount": 500 },
                { "bucket": "60+ days", "amount": 0 }
            ],
            "total_overdue": 2700
        },
        "tax": {
            "period_key": "2026-01",
            "net_tax": 0,
            "jurisdictions": [],
            "anomaly_counts": { "low": 0, "medium": 0, "high": 0 }
        },
        "engine_snapshot_meta": engine_snapshot_meta
    })))
}

async fn fetch_engine_snapshot_meta(
    pool: &sqlx::SqlitePool,
    business_id: i64,
) -> Option<serde_json::Value> {
    let snapshot = autonomy_store::latest_queue_snapshot(pool, business_id)
        .await
        .ok()
        .flatten()?;

    let stale = is_queue_snapshot_stale(&snapshot.generated_at, snapshot.stale_after_seconds);
    let payload: serde_json::Value = serde_json::from_str(&snapshot.snapshot_json).unwrap_or_default();
    let queued_total = payload
        .get("job_totals")
        .and_then(|v| v.get("queued"))
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    let blocked_total = payload
        .get("job_totals")
        .and_then(|v| v.get("blocked"))
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    let breaker_events = payload
        .get("stats")
        .and_then(|v| v.get("breaker_events_last_day"))
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    let mode = payload
        .get("mode")
        .and_then(|v| v.as_str())
        .unwrap_or("suggest_only");

    Some(serde_json::json!({
        "generated_at": snapshot.generated_at,
        "stale": stale,
        "queued_total": queued_total,
        "blocked_total": blocked_total,
        "mode": mode,
        "breakers_ok": breaker_events == 0
    }))
}

fn is_queue_snapshot_stale(generated_at: &str, stale_after_seconds: i64) -> bool {
    if let Ok(parsed) = chrono::NaiveDateTime::parse_from_str(generated_at, "%Y-%m-%d %H:%M:%S") {
        let generated = chrono::Utc.from_utc_datetime(&parsed);
        let age_seconds = (chrono::Utc::now() - generated).num_seconds();
        return age_seconds > stale_after_seconds;
    }
    false
}

/// GET /api/agentic/companion/issues
/// Returns open companion issues for the Control Tower
pub async fn companion_issues(
    State(_state): State<AppState>,
) -> impl IntoResponse {
    tracing::info!("Getting companion issues");
    
    // Return empty issues list (matches the frontend expected structure)
    (StatusCode::OK, Json(serde_json::json!({
        "issues": [],
        "total": 0
    })))
}

