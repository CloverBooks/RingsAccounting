//! AI Companion routes for Clover Books
//!
//! Native Rust endpoints for companion issues, high-risk audits, and radar data.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::AppState;

// ============================================================================
// Security Helper
// ============================================================================

/// Get business_id with security warning when using fallback.
/// DEPRECATED: Routes should migrate to JWT-based authentication.
fn get_business_id_with_warning(business_id: Option<i64>, endpoint: &str) -> i64 {
    match business_id {
        Some(id) => id,
        None => {
            tracing::warn!(
                "⚠️  SECURITY: {} using default business_id=1 without authentication.",
                endpoint
            );
            1
        }
    }
}

// ============================================================================
// Companion Issue Types
// ============================================================================

#[derive(Debug, Serialize)]
pub struct CompanionIssue {
    pub id: i64,
    pub surface: String,
    pub severity: String,
    pub status: String,
    pub title: String,
    pub description: String,
    pub recommended_action: String,
    pub estimated_impact: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct CompanionIssuesResponse {
    pub ok: bool,
    pub issues: Vec<CompanionIssue>,
    pub total: i64,
    pub by_severity: SeverityCounts,
    pub by_surface: SurfaceCounts,
}

#[derive(Debug, Serialize, Default)]
pub struct SeverityCounts {
    pub high: i64,
    pub medium: i64,
    pub low: i64,
}

#[derive(Debug, Serialize, Default)]
pub struct SurfaceCounts {
    pub receipts: i64,
    pub invoices: i64,
    pub books: i64,
    pub bank: i64,
    pub tax: i64,
}

#[derive(Debug, Deserialize)]
pub struct CompanionIssueQuery {
    pub business_id: Option<i64>,
    pub status: Option<String>,
    pub severity: Option<String>,
    pub surface: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    50
}

// ============================================================================
// High-Risk Audit Types
// ============================================================================

#[derive(Debug, Serialize)]
pub struct HighRiskAudit {
    pub id: i64,
    pub risk_level: String,
    pub status: String,
    pub reason: String,
    pub target_type: String,
    pub target_id: i64,
    pub created_at: String,
    pub reviewed_by: Option<String>,
    pub reviewed_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct HighRiskAuditsResponse {
    pub ok: bool,
    pub audits: Vec<HighRiskAudit>,
    pub pending_count: i64,
    pub approved_count: i64,
    pub rejected_count: i64,
}

// ============================================================================
// Companion Radar Types
// ============================================================================

#[derive(Debug, Serialize)]
pub struct CompanionRadar {
    pub health_score: f64,
    pub coverage: RadarCoverage,
    pub alerts: Vec<RadarAlert>,
}

#[derive(Debug, Serialize)]
pub struct RadarCoverage {
    pub receipts: f64,
    pub invoices: f64,
    pub books: f64,
    pub bank: f64,
    pub tax: f64,
}

#[derive(Debug, Serialize)]
pub struct RadarAlert {
    pub surface: String,
    pub message: String,
    pub priority: i32,
}

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /api/companion/issues
/// 
/// List companion issues for a business.
pub async fn list_issues(
    State(state): State<AppState>,
    Query(params): Query<CompanionIssueQuery>,
) -> impl IntoResponse {
    let business_id = get_business_id_with_warning(params.business_id, "list_issues");
    let status = params.status.as_deref().unwrap_or("open");
    let limit = params.limit;
    
    tracing::info!("Listing companion issues for business_id={}, status={}", business_id, status);
    
    // Get issues
    let issues = sqlx::query_as::<_, (i64, String, String, String, String, String, String, String, String)>(
        "SELECT id, surface, severity, status, title, description, 
                recommended_action, estimated_impact, created_at
         FROM core_companionissue 
         WHERE business_id = ? AND status = ?
         ORDER BY 
           CASE severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
           created_at DESC
         LIMIT ?"
    )
    .bind(business_id)
    .bind(status)
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();
    
    let total = issues.len() as i64;
    
    // Count by severity
    let mut by_severity = SeverityCounts::default();
    let mut by_surface = SurfaceCounts::default();
    
    let items: Vec<CompanionIssue> = issues
        .into_iter()
        .map(|(id, surface, severity, status, title, description, recommended_action, estimated_impact, created_at)| {
            // Count severity
            match severity.as_str() {
                "high" => by_severity.high += 1,
                "medium" => by_severity.medium += 1,
                _ => by_severity.low += 1,
            }
            // Count surface
            match surface.as_str() {
                "receipts" => by_surface.receipts += 1,
                "invoices" => by_surface.invoices += 1,
                "books" => by_surface.books += 1,
                "bank" => by_surface.bank += 1,
                "tax" => by_surface.tax += 1,
                _ => {}
            }
            
            CompanionIssue {
                id,
                surface,
                severity,
                status,
                title,
                description,
                recommended_action,
                estimated_impact,
                created_at,
            }
        })
        .collect();
    
    (
        StatusCode::OK,
        Json(CompanionIssuesResponse {
            ok: true,
            issues: items,
            total,
            by_severity,
            by_surface,
        }),
    )
}

/// POST /api/companion/issues/:id/dismiss
/// 
/// Dismiss a companion issue.
pub async fn dismiss_issue(
    State(state): State<AppState>,
    Path(issue_id): Path<i64>,
) -> impl IntoResponse {
    tracing::info!("Dismissing companion issue id={}", issue_id);
    
    let result = sqlx::query(
        "UPDATE core_companionissue SET status = 'dismissed', updated_at = datetime('now') WHERE id = ?"
    )
    .bind(issue_id)
    .execute(&state.db)
    .await;
    
    match result {
        Ok(r) if r.rows_affected() > 0 => {
            (StatusCode::OK, Json(serde_json::json!({
                "ok": true,
                "message": "Issue dismissed"
            })))
        }
        _ => {
            (StatusCode::NOT_FOUND, Json(serde_json::json!({
                "ok": false,
                "error": "Issue not found"
            })))
        }
    }
}

/// POST /api/companion/issues/:id/snooze
/// 
/// Snooze a companion issue.
pub async fn snooze_issue(
    State(state): State<AppState>,
    Path(issue_id): Path<i64>,
) -> impl IntoResponse {
    tracing::info!("Snoozing companion issue id={}", issue_id);
    
    let result = sqlx::query(
        "UPDATE core_companionissue SET status = 'snoozed', updated_at = datetime('now') WHERE id = ?"
    )
    .bind(issue_id)
    .execute(&state.db)
    .await;
    
    match result {
        Ok(r) if r.rows_affected() > 0 => {
            (StatusCode::OK, Json(serde_json::json!({
                "ok": true,
                "message": "Issue snoozed"
            })))
        }
        _ => {
            (StatusCode::NOT_FOUND, Json(serde_json::json!({
                "ok": false,
                "error": "Issue not found"
            })))
        }
    }
}

/// POST /api/companion/issues/:id/resolve
/// 
/// Mark a companion issue as resolved.
pub async fn resolve_issue(
    State(state): State<AppState>,
    Path(issue_id): Path<i64>,
) -> impl IntoResponse {
    tracing::info!("Resolving companion issue id={}", issue_id);
    
    let result = sqlx::query(
        "UPDATE core_companionissue SET status = 'resolved', updated_at = datetime('now') WHERE id = ?"
    )
    .bind(issue_id)
    .execute(&state.db)
    .await;
    
    match result {
        Ok(r) if r.rows_affected() > 0 => {
            (StatusCode::OK, Json(serde_json::json!({
                "ok": true,
                "message": "Issue resolved"
            })))
        }
        _ => {
            (StatusCode::NOT_FOUND, Json(serde_json::json!({
                "ok": false,
                "error": "Issue not found"
            })))
        }
    }
}

/// GET /api/companion/audits
/// 
/// List high-risk audits for a business.
pub async fn list_audits(
    State(state): State<AppState>,
    Query(params): Query<AuditQuery>,
) -> impl IntoResponse {
    let business_id = get_business_id_with_warning(params.business_id, "list_audits");
    
    tracing::info!("Listing high-risk audits for business_id={}", business_id);
    
    let audits = sqlx::query_as::<_, (i64, String, String, String, String, i64, String, Option<i64>, Option<String>)>(
        "SELECT a.id, a.risk_level, a.status, a.reason, 
                ct.model as target_type, a.object_id, a.created_at,
                a.reviewed_by_id, a.reviewed_at
         FROM core_highriskaudit a
         JOIN django_content_type ct ON a.content_type_id = ct.id
         WHERE a.business_id = ?
         ORDER BY 
           CASE a.status WHEN 'pending' THEN 1 ELSE 2 END,
           CASE a.risk_level WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
           a.created_at DESC
         LIMIT 50"
    )
    .bind(business_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();
    
    let mut pending_count = 0i64;
    let mut approved_count = 0i64;
    let mut rejected_count = 0i64;
    
    let items: Vec<HighRiskAudit> = audits
        .into_iter()
        .map(|(id, risk_level, status, reason, target_type, target_id, created_at, _reviewed_by_id, reviewed_at)| {
            match status.as_str() {
                "pending" => pending_count += 1,
                "approved" => approved_count += 1,
                "rejected" => rejected_count += 1,
                _ => {}
            }
            
            HighRiskAudit {
                id,
                risk_level,
                status,
                reason,
                target_type,
                target_id,
                created_at,
                reviewed_by: None, // Would need user lookup
                reviewed_at,
            }
        })
        .collect();
    
    (
        StatusCode::OK,
        Json(HighRiskAuditsResponse {
            ok: true,
            audits: items,
            pending_count,
            approved_count,
            rejected_count,
        }),
    )
}

#[derive(Debug, Deserialize)]
pub struct AuditQuery {
    pub business_id: Option<i64>,
    pub status: Option<String>,
}

/// POST /api/companion/audits/:id/approve
/// 
/// Approve a high-risk audit.
pub async fn approve_audit(
    State(state): State<AppState>,
    Path(audit_id): Path<i64>,
) -> impl IntoResponse {
    tracing::info!("Approving audit id={}", audit_id);
    
    let result = sqlx::query(
        "UPDATE core_highriskaudit 
         SET status = 'approved', reviewed_at = datetime('now'), updated_at = datetime('now') 
         WHERE id = ?"
    )
    .bind(audit_id)
    .execute(&state.db)
    .await;
    
    match result {
        Ok(r) if r.rows_affected() > 0 => {
            (StatusCode::OK, Json(serde_json::json!({
                "ok": true,
                "message": "Audit approved"
            })))
        }
        _ => {
            (StatusCode::NOT_FOUND, Json(serde_json::json!({
                "ok": false,
                "error": "Audit not found"
            })))
        }
    }
}

/// POST /api/companion/audits/:id/reject
/// 
/// Reject a high-risk audit.
pub async fn reject_audit(
    State(state): State<AppState>,
    Path(audit_id): Path<i64>,
) -> impl IntoResponse {
    tracing::info!("Rejecting audit id={}", audit_id);
    
    let result = sqlx::query(
        "UPDATE core_highriskaudit 
         SET status = 'rejected', reviewed_at = datetime('now'), updated_at = datetime('now') 
         WHERE id = ?"
    )
    .bind(audit_id)
    .execute(&state.db)
    .await;
    
    match result {
        Ok(r) if r.rows_affected() > 0 => {
            (StatusCode::OK, Json(serde_json::json!({
                "ok": true,
                "message": "Audit rejected"
            })))
        }
        _ => {
            (StatusCode::NOT_FOUND, Json(serde_json::json!({
                "ok": false,
                "error": "Audit not found"
            })))
        }
    }
}

/// GET /api/companion/radar
/// 
/// Get companion radar data (health score, coverage, alerts).
pub async fn radar(
    State(state): State<AppState>,
    Query(params): Query<RadarQuery>,
) -> impl IntoResponse {
    let business_id = get_business_id_with_warning(params.business_id, "radar");
    
    tracing::info!("Getting companion radar for business_id={}", business_id);
    
    // Count issues by surface area to determine coverage
    let surface_counts = sqlx::query_as::<_, (String, i64)>(
        "SELECT surface, COUNT(*) as count 
         FROM core_companionissue 
         WHERE business_id = ? AND status = 'open'
         GROUP BY surface"
    )
    .bind(business_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();
    
    let mut coverage = RadarCoverage {
        receipts: 100.0,
        invoices: 100.0,
        books: 100.0,
        bank: 100.0,
        tax: 100.0,
    };
    
    let mut alerts = Vec::new();
    let mut total_issues = 0i64;
    
    for (surface, count) in surface_counts {
        total_issues += count;
        // Reduce coverage based on issue count
        let reduction = (count as f64 * 10.0).min(50.0);
        match surface.as_str() {
            "receipts" => {
                coverage.receipts -= reduction;
                if count > 0 {
                    alerts.push(RadarAlert {
                        surface: "receipts".to_string(),
                        message: format!("{} receipt issues need attention", count),
                        priority: count as i32,
                    });
                }
            }
            "invoices" => {
                coverage.invoices -= reduction;
                if count > 0 {
                    alerts.push(RadarAlert {
                        surface: "invoices".to_string(),
                        message: format!("{} invoice issues need attention", count),
                        priority: count as i32,
                    });
                }
            }
            "books" => {
                coverage.books -= reduction;
                if count > 0 {
                    alerts.push(RadarAlert {
                        surface: "books".to_string(),
                        message: format!("{} book issues need attention", count),
                        priority: count as i32,
                    });
                }
            }
            "bank" => {
                coverage.bank -= reduction;
                if count > 0 {
                    alerts.push(RadarAlert {
                        surface: "bank".to_string(),
                        message: format!("{} bank reconciliation issues", count),
                        priority: count as i32,
                    });
                }
            }
            "tax" => {
                coverage.tax -= reduction;
                if count > 0 {
                    alerts.push(RadarAlert {
                        surface: "tax".to_string(),
                        message: format!("{} tax compliance issues", count),
                        priority: count as i32,
                    });
                }
            }
            _ => {}
        }
    }
    
    // Calculate health score (average coverage minus penalty for issues)
    let avg_coverage = (coverage.receipts + coverage.invoices + coverage.books + coverage.bank + coverage.tax) / 5.0;
    let health_score = (avg_coverage - (total_issues as f64 * 2.0)).max(0.0);
    
    // Sort alerts by priority (highest first)
    alerts.sort_by(|a, b| b.priority.cmp(&a.priority));
    
    (
        StatusCode::OK,
        Json(serde_json::json!({
            "ok": true,
            "radar": CompanionRadar {
                health_score,
                coverage,
                alerts,
            }
        })),
    )
}

#[derive(Debug, Deserialize)]
pub struct RadarQuery {
    pub business_id: Option<i64>,
}

// ============================================================================
// Companion v2 Shadow Events API (for Control Tower)
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct ShadowEventsQuery {
    pub status: Option<String>,
    pub limit: Option<i64>,
}

/// GET /api/companion/v2/shadow-events/
/// 
/// List shadow events (AI suggestions) for the Control Tower.
pub async fn list_shadow_events(
    State(state): State<AppState>,
    Query(params): Query<ShadowEventsQuery>,
) -> impl IntoResponse {
    let status = params.status.as_deref().unwrap_or("proposed");
    let limit = params.limit.unwrap_or(50);
    
    tracing::info!("Listing shadow events with status={}", status);
    
    // Try to get shadow events from database
    let events = sqlx::query_as::<_, (i64, String, String, String, String, String, String, String)>(
        "SELECT id, event_type, status, title, description, 
                source_surface, confidence, created_at
         FROM core_shadowevent 
         WHERE status = ?
         ORDER BY created_at DESC
         LIMIT ?"
    )
    .bind(status)
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();
    
    let event_list: Vec<serde_json::Value> = events
        .into_iter()
        .map(|(id, event_type, status, title, description, source_surface, confidence, created_at)| {
            serde_json::json!({
                "id": id,
                "event_type": event_type,
                "status": status,
                "title": title,
                "description": description,
                "source_surface": source_surface,
                "confidence": confidence,
                "created_at": created_at,
                "safe_mode_eligible": true
            })
        })
        .collect();
    
    let total = event_list.len();
    
    (StatusCode::OK, Json(serde_json::json!({
        "proposals": event_list,
        "total": total,
        "status": status
    })))
}

/// POST /api/companion/v2/shadow-events/:id/apply/
/// 
/// Apply (accept) a shadow event suggestion.
pub async fn apply_shadow_event(
    State(state): State<AppState>,
    Path(event_id): Path<i64>,
) -> impl IntoResponse {
    tracing::info!("Applying shadow event id={}", event_id);
    
    let result = sqlx::query(
        "UPDATE core_shadowevent SET status = 'applied', updated_at = datetime('now') WHERE id = ?"
    )
    .bind(event_id)
    .execute(&state.db)
    .await;
    
    match result {
        Ok(r) if r.rows_affected() > 0 => {
            (StatusCode::OK, Json(serde_json::json!({
                "ok": true,
                "message": "Suggestion applied successfully"
            })))
        }
        _ => {
            (StatusCode::NOT_FOUND, Json(serde_json::json!({
                "ok": false,
                "error": "Shadow event not found"
            })))
        }
    }
}

/// POST /api/companion/v2/shadow-events/:id/reject/
/// 
/// Reject a shadow event suggestion.
pub async fn reject_shadow_event(
    State(state): State<AppState>,
    Path(event_id): Path<i64>,
) -> impl IntoResponse {
    tracing::info!("Rejecting shadow event id={}", event_id);
    
    let result = sqlx::query(
        "UPDATE core_shadowevent SET status = 'rejected', updated_at = datetime('now') WHERE id = ?"
    )
    .bind(event_id)
    .execute(&state.db)
    .await;
    
    match result {
        Ok(r) if r.rows_affected() > 0 => {
            (StatusCode::OK, Json(serde_json::json!({
                "ok": true,
                "message": "Suggestion rejected"
            })))
        }
        _ => {
            (StatusCode::NOT_FOUND, Json(serde_json::json!({
                "ok": false,
                "error": "Shadow event not found"
            })))
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // =========================================================================
    // SeverityCounts Tests
    // =========================================================================

    #[test]
    fn test_severity_counts_default() {
        let counts = SeverityCounts::default();
        assert_eq!(counts.high, 0);
        assert_eq!(counts.medium, 0);
        assert_eq!(counts.low, 0);
    }

    #[test]
    fn test_severity_counts_serialization() {
        let counts = SeverityCounts {
            high: 5,
            medium: 10,
            low: 15,
        };
        
        let json = serde_json::to_string(&counts).unwrap();
        assert!(json.contains("\"high\":5"));
        assert!(json.contains("\"medium\":10"));
        assert!(json.contains("\"low\":15"));
    }

    // =========================================================================
    // SurfaceCounts Tests
    // =========================================================================

    #[test]
    fn test_surface_counts_default() {
        let counts = SurfaceCounts::default();
        assert_eq!(counts.receipts, 0);
        assert_eq!(counts.invoices, 0);
        assert_eq!(counts.books, 0);
        assert_eq!(counts.bank, 0);
        assert_eq!(counts.tax, 0);
    }

    #[test]
    fn test_surface_counts_serialization() {
        let counts = SurfaceCounts {
            receipts: 2,
            invoices: 4,
            books: 1,
            bank: 3,
            tax: 0,
        };
        
        let json = serde_json::to_string(&counts).unwrap();
        assert!(json.contains("\"receipts\":2"));
        assert!(json.contains("\"bank\":3"));
    }

    // =========================================================================
    // RadarCoverage Tests
    // =========================================================================

    #[test]
    fn test_radar_coverage_serialization() {
        let coverage = RadarCoverage {
            receipts: 95.5,
            invoices: 88.0,
            books: 100.0,
            bank: 75.5,
            tax: 90.0,
        };
        
        let json = serde_json::to_string(&coverage).unwrap();
        assert!(json.contains("\"receipts\":95.5"));
        assert!(json.contains("\"books\":100"));
    }

    #[test]
    fn test_radar_alert_serialization() {
        let alert = RadarAlert {
            surface: "invoices".to_string(),
            message: "3 overdue invoices".to_string(),
            priority: 3,
        };
        
        let json = serde_json::to_string(&alert).unwrap();
        assert!(json.contains("\"surface\":\"invoices\""));
        assert!(json.contains("\"priority\":3"));
    }

    // =========================================================================
    // CompanionIssue Tests
    // =========================================================================

    #[test]
    fn test_companion_issue_serialization() {
        let issue = CompanionIssue {
            id: 42,
            surface: "receipts".to_string(),
            severity: "high".to_string(),
            status: "open".to_string(),
            title: "Missing receipt".to_string(),
            description: "Receipt for transaction not found".to_string(),
            recommended_action: "Upload receipt".to_string(),
            estimated_impact: "$150.00".to_string(),
            created_at: "2024-01-15T10:00:00Z".to_string(),
        };
        
        let json = serde_json::to_string(&issue).unwrap();
        assert!(json.contains("\"id\":42"));
        assert!(json.contains("\"severity\":\"high\""));
        assert!(json.contains("\"surface\":\"receipts\""));
    }

    // =========================================================================
    // HighRiskAudit Tests
    // =========================================================================

    #[test]
    fn test_high_risk_audit_serialization() {
        let audit = HighRiskAudit {
            id: 100,
            risk_level: "critical".to_string(),
            status: "pending".to_string(),
            reason: "Large transaction detected".to_string(),
            target_type: "invoice".to_string(),
            target_id: 555,
            created_at: "2024-01-20T15:30:00Z".to_string(),
            reviewed_by: None,
            reviewed_at: None,
        };
        
        let json = serde_json::to_string(&audit).unwrap();
        assert!(json.contains("\"risk_level\":\"critical\""));
        assert!(json.contains("\"status\":\"pending\""));
        assert!(json.contains("\"target_id\":555"));
    }

    // =========================================================================
    // Query Deserialization Tests
    // =========================================================================

    #[test]
    fn test_companion_issue_query_defaults() {
        let json = r#"{}"#;
        let query: CompanionIssueQuery = serde_json::from_str(json).unwrap();
        
        assert!(query.business_id.is_none());
        assert!(query.status.is_none());
        assert!(query.severity.is_none());
        assert_eq!(query.limit, 50); // Default
    }

    #[test]
    fn test_companion_issue_query_with_params() {
        let json = r#"{"business_id": 123, "status": "open", "severity": "high", "limit": 10}"#;
        let query: CompanionIssueQuery = serde_json::from_str(json).unwrap();
        
        assert_eq!(query.business_id, Some(123));
        assert_eq!(query.status, Some("open".to_string()));
        assert_eq!(query.severity, Some("high".to_string()));
        assert_eq!(query.limit, 10);
    }

    #[test]
    fn test_radar_query_deserialization() {
        let json = r#"{"business_id": 456}"#;
        let query: RadarQuery = serde_json::from_str(json).unwrap();
        
        assert_eq!(query.business_id, Some(456));
    }

    #[test]
    fn test_audit_query_deserialization() {
        let json = r#"{"business_id": 789, "status": "pending"}"#;
        let query: AuditQuery = serde_json::from_str(json).unwrap();
        
        assert_eq!(query.business_id, Some(789));
        assert_eq!(query.status, Some("pending".to_string()));
    }

    // =========================================================================
    // Response Structure Tests
    // =========================================================================

    #[test]
    fn test_issues_response_structure() {
        let response = CompanionIssuesResponse {
            ok: true,
            issues: vec![],
            total: 0,
            by_severity: SeverityCounts::default(),
            by_surface: SurfaceCounts::default(),
        };
        
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"ok\":true"));
        assert!(json.contains("\"issues\":[]"));
        assert!(json.contains("\"total\":0"));
    }

    #[test]
    fn test_audits_response_structure() {
        let response = HighRiskAuditsResponse {
            ok: true,
            audits: vec![],
            pending_count: 5,
            approved_count: 10,
            rejected_count: 2,
        };
        
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"pending_count\":5"));
        assert!(json.contains("\"approved_count\":10"));
        assert!(json.contains("\"rejected_count\":2"));
    }
}

