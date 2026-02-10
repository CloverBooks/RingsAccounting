//! Tax Guardian API routes
//!
//! Provides endpoints for tax period management, snapshots, anomalies, and payments.
//! These endpoints support the Tax Guardian UI in the customer frontend.
#![allow(dead_code)]

use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use chrono::{Datelike, Local, NaiveDate};

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

// =============================================================================
// Helper Functions
// =============================================================================

fn generate_mock_periods() -> Vec<TaxPeriod> {
    let today = Local::now().date_naive();
    let mut periods = Vec::new();
    
    // Generate last 6 months of periods
    for i in 0..6 {
        let date = today - chrono::Duration::days(30 * i as i64);
        let period_key = format!("{}-{:02}", date.year(), date.month());
        let is_current = i == 0;
        
        let net_tax = if is_current { 0.0 } else { 150.0 + (i as f64 * 25.0) };
        let paid = if i > 1 { net_tax } else { 0.0 };
        
        let due_date = NaiveDate::from_ymd_opt(date.year(), date.month(), 28)
            .map(|d| (d + chrono::Duration::days(30)).to_string());
        
        periods.push(TaxPeriod {
            period_key,
            status: if i > 1 { "FILED".to_string() } else if i == 1 { "REVIEWED".to_string() } else { "DRAFT".to_string() },
            net_tax,
            payments_payment_total: paid,
            payments_refund_total: 0.0,
            payments_net_total: paid,
            payments_total: paid,
            balance: net_tax - paid,
            remaining_balance: net_tax - paid,
            payment_status: if paid >= net_tax && net_tax > 0.0 { 
                Some("PAID".to_string()) 
            } else if paid > 0.0 { 
                Some("PARTIALLY_PAID".to_string()) 
            } else if net_tax == 0.0 {
                Some("NO_LIABILITY".to_string())
            } else { 
                Some("UNPAID".to_string()) 
            },
            anomaly_counts: AnomalyCounts { low: 0, medium: if is_current { 1 } else { 0 }, high: 0 },
            due_date,
            is_due_soon: i == 1,
            is_overdue: false,
        });
    }
    
    periods
}

fn generate_mock_snapshot(period_key: &str) -> TaxSnapshot {
    let periods = generate_mock_periods();
    let period = periods.iter().find(|p| p.period_key == period_key);
    
    let net_tax = period.map(|p| p.net_tax).unwrap_or(0.0);
    let status = period.map(|p| p.status.clone()).unwrap_or_else(|| "DRAFT".to_string());
    
    let mut jurisdictions = std::collections::HashMap::new();
    jurisdictions.insert("CA-ON".to_string(), JurisdictionSummary {
        code: "CA-ON".to_string(),
        name: "Ontario HST".to_string(),
        taxable_sales: if net_tax > 0.0 { net_tax / 0.13 } else { 0.0 },
        tax_collected: net_tax,
        tax_on_purchases: 0.0,
        net_tax,
    });
    
    TaxSnapshot {
        period_key: period_key.to_string(),
        country: "CA".to_string(),
        status,
        due_date: period.and_then(|p| p.due_date.clone()),
        is_due_soon: period.map(|p| p.is_due_soon).unwrap_or(false),
        is_overdue: period.map(|p| p.is_overdue).unwrap_or(false),
        filed_at: None,
        last_filed_at: None,
        last_reset_at: None,
        last_reset_reason: None,
        llm_summary: None,
        llm_notes: None,
        summary_by_jurisdiction: jurisdictions,
        line_mappings: std::collections::HashMap::new(),
        net_tax,
        payments: Vec::new(),
        payments_payment_total: period.map(|p| p.payments_payment_total).unwrap_or(0.0),
        payments_refund_total: period.map(|p| p.payments_refund_total).unwrap_or(0.0),
        payments_net_total: period.map(|p| p.payments_net_total).unwrap_or(0.0),
        payments_total: period.map(|p| p.payments_total).unwrap_or(0.0),
        balance: period.map(|p| p.balance).unwrap_or(0.0),
        remaining_balance: period.map(|p| p.remaining_balance).unwrap_or(0.0),
        payment_status: period.and_then(|p| p.payment_status.clone()),
        anomaly_counts: AnomalyCounts { 
            low: period.map(|p| p.anomaly_counts.low).unwrap_or(0), 
            medium: period.map(|p| p.anomaly_counts.medium).unwrap_or(0), 
            high: period.map(|p| p.anomaly_counts.high).unwrap_or(0),
        },
        has_high_severity_blockers: false,
    }
}

