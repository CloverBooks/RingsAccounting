use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use chrono::{Duration, Utc};
use hmac::Hmac;
use pbkdf2::pbkdf2;
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::Sha256;
use sqlx::{FromRow, QueryBuilder, Row, Sqlite, SqlitePool};
use std::collections::{BTreeMap, HashMap};
use uuid::Uuid;

use crate::routes::auth::{extract_claims_from_header, Claims};
use crate::AppState;

const APPROVAL_DEFAULT_EXPIRY_HOURS: i64 = 24;
const BREAK_GLASS_TTL_MAX_MINUTES: i64 = 60;
const BREAK_GLASS_TTL_DEFAULT_MINUTES: i64 = 10;
const IMPERSONATION_TTL_MAX_MINUTES: i64 = 120;
const IMPERSONATION_TTL_DEFAULT_MINUTES: i64 = 30;
const EMPLOYEE_INVITE_EXPIRY_DAYS: i64 = 7;

const SUPPORTED_APPROVAL_ACTIONS: [&str; 9] = [
    "TAX_PERIOD_RESET",
    "LEDGER_ADJUST",
    "WORKSPACE_DELETE",
    "BULK_REFUND",
    "USER_BAN",
    "USER_REACTIVATE",
    "USER_PRIVILEGE_CHANGE",
    "PASSWORD_RESET_LINK",
    "FEATURE_FLAG_CRITICAL",
];

#[derive(Debug, Clone)]
struct AdminPrincipal {
    user_id: i64,
    email: String,
    role: String,
    level: i64,
    is_staff: bool,
    is_superuser: bool,
}

#[derive(Debug)]
struct RequestContext {
    request_id: String,
    ip_address: Option<String>,
    user_agent: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ApprovalListQuery {
    pub status: Option<String>,
    pub search: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ApprovalCreateBody {
    pub action_type: String,
    pub reason: String,
    pub workspace_id: Option<i64>,
    pub target_user_id: Option<i64>,
    pub payload: Option<Value>,
}

#[derive(Debug, Deserialize, Default)]
pub struct ApprovalDecisionBody {
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BreakGlassBody {
    pub reason: String,
    pub ttl_minutes: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct ImpersonationCreateBody {
    pub user_id: i64,
    pub reason: String,
    pub ttl_minutes: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
pub struct ImpersonationStopBody {
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AuditLogQuery {
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub action: Option<String>,
    pub actor_user_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct PaginatedQuery {
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub search: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UsersQuery {
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub search: Option<String>,
    pub status: Option<String>,
    pub has_google: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UserPatchBody {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub is_active: Option<bool>,
    pub is_staff: Option<bool>,
    pub is_superuser: Option<bool>,
    pub admin_role: Option<Option<String>>,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PasswordResetBody {
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct WorkspacePatchBody {
    pub name: Option<String>,
    pub plan: Option<Option<String>>,
    pub status: Option<String>,
    pub is_deleted: Option<bool>,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BankAccountsQuery {
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub search: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SupportTicketsQuery {
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub search: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SupportTicketCreateBody {
    pub subject: String,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub user_id: Option<i64>,
    pub workspace_id: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
pub struct SupportTicketPatchBody {
    pub status: Option<String>,
    pub priority: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SupportTicketNoteBody {
    pub body: String,
}

#[derive(Debug, Deserialize, Default)]
pub struct FeatureFlagPatchBody {
    pub is_enabled: Option<bool>,
    pub rollout_percent: Option<i64>,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct EmployeeWriteBody {
    pub user_id: Option<i64>,
    pub email: Option<String>,
    pub display_name: Option<String>,
    pub title: Option<String>,
    pub department: Option<String>,
    pub admin_panel_access: Option<bool>,
    pub primary_admin_role: Option<String>,
    pub is_active_employee: Option<bool>,
    pub manager_id: Option<i64>,
    pub workspace_scope: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct InviteEmployeeBody {
    pub email: String,
    pub full_name: Option<String>,
    pub role: String,
}

#[derive(Debug, Deserialize)]
pub struct OperationsOverviewQuery {
    pub env: Option<String>,
    pub window_hours: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct InviteRedeemBody {
    pub username: Option<String>,
    pub email: Option<String>,
    pub password: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
}

#[derive(Debug, FromRow)]
struct AuthUserRow {
    id: i64,
    email: String,
    is_active: i64,
    is_staff: i64,
    is_superuser: i64,
    role_value: Option<String>,
}

#[derive(Debug, FromRow)]
struct ApprovalRow {
    action_type: String,
    status: String,
    initiator_user_id: i64,
    target_user_id: Option<i64>,
    payload_json: String,
    expires_at: Option<String>,
}

#[derive(Debug, FromRow)]
struct ApprovalListRow {
    id: String,
    action_type: String,
    status: String,
    initiator_user_id: i64,
    approver_user_id: Option<i64>,
    workspace_id: Option<i64>,
    target_user_id: Option<i64>,
    reason: String,
    rejection_reason: Option<String>,
    payload_json: String,
    execution_error: Option<String>,
    created_at: String,
    resolved_at: Option<String>,
    expires_at: Option<String>,
    initiator_email: Option<String>,
    approver_email: Option<String>,
    target_email: Option<String>,
}

#[derive(Debug, FromRow)]
struct TargetUserRow {
    id: i64,
    email: String,
    is_active: i64,
    is_superuser: i64,
}

#[derive(Debug, FromRow)]
struct ImpersonationSessionRow {
    id: String,
    actor_user_id: i64,
    status: String,
}

#[derive(Debug, FromRow)]
struct AuditEventRow {
    id: i64,
    request_id: String,
    action: String,
    outcome: String,
    actor_user_id: Option<i64>,
    actor_email: Option<String>,
    actor_role: Option<String>,
    target_type: Option<String>,
    target_id: Option<String>,
    reason: Option<String>,
    ip_address: Option<String>,
    user_agent: Option<String>,
    details_json: String,
    created_at: String,
}

#[derive(Debug, FromRow)]
struct BasicUserRow {
    id: i64,
    email: String,
    username: Option<String>,
    first_name: Option<String>,
    last_name: Option<String>,
    date_joined: Option<String>,
    last_login: Option<String>,
    is_active: i64,
    is_staff: i64,
    is_superuser: i64,
    admin_role: Option<String>,
    has_usable_password: i64,
}

#[derive(Debug, FromRow)]
struct WorkspaceRow {
    id: i64,
    name: String,
    owner_email: Option<String>,
    plan: Option<String>,
    status: Option<String>,
    is_deleted: i64,
    created_at: Option<String>,
}

#[derive(Debug, FromRow)]
struct BankAccountAdminRow {
    id: i64,
    workspace_name: Option<String>,
    owner_email: Option<String>,
    bank_name: Option<String>,
    name: Option<String>,
    account_number_mask: Option<String>,
    usage_role: Option<String>,
    is_active: i64,
    last_imported_at: Option<String>,
}

#[derive(Debug, FromRow)]
struct SupportTicketRow {
    id: i64,
    subject: String,
    status: String,
    priority: String,
    source: String,
    created_at: String,
    updated_at: String,
    user_email: Option<String>,
    workspace_name: Option<String>,
}

#[derive(Debug, FromRow)]
struct SupportTicketNoteRow {
    id: i64,
    ticket_id: i64,
    admin_email: Option<String>,
    body: String,
    created_at: String,
}

#[derive(Debug, FromRow)]
struct FeatureFlagRow {
    id: i64,
    key: String,
    label: String,
    description: String,
    is_enabled: i64,
    rollout_percent: i64,
    is_critical: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, FromRow)]
struct EmployeeRow {
    id: i64,
    user_id: Option<i64>,
    name: String,
    email: String,
    title: Option<String>,
    department: Option<String>,
    admin_panel_access: i64,
    primary_admin_role: String,
    is_active_employee: i64,
    last_login: Option<String>,
    workspace_scope_json: String,
    manager_id: Option<i64>,
    manager_name: Option<String>,
    manager_email: Option<String>,
    created_at: String,
    updated_at: String,
    invite_id: Option<String>,
    invite_status: Option<String>,
    invite_token: Option<String>,
    invite_invited_at: Option<String>,
    invite_expires_at: Option<String>,
    invite_url: Option<String>,
    invite_email_send_failed: i64,
    invite_email_last_error: Option<String>,
}

pub async fn ensure_schema(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS admin_approval_requests (
            id TEXT PRIMARY KEY,
            action_type TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'FAILED')),
            initiator_user_id INTEGER NOT NULL,
            approver_user_id INTEGER NULL,
            workspace_id INTEGER NULL,
            target_user_id INTEGER NULL,
            reason TEXT NOT NULL,
            rejection_reason TEXT NULL,
            payload_json TEXT NOT NULL DEFAULT '{}',
            execution_error TEXT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            resolved_at TEXT NULL,
            expires_at TEXT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS admin_break_glass_grants (
            id TEXT PRIMARY KEY,
            approval_request_id TEXT NOT NULL,
            granted_by_user_id INTEGER NOT NULL,
            reason TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            revoked_at TEXT NULL,
            FOREIGN KEY (approval_request_id) REFERENCES admin_approval_requests(id)
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS admin_impersonation_sessions (
            id TEXT PRIMARY KEY,
            actor_user_id INTEGER NOT NULL,
            target_user_id INTEGER NOT NULL,
            reason TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'STOPPED', 'EXPIRED')) DEFAULT 'ACTIVE',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            expires_at TEXT NOT NULL,
            stopped_at TEXT NULL,
            stop_reason TEXT NULL,
            request_id TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS admin_audit_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id TEXT NOT NULL,
            action TEXT NOT NULL,
            outcome TEXT NOT NULL,
            actor_user_id INTEGER NULL,
            actor_email TEXT NULL,
            actor_role TEXT NULL,
            target_type TEXT NULL,
            target_id TEXT NULL,
            reason TEXT NULL,
            ip_address TEXT NULL,
            user_agent TEXT NULL,
            details_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_admin_approval_requests_status_created
         ON admin_approval_requests(status, created_at DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_admin_audit_events_created
         ON admin_audit_events(created_at DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_admin_impersonation_sessions_actor_status
         ON admin_impersonation_sessions(actor_user_id, status)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS admin_employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NULL,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            title TEXT NULL,
            department TEXT NULL,
            admin_panel_access INTEGER NOT NULL DEFAULT 0,
            primary_admin_role TEXT NOT NULL DEFAULT 'support',
            is_active_employee INTEGER NOT NULL DEFAULT 1,
            last_login TEXT NULL,
            workspace_scope_json TEXT NOT NULL DEFAULT '{}',
            manager_id INTEGER NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            deleted_at TEXT NULL,
            invite_id TEXT NULL,
            invite_status TEXT NULL,
            invite_token TEXT NULL,
            invite_invited_at TEXT NULL,
            invite_expires_at TEXT NULL,
            invite_url TEXT NULL,
            invite_email_send_failed INTEGER NOT NULL DEFAULT 0,
            invite_email_last_error TEXT NULL
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_admin_employees_email
         ON admin_employees(email)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_admin_employees_active
         ON admin_employees(is_active_employee, updated_at DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS admin_support_tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'OPEN',
            priority TEXT NOT NULL DEFAULT 'NORMAL',
            source TEXT NOT NULL DEFAULT 'IN_APP',
            user_email TEXT NULL,
            workspace_name TEXT NULL,
            created_by_user_id INTEGER NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS admin_support_ticket_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id INTEGER NOT NULL,
            admin_email TEXT NULL,
            body TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (ticket_id) REFERENCES admin_support_tickets(id) ON DELETE CASCADE
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_admin_support_tickets_status_priority
         ON admin_support_tickets(status, priority, updated_at DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS admin_feature_flags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL UNIQUE,
            label TEXT NOT NULL,
            description TEXT NOT NULL,
            is_enabled INTEGER NOT NULL DEFAULT 0,
            rollout_percent INTEGER NOT NULL DEFAULT 0,
            is_critical INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO admin_feature_flags (
            key, label, description, is_enabled, rollout_percent, is_critical, created_at, updated_at
         ) VALUES
         ('companion_autonomy', 'Companion Autonomy', 'Controls autonomy suggestions and queue actions.', 1, 100, 0, datetime('now'), datetime('now')),
         ('tax_guardian_llm', 'Tax Guardian AI', 'Controls AI-assisted tax enrichment and anomaly triage.', 1, 100, 1, datetime('now'), datetime('now')),
         ('admin_break_glass', 'Admin Break Glass', 'Controls break-glass reveal workflow for sensitive admin actions.', 1, 100, 1, datetime('now'), datetime('now'))",
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn contract(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let req = request_context(&headers);
    let principal = match require_admin_level(&state, &headers, 1, &req.request_id).await {
        Ok(p) => p,
        Err(response) => return response,
    };

    (
        StatusCode::OK,
        Json(json!({
            "ok": true,
            "contract_version": "2026-03-04",
            "owner": "rust-api",
            "admin_model": {
                "canonical_namespace": "/api/admin/*",
                "server_enforced_rbac": true,
                "maker_checker": true,
                "immutable_audit_events": true,
                "break_glass_ttl_max_minutes": BREAK_GLASS_TTL_MAX_MINUTES
            },
            "actor": {
                "id": principal.user_id,
                "email": principal.email,
                "role": principal.role,
                "level": principal.level
            },
            "endpoints": {
                "authz_me": "/api/admin/authz/me",
                "overview_metrics": "/api/admin/overview-metrics/",
                "operations_overview": "/api/admin/operations-overview/",
                "users": "/api/admin/users/",
                "user_patch": "/api/admin/users/:id/",
                "user_reset_password": "/api/admin/users/:id/reset-password/",
                "workspaces": "/api/admin/workspaces/",
                "workspace_patch": "/api/admin/workspaces/:id/",
                "workspace_overview": "/api/admin/workspaces/:id/overview/",
                "employees": "/api/admin/employees/",
                "employee_invite": "/api/admin/employees/invite/",
                "employee_mutations": "/api/admin/employees/:id/*",
                "bank_accounts": "/api/admin/bank-accounts/",
                "support_tickets": "/api/admin/support-tickets/",
                "feature_flags": "/api/admin/feature-flags/",
                "reconciliation_metrics": "/api/admin/reconciliation-metrics/",
                "ledger_health": "/api/admin/ledger-health/",
                "invoices_audit": "/api/admin/invoices-audit/",
                "expenses_audit": "/api/admin/expenses-audit/",
                "invite_redeem": "/api/admin/invite/:token/",
                "approvals": "/api/admin/approvals/",
                "approval_approve": "/api/admin/approvals/:id/approve/",
                "approval_reject": "/api/admin/approvals/:id/reject/",
                "approval_break_glass": "/api/admin/approvals/:id/break-glass/",
                "impersonations": "/api/admin/impersonations/",
                "impersonation_stop": "/api/admin/impersonations/:id/stop/",
                "audit_log": "/api/admin/audit-log/"
            }
        })),
    )
}

pub async fn authz_me(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let req = request_context(&headers);
    let principal = match require_admin_level(&state, &headers, 1, &req.request_id).await {
        Ok(p) => p,
        Err(response) => return response,
    };

    (
        StatusCode::OK,
        Json(json!({
            "ok": true,
            "user": {
                "id": principal.user_id,
                "email": principal.email,
                "role": principal.role,
                "level": principal.level,
                "is_staff": principal.is_staff,
                "is_superuser": principal.is_superuser,
                "capabilities": capabilities_for_level(principal.level)
            }
        })),
    )
}

pub async fn list_approvals(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<ApprovalListQuery>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    if let Err(response) = require_admin_level(&state, &headers, 1, &req.request_id).await {
        return response;
    }

    if let Err(error) = expire_stale_pending_approvals(&state.db).await {
        tracing::error!("Failed to expire stale admin approvals: {}", error);
        return api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to refresh approval queue",
            &req.request_id,
        );
    }

    let status_filter = match normalize_status_filter(params.status.as_deref()) {
        Ok(value) => value,
        Err(message) => return api_error(StatusCode::BAD_REQUEST, &message, &req.request_id),
    };
    let search_filter = params
        .search
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_lowercase());

    let rows = match sqlx::query_as::<_, ApprovalListRow>(
        "SELECT
            r.id,
            r.action_type,
            r.status,
            r.initiator_user_id,
            r.approver_user_id,
            r.workspace_id,
            r.target_user_id,
            r.reason,
            r.rejection_reason,
            r.payload_json,
            r.execution_error,
            r.created_at,
            r.resolved_at,
            r.expires_at,
            initiator.email as initiator_email,
            approver.email as approver_email,
            target.email as target_email
         FROM admin_approval_requests r
         LEFT JOIN auth_user initiator ON initiator.id = r.initiator_user_id
         LEFT JOIN auth_user approver ON approver.id = r.approver_user_id
         LEFT JOIN auth_user target ON target.id = r.target_user_id
         WHERE (?1 IS NULL OR r.status = ?1)
           AND (
             ?2 IS NULL
             OR lower(r.action_type) LIKE '%' || ?2 || '%'
             OR lower(COALESCE(initiator.email, '')) LIKE '%' || ?2 || '%'
             OR lower(COALESCE(target.email, '')) LIKE '%' || ?2 || '%'
             OR lower(r.reason) LIKE '%' || ?2 || '%'
           )
         ORDER BY datetime(r.created_at) DESC
         LIMIT 200",
    )
    .bind(status_filter.as_deref())
    .bind(search_filter.as_deref())
    .fetch_all(&state.db)
    .await
    {
        Ok(result) => result,
        Err(error) => {
            tracing::error!("Failed to list admin approvals: {}", error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to query approvals",
                &req.request_id,
            );
        }
    };

    let count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*)
         FROM admin_approval_requests r
         LEFT JOIN auth_user initiator ON initiator.id = r.initiator_user_id
         LEFT JOIN auth_user target ON target.id = r.target_user_id
         WHERE (?1 IS NULL OR r.status = ?1)
           AND (
             ?2 IS NULL
             OR lower(r.action_type) LIKE '%' || ?2 || '%'
             OR lower(COALESCE(initiator.email, '')) LIKE '%' || ?2 || '%'
             OR lower(COALESCE(target.email, '')) LIKE '%' || ?2 || '%'
             OR lower(r.reason) LIKE '%' || ?2 || '%'
           )",
    )
    .bind(status_filter.as_deref())
    .bind(search_filter.as_deref())
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let total_pending = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM admin_approval_requests WHERE status = 'PENDING'",
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let total_today = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM admin_approval_requests
         WHERE datetime(created_at) >= datetime('now', '-1 day')",
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let high_risk_pending = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM admin_approval_requests
         WHERE status = 'PENDING'
           AND action_type IN ('WORKSPACE_DELETE', 'BULK_REFUND', 'USER_BAN', 'USER_REACTIVATE', 'USER_PRIVILEGE_CHANGE', 'PASSWORD_RESET_LINK')",
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let avg_response_minutes_24h = sqlx::query_scalar::<_, Option<f64>>(
        "SELECT AVG((julianday(resolved_at) - julianday(created_at)) * 24 * 60)
         FROM admin_approval_requests
         WHERE resolved_at IS NOT NULL
           AND datetime(resolved_at) >= datetime('now', '-1 day')",
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(None)
    .map(|value| (value * 100.0).round() / 100.0);

    let results: Vec<Value> = rows
        .into_iter()
        .map(|row| {
            json!({
                "id": row.id,
                "action_type": row.action_type,
                "initiator": {
                    "id": row.initiator_user_id,
                    "email": row.initiator_email
                },
                "approver": row.approver_user_id.map(|id| json!({
                    "id": id,
                    "email": row.approver_email
                })),
                "workspace": row.workspace_id.map(|id| json!({
                    "id": id,
                    "name": Value::Null
                })),
                "target_user": row.target_user_id.map(|id| json!({
                    "id": id,
                    "email": row.target_email
                })),
                "reason": row.reason,
                "rejection_reason": row.rejection_reason,
                "payload": parse_payload_value(&row.payload_json),
                "status": row.status,
                "execution_error": row.execution_error,
                "created_at": row.created_at,
                "resolved_at": row.resolved_at,
                "expires_at": row.expires_at
            })
        })
        .collect();

    (
        StatusCode::OK,
        Json(json!({
            "results": results,
            "count": count,
            "summary": {
                "total_pending": total_pending,
                "total_today": total_today,
                "high_risk_pending": high_risk_pending,
                "avg_response_minutes_24h": avg_response_minutes_24h
            }
        })),
    )
}

pub async fn create_approval(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ApprovalCreateBody>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    let principal = match require_admin_level(&state, &headers, 2, &req.request_id).await {
        Ok(p) => p,
        Err(response) => return response,
    };

    let action_type = match normalize_action_type(&body.action_type) {
        Some(value) => value,
        None => {
            return api_error(
                StatusCode::BAD_REQUEST,
                "unsupported approval action_type",
                &req.request_id,
            )
        }
    };
    let reason = body.reason.trim();
    if reason.is_empty() {
        return api_error(StatusCode::BAD_REQUEST, "reason is required", &req.request_id);
    }

    let payload_json = match normalize_payload_json(body.payload) {
        Ok(value) => value,
        Err(message) => return api_error(StatusCode::BAD_REQUEST, &message, &req.request_id),
    };

    let approval_id = Uuid::new_v4().to_string();
    let created_at = now_sqlite();
    let expires_at = minutes_from_now(APPROVAL_DEFAULT_EXPIRY_HOURS * 60);

    let mut tx = match state.db.begin().await {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("Failed to open tx for create_approval: {}", error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to persist approval request",
                &req.request_id,
            );
        }
    };

    if let Err(error) = sqlx::query(
        "INSERT INTO admin_approval_requests (
            id, action_type, status, initiator_user_id, approver_user_id, workspace_id, target_user_id,
            reason, rejection_reason, payload_json, execution_error, created_at, resolved_at, expires_at, updated_at
         ) VALUES (?, ?, 'PENDING', ?, NULL, ?, ?, ?, NULL, ?, NULL, ?, NULL, ?, ?)",
    )
    .bind(&approval_id)
    .bind(&action_type)
    .bind(principal.user_id)
    .bind(body.workspace_id)
    .bind(body.target_user_id)
    .bind(reason)
    .bind(&payload_json)
    .bind(&created_at)
    .bind(&expires_at)
    .bind(&created_at)
    .execute(&mut *tx)
    .await
    {
        tracing::error!("Failed to insert admin approval request: {}", error);
        return api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to create approval request",
            &req.request_id,
        );
    }

    let details = json!({
        "action_type": action_type,
        "workspace_id": body.workspace_id,
        "target_user_id": body.target_user_id
    });

    if let Err(error) = insert_audit_event(
        &mut *tx,
        &req.request_id,
        "approval.request.create",
        "created",
        &principal,
        "approval_request",
        &approval_id,
        Some(reason),
        req.ip_address.as_deref(),
        req.user_agent.as_deref(),
        &details,
    )
    .await
    {
        tracing::error!("Failed to write admin audit event: {}", error);
        return api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to write immutable audit event",
            &req.request_id,
        );
    }

    if let Err(error) = tx.commit().await {
        tracing::error!("Failed to commit create_approval tx: {}", error);
        return api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to persist approval request",
            &req.request_id,
        );
    }

    (
        StatusCode::OK,
        Json(json!({
            "id": approval_id,
            "status": "PENDING",
            "created_at": created_at
        })),
    )
}

pub async fn approve_approval(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(approval_id): Path<String>,
    Json(_body): Json<ApprovalDecisionBody>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    let principal = match require_admin_level(&state, &headers, 2, &req.request_id).await {
        Ok(p) => p,
        Err(response) => return response,
    };

    let mut tx = match state.db.begin().await {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("Failed to open tx for approve_approval: {}", error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to process approval",
                &req.request_id,
            );
        }
    };

    let approval = match fetch_approval_row(&state.db, &approval_id).await {
        Ok(Some(value)) => value,
        Ok(None) => return api_error(StatusCode::NOT_FOUND, "approval request not found", &req.request_id),
        Err(error) => {
            tracing::error!("Failed to fetch approval request {}: {}", approval_id, error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load approval request",
                &req.request_id,
            );
        }
    };

    if approval.initiator_user_id == principal.user_id {
        let details = json!({
            "approval_id": approval_id,
            "reason": "self_approval_blocked"
        });
        let _ = insert_audit_event(
            &mut *tx,
            &req.request_id,
            "approval.request.approve",
            "denied_self_approval",
            &principal,
            "approval_request",
            &approval_id,
            None,
            req.ip_address.as_deref(),
            req.user_agent.as_deref(),
            &details,
        )
        .await;
        return api_error(
            StatusCode::FORBIDDEN,
            "maker-checker violation: self-approval is forbidden",
            &req.request_id,
        );
    }

    if approval.status != "PENDING" {
        return api_error(
            StatusCode::CONFLICT,
            "approval request is not pending",
            &req.request_id,
        );
    }

    if is_expired_timestamp(approval.expires_at.as_deref()) {
        if let Err(error) = sqlx::query(
            "UPDATE admin_approval_requests
             SET status = 'EXPIRED', resolved_at = datetime('now'), updated_at = datetime('now')
             WHERE id = ? AND status = 'PENDING'",
        )
        .bind(&approval_id)
        .execute(&mut *tx)
        .await
        {
            tracing::error!("Failed to mark approval {} as expired: {}", approval_id, error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to process approval expiry",
                &req.request_id,
            );
        }
        return api_error(StatusCode::CONFLICT, "approval request expired", &req.request_id);
    }

    let required_level = required_level_for_action(&approval.action_type);
    if principal.level < required_level {
        return api_error(
            StatusCode::FORBIDDEN,
            "insufficient role level for this approval action",
            &req.request_id,
        );
    }

    let mut payload = parse_payload_object(&approval.payload_json);
    if approval.action_type == "PASSWORD_RESET_LINK" {
        if !payload.contains_key("_redacted") {
            payload.insert("_redacted".to_string(), json!(["reset_url"]));
        }
    }
    let payload_json = Value::Object(payload).to_string();

    if let Err(error) = sqlx::query(
        "UPDATE admin_approval_requests
         SET status = 'APPROVED',
             approver_user_id = ?,
             payload_json = ?,
             resolved_at = datetime('now'),
             updated_at = datetime('now')
         WHERE id = ?",
    )
    .bind(principal.user_id)
    .bind(payload_json)
    .bind(&approval_id)
    .execute(&mut *tx)
    .await
    {
        tracing::error!("Failed to approve request {}: {}", approval_id, error);
        return api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to approve request",
            &req.request_id,
        );
    }

    let details = json!({
        "action_type": approval.action_type,
        "required_level": required_level
    });
    if let Err(error) = insert_audit_event(
        &mut *tx,
        &req.request_id,
        "approval.request.approve",
        "approved",
        &principal,
        "approval_request",
        &approval_id,
        None,
        req.ip_address.as_deref(),
        req.user_agent.as_deref(),
        &details,
    )
    .await
    {
        tracing::error!("Failed to write audit on approve {}: {}", approval_id, error);
        return api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to write immutable audit event",
            &req.request_id,
        );
    }

    if let Err(error) = tx.commit().await {
        tracing::error!("Failed to commit approve_approval tx: {}", error);
        return api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to finalize approval",
            &req.request_id,
        );
    }

    (
        StatusCode::OK,
        Json(json!({
            "id": approval_id,
            "status": "APPROVED",
            "resolved_at": now_sqlite(),
            "execution_error": Value::Null
        })),
    )
}

pub async fn reject_approval(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(approval_id): Path<String>,
    Json(body): Json<ApprovalDecisionBody>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    let principal = match require_admin_level(&state, &headers, 2, &req.request_id).await {
        Ok(p) => p,
        Err(response) => return response,
    };

    let mut tx = match state.db.begin().await {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("Failed to open tx for reject_approval: {}", error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to process rejection",
                &req.request_id,
            );
        }
    };

    let approval = match fetch_approval_row(&state.db, &approval_id).await {
        Ok(Some(value)) => value,
        Ok(None) => return api_error(StatusCode::NOT_FOUND, "approval request not found", &req.request_id),
        Err(error) => {
            tracing::error!("Failed to load approval {} for reject: {}", approval_id, error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load approval request",
                &req.request_id,
            );
        }
    };

    if approval.initiator_user_id == principal.user_id {
        return api_error(
            StatusCode::FORBIDDEN,
            "maker-checker violation: self-rejection is forbidden",
            &req.request_id,
        );
    }

    if approval.status != "PENDING" {
        return api_error(
            StatusCode::CONFLICT,
            "approval request is not pending",
            &req.request_id,
        );
    }

    if is_expired_timestamp(approval.expires_at.as_deref()) {
        if let Err(error) = sqlx::query(
            "UPDATE admin_approval_requests
             SET status = 'EXPIRED', resolved_at = datetime('now'), updated_at = datetime('now')
             WHERE id = ? AND status = 'PENDING'",
        )
        .bind(&approval_id)
        .execute(&mut *tx)
        .await
        {
            tracing::error!("Failed to mark approval {} as expired on reject: {}", approval_id, error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to process approval expiry",
                &req.request_id,
            );
        }
        return api_error(StatusCode::CONFLICT, "approval request expired", &req.request_id);
    }

    let required_level = required_level_for_action(&approval.action_type);
    if principal.level < required_level {
        return api_error(
            StatusCode::FORBIDDEN,
            "insufficient role level for this approval action",
            &req.request_id,
        );
    }

    let rejection_reason = body
        .reason
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);

    if let Err(error) = sqlx::query(
        "UPDATE admin_approval_requests
         SET status = 'REJECTED',
             approver_user_id = ?,
             rejection_reason = ?,
             resolved_at = datetime('now'),
             updated_at = datetime('now')
         WHERE id = ?",
    )
    .bind(principal.user_id)
    .bind(rejection_reason.as_deref())
    .bind(&approval_id)
    .execute(&mut *tx)
    .await
    {
        tracing::error!("Failed to reject request {}: {}", approval_id, error);
        return api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to reject request",
            &req.request_id,
        );
    }

    let details = json!({
        "action_type": approval.action_type,
        "required_level": required_level
    });
    if let Err(error) = insert_audit_event(
        &mut *tx,
        &req.request_id,
        "approval.request.reject",
        "rejected",
        &principal,
        "approval_request",
        &approval_id,
        rejection_reason.as_deref(),
        req.ip_address.as_deref(),
        req.user_agent.as_deref(),
        &details,
    )
    .await
    {
        tracing::error!("Failed to write audit on reject {}: {}", approval_id, error);
        return api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to write immutable audit event",
            &req.request_id,
        );
    }

    if let Err(error) = tx.commit().await {
        tracing::error!("Failed to commit reject_approval tx: {}", error);
        return api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to finalize rejection",
            &req.request_id,
        );
    }

    (
        StatusCode::OK,
        Json(json!({
            "id": approval_id,
            "status": "REJECTED",
            "resolved_at": now_sqlite()
        })),
    )
}

pub async fn break_glass_approval(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(approval_id): Path<String>,
    Json(body): Json<BreakGlassBody>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    let principal = match require_admin_level(&state, &headers, 2, &req.request_id).await {
        Ok(p) => p,
        Err(response) => return response,
    };

    let reason = body.reason.trim();
    if reason.is_empty() {
        return api_error(
            StatusCode::BAD_REQUEST,
            "break-glass reason is required",
            &req.request_id,
        );
    }

    let ttl_minutes = body
        .ttl_minutes
        .unwrap_or(BREAK_GLASS_TTL_DEFAULT_MINUTES);
    if ttl_minutes <= 0 || ttl_minutes > BREAK_GLASS_TTL_MAX_MINUTES {
        return api_error(
            StatusCode::BAD_REQUEST,
            "ttl_minutes must be between 1 and 60",
            &req.request_id,
        );
    }

    let mut tx = match state.db.begin().await {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("Failed to open tx for break_glass_approval: {}", error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to process break-glass request",
                &req.request_id,
            );
        }
    };

    let approval = match fetch_approval_row(&state.db, &approval_id).await {
        Ok(Some(value)) => value,
        Ok(None) => return api_error(StatusCode::NOT_FOUND, "approval request not found", &req.request_id),
        Err(error) => {
            tracing::error!("Failed to load approval {} for break-glass: {}", approval_id, error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load approval request",
                &req.request_id,
            );
        }
    };

    if approval.status != "APPROVED" {
        return api_error(
            StatusCode::CONFLICT,
            "break-glass is only available for approved requests",
            &req.request_id,
        );
    }

    let grant_id = Uuid::new_v4().to_string();
    let expires_at = minutes_from_now(ttl_minutes);
    if let Err(error) = sqlx::query(
        "INSERT INTO admin_break_glass_grants (
            id, approval_request_id, granted_by_user_id, reason, expires_at, active, created_at, revoked_at
         ) VALUES (?, ?, ?, ?, ?, 1, datetime('now'), NULL)",
    )
    .bind(&grant_id)
    .bind(&approval_id)
    .bind(principal.user_id)
    .bind(reason)
    .bind(&expires_at)
    .execute(&mut *tx)
    .await
    {
        tracing::error!("Failed to insert break-glass grant {}: {}", grant_id, error);
        return api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to persist break-glass grant",
            &req.request_id,
        );
    }

    if approval.action_type == "PASSWORD_RESET_LINK" {
        let mut payload = parse_payload_object(&approval.payload_json);
        let target_id = approval.target_user_id.unwrap_or(0);
        let reset_url = build_password_reset_url(target_id);
        payload.insert("reset_url".to_string(), json!(reset_url));
        payload.insert("break_glass_expires_at".to_string(), json!(expires_at.clone()));
        payload.insert("break_glass_grant_id".to_string(), json!(grant_id.clone()));
        remove_from_redacted(&mut payload, "reset_url");

        if let Err(error) = sqlx::query(
            "UPDATE admin_approval_requests
             SET payload_json = ?, updated_at = datetime('now')
             WHERE id = ?",
        )
        .bind(Value::Object(payload).to_string())
        .bind(&approval_id)
        .execute(&mut *tx)
        .await
        {
            tracing::error!("Failed to reveal reset URL for {}: {}", approval_id, error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to reveal redacted fields",
                &req.request_id,
            );
        }
    }

    let details = json!({
        "grant_id": grant_id,
        "ttl_minutes": ttl_minutes,
        "action_type": approval.action_type
    });
    if let Err(error) = insert_audit_event(
        &mut *tx,
        &req.request_id,
        "approval.request.break_glass",
        "granted",
        &principal,
        "approval_request",
        &approval_id,
        Some(reason),
        req.ip_address.as_deref(),
        req.user_agent.as_deref(),
        &details,
    )
    .await
    {
        tracing::error!("Failed to write audit on break-glass {}: {}", approval_id, error);
        return api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to write immutable audit event",
            &req.request_id,
        );
    }

    if let Err(error) = tx.commit().await {
        tracing::error!("Failed to commit break_glass_approval tx: {}", error);
        return api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to finalize break-glass request",
            &req.request_id,
        );
    }

