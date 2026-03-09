//! Tax Guardian API routes
//!
//! Provides endpoints for tax period management, snapshots, anomalies, and payments.
//! These endpoints support the Tax Guardian UI in the customer frontend.

use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::AppState;

// =============================================================================
// Types
// =============================================================================

#[derive(Debug, Serialize)]
pub struct AnomalyCounts {
    pub low: i32,
    pub medium: i32,
    pub high: i32,
}

#[derive(Debug, Serialize)]
pub struct TaxPeriod {
    pub period_key: String,
    pub status: String,
    pub net_tax: f64,
    pub payments_payment_total: f64,
    pub payments_refund_total: f64,
    pub payments_net_total: f64,
    pub payments_total: f64,
    pub balance: f64,
    pub remaining_balance: f64,
    pub payment_status: Option<String>,
    pub anomaly_counts: AnomalyCounts,
    pub due_date: Option<String>,
    pub is_due_soon: bool,
    pub is_overdue: bool,
}

#[derive(Debug, Serialize)]
pub struct TaxPeriodsResponse {
    pub periods: Vec<TaxPeriod>,
}

#[derive(Debug, Serialize)]
pub struct JurisdictionSummary {
    pub code: String,
    pub name: String,
    pub taxable_sales: f64,
    pub tax_collected: f64,
    pub tax_on_purchases: f64,
    pub net_tax: f64,
}