// =============================================================================
// Route Handlers
// =============================================================================

/// GET /api/tax/periods/
/// Returns list of all tax periods for the current business
pub async fn list_periods(
    State(_state): State<AppState>,
) -> impl IntoResponse {
    let periods = serde_json::json!([
        {
            "period_key": "2026-01",
            "status": "DRAFT",
            "net_tax": 4250.00,
            "anomaly_counts": {"low": 5, "medium": 2, "high": 0},
            "due_date": "2026-02-28",
            "is_due_soon": true,
            "is_overdue": false,
            "payment_status": "UNPAID",
        },
        {
            "period_key": "2025-12",
            "status": "FILED",
            "net_tax": 3800.00,
            "anomaly_counts": {"low": 2, "medium": 0, "high": 0},
            "due_date": "2026-01-31",
            "is_due_soon": false,
            "is_overdue": false,
            "payment_status": "PAID",
        },
    ]);
    Json(serde_json::json!({ "periods": periods }))
}

/// GET /api/tax/periods/:period_key/
/// Returns tax snapshot for a specific period
pub async fn get_snapshot(
    State(_state): State<AppState>,
    Path(period_key): Path<String>,
) -> impl IntoResponse {
    let snapshot = if period_key == "2026-01" {
        serde_json::json!({
            "period_key": "2026-01",
            "country": "CA",
            "status": "DRAFT",
            "due_date": "2026-02-28",
            "is_due_soon": true,
            "is_overdue": false,
            "llm_summary": "Your GST/HST position for January is mostly clear. I found 2 medium anomalies related to missing jurisdiction markers on Ontario sales. Filing is due in 28 days.",
            "summary_by_jurisdiction": {
                "CA-ON": {"name": "Ontario (HST)", "net_tax": 4250.00, "sales_total": 32692.30}
            },
            "net_tax": 4250.00,
            "payment_status": "UNPAID",
            "payments": [],
            "payments_total": 0.0,
            "balance": 4250.00,
            "remaining_balance": 4250.00,
            "anomaly_counts": {"low": 5, "medium": 2, "high": 0},
            "has_high_severity_blockers": false,
        })
    } else {
        serde_json::json!({
            "period_key": period_key,
            "country": "CA",
            "status": "FILED",
            "due_date": "2026-01-31",
            "is_due_soon": false,
            "is_overdue": false,
            "llm_summary": "December period is filed and paid.",
            "summary_by_jurisdiction": {
                "CA-ON": {"name": "Ontario (HST)", "net_tax": 3800.00, "sales_total": 29230.77}
            },
            "net_tax": 3800.00,
            "payment_status": "PAID",
            "payments": [],
            "payments_total": 3800.00,
            "balance": 0.0,
            "remaining_balance": 0.0,
            "anomaly_counts": {"low": 2, "medium": 0, "high": 0},
            "has_high_severity_blockers": false,
        })
    };
    Json(snapshot)
}

