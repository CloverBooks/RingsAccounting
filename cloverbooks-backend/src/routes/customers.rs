use axum::{extract::{Path, State}, Json};
use chrono::{DateTime, Utc};
use sqlx::query_as;
use uuid::Uuid;

use crate::{
    config::get_config,
    error::{AppError, AppResult},
    models::{CreateCustomerRequest, CreateMandateRequest, Customer, Mandate},
    AppState,
};

pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/", axum::routing::post(create_customer))
        .route("/:id/mandate", axum::routing::post(create_mandate))
}

async fn create_customer(
    State(state): State<AppState>,
    Json(payload): Json<CreateCustomerRequest>,
) -> AppResult<Json<Customer>> {
    let country = payload.country.trim().to_uppercase();
    let config = get_config();

    if !config.allowed_countries.contains(&country) {
        return Err(AppError::Validation("country must be CA or US".to_string()));
    }

    match country.as_str() {
        "CA" => {
            if payload.fin.as_deref().unwrap_or("").is_empty()
                || payload.transit.as_deref().unwrap_or("").is_empty()
            {
                return Err(AppError::Validation(
                    "CA customers require fin and transit".to_string(),
                ));
            }
        }
        "US" => {
            if payload.aba_routing.as_deref().unwrap_or("").is_empty() {
                return Err(AppError::Validation(
                    "US customers require aba_routing".to_string(),
                ));
            }
        }
        _ => {
            return Err(AppError::Validation("country must be CA or US".to_string()));
        }
    }

    if payload.account.trim().is_empty() {
        return Err(AppError::Validation("account is required".to_string()));
    }

    let customer = query_as::<_, Customer>(
        r#"INSERT INTO customers (name, email, country, fin, transit, account, aba_routing)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, name, email, country, fin, transit, account, aba_routing, created_at"#,
    )
    .bind(payload.name)
    .bind(payload.email)
    .bind(country)
    .bind(payload.fin)
    .bind(payload.transit)
    .bind(payload.account)
    .bind(payload.aba_routing)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(customer))
}

async fn create_mandate(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<CreateMandateRequest>,
) -> AppResult<Json<Mandate>> {
    let customer_id = Uuid::parse_str(&id)
        .map_err(|_| AppError::Validation("invalid customer id".to_string()))?;

    let customer = query_as::<_, Customer>(
        r#"SELECT id, name, email, country, fin, transit, account, aba_routing, created_at
        FROM customers
        WHERE id = $1"#,
    )
    .bind(customer_id)
    .fetch_one(&state.db)
    .await?;

    let mandate_type = payload.mandate_type.trim().to_uppercase();
    match (customer.country.as_str(), mandate_type.as_str()) {
        ("CA", "PAD") => {}
        ("US", "ACH") => {}
        _ => {
            return Err(AppError::Validation(
                "mandate type must match customer country".to_string(),
            ));
        }
    }

    let signed_at = DateTime::parse_from_rfc3339(&payload.signed_at)
        .map_err(|_| AppError::Validation("signed_at must be RFC3339".to_string()))?
        .with_timezone(&Utc);

    let metadata = payload.metadata.unwrap_or_else(|| serde_json::json!({}));

    let mandate = query_as::<_, Mandate>(
        r#"INSERT INTO mandates (customer_id, mandate_type, signed_at, metadata)
        VALUES ($1, $2, $3, $4)
        RETURNING id, customer_id, mandate_type, signed_at, metadata, created_at"#,
    )
    .bind(customer.id)
    .bind(mandate_type)
    .bind(signed_at)
    .bind(metadata)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(mandate))
}