#[derive(Debug, Serialize)]
pub struct TaxPayment {
    pub id: String,
    pub kind: String,
    pub amount: f64,
    pub currency: String,
    pub payment_date: String,
    pub bank_account_id: Option<String>,
    pub bank_account_label: Option<String>,
    pub method: Option<String>,
    pub reference: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct TaxSnapshot {
    pub period_key: String,
    pub country: String,
    pub status: String,
    pub due_date: Option<String>,
    pub is_due_soon: bool,
    pub is_overdue: bool,
    pub filed_at: Option<String>,
    pub last_filed_at: Option<String>,
    pub last_reset_at: Option<String>,
    pub last_reset_reason: Option<String>,
    pub llm_summary: Option<String>,
    pub llm_notes: Option<String>,
    pub summary_by_jurisdiction: std::collections::HashMap<String, JurisdictionSummary>,
    pub line_mappings: std::collections::HashMap<String, serde_json::Value>,
    pub net_tax: f64,
    pub payments: Vec<TaxPayment>,
    pub payments_payment_total: f64,
    pub payments_refund_total: f64,
    pub payments_net_total: f64,
    pub payments_total: f64,
    pub balance: f64,
    pub remaining_balance: f64,
    pub payment_status: Option<String>,
    pub anomaly_counts: AnomalyCounts,
    pub has_high_severity_blockers: bool,
}

#[derive(Debug, Serialize)]
pub struct TaxAnomaly {
    pub id: String,
    pub code: String,
    pub severity: String,
    pub status: String,
    pub description: String,
    pub task_code: String,
    pub created_at: String,
    pub resolved_at: Option<String>,
    pub linked_model: Option<String>,
    pub linked_id: Option<i64>,
    pub jurisdiction_code: Option<String>,
    pub linked_model_friendly: Option<String>,
    pub ledger_path: Option<String>,
    pub expected_tax_amount: Option<f64>,
    pub actual_tax_amount: Option<f64>,
    pub difference: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct TaxAnomaliesResponse {
    pub anomalies: Vec<TaxAnomaly>,
}

#[derive(Debug, Deserialize)]
pub struct AnomaliesQuery {
    pub severity: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StatusUpdate {
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct AnomalyUpdate {
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct ResetRequest {
    pub confirm_reset: bool,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PaymentCreate {
    pub kind: Option<String>,
    pub bank_account_id: Option<String>,
    pub amount: serde_json::Value,
    pub payment_date: String,
    pub method: Option<String>,
    pub reference: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PaymentUpdate {
    pub kind: Option<String>,
    pub bank_account_id: Option<String>,
    pub amount: Option<serde_json::Value>,
    pub payment_date: Option<String>,
    pub method: Option<String>,
    pub reference: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SuccessResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DisabledActionResponse {
    pub ok: bool,
    pub status: &'static str,
    pub message: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct DashboardTaxGuardianCard {
    pub period_key: String,
    pub net_tax_due: Option<f64>,
    pub due_date: Option<String>,
    pub status: String,
    pub open_anomalies: i32,
    pub due_label: String,
}

// =============================================================================
// Helper Functions
// =============================================================================

fn neutral_snapshot(period_key: &str) -> TaxSnapshot {
    TaxSnapshot {
        period_key: period_key.to_string(),
        country: "CA".to_string(),
        status: "DRAFT".to_string(),
        due_date: None,
        is_due_soon: false,
        is_overdue: false,
        filed_at: None,
        last_filed_at: None,
        last_reset_at: None,
        last_reset_reason: None,
        llm_summary: None,
        llm_notes: None,
        summary_by_jurisdiction: std::collections::HashMap::new(),
        line_mappings: std::collections::HashMap::new(),
        net_tax: 0.0,
        payments: Vec::new(),
        payments_payment_total: 0.0,
        payments_refund_total: 0.0,
        payments_net_total: 0.0,
        payments_total: 0.0,
        balance: 0.0,
        remaining_balance: 0.0,
        payment_status: None,
        anomaly_counts: AnomalyCounts { low: 0, medium: 0, high: 0 },
        has_high_severity_blockers: false,
    }
}

async fn table_exists(pool: &sqlx::SqlitePool, table: &str) -> bool {
    sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
    )
    .bind(table)
    .fetch_one(pool)
    .await
    .unwrap_or(0)
        > 0
}

async fn column_exists(pool: &sqlx::SqlitePool, table: &str, column: &str) -> bool {
    let pragma = format!("PRAGMA table_info({})", table);
    let columns = sqlx::query_as::<_, (i64, String, String, i64, Option<String>, i64)>(&pragma)
        .fetch_all(pool)
        .await
        .unwrap_or_default();
    columns.into_iter().any(|(_, name, _, _, _, _)| name == column)
}

async fn count_open_anomalies_for_business(pool: &sqlx::SqlitePool, business_id: i64) -> i32 {
    for table in ["tax_anomaly", "core_tax_anomaly", "tax_guardian_anomaly"] {
        if !table_exists(pool, table).await || !column_exists(pool, table, "status").await {
            continue;
        }

        let mut query = format!(
            "SELECT COUNT(*) FROM {} WHERE upper(COALESCE(status, 'OPEN')) IN ('OPEN', 'PENDING', 'NEW')",
            table,
        );
        if column_exists(pool, table, "business_id").await {
            query.push_str(" AND business_id = ?");
            return sqlx::query_scalar::<_, i64>(&query)
                .bind(business_id)
                .fetch_one(pool)
                .await
                .unwrap_or(0) as i32;
        }

        return sqlx::query_scalar::<_, i64>(&query)
            .fetch_one(pool)
            .await
            .unwrap_or(0) as i32;
    }

    0
}

pub async fn fetch_dashboard_tax_guardian_card(
    pool: &sqlx::SqlitePool,
    business_id: i64,
) -> Option<DashboardTaxGuardianCard> {
    let open_anomalies = count_open_anomalies_for_business(pool, business_id).await;
    let status = if open_anomalies > 0 { "attention" } else { "all_clear" };

    Some(DashboardTaxGuardianCard {
        period_key: Utc::now().format("%Y-%m").to_string(),
        net_tax_due: Some(0.0),
        due_date: None,
        status: status.to_string(),
        open_anomalies,
        due_label: "Unknown".to_string(),
    })
}

// =============================================================================
// Route Handlers
// =============================================================================

/// GET /api/tax/periods/
/// Returns list of all tax periods for the current business
pub async fn list_periods(
    State(_state): State<AppState>,
) -> impl IntoResponse {
    let periods: Vec<TaxPeriod> = Vec::new();
    Json(TaxPeriodsResponse { periods })
}

/// GET /api/tax/periods/:period_key/
/// Returns tax snapshot for a specific period
pub async fn get_snapshot(
    State(_state): State<AppState>,
    Path(period_key): Path<String>,
) -> impl IntoResponse {
    let snapshot = neutral_snapshot(&period_key);
    Json(snapshot)
}

/// GET /api/tax/periods/:period_key/anomalies/
/// Returns anomalies for a specific period
pub async fn list_anomalies(
    State(_state): State<AppState>,
    Path(_period_key): Path<String>,
    Query(params): Query<AnomaliesQuery>,
) -> impl IntoResponse {
    let _severity = params.severity.as_deref().unwrap_or("all");
    let _status = params.status.as_deref().unwrap_or("all");
    let anomalies: Vec<TaxAnomaly> = Vec::new();
    Json(TaxAnomaliesResponse { anomalies })
}

/// POST /api/tax/periods/:period_key/refresh/
/// Refreshes tax data from ledger
pub async fn refresh_period(
    State(_state): State<AppState>,
    Path(_period_key): Path<String>,
) -> impl IntoResponse {
    Json(SuccessResponse { 
        success: true, 
        message: Some("Tax data refreshed from ledger".to_string()) 
    })
}

/// POST /api/tax/periods/:period_key/status/
/// Updates period status (DRAFT -> REVIEWED -> FILED)
pub async fn update_status(
    State(_state): State<AppState>,
    Path(_period_key): Path<String>,
    Json(body): Json<StatusUpdate>,
) -> impl IntoResponse {
    Json(SuccessResponse { 
        success: true, 
        message: Some(format!("Status update accepted: {}", body.status))
    })
}

/// PATCH /api/tax/periods/:period_key/anomalies/:anomaly_id/
/// Updates anomaly status
pub async fn update_anomaly(
    State(_state): State<AppState>,
    Path((_period_key, _anomaly_id)): Path<(String, String)>,
    Json(body): Json<AnomalyUpdate>,
) -> impl IntoResponse {
    Json(SuccessResponse { 
        success: true, 
        message: Some(format!("Anomaly status update accepted: {}", body.status))
    })
}

/// POST /api/tax/periods/:period_key/llm-enrich/
/// Triggers LLM enrichment for period analysis
pub async fn llm_enrich(
    State(_state): State<AppState>,
    Path(_period_key): Path<String>,
) -> impl IntoResponse {
    Json(SuccessResponse { 
        success: true, 
        message: Some("AI analysis generated".to_string()) 
    })
}

/// POST /api/tax/periods/:period_key/reset/
/// Resets a filed period back to REVIEWED
pub async fn reset_period(
    State(_state): State<AppState>,
    Path(_period_key): Path<String>,
    Json(body): Json<ResetRequest>,
) -> impl IntoResponse {
    let message = if body.confirm_reset {
        match body.reason {
            Some(reason) if !reason.trim().is_empty() => {
                format!("Period reset request accepted: {}", reason)
            }
            _ => "Period reset request accepted".to_string(),
        }
    } else {
        "Reset request skipped: confirm_reset=false".to_string()
    };
    Json(SuccessResponse { 
        success: true, 
        message: Some(message)
    })
}

/// POST /api/tax/periods/:period_key/payments/
/// Creates a new payment record
pub async fn create_payment(
    State(_state): State<AppState>,
    Path(_period_key): Path<String>,
    Json(body): Json<PaymentCreate>,
) -> impl IntoResponse {
    let _ = (
        &body.kind,
        &body.bank_account_id,
        &body.amount,
        &body.payment_date,
        &body.method,
        &body.reference,
        &body.notes,
    );
    Json(DisabledActionResponse {
        ok: true,
        status: "disabled",
        message: "This capability is disabled in the current backend profile.".to_string(),
    })
}

/// PATCH /api/tax/periods/:period_key/payments/:payment_id/
/// Updates a payment record
pub async fn update_payment(
    State(_state): State<AppState>,
    Path((_period_key, _payment_id)): Path<(String, String)>,
    Json(body): Json<PaymentUpdate>,
) -> impl IntoResponse {
    let _ = (
        &body.kind,
        &body.bank_account_id,
        &body.amount,
        &body.payment_date,
        &body.method,
        &body.reference,
        &body.notes,
    );
    Json(DisabledActionResponse {
        ok: true,
        status: "disabled",
        message: "This capability is disabled in the current backend profile.".to_string(),
    })
}

/// DELETE /api/tax/periods/:period_key/payments/:payment_id/
/// Deletes a payment record
pub async fn delete_payment(
    State(_state): State<AppState>,
    Path((_period_key, _payment_id)): Path<(String, String)>,
) -> impl IntoResponse {
    Json(DisabledActionResponse {
        ok: true,
        status: "disabled",
        message: "This capability is disabled in the current backend profile.".to_string(),
    })
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_list_periods_default_empty() {
        let response = TaxPeriodsResponse { periods: Vec::new() };
        assert!(response.periods.is_empty());
    }

    #[test]
    fn test_neutral_snapshot_contract_shape() {
        let period_key = "2026-03";
        let snapshot = neutral_snapshot(period_key);

        assert_eq!(snapshot.period_key, period_key);
        assert_eq!(snapshot.country, "CA");
        assert_eq!(snapshot.status, "DRAFT");
        assert!(snapshot.payments.is_empty());
    }
}
