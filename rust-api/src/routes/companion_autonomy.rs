use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::{DateTime, TimeZone, Utc};
use serde::Deserialize;
use serde_json::Value;

use crate::companion_autonomy::{models::ApprovalRequest, policy::BudgetConfig, store};
use crate::routes::auth::{extract_claims_from_header, Claims};
use crate::routes::control_plane_errors::{
    control_plane_error_from_headers, control_plane_success_from_headers,
};
use crate::AppState;

const AUTONOMY_DOMAIN: &str = "AUTONOMY";

#[derive(Debug, Deserialize)]
pub struct TenantQuery {
    pub business_id: Option<i64>,
    pub tenant_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct SnoozePayload {
    pub until: String,
}

#[derive(Debug, Deserialize)]
pub struct DismissPayload {
    pub note: Option<String>,
    pub reason_code: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ApprovalRequestPayload {
    pub reason_required: Option<bool>,
    pub reason_text: Option<String>,
    pub expires_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ApprovalDecisionPayload {
    pub reason_text: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BatchApplyPayload {
    pub action_ids: Vec<i64>,
}

#[derive(Debug, Deserialize)]
pub struct EngineRunPayload {
    pub tenant: Option<String>,
    pub tenant_id: Option<i64>,
    pub business_id: Option<i64>,
    pub max_age_minutes: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct PolicyUpdatePayload {
    pub mode: String,
    pub breaker_thresholds: Option<Value>,
    pub allowlists: Option<Value>,
    pub budgets: Option<Value>,
}

fn autonomy_error_from_headers(
    status: StatusCode,
    headers: &HeaderMap,
    message: &str,
) -> (StatusCode, Json<Value>) {
    control_plane_error_from_headers(status, AUTONOMY_DOMAIN, headers, message)
}

pub async fn autonomy_status(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<TenantQuery>,
) -> impl axum::response::IntoResponse {
    let _claims = match require_claims(&headers) {
        Ok(claims) => claims,
        Err(response) => return response,
    };
    let tenant_id = match resolve_tenant_id(&headers, params.tenant_id.or(params.business_id)) {
        Ok(id) => id,
        Err(response) => return response,
    };
    let queues = store::fetch_cockpit_queues(&state.db, tenant_id)
        .await
        .unwrap_or_else(|_| {
            crate::companion_autonomy::models::CockpitQueues {
                generated_at: crate::companion_autonomy::now_utc_str(),
                mode: "suggest_only".to_string(),
                trust_score: 0.0,
                stats: serde_json::json!({}),
                ready_queue: vec![],
                needs_attention_queue: vec![],
                job_totals: None,
                job_by_agent: None,
                top_blockers: None,
            }
        });

    let usage = store::tool_usage_last_day(&state.db, tenant_id)
        .await
        .unwrap_or((0, 0));
    let budget = BudgetConfig::from_env();
    let breakers = store::breaker_events_last_day(&state.db, tenant_id).await.unwrap_or(0);

    (
        StatusCode::OK,
        Json(serde_json::json!({
        "ok": true,
        "mode": queues.mode,
        "trust_score": queues.trust_score,
        "stats": queues.stats,
        "budgets": {
            "tokens_per_day": budget.tokens_per_day,
            "tool_calls_per_day": budget.tool_calls_per_day,
            "runs_per_day": budget.runs_per_day
        },
        "usage": {
            "tool_calls_last_day": usage.0,
            "tokens_last_day": usage.1
        },
        "breaker_events_last_day": breakers
    })),
    )
}

pub async fn cockpit_status(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<TenantQuery>,
) -> impl axum::response::IntoResponse {
    let _claims = match require_claims(&headers) {
        Ok(claims) => claims,
        Err(response) => return response,
    };
    let tenant_id = match resolve_tenant_id(&headers, params.tenant_id.or(params.business_id)) {
        Ok(id) => id,
        Err(response) => return response,
    };

    let policy_mode = store::fetch_policy(&state.db, tenant_id)
        .await
        .ok()
        .flatten()
        .map(|row| row.mode)
        .unwrap_or_else(|| "suggest_only".to_string());
    let breakers = store::breaker_events_last_day(&state.db, tenant_id).await.unwrap_or(0);
    let budget = BudgetConfig::from_env();
    let last_tick_at = store::latest_audit_action_time(&state.db, tenant_id, "engine_tick")
        .await
        .ok()
        .flatten();
    let last_materialized_at = store::latest_audit_action_time(&state.db, tenant_id, "engine_materialize")
        .await
        .ok()
        .flatten();

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "ok": true,
            "tenant_id": tenant_id,
            "mode": policy_mode,
            "breakers": {
                "recent": breakers,
                "ok": breakers == 0
            },
            "budgets": {
                "tokens_per_day": budget.tokens_per_day,
                "tool_calls_per_day": budget.tool_calls_per_day,
                "runs_per_day": budget.runs_per_day
            },
            "last_tick_at": last_tick_at,
            "last_materialized_at": last_materialized_at,
            "engine_version": "v1",
            "runtime_mode": {
                "llm": "live",
                "tools": "live"
            }
        })),
    )
}

pub async fn cockpit_queues(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<TenantQuery>,
) -> impl axum::response::IntoResponse {
    let _claims = match require_claims(&headers) {
        Ok(claims) => claims,
        Err(response) => return response,
    };
    let tenant_id = match resolve_tenant_id(&headers, params.tenant_id.or(params.business_id)) {
        Ok(id) => id,
        Err(response) => return response,
    };
    if let Ok(Some(snapshot)) = store::latest_queue_snapshot(&state.db, tenant_id).await {
        let payload: serde_json::Value =
            serde_json::from_str(&snapshot.snapshot_json).unwrap_or_else(|_| serde_json::json!({}));
        let stale = is_queue_snapshot_stale(&snapshot.generated_at, snapshot.stale_after_seconds);
        return (
            StatusCode::OK,
            Json(serde_json::json!({
                "ok": true,
                "source": "snapshot",
                "stale": stale,
                "data": payload
            })),
        );
    }

    let queues = store::fetch_cockpit_queues(&state.db, tenant_id)
        .await
        .unwrap_or_else(|_| {
            crate::companion_autonomy::models::CockpitQueues {
                generated_at: crate::companion_autonomy::now_utc_str(),
                mode: "suggest_only".to_string(),
                trust_score: 0.0,
                stats: serde_json::json!({}),
                ready_queue: vec![],
                needs_attention_queue: vec![],
                job_totals: None,
                job_by_agent: None,
                top_blockers: None,
            }
        });

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "ok": true,
            "source": "live",
            "stale": false,
            "data": queues
        })),
    )
}