    (
        StatusCode::OK,
        Json(json!({
            "success": true,
            "expires_at": expires_at
        })),
    )
}

pub async fn start_impersonation(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ImpersonationCreateBody>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    let principal = match require_admin_level(&state, &headers, 2, &req.request_id).await {
        Ok(p) => p,
        Err(response) => return response,
    };

    let reason = body.reason.trim();
    if reason.is_empty() {
        return api_error(StatusCode::BAD_REQUEST, "reason is required", &req.request_id);
    }
    if body.user_id == principal.user_id {
        return api_error(
            StatusCode::BAD_REQUEST,
            "cannot impersonate the same actor account",
            &req.request_id,
        );
    }

    let ttl_minutes = body
        .ttl_minutes
        .unwrap_or(IMPERSONATION_TTL_DEFAULT_MINUTES);
    if ttl_minutes <= 0 || ttl_minutes > IMPERSONATION_TTL_MAX_MINUTES {
        return api_error(
            StatusCode::BAD_REQUEST,
            "ttl_minutes must be between 1 and 120",
            &req.request_id,
        );
    }

    let mut tx = match state.db.begin().await {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("Failed to open tx for start_impersonation: {}", error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to start impersonation",
                &req.request_id,
            );
        }
    };

    let target = match sqlx::query_as::<_, TargetUserRow>(
        "SELECT id, email, is_active, is_superuser
         FROM auth_user
         WHERE id = ?",
    )
    .bind(body.user_id)
    .fetch_optional(&mut *tx)
    .await
    {
        Ok(Some(value)) => value,
        Ok(None) => return api_error(StatusCode::NOT_FOUND, "target user not found", &req.request_id),
        Err(error) => {
            tracing::error!("Failed to query impersonation target {}: {}", body.user_id, error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to validate target user",
                &req.request_id,
            );
        }
    };

    if target.is_active <= 0 {
        return api_error(
            StatusCode::CONFLICT,
            "target user is inactive",
            &req.request_id,
        );
    }
    if target.is_superuser > 0 && principal.level < 4 {
        return api_error(
            StatusCode::FORBIDDEN,
            "superadmin level required to impersonate this target",
            &req.request_id,
        );
    }

    let session_id = Uuid::new_v4().to_string();
    let expires_at = minutes_from_now(ttl_minutes);
    if let Err(error) = sqlx::query(
        "INSERT INTO admin_impersonation_sessions (
            id, actor_user_id, target_user_id, reason, status,
            created_at, expires_at, stopped_at, stop_reason, request_id
         ) VALUES (?, ?, ?, ?, 'ACTIVE', datetime('now'), ?, NULL, NULL, ?)",
    )
    .bind(&session_id)
    .bind(principal.user_id)
    .bind(body.user_id)
    .bind(reason)
    .bind(&expires_at)
    .bind(&req.request_id)
    .execute(&mut *tx)
    .await
    {
        tracing::error!("Failed to insert impersonation session {}: {}", session_id, error);
        return api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to create impersonation session",
            &req.request_id,
        );
    }

    let details = json!({
        "session_id": session_id,
        "target_user_id": target.id,
        "target_email": target.email,
        "ttl_minutes": ttl_minutes
    });
    if let Err(error) = insert_audit_event(
        &mut *tx,
        &req.request_id,
        "impersonation.start",
        "started",
        &principal,
        "user",
        &target.id.to_string(),
        Some(reason),
        req.ip_address.as_deref(),
        req.user_agent.as_deref(),
        &details,
    )
    .await
    {
        tracing::error!("Failed to write audit on impersonation.start: {}", error);
        return api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to write immutable audit event",
            &req.request_id,
        );
    }

    if let Err(error) = tx.commit().await {
        tracing::error!("Failed to commit start_impersonation tx: {}", error);
        return api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to finalize impersonation session",
            &req.request_id,
        );
    }

    let redirect_url = format!("/?impersonation_session={}", session_id);
    (
        StatusCode::OK,
        Json(json!({
            "redirect_url": redirect_url
        })),
    )
}

pub async fn stop_impersonation(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(session_id): Path<String>,
    Json(body): Json<ImpersonationStopBody>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    let principal = match require_admin_level(&state, &headers, 2, &req.request_id).await {
        Ok(p) => p,
        Err(response) => return response,
    };

    let mut tx = match state.db.begin().await {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("Failed to open tx for stop_impersonation: {}", error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to stop impersonation",
                &req.request_id,
            );
        }
    };

    let session = match sqlx::query_as::<_, ImpersonationSessionRow>(
        "SELECT id, actor_user_id, status
         FROM admin_impersonation_sessions
         WHERE id = ?",
    )
    .bind(&session_id)
    .fetch_optional(&mut *tx)
    .await
    {
        Ok(Some(value)) => value,
        Ok(None) => return api_error(StatusCode::NOT_FOUND, "impersonation session not found", &req.request_id),
        Err(error) => {
            tracing::error!("Failed to load impersonation session {}: {}", session_id, error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load impersonation session",
                &req.request_id,
            );
        }
    };

    if session.actor_user_id != principal.user_id && principal.level < 4 {
        return api_error(
            StatusCode::FORBIDDEN,
            "only the owner or superadmin may stop this impersonation session",
            &req.request_id,
        );
    }

    if session.status != "ACTIVE" {
        return (
            StatusCode::OK,
            Json(json!({
                "ok": true,
                "id": session.id,
                "status": session.status
            })),
        );
    }

    let stop_reason = body
        .reason
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);

    if let Err(error) = sqlx::query(
        "UPDATE admin_impersonation_sessions
         SET status = 'STOPPED',
             stopped_at = datetime('now'),
             stop_reason = ?,
             request_id = ?
         WHERE id = ?",
    )
    .bind(stop_reason.as_deref())
    .bind(&req.request_id)
    .bind(&session_id)
    .execute(&mut *tx)
    .await
    {
        tracing::error!("Failed to stop impersonation session {}: {}", session_id, error);
        return api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to stop impersonation session",
            &req.request_id,
        );
    }

    let details = json!({ "session_id": session_id });
    if let Err(error) = insert_audit_event(
        &mut *tx,
        &req.request_id,
        "impersonation.stop",
        "stopped",
        &principal,
        "impersonation_session",
        &session.id,
        stop_reason.as_deref(),
        req.ip_address.as_deref(),
        req.user_agent.as_deref(),
        &details,
    )
    .await
    {
        tracing::error!("Failed to write audit on impersonation.stop: {}", error);
        return api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to write immutable audit event",
            &req.request_id,
        );
    }

    if let Err(error) = tx.commit().await {
        tracing::error!("Failed to commit stop_impersonation tx: {}", error);
        return api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to finalize impersonation stop",
            &req.request_id,
        );
    }

    (
        StatusCode::OK,
        Json(json!({
            "ok": true,
            "id": session.id,
            "status": "STOPPED",
            "stopped_at": now_sqlite()
        })),
    )
}

pub async fn list_audit_events(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<AuditLogQuery>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    if let Err(response) = require_admin_level(&state, &headers, 1, &req.request_id).await {
        return response;
    }

    let page = params.page.unwrap_or(1).max(1);
    let page_size = params.page_size.unwrap_or(50).clamp(1, 200);
    let offset = (page - 1) * page_size;
    let action_filter = params
        .action
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);

    let total = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*)
         FROM admin_audit_events
         WHERE (?1 IS NULL OR action = ?1)
           AND (?2 IS NULL OR actor_user_id = ?2)",
    )
    .bind(action_filter.as_deref())
    .bind(params.actor_user_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let rows = match sqlx::query_as::<_, AuditEventRow>(
        "SELECT
            id,
            request_id,
            action,
            outcome,
            actor_user_id,
            actor_email,
            actor_role,
            target_type,
            target_id,
            reason,
            ip_address,
            user_agent,
            details_json,
            created_at
         FROM admin_audit_events
         WHERE (?1 IS NULL OR action = ?1)
           AND (?2 IS NULL OR actor_user_id = ?2)
         ORDER BY id DESC
         LIMIT ?3 OFFSET ?4",
    )
    .bind(action_filter.as_deref())
    .bind(params.actor_user_id)
    .bind(page_size)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("Failed to query admin_audit_events: {}", error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to query audit events",
                &req.request_id,
            );
        }
    };

    let results: Vec<Value> = rows
        .into_iter()
        .map(|row| {
            let level = if row.outcome.starts_with("denied") || row.outcome.contains("failed") {
                "WARNING"
            } else {
                "INFO"
            };
            let category = row.action.split('.').next().unwrap_or("admin");
            json!({
                "id": row.id,
                "timestamp": row.created_at,
                "admin_email": row.actor_email,
                "actor_role": row.actor_role,
                "action": row.action,
                "object_type": row.target_type.unwrap_or_else(|| "unknown".to_string()),
                "object_id": row.target_id.unwrap_or_else(|| "".to_string()),
                "extra": parse_payload_value(&row.details_json),
                "remote_ip": row.ip_address,
                "user_agent": row.user_agent,
                "request_id": row.request_id,
                "level": level,
                "category": category,
                "actor_user_id": row.actor_user_id,
                "reason": row.reason
            })
        })
        .collect();

    let has_next = page * page_size < total;
    let next = if has_next {
        Some(pagination_link(page + 1, page_size, action_filter.as_deref(), params.actor_user_id))
    } else {
        None
    };
    let previous = if page > 1 {
        Some(pagination_link(page - 1, page_size, action_filter.as_deref(), params.actor_user_id))
    } else {
        None
    };

    (
        StatusCode::OK,
        Json(json!({
            "results": results,
            "next": next,
            "previous": previous,
            "count": total
        })),
    )
}

pub async fn overview_metrics(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let req = request_context(&headers);
    if let Err(response) = require_admin_level(&state, &headers, 1, &req.request_id).await {
        return response;
    }

    let active_users_30d = count_active_users_window(&state.db, 30, 0).await;
    let previous_active_users = count_active_users_window(&state.db, 60, 30).await;
    let active_users_30d_change_pct = if previous_active_users > 0 {
        (((active_users_30d as f64 - previous_active_users as f64) / previous_active_users as f64)
            * 100.0
            * 100.0)
            .round()
            / 100.0
    } else {
        0.0
    };

    let unreconciled_transactions = count_unreconciled_transactions(&state.db, None).await;
    let unreconciled_transactions_older_60d =
        count_unreconciled_transactions(&state.db, Some(60)).await;
    let unbalanced_journal_entries = count_unbalanced_journal_entries(&state.db).await;
    let failed_invoice_emails_24h = count_failed_invoice_emails(&state.db).await;
    let ai_flagged_open_issues = count_open_ai_flags(&state.db).await;
    let (api_error_rate_1h_pct, api_p95_response_ms_1h) = api_health_stats(&state.db).await;

    let workspaces_health = fetch_workspace_health(&state.db, 20).await;

    (
        StatusCode::OK,
        Json(json!({
            "active_users_30d": active_users_30d,
            "active_users_30d_change_pct": active_users_30d_change_pct,
            "unreconciled_transactions": unreconciled_transactions,
            "unreconciled_transactions_older_60d": unreconciled_transactions_older_60d,
            "unbalanced_journal_entries": unbalanced_journal_entries,
            "api_error_rate_1h_pct": api_error_rate_1h_pct,
            "api_p95_response_ms_1h": api_p95_response_ms_1h,
            "ai_flagged_open_issues": ai_flagged_open_issues,
            "failed_invoice_emails_24h": failed_invoice_emails_24h,
            "workspaces_health": workspaces_health
        })),
    )
}

pub async fn operations_overview(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<OperationsOverviewQuery>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    if let Err(response) = require_admin_level(&state, &headers, 1, &req.request_id).await {
        return response;
    }

    let env = params
        .env
        .as_deref()
        .map(str::trim)
        .filter(|value| *value == "staging" || *value == "prod")
        .unwrap_or("prod");
    let window_hours = params.window_hours.unwrap_or(24).clamp(1, 168);

    let open_tickets = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM admin_support_tickets WHERE status IN ('OPEN', 'IN_PROGRESS')",
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);
    let pending_approvals = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM admin_approval_requests WHERE status = 'PENDING'",
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);
    let failing_bank_feeds = count_failing_bank_feeds(&state.db).await;
    let reconciliation_backlog = count_unreconciled_transactions(&state.db, Some(30)).await;
    let tax_issues = count_open_tax_issues(&state.db).await;

    let queues = vec![
        json!({
            "id": "support",
            "name": "Support tickets",
            "count": open_tickets,
            "slaLabel": "Respond within 4h",
            "status": queue_status(open_tickets, 20, 50)
        }),
        json!({
            "id": "approvals",
            "name": "Approval queue",
            "count": pending_approvals,
            "slaLabel": "Resolve within 24h",
            "status": queue_status(pending_approvals, 10, 30)
        }),
        json!({
            "id": "reconciliation",
            "name": "Reconciliation backlog",
            "count": reconciliation_backlog,
            "slaLabel": "Clear >30d daily",
            "status": queue_status(reconciliation_backlog, 25, 75)
        }),
    ];

    let buckets = vec![
        json!({
            "label": "Needs attention",
            "tasks": build_ops_tasks(&state.db, "high", window_hours).await
        }),
        json!({
            "label": "In progress",
            "tasks": build_ops_tasks(&state.db, "medium", window_hours).await
        }),
        json!({
            "label": "Watchlist",
            "tasks": build_ops_tasks(&state.db, "low", window_hours).await
        }),
    ];

    let systems = vec![
        json!({
            "id": "api",
            "name": "Admin API",
            "status": if api_error_rate_1h_pct(&state.db).await > 3.0 { "degraded" } else { "healthy" },
            "latencyLabel": format!("p95 {} ms", api_p95_response_ms_1h(&state.db).await),
            "errorRateLabel": format!("{:.2}%", api_error_rate_1h_pct(&state.db).await)
        }),
        json!({
            "id": "companion",
            "name": "Companion autonomy",
            "status": if count_open_ai_flags(&state.db).await > 20 { "degraded" } else { "healthy" },
            "latencyLabel": "queue materialized",
            "errorRateLabel": "policy-driven"
        }),
        json!({
            "id": "tax",
            "name": "Tax Guardian",
            "status": if tax_issues > 0 { "degraded" } else { "healthy" },
            "latencyLabel": "snapshot-based",
            "errorRateLabel": format!("{} open issues", tax_issues)
        }),
    ];

    let activity = fetch_recent_admin_activity(&state.db, window_hours, 20).await;

    (
        StatusCode::OK,
        Json(json!({
            "env": env,
            "windowHours": window_hours,
            "metrics": {
                "openTickets": open_tickets,
                "pendingApprovals": pending_approvals,
                "failingBankFeeds": failing_bank_feeds,
                "reconciliationBacklog": reconciliation_backlog,
                "taxIssues": tax_issues
            },
            "queues": queues,
            "buckets": buckets,
            "systems": systems,
            "activity": activity
        })),
    )
}

pub async fn reconciliation_metrics(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let req = request_context(&headers);
    if let Err(response) = require_admin_level(&state, &headers, 1, &req.request_id).await {
        return response;
    }

    let total_unreconciled = count_unreconciled_transactions(&state.db, None).await;
    let aging = unreconciled_aging_buckets(&state.db).await;
    let top_workspaces = top_unreconciled_workspaces(&state.db, 10).await;
    let recent_sessions = recent_reconciliation_sessions(&state.db, 10).await;

    (
        StatusCode::OK,
        Json(json!({
            "total_unreconciled": total_unreconciled,
            "aging": aging,
            "top_workspaces": top_workspaces,
            "recent_sessions": recent_sessions
        })),
    )
}

pub async fn ledger_health(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let req = request_context(&headers);
    if let Err(response) = require_admin_level(&state, &headers, 1, &req.request_id).await {
        return response;
    }

    let unbalanced_entries = fetch_unbalanced_entries(&state.db, 50).await;
    let orphan_accounts = fetch_orphan_accounts(&state.db, 50).await;
    let suspense_balances = fetch_suspense_balances(&state.db, 50).await;

    (
        StatusCode::OK,
        Json(json!({
            "summary": {
                "unbalanced_entries": unbalanced_entries.len(),
                "orphan_accounts": orphan_accounts.len(),
                "suspense_with_balance": suspense_balances.len()
            },
            "unbalanced_entries": unbalanced_entries,
            "orphan_accounts": orphan_accounts,
            "suspense_balances": suspense_balances
        })),
    )
}

pub async fn invoices_audit(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let req = request_context(&headers);
    if let Err(response) = require_admin_level(&state, &headers, 1, &req.request_id).await {
        return response;
    }

    let status_distribution = invoice_status_distribution(&state.db).await;
    let total = status_distribution.values().sum::<i64>();
    let draft = *status_distribution.get("DRAFT").unwrap_or(&0);
    let sent = *status_distribution.get("SENT").unwrap_or(&0)
        + *status_distribution.get("PARTIAL").unwrap_or(&0);
    let paid = *status_distribution.get("PAID").unwrap_or(&0);
    let issues = status_distribution
        .iter()
        .filter(|(status, _)| {
            !matches!(
                status.as_str(),
                "DRAFT" | "SENT" | "PARTIAL" | "PAID"
            )
        })
        .map(|(_, count)| *count)
        .sum::<i64>();
    let recent_issues = invoice_recent_issues(&state.db, 25).await;

    (
        StatusCode::OK,
        Json(json!({
            "summary": {
                "total": total,
                "draft": draft,
                "sent": sent,
                "paid": paid,
                "issues": issues
            },
            "status_distribution": status_distribution,
            "recent_issues": recent_issues
        })),
    )
}

pub async fn expenses_audit(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let req = request_context(&headers);
    if let Err(response) = require_admin_level(&state, &headers, 1, &req.request_id).await {
        return response;
    }

    let total_expenses = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM core_expense")
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);
    let uncategorized = if column_exists(&state.db, "core_expense", "category_id").await {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM core_expense WHERE category_id IS NULL",
        )
        .fetch_one(&state.db)
        .await
        .unwrap_or(0)
    } else {
        0
    };
    let total_receipts = if table_exists(&state.db, "agentic_receipt_run_item").await {
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM agentic_receipt_run_item")
            .fetch_one(&state.db)
            .await
            .unwrap_or(0)
    } else {
        0
    };
    let pending_receipts = if table_exists(&state.db, "agentic_receipt_run_item").await {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM agentic_receipt_run_item WHERE upper(COALESCE(status, '')) IN ('PENDING', 'REVIEW')",
        )
        .fetch_one(&state.db)
        .await
        .unwrap_or(0)
    } else {
        0
    };

    let expense_distribution = expense_status_distribution(&state.db).await;
    let receipt_distribution = receipt_status_distribution(&state.db).await;
    let top_workspaces = top_expense_workspaces(&state.db, 10).await;

    (
        StatusCode::OK,
        Json(json!({
            "summary": {
                "total_expenses": total_expenses,
                "total_receipts": total_receipts,
                "uncategorized": uncategorized,
                "pending_receipts": pending_receipts
            },
            "expense_distribution": expense_distribution,
            "receipt_distribution": receipt_distribution,
            "top_workspaces": top_workspaces
        })),
    )
}

pub async fn list_users(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<UsersQuery>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    if let Err(response) = require_admin_level(&state, &headers, 1, &req.request_id).await {
        return response;
    }

    if !table_exists(&state.db, "auth_user").await {
        return (
            StatusCode::OK,
            Json(json!({
                "results": [],
                "next": Value::Null,
                "previous": Value::Null,
                "count": 0
            })),
        );
    }

    let page = params.page.unwrap_or(1).max(1);
    let page_size = params.page_size.unwrap_or(20).clamp(1, 200);
    let search = params
        .search
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_lowercase());
    let status = params
        .status
        .as_deref()
        .map(str::trim)
        .map(|value| value.to_ascii_lowercase());

    let rows = match fetch_basic_users(&state.db, search.as_deref(), status.as_deref()).await {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("Failed to list users: {}", error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to query users",
                &req.request_id,
            );
        }
    };

    let user_ids: Vec<i64> = rows.iter().map(|row| row.id).collect();
    let workspace_counts = workspace_count_map(&state.db, &user_ids).await;
    let social_providers = social_provider_map(&state.db, &user_ids).await;
    let has_google_filter = parse_boolish(params.has_google.as_deref());

    let mut user_payloads = Vec::with_capacity(rows.len());
    for row in rows {
        let mut providers = social_providers
            .get(&row.id)
            .cloned()
            .unwrap_or_default();
        if row.has_usable_password > 0 && !providers.iter().any(|p| p == "password") {
            providers.push("password".to_string());
        }
        providers.sort();
        providers.dedup();

        let has_google = providers.iter().any(|provider| provider.eq_ignore_ascii_case("google"));
        if let Some(expected) = has_google_filter {
            if has_google != expected {
                continue;
            }
        }

        user_payloads.push(json!({
            "id": row.id,
            "email": row.email,
            "username": row.username,
            "first_name": row.first_name,
            "last_name": row.last_name,
            "full_name": match (&row.first_name, &row.last_name) {
                (Some(first), Some(last)) if !first.is_empty() || !last.is_empty() => format!("{} {}", first, last).trim().to_string(),
                (Some(first), _) if !first.is_empty() => first.clone(),
                (_, Some(last)) if !last.is_empty() => last.clone(),
                _ => row.email.clone()
            },
            "date_joined": row.date_joined,
            "is_active": row.is_active > 0,
            "admin_role": row.admin_role,
            "last_login": row.last_login,
            "is_staff": row.is_staff > 0,
            "is_superuser": row.is_superuser > 0,
            "workspace_count": workspace_counts.get(&row.id).copied().unwrap_or(0),
            "has_usable_password": row.has_usable_password > 0,
            "auth_providers": providers,
            "has_google_login": has_google,
            "social_account_count": providers.iter().filter(|provider| provider.as_str() != "password").count()
        }));
    }

    let count = user_payloads.len() as i64;
    let (results, next, previous) = paginate_values(user_payloads, page, page_size, &[]);

    (
        StatusCode::OK,
        Json(json!({
            "results": results,
            "next": next,
            "previous": previous,
            "count": count
        })),
    )
}

