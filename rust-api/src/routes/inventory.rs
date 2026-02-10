//! Inventory ledger routes for Clover Books
//!
//! Provides item + inventory balance/event endpoints consumed by the React UI.

use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::{Sqlite, Transaction};

use crate::AppState;
use crate::routes::auth::extract_claims_from_header;

// =============================================================================
// Types
// =============================================================================

#[derive(Debug, Deserialize)]
pub struct InventoryQuery {
    pub workspace_id: Option<i64>,
    pub business_id: Option<i64>,
    pub item_id: Option<i64>,
    pub location_id: Option<i64>,
    pub limit: Option<i64>,
    pub status: Option<String>,
    pub q: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct InventoryItemResponse {
    pub id: i64,
    pub workspace: i64,
    pub name: String,
    pub sku: String,
    pub item_type: String,
    pub costing_method: String,
    pub default_uom: String,
    pub asset_account: Option<i64>,
    pub cogs_account: Option<i64>,
    pub revenue_account: Option<i64>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
    pub kind: String,
    pub track_inventory: bool,
    pub qty_on_hand: String,
    pub last_movement_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct InventoryLocationResponse {
    pub id: i64,
    pub workspace: i64,
    pub name: String,
    pub code: String,
    pub location_type: String,
    pub parent: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct InventoryBalanceResponse {
    pub id: i64,
    pub workspace: i64,
    pub item: i64,
    pub location: i64,
    pub qty_on_hand: String,
    pub qty_committed: String,
    pub qty_on_order: String,
    pub qty_available: String,
    pub last_event: Option<i64>,
    pub last_updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct InventoryEventResponse {
    pub id: i64,
    pub workspace: i64,
    pub item: i64,
    pub location: i64,
    pub event_type: String,
    pub quantity_delta: String,
    pub unit_cost: Option<String>,
    pub source_reference: String,
    pub purchase_document: Option<i64>,
    pub batch_reference: String,
    pub metadata: serde_json::Value,
    pub actor_type: String,
    pub actor_id: String,
    pub created_by: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct ReceivePayload {
    pub workspace_id: i64,
    pub item_id: i64,
    pub location_id: Option<i64>,
    #[serde(alias = "qty")]
    pub quantity: String,
    pub unit_cost: Option<String>,
    pub po_reference: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ShipPayload {
    pub workspace_id: i64,
    pub item_id: i64,
    pub location_id: Option<i64>,
    #[serde(alias = "qty")]
    pub quantity: String,
    pub so_reference: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AdjustPayload {
    pub workspace_id: i64,
    pub item_id: i64,
    pub location_id: Option<i64>,
    #[serde(alias = "qty_new")]
    pub physical_qty: String,
    pub reason_code: String,
}

#[derive(Debug, Serialize)]
pub struct ListResponse<T> {
    pub results: Vec<T>,
}

#[derive(Debug, Serialize)]
#[allow(dead_code)]
pub struct InventoryMutationResponse {
    pub ok: bool,
    pub event_id: i64,
    pub new_qty_on_hand: String,
    pub location_id: i64,
}

// =============================================================================
// Helpers
// =============================================================================

fn parse_qty(raw: &str) -> Result<f64, String> {
    let qty = raw.trim().parse::<f64>().map_err(|_| "Invalid quantity".to_string())?;
    if !qty.is_finite() || qty < 0.0 {
        return Err("Quantity must be >= 0".to_string());
    }
    Ok(qty)
}

fn fmt_qty(value: f64) -> String {
    if !value.is_finite() {
        "0".to_string()
    } else {
        let trimmed = format!("{:.4}", value);
        trimmed.trim_end_matches('0').trim_end_matches('.').to_string()
    }
}

fn resolve_business_id(headers: &HeaderMap, query: &InventoryQuery) -> i64 {
    if let Ok(claims) = extract_claims_from_header(headers) {
        if let Some(bid) = claims.business_id {
            return bid;
        }
    }
    query.business_id.or(query.workspace_id).unwrap_or_else(|| {
        tracing::warn!("Inventory routes using default business_id=1 without authentication.");
        1
    })
}

async fn ensure_default_location(tx: &mut Transaction<'_, Sqlite>, business_id: i64) -> Result<i64, sqlx::Error> {
    if let Some(id) = sqlx::query_scalar::<_, i64>(
        "SELECT id FROM inv_location WHERE business_id = ? AND is_active = 1 ORDER BY id LIMIT 1"
    )
    .bind(business_id)
    .fetch_optional(&mut **tx)
    .await? {
        return Ok(id);
    }

    let result = sqlx::query(
        "INSERT INTO inv_location (business_id, name, code, is_active, created_at, updated_at)
         VALUES (?, 'Main Warehouse', 'MAIN', 1, datetime('now'), datetime('now'))"
    )
    .bind(business_id)
    .execute(&mut **tx)
    .await?;

    Ok(result.last_insert_rowid())
}

async fn ensure_trackable_item(
    tx: &mut Transaction<'_, Sqlite>,
    business_id: i64,
    item_id: i64,
) -> Result<(), (StatusCode, String)> {
    let row = sqlx::query_scalar::<_, i64>(
        "SELECT track_inventory FROM core_item WHERE id = ? AND business_id = ?"
    )
    .bind(item_id)
    .bind(business_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to load item".to_string()))?;

    match row {
        Some(flag) if flag == 1 => Ok(()),
        Some(_) => Err((StatusCode::BAD_REQUEST, "Item is not inventory-tracked".to_string())),
        None => Err((StatusCode::NOT_FOUND, "Item not found".to_string())),
    }
}

async fn apply_receive(
    tx: &mut Transaction<'_, Sqlite>,
    business_id: i64,
    item_id: i64,
    location_id: i64,
    qty: f64,
    unit_cost: Option<f64>,
    memo: Option<String>,
) -> Result<(i64, f64), String> {
    let current_qty: f64 = sqlx::query_scalar(
        "SELECT qty_on_hand FROM inv_balance WHERE business_id = ? AND item_id = ? AND location_id = ?"
    )
    .bind(business_id)
    .bind(item_id)
    .bind(location_id)
    .fetch_optional(&mut **tx)
    .await
    .unwrap_or(Some(0.0))
    .unwrap_or(0.0);

    let event_result = sqlx::query(
        "INSERT INTO inv_event (business_id, item_id, location_id, event_type, qty, unit_cost, memo, created_at)
         VALUES (?, ?, ?, 'receive', ?, ?, ?, datetime('now'))"
    )
    .bind(business_id)
    .bind(item_id)
    .bind(location_id)
    .bind(qty)
    .bind(unit_cost)
    .bind(memo)
    .execute(&mut **tx)
    .await
    .map_err(|_| "Failed to insert event".to_string())?;

    sqlx::query(
        "INSERT INTO inv_balance (business_id, item_id, location_id, qty_on_hand, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(business_id, item_id, location_id) DO UPDATE SET
           qty_on_hand = qty_on_hand + excluded.qty_on_hand,
           updated_at = datetime('now')"
    )
    .bind(business_id)
    .bind(item_id)
    .bind(location_id)
    .bind(qty)
    .execute(&mut **tx)
    .await
    .map_err(|_| "Failed to update balance".to_string())?;

    let new_qty = current_qty + qty;

    Ok((event_result.last_insert_rowid(), new_qty))
}

async fn apply_ship(
    tx: &mut Transaction<'_, Sqlite>,
    business_id: i64,
    item_id: i64,
    location_id: i64,
    qty: f64,
    memo: Option<String>,
) -> Result<(i64, f64), String> {
    let current_qty: f64 = sqlx::query_scalar(
        "SELECT qty_on_hand FROM inv_balance WHERE business_id = ? AND item_id = ? AND location_id = ?"
    )
    .bind(business_id)
    .bind(item_id)
    .bind(location_id)
    .fetch_optional(&mut **tx)
    .await
    .unwrap_or(Some(0.0))
    .unwrap_or(0.0);

    if current_qty < qty {
        return Err("Insufficient stock".to_string());
    }

    let event_result = sqlx::query(
        "INSERT INTO inv_event (business_id, item_id, location_id, event_type, qty, unit_cost, memo, created_at)
         VALUES (?, ?, ?, 'ship', ?, NULL, ?, datetime('now'))"
    )
    .bind(business_id)
    .bind(item_id)
    .bind(location_id)
    .bind(-qty)
    .bind(memo)
    .execute(&mut **tx)
    .await
    .map_err(|_| "Failed to insert event".to_string())?;

    sqlx::query(
        "INSERT INTO inv_balance (business_id, item_id, location_id, qty_on_hand, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(business_id, item_id, location_id) DO UPDATE SET
           qty_on_hand = qty_on_hand + excluded.qty_on_hand,
           updated_at = datetime('now')"
    )
    .bind(business_id)
    .bind(item_id)
    .bind(location_id)
    .bind(-qty)
    .execute(&mut **tx)
    .await
    .map_err(|_| "Failed to update balance".to_string())?;

    Ok((event_result.last_insert_rowid(), current_qty - qty))
}

async fn apply_adjust(
    tx: &mut Transaction<'_, Sqlite>,
    business_id: i64,
    item_id: i64,
    location_id: i64,
    physical_qty: f64,
    memo: Option<String>,
) -> Result<(i64, f64), String> {
    let current_qty: f64 = sqlx::query_scalar(
        "SELECT qty_on_hand FROM inv_balance WHERE business_id = ? AND item_id = ? AND location_id = ?"
    )
    .bind(business_id)
    .bind(item_id)
    .bind(location_id)
    .fetch_optional(&mut **tx)
    .await
    .unwrap_or(Some(0.0))
    .unwrap_or(0.0);

    let delta = physical_qty - current_qty;

    let event_result = sqlx::query(
        "INSERT INTO inv_event (business_id, item_id, location_id, event_type, qty, unit_cost, memo, created_at)
         VALUES (?, ?, ?, 'adjust', ?, NULL, ?, datetime('now'))"
    )
    .bind(business_id)
    .bind(item_id)
    .bind(location_id)
    .bind(delta)
    .bind(memo)
    .execute(&mut **tx)
    .await
    .map_err(|_| "Failed to insert event".to_string())?;

    sqlx::query(
        "INSERT INTO inv_balance (business_id, item_id, location_id, qty_on_hand, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(business_id, item_id, location_id) DO UPDATE SET
           qty_on_hand = excluded.qty_on_hand,
           updated_at = datetime('now')"
    )
    .bind(business_id)
    .bind(item_id)
    .bind(location_id)
    .bind(physical_qty)
    .execute(&mut **tx)
    .await
    .map_err(|_| "Failed to update balance".to_string())?;

    Ok((event_result.last_insert_rowid(), physical_qty))
}

// =============================================================================
// List Endpoints
// =============================================================================

pub async fn list_inventory_items(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<InventoryQuery>,
) -> impl IntoResponse {
    let business_id = resolve_business_id(&headers, &params);
    let status_filter = params.status.unwrap_or_else(|| "active".to_string()).to_lowercase();
    let query = params.q.unwrap_or_default().to_lowercase();

    let rows = sqlx::query_as::<_, (i64, String, Option<String>, Option<String>, Option<f64>, bool, String, i64, String, String)>(
        "SELECT i.id, i.name, i.sku, i.description, i.price, i.is_active, i.kind, i.track_inventory,
                i.created_at, i.updated_at
         FROM core_item i
         WHERE i.business_id = ? AND i.track_inventory = 1
         ORDER BY i.name"
    )
    .bind(business_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let mut items = Vec::new();
    for (id, name, sku, _description, _price, is_active, kind, track_inventory, created_at, updated_at) in rows {
        let status = if is_active { "active" } else { "archived" };
        if status_filter != "all" && status_filter != status {
            continue;
        }
        if !query.is_empty() {
            let hay = format!("{} {}", name.to_lowercase(), sku.clone().unwrap_or_default().to_lowercase());
            if !hay.contains(&query) {
                continue;
            }
        }

        let qty_on_hand: f64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(qty_on_hand), 0) FROM inv_balance WHERE business_id = ? AND item_id = ?"
        )
        .bind(business_id)
        .bind(id)
        .fetch_one(&state.db)
        .await
        .unwrap_or(0.0);

        let last_movement_at: Option<String> = sqlx::query_scalar(
            "SELECT MAX(created_at) FROM inv_event WHERE business_id = ? AND item_id = ?"
        )
        .bind(business_id)
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

        items.push(InventoryItemResponse {
            id,
            workspace: business_id,
            name,
            sku: sku.clone().unwrap_or_else(|| format!("ITEM-{}", id)),
            item_type: "stocked".to_string(),
            costing_method: "fifo".to_string(),
            default_uom: "each".to_string(),
            asset_account: None,
            cogs_account: None,
            revenue_account: None,
            is_active,
            created_at,
            updated_at,
            kind: kind.to_lowercase(),
            track_inventory: track_inventory == 1,
            qty_on_hand: fmt_qty(qty_on_hand),
            last_movement_at,
        });
    }

    (StatusCode::OK, Json(ListResponse { results: items }))
}

pub async fn list_inventory_locations(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<InventoryQuery>,
) -> impl IntoResponse {
    let business_id = resolve_business_id(&headers, &params);
    let rows = sqlx::query_as::<_, (i64, String, Option<String>, i64, String, String)>(
        "SELECT id, name, code, is_active, created_at, updated_at
         FROM inv_location
         WHERE business_id = ? AND is_active = 1
         ORDER BY name"
    )
    .bind(business_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let locations = rows
        .into_iter()
        .map(|(id, name, code, _is_active, created_at, updated_at)| InventoryLocationResponse {
            id,
            workspace: business_id,
            name,
            code: code.unwrap_or_else(|| "MAIN".to_string()),
            location_type: "warehouse".to_string(),
            parent: None,
            created_at,
            updated_at,
        })
        .collect();

    (StatusCode::OK, Json(ListResponse { results: locations }))
}

pub async fn list_inventory_balances(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<InventoryQuery>,
) -> impl IntoResponse {
    let business_id = resolve_business_id(&headers, &params);
    let item_id = params.item_id;
    let location_id = params.location_id;

    let mut sql = "SELECT b.id, b.item_id, b.location_id, b.qty_on_hand, b.updated_at FROM inv_balance b WHERE b.business_id = ?".to_string();
    if item_id.is_some() {
        sql.push_str(" AND b.item_id = ?");
    }
    if location_id.is_some() {
        sql.push_str(" AND b.location_id = ?");
    }
    sql.push_str(" ORDER BY b.updated_at DESC");

    let mut query = sqlx::query_as::<_, (i64, i64, i64, f64, String)>(&sql);
    query = query.bind(business_id);
    if let Some(id) = item_id {
        query = query.bind(id);
    }
    if let Some(id) = location_id {
        query = query.bind(id);
    }

    let rows = query.fetch_all(&state.db).await.unwrap_or_default();

    let balances = rows
        .into_iter()
        .map(|(id, item_id, location_id, qty_on_hand, updated_at)| InventoryBalanceResponse {
            id,
            workspace: business_id,
            item: item_id,
            location: location_id,
            qty_on_hand: fmt_qty(qty_on_hand),
            qty_committed: "0".to_string(),
            qty_on_order: "0".to_string(),
            qty_available: fmt_qty(qty_on_hand),
            last_event: None,
            last_updated_at: updated_at,
        })
        .collect();

    (StatusCode::OK, Json(ListResponse { results: balances }))
}

pub async fn list_inventory_events(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<InventoryQuery>,
) -> impl IntoResponse {
    let business_id = resolve_business_id(&headers, &params);
    let limit = params.limit.unwrap_or(50).max(1).min(500);

    let mut sql = "SELECT id, item_id, location_id, event_type, qty, unit_cost, memo, created_at FROM inv_event WHERE business_id = ?".to_string();
    if params.item_id.is_some() {
        sql.push_str(" AND item_id = ?");
    }
    if params.location_id.is_some() {
        sql.push_str(" AND location_id = ?");
    }
    sql.push_str(" ORDER BY created_at DESC LIMIT ?");

    let mut query = sqlx::query_as::<_, (i64, i64, i64, String, f64, Option<f64>, Option<String>, String)>(&sql);
    query = query.bind(business_id);
    if let Some(id) = params.item_id {
        query = query.bind(id);
    }
    if let Some(id) = params.location_id {
        query = query.bind(id);
    }
    query = query.bind(limit);

    let rows = query.fetch_all(&state.db).await.unwrap_or_default();
    let events = rows
        .into_iter()
        .map(|(id, item_id, location_id, event_type, qty, unit_cost, memo, created_at)| {
            let ui_event_type = match event_type.as_str() {
                "receive" => "STOCK_RECEIVED",
                "ship" => "STOCK_SHIPPED",
                "adjust" => "STOCK_ADJUSTED",
                _ => event_type.as_str(),
            };
            let metadata = if event_type == "adjust" {
                serde_json::json!({ "reason_code": memo.clone().unwrap_or_default() })
            } else {
                serde_json::json!({})
            };
            InventoryEventResponse {
                id,
                workspace: business_id,
                item: item_id,
                location: location_id,
                event_type: ui_event_type.to_string(),
                quantity_delta: fmt_qty(qty),
                unit_cost: unit_cost.map(fmt_qty),
                source_reference: memo.clone().unwrap_or_default(),
                purchase_document: None,
                batch_reference: memo.unwrap_or_default(),
                metadata,
                actor_type: "system".to_string(),
                actor_id: "system".to_string(),
                created_by: None,
                created_at,
            }
        })
        .collect();

    (StatusCode::OK, Json(ListResponse { results: events }))
}

// =============================================================================
// Mutation Endpoints
// =============================================================================

pub async fn receive_inventory(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<ReceivePayload>,
) -> impl IntoResponse {
    let business_id = resolve_business_id(&headers, &InventoryQuery {
        workspace_id: Some(payload.workspace_id),
        business_id: None,
        item_id: None,
        location_id: None,
        limit: None,
        status: None,
        q: None,
    });

    let qty = match parse_qty(&payload.quantity) {
        Ok(v) if v > 0.0 => v,
        _ => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Quantity must be > 0"}))),
    };
    let unit_cost = payload.unit_cost.as_deref().and_then(|v| v.parse::<f64>().ok());

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Failed to start transaction"}))),
    };

    if let Err((code, message)) = ensure_trackable_item(&mut tx, business_id, payload.item_id).await {
        return (code, Json(serde_json::json!({"error": message})));
    }

    let location_id = match payload.location_id {
        Some(id) => id,
        None => match ensure_default_location(&mut tx, business_id).await {
            Ok(id) => id,
            Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Failed to resolve location"}))),
        },
    };

    let (event_id, new_qty) = match apply_receive(
        &mut tx,
        business_id,
        payload.item_id,
        location_id,
        qty,
        unit_cost,
        payload.po_reference.clone(),
    )
    .await
    {
        Ok(res) => res,
        Err(message) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": message}))),
    };

    if let Err(_) = tx.commit().await {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Failed to commit transaction"})));
    }

    (StatusCode::OK, Json(serde_json::json!({
        "ok": true,
        "event_id": event_id,
        "new_qty_on_hand": fmt_qty(new_qty),
        "location_id": location_id
    })))
}

pub async fn ship_inventory(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<ShipPayload>,
) -> impl IntoResponse {
    let business_id = resolve_business_id(&headers, &InventoryQuery {
        workspace_id: Some(payload.workspace_id),
        business_id: None,
        item_id: None,
        location_id: None,
        limit: None,
        status: None,
        q: None,
    });

    let qty = match parse_qty(&payload.quantity) {
        Ok(v) if v > 0.0 => v,
        _ => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Quantity must be > 0"}))),
    };

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Failed to start transaction"}))),
    };

    if let Err((code, message)) = ensure_trackable_item(&mut tx, business_id, payload.item_id).await {
        return (code, Json(serde_json::json!({"error": message})));
    }

    let location_id = match payload.location_id {
        Some(id) => id,
        None => match ensure_default_location(&mut tx, business_id).await {
            Ok(id) => id,
            Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Failed to resolve location"}))),
        },
    };

    let (event_id, new_qty) = match apply_ship(
        &mut tx,
        business_id,
        payload.item_id,
        location_id,
        qty,
        payload.so_reference.clone(),
    )
    .await
    {
        Ok(res) => res,
        Err(message) => {
            let code = if message == "Insufficient stock" {
                StatusCode::BAD_REQUEST
            } else {
                StatusCode::INTERNAL_SERVER_ERROR
            };
            return (code, Json(serde_json::json!({"error": message})));
        }
    };
    if let Err(_) = tx.commit().await {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Failed to commit transaction"})));
    }

    (StatusCode::OK, Json(serde_json::json!({
        "ok": true,
        "event_id": event_id,
        "new_qty_on_hand": fmt_qty(new_qty),
        "location_id": location_id
    })))
}

pub async fn adjust_inventory(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<AdjustPayload>,
) -> impl IntoResponse {
    let business_id = resolve_business_id(&headers, &InventoryQuery {
        workspace_id: Some(payload.workspace_id),
        business_id: None,
        item_id: None,
        location_id: None,
        limit: None,
        status: None,
        q: None,
    });

    let physical_qty = match parse_qty(&payload.physical_qty) {
        Ok(v) => v,
        Err(message) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": message}))),
    };

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Failed to start transaction"}))),
    };

    if let Err((code, message)) = ensure_trackable_item(&mut tx, business_id, payload.item_id).await {
        return (code, Json(serde_json::json!({"error": message})));
    }

    let location_id = match payload.location_id {
        Some(id) => id,
        None => match ensure_default_location(&mut tx, business_id).await {
            Ok(id) => id,
            Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Failed to resolve location"}))),
        },
    };

    let (event_id, new_qty) = match apply_adjust(
        &mut tx,
        business_id,
        payload.item_id,
        location_id,
        physical_qty,
        Some(payload.reason_code.clone()),
    )
    .await
    {
        Ok(res) => res,
        Err(message) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": message}))),
    };

    if let Err(_) = tx.commit().await {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Failed to commit transaction"})));
    }

    (StatusCode::OK, Json(serde_json::json!({
        "ok": true,
        "event_id": event_id,
        "new_qty_on_hand": fmt_qty(new_qty),
        "location_id": location_id
    })))
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};

    async fn setup_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query(
            "CREATE TABLE core_business (
                id INTEGER PRIMARY KEY,
                currency TEXT NOT NULL DEFAULT 'CAD'
            );"
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "CREATE TABLE core_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                sku TEXT,
                description TEXT,
                price REAL,
                is_active INTEGER NOT NULL DEFAULT 1,
                kind TEXT NOT NULL DEFAULT 'product',
                track_inventory INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );"
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "CREATE TABLE inv_location (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                code TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(business_id, code)
            );"
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "CREATE TABLE inv_balance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER NOT NULL,
                item_id INTEGER NOT NULL,
                location_id INTEGER NOT NULL,
                qty_on_hand NUMERIC NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL,
                UNIQUE(business_id, item_id, location_id)
            );"
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "CREATE TABLE inv_event (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER NOT NULL,
                item_id INTEGER NOT NULL,
                location_id INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                qty NUMERIC NOT NULL,
                unit_cost NUMERIC,
                memo TEXT,
                created_at TEXT NOT NULL
            );"
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query("INSERT INTO core_business (id, currency) VALUES (1, 'CAD');")
            .execute(&pool)
            .await
            .unwrap();