pub async fn engine_tick(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<TenantQuery>,
    Json(payload): Json<EngineRunPayload>,
) -> impl axum::response::IntoResponse {
    let claims = match require_staff(&state, &headers).await {
        Ok(claims) => claims,
        Err(response) => return response,
    };
    let tenants = if payload.tenant.as_deref() == Some("all") {
        let pairs = store::list_tenant_contexts(&state.db).await.unwrap_or_default();
        if pairs.is_empty() {
            return autonomy_error_from_headers(
                StatusCode::BAD_REQUEST,
                &headers,
                "no tenant contexts available",
            );
        }
        pairs
            .into_iter()
            .map(|(tenant_id, business_id)| crate::companion_autonomy::scheduler::TenantContext {
                tenant_id,
                business_id,
            })
            .collect()
    } else {
        let tenant = match resolve_tenant_context_from_payload(&headers, &payload, &params) {
            Ok(tenant) => tenant,
            Err(response) => return response,
        };
        vec![tenant]
    };
    match crate::companion_autonomy::scheduler::tick(&state.db, tenants, claims.sub.parse::<i64>().ok()).await {
        Ok(_) => control_plane_success_from_headers(
            StatusCode::OK,
            "completed",
            &headers,
            "Engine tick completed",
            serde_json::json!({}),
        ),
        Err(err) => autonomy_error_from_headers(
            StatusCode::INTERNAL_SERVER_ERROR,
            &headers,
            &format!("engine tick failed: {}", err),
        ),
    }
}

pub async fn engine_materialize(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<TenantQuery>,
    Json(payload): Json<EngineRunPayload>,
) -> impl axum::response::IntoResponse {
    let claims = match require_staff(&state, &headers).await {
        Ok(claims) => claims,
        Err(response) => return response,
    };
    let tenants = if payload.tenant.as_deref() == Some("all") {
        let pairs = store::list_tenant_contexts(&state.db).await.unwrap_or_default();
        if pairs.is_empty() {
            return autonomy_error_from_headers(
                StatusCode::BAD_REQUEST,
                &headers,
                "no tenant contexts available",
            );
        }
        pairs
            .into_iter()
            .map(|(tenant_id, business_id)| crate::companion_autonomy::scheduler::TenantContext {
                tenant_id,
                business_id,
            })
            .collect()
    } else {
        let tenant = match resolve_tenant_context_from_payload(&headers, &payload, &params) {
            Ok(tenant) => tenant,
            Err(response) => return response,
        };
        vec![tenant]
    };
    let stale = payload
        .max_age_minutes
        .unwrap_or_else(|| crate::companion_autonomy::policy::PolicyConfig::from_env().snapshot_stale_minutes);
    match crate::companion_autonomy::scheduler::materialize(&state.db, tenants, stale, claims.sub.parse::<i64>().ok()).await {
        Ok(_) => control_plane_success_from_headers(
            StatusCode::OK,
            "completed",
            &headers,
            "Engine materialize completed",
            serde_json::json!({}),
        ),
        Err(err) => autonomy_error_from_headers(
            StatusCode::INTERNAL_SERVER_ERROR,
            &headers,
            &format!("engine materialize failed: {}", err),
        ),
    }
}

pub async fn update_policy(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<TenantQuery>,
    Json(payload): Json<PolicyUpdatePayload>,
) -> impl axum::response::IntoResponse {
    let _claims = match require_staff(&state, &headers).await {
        Ok(claims) => claims,
        Err(response) => return response,
    };
    let tenant_id = match resolve_tenant_id(&headers, params.business_id.or(params.tenant_id)) {
        Ok(id) => id,
        Err(response) => return response,
    };
    let breaker_thresholds = payload
        .breaker_thresholds
        .unwrap_or_else(|| serde_json::json!({}));
    let allowlists = payload
        .allowlists
        .unwrap_or_else(|| serde_json::json!({}));
    let budgets = payload
        .budgets
        .unwrap_or_else(|| serde_json::json!({}));
    let result = store::upsert_policy(
        &state.db,
        tenant_id,
        &payload.mode,
        &breaker_thresholds,
        &allowlists,
        &budgets,
    )
    .await;
    match result {
        Ok(_) => control_plane_success_from_headers(
            StatusCode::OK,
            "updated",
            &headers,
            "Autonomy policy updated",
            serde_json::json!({}),
        ),
        Err(err) => autonomy_error_from_headers(
            StatusCode::INTERNAL_SERVER_ERROR,
            &headers,
            &format!("failed to update policy: {}", err),
        ),
    }
}

pub async fn list_runs(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<TenantQuery>,
) -> impl axum::response::IntoResponse {
    let _claims = match require_claims(&headers) {
        Ok(claims) => claims,
        Err(response) => return response,
    };
    let tenant_id = match resolve_tenant_id(&headers, params.tenant_id.or(params.business_id)) {
        Ok(id) => id,
        Err(response) => return response,
    };
    let runs = store::list_agent_runs(&state.db, tenant_id, 50)
        .await
        .unwrap_or_default();
    (
        StatusCode::OK,
        Json(serde_json::json!({
        "ok": true,
        "runs": runs
        })),
    )
}

pub async fn work_detail(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(work_item_id): Path<i64>,
    Query(params): Query<TenantQuery>,
) -> impl axum::response::IntoResponse {
    let _claims = match require_claims(&headers) {
        Ok(claims) => claims,
        Err(response) => return response,
    };
    let tenant_id = match resolve_tenant_id(&headers, params.tenant_id.or(params.business_id)) {
        Ok(id) => id,
        Err(response) => return response,
    };
    let detail = store::get_work_item_detail(&state.db, tenant_id, work_item_id)
        .await
        .unwrap_or(None);

    if let Some((work_item, actions, rationale, evidence)) = detail {
        let inputs: serde_json::Value = serde_json::from_str(&work_item.inputs_json).unwrap_or_default();
        let state_json: serde_json::Value = serde_json::from_str(&work_item.state_json).unwrap_or_default();
        let links: serde_json::Value = serde_json::from_str(&work_item.links_json).unwrap_or_default();
        let actions_json: Vec<serde_json::Value> = actions
            .into_iter()
            .map(|action| {
                let payload: serde_json::Value =
                    serde_json::from_str(&action.payload_json).unwrap_or_default();
                let preview: serde_json::Value =
                    serde_json::from_str(&action.preview_effects_json).unwrap_or_default();
                serde_json::json!({
                    "id": action.id,
                    "action_kind": action.action_kind,
                    "status": action.status,
                    "requires_confirm": action.requires_confirm,
                    "payload": payload,
                    "preview_effects": preview
                })
            })
            .collect();

        let rationale_json = rationale.map(|card| {
            serde_json::json!({
                "sections": serde_json::from_str::<serde_json::Value>(&card.sections_json).unwrap_or_default(),
                "customer_safe_text": card.customer_safe_text,
                "generated_at": card.generated_at,
                "version": card.version
            })
        });

        return (
            StatusCode::OK,
            Json(serde_json::json!({
            "ok": true,
            "work_item": {
                "id": work_item.id,
                "type": work_item.work_type,
                "surface": work_item.surface,
                "status": work_item.status,
                "priority": work_item.priority,
                "risk_level": work_item.risk_level,
                "confidence_score": work_item.confidence_score,
                "requires_approval": work_item.requires_approval,
                "customer_title": work_item.customer_title,
                "customer_summary": work_item.customer_summary,
                "inputs": inputs,
                "state": state_json,
                "links": links
            },
            "recommendations": actions_json,
            "rationale": rationale_json,
            "evidence": evidence
            })),
        );
    }

    autonomy_error_from_headers(StatusCode::NOT_FOUND, &headers, "work item not found")
}