pub async fn patch_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(user_id): Path<i64>,
    Json(body): Json<UserPatchBody>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    let principal = match require_admin_level(&state, &headers, 2, &req.request_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };

    let existing = match load_basic_user_by_id(&state.db, user_id).await {
        Ok(Some(value)) => value,
        Ok(None) => return api_error(StatusCode::NOT_FOUND, "user not found", &req.request_id),
        Err(error) => {
            tracing::error!("Failed to load user {}: {}", user_id, error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load user",
                &req.request_id,
            );
        }
    };

    let reason = body
        .reason
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let requested_is_active = body.is_active;
    let requested_is_staff = body.is_staff;
    let requested_is_superuser = body.is_superuser;
    let requested_admin_role = body.admin_role.clone().flatten();

    let status_changed = requested_is_active
        .map(|value| value != (existing.is_active > 0))
        .unwrap_or(false);
    let privilege_changed =
        requested_is_staff
            .map(|value| value != (existing.is_staff > 0))
            .unwrap_or(false)
            || requested_is_superuser
                .map(|value| value != (existing.is_superuser > 0))
                .unwrap_or(false)
            || requested_admin_role
                .as_ref()
                .map(|value| normalize_role_value(Some(value.as_str())) != normalize_role_value(existing.admin_role.as_deref()))
                .unwrap_or(false);

    if privilege_changed && principal.level < 4 {
        return api_error(
            StatusCode::FORBIDDEN,
            "Privilege changes require superadmin level",
            &req.request_id,
        );
    }

    if (status_changed || privilege_changed) && reason.is_none() {
        return api_error(
            StatusCode::BAD_REQUEST,
            "reason is required for privileged user changes",
            &req.request_id,
        );
    }

    if status_changed || privilege_changed {
        let action_type = if privilege_changed {
            "USER_PRIVILEGE_CHANGE"
        } else if requested_is_active == Some(false) {
            "USER_BAN"
        } else {
            "USER_REACTIVATE"
        };
        let approval_payload = json!({
            "user_id": user_id,
            "is_active": requested_is_active,
            "is_staff": requested_is_staff,
            "is_superuser": requested_is_superuser,
            "admin_role": requested_admin_role
        });
        let approval = match create_admin_approval_request(
            &state.db,
            &principal,
            action_type,
            reason.as_deref().unwrap_or("privileged user change"),
            None,
            Some(user_id),
            &approval_payload,
            &req,
        )
        .await
        {
            Ok(value) => value,
            Err(error) => {
                tracing::error!("Failed to create approval for user patch: {}", error);
                return api_error(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to create approval request",
                    &req.request_id,
                );
            }
        };

        let user_payload = build_user_payload(&state.db, &existing).await;
        return (
            StatusCode::OK,
            Json(json!({
                "approval_required": true,
                "approval_request_id": approval,
                "approval_status": "PENDING",
                "user": user_payload
            })),
        );
    }

    let mut set_clauses: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(first_name) = body.first_name.as_deref() {
        if column_exists(&state.db, "auth_user", "first_name").await {
            set_clauses.push("first_name = ?".to_string());
            bind_values.push(first_name.trim().to_string());
        }
    }
    if let Some(last_name) = body.last_name.as_deref() {
        if column_exists(&state.db, "auth_user", "last_name").await {
            set_clauses.push("last_name = ?".to_string());
            bind_values.push(last_name.trim().to_string());
        }
    }
    if let Some(email) = body.email.as_deref() {
        if email.trim().is_empty() {
            return api_error(StatusCode::BAD_REQUEST, "email cannot be empty", &req.request_id);
        }
        set_clauses.push("email = ?".to_string());
        bind_values.push(email.trim().to_string());
    }

    if let Some(is_active) = requested_is_active {
        set_clauses.push("is_active = ?".to_string());
        bind_values.push(if is_active { "1" } else { "0" }.to_string());
    }

    if set_clauses.is_empty() {
        return (
            StatusCode::OK,
            Json(build_user_payload(&state.db, &existing).await),
        );
    }

    let mut query = format!("UPDATE auth_user SET {}", set_clauses.join(", "));
    query.push_str(" WHERE id = ?");
    let mut stmt = sqlx::query(&query);
    for value in &bind_values {
        stmt = stmt.bind(value);
    }
    stmt = stmt.bind(user_id);
    if let Err(error) = stmt.execute(&state.db).await {
        tracing::error!("Failed to patch user {}: {}", user_id, error);
        return api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to update user",
            &req.request_id,
        );
    }

    let details = json!({
        "user_id": user_id,
        "fields": set_clauses
    });
    if let Err(error) = insert_audit_event(
        &state.db,
        &req.request_id,
        "user.update",
        "updated",
        &principal,
        "user",
        &user_id.to_string(),
        reason.as_deref(),
        req.ip_address.as_deref(),
        req.user_agent.as_deref(),
        &details,
    )
    .await
    {
        tracing::error!("Failed to write user.update audit event: {}", error);
    }

    match load_basic_user_by_id(&state.db, user_id).await {
        Ok(Some(updated)) => (StatusCode::OK, Json(build_user_payload(&state.db, &updated).await)),
        _ => api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to load updated user",
            &req.request_id,
        ),
    }
}

pub async fn reset_user_password(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(user_id): Path<i64>,
    Json(body): Json<PasswordResetBody>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    let principal = match require_admin_level(&state, &headers, 2, &req.request_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };

    let reason = body.reason.trim();
    if reason.is_empty() {
        return api_error(StatusCode::BAD_REQUEST, "reason is required", &req.request_id);
    }
    match load_basic_user_by_id(&state.db, user_id).await {
        Ok(Some(_)) => {}
        Ok(None) => return api_error(StatusCode::NOT_FOUND, "user not found", &req.request_id),
        Err(error) => {
            tracing::error!("Failed to load target user {}: {}", user_id, error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load user",
                &req.request_id,
            );
        }
    }

    let approval = match create_admin_approval_request(
        &state.db,
        &principal,
        "PASSWORD_RESET_LINK",
        reason,
        None,
        Some(user_id),
        &json!({ "target_user_id": user_id }),
        &req,
    )
    .await
    {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("Failed to create password reset approval: {}", error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to create approval request",
                &req.request_id,
            );
        }
    };

    (
        StatusCode::OK,
        Json(json!({
            "approval_required": true,
            "approval_request_id": approval,
            "approval_status": "PENDING"
        })),
    )
}

pub async fn list_workspaces(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<PaginatedQuery>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    if let Err(response) = require_admin_level(&state, &headers, 1, &req.request_id).await {
        return response;
    }

    let page = params.page.unwrap_or(1).max(1);
    let page_size = params.page_size.unwrap_or(20).clamp(1, 200);
    let search = params
        .search
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_lowercase());

    let rows = match fetch_workspaces_rows(&state.db, search.as_deref()).await {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("Failed to list workspaces: {}", error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to query workspaces",
                &req.request_id,
            );
        }
    };

    let workspace_ids: Vec<i64> = rows.iter().map(|row| row.id).collect();
    let unreconciled_map = unreconciled_counts_for_workspaces(&state.db, &workspace_ids).await;
    let ledger_map = ledger_status_for_workspaces(&state.db, &workspace_ids).await;

    let payloads: Vec<Value> = rows
        .into_iter()
        .map(|row| {
            json!({
                "id": row.id,
                "name": row.name,
                "owner_email": row.owner_email,
                "plan": row.plan,
                "status": normalize_workspace_status(row.status.as_deref(), row.is_deleted > 0),
                "is_deleted": row.is_deleted > 0,
                "created_at": row.created_at,
                "bank_setup_completed": Value::Null,
                "unreconciled_count": unreconciled_map.get(&row.id).copied().unwrap_or(0),
                "ledger_status": ledger_map.get(&row.id).cloned().unwrap_or_else(|| "balanced".to_string())
            })
        })
        .collect();

    let count = payloads.len() as i64;
    let extra = search
        .as_deref()
        .map(|value| vec![("search", value.to_string())])
        .unwrap_or_default();
    let (results, next, previous) = paginate_values(payloads, page, page_size, &extra);

    (
        StatusCode::OK,
        Json(json!({
            "results": results,
            "next": next,
            "previous": previous,
            "count": count
        })),
    )
}

pub async fn patch_workspace(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(workspace_id): Path<i64>,
    Json(body): Json<WorkspacePatchBody>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    let principal = match require_admin_level(&state, &headers, 2, &req.request_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };

    let current = match load_workspace_row(&state.db, workspace_id).await {
        Ok(Some(value)) => value,
        Ok(None) => return api_error(StatusCode::NOT_FOUND, "workspace not found", &req.request_id),
        Err(error) => {
            tracing::error!("Failed to load workspace {}: {}", workspace_id, error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load workspace",
                &req.request_id,
            );
        }
    };

    let reason = body
        .reason
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let wants_delete = body.is_deleted.unwrap_or(false) && current.is_deleted <= 0;
    if wants_delete {
        if principal.level < 4 {
            return api_error(
                StatusCode::FORBIDDEN,
                "workspace delete approval requires superadmin level",
                &req.request_id,
            );
        }
        if reason.is_none() {
            return api_error(
                StatusCode::BAD_REQUEST,
                "reason is required for workspace delete approval",
                &req.request_id,
            );
        }
        let approval = match create_admin_approval_request(
            &state.db,
            &principal,
            "WORKSPACE_DELETE",
            reason.as_deref().unwrap_or("workspace delete"),
            Some(workspace_id),
            None,
            &json!({
                "workspace_id": workspace_id,
                "name": body.name,
                "plan": body.plan,
                "status": body.status,
                "is_deleted": true
            }),
            &req,
        )
        .await
        {
            Ok(value) => value,
            Err(error) => {
                tracing::error!("Failed to create workspace delete approval: {}", error);
                return api_error(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to create approval request",
                    &req.request_id,
                );
            }
        };
        return (
            StatusCode::OK,
            Json(json!({
                "approval_required": true,
                "approval_request_id": approval,
                "approval_status": "PENDING",
                "workspace": workspace_payload(&state.db, &current).await
            })),
        );
    }

    let updated = match update_workspace_record(&state.db, workspace_id, &body).await {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("Failed to update workspace {}: {}", workspace_id, error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update workspace",
                &req.request_id,
            );
        }
    };

    let details = json!({
        "workspace_id": workspace_id,
        "name": body.name,
        "plan": body.plan,
        "status": body.status
    });
    if let Err(error) = insert_audit_event(
        &state.db,
        &req.request_id,
        "workspace.update",
        "updated",
        &principal,
        "workspace",
        &workspace_id.to_string(),
        reason.as_deref(),
        req.ip_address.as_deref(),
        req.user_agent.as_deref(),
        &details,
    )
    .await
    {
        tracing::error!("Failed to write workspace.update audit event: {}", error);
    }

    (StatusCode::OK, Json(workspace_payload(&state.db, &updated).await))
}

pub async fn workspace_overview(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(workspace_id): Path<i64>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    if let Err(response) = require_admin_level(&state, &headers, 1, &req.request_id).await {
        return response;
    }

    let payload = match build_workspace_360_payload(&state.db, workspace_id).await {
        Ok(Some(value)) => value,
        Ok(None) => return api_error(StatusCode::NOT_FOUND, "workspace not found", &req.request_id),
        Err(error) => {
            tracing::error!(
                "Failed to build workspace 360 payload for {}: {}",
                workspace_id,
                error
            );
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load workspace overview",
                &req.request_id,
            );
        }
    };

    (StatusCode::OK, Json(payload))
}

pub async fn list_bank_accounts_admin(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<BankAccountsQuery>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    if let Err(response) = require_admin_level(&state, &headers, 1, &req.request_id).await {
        return response;
    }

    let page = params.page.unwrap_or(1).max(1);
    let page_size = params.page_size.unwrap_or(50).clamp(1, 200);
    let search = params
        .search
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_lowercase());

    let rows = match fetch_admin_bank_accounts(&state.db, search.as_deref()).await {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("Failed to list admin bank accounts: {}", error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to query bank accounts",
                &req.request_id,
            );
        }
    };

    let account_ids: Vec<i64> = rows.iter().map(|row| row.id).collect();
    let unreconciled_map = unreconciled_counts_for_accounts(&state.db, &account_ids).await;

    let mut payloads: Vec<Value> = rows
        .into_iter()
        .map(|row| {
            let status = if row.is_active <= 0 {
                "disconnected"
            } else {
                "ok"
            };
            json!({
                "id": row.id,
                "workspace_name": row.workspace_name.unwrap_or_else(|| "Unknown workspace".to_string()),
                "owner_email": row.owner_email,
                "bank_name": row.bank_name.unwrap_or_else(|| "Unknown bank".to_string()),
                "name": row.name.unwrap_or_else(|| format!("Account #{}", row.id)),
                "account_number_mask": row.account_number_mask.unwrap_or_default(),
                "usage_role": row.usage_role.unwrap_or_else(|| "OPERATING".to_string()),
                "is_active": row.is_active > 0,
                "last_imported_at": row.last_imported_at,
                "status": status,
                "unreconciled_count": unreconciled_map.get(&row.id).copied().unwrap_or(0)
            })
        })
        .collect();

    if let Some(filter) = params.status.as_deref().map(|value| value.to_ascii_lowercase()) {
        payloads.retain(|row| {
            row.get("status")
                .and_then(Value::as_str)
                .map(|value| value.eq_ignore_ascii_case(&filter))
                .unwrap_or(false)
        });
    }

    let count = payloads.len() as i64;
    let mut extra: Vec<(&str, String)> = Vec::new();
    if let Some(search) = search {
        extra.push(("search", search));
    }
    if let Some(status) = params.status.as_deref().map(str::to_string) {
        extra.push(("status", status));
    }
    let (results, next, previous) = paginate_values(payloads, page, page_size, &extra);

    (
        StatusCode::OK,
        Json(json!({
            "results": results,
            "next": next,
            "previous": previous,
            "count": count
        })),
    )
}

pub async fn list_support_tickets(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<SupportTicketsQuery>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    if let Err(response) = require_admin_level(&state, &headers, 1, &req.request_id).await {
        return response;
    }

    let page = params.page.unwrap_or(1).max(1);
    let page_size = params.page_size.unwrap_or(25).clamp(1, 200);
    let search = params
        .search
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_lowercase());
    let status = params
        .status
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_uppercase());
    let priority = params
        .priority
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_uppercase());

    let rows = match fetch_support_ticket_rows(
        &state.db,
        search.as_deref(),
        status.as_deref(),
        priority.as_deref(),
    )
    .await
    {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("Failed to list support tickets: {}", error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to query support tickets",
                &req.request_id,
            );
        }
    };

    let ticket_ids: Vec<i64> = rows.iter().map(|row| row.id).collect();
    let notes_map = fetch_ticket_notes_map(&state.db, &ticket_ids).await;
    let payloads: Vec<Value> = rows
        .into_iter()
        .map(|row| {
            let notes = notes_map.get(&row.id).cloned().unwrap_or_default();
            json!({
                "id": row.id,
                "subject": row.subject,
                "status": row.status,
                "priority": row.priority,
                "source": row.source,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
                "user_email": row.user_email,
                "workspace_name": row.workspace_name,
                "notes": notes
            })
        })
        .collect();

    let count = payloads.len() as i64;
    let mut extra: Vec<(&str, String)> = Vec::new();
    if let Some(value) = status {
        extra.push(("status", value));
    }
    if let Some(value) = priority {
        extra.push(("priority", value));
    }
    if let Some(value) = search {
        extra.push(("search", value));
    }
    let (results, next, previous) = paginate_values(payloads, page, page_size, &extra);

    (
        StatusCode::OK,
        Json(json!({
            "results": results,
            "next": next,
            "previous": previous,
            "count": count
        })),
    )
}

pub async fn create_support_ticket(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<SupportTicketCreateBody>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    let principal = match require_admin_level(&state, &headers, 1, &req.request_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    let subject = body.subject.trim();
    if subject.is_empty() {
        return api_error(StatusCode::BAD_REQUEST, "subject is required", &req.request_id);
    }

    let status = body
        .status
        .as_deref()
        .map(|value| value.trim().to_ascii_uppercase())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "OPEN".to_string());
    let priority = body
        .priority
        .as_deref()
        .map(|value| value.trim().to_ascii_uppercase())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "NORMAL".to_string());

    let user_email = match body.user_id {
        Some(user_id) => lookup_user_email(&state.db, user_id).await,
        None => None,
    };
    let workspace_name = match body.workspace_id {
        Some(workspace_id) => lookup_workspace_name(&state.db, workspace_id).await,
        None => None,
    };

    let insert = sqlx::query(
        "INSERT INTO admin_support_tickets (
            subject, status, priority, source, user_email, workspace_name, created_by_user_id, created_at, updated_at
         ) VALUES (?, ?, ?, 'IN_APP', ?, ?, ?, datetime('now'), datetime('now'))",
    )
    .bind(subject)
    .bind(&status)
    .bind(&priority)
    .bind(user_email.as_deref())
    .bind(workspace_name.as_deref())
    .bind(principal.user_id)
    .execute(&state.db)
    .await;

    let result = match insert {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("Failed to create support ticket: {}", error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to create support ticket",
                &req.request_id,
            );
        }
    };

    let ticket_id = result.last_insert_rowid();
    let details = json!({
        "ticket_id": ticket_id,
        "subject": subject
    });
    if let Err(error) = insert_audit_event(
        &state.db,
        &req.request_id,
        "support.ticket.create",
        "created",
        &principal,
        "support_ticket",
        &ticket_id.to_string(),
        None,
        req.ip_address.as_deref(),
        req.user_agent.as_deref(),
        &details,
    )
    .await
    {
        tracing::error!("Failed to write support.ticket.create audit event: {}", error);
    }

    match fetch_support_ticket_by_id(&state.db, ticket_id).await {
        Ok(Some(ticket)) => (StatusCode::OK, Json(ticket)),
        _ => api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to load created support ticket",
            &req.request_id,
        ),
    }
}

pub async fn patch_support_ticket(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(ticket_id): Path<i64>,
    Json(body): Json<SupportTicketPatchBody>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    let principal = match require_admin_level(&state, &headers, 2, &req.request_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };

    let mut set_clauses: Vec<&str> = Vec::new();
    if body.status.is_some() {
        set_clauses.push("status = ?");
    }
    if body.priority.is_some() {
        set_clauses.push("priority = ?");
    }
    if set_clauses.is_empty() {
        return match fetch_support_ticket_by_id(&state.db, ticket_id).await {
            Ok(Some(ticket)) => (StatusCode::OK, Json(ticket)),
            Ok(None) => api_error(StatusCode::NOT_FOUND, "support ticket not found", &req.request_id),
            Err(error) => {
                tracing::error!("Failed to fetch support ticket {}: {}", ticket_id, error);
                api_error(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to load support ticket",
                    &req.request_id,
                )
            }
        };
    }

    let mut query = format!(
        "UPDATE admin_support_tickets SET {}, updated_at = datetime('now') WHERE id = ?",
        set_clauses.join(", ")
    );
    if set_clauses.is_empty() {
        query = "UPDATE admin_support_tickets SET updated_at = datetime('now') WHERE id = ?".to_string();
    }
    let mut stmt = sqlx::query(&query);
    if let Some(status) = body.status.as_deref() {
        stmt = stmt.bind(status.trim().to_ascii_uppercase());
    }
    if let Some(priority) = body.priority.as_deref() {
        stmt = stmt.bind(priority.trim().to_ascii_uppercase());
    }
    stmt = stmt.bind(ticket_id);

    let result = match stmt.execute(&state.db).await {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("Failed to patch support ticket {}: {}", ticket_id, error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update support ticket",
                &req.request_id,
            );
        }
    };
    if result.rows_affected() == 0 {
        return api_error(StatusCode::NOT_FOUND, "support ticket not found", &req.request_id);
    }

    let details = json!({
        "ticket_id": ticket_id,
        "status": body.status,
        "priority": body.priority
    });
    if let Err(error) = insert_audit_event(
        &state.db,
        &req.request_id,
        "support.ticket.update",
        "updated",
        &principal,
        "support_ticket",
        &ticket_id.to_string(),
        None,
        req.ip_address.as_deref(),
        req.user_agent.as_deref(),
        &details,
    )
    .await
    {
        tracing::error!("Failed to write support.ticket.update audit event: {}", error);
    }

    match fetch_support_ticket_by_id(&state.db, ticket_id).await {
        Ok(Some(ticket)) => (StatusCode::OK, Json(ticket)),
        _ => api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to load updated support ticket",
            &req.request_id,
        ),
    }
}

pub async fn add_support_ticket_note(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(ticket_id): Path<i64>,
    Json(body): Json<SupportTicketNoteBody>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    let principal = match require_admin_level(&state, &headers, 1, &req.request_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };

    let note = body.body.trim();
    if note.is_empty() {
        return api_error(StatusCode::BAD_REQUEST, "body is required", &req.request_id);
    }

    let ticket_exists = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM admin_support_tickets WHERE id = ?",
    )
    .bind(ticket_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);
    if ticket_exists == 0 {
        return api_error(StatusCode::NOT_FOUND, "support ticket not found", &req.request_id);
    }

    if let Err(error) = sqlx::query(
        "INSERT INTO admin_support_ticket_notes (ticket_id, admin_email, body, created_at)
         VALUES (?, ?, ?, datetime('now'))",
    )
    .bind(ticket_id)
    .bind(&principal.email)
    .bind(note)
    .execute(&state.db)
    .await
    {
        tracing::error!("Failed to add support note: {}", error);
        return api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to add support note",
            &req.request_id,
        );
    }

    if let Err(error) = sqlx::query(
        "UPDATE admin_support_tickets SET updated_at = datetime('now') WHERE id = ?",
    )
    .bind(ticket_id)
    .execute(&state.db)
    .await
    {
        tracing::error!("Failed to bump support ticket update timestamp: {}", error);
    }

    let details = json!({
        "ticket_id": ticket_id,
        "note_length": note.len()
    });
    if let Err(error) = insert_audit_event(
        &state.db,
        &req.request_id,
        "support.ticket.note",
        "created",
        &principal,
        "support_ticket",
        &ticket_id.to_string(),
        None,
        req.ip_address.as_deref(),
        req.user_agent.as_deref(),
        &details,
    )
    .await
    {
        tracing::error!("Failed to write support.ticket.note audit event: {}", error);
    }

    match fetch_support_ticket_by_id(&state.db, ticket_id).await {
        Ok(Some(ticket)) => (StatusCode::OK, Json(ticket)),
        _ => api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to load updated support ticket",
            &req.request_id,
        ),
    }
}

pub async fn list_feature_flags(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let req = request_context(&headers);
    if let Err(response) = require_admin_level(&state, &headers, 1, &req.request_id).await {
        return response;
    }

    let rows = match sqlx::query_as::<_, FeatureFlagRow>(
        "SELECT id, key, label, description, is_enabled, rollout_percent, is_critical, created_at, updated_at
         FROM admin_feature_flags
         ORDER BY key",
    )
    .fetch_all(&state.db)
    .await
    {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("Failed to list feature flags: {}", error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to query feature flags",
                &req.request_id,
            );
        }
    };

    let payload: Vec<Value> = rows
        .into_iter()
        .map(|row| feature_flag_to_json(&row))
        .collect();
    (StatusCode::OK, Json(json!(payload)))
}

pub async fn patch_feature_flag(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(flag_id): Path<i64>,
    Json(body): Json<FeatureFlagPatchBody>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    let principal = match require_admin_level(&state, &headers, 3, &req.request_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };

    let current = match sqlx::query_as::<_, FeatureFlagRow>(
        "SELECT id, key, label, description, is_enabled, rollout_percent, is_critical, created_at, updated_at
         FROM admin_feature_flags WHERE id = ?",
    )
    .bind(flag_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(value)) => value,
        Ok(None) => return api_error(StatusCode::NOT_FOUND, "feature flag not found", &req.request_id),
        Err(error) => {
            tracing::error!("Failed to load feature flag {}: {}", flag_id, error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load feature flag",
                &req.request_id,
            );
        }
    };

    let next_is_enabled = body.is_enabled.unwrap_or(current.is_enabled > 0);
    let next_rollout_percent = body
        .rollout_percent
        .unwrap_or(current.rollout_percent)
        .clamp(0, 100);
    let changed = next_is_enabled != (current.is_enabled > 0)
        || next_rollout_percent != current.rollout_percent;
    if !changed {
        return (StatusCode::OK, Json(feature_flag_to_json(&current)));
    }

    let reason = body
        .reason
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    if current.is_critical > 0 {
        if reason.is_none() {
            return api_error(
                StatusCode::BAD_REQUEST,
                "reason is required for critical feature flag change",
                &req.request_id,
            );
        }
        if principal.level < 4 {
            return api_error(
                StatusCode::FORBIDDEN,
                "critical feature flag approvals require superadmin level",
                &req.request_id,
            );
        }
        let approval = match create_admin_approval_request(
            &state.db,
            &principal,
            "FEATURE_FLAG_CRITICAL",
            reason.as_deref().unwrap_or("critical feature flag change"),
            None,
            None,
            &json!({
                "feature_flag_id": flag_id,
                "key": current.key,
                "is_enabled": next_is_enabled,
                "rollout_percent": next_rollout_percent
            }),
            &req,
        )
        .await
        {
            Ok(value) => value,
            Err(error) => {
                tracing::error!("Failed to create feature flag approval: {}", error);
                return api_error(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to create approval request",
                    &req.request_id,
                );
            }
        };
        return (
            StatusCode::OK,
            Json(json!({
                "approval_required": true,
                "approval_request_id": approval,
                "approval_status": "PENDING"
            })),
        );
    }

    if let Err(error) = sqlx::query(
        "UPDATE admin_feature_flags
         SET is_enabled = ?, rollout_percent = ?, updated_at = datetime('now')
         WHERE id = ?",
    )
    .bind(if next_is_enabled { 1 } else { 0 })
    .bind(next_rollout_percent)
    .bind(flag_id)
    .execute(&state.db)
    .await
    {
        tracing::error!("Failed to update feature flag {}: {}", flag_id, error);
        return api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to update feature flag",
            &req.request_id,
        );
    }

    let details = json!({
        "feature_flag_id": flag_id,
        "key": current.key,
        "is_enabled": next_is_enabled,
        "rollout_percent": next_rollout_percent
    });
    if let Err(error) = insert_audit_event(
        &state.db,
        &req.request_id,
        "feature_flag.update",
        "updated",
        &principal,
        "feature_flag",
        &flag_id.to_string(),
        reason.as_deref(),
        req.ip_address.as_deref(),
        req.user_agent.as_deref(),
        &details,
    )
    .await
    {
        tracing::error!("Failed to write feature_flag.update audit event: {}", error);
    }

    match sqlx::query_as::<_, FeatureFlagRow>(
        "SELECT id, key, label, description, is_enabled, rollout_percent, is_critical, created_at, updated_at
         FROM admin_feature_flags WHERE id = ?",
    )
    .bind(flag_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(updated)) => (StatusCode::OK, Json(feature_flag_to_json(&updated))),
        _ => api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to load updated feature flag",
            &req.request_id,
        ),
    }
}

