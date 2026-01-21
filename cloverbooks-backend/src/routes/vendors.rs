use axum::{extract::State, Json};
use sqlx::query_as;

use crate::{
    config::get_config,
    error::{AppError, AppResult},
    models::{CreateVendorRequest, Vendor},
    AppState,
};

pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/", axum::routing::post(create_vendor).get(list_vendors))
}

async fn create_vendor(
    State(state): State<AppState>,
    Json(payload): Json<CreateVendorRequest>,
) -> AppResult<Json<Vendor>> {
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
                    "CA vendors require fin and transit".to_string(),
                ));
            }
        }
        "US" => {
            if payload.aba_routing.as_deref().unwrap_or("").is_empty() {
                return Err(AppError::Validation(
                    "US vendors require aba_routing".to_string(),
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

    let vendor = query_as::<_, Vendor>(
        r#"INSERT INTO vendors (name, email, country, fin, transit, account, aba_routing)
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

    Ok(Json(vendor))
}

async fn list_vendors(State(state): State<AppState>) -> AppResult<Json<Vec<Vendor>>> {
    let vendors = query_as::<_, Vendor>(
        r#"SELECT id, name, email, country, fin, transit, account, aba_routing, created_at
        FROM vendors
        ORDER BY created_at DESC"#,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(vendors))
}