pub async fn dismiss_work_item(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(work_item_id): Path<i64>,
    Query(params): Query<TenantQuery>,
    Json(payload): Json<DismissPayload>,
) -> impl axum::response::IntoResponse {
    let actor_id = match require_user_id(&headers) {
        Ok(id) => Some(id),
        Err(response) => return response,
    };
    let tenant_id = match resolve_tenant_id(&headers, params.tenant_id.or(params.business_id)) {
        Ok(id) => id,
        Err(response) => return response,
    };
    let business_id = match resolve_business_id(&headers, params.business_id) {
        Ok(id) => id,
        Err(response) => return response,
    };
    let dismissed = store::dismiss_work_item(&state.db, tenant_id, work_item_id)
        .await
        .unwrap_or(false);

    let _ = store::insert_audit_log(
        &state.db,
        tenant_id,
        business_id,
        actor_id,
        "user",
        "work_item.dismiss",
        "work_item",
        &work_item_id.to_string(),
        &serde_json::json!({
            "note": payload.note,
            "reason_code": payload.reason_code
        }),
    )
    .await;

    control_plane_success_from_headers(
        StatusCode::OK,
        "updated",
        &headers,
        "Work item dismissal processed",
        serde_json::json!({
            "ok": true,
            "dismissed": dismissed
        }),
    )
}

pub async fn snooze_work_item(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(work_item_id): Path<i64>,
    Query(params): Query<TenantQuery>,
    Json(payload): Json<SnoozePayload>,
) -> impl axum::response::IntoResponse {
    let _actor_id = match require_user_id(&headers) {
        Ok(id) => id,
        Err(response) => return response,
    };
    let tenant_id = match resolve_tenant_id(&headers, params.tenant_id.or(params.business_id)) {
        Ok(id) => id,
        Err(response) => return response,
    };
    let snoozed = store::snooze_work_item(&state.db, tenant_id, work_item_id, &payload.until)
        .await
        .unwrap_or(false);

    control_plane_success_from_headers(
        StatusCode::OK,
        "updated",
        &headers,
        "Work item snooze processed",
        serde_json::json!({
            "ok": true,
            "snoozed": snoozed
        }),
    )
}

pub async fn request_approval(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(work_item_id): Path<i64>,
    Query(params): Query<TenantQuery>,
    Json(payload): Json<ApprovalRequestPayload>,
) -> impl axum::response::IntoResponse {
    let tenant_id = match resolve_tenant_id(&headers, params.tenant_id.or(params.business_id)) {
        Ok(id) => id,
        Err(response) => return response,
    };
    let business_id = match resolve_business_id(&headers, params.business_id) {
        Ok(id) => id,
        Err(response) => return response,
    };
    let actor_id = match require_user_id(&headers) {
        Ok(id) => id,
        Err(response) => return response,
    };
    let request = store::create_approval_request(
        &state.db,
        tenant_id,
        business_id,
        work_item_id,
        &format!("user:{}", actor_id),
        payload.reason_required.unwrap_or(false),
        payload.reason_text.as_deref(),
        payload.expires_at.as_deref(),
    )
    .await;

    if let Ok(request) = request {
        let _ = store::update_work_item_status(&state.db, work_item_id, tenant_id, "waiting_approval").await;
        return control_plane_success_from_headers(
            StatusCode::OK,
            "created",
            &headers,
            "Approval request created",
            serde_json::json!({
                "ok": true,
                "approval": request
            }),
        );
    }

    autonomy_error_from_headers(
        StatusCode::INTERNAL_SERVER_ERROR,
        &headers,
        "failed to create approval",
    )
}

pub async fn approve_request(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(approval_id): Path<i64>,
    Query(params): Query<TenantQuery>,
    Json(payload): Json<ApprovalDecisionPayload>,
) -> impl axum::response::IntoResponse {
    let tenant_id = match resolve_tenant_id(&headers, params.tenant_id.or(params.business_id)) {
        Ok(id) => id,
        Err(response) => return response,
    };
    let actor_id = match require_user_id(&headers) {
        Ok(id) => id,
        Err(response) => return response,
    };

    let request = match fetch_approval_request(&state.db, tenant_id, approval_id).await {
        Ok(Some(request)) => request,
        Ok(None) => return autonomy_error_from_headers(StatusCode::NOT_FOUND, &headers, "approval request not found"),
        Err(_) => return autonomy_error_from_headers(StatusCode::INTERNAL_SERVER_ERROR, &headers, "failed to load approval request"),
    };

    if request.status != "pending" {
        return autonomy_error_from_headers(
            StatusCode::CONFLICT,
            &headers,
            "approval request already processed",
        );
    }

    if request.reason_required {
        let reason = payload.reason_text.as_deref().unwrap_or("").trim();
        if reason.is_empty() {
            return autonomy_error_from_headers(
                StatusCode::BAD_REQUEST,
                &headers,
                "approval reason required",
            );
        }
    }

    if let Some(expires_at) = request.expires_at.as_deref() {
        if let Some(expiry) = parse_expires_at(expires_at) {
            if expiry <= Utc::now() {
                return autonomy_error_from_headers(
                    StatusCode::CONFLICT,
                    &headers,
                    "approval request expired",
                );
            }
        } else {
            return autonomy_error_from_headers(
                StatusCode::BAD_REQUEST,
                &headers,
                "invalid approval expiry",
            );
        }
    }

    let updated = store::set_approval_status(
        &state.db,
        tenant_id,
        approval_id,
        "approved",
        Some(actor_id),
        payload.reason_text.as_deref(),
    )
    .await
    .unwrap_or(false);

    if updated {
        if let Ok(Some((tenant_id, work_item_id))) = fetch_approval_work_item(&state.db, approval_id, tenant_id).await {
            let _ = store::update_work_item_status(&state.db, work_item_id, tenant_id, "ready").await;
        }
    }

    let _ = store::insert_audit_log(
        &state.db,
        tenant_id,
        request.business_id,
        Some(actor_id),
        "user",
        "approval.approve",
        "approval_request",
        &approval_id.to_string(),
        &serde_json::json!({
            "approved": updated,
            "work_item_id": request.work_item_id
        }),
    )
    .await;

    control_plane_success_from_headers(
        StatusCode::OK,
        "updated",
        &headers,
        "Approval request approved",
        serde_json::json!({
            "ok": true,
            "approved": updated
        }),
    )
}