pub async fn list_employees(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<PaginatedQuery>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    if let Err(response) = require_admin_level(&state, &headers, 1, &req.request_id).await {
        return response;
    }

    let page = params.page.unwrap_or(1).max(1);
    let page_size = params.page_size.unwrap_or(50).clamp(1, 200);
    let search = params
        .search
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_lowercase());

    let rows = match fetch_employee_rows(&state.db, search.as_deref()).await {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("Failed to list employees: {}", error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to query employees",
                &req.request_id,
            );
        }
    };
    let payloads: Vec<Value> = rows
        .iter()
        .map(employee_row_to_json)
        .collect();

    let count = payloads.len() as i64;
    let extra = search
        .as_deref()
        .map(|value| vec![("search", value.to_string())])
        .unwrap_or_default();
    let (results, next, previous) = paginate_values(payloads, page, page_size, &extra);
    (
        StatusCode::OK,
        Json(json!({
            "results": results,
            "next": next,
            "previous": previous,
            "count": count
        })),
    )
}

pub async fn get_employee(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(employee_id): Path<i64>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    if let Err(response) = require_admin_level(&state, &headers, 1, &req.request_id).await {
        return response;
    }

    match fetch_employee_by_id(&state.db, employee_id).await {
        Ok(Some(employee)) => (StatusCode::OK, Json(employee_row_to_json(&employee))),
        Ok(None) => api_error(StatusCode::NOT_FOUND, "employee not found", &req.request_id),
        Err(error) => {
            tracing::error!("Failed to load employee {}: {}", employee_id, error);
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load employee",
                &req.request_id,
            )
        }
    }
}

pub async fn create_employee(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<EmployeeWriteBody>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    let principal = match require_admin_level(&state, &headers, 2, &req.request_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };

    let email = if let Some(email) = body
        .email
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        email.to_ascii_lowercase()
    } else if let Some(user_id) = body.user_id {
        lookup_user_email(&state.db, user_id)
            .await
            .unwrap_or_default()
    } else {
        String::new()
    };
    if email.is_empty() {
        return api_error(
            StatusCode::BAD_REQUEST,
            "email or user_id is required",
            &req.request_id,
        );
    }
    let name = body
        .display_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| email.clone());

    let role = normalize_employee_role(body.primary_admin_role.as_deref()).to_string();
    if role == "superadmin" && principal.level < 4 {
        return api_error(
            StatusCode::FORBIDDEN,
            "superadmin grants require superadmin level",
            &req.request_id,
        );
    }

    let workspace_scope = normalize_workspace_scope(body.workspace_scope.clone());
    let result = sqlx::query(
        "INSERT INTO admin_employees (
            user_id, name, email, title, department, admin_panel_access, primary_admin_role,
            is_active_employee, last_login, workspace_scope_json, manager_id, created_at, updated_at, deleted_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, datetime('now'), datetime('now'), NULL)",
    )
    .bind(body.user_id)
    .bind(&name)
    .bind(&email)
    .bind(body.title.as_deref().map(str::trim).filter(|value| !value.is_empty()))
    .bind(body.department.as_deref().map(str::trim).filter(|value| !value.is_empty()))
    .bind(if body.admin_panel_access.unwrap_or(true) { 1 } else { 0 })
    .bind(&role)
    .bind(if body.is_active_employee.unwrap_or(true) { 1 } else { 0 })
    .bind(&workspace_scope)
    .bind(body.manager_id)
    .execute(&state.db)
    .await;

    let insert = match result {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("Failed to create employee: {}", error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to create employee",
                &req.request_id,
            );
        }
    };
    let employee_id = insert.last_insert_rowid();

    let details = json!({
        "employee_id": employee_id,
        "email": email,
        "role": role
    });
    if let Err(error) = insert_audit_event(
        &state.db,
        &req.request_id,
        "employee.create",
        "created",
        &principal,
        "employee",
        &employee_id.to_string(),
        None,
        req.ip_address.as_deref(),
        req.user_agent.as_deref(),
        &details,
    )
    .await
    {
        tracing::error!("Failed to write employee.create audit event: {}", error);
    }

    match fetch_employee_by_id(&state.db, employee_id).await {
        Ok(Some(employee)) => (StatusCode::OK, Json(employee_row_to_json(&employee))),
        _ => api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to load created employee",
            &req.request_id,
        ),
    }
}

pub async fn patch_employee(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(employee_id): Path<i64>,
    Json(body): Json<EmployeeWriteBody>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    let principal = match require_admin_level(&state, &headers, 2, &req.request_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };

    if let Some(role) = body.primary_admin_role.as_deref() {
        let normalized = normalize_employee_role(Some(role));
        if normalized == "superadmin" && principal.level < 4 {
            return api_error(
                StatusCode::FORBIDDEN,
                "superadmin grants require superadmin level",
                &req.request_id,
            );
        }
    }

    let updated = match update_employee_record(&state.db, employee_id, &body).await {
        Ok(Some(value)) => value,
        Ok(None) => return api_error(StatusCode::NOT_FOUND, "employee not found", &req.request_id),
        Err(error) => {
            tracing::error!("Failed to update employee {}: {}", employee_id, error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update employee",
                &req.request_id,
            );
        }
    };

    let details = json!({
        "employee_id": employee_id,
        "role": body.primary_admin_role,
        "admin_panel_access": body.admin_panel_access
    });
    if let Err(error) = insert_audit_event(
        &state.db,
        &req.request_id,
        "employee.update",
        "updated",
        &principal,
        "employee",
        &employee_id.to_string(),
        None,
        req.ip_address.as_deref(),
        req.user_agent.as_deref(),
        &details,
    )
    .await
    {
        tracing::error!("Failed to write employee.update audit event: {}", error);
    }

    (StatusCode::OK, Json(employee_row_to_json(&updated)))
}

pub async fn suspend_employee(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(employee_id): Path<i64>,
) -> impl IntoResponse {
    mutate_employee_active_status(state, headers, employee_id, false, "employee.suspend").await
}

pub async fn reactivate_employee(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(employee_id): Path<i64>,
) -> impl IntoResponse {
    mutate_employee_active_status(state, headers, employee_id, true, "employee.reactivate").await
}

pub async fn delete_employee(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(employee_id): Path<i64>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    let principal = match require_admin_level(&state, &headers, 4, &req.request_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };

    let result = sqlx::query(
        "UPDATE admin_employees
         SET deleted_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(employee_id)
    .execute(&state.db)
    .await;
    match result {
        Ok(value) if value.rows_affected() > 0 => {
            let details = json!({
                "employee_id": employee_id
            });
            if let Err(error) = insert_audit_event(
                &state.db,
                &req.request_id,
                "employee.delete",
                "deleted",
                &principal,
                "employee",
                &employee_id.to_string(),
                None,
                req.ip_address.as_deref(),
                req.user_agent.as_deref(),
                &details,
            )
            .await
            {
                tracing::error!("Failed to write employee.delete audit event: {}", error);
            }
            (StatusCode::OK, Json(json!({ "success": true })))
        }
        Ok(_) => api_error(StatusCode::NOT_FOUND, "employee not found", &req.request_id),
        Err(error) => {
            tracing::error!("Failed to delete employee {}: {}", employee_id, error);
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to delete employee",
                &req.request_id,
            )
        }
    }
}

pub async fn invite_employee(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<InviteEmployeeBody>,
) -> impl IntoResponse {
    let req = request_context(&headers);
    let principal = match require_admin_level(&state, &headers, 2, &req.request_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };

    let email = body.email.trim().to_ascii_lowercase();
    if email.is_empty() || !email.contains('@') {
        return api_error(StatusCode::BAD_REQUEST, "valid email is required", &req.request_id);
    }
    let role = normalize_employee_role(Some(body.role.as_str())).to_string();
    if role == "superadmin" && principal.level < 4 {
        return api_error(
            StatusCode::FORBIDDEN,
            "superadmin invites require superadmin level",
            &req.request_id,
        );
    }

    let name = body
        .full_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| email.clone());
    let token = Uuid::new_v4().to_string();
    let invite_id = Uuid::new_v4().to_string();
    let invite_url = format!("/internal-admin/invite/{}/", token);
    let invited_at = now_sqlite();
    let expires_at = minutes_from_now(EMPLOYEE_INVITE_EXPIRY_DAYS * 24 * 60);

    let existing = match fetch_employee_by_email(&state.db, &email).await {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("Failed to load employee by email {}: {}", email, error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load employee invite state",
                &req.request_id,
            );
        }
    };

    let employee_id = if let Some(employee) = existing {
        let update = sqlx::query(
            "UPDATE admin_employees
             SET name = ?, primary_admin_role = ?, is_active_employee = 0, admin_panel_access = 0,
                 invite_id = ?, invite_status = 'pending', invite_token = ?, invite_invited_at = ?,
                 invite_expires_at = ?, invite_url = ?, invite_email_send_failed = 0, invite_email_last_error = NULL,
                 updated_at = datetime('now'), deleted_at = NULL
             WHERE id = ?",
        )
        .bind(&name)
        .bind(&role)
        .bind(&invite_id)
        .bind(&token)
        .bind(&invited_at)
        .bind(&expires_at)
        .bind(&invite_url)
        .bind(employee.id)
        .execute(&state.db)
        .await;
        if let Err(error) = update {
            tracing::error!("Failed to refresh employee invite {}: {}", employee.id, error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to refresh invite",
                &req.request_id,
            );
        }
        employee.id
    } else {
        let insert = sqlx::query(
            "INSERT INTO admin_employees (
                user_id, name, email, title, department, admin_panel_access, primary_admin_role,
                is_active_employee, last_login, workspace_scope_json, manager_id,
                created_at, updated_at, deleted_at,
                invite_id, invite_status, invite_token, invite_invited_at, invite_expires_at, invite_url,
                invite_email_send_failed, invite_email_last_error
             ) VALUES (
                NULL, ?, ?, NULL, NULL, 0, ?, 0, NULL, '{}', NULL,
                datetime('now'), datetime('now'), NULL,
                ?, 'pending', ?, ?, ?, ?, 0, NULL
             )",
        )
        .bind(&name)
        .bind(&email)
        .bind(&role)
        .bind(&invite_id)
        .bind(&token)
        .bind(&invited_at)
        .bind(&expires_at)
        .bind(&invite_url)
        .execute(&state.db)
        .await;
        match insert {
            Ok(value) => value.last_insert_rowid(),
            Err(error) => {
                tracing::error!("Failed to create employee invite: {}", error);
                return api_error(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to create invite",
                    &req.request_id,
                );
            }
        }
    };

    let details = json!({
        "employee_id": employee_id,
        "email": email,
        "role": role
    });
    if let Err(error) = insert_audit_event(
        &state.db,
        &req.request_id,
        "employee.invite",
        "created",
        &principal,
        "employee",
        &employee_id.to_string(),
        None,
        req.ip_address.as_deref(),
        req.user_agent.as_deref(),
        &details,
    )
    .await
    {
        tracing::error!("Failed to write employee.invite audit event: {}", error);
    }

    match fetch_employee_by_id(&state.db, employee_id).await {
        Ok(Some(employee)) => (StatusCode::OK, Json(employee_row_to_json(&employee))),
        _ => api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to load invited employee",
            &req.request_id,
        ),
    }
}

pub async fn resend_employee_invite(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(employee_id): Path<i64>,
) -> impl IntoResponse {
    mutate_employee_invite(state, headers, employee_id, false).await
}

pub async fn revoke_employee_invite(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(employee_id): Path<i64>,
) -> impl IntoResponse {
    mutate_employee_invite(state, headers, employee_id, true).await
}

pub async fn get_invite(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> impl IntoResponse {
    match fetch_employee_by_invite_token(&state.db, &token).await {
        Ok(Some(employee)) => {
            if employee.invite_status.as_deref() != Some("pending")
                || is_expired_timestamp(employee.invite_expires_at.as_deref())
            {
                return (
                    StatusCode::OK,
                    Json(json!({
                        "valid": false,
                        "error": "This invite link is invalid or has expired."
                    })),
                );
            }
            (
                StatusCode::OK,
                Json(json!({
                    "valid": true,
                    "role": employee.primary_admin_role,
                    "email": employee.email,
                    "email_locked": true
                })),
            )
        }
        Ok(None) => (
            StatusCode::OK,
            Json(json!({
                "valid": false,
                "error": "This invite link is invalid or has expired."
            })),
        ),
        Err(error) => {
            tracing::error!("Failed to validate invite token: {}", error);
            (
                StatusCode::OK,
                Json(json!({
                    "valid": false,
                    "error": "Could not validate invite."
                })),
            )
        }
    }
}

pub async fn redeem_invite(
    State(state): State<AppState>,
    Path(token): Path<String>,
    Json(body): Json<InviteRedeemBody>,
) -> impl IntoResponse {
    let employee = match fetch_employee_by_invite_token(&state.db, &token).await {
        Ok(Some(value)) => value,
        Ok(None) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Invite is invalid or expired." })),
            )
        }
        Err(error) => {
            tracing::error!("Failed to fetch invite by token: {}", error);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Could not validate invite." })),
            );
        }
    };
    if employee.invite_status.as_deref() != Some("pending")
        || is_expired_timestamp(employee.invite_expires_at.as_deref())
    {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invite is invalid or expired." })),
        );
    }

    let username = body
        .username
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("admin-user");
    let first_name = body
        .first_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("Admin");
    let last_name = body
        .last_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("User");
    let email = body
        .email
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(employee.email.as_str());
    if !email.eq_ignore_ascii_case(employee.email.as_str()) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invite email does not match." })),
        );
    }
    let password = match body.password.as_deref() {
        Some(value) if value.len() >= 8 => value,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Password must be at least 8 characters." })),
            )
        }
    };

    let user_id = match ensure_invite_user(
        &state.db,
        &employee,
        username,
        first_name,
        last_name,
        email,
        password,
    )
    .await
    {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("Failed to create invite user: {}", error);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Failed to create account." })),
            );
        }
    };

    if let Err(error) = sqlx::query(
        "UPDATE admin_employees
         SET user_id = ?, is_active_employee = 1, admin_panel_access = 1,
             invite_status = 'accepted', invite_token = NULL, invite_url = NULL,
             updated_at = datetime('now')
         WHERE id = ?",
    )
    .bind(user_id)
    .bind(employee.id)
    .execute(&state.db)
    .await
    {
        tracing::error!("Failed to mark invite as accepted: {}", error);
    }

    (
        StatusCode::OK,
        Json(json!({
            "message": "Account created successfully.",
            "redirect": "/login"
        })),
    )
}

async fn table_exists(pool: &SqlitePool, table: &str) -> bool {
    let Some(table_name) = sanitize_identifier(table) else {
        return false;
    };
    sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
    )
    .bind(table_name)
    .fetch_one(pool)
    .await
    .unwrap_or(0)
        > 0
}

async fn column_exists(pool: &SqlitePool, table: &str, column: &str) -> bool {
    let Some(table_name) = sanitize_identifier(table) else {
        return false;
    };
    let Some(column_name) = sanitize_identifier(column) else {
        return false;
    };
    let query = format!("SELECT COUNT(*) FROM pragma_table_info('{}') WHERE name = ?", table_name);
    sqlx::query_scalar::<_, i64>(&query)
        .bind(column_name)
        .fetch_one(pool)
        .await
        .unwrap_or(0)
        > 0
}

fn sanitize_identifier(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    if trimmed
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '_')
    {
        Some(trimmed.to_string())
    } else {
        None
    }
}

fn parse_boolish(value: Option<&str>) -> Option<bool> {
    match value.map(|v| v.trim().to_ascii_lowercase()) {
        Some(raw) if matches!(raw.as_str(), "1" | "true" | "yes") => Some(true),
        Some(raw) if matches!(raw.as_str(), "0" | "false" | "no") => Some(false),
        _ => None,
    }
}

fn normalize_role_value(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(|v| v.to_ascii_lowercase())
}

fn normalize_employee_role(role: Option<&str>) -> &'static str {
    match role
        .map(str::trim)
        .map(|value| value.to_ascii_lowercase())
        .as_deref()
    {
        Some("superadmin" | "primary_admin") => "superadmin",
        Some("engineering" | "engineer") => "engineering",
        Some("finance" | "ops") => "finance",
        Some("none") => "none",
        _ => "support",
    }
}

fn normalize_workspace_scope(scope: Option<Value>) -> String {
    let scope_value = scope.unwrap_or_else(|| json!({ "mode": "all" }));
    if scope_value.is_object() {
        scope_value.to_string()
    } else {
        json!({ "mode": "all" }).to_string()
    }
}

fn normalize_workspace_status(status: Option<&str>, is_deleted: bool) -> String {
    if is_deleted {
        return "soft_deleted".to_string();
    }
    status
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_else(|| "active".to_string())
}

fn queue_status(count: i64, warning: i64, critical: i64) -> &'static str {
    if count >= critical {
        "critical"
    } else if count >= warning {
        "warning"
    } else {
        "healthy"
    }
}

fn human_age_minutes(minutes: i64) -> String {
    if minutes < 60 {
        format!("{}m", minutes.max(0))
    } else if minutes < 1440 {
        format!("{}h", minutes / 60)
    } else {
        format!("{}d", minutes / 1440)
    }
}

fn paginate_values(
    values: Vec<Value>,
    page: i64,
    page_size: i64,
    extra_params: &[(&str, String)],
) -> (Vec<Value>, Option<String>, Option<String>) {
    let count = values.len() as i64;
    let page = page.max(1);
    let page_size = page_size.clamp(1, 500);
    let offset = (page - 1) * page_size;
    let mut sorted_values = values;
    let start = offset as usize;
    let end = ((offset + page_size).min(count)) as usize;
    let page_values = if start < sorted_values.len() {
        sorted_values.drain(start..end).collect::<Vec<Value>>()
    } else {
        Vec::new()
    };

    let has_next = page * page_size < count;
    let next = if has_next {
        Some(pagination_link_generic(page + 1, page_size, extra_params))
    } else {
        None
    };
    let previous = if page > 1 {
        Some(pagination_link_generic(page - 1, page_size, extra_params))
    } else {
        None
    };
    (page_values, next, previous)
}

fn pagination_link_generic(page: i64, page_size: i64, extra_params: &[(&str, String)]) -> String {
    let mut query = vec![
        format!("page={}", page),
        format!("page_size={}", page_size),
    ];
    for (key, value) in extra_params {
        query.push(format!("{}={}", key, urlencoding::encode(value)));
    }
    format!("?{}", query.join("&"))
}

async fn detect_business_owner_column(pool: &SqlitePool) -> Option<String> {
    if !table_exists(pool, "core_business").await {
        return None;
    }
    for candidate in ["owner_user_id", "owner_id"] {
        if column_exists(pool, "core_business", candidate).await {
            return Some(candidate.to_string());
        }
    }
    None
}

async fn detect_business_name_column(pool: &SqlitePool) -> Option<String> {
    if !table_exists(pool, "core_business").await {
        return None;
    }
    for candidate in ["name", "legal_name"] {
        if column_exists(pool, "core_business", candidate).await {
            return Some(candidate.to_string());
        }
    }
    None
}

async fn detect_business_plan_column(pool: &SqlitePool) -> Option<String> {
    if !table_exists(pool, "core_business").await {
        return None;
    }
    for candidate in ["plan", "plan_name", "subscription_plan"] {
        if column_exists(pool, "core_business", candidate).await {
            return Some(candidate.to_string());
        }
    }
    None
}

async fn count_active_users_window(pool: &SqlitePool, total_days: i64, offset_days: i64) -> i64 {
    if !table_exists(pool, "auth_user").await {
        return 0;
    }
    if column_exists(pool, "auth_user", "last_login").await {
        let window_clause = format!("-{} day", total_days);
        let offset_clause = format!("-{} day", offset_days);
        return sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*)
             FROM auth_user
             WHERE is_active = 1
               AND last_login IS NOT NULL
               AND datetime(last_login) >= datetime('now', ?)
               AND datetime(last_login) < datetime('now', ?)",
        )
        .bind(window_clause)
        .bind(offset_clause)
        .fetch_one(pool)
        .await
        .unwrap_or(0);
    }
    sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM auth_user WHERE is_active = 1")
        .fetch_one(pool)
        .await
        .unwrap_or(0)
}

async fn count_unreconciled_transactions(pool: &SqlitePool, older_than_days: Option<i64>) -> i64 {
    if !table_exists(pool, "core_banktransaction").await {
        return 0;
    }
    let unresolved_condition = if column_exists(pool, "core_banktransaction", "is_reconciled").await {
        "COALESCE(is_reconciled, 0) = 0".to_string()
    } else {
        "upper(COALESCE(status, 'NEW')) IN ('NEW', 'UNMATCHED', 'UNRECONCILED')".to_string()
    };
    let date_column = if column_exists(pool, "core_banktransaction", "date").await {
        Some("date")
    } else if column_exists(pool, "core_banktransaction", "created_at").await {
        Some("created_at")
    } else {
        None
    };
    let mut query = format!(
        "SELECT COUNT(*) FROM core_banktransaction WHERE {}",
        unresolved_condition
    );
    if let (Some(days), Some(col)) = (older_than_days, date_column) {
        query.push_str(&format!(" AND datetime({}) <= datetime('now', '-{} day')", col, days));
    }
    sqlx::query_scalar::<_, i64>(&query)
        .fetch_one(pool)
        .await
        .unwrap_or(0)
}

async fn count_unbalanced_journal_entries(pool: &SqlitePool) -> i64 {
    if !table_exists(pool, "core_journalentry").await {
        return 0;
    }
    if column_exists(pool, "core_journalentry", "debit_total").await
        && column_exists(pool, "core_journalentry", "credit_total").await
    {
        return sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM core_journalentry
             WHERE abs(COALESCE(debit_total, 0) - COALESCE(credit_total, 0)) > 0.009",
        )
        .fetch_one(pool)
        .await
        .unwrap_or(0);
    }
    0
}

async fn count_failed_invoice_emails(pool: &SqlitePool) -> i64 {
    if !table_exists(pool, "core_invoice").await || !column_exists(pool, "core_invoice", "status").await {
        return 0;
    }
    sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM core_invoice
         WHERE upper(COALESCE(status, '')) IN ('EMAIL_FAILED', 'FAILED', 'ERROR')
           AND (created_at IS NULL OR datetime(created_at) >= datetime('now', '-1 day'))",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0)
}

async fn count_open_ai_flags(pool: &SqlitePool) -> i64 {
    for table in ["companion_issue", "core_companion_issue", "agentic_companion_issue", "companion_issues"] {
        if table_exists(pool, table).await && column_exists(pool, table, "status").await {
            let query = format!(
                "SELECT COUNT(*) FROM {} WHERE upper(COALESCE(status, 'OPEN')) IN ('OPEN', 'NEW', 'PENDING')",
                table
            );
            return sqlx::query_scalar::<_, i64>(&query)
                .fetch_one(pool)
                .await
                .unwrap_or(0);
        }
    }
    0
}

async fn api_health_stats(pool: &SqlitePool) -> (f64, i64) {
    let row = sqlx::query_as::<_, (i64, i64, Option<f64>, Option<f64>)>(
        "SELECT
            COUNT(*) as total_events,
            SUM(CASE WHEN outcome LIKE 'denied%' OR outcome LIKE '%failed%' THEN 1 ELSE 0 END) as error_events,
            AVG(CASE WHEN json_valid(details_json) THEN json_extract(details_json, '$.response_ms') END) as avg_ms,
            MAX(CASE WHEN json_valid(details_json) THEN json_extract(details_json, '$.response_ms') END) as max_ms
         FROM admin_audit_events
         WHERE datetime(created_at) >= datetime('now', '-1 hour')",
    )
    .fetch_one(pool)
    .await
    .unwrap_or((0, 0, None, None));
    let error_rate = if row.0 > 0 {
        ((row.1 as f64 / row.0 as f64) * 100.0 * 100.0).round() / 100.0
    } else {
        0.0
    };
    let p95 = row.3.or(row.2).unwrap_or(0.0).round() as i64;
    (error_rate, p95)
}

async fn api_error_rate_1h_pct(pool: &SqlitePool) -> f64 {
    api_health_stats(pool).await.0
}

async fn api_p95_response_ms_1h(pool: &SqlitePool) -> i64 {
    api_health_stats(pool).await.1
}

async fn fetch_workspace_health(pool: &SqlitePool, limit: i64) -> Vec<Value> {
    let rows = fetch_workspaces_rows(pool, None).await.unwrap_or_default();
    let workspace_ids: Vec<i64> = rows.iter().map(|row| row.id).collect();
    let unreconciled_map = unreconciled_counts_for_workspaces(pool, &workspace_ids).await;
    let ledger_map = ledger_status_for_workspaces(pool, &workspace_ids).await;
    rows.into_iter()
        .take(limit as usize)
        .map(|row| {
            json!({
                "id": row.id,
                "name": row.name,
                "owner_email": row.owner_email,
                "plan": row.plan,
                "unreconciled_count": unreconciled_map.get(&row.id).copied().unwrap_or(0),
                "ledger_status": ledger_map.get(&row.id).cloned().unwrap_or_else(|| "balanced".to_string())
            })
        })
        .collect()
}

async fn count_failing_bank_feeds(pool: &SqlitePool) -> i64 {
    if !table_exists(pool, "core_bankaccount").await {
        return 0;
    }
    if column_exists(pool, "core_bankaccount", "status").await {
        return sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM core_bankaccount WHERE upper(COALESCE(status, 'OK')) IN ('ERROR', 'DISCONNECTED', 'FAILED')",
        )
        .fetch_one(pool)
        .await
        .unwrap_or(0);
    }
    sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM core_bankaccount WHERE COALESCE(is_active, 1) = 0",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0)
}

async fn count_open_tax_issues(pool: &SqlitePool) -> i64 {
    for table in ["tax_anomaly", "core_tax_anomaly", "tax_guardian_anomaly"] {
        if table_exists(pool, table).await && column_exists(pool, table, "status").await {
            let query = format!(
                "SELECT COUNT(*) FROM {} WHERE upper(COALESCE(status, 'OPEN')) IN ('OPEN', 'PENDING', 'NEW')",
                table
            );
            return sqlx::query_scalar::<_, i64>(&query)
                .fetch_one(pool)
                .await
                .unwrap_or(0);
        }
    }
    0
}