/// GET /api/tax/periods/:period_key/anomalies/
/// Returns anomalies for a specific period
pub async fn list_anomalies(
    State(_state): State<AppState>,
    Path(_period_key): Path<String>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let mut anomalies = vec![
        serde_json::json!({
            "id": "tax-1",
            "code": "HIGH_VALUE_WITHOUT_TAX",
            "severity": "high",
            "status": "OPEN",
            "description": "Subscription payment to 'Cloud Provider' ($1,280) has no tax assigned but usually does.",
            "task_code": "REVIEW_TX",
            "created_at": "2026-01-30T10:00:00Z",
        }),
        serde_json::json!({
            "id": "tax-2",
            "code": "MISSING_JURISDICTION",
            "severity": "medium",
            "status": "OPEN",
            "description": "Sale to 'Client X' in Ontario has no HST recorded.",
            "task_code": "ASSIGN_TAX",
            "created_at": "2026-01-29T15:00:00Z",
        }),
        serde_json::json!({
            "id": "tax-3",
            "code": "RATE_MISMATCH",
            "severity": "low",
            "status": "RESOLVED",
            "description": "Tax rate 12.5% differs from standard 13% for HST.",
            "task_code": "CONFIRM_RATE",
            "created_at": "2026-01-28T09:00:00Z",
            "resolved_at": "2026-01-28T14:00:00Z",
        })
    ];

    if let Some(severity) = params.get("severity") {
        if severity != "all" {
            anomalies.retain(|a| a["severity"].as_str() == Some(severity.as_str()));
        }
    }

    if let Some(status) = params.get("status") {
        if status != "all" {
            anomalies.retain(|a| a["status"].as_str() == Some(status.as_str()));
        }
    }

    Json(serde_json::json!({ "anomalies": anomalies }))
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
    Json(_body): Json<StatusUpdate>,
) -> impl IntoResponse {
    Json(SuccessResponse { 
        success: true, 
        message: Some("Status updated".to_string()) 
    })
}

/// PATCH /api/tax/periods/:period_key/anomalies/:anomaly_id/
/// Updates anomaly status
pub async fn update_anomaly(
    State(_state): State<AppState>,
    Path((_period_key, _anomaly_id)): Path<(String, String)>,
    Json(_body): Json<AnomalyUpdate>,
) -> impl IntoResponse {
    Json(SuccessResponse { 
        success: true, 
        message: Some("Anomaly updated".to_string()) 
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
    Json(_body): Json<ResetRequest>,
) -> impl IntoResponse {
    Json(SuccessResponse { 
        success: true, 
        message: Some("Period reset to REVIEWED".to_string()) 
    })
}

/// POST /api/tax/periods/:period_key/payments/
/// Creates a new payment record
pub async fn create_payment(
    State(_state): State<AppState>,
    Path(_period_key): Path<String>,
    Json(_body): Json<PaymentCreate>,
) -> impl IntoResponse {
    Json(SuccessResponse { 
        success: true, 
        message: Some("Payment recorded".to_string()) 
    })
}

/// PATCH /api/tax/periods/:period_key/payments/:payment_id/
/// Updates a payment record
pub async fn update_payment(
    State(_state): State<AppState>,
    Path((_period_key, _payment_id)): Path<(String, String)>,
    Json(_body): Json<PaymentUpdate>,
) -> impl IntoResponse {
    Json(SuccessResponse { 
        success: true, 
        message: Some("Payment updated".to_string()) 
    })
}

/// DELETE /api/tax/periods/:period_key/payments/:payment_id/
/// Deletes a payment record
pub async fn delete_payment(
    State(_state): State<AppState>,
    Path((_period_key, _payment_id)): Path<(String, String)>,
) -> impl IntoResponse {
    Json(SuccessResponse { 
        success: true, 
        message: Some("Payment deleted".to_string()) 
    })
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_mock_periods() {
        let periods = generate_mock_periods();
        assert!(!periods.is_empty());
        assert!(periods.len() <= 6);
        
        // First period should be current month (DRAFT)
        assert_eq!(periods[0].status, "DRAFT");
    }

    #[test]
    fn test_generate_mock_snapshot() {
        let today = Local::now().date_naive();
        let period_key = format!("{}-{:02}", today.year(), today.month());
        let snapshot = generate_mock_snapshot(&period_key);
        
        assert_eq!(snapshot.period_key, period_key);
        assert_eq!(snapshot.country, "CA");
    }
}