pub async fn reject_request(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(approval_id): Path<i64>,
    Query(params): Query<TenantQuery>,
    Json(payload): Json<ApprovalDecisionPayload>,
) -> impl axum::response::IntoResponse {
    let tenant_id = match resolve_tenant_id(&headers, params.tenant_id.or(params.business_id)) {
        Ok(id) => id,
        Err(response) => return response,
    };
    let actor_id = match require_user_id(&headers) {
        Ok(id) => id,
        Err(response) => return response,
    };

    let request = match fetch_approval_request(&state.db, tenant_id, approval_id).await {
        Ok(Some(request)) => request,
        Ok(None) => return autonomy_error_from_headers(StatusCode::NOT_FOUND, &headers, "approval request not found"),
        Err(_) => return autonomy_error_from_headers(StatusCode::INTERNAL_SERVER_ERROR, &headers, "failed to load approval request"),
    };

    if request.status != "pending" {
        return autonomy_error_from_headers(
            StatusCode::CONFLICT,
            &headers,
            "approval request already processed",
        );
    }

    if request.reason_required {
        let reason = payload.reason_text.as_deref().unwrap_or("").trim();
        if reason.is_empty() {
            return autonomy_error_from_headers(
                StatusCode::BAD_REQUEST,
                &headers,
                "rejection reason required",
            );
        }
    }

    if let Some(expires_at) = request.expires_at.as_deref() {
        if let Some(expiry) = parse_expires_at(expires_at) {
            if expiry <= Utc::now() {
                return autonomy_error_from_headers(
                    StatusCode::CONFLICT,
                    &headers,
                    "approval request expired",
                );
            }
        } else {
            return autonomy_error_from_headers(
                StatusCode::BAD_REQUEST,
                &headers,
                "invalid approval expiry",
            );
        }
    }

    let updated = store::set_approval_status(
        &state.db,
        tenant_id,
        approval_id,
        "rejected",
        Some(actor_id),
        payload.reason_text.as_deref(),
    )
    .await
    .unwrap_or(false);

    if updated {
        if let Ok(Some((tenant_id, work_item_id))) = fetch_approval_work_item(&state.db, approval_id, tenant_id).await {
            let _ = store::update_work_item_status(&state.db, work_item_id, tenant_id, "dismissed").await;
        }
    }

    let _ = store::insert_audit_log(
        &state.db,
        tenant_id,
        request.business_id,
        Some(actor_id),
        "user",
        "approval.reject",
        "approval_request",
        &approval_id.to_string(),
        &serde_json::json!({
            "rejected": updated,
            "work_item_id": request.work_item_id
        }),
    )
    .await;

    control_plane_success_from_headers(
        StatusCode::OK,
        "updated",
        &headers,
        "Approval request rejected",
        serde_json::json!({
            "ok": true,
            "rejected": updated
        }),
    )
}

pub async fn apply_action(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(action_id): Path<i64>,
    Query(params): Query<TenantQuery>,
) -> impl axum::response::IntoResponse {
    let actor_id = match require_user_id(&headers) {
        Ok(id) => id,
        Err(response) => return response,
    };
    let tenant_id = match resolve_tenant_id(&headers, params.tenant_id.or(params.business_id)) {
        Ok(id) => id,
        Err(response) => return response,
    };
    let business_id = match resolve_business_id(&headers, params.business_id) {
        Ok(id) => id,
        Err(response) => return response,
    };
    if let Err(response) = ensure_apply_enabled(&state.db, business_id, &headers).await {
        return response;
    }
    if !can_apply_action(&state.db, tenant_id, action_id).await.unwrap_or(false) {
        return autonomy_error_from_headers(
            StatusCode::FORBIDDEN,
            &headers,
            "approval required",
        );
    }

    let applied = store::apply_action(&state.db, tenant_id, action_id)
        .await
        .unwrap_or(false);

    let work_item_id = store::action_work_item_id(&state.db, tenant_id, action_id)
        .await
        .ok()
        .flatten();

    if applied {
        if let Some(work_item_id) = work_item_id {
            let _ = store::update_work_item_status(&state.db, work_item_id, tenant_id, "applied").await;
        }
    }

    let _ = store::insert_audit_log(
        &state.db,
        tenant_id,
        business_id,
        Some(actor_id),
        "user",
        "action.apply",
        "action",
        &action_id.to_string(),
        &serde_json::json!({
            "applied": applied,
            "work_item_id": work_item_id
        }),
    )
    .await;

    control_plane_success_from_headers(
        StatusCode::OK,
        "completed",
        &headers,
        "Action apply processed",
        serde_json::json!({
            "ok": true,
            "applied": applied
        }),
    )
}

pub async fn batch_apply_actions(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<TenantQuery>,
    Json(payload): Json<BatchApplyPayload>,
) -> impl axum::response::IntoResponse {
    let actor_id = match require_user_id(&headers) {
        Ok(id) => id,
        Err(response) => return response,
    };
    let tenant_id = match resolve_tenant_id(&headers, params.tenant_id.or(params.business_id)) {
        Ok(id) => id,
        Err(response) => return response,
    };
    let business_id = match resolve_business_id(&headers, params.business_id) {
        Ok(id) => id,
        Err(response) => return response,
    };
    if let Err(response) = ensure_apply_enabled(&state.db, business_id, &headers).await {
        return response;
    }
    let mut results = Vec::new();
    let mut applied_ids = Vec::new();
    for action_id in &payload.action_ids {
        let allowed = can_apply_action(&state.db, tenant_id, *action_id).await.unwrap_or(false);
        if allowed {
            let applied = store::apply_action(&state.db, tenant_id, *action_id)
                .await
                .unwrap_or(false);
            if applied {
                applied_ids.push(*action_id);
            }
            results.push(serde_json::json!({
                "action_id": action_id,
                "applied": applied
            }));
        } else {
            results.push(serde_json::json!({
                "action_id": action_id,
                "applied": false,
                "reason": "approval required"
            }));
        }
    }

    let work_item_pairs = store::action_work_item_ids(&state.db, tenant_id, &applied_ids)
        .await
        .unwrap_or_default();
    for (_, work_item_id) in work_item_pairs {
        let _ = store::update_work_item_status(&state.db, work_item_id, tenant_id, "applied").await;
    }

    let _ = store::insert_audit_log(
        &state.db,
        tenant_id,
        business_id,
        Some(actor_id),
        "user",
        "action.batch_apply",
        "action",
        "batch",
        &serde_json::json!({
            "applied_action_ids": applied_ids,
            "results": results.clone()
        }),
    )
    .await;

    control_plane_success_from_headers(
        StatusCode::OK,
        "completed",
        &headers,
        "Batch action apply processed",
        serde_json::json!({
            "ok": true,
            "results": results
        }),
    )
}