async fn build_ops_tasks(pool: &SqlitePool, priority: &str, window_hours: i64) -> Vec<Value> {
    let mut tasks: Vec<Value> = Vec::new();
    if priority == "high" {
        let approvals = sqlx::query_as::<_, (String, String, String, Option<i64>)>(
            "SELECT id, action_type, created_at, workspace_id
             FROM admin_approval_requests
             WHERE status = 'PENDING'
             ORDER BY datetime(created_at) DESC
             LIMIT 10",
        )
        .fetch_all(pool)
        .await
        .unwrap_or_default();
        for (id, action_type, created_at, workspace_id) in approvals {
            let age_minutes = minutes_since(&created_at);
            tasks.push(json!({
                "id": id,
                "kind": "ai",
                "title": format!("Approval pending: {}", action_type),
                "workspace": workspace_id.map(|id| format!("#{}", id)).unwrap_or_else(|| "global".to_string()),
                "age": human_age_minutes(age_minutes),
                "priority": "high",
                "slaBreached": age_minutes > window_hours * 60
            }));
        }
    } else if priority == "medium" {
        let tickets = sqlx::query_as::<_, (i64, String, String, Option<String>)>(
            "SELECT id, subject, created_at, workspace_name
             FROM admin_support_tickets
             WHERE status IN ('OPEN', 'IN_PROGRESS')
             ORDER BY datetime(updated_at) DESC
             LIMIT 10",
        )
        .fetch_all(pool)
        .await
        .unwrap_or_default();
        for (id, subject, created_at, workspace_name) in tickets {
            let age_minutes = minutes_since(&created_at);
            tasks.push(json!({
                "id": format!("ticket-{}", id),
                "kind": "support",
                "title": subject,
                "workspace": workspace_name.unwrap_or_else(|| "Unassigned".to_string()),
                "age": human_age_minutes(age_minutes),
                "priority": "medium",
                "slaBreached": age_minutes > 4 * 60
            }));
        }
    } else {
        let top_workspaces = top_unreconciled_workspaces(pool, 10).await;
        for workspace in top_workspaces {
            let id = workspace
                .get("id")
                .and_then(Value::as_i64)
                .unwrap_or_default();
            let count = workspace
                .get("unreconciled_count")
                .and_then(Value::as_i64)
                .unwrap_or_default();
            if count == 0 {
                continue;
            }
            tasks.push(json!({
                "id": format!("recon-{}", id),
                "kind": "recon",
                "title": format!("Reconciliation backlog: {} items", count),
                "workspace": workspace.get("name").and_then(Value::as_str).unwrap_or("Unknown"),
                "age": "rolling",
                "priority": "low",
                "slaBreached": count > 50
            }));
        }
    }
    tasks
}

async fn fetch_recent_admin_activity(pool: &SqlitePool, window_hours: i64, limit: i64) -> Vec<Value> {
    let rows = sqlx::query_as::<_, (i64, String, Option<String>, String, Option<String>, Option<String>)>(
        "SELECT id, created_at, actor_email, action, target_type, outcome
         FROM admin_audit_events
         WHERE datetime(created_at) >= datetime('now', ?)
         ORDER BY id DESC
         LIMIT ?",
    )
    .bind(format!("-{} hour", window_hours))
    .bind(limit)
    .fetch_all(pool)
    .await
    .unwrap_or_default();
    rows.into_iter()
        .map(|(id, created_at, actor_email, action, target_type, outcome)| {
            let impact = if outcome
                .as_deref()
                .unwrap_or("ok")
                .to_ascii_lowercase()
                .contains("failed")
                || outcome
                    .as_deref()
                    .unwrap_or("ok")
                    .to_ascii_lowercase()
                    .contains("denied")
            {
                "high"
            } else if action.contains("approval") || action.contains("break_glass") {
                "medium"
            } else {
                "low"
            };
            json!({
                "id": format!("evt-{}", id),
                "time": created_at,
                "actor": actor_email.unwrap_or_else(|| "system".to_string()),
                "scope": target_type.unwrap_or_else(|| "admin".to_string()),
                "action": action,
                "impact": impact
            })
        })
        .collect()
}

async fn unreconciled_aging_buckets(pool: &SqlitePool) -> Value {
    if !table_exists(pool, "core_banktransaction").await {
        return json!({
            "0_30_days": 0,
            "30_60_days": 0,
            "60_90_days": 0,
            "over_90_days": 0
        });
    }
    let unresolved_condition = if column_exists(pool, "core_banktransaction", "is_reconciled").await {
        "COALESCE(is_reconciled, 0) = 0"
    } else {
        "upper(COALESCE(status, 'NEW')) IN ('NEW', 'UNMATCHED', 'UNRECONCILED')"
    };
    let date_column = if column_exists(pool, "core_banktransaction", "date").await {
        "date"
    } else if column_exists(pool, "core_banktransaction", "created_at").await {
        "created_at"
    } else {
        return json!({
            "0_30_days": 0,
            "30_60_days": 0,
            "60_90_days": 0,
            "over_90_days": 0
        });
    };
    let query = format!(
        "SELECT
            SUM(CASE WHEN datetime({col}) >= datetime('now', '-30 day') THEN 1 ELSE 0 END) as d0_30,
            SUM(CASE WHEN datetime({col}) < datetime('now', '-30 day') AND datetime({col}) >= datetime('now', '-60 day') THEN 1 ELSE 0 END) as d30_60,
            SUM(CASE WHEN datetime({col}) < datetime('now', '-60 day') AND datetime({col}) >= datetime('now', '-90 day') THEN 1 ELSE 0 END) as d60_90,
            SUM(CASE WHEN datetime({col}) < datetime('now', '-90 day') THEN 1 ELSE 0 END) as over_90
         FROM core_banktransaction
         WHERE {cond}",
        col = date_column,
        cond = unresolved_condition
    );
    let row = sqlx::query_as::<_, (Option<i64>, Option<i64>, Option<i64>, Option<i64>)>(&query)
        .fetch_one(pool)
        .await
        .unwrap_or((Some(0), Some(0), Some(0), Some(0)));
    json!({
        "0_30_days": row.0.unwrap_or(0),
        "30_60_days": row.1.unwrap_or(0),
        "60_90_days": row.2.unwrap_or(0),
        "over_90_days": row.3.unwrap_or(0)
    })
}

async fn top_unreconciled_workspaces(pool: &SqlitePool, limit: i64) -> Vec<Value> {
    if !table_exists(pool, "core_banktransaction").await
        || !table_exists(pool, "core_bankaccount").await
        || !table_exists(pool, "core_business").await
    {
        return Vec::new();
    }
    let unresolved_condition = if column_exists(pool, "core_banktransaction", "is_reconciled").await {
        "COALESCE(t.is_reconciled, 0) = 0"
    } else {
        "upper(COALESCE(t.status, 'NEW')) IN ('NEW', 'UNMATCHED', 'UNRECONCILED')"
    };
    let business_name_col = detect_business_name_column(pool)
        .await
        .unwrap_or_else(|| "name".to_string());
    let query = format!(
        "SELECT b.id, b.{name_col}, COUNT(*)
         FROM core_banktransaction t
         JOIN core_bankaccount a ON a.id = t.bank_account_id
         JOIN core_business b ON b.id = a.business_id
         WHERE {condition}
         GROUP BY b.id, b.{name_col}
         ORDER BY COUNT(*) DESC
         LIMIT ?",
        name_col = business_name_col,
        condition = unresolved_condition
    );
    sqlx::query_as::<_, (i64, String, i64)>(&query)
        .bind(limit)
        .fetch_all(pool)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|(id, name, unreconciled_count)| {
            json!({
                "id": id,
                "name": name,
                "unreconciled_count": unreconciled_count
            })
        })
        .collect()
}

async fn recent_reconciliation_sessions(pool: &SqlitePool, limit: i64) -> Vec<Value> {
    if !table_exists(pool, "core_reconciliationsession").await {
        return Vec::new();
    }
    let workspace_name_col = detect_business_name_column(pool)
        .await
        .unwrap_or_else(|| "name".to_string());
    let query = format!(
        "SELECT s.id, COALESCE(b.{workspace_name_col}, 'Unknown'), COALESCE(s.status, 'OPEN'),
                COALESCE(s.matched_count, 0), COALESCE(s.created_at, datetime('now'))
         FROM core_reconciliationsession s
         LEFT JOIN core_business b ON b.id = s.business_id
         ORDER BY datetime(s.created_at) DESC
         LIMIT ?",
        workspace_name_col = workspace_name_col
    );
    sqlx::query_as::<_, (i64, String, String, i64, String)>(&query)
        .bind(limit)
        .fetch_all(pool)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|(id, workspace, status, matched_count, created_at)| {
            json!({
                "id": id,
                "workspace": workspace,
                "status": status,
                "matched_count": matched_count,
                "created_at": created_at
            })
        })
        .collect()
}

async fn fetch_unbalanced_entries(pool: &SqlitePool, limit: i64) -> Vec<Value> {
    if !table_exists(pool, "core_journalentry").await
        || !column_exists(pool, "core_journalentry", "debit_total").await
        || !column_exists(pool, "core_journalentry", "credit_total").await
    {
        return Vec::new();
    }
    let query = "SELECT
            j.id,
            COALESCE(b.name, 'Unknown') as workspace_name,
            COALESCE(j.date, j.created_at) as entry_date,
            COALESCE(j.description, '') as description,
            COALESCE(j.debit_total, 0.0) as debit_total,
            COALESCE(j.credit_total, 0.0) as credit_total
         FROM core_journalentry j
         LEFT JOIN core_business b ON b.id = j.business_id
         WHERE abs(COALESCE(j.debit_total, 0.0) - COALESCE(j.credit_total, 0.0)) > 0.009
         ORDER BY abs(COALESCE(j.debit_total, 0.0) - COALESCE(j.credit_total, 0.0)) DESC
         LIMIT ?";
    sqlx::query_as::<_, (i64, String, Option<String>, String, f64, f64)>(query)
        .bind(limit)
        .fetch_all(pool)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|(id, workspace, date, description, debit_total, credit_total)| {
            let difference = (debit_total - credit_total).abs();
            json!({
                "id": id,
                "workspace": workspace,
                "date": date,
                "description": description,
                "debit_total": debit_total,
                "credit_total": credit_total,
                "difference": difference
            })
        })
        .collect()
}

async fn fetch_orphan_accounts(pool: &SqlitePool, limit: i64) -> Vec<Value> {
    if !table_exists(pool, "core_account").await {
        return Vec::new();
    }
    let has_code = column_exists(pool, "core_account", "code").await;
    let has_name = column_exists(pool, "core_account", "name").await;
    if !has_name {
        return Vec::new();
    }
    let query = if table_exists(pool, "core_journalentryline").await
        && column_exists(pool, "core_journalentryline", "account_id").await
    {
        "SELECT a.id, COALESCE(a.code, ''), a.name, COALESCE(b.name, 'Unknown')
         FROM core_account a
         LEFT JOIN core_business b ON b.id = a.business_id
         LEFT JOIN core_journalentryline l ON l.account_id = a.id
         GROUP BY a.id, a.code, a.name, b.name
         HAVING COUNT(l.id) = 0
         ORDER BY a.id DESC
         LIMIT ?"
    } else {
        "SELECT a.id, COALESCE(a.code, ''), a.name, COALESCE(b.name, 'Unknown')
         FROM core_account a
         LEFT JOIN core_business b ON b.id = a.business_id
         ORDER BY a.id DESC
         LIMIT ?"
    };
    sqlx::query_as::<_, (i64, String, String, String)>(query)
        .bind(limit)
        .fetch_all(pool)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|(id, code, name, workspace)| {
            json!({
                "id": id,
                "code": if has_code { code } else { "".to_string() },
                "name": name,
                "workspace": workspace
            })
        })
        .collect()
}

async fn fetch_suspense_balances(pool: &SqlitePool, limit: i64) -> Vec<Value> {
    if !table_exists(pool, "core_account").await {
        return Vec::new();
    }
    let balance_col = if column_exists(pool, "core_account", "balance").await {
        "balance"
    } else {
        "0"
    };
    let query = format!(
        "SELECT a.id, COALESCE(a.code, ''), COALESCE(a.name, ''), COALESCE(b.name, 'Unknown'), COALESCE(a.{balance_col}, 0.0)
         FROM core_account a
         LEFT JOIN core_business b ON b.id = a.business_id
         WHERE lower(COALESCE(a.name, '')) LIKE '%suspense%'
            OR lower(COALESCE(a.code, '')) LIKE '%suspense%'
         ORDER BY abs(COALESCE(a.{balance_col}, 0.0)) DESC
         LIMIT ?",
        balance_col = balance_col
    );
    sqlx::query_as::<_, (i64, String, String, String, f64)>(&query)
        .bind(limit)
        .fetch_all(pool)
        .await
        .unwrap_or_default()
        .into_iter()
        .filter(|(_, _, _, _, balance)| balance.abs() > 0.00001)
        .map(|(id, code, name, workspace, balance)| {
            json!({
                "id": id,
                "code": code,
                "name": name,
                "workspace": workspace,
                "balance": balance
            })
        })
        .collect()
}

async fn invoice_status_distribution(pool: &SqlitePool) -> BTreeMap<String, i64> {
    let mut map = BTreeMap::new();
    if !table_exists(pool, "core_invoice").await || !column_exists(pool, "core_invoice", "status").await {
        return map;
    }
    let rows = sqlx::query_as::<_, (Option<String>, i64)>(
        "SELECT upper(COALESCE(status, 'UNKNOWN')), COUNT(*) FROM core_invoice GROUP BY upper(COALESCE(status, 'UNKNOWN'))",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();
    for (status, count) in rows {
        map.insert(status.unwrap_or_else(|| "UNKNOWN".to_string()), count);
    }
    map
}

async fn invoice_recent_issues(pool: &SqlitePool, limit: i64) -> Vec<Value> {
    if !table_exists(pool, "core_invoice").await {
        return Vec::new();
    }
    let query = "SELECT i.id, COALESCE(b.name, 'Unknown'), COALESCE(c.name, 'Unknown'),
                        upper(COALESCE(i.status, 'UNKNOWN')), COALESCE(i.grand_total, 0.0),
                        COALESCE(i.created_at, i.issue_date)
                 FROM core_invoice i
                 LEFT JOIN core_business b ON b.id = i.business_id
                 LEFT JOIN core_customer c ON c.id = i.customer_id
                 WHERE upper(COALESCE(i.status, 'UNKNOWN')) NOT IN ('DRAFT', 'SENT', 'PARTIAL', 'PAID')
                 ORDER BY datetime(COALESCE(i.created_at, i.issue_date)) DESC
                 LIMIT ?";
    sqlx::query_as::<_, (i64, String, String, String, f64, Option<String>)>(query)
        .bind(limit)
        .fetch_all(pool)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|(id, workspace, customer, status, total, created_at)| {
            json!({
                "id": id,
                "workspace": workspace,
                "customer": customer,
                "status": status,
                "total": total,
                "created_at": created_at
            })
        })
        .collect()
}

async fn expense_status_distribution(pool: &SqlitePool) -> BTreeMap<String, i64> {
    let mut map = BTreeMap::new();
    if !table_exists(pool, "core_expense").await || !column_exists(pool, "core_expense", "status").await {
        return map;
    }
    let rows = sqlx::query_as::<_, (Option<String>, i64)>(
        "SELECT upper(COALESCE(status, 'UNKNOWN')), COUNT(*) FROM core_expense GROUP BY upper(COALESCE(status, 'UNKNOWN'))",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();
    for (status, count) in rows {
        map.insert(status.unwrap_or_else(|| "UNKNOWN".to_string()), count);
    }
    map
}

async fn receipt_status_distribution(pool: &SqlitePool) -> BTreeMap<String, i64> {
    let mut map = BTreeMap::new();
    if !table_exists(pool, "agentic_receipt_run_item").await
        || !column_exists(pool, "agentic_receipt_run_item", "status").await
    {
        return map;
    }
    let rows = sqlx::query_as::<_, (Option<String>, i64)>(
        "SELECT upper(COALESCE(status, 'UNKNOWN')), COUNT(*) FROM agentic_receipt_run_item GROUP BY upper(COALESCE(status, 'UNKNOWN'))",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();
    for (status, count) in rows {
        map.insert(status.unwrap_or_else(|| "UNKNOWN".to_string()), count);
    }
    map
}

async fn top_expense_workspaces(pool: &SqlitePool, limit: i64) -> Vec<Value> {
    if !table_exists(pool, "core_expense").await || !table_exists(pool, "core_business").await {
        return Vec::new();
    }
    let name_col = detect_business_name_column(pool)
        .await
        .unwrap_or_else(|| "name".to_string());
    let query = format!(
        "SELECT b.id, COALESCE(b.{name_col}, 'Unknown'), COUNT(e.id), COALESCE(SUM(COALESCE(e.grand_total, 0.0)), 0.0)
         FROM core_expense e
         JOIN core_business b ON b.id = e.business_id
         GROUP BY b.id, b.{name_col}
         ORDER BY COUNT(e.id) DESC
         LIMIT ?",
        name_col = name_col
    );
    sqlx::query_as::<_, (i64, String, i64, f64)>(&query)
        .bind(limit)
        .fetch_all(pool)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|(id, name, count, total)| {
            json!({
                "id": id,
                "name": name,
                "count": count,
                "total": total
            })
        })
        .collect()
}

fn employee_row_to_json(row: &EmployeeRow) -> Value {
    let workspace_scope = parse_payload_value(&row.workspace_scope_json);
    let invite_status = row
        .invite_status
        .as_deref()
        .map(|value| value.to_ascii_lowercase())
        .or_else(|| row.invite_token.as_ref().map(|_| "pending".to_string()));
    let manager = row
        .manager_id
        .map(|manager_id| {
            json!({
                "id": manager_id,
                "name": row.manager_name.clone().unwrap_or_else(|| format!("Employee #{}", manager_id)),
                "email": row.manager_email
            })
        })
        .unwrap_or(Value::Null);
    let invite = match invite_status.as_deref() {
        Some("pending") => {
            let normalized = if is_expired_timestamp(row.invite_expires_at.as_deref()) {
                "expired"
            } else {
                "pending"
            };
            json!({
                "id": row.invite_id,
                "status": normalized,
                "invited_at": row.invite_invited_at,
                "expires_at": row.invite_expires_at,
                "invite_url": row.invite_url,
                "email_send_failed": row.invite_email_send_failed > 0,
                "email_last_error": row.invite_email_last_error
            })
        }
        Some("expired") | Some("revoked") => json!({
            "id": row.invite_id,
            "status": "expired",
            "invited_at": row.invite_invited_at,
            "expires_at": row.invite_expires_at,
            "invite_url": row.invite_url,
            "email_send_failed": row.invite_email_send_failed > 0,
            "email_last_error": row.invite_email_last_error
        }),
        _ => Value::Null,
    };

    json!({
        "id": row.id,
        "user_id": row.user_id,
        "name": row.name,
        "email": row.email,
        "title": row.title,
        "department": row.department,
        "admin_panel_access": row.admin_panel_access > 0,
        "primary_admin_role": row.primary_admin_role,
        "is_active_employee": row.is_active_employee > 0,
        "last_login": row.last_login,
        "workspace_scope": if workspace_scope.is_object() { workspace_scope } else { json!({}) },
        "invite": invite,
        "manager": manager,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "recent_admin_actions": []
    })
}

async fn basic_user_select_sql(pool: &SqlitePool) -> Result<String, sqlx::Error> {
    let username_expr = if column_exists(pool, "auth_user", "username").await {
        "username".to_string()
    } else {
        "NULL".to_string()
    };
    let first_name_expr = if column_exists(pool, "auth_user", "first_name").await {
        "first_name".to_string()
    } else {
        "NULL".to_string()
    };
    let last_name_expr = if column_exists(pool, "auth_user", "last_name").await {
        "last_name".to_string()
    } else {
        "NULL".to_string()
    };
    let date_joined_expr = if column_exists(pool, "auth_user", "date_joined").await {
        "date_joined".to_string()
    } else if column_exists(pool, "auth_user", "created_at").await {
        "created_at".to_string()
    } else {
        "NULL".to_string()
    };
    let last_login_expr = if column_exists(pool, "auth_user", "last_login").await {
        "last_login".to_string()
    } else {
        "NULL".to_string()
    };
    let role_expr = match detect_auth_user_role_column(pool).await? {
        Some(column) => column,
        None => "NULL".to_string(),
    };
    let password_expr = if column_exists(pool, "auth_user", "password").await {
        "CASE WHEN COALESCE(password, '') != '' THEN 1 ELSE 0 END".to_string()
    } else {
        "0".to_string()
    };

    Ok(format!(
        "SELECT
            id,
            email,
            {username_expr} as username,
            {first_name_expr} as first_name,
            {last_name_expr} as last_name,
            {date_joined_expr} as date_joined,
            {last_login_expr} as last_login,
            COALESCE(is_active, 0) as is_active,
            COALESCE(is_staff, 0) as is_staff,
            COALESCE(is_superuser, 0) as is_superuser,
            {role_expr} as admin_role,
            {password_expr} as has_usable_password
         FROM auth_user"
    ))
}

async fn fetch_basic_users(
    pool: &SqlitePool,
    search: Option<&str>,
    status: Option<&str>,
) -> Result<Vec<BasicUserRow>, sqlx::Error> {
    if !table_exists(pool, "auth_user").await {
        return Ok(Vec::new());
    }

    let query = format!("{} ORDER BY id DESC", basic_user_select_sql(pool).await?);
    let mut rows = sqlx::query_as::<_, BasicUserRow>(&query)
        .fetch_all(pool)
        .await?;

    if let Some(search) = search {
        rows.retain(|row| {
            let haystacks = [
                row.email.as_str(),
                row.username.as_deref().unwrap_or(""),
                row.first_name.as_deref().unwrap_or(""),
                row.last_name.as_deref().unwrap_or(""),
                row.admin_role.as_deref().unwrap_or(""),
            ];
            haystacks
                .iter()
                .any(|value| value.to_ascii_lowercase().contains(search))
        });
    }

    if let Some(status) = status {
        rows.retain(|row| match status {
            "active" => row.is_active > 0,
            "inactive" | "disabled" => row.is_active <= 0,
            "staff" => row.is_staff > 0,
            "superuser" => row.is_superuser > 0,
            _ => true,
        });
    }

    Ok(rows)
}

async fn workspace_count_map(pool: &SqlitePool, user_ids: &[i64]) -> HashMap<i64, i64> {
    let mut map = HashMap::new();
    if user_ids.is_empty() || !table_exists(pool, "core_business").await {
        return map;
    }

    let Some(owner_col) = detect_business_owner_column(pool).await else {
        return map;
    };

    let placeholders = vec!["?"; user_ids.len()].join(", ");
    let mut query = format!(
        "SELECT {owner_col}, COUNT(*)
         FROM core_business
         WHERE {owner_col} IN ({placeholders})",
    );
    if column_exists(pool, "core_business", "is_deleted").await {
        query.push_str(" AND COALESCE(is_deleted, 0) = 0");
    }
    query.push_str(&format!(" GROUP BY {owner_col}"));

    let mut stmt = sqlx::query_as::<_, (i64, i64)>(&query);
    for user_id in user_ids {
        stmt = stmt.bind(*user_id);
    }

    for (user_id, count) in stmt.fetch_all(pool).await.unwrap_or_default() {
        map.insert(user_id, count);
    }
    map
}

async fn social_provider_map(pool: &SqlitePool, user_ids: &[i64]) -> HashMap<i64, Vec<String>> {
    let mut map = HashMap::new();
    if user_ids.is_empty()
        || !table_exists(pool, "socialaccount_socialaccount").await
        || !column_exists(pool, "socialaccount_socialaccount", "user_id").await
        || !column_exists(pool, "socialaccount_socialaccount", "provider").await
    {
        return map;
    }

    let placeholders = vec!["?"; user_ids.len()].join(", ");
    let query = format!(
        "SELECT user_id, lower(COALESCE(provider, ''))
         FROM socialaccount_socialaccount
         WHERE user_id IN ({placeholders})"
    );
    let mut stmt = sqlx::query_as::<_, (i64, String)>(&query);
    for user_id in user_ids {
        stmt = stmt.bind(*user_id);
    }

    for (user_id, provider) in stmt.fetch_all(pool).await.unwrap_or_default() {
        if provider.trim().is_empty() {
            continue;
        }
        map.entry(user_id).or_default().push(provider);
    }

    for providers in map.values_mut() {
        providers.sort();
        providers.dedup();
    }
    map
}

async fn load_basic_user_by_id(
    pool: &SqlitePool,
    user_id: i64,
) -> Result<Option<BasicUserRow>, sqlx::Error> {
    if !table_exists(pool, "auth_user").await {
        return Ok(None);
    }

    let query = format!("{} WHERE id = ? LIMIT 1", basic_user_select_sql(pool).await?);
    sqlx::query_as::<_, BasicUserRow>(&query)
        .bind(user_id)
        .fetch_optional(pool)
        .await
}

async fn create_admin_approval_request(
    pool: &SqlitePool,
    principal: &AdminPrincipal,
    action_type: &str,
    reason: &str,
    workspace_id: Option<i64>,
    target_user_id: Option<i64>,
    payload: &Value,
    req: &RequestContext,
) -> Result<String, sqlx::Error> {
    let approval_id = Uuid::new_v4().to_string();
    let expires_at = minutes_from_now(APPROVAL_DEFAULT_EXPIRY_HOURS * 60);
    let normalized_action = normalize_action_type(action_type).unwrap_or_else(|| action_type.to_string());
    let payload_json = if payload.is_object() {
        payload.to_string()
    } else {
        json!({}).to_string()
    };

    let mut tx = pool.begin().await?;
    sqlx::query(
        "INSERT INTO admin_approval_requests (
            id, action_type, status, initiator_user_id, approver_user_id, workspace_id, target_user_id,
            reason, rejection_reason, payload_json, execution_error, created_at, resolved_at, expires_at, updated_at
         ) VALUES (?, ?, 'PENDING', ?, NULL, ?, ?, ?, NULL, ?, NULL, datetime('now'), NULL, ?, datetime('now'))",
    )
    .bind(&approval_id)
    .bind(&normalized_action)
    .bind(principal.user_id)
    .bind(workspace_id)
    .bind(target_user_id)
    .bind(reason)
    .bind(&payload_json)
    .bind(&expires_at)
    .execute(&mut *tx)
    .await?;

    let details = json!({
        "action_type": normalized_action,
        "workspace_id": workspace_id,
        "target_user_id": target_user_id
    });
    insert_audit_event(
        &mut *tx,
        &req.request_id,
        "approval.request.create",
        "created",
        principal,
        "approval_request",
        &approval_id,
        Some(reason),
        req.ip_address.as_deref(),
        req.user_agent.as_deref(),
        &details,
    )
    .await?;

    tx.commit().await?;
    Ok(approval_id)
}

async fn build_user_payload(pool: &SqlitePool, row: &BasicUserRow) -> Value {
    let workspace_count = workspace_count_map(pool, &[row.id])
        .await
        .get(&row.id)
        .copied()
        .unwrap_or(0);
    let mut providers = social_provider_map(pool, &[row.id])
        .await
        .remove(&row.id)
        .unwrap_or_default();
    if row.has_usable_password > 0 && !providers.iter().any(|provider| provider == "password") {
        providers.push("password".to_string());
    }
    providers.sort();
    providers.dedup();
    let has_google = providers.iter().any(|provider| provider.eq_ignore_ascii_case("google"));
    let full_name = match (&row.first_name, &row.last_name) {
        (Some(first), Some(last)) if !first.is_empty() || !last.is_empty() => {
            format!("{} {}", first, last).trim().to_string()
        }
        (Some(first), _) if !first.is_empty() => first.clone(),
        (_, Some(last)) if !last.is_empty() => last.clone(),
        _ => row.email.clone(),
    };

    json!({
        "id": row.id,
        "email": row.email,
        "username": row.username,
        "first_name": row.first_name,
        "last_name": row.last_name,
        "full_name": full_name,
        "date_joined": row.date_joined,
        "is_active": row.is_active > 0,
        "admin_role": row.admin_role,
        "last_login": row.last_login,
        "is_staff": row.is_staff > 0,
        "is_superuser": row.is_superuser > 0,
        "workspace_count": workspace_count,
        "has_usable_password": row.has_usable_password > 0,
        "auth_providers": providers,
        "has_google_login": has_google,
        "social_account_count": providers
            .iter()
            .filter(|provider| provider.as_str() != "password")
            .count()
    })
}