        sqlx::query(
            "INSERT INTO core_item (business_id, name, sku, track_inventory) VALUES (1, 'Test Item', 'SKU-1', 1);"
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO inv_location (business_id, name, code, is_active, created_at, updated_at)
             VALUES (1, 'Main Warehouse', 'MAIN', 1, datetime('now'), datetime('now'));"
        )
        .execute(&pool)
        .await
        .unwrap();

        pool
    }

    #[tokio::test]
    async fn test_receive_increases_balance() {
        let pool = setup_db().await;
        let mut tx = pool.begin().await.unwrap();
        ensure_trackable_item(&mut tx, 1, 1).await.unwrap();

        let (event_id, new_qty) = apply_receive(&mut tx, 1, 1, 1, 5.0, None, None).await.unwrap();
        assert!(event_id > 0);
        assert_eq!(new_qty, 5.0);
        tx.commit().await.unwrap();
    }

    #[tokio::test]
    async fn test_ship_cannot_go_negative() {
        let pool = setup_db().await;
        let mut tx = pool.begin().await.unwrap();
        sqlx::query::<Sqlite>(
            "INSERT INTO inv_balance (business_id, item_id, location_id, qty_on_hand, updated_at)
             VALUES (1, 1, 1, 2, datetime('now'));"
        )
        .execute(&mut *tx)
        .await
        .unwrap();

        let result = apply_ship(&mut tx, 1, 1, 1, 5.0, None).await;
        assert!(result.is_err());
        tx.commit().await.unwrap();
    }

    #[tokio::test]
    async fn test_adjust_sets_balance() {
        let pool = setup_db().await;
        let mut tx = pool.begin().await.unwrap();
        sqlx::query::<Sqlite>(
            "INSERT INTO inv_balance (business_id, item_id, location_id, qty_on_hand, updated_at)
             VALUES (1, 1, 1, 2, datetime('now'));"
        )
        .execute(&mut *tx)
        .await
        .unwrap();

        let (_event_id, new_qty) = apply_adjust(&mut tx, 1, 1, 1, 7.0, Some("COUNT".to_string()))
            .await
            .unwrap();
        assert_eq!(new_qty, 7.0);
        tx.commit().await.unwrap();
    }

    #[tokio::test]
    async fn test_events_recorded() {
        let pool = setup_db().await;
        let mut tx = pool.begin().await.unwrap();
        let (event_id, _new_qty) = apply_receive(&mut tx, 1, 1, 1, 3.0, None, Some("PO-1".to_string()))
            .await
            .unwrap();
        assert!(event_id > 0);

        let count: i64 = sqlx::query_scalar::<Sqlite, i64>(
            "SELECT COUNT(*) FROM inv_event WHERE business_id = 1 AND item_id = 1"
        )
            .fetch_one(&mut *tx)
            .await
            .unwrap();
        tx.commit().await.unwrap();
        assert_eq!(count, 1);
    }
}