fn resolve_tenant_id(
    headers: &HeaderMap,
    query_tenant_id: Option<i64>,
) -> Result<i64, (StatusCode, Json<serde_json::Value>)> {
    if let Ok(claims) = extract_claims_from_header(headers) {
        if let Some(business_id) = claims.business_id {
            return Ok(business_id);
        }
    }
    if let Some(id) = query_tenant_id {
        return Ok(id);
    }
    Err(autonomy_error_from_headers(
        StatusCode::BAD_REQUEST,
        headers,
        "tenant_id required",
    ))
}

fn resolve_business_id(
    headers: &HeaderMap,
    query_business_id: Option<i64>,
) -> Result<i64, (StatusCode, Json<serde_json::Value>)> {
    if let Ok(claims) = extract_claims_from_header(headers) {
        if let Some(business_id) = claims.business_id {
            return Ok(business_id);
        }
    }
    if let Some(id) = query_business_id {
        return Ok(id);
    }
    Err(autonomy_error_from_headers(
        StatusCode::BAD_REQUEST,
        headers,
        "business_id required",
    ))
}

fn resolve_tenant_context_from_payload(
    headers: &HeaderMap,
    payload: &EngineRunPayload,
    params: &TenantQuery,
) -> Result<crate::companion_autonomy::scheduler::TenantContext, (StatusCode, Json<serde_json::Value>)> {
    let tenant_id = resolve_tenant_id(
        headers,
        payload.tenant_id.or(params.tenant_id).or(params.business_id),
    )?;
    let business_id = resolve_business_id(headers, payload.business_id.or(params.business_id))?;
    Ok(crate::companion_autonomy::scheduler::TenantContext {
        tenant_id,
        business_id,
    })
}

fn require_claims(headers: &HeaderMap) -> Result<Claims, (StatusCode, Json<serde_json::Value>)> {
    extract_claims_from_header(headers)
        .map_err(|_| autonomy_error_from_headers(StatusCode::UNAUTHORIZED, headers, "unauthorized"))
}

fn require_user_id(headers: &HeaderMap) -> Result<i64, (StatusCode, Json<serde_json::Value>)> {
    let claims = require_claims(headers)?;
    claims
        .sub
        .parse::<i64>()
        .map_err(|_| autonomy_error_from_headers(StatusCode::UNAUTHORIZED, headers, "unauthorized"))
}