async fn workspace_select_sql(pool: &SqlitePool) -> String {
    let name_col = detect_business_name_column(pool)
        .await
        .unwrap_or_else(|| "name".to_string());
    let owner_col = detect_business_owner_column(pool).await;
    let plan_col = detect_business_plan_column(pool).await;
    let status_col = if column_exists(pool, "core_business", "status").await {
        Some("status".to_string())
    } else if column_exists(pool, "core_business", "state").await {
        Some("state".to_string())
    } else {
        None
    };
    let is_deleted_expr = if column_exists(pool, "core_business", "is_deleted").await {
        "COALESCE(b.is_deleted, 0)".to_string()
    } else {
        "0".to_string()
    };
    let created_at_expr = if column_exists(pool, "core_business", "created_at").await {
        "b.created_at".to_string()
    } else {
        "NULL".to_string()
    };

    let has_auth_user = table_exists(pool, "auth_user").await;
    let owner_join = if owner_col.is_some() && has_auth_user {
        format!(
            "LEFT JOIN auth_user u ON u.id = b.{}",
            owner_col.clone().unwrap_or_default()
        )
    } else {
        String::new()
    };
    let owner_email_expr = if owner_col.is_some() && has_auth_user {
        "u.email".to_string()
    } else {
        "NULL".to_string()
    };
    let plan_expr = plan_col
        .map(|column| format!("b.{column}"))
        .unwrap_or_else(|| "NULL".to_string());
    let status_expr = status_col
        .map(|column| format!("b.{column}"))
        .unwrap_or_else(|| "NULL".to_string());

    format!(
        "SELECT
            b.id,
            COALESCE(b.{name_col}, 'Workspace #' || b.id) as name,
            {owner_email_expr} as owner_email,
            {plan_expr} as plan,
            {status_expr} as status,
            {is_deleted_expr} as is_deleted,
            {created_at_expr} as created_at
         FROM core_business b
         {owner_join}"
    )
}

async fn fetch_workspaces_rows(
    pool: &SqlitePool,
    search: Option<&str>,
) -> Result<Vec<WorkspaceRow>, sqlx::Error> {
    if !table_exists(pool, "core_business").await {
        return Ok(Vec::new());
    }

    let query = format!("{} ORDER BY b.id DESC", workspace_select_sql(pool).await);
    let mut rows = sqlx::query_as::<_, WorkspaceRow>(&query)
        .fetch_all(pool)
        .await?;

    if let Some(search) = search {
        rows.retain(|row| {
            let haystacks = [
                row.name.as_str(),
                row.owner_email.as_deref().unwrap_or(""),
                row.plan.as_deref().unwrap_or(""),
                row.status.as_deref().unwrap_or(""),
            ];
            haystacks
                .iter()
                .any(|value| value.to_ascii_lowercase().contains(search))
        });
    }

    Ok(rows)
}

async fn unreconciled_counts_for_workspaces(
    pool: &SqlitePool,
    workspace_ids: &[i64],
) -> HashMap<i64, i64> {
    let mut map = HashMap::new();
    if workspace_ids.is_empty() || !table_exists(pool, "core_banktransaction").await {
        return map;
    }

    let unresolved_condition = if column_exists(pool, "core_banktransaction", "is_reconciled").await {
        "COALESCE(t.is_reconciled, 0) = 0".to_string()
    } else {
        "upper(COALESCE(t.status, 'NEW')) IN ('NEW', 'UNMATCHED', 'UNRECONCILED')".to_string()
    };
    let placeholders = vec!["?"; workspace_ids.len()].join(", ");

    let query = if table_exists(pool, "core_bankaccount").await
        && column_exists(pool, "core_bankaccount", "business_id").await
        && column_exists(pool, "core_banktransaction", "bank_account_id").await
    {
        format!(
            "SELECT a.business_id, COUNT(*)
             FROM core_banktransaction t
             JOIN core_bankaccount a ON a.id = t.bank_account_id
             WHERE {unresolved_condition}
               AND a.business_id IN ({placeholders})
             GROUP BY a.business_id"
        )
    } else if column_exists(pool, "core_banktransaction", "business_id").await {
        format!(
            "SELECT t.business_id, COUNT(*)
             FROM core_banktransaction t
             WHERE {unresolved_condition}
               AND t.business_id IN ({placeholders})
             GROUP BY t.business_id"
        )
    } else {
        return map;
    };

    let mut stmt = sqlx::query_as::<_, (i64, i64)>(&query);
    for workspace_id in workspace_ids {
        stmt = stmt.bind(*workspace_id);
    }

    for (workspace_id, count) in stmt.fetch_all(pool).await.unwrap_or_default() {
        map.insert(workspace_id, count);
    }
    map
}

async fn ledger_status_for_workspaces(
    pool: &SqlitePool,
    workspace_ids: &[i64],
) -> HashMap<i64, String> {
    let mut map = HashMap::new();
    if workspace_ids.is_empty()
        || !table_exists(pool, "core_journalentry").await
        || !column_exists(pool, "core_journalentry", "business_id").await
        || !column_exists(pool, "core_journalentry", "debit_total").await
        || !column_exists(pool, "core_journalentry", "credit_total").await
    {
        return map;
    }

    let placeholders = vec!["?"; workspace_ids.len()].join(", ");
    let query = format!(
        "SELECT business_id,
                SUM(CASE WHEN abs(COALESCE(debit_total, 0.0) - COALESCE(credit_total, 0.0)) > 0.009 THEN 1 ELSE 0 END)
         FROM core_journalentry
         WHERE business_id IN ({placeholders})
         GROUP BY business_id"
    );
    let mut stmt = sqlx::query_as::<_, (i64, i64)>(&query);
    for workspace_id in workspace_ids {
        stmt = stmt.bind(*workspace_id);
    }

    for (workspace_id, count) in stmt.fetch_all(pool).await.unwrap_or_default() {
        map.insert(
            workspace_id,
            if count > 0 {
                "unbalanced".to_string()
            } else {
                "balanced".to_string()
            },
        );
    }
    map
}

async fn load_workspace_row(
    pool: &SqlitePool,
    workspace_id: i64,
) -> Result<Option<WorkspaceRow>, sqlx::Error> {
    if !table_exists(pool, "core_business").await {
        return Ok(None);
    }

    let query = format!("{} WHERE b.id = ? LIMIT 1", workspace_select_sql(pool).await);
    sqlx::query_as::<_, WorkspaceRow>(&query)
        .bind(workspace_id)
        .fetch_optional(pool)
        .await
}

async fn workspace_payload(pool: &SqlitePool, row: &WorkspaceRow) -> Value {
    let unreconciled_count = unreconciled_counts_for_workspaces(pool, &[row.id])
        .await
        .get(&row.id)
        .copied()
        .unwrap_or(0);
    let ledger_status = ledger_status_for_workspaces(pool, &[row.id])
        .await
        .remove(&row.id)
        .unwrap_or_else(|| "balanced".to_string());

    json!({
        "id": row.id,
        "name": row.name,
        "owner_email": row.owner_email,
        "plan": row.plan,
        "status": normalize_workspace_status(row.status.as_deref(), row.is_deleted > 0),
        "is_deleted": row.is_deleted > 0,
        "created_at": row.created_at,
        "bank_setup_completed": Value::Null,
        "unreconciled_count": unreconciled_count,
        "ledger_status": ledger_status
    })
}

async fn update_workspace_record(
    pool: &SqlitePool,
    workspace_id: i64,
    body: &WorkspacePatchBody,
) -> Result<WorkspaceRow, sqlx::Error> {
    let Some(current) = load_workspace_row(pool, workspace_id).await? else {
        return Err(sqlx::Error::RowNotFound);
    };

    let name_col = detect_business_name_column(pool)
        .await
        .unwrap_or_else(|| "name".to_string());
    let plan_col = detect_business_plan_column(pool).await;
    let status_col = if column_exists(pool, "core_business", "status").await {
        Some("status".to_string())
    } else if column_exists(pool, "core_business", "state").await {
        Some("state".to_string())
    } else {
        None
    };
    let has_deleted_col = column_exists(pool, "core_business", "is_deleted").await;
    let has_updated_at = column_exists(pool, "core_business", "updated_at").await;

    let mut builder = QueryBuilder::<Sqlite>::new("UPDATE core_business SET ");
    let mut changed = false;
    {
        let mut separated = builder.separated(", ");

        if let Some(name) = body.name.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
            separated.push(name_col.as_str());
            separated.push(" = ");
            separated.push_bind(name.to_string());
            changed = true;
        }

        if body.plan.is_some() {
            if let Some(plan_col) = plan_col.as_deref() {
                let plan = body
                    .plan
                    .clone()
                    .flatten()
                    .map(|value| value.trim().to_string())
                    .filter(|value| !value.is_empty());
                separated.push(plan_col);
                separated.push(" = ");
                separated.push_bind(plan);
                changed = true;
            }
        }

        if let Some(status_col) = status_col.as_deref() {
            if let Some(status) = body.status.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
                separated.push(status_col);
                separated.push(" = ");
                separated.push_bind(status.to_string());
                changed = true;
            }
        }

        if has_deleted_col {
            if let Some(is_deleted) = body.is_deleted {
                separated.push("is_deleted = ");
                separated.push_bind(if is_deleted { 1 } else { 0 });
                changed = true;
            }
        }

        if changed && has_updated_at {
            separated.push("updated_at = datetime('now')");
        }
    }

    if changed {
        builder.push(" WHERE id = ");
        builder.push_bind(workspace_id);
        builder.build().execute(pool).await?;
    }

    load_workspace_row(pool, workspace_id)
        .await?
        .ok_or(sqlx::Error::RowNotFound)
        .or(Ok(current))
}

async fn build_workspace_360_payload(
    pool: &SqlitePool,
    workspace_id: i64,
) -> Result<Option<Value>, sqlx::Error> {
    let Some(workspace) = load_workspace_row(pool, workspace_id).await? else {
        return Ok(None);
    };

    let owner_col = detect_business_owner_column(pool).await;
    let owner_id = if let Some(owner_col) = owner_col.as_deref() {
        let query = format!("SELECT {owner_col} FROM core_business WHERE id = ?");
        sqlx::query_scalar::<_, Option<i64>>(&query)
            .bind(workspace_id)
            .fetch_optional(pool)
            .await
            .unwrap_or(None)
            .flatten()
    } else {
        None
    };

    let mut owner_email = workspace.owner_email.clone();
    let mut owner_full_name: Option<String> = None;
    if let Some(owner_id) = owner_id {
        if table_exists(pool, "auth_user").await {
            let first_name_expr = if column_exists(pool, "auth_user", "first_name").await {
                "first_name".to_string()
            } else {
                "NULL".to_string()
            };
            let last_name_expr = if column_exists(pool, "auth_user", "last_name").await {
                "last_name".to_string()
            } else {
                "NULL".to_string()
            };
            let query = format!(
                "SELECT email, {first_name_expr} as first_name, {last_name_expr} as last_name
                 FROM auth_user WHERE id = ?"
            );
            if let Some(row) = sqlx::query(&query)
                .bind(owner_id)
                .fetch_optional(pool)
                .await?
            {
                owner_email = row.try_get::<Option<String>, _>("email").unwrap_or(owner_email);
                let first_name = row.try_get::<Option<String>, _>("first_name").unwrap_or(None);
                let last_name = row.try_get::<Option<String>, _>("last_name").unwrap_or(None);
                owner_full_name = match (first_name, last_name) {
                    (Some(first), Some(last)) if !first.is_empty() || !last.is_empty() => {
                        Some(format!("{} {}", first, last).trim().to_string())
                    }
                    (Some(first), _) if !first.is_empty() => Some(first),
                    (_, Some(last)) if !last.is_empty() => Some(last),
                    _ => None,
                };
            }
        }
    }

    let has_bank_accounts = table_exists(pool, "core_bankaccount").await
        && column_exists(pool, "core_bankaccount", "business_id").await;
    let bank_name_expr = if column_exists(pool, "core_bankaccount", "bank_name").await {
        "a.bank_name".to_string()
    } else if column_exists(pool, "core_bankaccount", "institution_name").await {
        "a.institution_name".to_string()
    } else if column_exists(pool, "core_bankaccount", "provider_name").await {
        "a.provider_name".to_string()
    } else {
        "'Unknown bank'".to_string()
    };
    let account_name_expr = if column_exists(pool, "core_bankaccount", "name").await {
        "a.name".to_string()
    } else if column_exists(pool, "core_bankaccount", "nickname").await {
        "a.nickname".to_string()
    } else if column_exists(pool, "core_bankaccount", "label").await {
        "a.label".to_string()
    } else {
        "'Account #' || a.id".to_string()
    };
    let is_active_expr = if column_exists(pool, "core_bankaccount", "is_active").await {
        "COALESCE(a.is_active, 1)".to_string()
    } else if column_exists(pool, "core_bankaccount", "status").await {
        "CASE WHEN upper(COALESCE(a.status, 'OK')) IN ('ERROR', 'DISCONNECTED', 'FAILED', 'INACTIVE') THEN 0 ELSE 1 END".to_string()
    } else {
        "1".to_string()
    };
    let last_import_expr = if column_exists(pool, "core_bankaccount", "last_imported_at").await {
        "a.last_imported_at".to_string()
    } else if column_exists(pool, "core_bankaccount", "synced_at").await {
        "a.synced_at".to_string()
    } else if column_exists(pool, "core_bankaccount", "last_sync_at").await {
        "a.last_sync_at".to_string()
    } else if column_exists(pool, "core_bankaccount", "updated_at").await {
        "a.updated_at".to_string()
    } else {
        "NULL".to_string()
    };

    let mut banking_accounts = Vec::new();
    let mut banking_account_count = 0_i64;
    let mut banking_unreconciled = 0_i64;
    if has_bank_accounts {
        banking_account_count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM core_bankaccount WHERE business_id = ?",
        )
        .bind(workspace_id)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        let query = format!(
            "SELECT
                a.id,
                COALESCE({account_name_expr}, 'Account #' || a.id) as name,
                COALESCE({bank_name_expr}, 'Unknown bank') as bank_name,
                {is_active_expr} as is_active,
                {last_import_expr} as last_imported_at
             FROM core_bankaccount a
             WHERE a.business_id = ?
             ORDER BY a.id DESC
             LIMIT 10"
        );
        let rows = sqlx::query(&query).bind(workspace_id).fetch_all(pool).await?;
        let account_ids: Vec<i64> = rows
            .iter()
            .filter_map(|row| row.try_get::<i64, _>("id").ok())
            .collect();
        let unreconciled_map = unreconciled_counts_for_accounts(pool, &account_ids).await;
        banking_unreconciled = unreconciled_map.values().sum();
        banking_accounts = rows
            .into_iter()
            .map(|row| {
                json!({
                    "id": row.try_get::<i64, _>("id").unwrap_or_default(),
                    "name": row.try_get::<String, _>("name").unwrap_or_else(|_| "Unknown".to_string()),
                    "bank_name": row.try_get::<String, _>("bank_name").unwrap_or_else(|_| "Unknown bank".to_string()),
                    "is_active": row.try_get::<i64, _>("is_active").unwrap_or(1) > 0,
                    "last_imported_at": row.try_get::<Option<String>, _>("last_imported_at").unwrap_or(None)
                })
            })
            .collect();
    }

    let total_accounts = if table_exists(pool, "core_account").await
        && column_exists(pool, "core_account", "business_id").await
    {
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM core_account WHERE business_id = ?")
            .bind(workspace_id)
            .fetch_one(pool)
            .await
            .unwrap_or(0)
    } else {
        0
    };
    let total_entries = if table_exists(pool, "core_journalentry").await
        && column_exists(pool, "core_journalentry", "business_id").await
    {
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM core_journalentry WHERE business_id = ?")
            .bind(workspace_id)
            .fetch_one(pool)
            .await
            .unwrap_or(0)
    } else {
        0
    };
    let unbalanced_entries = if table_exists(pool, "core_journalentry").await
        && column_exists(pool, "core_journalentry", "business_id").await
        && column_exists(pool, "core_journalentry", "debit_total").await
        && column_exists(pool, "core_journalentry", "credit_total").await
    {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*)
             FROM core_journalentry
             WHERE business_id = ?
               AND abs(COALESCE(debit_total, 0.0) - COALESCE(credit_total, 0.0)) > 0.009",
        )
        .bind(workspace_id)
        .fetch_one(pool)
        .await
        .unwrap_or(0)
    } else {
        0
    };
    let orphan_accounts = 0_i64;

    let mut invoice_total = 0_i64;
    let mut invoice_draft = 0_i64;
    let mut invoice_sent = 0_i64;
    let mut invoice_paid = 0_i64;
    if table_exists(pool, "core_invoice").await
        && column_exists(pool, "core_invoice", "business_id").await
        && column_exists(pool, "core_invoice", "status").await
    {
        let rows = sqlx::query_as::<_, (Option<String>, i64)>(
            "SELECT upper(COALESCE(status, 'UNKNOWN')), COUNT(*)
             FROM core_invoice
             WHERE business_id = ?
             GROUP BY upper(COALESCE(status, 'UNKNOWN'))",
        )
        .bind(workspace_id)
        .fetch_all(pool)
        .await
        .unwrap_or_default();
        for (status, count) in rows {
            invoice_total += count;
            match status.unwrap_or_else(|| "UNKNOWN".to_string()).as_str() {
                "DRAFT" => invoice_draft += count,
                "SENT" | "PARTIAL" => invoice_sent += count,
                "PAID" => invoice_paid += count,
                _ => {}
            }
        }
    }

    let expense_amount_col = if column_exists(pool, "core_expense", "grand_total").await {
        Some("grand_total")
    } else if column_exists(pool, "core_expense", "total").await {
        Some("total")
    } else if column_exists(pool, "core_expense", "amount").await {
        Some("amount")
    } else {
        None
    };
    let expense_total = if table_exists(pool, "core_expense").await
        && column_exists(pool, "core_expense", "business_id").await
    {
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM core_expense WHERE business_id = ?")
            .bind(workspace_id)
            .fetch_one(pool)
            .await
            .unwrap_or(0)
    } else {
        0
    };
    let expense_uncategorized = if table_exists(pool, "core_expense").await
        && column_exists(pool, "core_expense", "business_id").await
        && column_exists(pool, "core_expense", "category_id").await
    {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM core_expense WHERE business_id = ? AND category_id IS NULL",
        )
        .bind(workspace_id)
        .fetch_one(pool)
        .await
        .unwrap_or(0)
    } else {
        0
    };
    let expense_total_amount = if let Some(amount_col) = expense_amount_col {
        let query = format!(
            "SELECT COALESCE(SUM(COALESCE({amount_col}, 0.0)), 0.0)
             FROM core_expense WHERE business_id = ?"
        );
        sqlx::query_scalar::<_, f64>(&query)
            .bind(workspace_id)
            .fetch_one(pool)
            .await
            .unwrap_or(0.0)
    } else {
        0.0
    };

    let tax_last_period = Value::Null;
    let mut tax_open_high = 0_i64;
    let mut tax_open_medium = 0_i64;
    let mut tax_open_low = 0_i64;
    let mut open_ai_flags = 0_i64;
    for table in ["tax_anomaly", "core_tax_anomaly", "tax_guardian_anomaly"] {
        if !table_exists(pool, table).await
            || !column_exists(pool, table, "severity").await
            || !column_exists(pool, table, "status").await
        {
            continue;
        }
        let scope_col = if column_exists(pool, table, "business_id").await {
            Some("business_id")
        } else if column_exists(pool, table, "workspace_id").await {
            Some("workspace_id")
        } else {
            None
        };
        if let Some(scope_col) = scope_col {
            let query = format!(
                "SELECT lower(COALESCE(severity, 'low')), COUNT(*)
                 FROM {table}
                 WHERE {scope_col} = ?
                   AND upper(COALESCE(status, 'OPEN')) IN ('OPEN', 'PENDING', 'NEW')
                 GROUP BY lower(COALESCE(severity, 'low'))"
            );
            for (severity, count) in sqlx::query_as::<_, (String, i64)>(&query)
                .bind(workspace_id)
                .fetch_all(pool)
                .await
                .unwrap_or_default()
            {
                match severity.as_str() {
                    "high" => tax_open_high += count,
                    "medium" => tax_open_medium += count,
                    _ => tax_open_low += count,
                }
            }
            break;
        }
    }

    for table in ["companion_issue", "core_companion_issue", "agentic_companion_issue", "companion_issues"] {
        if !table_exists(pool, table).await || !column_exists(pool, table, "status").await {
            continue;
        }
        let scope_col = if column_exists(pool, table, "business_id").await {
            Some("business_id")
        } else if column_exists(pool, table, "workspace_id").await {
            Some("workspace_id")
        } else {
            None
        };
        if let Some(scope_col) = scope_col {
            let query = format!(
                "SELECT COUNT(*)
                 FROM {table}
                 WHERE {scope_col} = ?
                   AND upper(COALESCE(status, 'OPEN')) IN ('OPEN', 'PENDING', 'NEW')"
            );
            open_ai_flags = sqlx::query_scalar::<_, i64>(&query)
                .bind(workspace_id)
                .fetch_one(pool)
                .await
                .unwrap_or(0);
            break;
        }
    }

    Ok(Some(json!({
        "workspace": {
            "id": workspace.id,
            "name": workspace.name,
            "created_at": workspace.created_at
        },
        "owner": {
            "id": owner_id,
            "email": owner_email,
            "full_name": owner_full_name
        },
        "plan": workspace.plan,
        "banking": {
            "account_count": banking_account_count,
            "accounts": banking_accounts,
            "unreconciled_count": banking_unreconciled
        },
        "ledger_health": {
            "unbalanced_entries": unbalanced_entries,
            "orphan_accounts": orphan_accounts,
            "total_accounts": total_accounts,
            "total_entries": total_entries
        },
        "invoices": {
            "total": invoice_total,
            "draft": invoice_draft,
            "sent": invoice_sent,
            "paid": invoice_paid
        },
        "expenses": {
            "total": expense_total,
            "uncategorized": expense_uncategorized,
            "total_amount": expense_total_amount
        },
        "tax": {
            "has_tax_guardian": true,
            "last_period": tax_last_period,
            "open_anomalies": {
                "high": tax_open_high,
                "medium": tax_open_medium,
                "low": tax_open_low
            }
        },
        "ai": {
            "last_monitor_run": Value::Null,
            "open_ai_flags": open_ai_flags
        }
    })))
}

async fn fetch_admin_bank_accounts(
    pool: &SqlitePool,
    search: Option<&str>,
) -> Result<Vec<BankAccountAdminRow>, sqlx::Error> {
    if !table_exists(pool, "core_bankaccount").await {
        return Ok(Vec::new());
    }

    let workspace_name_col = detect_business_name_column(pool)
        .await
        .unwrap_or_else(|| "name".to_string());
    let owner_col = detect_business_owner_column(pool).await;
    let has_auth_user = table_exists(pool, "auth_user").await;
    let owner_join = if owner_col.is_some() && has_auth_user {
        format!(
            "LEFT JOIN auth_user u ON u.id = b.{}",
            owner_col.clone().unwrap_or_default()
        )
    } else {
        String::new()
    };
    let owner_email_expr = if owner_col.is_some() && has_auth_user {
        "u.email".to_string()
    } else {
        "NULL".to_string()
    };
    let bank_name_expr = if column_exists(pool, "core_bankaccount", "bank_name").await {
        "a.bank_name".to_string()
    } else if column_exists(pool, "core_bankaccount", "institution_name").await {
        "a.institution_name".to_string()
    } else if column_exists(pool, "core_bankaccount", "provider_name").await {
        "a.provider_name".to_string()
    } else {
        "NULL".to_string()
    };
    let account_name_expr = if column_exists(pool, "core_bankaccount", "name").await {
        "a.name".to_string()
    } else if column_exists(pool, "core_bankaccount", "nickname").await {
        "a.nickname".to_string()
    } else if column_exists(pool, "core_bankaccount", "label").await {
        "a.label".to_string()
    } else {
        "NULL".to_string()
    };
    let mask_expr = if column_exists(pool, "core_bankaccount", "account_number_mask").await {
        "a.account_number_mask".to_string()
    } else if column_exists(pool, "core_bankaccount", "last4").await {
        "'****' || a.last4".to_string()
    } else if column_exists(pool, "core_bankaccount", "masked_account_number").await {
        "a.masked_account_number".to_string()
    } else {
        "NULL".to_string()
    };
    let usage_role_expr = if column_exists(pool, "core_bankaccount", "usage_role").await {
        "a.usage_role".to_string()
    } else if column_exists(pool, "core_bankaccount", "account_type").await {
        "a.account_type".to_string()
    } else {
        "NULL".to_string()
    };
    let is_active_expr = if column_exists(pool, "core_bankaccount", "is_active").await {
        "COALESCE(a.is_active, 1)".to_string()
    } else if column_exists(pool, "core_bankaccount", "status").await {
        "CASE WHEN upper(COALESCE(a.status, 'OK')) IN ('ERROR', 'DISCONNECTED', 'FAILED', 'INACTIVE') THEN 0 ELSE 1 END".to_string()
    } else {
        "1".to_string()
    };
    let last_import_expr = if column_exists(pool, "core_bankaccount", "last_imported_at").await {
        "a.last_imported_at".to_string()
    } else if column_exists(pool, "core_bankaccount", "synced_at").await {
        "a.synced_at".to_string()
    } else if column_exists(pool, "core_bankaccount", "last_sync_at").await {
        "a.last_sync_at".to_string()
    } else if column_exists(pool, "core_bankaccount", "updated_at").await {
        "a.updated_at".to_string()
    } else {
        "NULL".to_string()
    };
    let workspace_join = if table_exists(pool, "core_business").await
        && column_exists(pool, "core_bankaccount", "business_id").await
    {
        "LEFT JOIN core_business b ON b.id = a.business_id".to_string()
    } else {
        String::new()
    };
    let workspace_name_expr = if table_exists(pool, "core_business").await
        && column_exists(pool, "core_bankaccount", "business_id").await
    {
        format!("b.{workspace_name_col}")
    } else {
        "NULL".to_string()
    };

    let query = format!(
        "SELECT
            a.id,
            {workspace_name_expr} as workspace_name,
            {owner_email_expr} as owner_email,
            {bank_name_expr} as bank_name,
            {account_name_expr} as name,
            {mask_expr} as account_number_mask,
            {usage_role_expr} as usage_role,
            {is_active_expr} as is_active,
            {last_import_expr} as last_imported_at
         FROM core_bankaccount a
         {workspace_join}
         {owner_join}
         ORDER BY a.id DESC"
    );
    let mut rows = sqlx::query_as::<_, BankAccountAdminRow>(&query)
        .fetch_all(pool)
        .await?;

    if let Some(search) = search {
        rows.retain(|row| {
            let haystacks = [
                row.workspace_name.as_deref().unwrap_or(""),
                row.owner_email.as_deref().unwrap_or(""),
                row.bank_name.as_deref().unwrap_or(""),
                row.name.as_deref().unwrap_or(""),
                row.usage_role.as_deref().unwrap_or(""),
            ];
            haystacks
                .iter()
                .any(|value| value.to_ascii_lowercase().contains(search))
        });
    }

    Ok(rows)
}

async fn unreconciled_counts_for_accounts(pool: &SqlitePool, account_ids: &[i64]) -> HashMap<i64, i64> {
    let mut map = HashMap::new();
    if account_ids.is_empty()
        || !table_exists(pool, "core_banktransaction").await
        || !column_exists(pool, "core_banktransaction", "bank_account_id").await
    {
        return map;
    }

    let unresolved_condition = if column_exists(pool, "core_banktransaction", "is_reconciled").await {
        "COALESCE(is_reconciled, 0) = 0".to_string()
    } else {
        "upper(COALESCE(status, 'NEW')) IN ('NEW', 'UNMATCHED', 'UNRECONCILED')".to_string()
    };
    let placeholders = vec!["?"; account_ids.len()].join(", ");
    let query = format!(
        "SELECT bank_account_id, COUNT(*)
         FROM core_banktransaction
         WHERE {unresolved_condition}
           AND bank_account_id IN ({placeholders})
         GROUP BY bank_account_id"
    );
    let mut stmt = sqlx::query_as::<_, (i64, i64)>(&query);
    for account_id in account_ids {
        stmt = stmt.bind(*account_id);
    }
    for (account_id, count) in stmt.fetch_all(pool).await.unwrap_or_default() {
        map.insert(account_id, count);
    }
    map
}

