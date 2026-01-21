mod config;
mod db;
mod error;
mod models;
mod payments;
mod routes;

use std::net::SocketAddr;
use std::sync::Arc;

use axum::Router;
use tracing_subscriber::EnvFilter;

use crate::config::get_config;
use crate::payments::adapter::PaymentProcessor;
use crate::payments::mock_gateway::MockGateway;

#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::PgPool,
    pub payment_processor: Arc<dyn PaymentProcessor>,
    pub config: config::AppConfig,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let config = get_config().clone();
    let db = db::init_db_pool(&config).await?;

    let payment_processor: Arc<dyn PaymentProcessor> = Arc::new(MockGateway::new());

    let state = AppState {
        db,
        payment_processor,
        config,
    };

    let app = Router::new()
        .merge(routes::api_router(state.clone()))
        .merge(routes::webhook_router(state));

    let addr = SocketAddr::from(([0, 0, 0, 0], get_config().app_port));
    tracing::info!("Clover Books API listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