async fn require_staff(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<Claims, (StatusCode, Json<serde_json::Value>)> {
    let claims = extract_claims_from_header(headers)
        .map_err(|_| autonomy_error_from_headers(StatusCode::UNAUTHORIZED, headers, "unauthorized"))?;
    let user_id = claims.sub.parse::<i64>().ok();
    if let Some(user_id) = user_id {
        let is_staff = sqlx::query_scalar::<_, i64>(
            "SELECT is_staff FROM auth_user WHERE id = ?"
        )
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten()
        .unwrap_or(0);
        if is_staff > 0 {
            return Ok(claims);
        }
    }
    Err(autonomy_error_from_headers(
        StatusCode::FORBIDDEN,
        headers,
        "forbidden",
    ))
}

fn is_queue_snapshot_stale(generated_at: &str, stale_after_seconds: i64) -> bool {
    if let Ok(parsed) = chrono::NaiveDateTime::parse_from_str(generated_at, "%Y-%m-%d %H:%M:%S") {
        let generated = chrono::Utc.from_utc_datetime(&parsed);
        let age_seconds = (chrono::Utc::now() - generated).num_seconds();
        return age_seconds > stale_after_seconds;
    }
    true
}

async fn ensure_apply_enabled(
    pool: &sqlx::SqlitePool,
    business_id: i64,
    headers: &HeaderMap,
) -> Result<(), (StatusCode, Json<serde_json::Value>)> {
    let global_enabled = store::business_ai_enabled(pool, business_id)
        .await
        .ok()
        .flatten()
        .unwrap_or(false);
    if !global_enabled {
        return Err(autonomy_error_from_headers(
            StatusCode::FORBIDDEN,
            headers,
            "ai companion disabled",
        ));
    }

    let settings = store::fetch_ai_settings(pool, business_id)
        .await
        .ok()
        .flatten();
    let settings = match settings {
        Some(settings) => settings,
        None => {
            return Err(autonomy_error_from_headers(
                StatusCode::FORBIDDEN,
                headers,
                "ai settings not configured",
            ));
        }
    };

    if !settings.ai_enabled || settings.kill_switch || settings.ai_mode == "shadow_only" {
        return Err(autonomy_error_from_headers(
            StatusCode::FORBIDDEN,
            headers,
            "ai apply disabled",
        ));
    }

    Ok(())
}

fn parse_expires_at(raw: &str) -> Option<DateTime<Utc>> {
    if let Ok(parsed) = DateTime::parse_from_rfc3339(raw) {
        return Some(parsed.with_timezone(&Utc));
    }
    if let Ok(parsed) = chrono::NaiveDateTime::parse_from_str(raw, "%Y-%m-%d %H:%M:%S") {
        return Some(Utc.from_utc_datetime(&parsed));
    }
    None
}

async fn fetch_approval_request(
    pool: &sqlx::SqlitePool,
    tenant_id: i64,
    approval_id: i64,
) -> Result<Option<ApprovalRequest>, sqlx::Error> {
    sqlx::query_as::<_, ApprovalRequest>(
        "SELECT * FROM companion_autonomy_approval_requests
         WHERE id = ? AND tenant_id = ?"
    )
    .bind(approval_id)
    .bind(tenant_id)
    .fetch_optional(pool)
    .await
}

async fn fetch_approval_work_item(
    pool: &sqlx::SqlitePool,
    approval_id: i64,
    tenant_id: i64,
) -> Result<Option<(i64, i64)>, sqlx::Error> {
    sqlx::query_as(
        "SELECT tenant_id, work_item_id
         FROM companion_autonomy_approval_requests
         WHERE id = ? AND tenant_id = ?"
    )
    .bind(approval_id)
    .bind(tenant_id)
    .fetch_optional(pool)
    .await
}

pub async fn can_apply_action(
    pool: &sqlx::SqlitePool,
    tenant_id: i64,
    action_id: i64,
) -> Result<bool, sqlx::Error> {
    let action = sqlx::query_as::<_, (i64, bool, String, String, i64)>(
        "SELECT a.work_item_id, a.requires_confirm, a.status, w.status, w.business_id
         FROM companion_autonomy_action_recommendations a
         JOIN companion_autonomy_work_items w ON w.id = a.work_item_id
         WHERE a.tenant_id = ? AND a.id = ? AND w.tenant_id = ?"
    )
    .bind(tenant_id)
    .bind(action_id)
    .bind(tenant_id)
    .fetch_optional(pool)
    .await?;

    let (work_item_id, requires_confirm, action_status, work_item_status, business_id) = match action {
        Some(row) => row,
        None => return Ok(false),
    };

    if action_status != "proposed" {
        return Ok(false);
    }

    let allowed_status = matches!(
        work_item_status.as_str(),
        "open" | "ready" | "waiting_approval"
    );
    if !allowed_status {
        return Ok(false);
    }

    let global_enabled = store::business_ai_enabled(pool, business_id)
        .await
        .ok()
        .flatten()
        .unwrap_or(false);
    if !global_enabled {
        return Ok(false);
    }

    let settings = store::fetch_ai_settings(pool, business_id)
        .await
        .ok()
        .flatten();
    let settings = match settings {
        Some(settings) => settings,
        None => return Ok(false),
    };
    if !settings.ai_enabled || settings.kill_switch || settings.ai_mode == "shadow_only" {
        return Ok(false);
    }

    if !requires_confirm {
        return Ok(true);
    }

    let approved: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM companion_autonomy_approval_requests
         WHERE work_item_id = ? AND status = 'approved'
           AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))"
    )
    .bind(work_item_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    Ok(approved > 0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{http::HeaderMap, routing::{get, post}, Router};
    use axum_test::TestServer;
    use chrono::{Duration, Utc};
    use jsonwebtoken::{EncodingKey, Header};
    use sqlx::SqlitePool;

    async fn setup() -> (TestServer, SqlitePool) {
        std::env::set_var("JWT_SECRET", "test-secret");
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        crate::companion_autonomy::schema::run_migrations(&pool).await.unwrap();
        sqlx::query(
            "CREATE TABLE auth_user (
                id INTEGER PRIMARY KEY,
                is_staff INTEGER NOT NULL
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "CREATE TABLE core_business (
                id INTEGER PRIMARY KEY,
                ai_companion_enabled INTEGER NOT NULL
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query("INSERT INTO auth_user (id, is_staff) VALUES (1, 1)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO core_business (id, ai_companion_enabled) VALUES (1, 1)")
            .execute(&pool)
            .await
            .unwrap();

        let state = AppState { db: pool.clone() };
        let app = Router::new()
            .route("/api/companion/cockpit/queues", get(cockpit_queues))
            .route("/api/companion/cockpit/status", get(cockpit_status))
            .route("/api/companion/autonomy/status", get(autonomy_status))
            .route("/api/companion/autonomy/work/:id/dismiss", post(dismiss_work_item))
            .route("/api/companion/autonomy/work/:id/snooze", post(snooze_work_item))
            .route("/api/companion/autonomy/work/:id/request-approval", post(request_approval))
            .route("/api/companion/autonomy/approval/:id/approve", post(approve_request))
            .route("/api/companion/autonomy/approval/:id/reject", post(reject_request))
            .route("/api/companion/autonomy/actions/:id/apply", post(apply_action))
            .route("/api/companion/autonomy/actions/batch-apply", post(batch_apply_actions))
            .route("/api/companion/autonomy/tick", post(engine_tick))
            .route("/api/companion/autonomy/materialize", post(engine_materialize))
            .route("/api/companion/autonomy/policy", post(update_policy))
            .with_state(state)
            .layer(axum::middleware::from_fn(
                crate::routes::request_ids::control_plane_request_id_middleware,
            ));

        (TestServer::new(app).unwrap(), pool)
    }

    fn make_token(business_id: i64) -> String {
        let exp = (Utc::now() + Duration::hours(1)).timestamp() as usize;
        let claims = Claims {
            sub: "1".to_string(),
            email: "user@example.com".to_string(),
            business_id: Some(business_id),
            exp,
        };
        jsonwebtoken::encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(b"test-secret"),
        )
        .unwrap()
    }

    async fn seed_work_item(pool: &SqlitePool, tenant_id: i64, title: &str) -> i64 {
        let inputs_json = serde_json::json!({ "transaction_id": tenant_id }).to_string();
        let state_json = serde_json::json!({}).to_string();
        let links_json = serde_json::json!({ "target_url": "/banking" }).to_string();

        let result = sqlx::query(
            "INSERT INTO companion_autonomy_work_items (
                tenant_id, business_id, work_type, surface, status, priority, dedupe_key,
                inputs_json, state_json, due_at, snoozed_until, risk_level, confidence_score,
                requires_approval, customer_title, customer_summary, internal_title, internal_notes,
                links_json, created_at, updated_at
            ) VALUES (?, ?, 'categorize_tx', 'bank', 'open', 50, ?, ?, ?, NULL, NULL,
                      'low', 0.8, 0, ?, 'Summary', 'Internal', 'Notes', ?, datetime('now'), datetime('now'))"
        )
        .bind(tenant_id)
        .bind(tenant_id)
        .bind(format!("dedupe:{}", title))
        .bind(inputs_json)
        .bind(state_json)
        .bind(title)
        .bind(links_json)
        .execute(pool)
        .await
        .unwrap();

        let work_item_id = result.last_insert_rowid();
        sqlx::query(
            "INSERT INTO companion_autonomy_action_recommendations (
                tenant_id, business_id, work_item_id, action_kind, payload_json, preview_effects_json,
                status, requires_confirm, approval_request_id, created_at, updated_at
            ) VALUES (?, ?, ?, 'apply', '{}', '{}', 'proposed', 0, NULL, datetime('now'), datetime('now'))"
        )
        .bind(tenant_id)
        .bind(tenant_id)
        .bind(work_item_id)
        .execute(pool)
        .await
        .unwrap();

        work_item_id
    }

    async fn seed_policy(pool: &SqlitePool, tenant_id: i64, mode: &str) {
        sqlx::query(
            "INSERT INTO companion_autonomy_policy (
                tenant_id, mode, breaker_thresholds_json, allowlists_json, budgets_json, updated_at
            ) VALUES (?, ?, '{}', '{}', '{}', datetime('now'))"
        )
        .bind(tenant_id)
        .bind(mode)
        .execute(pool)
        .await
        .unwrap();
    }

    async fn seed_active_ai_settings(pool: &SqlitePool, business_id: i64) {
        store::upsert_ai_settings(
            pool,
            business_id,
            true,
            false,
            "drafts",
            60,
            "1000",
            "2.5",
            "0.25",
        )
        .await
        .unwrap();
    }

    async fn seed_core_bank_data(pool: &SqlitePool, tenant_id: i64) {
        sqlx::query(
            "CREATE TABLE core_bankaccount (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER NOT NULL
            )"
        )
        .execute(pool)
        .await
        .unwrap();

        sqlx::query(
            "CREATE TABLE core_banktransaction (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bank_account_id INTEGER NOT NULL,
                description TEXT,
                amount REAL,
                date TEXT NOT NULL,
                status TEXT NOT NULL,
                category_id INTEGER
            )"
        )
        .execute(pool)
        .await
        .unwrap();

        sqlx::query("INSERT INTO core_bankaccount (id, business_id) VALUES (?, ?)")
            .bind(1)
            .bind(tenant_id)
            .execute(pool)
            .await
            .unwrap();

        sqlx::query(
            "INSERT INTO core_banktransaction (bank_account_id, description, amount, date, status, category_id)
             VALUES (?, ?, ?, ?, ?, NULL)"
        )
        .bind(1)
        .bind("Test transaction")
        .bind(120.0)
        .bind("2025-01-10")
        .bind("NEW")
        .execute(pool)
        .await
        .unwrap();
    }

    async fn action_id_for_work_item(pool: &SqlitePool, work_item_id: i64) -> i64 {
        sqlx::query_scalar::<_, i64>(
            "SELECT id FROM companion_autonomy_action_recommendations WHERE work_item_id = ?"
        )
        .bind(work_item_id)
        .fetch_one(pool)
        .await
        .unwrap()
    }

    fn assert_success_metadata(
        body: &serde_json::Value,
        result_state: &str,
        message: &str,
        request_id: &str,
    ) {
        assert_eq!(body["ok"], true);
        assert_eq!(body["result_state"], result_state);
        assert_eq!(body["message"], message);
        assert_eq!(body["request_id"], request_id);
    }

    #[tokio::test]
    async fn cockpit_requires_auth() {
        let (server, _pool) = setup().await;
        let response = server.get("/api/companion/cockpit/queues").await;
        response.assert_status(StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn cockpit_status_requires_auth() {
        let (server, _pool) = setup().await;
        let response = server.get("/api/companion/cockpit/status").await;
        response.assert_status(StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn cockpit_tenant_isolation() {
        let (server, pool) = setup().await;
        seed_work_item(&pool, 1, "Tenant A item").await;
        seed_work_item(&pool, 2, "Tenant B item").await;

        let token = make_token(1);
        let response = server
            .get("/api/companion/cockpit/queues")
            .add_header("authorization", format!("Bearer {}", token))
            .await;
        response.assert_status_ok();
        let body: serde_json::Value = response.json();
        let items = body["data"]["ready_queue"].as_array().unwrap();
        let titles: Vec<String> = items
            .iter()
            .filter_map(|item| item.get("title").and_then(|v| v.as_str()).map(|s| s.to_string()))
            .collect();
        assert!(titles.contains(&"Tenant A item".to_string()));
        assert!(!titles.contains(&"Tenant B item".to_string()));
    }

    #[tokio::test]
    async fn cockpit_status_tenant_isolation() {
        let (server, pool) = setup().await;
        seed_policy(&pool, 1, "drafts").await;
        seed_policy(&pool, 2, "autopilot_limited").await;

        let token = make_token(1);
        let response = server
            .get("/api/companion/cockpit/status")
            .add_header("authorization", format!("Bearer {}", token))
            .await;
        response.assert_status_ok();
        let body: serde_json::Value = response.json();
        assert_eq!(body["mode"], "drafts");
    }

    #[tokio::test]
    async fn autonomy_status_requires_auth() {
        let (server, _pool) = setup().await;
        let response = server.get("/api/companion/autonomy/status").await;
        response.assert_status(StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn companion_routes_echo_explicit_request_ids() {
        let (server, pool) = setup().await;
        seed_policy(&pool, 1, "drafts").await;

        let token = make_token(1);
        let response = server
            .get("/api/companion/cockpit/status")
            .add_header("authorization", format!("Bearer {}", token))
            .add_header("x-request-id", "companion-header-01")
            .await;
        response.assert_status_ok();
        assert_eq!(
            response.header("x-request-id").to_str().unwrap(),
            "companion-header-01"
        );
    }

    #[tokio::test]
    async fn companion_routes_echo_request_ids_on_errors() {
        let (server, _pool) = setup().await;
        let response = server
            .get("/api/companion/cockpit/queues")
            .add_header("x-request-id", "companion-error-01")
            .await;
        response.assert_status(StatusCode::UNAUTHORIZED);
        assert_eq!(
            response.header("x-request-id").to_str().unwrap(),
            "companion-error-01"
        );
        let body: serde_json::Value = response.json();
        assert_eq!(body["ok"], false);
        assert_eq!(body["result_state"], "failed");
        assert_eq!(body["error_type"], "unauthorized");
        assert_eq!(
            body["error_code"],
            "AUTONOMY_UNAUTHORIZED_COMPANIONERR"
        );
        assert_eq!(body["request_id"], "companion-error-01");
        assert_eq!(body["http_status"], 401);
    }

    #[tokio::test]
    async fn companion_routes_generate_request_ids_when_missing() {
        let (server, pool) = setup().await;
        seed_policy(&pool, 1, "drafts").await;

        let token = make_token(1);
        let response = server
            .get("/api/companion/cockpit/status")
            .add_header("authorization", format!("Bearer {}", token))
            .await;
        response.assert_status_ok();
        assert!(!response.header("x-request-id").to_str().unwrap().trim().is_empty());
    }

    #[tokio::test]
    async fn autonomy_mutations_include_success_request_metadata() {
        let (server, pool) = setup().await;
        let work_item_id = seed_work_item(&pool, 1, "Dismiss me").await;

        let token = make_token(1);
        let response = server
            .post(&format!("/api/companion/autonomy/work/{}/dismiss", work_item_id))
            .add_header("authorization", format!("Bearer {}", token))
            .add_header("x-request-id", "autonomy-success-01")
            .json(&serde_json::json!({
                "note": "no longer relevant",
                "reason_code": "resolved_elsewhere"
            }))
            .await;

        response.assert_status_ok();
        assert_eq!(
            response.header("x-request-id").to_str().unwrap(),
            "autonomy-success-01"
        );
        let body: serde_json::Value = response.json();
        assert_eq!(body["ok"], true);
        assert_eq!(body["dismissed"], true);
        assert_eq!(body["result_state"], "updated");
        assert_eq!(body["message"], "Work item dismissal processed");
        assert_eq!(body["request_id"], "autonomy-success-01");
    }

    #[tokio::test]
    async fn autonomy_workflow_mutation_routes_emit_parity_metadata() {
        let (server, pool) = setup().await;
        let token = make_token(1);

        let snooze_item_id = seed_work_item(&pool, 1, "Snooze me").await;
        let snooze_response = server
            .post(&format!("/api/companion/autonomy/work/{}/snooze", snooze_item_id))
            .add_header("authorization", format!("Bearer {}", token))
            .add_header("x-request-id", "autonomy-snooze-01")
            .json(&serde_json::json!({
                "until": "2026-03-07T00:00:00Z"
            }))
            .await;
        snooze_response.assert_status_ok();
        let snooze_body: serde_json::Value = snooze_response.json();
        assert_success_metadata(
            &snooze_body,
            "updated",
            "Work item snooze processed",
            "autonomy-snooze-01",
        );
        assert_eq!(snooze_body["snoozed"], true);

        let approval_item_id = seed_work_item(&pool, 1, "Approve me").await;
        let create_response = server
            .post(&format!(
                "/api/companion/autonomy/work/{}/request-approval",
                approval_item_id
            ))
            .add_header("authorization", format!("Bearer {}", token))
            .add_header("x-request-id", "autonomy-request-approval-01")
            .json(&serde_json::json!({
                "reason_required": false
            }))
            .await;
        create_response.assert_status_ok();
        let create_body: serde_json::Value = create_response.json();
        assert_success_metadata(
            &create_body,
            "created",
            "Approval request created",
            "autonomy-request-approval-01",
        );
        let approval_id = create_body["approval"]["id"].as_i64().unwrap();

        let approve_response = server
            .post(&format!("/api/companion/autonomy/approval/{}/approve", approval_id))
            .add_header("authorization", format!("Bearer {}", token))
            .add_header("x-request-id", "autonomy-approve-01")
            .json(&serde_json::json!({}))
            .await;
        approve_response.assert_status_ok();
        let approve_body: serde_json::Value = approve_response.json();
        assert_success_metadata(
            &approve_body,
            "updated",
            "Approval request approved",
            "autonomy-approve-01",
        );
        assert_eq!(approve_body["approved"], true);

        let reject_item_id = seed_work_item(&pool, 1, "Reject me").await;
        let reject_create_response = server
            .post(&format!(
                "/api/companion/autonomy/work/{}/request-approval",
                reject_item_id
            ))
            .add_header("authorization", format!("Bearer {}", token))
            .add_header("x-request-id", "autonomy-request-approval-02")
            .json(&serde_json::json!({
                "reason_required": true
            }))
            .await;
        reject_create_response.assert_status_ok();
        let reject_create_body: serde_json::Value = reject_create_response.json();
        let reject_approval_id = reject_create_body["approval"]["id"].as_i64().unwrap();

        let reject_response = server
            .post(&format!("/api/companion/autonomy/approval/{}/reject", reject_approval_id))
            .add_header("authorization", format!("Bearer {}", token))
            .add_header("x-request-id", "autonomy-reject-01")
            .json(&serde_json::json!({
                "reason_text": "needs manual review"
            }))
            .await;
        reject_response.assert_status_ok();
        let reject_body: serde_json::Value = reject_response.json();
        assert_success_metadata(
            &reject_body,
            "updated",
            "Approval request rejected",
            "autonomy-reject-01",
        );
        assert_eq!(reject_body["rejected"], true);
    }

    #[tokio::test]
    async fn autonomy_action_mutation_routes_emit_parity_metadata() {
        let (server, pool) = setup().await;
        let token = make_token(1);
        seed_active_ai_settings(&pool, 1).await;

        let apply_item_id = seed_work_item(&pool, 1, "Apply action").await;
        let apply_action_id = action_id_for_work_item(&pool, apply_item_id).await;
        let apply_response = server
            .post(&format!("/api/companion/autonomy/actions/{}/apply", apply_action_id))
            .add_header("authorization", format!("Bearer {}", token))
            .add_header("x-request-id", "autonomy-apply-action-01")
            .await;
        apply_response.assert_status_ok();
        let apply_body: serde_json::Value = apply_response.json();
        assert_success_metadata(
            &apply_body,
            "completed",
            "Action apply processed",
            "autonomy-apply-action-01",
        );
        assert_eq!(apply_body["applied"], true);

        let batch_item_one = seed_work_item(&pool, 1, "Batch one").await;
        let batch_item_two = seed_work_item(&pool, 1, "Batch two").await;
        let batch_action_one = action_id_for_work_item(&pool, batch_item_one).await;
        let batch_action_two = action_id_for_work_item(&pool, batch_item_two).await;
        let batch_response = server
            .post("/api/companion/autonomy/actions/batch-apply")
            .add_header("authorization", format!("Bearer {}", token))
            .add_header("x-request-id", "autonomy-batch-apply-01")
            .json(&serde_json::json!({
                "action_ids": [batch_action_one, batch_action_two]
            }))
            .await;
        batch_response.assert_status_ok();
        let batch_body: serde_json::Value = batch_response.json();
        assert_success_metadata(
            &batch_body,
            "completed",
            "Batch action apply processed",
            "autonomy-batch-apply-01",
        );
        assert_eq!(batch_body["results"].as_array().unwrap().len(), 2);
    }

    #[tokio::test]
    async fn autonomy_staff_mutation_routes_emit_parity_metadata() {
        let (server, pool) = setup().await;
        let token = make_token(1);
        seed_core_bank_data(&pool, 1).await;

        let tick_response = server
            .post("/api/companion/autonomy/tick")
            .add_header("authorization", format!("Bearer {}", token))
            .add_header("x-request-id", "autonomy-tick-01")
            .json(&serde_json::json!({
                "tenant_id": 1,
                "business_id": 1
            }))
            .await;
        tick_response.assert_status_ok();
        let tick_body: serde_json::Value = tick_response.json();
        assert_success_metadata(
            &tick_body,
            "completed",
            "Engine tick completed",
            "autonomy-tick-01",
        );

        let materialize_response = server
            .post("/api/companion/autonomy/materialize")
            .add_header("authorization", format!("Bearer {}", token))
            .add_header("x-request-id", "autonomy-materialize-01")
            .json(&serde_json::json!({
                "tenant_id": 1,
                "business_id": 1,
                "max_age_minutes": 15
            }))
            .await;
        materialize_response.assert_status_ok();
        let materialize_body: serde_json::Value = materialize_response.json();
        assert_success_metadata(
            &materialize_body,
            "completed",
            "Engine materialize completed",
            "autonomy-materialize-01",
        );

        let policy_response = server
            .post("/api/companion/autonomy/policy")
            .add_header("authorization", format!("Bearer {}", token))
            .add_header("x-request-id", "autonomy-policy-01")
            .json(&serde_json::json!({
                "mode": "drafts",
                "budgets": { "runs_per_day": 25 }
            }))
            .await;
        policy_response.assert_status_ok();
        let policy_body: serde_json::Value = policy_response.json();
        assert_success_metadata(
            &policy_body,
            "updated",
            "Autonomy policy updated",
            "autonomy-policy-01",
        );
    }

    #[test]
    fn resolve_tenant_id_requires_context() {
        let headers = HeaderMap::new();
        let result = resolve_tenant_id(&headers, None);
        assert!(matches!(result, Err((StatusCode::BAD_REQUEST, _))));
    }
}
