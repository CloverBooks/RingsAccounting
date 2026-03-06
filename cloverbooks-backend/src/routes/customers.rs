use axum::{extract::{Path, State}, Json};
use sqlx::query_as;

use crate::{
    config::get_config,
    error::{AppError, AppResult},
    models::{CreateCustomerRequest, Customer},
    AppState,
};

#[derive(serde::Serialize)]
struct DisabledResponse {
    ok: bool,
    status: &'static str,
    message: String,
}

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
    State(_state): State<AppState>,
    Path(_id): Path<String>,
) -> AppResult<Json<DisabledResponse>> {
    Ok(Json(DisabledResponse {
        ok: true,
        status: "disabled",
        message: "This capability is disabled in the current backend profile.".to_string(),
    }))
}