async fn fetch_support_ticket_rows(
    pool: &SqlitePool,
    search: Option<&str>,
    status: Option<&str>,
    priority: Option<&str>,
) -> Result<Vec<SupportTicketRow>, sqlx::Error> {
    let mut rows = sqlx::query_as::<_, SupportTicketRow>(
        "SELECT
            id,
            subject,
            status,
            priority,
            source,
            created_at,
            updated_at,
            user_email,
            workspace_name
         FROM admin_support_tickets
         ORDER BY datetime(updated_at) DESC, id DESC",
    )
    .fetch_all(pool)
    .await?;

    if let Some(status) = status {
        rows.retain(|row| row.status.eq_ignore_ascii_case(status));
    }
    if let Some(priority) = priority {
        rows.retain(|row| row.priority.eq_ignore_ascii_case(priority));
    }
    if let Some(search) = search {
        rows.retain(|row| {
            let haystacks = [
                row.subject.as_str(),
                row.user_email.as_deref().unwrap_or(""),
                row.workspace_name.as_deref().unwrap_or(""),
                row.source.as_str(),
            ];
            haystacks
                .iter()
                .any(|value| value.to_ascii_lowercase().contains(search))
        });
    }

    Ok(rows)
}

async fn fetch_ticket_notes_map(pool: &SqlitePool, ticket_ids: &[i64]) -> HashMap<i64, Vec<Value>> {
    let mut map = HashMap::new();
    if ticket_ids.is_empty() {
        return map;
    }

    let placeholders = vec!["?"; ticket_ids.len()].join(", ");
    let query = format!(
        "SELECT id, ticket_id, admin_email, body, created_at
         FROM admin_support_ticket_notes
         WHERE ticket_id IN ({placeholders})
         ORDER BY datetime(created_at) ASC, id ASC"
    );
    let mut stmt = sqlx::query_as::<_, SupportTicketNoteRow>(&query);
    for ticket_id in ticket_ids {
        stmt = stmt.bind(*ticket_id);
    }

    for row in stmt.fetch_all(pool).await.unwrap_or_default() {
        map.entry(row.ticket_id).or_default().push(json!({
            "id": row.id,
            "admin_email": row.admin_email,
            "body": row.body,
            "created_at": row.created_at
        }));
    }
    map
}

async fn lookup_user_email(pool: &SqlitePool, user_id: i64) -> Option<String> {
    if !table_exists(pool, "auth_user").await {
        return None;
    }
    sqlx::query_scalar::<_, String>("SELECT email FROM auth_user WHERE id = ?")
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
}

async fn lookup_workspace_name(pool: &SqlitePool, workspace_id: i64) -> Option<String> {
    load_workspace_row(pool, workspace_id)
        .await
        .ok()
        .flatten()
        .map(|row| row.name)
}

async fn fetch_support_ticket_by_id(
    pool: &SqlitePool,
    ticket_id: i64,
) -> Result<Option<Value>, sqlx::Error> {
    let row = sqlx::query_as::<_, SupportTicketRow>(
        "SELECT
            id,
            subject,
            status,
            priority,
            source,
            created_at,
            updated_at,
            user_email,
            workspace_name
         FROM admin_support_tickets
         WHERE id = ?",
    )
    .bind(ticket_id)
    .fetch_optional(pool)
    .await?;

    let Some(row) = row else {
        return Ok(None);
    };
    let notes = fetch_ticket_notes_map(pool, &[ticket_id])
        .await
        .remove(&ticket_id)
        .unwrap_or_default();
    Ok(Some(json!({
        "id": row.id,
        "subject": row.subject,
        "status": row.status,
        "priority": row.priority,
        "source": row.source,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "user_email": row.user_email,
        "workspace_name": row.workspace_name,
        "notes": notes
    })))
}

fn feature_flag_to_json(row: &FeatureFlagRow) -> Value {
    json!({
        "id": row.id,
        "key": row.key,
        "label": row.label,
        "description": row.description,
        "is_enabled": row.is_enabled > 0,
        "rollout_percent": row.rollout_percent,
        "is_critical": row.is_critical > 0,
        "created_at": row.created_at,
        "updated_at": row.updated_at
    })
}

async fn employee_select_sql(pool: &SqlitePool) -> String {
    let has_auth_user = table_exists(pool, "auth_user").await;
    let auth_join = if has_auth_user {
        "LEFT JOIN auth_user u ON u.id = e.user_id".to_string()
    } else {
        String::new()
    };
    let manager_join = "LEFT JOIN admin_employees m ON m.id = e.manager_id AND m.deleted_at IS NULL";
    let last_login_expr = if has_auth_user && column_exists(pool, "auth_user", "last_login").await {
        "COALESCE(u.last_login, e.last_login)".to_string()
    } else {
        "e.last_login".to_string()
    };

    format!(
        "SELECT
            e.id,
            e.user_id,
            e.name,
            e.email,
            e.title,
            e.department,
            e.admin_panel_access,
            e.primary_admin_role,
            e.is_active_employee,
            {last_login_expr} as last_login,
            e.workspace_scope_json,
            e.manager_id,
            m.name as manager_name,
            m.email as manager_email,
            e.created_at,
            e.updated_at,
            e.invite_id,
            e.invite_status,
            e.invite_token,
            e.invite_invited_at,
            e.invite_expires_at,
            e.invite_url,
            e.invite_email_send_failed,
            e.invite_email_last_error
         FROM admin_employees e
         {auth_join}
         {manager_join}
         WHERE e.deleted_at IS NULL"
    )
}

async fn fetch_employee_rows(
    pool: &SqlitePool,
    search: Option<&str>,
) -> Result<Vec<EmployeeRow>, sqlx::Error> {
    let query = format!("{} ORDER BY lower(e.name) ASC, e.id DESC", employee_select_sql(pool).await);
    let mut rows = sqlx::query_as::<_, EmployeeRow>(&query)
        .fetch_all(pool)
        .await?;

    if let Some(search) = search {
        rows.retain(|row| {
            let haystacks = [
                row.name.as_str(),
                row.email.as_str(),
                row.title.as_deref().unwrap_or(""),
                row.department.as_deref().unwrap_or(""),
                row.primary_admin_role.as_str(),
            ];
            haystacks
                .iter()
                .any(|value| value.to_ascii_lowercase().contains(search))
        });
    }

    Ok(rows)
}

async fn fetch_employee_by_id(
    pool: &SqlitePool,
    employee_id: i64,
) -> Result<Option<EmployeeRow>, sqlx::Error> {
    let query = format!("{} AND e.id = ? LIMIT 1", employee_select_sql(pool).await);
    sqlx::query_as::<_, EmployeeRow>(&query)
        .bind(employee_id)
        .fetch_optional(pool)
        .await
}

async fn update_employee_record(
    pool: &SqlitePool,
    employee_id: i64,
    body: &EmployeeWriteBody,
) -> Result<Option<EmployeeRow>, sqlx::Error> {
    if fetch_employee_by_id(pool, employee_id).await?.is_none() {
        return Ok(None);
    }

    let mut builder = QueryBuilder::<Sqlite>::new("UPDATE admin_employees SET ");
    let mut changed = false;
    {
        let mut separated = builder.separated(", ");

        if let Some(user_id) = body.user_id {
            separated.push("user_id = ");
            separated.push_bind(user_id);
            changed = true;
        }
        if let Some(email) = body.email.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
            separated.push("email = ");
            separated.push_bind(email.to_ascii_lowercase());
            changed = true;
        }
        if let Some(name) = body.display_name.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
            separated.push("name = ");
            separated.push_bind(name.to_string());
            changed = true;
        }
        if body.title.is_some() {
            separated.push("title = ");
            separated.push_bind(
                body.title
                    .as_deref()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_string),
            );
            changed = true;
        }
        if body.department.is_some() {
            separated.push("department = ");
            separated.push_bind(
                body.department
                    .as_deref()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_string),
            );
            changed = true;
        }
        if let Some(access) = body.admin_panel_access {
            separated.push("admin_panel_access = ");
            separated.push_bind(if access { 1 } else { 0 });
            changed = true;
        }
        if let Some(role) = body.primary_admin_role.as_deref() {
            separated.push("primary_admin_role = ");
            separated.push_bind(normalize_employee_role(Some(role)).to_string());
            changed = true;
        }
        if let Some(active) = body.is_active_employee {
            separated.push("is_active_employee = ");
            separated.push_bind(if active { 1 } else { 0 });
            changed = true;
        }
        if body.manager_id.is_some() {
            separated.push("manager_id = ");
            separated.push_bind(body.manager_id);
            changed = true;
        }
        if body.workspace_scope.is_some() {
            separated.push("workspace_scope_json = ");
            separated.push_bind(normalize_workspace_scope(body.workspace_scope.clone()));
            changed = true;
        }
        if changed {
            separated.push("updated_at = datetime('now')");
        }
    }

    if changed {
        builder.push(" WHERE id = ");
        builder.push_bind(employee_id);
        builder.build().execute(pool).await?;
    }

    fetch_employee_by_id(pool, employee_id).await
}

async fn mutate_employee_active_status(
    state: AppState,
    headers: HeaderMap,
    employee_id: i64,
    is_active: bool,
    audit_action: &str,
) -> (StatusCode, Json<Value>) {
    let req = request_context(&headers);
    let principal = match require_admin_level(&state, &headers, 2, &req.request_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };

    let employee = match fetch_employee_by_id(&state.db, employee_id).await {
        Ok(Some(value)) => value,
        Ok(None) => return api_error(StatusCode::NOT_FOUND, "employee not found", &req.request_id),
        Err(error) => {
            tracing::error!("Failed to load employee {} for active status change: {}", employee_id, error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load employee",
                &req.request_id,
            );
        }
    };

    let next_panel_access = if is_active && employee.primary_admin_role != "none" {
        1
    } else {
        0
    };
    let result = sqlx::query(
        "UPDATE admin_employees
         SET is_active_employee = ?, admin_panel_access = ?, updated_at = datetime('now')
         WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(if is_active { 1 } else { 0 })
    .bind(next_panel_access)
    .bind(employee_id)
    .execute(&state.db)
    .await;
    match result {
        Ok(value) if value.rows_affected() > 0 => {
            let details = json!({
                "employee_id": employee_id,
                "is_active_employee": is_active
            });
            if let Err(error) = insert_audit_event(
                &state.db,
                &req.request_id,
                audit_action,
                if is_active { "reactivated" } else { "suspended" },
                &principal,
                "employee",
                &employee_id.to_string(),
                None,
                req.ip_address.as_deref(),
                req.user_agent.as_deref(),
                &details,
            )
            .await
            {
                tracing::error!("Failed to write {} audit event: {}", audit_action, error);
            }

            match fetch_employee_by_id(&state.db, employee_id).await {
                Ok(Some(updated)) => (StatusCode::OK, Json(employee_row_to_json(&updated))),
                _ => api_error(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to load updated employee",
                    &req.request_id,
                ),
            }
        }
        Ok(_) => api_error(StatusCode::NOT_FOUND, "employee not found", &req.request_id),
        Err(error) => {
            tracing::error!("Failed to mutate employee {} active state: {}", employee_id, error);
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to update employee",
                &req.request_id,
            )
        }
    }
}

async fn fetch_employee_by_email(
    pool: &SqlitePool,
    email: &str,
) -> Result<Option<EmployeeRow>, sqlx::Error> {
    let query = format!("{} AND lower(e.email) = lower(?) LIMIT 1", employee_select_sql(pool).await);
    sqlx::query_as::<_, EmployeeRow>(&query)
        .bind(email)
        .fetch_optional(pool)
        .await
}

async fn mutate_employee_invite(
    state: AppState,
    headers: HeaderMap,
    employee_id: i64,
    revoke: bool,
) -> (StatusCode, Json<Value>) {
    let req = request_context(&headers);
    let principal = match require_admin_level(&state, &headers, 2, &req.request_id).await {
        Ok(value) => value,
        Err(response) => return response,
    };

    let employee = match fetch_employee_by_id(&state.db, employee_id).await {
        Ok(Some(value)) => value,
        Ok(None) => return api_error(StatusCode::NOT_FOUND, "employee not found", &req.request_id),
        Err(error) => {
            tracing::error!("Failed to load employee {} invite state: {}", employee_id, error);
            return api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load employee",
                &req.request_id,
            );
        }
    };

    if revoke {
        let result = sqlx::query(
            "UPDATE admin_employees
             SET invite_status = 'expired',
                 invite_token = NULL,
                 invite_url = NULL,
                 invite_expires_at = datetime('now'),
                 updated_at = datetime('now')
             WHERE id = ? AND deleted_at IS NULL",
        )
        .bind(employee_id)
        .execute(&state.db)
        .await;
        match result {
            Ok(value) if value.rows_affected() > 0 => {
                let details = json!({ "employee_id": employee_id });
                if let Err(error) = insert_audit_event(
                    &state.db,
                    &req.request_id,
                    "employee.invite.revoke",
                    "revoked",
                    &principal,
                    "employee",
                    &employee_id.to_string(),
                    None,
                    req.ip_address.as_deref(),
                    req.user_agent.as_deref(),
                    &details,
                )
                .await
                {
                    tracing::error!("Failed to write employee.invite.revoke audit event: {}", error);
                }
            }
            Ok(_) => {}
            Err(error) => {
                tracing::error!("Failed to revoke employee invite {}: {}", employee_id, error);
                return api_error(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to revoke invite",
                    &req.request_id,
                );
            }
        }
    } else {
        let token = Uuid::new_v4().to_string();
        let invite_id = employee
            .invite_id
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        let invite_url = format!("/internal-admin/invite/{}/", token);
        let invited_at = now_sqlite();
        let expires_at = minutes_from_now(EMPLOYEE_INVITE_EXPIRY_DAYS * 24 * 60);
        let result = sqlx::query(
            "UPDATE admin_employees
             SET invite_id = ?, invite_status = 'pending', invite_token = ?, invite_invited_at = ?,
                 invite_expires_at = ?, invite_url = ?, invite_email_send_failed = 0,
                 invite_email_last_error = NULL, is_active_employee = 0, admin_panel_access = 0,
                 updated_at = datetime('now')
             WHERE id = ? AND deleted_at IS NULL",
        )
        .bind(&invite_id)
        .bind(&token)
        .bind(&invited_at)
        .bind(&expires_at)
        .bind(&invite_url)
        .bind(employee_id)
        .execute(&state.db)
        .await;
        match result {
            Ok(value) if value.rows_affected() > 0 => {
                let details = json!({ "employee_id": employee_id, "email": employee.email });
                if let Err(error) = insert_audit_event(
                    &state.db,
                    &req.request_id,
                    "employee.invite.resend",
                    "resent",
                    &principal,
                    "employee",
                    &employee_id.to_string(),
                    None,
                    req.ip_address.as_deref(),
                    req.user_agent.as_deref(),
                    &details,
                )
                .await
                {
                    tracing::error!("Failed to write employee.invite.resend audit event: {}", error);
                }
            }
            Ok(_) => {}
            Err(error) => {
                tracing::error!("Failed to resend employee invite {}: {}", employee_id, error);
                return api_error(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to resend invite",
                    &req.request_id,
                );
            }
        }
    }

    match fetch_employee_by_id(&state.db, employee_id).await {
        Ok(Some(updated)) => (StatusCode::OK, Json(employee_row_to_json(&updated))),
        _ => api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to load updated employee",
            &req.request_id,
        ),
    }
}

async fn fetch_employee_by_invite_token(
    pool: &SqlitePool,
    token: &str,
) -> Result<Option<EmployeeRow>, sqlx::Error> {
    let query = format!("{} AND e.invite_token = ? LIMIT 1", employee_select_sql(pool).await);
    sqlx::query_as::<_, EmployeeRow>(&query)
        .bind(token)
        .fetch_optional(pool)
        .await
}

fn hash_legacy_password(password: &str) -> String {
    let iterations: u32 = 600000;
    let salt = Uuid::new_v4().to_string().replace('-', "");
    let mut derived_key = vec![0u8; 32];
    let _ = pbkdf2::<Hmac<Sha256>>(
        password.as_bytes(),
        salt.as_bytes(),
        iterations,
        &mut derived_key,
    );
    let hash_b64 = STANDARD.encode(&derived_key);
    format!("pbkdf2_sha256${}${}${}", iterations, salt, hash_b64)
}

async fn ensure_invite_user(
    pool: &SqlitePool,
    employee: &EmployeeRow,
    username: &str,
    first_name: &str,
    last_name: &str,
    email: &str,
    password: &str,
) -> Result<i64, sqlx::Error> {
    let password_hash = hash_legacy_password(password);
    let has_username = column_exists(pool, "auth_user", "username").await;
    let has_first_name = column_exists(pool, "auth_user", "first_name").await;
    let has_last_name = column_exists(pool, "auth_user", "last_name").await;
    let has_password = column_exists(pool, "auth_user", "password").await;
    let has_is_active = column_exists(pool, "auth_user", "is_active").await;
    let has_is_staff = column_exists(pool, "auth_user", "is_staff").await;
    let has_is_superuser = column_exists(pool, "auth_user", "is_superuser").await;
    let has_date_joined = column_exists(pool, "auth_user", "date_joined").await;
    let role_column = detect_auth_user_role_column(pool).await?;
    let is_superadmin = employee.primary_admin_role == "superadmin";
    let normalized_role = normalize_role_value(Some(employee.primary_admin_role.as_str()))
        .unwrap_or_else(|| "support".to_string());

    let mut final_username = username.trim().to_ascii_lowercase();
    if final_username.is_empty() {
        final_username = email
            .split('@')
            .next()
            .unwrap_or("admin-user")
            .to_ascii_lowercase();
    }
    final_username = final_username
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '_' | '.' | '-') {
                ch
            } else {
                '_'
            }
        })
        .collect();
    if final_username.is_empty() {
        final_username = "admin-user".to_string();
    }

    let existing_user = if let Some(user_id) = employee.user_id {
        sqlx::query_scalar::<_, i64>("SELECT id FROM auth_user WHERE id = ?")
            .bind(user_id)
            .fetch_optional(pool)
            .await?
    } else {
        sqlx::query_scalar::<_, i64>("SELECT id FROM auth_user WHERE lower(email) = lower(?) LIMIT 1")
            .bind(email)
            .fetch_optional(pool)
            .await?
    };

    let mut tx = pool.begin().await?;

    let user_id = if let Some(user_id) = existing_user {
        let mut builder = QueryBuilder::<Sqlite>::new("UPDATE auth_user SET ");
        {
            let mut separated = builder.separated(", ");
            separated.push("email = ");
            separated.push_bind(email.to_ascii_lowercase());
            if has_username {
                let collision = sqlx::query_scalar::<_, i64>(
                    "SELECT COUNT(*) FROM auth_user WHERE lower(username) = lower(?) AND id != ?",
                )
                .bind(&final_username)
                .bind(user_id)
                .fetch_one(&mut *tx)
                .await
                .unwrap_or(0);
                let unique_username = if collision > 0 {
                    format!("{}-{}", final_username, &Uuid::new_v4().to_string()[..8])
                } else {
                    final_username.clone()
                };
                separated.push("username = ");
                separated.push_bind(unique_username);
            }
            if has_first_name {
                separated.push("first_name = ");
                separated.push_bind(first_name.trim().to_string());
            }
            if has_last_name {
                separated.push("last_name = ");
                separated.push_bind(last_name.trim().to_string());
            }
            if has_password {
                separated.push("password = ");
                separated.push_bind(password_hash.clone());
            }
            if has_is_active {
                separated.push("is_active = ");
                separated.push_bind(1);
            }
            if has_is_staff {
                separated.push("is_staff = ");
                separated.push_bind(1);
            }
            if has_is_superuser {
                separated.push("is_superuser = ");
                separated.push_bind(if is_superadmin { 1 } else { 0 });
            }
            if let Some(role_column) = role_column.as_deref() {
                separated.push(role_column);
                separated.push(" = ");
                separated.push_bind(normalized_role.clone());
            }
        }
        builder.push(" WHERE id = ");
        builder.push_bind(user_id);
        builder.build().execute(&mut *tx).await?;
        user_id
    } else {
        let collision = if has_username {
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM auth_user WHERE lower(username) = lower(?)")
                .bind(&final_username)
                .fetch_one(&mut *tx)
                .await
                .unwrap_or(0)
        } else {
            0
        };
        let unique_username = if collision > 0 {
            format!("{}-{}", final_username, &Uuid::new_v4().to_string()[..8])
        } else {
            final_username.clone()
        };

        let mut builder = QueryBuilder::<Sqlite>::new("INSERT INTO auth_user (");
        {
            let mut columns = builder.separated(", ");
            columns.push("email");
            if has_username {
                columns.push("username");
            }
            if has_password {
                columns.push("password");
            }
            if has_first_name {
                columns.push("first_name");
            }
            if has_last_name {
                columns.push("last_name");
            }
            if has_is_active {
                columns.push("is_active");
            }
            if has_is_staff {
                columns.push("is_staff");
            }
            if has_is_superuser {
                columns.push("is_superuser");
            }
            if has_date_joined {
                columns.push("date_joined");
            }
            if let Some(role_column) = role_column.as_deref() {
                columns.push(role_column);
            }
        }
        builder.push(") VALUES (");
        {
            let mut values = builder.separated(", ");
            values.push_bind(email.to_ascii_lowercase());
            if has_username {
                values.push_bind(unique_username);
            }
            if has_password {
                values.push_bind(password_hash);
            }
            if has_first_name {
                values.push_bind(first_name.trim().to_string());
            }
            if has_last_name {
                values.push_bind(last_name.trim().to_string());
            }
            if has_is_active {
                values.push_bind(1);
            }
            if has_is_staff {
                values.push_bind(1);
            }
            if has_is_superuser {
                values.push_bind(if is_superadmin { 1 } else { 0 });
            }
            if has_date_joined {
                values.push_bind(now_sqlite());
            }
            if role_column.is_some() {
                values.push_bind(normalized_role);
            }
        }
        builder.push(")");
        let result = builder.build().execute(&mut *tx).await?;
        result.last_insert_rowid()
    };

    tx.commit().await?;
    Ok(user_id)
}

fn minutes_since(raw: &str) -> i64 {
    let parsed = chrono::DateTime::parse_from_rfc3339(raw)
        .map(|value| value.with_timezone(&Utc))
        .or_else(|_| {
            chrono::NaiveDateTime::parse_from_str(raw, "%Y-%m-%d %H:%M:%S")
                .map(|value| chrono::DateTime::<Utc>::from_naive_utc_and_offset(value, Utc))
        });
    parsed
        .map(|value| (Utc::now() - value).num_minutes().max(0))
        .unwrap_or(0)
}

fn request_context(headers: &HeaderMap) -> RequestContext {
    let request_id = headers
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let ip_address = headers
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
        .map(|value| value.split(',').next().unwrap_or("").trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|value| value.to_str().ok())
                .map(str::to_string)
        });

    let user_agent = headers
        .get("user-agent")
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);

    RequestContext {
        request_id,
        ip_address,
        user_agent,
    }
}

fn api_error(
    status: StatusCode,
    message: &str,
    request_id: &str,
) -> (StatusCode, Json<Value>) {
    (
        status,
        Json(json!({
            "ok": false,
            "error": message,
            "request_id": request_id
        })),
    )
}

async fn require_admin_level(
    state: &AppState,
    headers: &HeaderMap,
    min_level: i64,
    request_id: &str,
) -> Result<AdminPrincipal, (StatusCode, Json<Value>)> {
    let claims = require_claims(headers, request_id)?;
    let principal = load_principal(state, &claims, request_id).await?;
    if principal.level < min_level {
        return Err(api_error(StatusCode::FORBIDDEN, "forbidden", request_id));
    }
    Ok(principal)
}

fn require_claims(
    headers: &HeaderMap,
    request_id: &str,
) -> Result<Claims, (StatusCode, Json<Value>)> {
    extract_claims_from_header(headers)
        .map_err(|_| api_error(StatusCode::UNAUTHORIZED, "unauthorized", request_id))
}

async fn load_principal(
    state: &AppState,
    claims: &Claims,
    request_id: &str,
) -> Result<AdminPrincipal, (StatusCode, Json<Value>)> {
    let user_id = claims
        .sub
        .parse::<i64>()
        .map_err(|_| api_error(StatusCode::UNAUTHORIZED, "unauthorized", request_id))?;

    let role_column = detect_auth_user_role_column(&state.db)
        .await
        .unwrap_or(None);
    let query = if role_column.as_deref() == Some("admin_role") {
        "SELECT id, email, is_active, is_staff, is_superuser, admin_role as role_value
         FROM auth_user WHERE id = ?"
    } else if role_column.as_deref() == Some("role") {
        "SELECT id, email, is_active, is_staff, is_superuser, role as role_value
         FROM auth_user WHERE id = ?"
    } else {
        "SELECT id, email, is_active, is_staff, is_superuser, NULL as role_value
         FROM auth_user WHERE id = ?"
    };

    let user = sqlx::query_as::<_, AuthUserRow>(query)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| api_error(StatusCode::INTERNAL_SERVER_ERROR, "failed to load actor", request_id))?;

    let user = user.ok_or_else(|| api_error(StatusCode::UNAUTHORIZED, "unauthorized", request_id))?;
    if user.is_active <= 0 {
        return Err(api_error(StatusCode::FORBIDDEN, "account is inactive", request_id));
    }

    let (role, level) = infer_role_and_level(user.is_staff > 0, user.is_superuser > 0, user.role_value.as_deref());
    Ok(AdminPrincipal {
        user_id: user.id,
        email: user.email,
        role: role.to_string(),
        level,
        is_staff: user.is_staff > 0,
        is_superuser: user.is_superuser > 0,
    })
}

async fn detect_auth_user_role_column(pool: &SqlitePool) -> Result<Option<String>, sqlx::Error> {
    for column in ["admin_role", "role"] {
        let exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*)
             FROM pragma_table_info('auth_user')
             WHERE name = ?",
        )
        .bind(column)
        .fetch_one(pool)
        .await
        .unwrap_or(0);
        if exists > 0 {
            return Ok(Some(column.to_string()));
        }
    }
    Ok(None)
}

fn infer_role_and_level(
    is_staff: bool,
    is_superuser: bool,
    role_value: Option<&str>,
) -> (&'static str, i64) {
    if is_superuser {
        return ("superadmin", 4);
    }

    if let Some(raw) = role_value {
        match raw.trim().to_ascii_lowercase().as_str() {
            "support" => return ("support", 1),
            "ops" | "finance" => return ("ops", 2),
            "engineering" | "engineer" => return ("engineering", 3),
            "superadmin" | "admin" | "primary_admin" => return ("superadmin", 4),
            _ => {}
        }
    }

    if is_staff {
        ("ops", 2)
    } else {
        ("none", 0)
    }
}

fn capabilities_for_level(level: i64) -> Vec<&'static str> {
    let mut capabilities = vec!["admin.read"];
    if level >= 2 {
        capabilities.extend([
            "admin.approvals.create",
            "admin.approvals.review",
            "admin.impersonation.start",
            "admin.impersonation.stop",
            "admin.break_glass.grant",
        ]);
    }
    if level >= 4 {
        capabilities.extend(["admin.high_risk.approve", "admin.superuser.impersonation"]);
    }
    capabilities
}

fn normalize_action_type(raw: &str) -> Option<String> {
    let normalized = raw.trim().to_ascii_uppercase();
    if SUPPORTED_APPROVAL_ACTIONS.contains(&normalized.as_str()) {
        Some(normalized)
    } else {
        None
    }
}

fn required_level_for_action(action_type: &str) -> i64 {
    match action_type {
        "WORKSPACE_DELETE" | "USER_PRIVILEGE_CHANGE" | "FEATURE_FLAG_CRITICAL" => 4,
        _ => 2,
    }
}

fn normalize_status_filter(raw: Option<&str>) -> Result<Option<String>, String> {
    let Some(value) = raw else {
        return Ok(None);
    };
    let normalized = value.trim().to_ascii_uppercase();
    if normalized.is_empty() {
        return Ok(None);
    }
    match normalized.as_str() {
        "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "FAILED" => Ok(Some(normalized)),
        _ => Err("unsupported status filter".to_string()),
    }
}

fn normalize_payload_json(payload: Option<Value>) -> Result<String, String> {
    let payload_value = payload.unwrap_or_else(|| json!({}));
    if !payload_value.is_object() {
        return Err("payload must be an object".to_string());
    }
    Ok(payload_value.to_string())
}

fn parse_payload_value(raw: &str) -> Value {
    serde_json::from_str::<Value>(raw).unwrap_or_else(|_| json!({}))
}

fn parse_payload_object(raw: &str) -> serde_json::Map<String, Value> {
    parse_payload_value(raw)
        .as_object()
        .cloned()
        .unwrap_or_default()
}

fn remove_from_redacted(payload: &mut serde_json::Map<String, Value>, key: &str) {
    let Some(redacted_value) = payload.get_mut("_redacted") else {
        return;
    };
    let Some(redacted) = redacted_value.as_array_mut() else {
        payload.remove("_redacted");
        return;
    };
    redacted.retain(|entry| entry.as_str() != Some(key));
    if redacted.is_empty() {
        payload.remove("_redacted");
    }
}

fn now_sqlite() -> String {
    Utc::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

fn minutes_from_now(minutes: i64) -> String {
    (Utc::now() + Duration::minutes(minutes))
        .format("%Y-%m-%d %H:%M:%S")
        .to_string()
}

fn is_expired_timestamp(expires_at: Option<&str>) -> bool {
    let Some(raw) = expires_at else {
        return false;
    };
    let parsed = chrono::DateTime::parse_from_rfc3339(raw)
        .map(|value| value.with_timezone(&Utc))
        .or_else(|_| {
            chrono::NaiveDateTime::parse_from_str(raw, "%Y-%m-%d %H:%M:%S")
                .map(|value| chrono::DateTime::<Utc>::from_naive_utc_and_offset(value, Utc))
        });
    parsed.map(|value| value <= Utc::now()).unwrap_or(false)
}

fn build_password_reset_url(target_user_id: i64) -> String {
    let base = std::env::var("ADMIN_PASSWORD_RESET_BASE_URL")
        .unwrap_or_else(|_| "http://localhost:5173/reset-password".to_string());
    let separator = if base.contains('?') { "&" } else { "?" };
    let token = Uuid::new_v4().to_string();
    format!(
        "{}{}token={}&target_user_id={}",
        base, separator, token, target_user_id
    )
}

fn pagination_link(
    page: i64,
    page_size: i64,
    action: Option<&str>,
    actor_user_id: Option<i64>,
) -> String {
    let mut query = format!("?page={}&page_size={}", page, page_size);
    if let Some(action) = action {
        query.push_str(&format!("&action={}", urlencoding::encode(action)));
    }
    if let Some(actor_user_id) = actor_user_id {
        query.push_str(&format!("&actor_user_id={}", actor_user_id));
    }
    query
}

async fn expire_stale_pending_approvals(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE admin_approval_requests
         SET status = 'EXPIRED',
             resolved_at = COALESCE(resolved_at, datetime('now')),
             updated_at = datetime('now')
         WHERE status = 'PENDING'
           AND expires_at IS NOT NULL
           AND datetime(expires_at) <= datetime('now')",
    )
    .execute(pool)
    .await?;
    Ok(())
}

async fn fetch_approval_row<'e, E>(
    executor: E,
    approval_id: &str,
) -> Result<Option<ApprovalRow>, sqlx::Error>
where
    E: sqlx::Executor<'e, Database = sqlx::Sqlite>,
{
    sqlx::query_as::<_, ApprovalRow>(
        "SELECT
            action_type,
            status,
            initiator_user_id,
            target_user_id,
            payload_json,
            expires_at
         FROM admin_approval_requests
         WHERE id = ?",
    )
    .bind(approval_id)
    .fetch_optional(executor)
    .await
}

async fn insert_audit_event<'e, E>(
    executor: E,
    request_id: &str,
    action: &str,
    outcome: &str,
    principal: &AdminPrincipal,
    target_type: &str,
    target_id: &str,
    reason: Option<&str>,
    ip_address: Option<&str>,
    user_agent: Option<&str>,
    details: &Value,
) -> Result<(), sqlx::Error>
where
    E: sqlx::Executor<'e, Database = sqlx::Sqlite>,
{
    sqlx::query(
        "INSERT INTO admin_audit_events (
            request_id,
            action,
            outcome,
            actor_user_id,
            actor_email,
            actor_role,
            target_type,
            target_id,
            reason,
            ip_address,
            user_agent,
            details_json,
            created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
    )
    .bind(request_id)
    .bind(action)
    .bind(outcome)
    .bind(principal.user_id)
    .bind(&principal.email)
    .bind(&principal.role)
    .bind(target_type)
    .bind(target_id)
    .bind(reason)
    .bind(ip_address)
    .bind(user_agent)
    .bind(details.to_string())
    .execute(executor)
    .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{routing::{get, post, patch}, Router};
    use axum_test::TestServer;
    use chrono::{Duration as ChronoDuration, Utc};
    use jsonwebtoken::{EncodingKey, Header};
    use sqlx::SqlitePool;

    async fn setup() -> (TestServer, SqlitePool) {
        std::env::set_var("JWT_SECRET", "test-secret");
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();

        sqlx::query(
            "CREATE TABLE auth_user (
                id INTEGER PRIMARY KEY,
                email TEXT NOT NULL,
                username TEXT NULL,
                first_name TEXT NULL,
                last_name TEXT NULL,
                password TEXT NULL,
                last_login TEXT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                is_staff INTEGER NOT NULL DEFAULT 0,
                is_superuser INTEGER NOT NULL DEFAULT 0,
                admin_role TEXT NULL,
                date_joined TEXT NULL
            )",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO auth_user (
                id, email, username, first_name, last_name, password, last_login,
                is_active, is_staff, is_superuser, admin_role, date_joined
             ) VALUES
             (1, 'ops-maker@example.com', 'ops-maker', 'Ops', 'Maker', '', datetime('now'), 1, 1, 0, 'ops', datetime('now')),
             (2, 'ops-checker@example.com', 'ops-checker', 'Ops', 'Checker', '', datetime('now'), 1, 1, 0, 'ops', datetime('now')),
             (3, 'viewer@example.com', 'viewer', 'View', 'Only', '', datetime('now'), 1, 0, 0, NULL, datetime('now')),
             (4, 'superadmin@example.com', 'superadmin', 'Super', 'Admin', '', datetime('now'), 1, 1, 1, 'superadmin', datetime('now')),
             (5, 'customer@example.com', 'customer', 'Casey', 'Customer', '', datetime('now'), 1, 0, 0, NULL, datetime('now')),
             (6, 'super-target@example.com', 'super-target', 'Target', 'Admin', '', datetime('now'), 1, 1, 1, 'superadmin', datetime('now'))",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "CREATE TABLE core_business (
                id INTEGER PRIMARY KEY,
                owner_user_id INTEGER NULL,
                name TEXT NOT NULL,
                plan TEXT NULL,
                status TEXT NULL,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NULL
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO core_business (id, owner_user_id, name, plan, status, is_deleted, created_at) VALUES
             (10, 5, 'Acme Books', 'growth', 'active', 0, datetime('now')),
             (11, 1, 'Ops Sandbox', 'starter', 'active', 0, datetime('now'))",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "CREATE TABLE core_bankaccount (
                id INTEGER PRIMARY KEY,
                business_id INTEGER NOT NULL,
                bank_name TEXT NULL,
                name TEXT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                last_imported_at TEXT NULL
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO core_bankaccount (id, business_id, bank_name, name, is_active, last_imported_at) VALUES
             (100, 10, 'RBC', 'Operating', 1, datetime('now')),
             (101, 11, 'BMO', 'Reserve', 1, datetime('now'))",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "CREATE TABLE core_banktransaction (
                id INTEGER PRIMARY KEY,
                bank_account_id INTEGER NOT NULL,
                status TEXT NULL,
                is_reconciled INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NULL
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO core_banktransaction (id, bank_account_id, status, is_reconciled, created_at) VALUES
             (1000, 100, 'NEW', 0, datetime('now')),
             (1001, 100, 'MATCHED', 1, datetime('now')),
             (1002, 101, 'NEW', 0, datetime('now'))",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "CREATE TABLE core_invoice (
                id INTEGER PRIMARY KEY,
                business_id INTEGER NOT NULL,
                customer_id INTEGER NULL,
                status TEXT NULL,
                grand_total REAL NULL,
                created_at TEXT NULL,
                issue_date TEXT NULL
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO core_invoice (id, business_id, customer_id, status, grand_total, created_at, issue_date) VALUES
             (2000, 10, NULL, 'DRAFT', 120.0, datetime('now'), datetime('now')),
             (2001, 10, NULL, 'PAID', 250.0, datetime('now'), datetime('now')),
             (2002, 11, NULL, 'SENT', 500.0, datetime('now'), datetime('now'))",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "CREATE TABLE core_expense (
                id INTEGER PRIMARY KEY,
                business_id INTEGER NOT NULL,
                category_id INTEGER NULL,
                status TEXT NULL,
                grand_total REAL NULL
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO core_expense (id, business_id, category_id, status, grand_total) VALUES
             (3000, 10, NULL, 'NEW', 75.0),
             (3001, 10, 1, 'APPROVED', 30.0)",
        )
        .execute(&pool)
        .await
        .unwrap();

        ensure_schema(&pool).await.unwrap();

        let state = AppState { db: pool.clone() };
        let app = Router::new()
            .route("/api/admin/contract", get(contract))
            .route("/api/admin/authz/me", get(authz_me))
            .route("/api/admin/overview-metrics/", get(overview_metrics))
            .route("/api/admin/operations-overview/", get(operations_overview))
            .route("/api/admin/users/", get(list_users))
            .route("/api/admin/users/:id/", patch(patch_user))
            .route("/api/admin/users/:id/reset-password/", post(reset_user_password))
            .route("/api/admin/workspaces/", get(list_workspaces))
            .route("/api/admin/workspaces/:id/", patch(patch_workspace))
            .route("/api/admin/workspaces/:id/overview/", get(workspace_overview))
            .route("/api/admin/bank-accounts/", get(list_bank_accounts_admin))
            .route("/api/admin/approvals/", get(list_approvals).post(create_approval))
            .route("/api/admin/approvals/:id/approve/", post(approve_approval))
            .route("/api/admin/approvals/:id/reject/", post(reject_approval))
            .route("/api/admin/approvals/:id/break-glass/", post(break_glass_approval))
            .route("/api/admin/impersonations/", post(start_impersonation))
            .route("/api/admin/impersonations/:id/stop/", post(stop_impersonation))
            .route("/api/admin/audit-log/", get(list_audit_events))
            .route("/api/admin/support-tickets/", get(list_support_tickets).post(create_support_ticket))
            .route("/api/admin/support-tickets/:id/", patch(patch_support_ticket))
            .route("/api/admin/support-tickets/:id/add_note/", post(add_support_ticket_note))
            .route("/api/admin/feature-flags/", get(list_feature_flags))
            .route("/api/admin/feature-flags/:id/", patch(patch_feature_flag))
            .route("/api/admin/reconciliation-metrics/", get(reconciliation_metrics))
            .route("/api/admin/ledger-health/", get(ledger_health))
            .route("/api/admin/invoices-audit/", get(invoices_audit))
            .route("/api/admin/expenses-audit/", get(expenses_audit))
            .route("/api/admin/employees/", get(list_employees).post(create_employee))
            .route("/api/admin/employees/:id/", get(get_employee).patch(patch_employee))
            .route("/api/admin/employees/:id/suspend/", post(suspend_employee))
            .route("/api/admin/employees/:id/reactivate/", post(reactivate_employee))
            .route("/api/admin/employees/:id/delete/", post(delete_employee))
            .route("/api/admin/employees/invite/", post(invite_employee))
            .route("/api/admin/employees/:id/resend-invite/", post(resend_employee_invite))
            .route("/api/admin/employees/:id/revoke-invite/", post(revoke_employee_invite))
            .route("/api/admin/invite/:token/", get(get_invite).post(redeem_invite))
            .with_state(state);

        (TestServer::new(app).unwrap(), pool)
    }

    fn make_token(user_id: i64) -> String {
        let exp = (Utc::now() + ChronoDuration::hours(1)).timestamp() as usize;
        let claims = Claims {
            sub: user_id.to_string(),
            email: format!("user{}@example.com", user_id),
            business_id: None,
            exp,
        };
        jsonwebtoken::encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(b"test-secret"),
        )
        .unwrap()
    }

    #[tokio::test]
    async fn authz_me_requires_authentication() {
        let (server, _pool) = setup().await;
        let response = server.get("/api/admin/authz/me").await;
        response.assert_status(StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn non_admin_cannot_create_approval() {
        let (server, _pool) = setup().await;
        let token = make_token(3);
        let response = server
            .post("/api/admin/approvals/")
            .add_header("authorization", format!("Bearer {}", token))
            .json(&json!({
                "action_type": "LEDGER_ADJUST",
                "reason": "Need adjustment"
            }))
            .await;
        response.assert_status(StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn maker_checker_blocks_self_approval() {
        let (server, _pool) = setup().await;
        let maker_token = make_token(1);
        let create_response = server
            .post("/api/admin/approvals/")
            .add_header("authorization", format!("Bearer {}", maker_token))
            .json(&json!({
                "action_type": "LEDGER_ADJUST",
                "reason": "Need adjustment for close variance"
            }))
            .await;
        create_response.assert_status_ok();
        let create_body: Value = create_response.json();
        let approval_id = create_body["id"].as_str().unwrap().to_string();

        let deny_response = server
            .post(&format!("/api/admin/approvals/{}/approve/", approval_id))
            .add_header("authorization", format!("Bearer {}", maker_token))
            .json(&json!({}))
            .await;
        deny_response.assert_status(StatusCode::FORBIDDEN);

        let checker_token = make_token(2);
        let approve_response = server
            .post(&format!("/api/admin/approvals/{}/approve/", approval_id))
            .add_header("authorization", format!("Bearer {}", checker_token))
            .json(&json!({}))
            .await;
        approve_response.assert_status_ok();
    }

    #[tokio::test]
    async fn high_risk_approval_requires_superadmin() {
        let (server, _pool) = setup().await;
        let maker_token = make_token(1);
        let create_response = server
            .post("/api/admin/approvals/")
            .add_header("authorization", format!("Bearer {}", maker_token))
            .json(&json!({
                "action_type": "WORKSPACE_DELETE",
                "reason": "Workspace under legal hold cleanup"
            }))
            .await;
        create_response.assert_status_ok();
        let create_body: Value = create_response.json();
        let approval_id = create_body["id"].as_str().unwrap().to_string();

        let ops_checker = make_token(2);
        let denied = server
            .post(&format!("/api/admin/approvals/{}/approve/", approval_id))
            .add_header("authorization", format!("Bearer {}", ops_checker))
            .json(&json!({}))
            .await;
        denied.assert_status(StatusCode::FORBIDDEN);

        let superadmin = make_token(4);
        let approved = server
            .post(&format!("/api/admin/approvals/{}/approve/", approval_id))
            .add_header("authorization", format!("Bearer {}", superadmin))
            .json(&json!({}))
            .await;
        approved.assert_status_ok();
    }

    #[tokio::test]
    async fn break_glass_enforces_ttl_cap_and_reveals_reset_url() {
        let (server, _pool) = setup().await;
        let maker_token = make_token(1);
        let create_response = server
            .post("/api/admin/approvals/")
            .add_header("authorization", format!("Bearer {}", maker_token))
            .json(&json!({
                "action_type": "PASSWORD_RESET_LINK",
                "reason": "Customer lost access",
                "target_user_id": 5
            }))
            .await;
        create_response.assert_status_ok();
        let create_body: Value = create_response.json();
        let approval_id = create_body["id"].as_str().unwrap().to_string();

        let checker_token = make_token(2);
        let approve_response = server
            .post(&format!("/api/admin/approvals/{}/approve/", approval_id))
            .add_header("authorization", format!("Bearer {}", checker_token))
            .json(&json!({}))
            .await;
        approve_response.assert_status_ok();

        let invalid_ttl = server
            .post(&format!("/api/admin/approvals/{}/break-glass/", approval_id))
            .add_header("authorization", format!("Bearer {}", checker_token))
            .json(&json!({
                "reason": "Need immediate support handoff",
                "ttl_minutes": 90
            }))
            .await;
        invalid_ttl.assert_status(StatusCode::BAD_REQUEST);

        let valid_ttl = server
            .post(&format!("/api/admin/approvals/{}/break-glass/", approval_id))
            .add_header("authorization", format!("Bearer {}", checker_token))
            .json(&json!({
                "reason": "Need immediate support handoff",
                "ttl_minutes": 10
            }))
            .await;
        valid_ttl.assert_status_ok();

        let list_response = server
            .get("/api/admin/approvals/?status=APPROVED")
            .add_header("authorization", format!("Bearer {}", checker_token))
            .await;
        list_response.assert_status_ok();
        let list_body: Value = list_response.json();
        let first_payload = &list_body["results"][0]["payload"];
        assert!(first_payload.get("reset_url").is_some());
    }

    #[tokio::test]
    async fn impersonation_requires_reason_and_superadmin_for_super_targets() {
        let (server, _pool) = setup().await;
        let ops_token = make_token(1);
        let no_reason = server
            .post("/api/admin/impersonations/")
            .add_header("authorization", format!("Bearer {}", ops_token))
            .json(&json!({
                "user_id": 5,
                "reason": "   "
            }))
            .await;
        no_reason.assert_status(StatusCode::BAD_REQUEST);

        let blocked = server
            .post("/api/admin/impersonations/")
            .add_header("authorization", format!("Bearer {}", ops_token))
            .json(&json!({
                "user_id": 6,
                "reason": "Incident investigation"
            }))
            .await;
        blocked.assert_status(StatusCode::FORBIDDEN);

        let superadmin_token = make_token(4);
        let allowed = server
            .post("/api/admin/impersonations/")
            .add_header("authorization", format!("Bearer {}", superadmin_token))
            .json(&json!({
                "user_id": 6,
                "reason": "Executive escalation"
            }))
            .await;
        allowed.assert_status_ok();
    }

    #[tokio::test]
    async fn audit_log_contains_privileged_actions() {
        let (server, _pool) = setup().await;
        let token = make_token(4);
        let _ = server
            .post("/api/admin/approvals/")
            .add_header("authorization", format!("Bearer {}", token))
            .json(&json!({
                "action_type": "LEDGER_ADJUST",
                "reason": "Audit trail check"
            }))
            .await;

        let audit_response = server
            .get("/api/admin/audit-log/")
            .add_header("authorization", format!("Bearer {}", token))
            .await;
        audit_response.assert_status_ok();
        let body: Value = audit_response.json();
        assert!(body["count"].as_i64().unwrap_or(0) >= 1);
    }

    #[tokio::test]
    async fn contract_reports_phase_two_admin_surface() {
        let (server, _pool) = setup().await;
        let token = make_token(4);

        let response = server
            .get("/api/admin/contract")
            .add_header("authorization", format!("Bearer {}", token))
            .await;
        response.assert_status_ok();
        let body: Value = response.json();

        assert_eq!(body["contract_version"], "2026-03-04");
        assert_eq!(body["endpoints"]["overview_metrics"], "/api/admin/overview-metrics/");
        assert_eq!(body["endpoints"]["workspaces"], "/api/admin/workspaces/");
        assert_eq!(body["endpoints"]["employees"], "/api/admin/employees/");
        assert_eq!(body["endpoints"]["support_tickets"], "/api/admin/support-tickets/");
        assert_eq!(body["endpoints"]["feature_flags"], "/api/admin/feature-flags/");
    }

    #[tokio::test]
    async fn overview_and_inventory_endpoints_return_backend_shapes() {
        let (server, _pool) = setup().await;
        let token = make_token(4);

        let overview = server
            .get("/api/admin/overview-metrics/")
            .add_header("authorization", format!("Bearer {}", token))
            .await;
        overview.assert_status_ok();
        let overview_body: Value = overview.json();
        assert!(overview_body.get("active_users_30d").is_some());
        assert!(overview_body["workspaces_health"].is_array());

        let ops = server
            .get("/api/admin/operations-overview/?env=prod&window_hours=24")
            .add_header("authorization", format!("Bearer {}", token))
            .await;
        ops.assert_status_ok();
        let ops_body: Value = ops.json();
        assert_eq!(ops_body["env"], "prod");
        assert!(ops_body["queues"].is_array());

        let users = server
            .get("/api/admin/users/")
            .add_header("authorization", format!("Bearer {}", token))
            .await;
        users.assert_status_ok();
        let users_body: Value = users.json();
        assert!(users_body["count"].as_i64().unwrap_or_default() >= 6);

        let workspaces = server
            .get("/api/admin/workspaces/")
            .add_header("authorization", format!("Bearer {}", token))
            .await;
        workspaces.assert_status_ok();
        let workspace_body: Value = workspaces.json();
        assert!(workspace_body["count"].as_i64().unwrap_or_default() >= 2);

        let bank_accounts = server
            .get("/api/admin/bank-accounts/")
            .add_header("authorization", format!("Bearer {}", token))
            .await;
        bank_accounts.assert_status_ok();
        let bank_body: Value = bank_accounts.json();
        assert!(bank_body["count"].as_i64().unwrap_or_default() >= 2);

        let workspace_overview = server
            .get("/api/admin/workspaces/10/overview/")
            .add_header("authorization", format!("Bearer {}", token))
            .await;
        workspace_overview.assert_status_ok();
        let workspace_overview_body: Value = workspace_overview.json();
        assert_eq!(workspace_overview_body["workspace"]["id"], 10);
        assert!(workspace_overview_body["banking"]["accounts"].is_array());

        server
            .get("/api/admin/reconciliation-metrics/")
            .add_header("authorization", format!("Bearer {}", token))
            .await
            .assert_status_ok();
        server
            .get("/api/admin/ledger-health/")
            .add_header("authorization", format!("Bearer {}", token))
            .await
            .assert_status_ok();
        server
            .get("/api/admin/invoices-audit/")
            .add_header("authorization", format!("Bearer {}", token))
            .await
            .assert_status_ok();
        server
            .get("/api/admin/expenses-audit/")
            .add_header("authorization", format!("Bearer {}", token))
            .await
            .assert_status_ok();
    }

    #[tokio::test]
    async fn privileged_user_workspace_and_flag_mutations_return_approval_envelopes() {
        let (server, _pool) = setup().await;
        let token = make_token(4);

        let user_patch = server
            .patch("/api/admin/users/5/")
            .add_header("authorization", format!("Bearer {}", token))
            .json(&json!({
                "is_active": false,
                "reason": "Fraud review"
            }))
            .await;
        user_patch.assert_status_ok();
        let user_patch_body: Value = user_patch.json();
        assert_eq!(user_patch_body["approval_required"], true);
        assert_eq!(user_patch_body["approval_status"], "PENDING");

        let workspace_patch = server
            .patch("/api/admin/workspaces/10/")
            .add_header("authorization", format!("Bearer {}", token))
            .json(&json!({
                "is_deleted": true,
                "reason": "Workspace shutdown"
            }))
            .await;
        workspace_patch.assert_status_ok();
        let workspace_patch_body: Value = workspace_patch.json();
        assert_eq!(workspace_patch_body["approval_required"], true);

        let flags = server
            .get("/api/admin/feature-flags/")
            .add_header("authorization", format!("Bearer {}", token))
            .await;
        flags.assert_status_ok();
        let flags_body: Value = flags.json();
        let critical_flag_id = flags_body
            .as_array()
            .and_then(|items| {
                items.iter().find(|item| item["is_critical"] == true)
            })
            .and_then(|item| item["id"].as_i64())
            .unwrap();

        let flag_patch = server
            .patch(&format!("/api/admin/feature-flags/{}/", critical_flag_id))
            .add_header("authorization", format!("Bearer {}", token))
            .json(&json!({
                "is_enabled": false,
                "rollout_percent": 0,
                "reason": "Emergency rollback"
            }))
            .await;
        flag_patch.assert_status_ok();
        let flag_patch_body: Value = flag_patch.json();
        assert_eq!(flag_patch_body["approval_required"], true);
    }

    #[tokio::test]
    async fn employee_support_and_invite_routes_are_backend_complete() {
        let (server, _pool) = setup().await;
        let token = make_token(4);

        let created_employee = server
            .post("/api/admin/employees/")
            .add_header("authorization", format!("Bearer {}", token))
            .json(&json!({
                "email": "operator@example.com",
                "display_name": "Ops Operator",
                "primary_admin_role": "support",
                "admin_panel_access": true,
                "is_active_employee": true
            }))
            .await;
        created_employee.assert_status_ok();
        let created_employee_body: Value = created_employee.json();
        let employee_id = created_employee_body["id"].as_i64().unwrap();

        server
            .get(&format!("/api/admin/employees/{}/", employee_id))
            .add_header("authorization", format!("Bearer {}", token))
            .await
            .assert_status_ok();

        server
            .post(&format!("/api/admin/employees/{}/suspend/", employee_id))
            .add_header("authorization", format!("Bearer {}", token))
            .json(&json!({}))
            .await
            .assert_status_ok();

        server
            .post(&format!("/api/admin/employees/{}/reactivate/", employee_id))
            .add_header("authorization", format!("Bearer {}", token))
            .json(&json!({}))
            .await
            .assert_status_ok();

        let ticket = server
            .post("/api/admin/support-tickets/")
            .add_header("authorization", format!("Bearer {}", token))
            .json(&json!({
                "subject": "Close books review",
                "user_id": 5,
                "workspace_id": 10
            }))
            .await;
        ticket.assert_status_ok();
        let ticket_body: Value = ticket.json();
        let ticket_id = ticket_body["id"].as_i64().unwrap();

        server
            .patch(&format!("/api/admin/support-tickets/{}/", ticket_id))
            .add_header("authorization", format!("Bearer {}", token))
            .json(&json!({
                "status": "IN_PROGRESS",
                "priority": "HIGH"
            }))
            .await
            .assert_status_ok();

        let ticket_with_note = server
            .post(&format!("/api/admin/support-tickets/{}/add_note/", ticket_id))
            .add_header("authorization", format!("Bearer {}", token))
            .json(&json!({
                "body": "Operator assigned."
            }))
            .await;
        ticket_with_note.assert_status_ok();
        let ticket_with_note_body: Value = ticket_with_note.json();
        assert_eq!(ticket_with_note_body["notes"].as_array().unwrap().len(), 1);

        let invite_response = server
            .post("/api/admin/employees/invite/")
            .add_header("authorization", format!("Bearer {}", token))
            .json(&json!({
                "email": "invitee@example.com",
                "full_name": "Invited Operator",
                "role": "support"
            }))
            .await;
        invite_response.assert_status_ok();
        let invite_body: Value = invite_response.json();
        let invite_url = invite_body["invite"]["invite_url"].as_str().unwrap();
        let invite_token = invite_url.trim_matches('/').split('/').last().unwrap();

        let invite_lookup = server
            .get(&format!("/api/admin/invite/{}/", invite_token))
            .await;
        invite_lookup.assert_status_ok();
        let invite_lookup_body: Value = invite_lookup.json();
        assert_eq!(invite_lookup_body["valid"], true);

        let redeem = server
            .post(&format!("/api/admin/invite/{}/", invite_token))
            .json(&json!({
                "username": "invitee",
                "email": "invitee@example.com",
                "password": "secure-pass-123",
                "first_name": "Invite",
                "last_name": "User"
            }))
            .await;
        redeem.assert_status_ok();
        let redeem_body: Value = redeem.json();
        assert_eq!(redeem_body["redirect"], "/login");
    }
}
