//! Clover Books - High-Performance Rust API
//!
//! Fast async API built with Axum for authentication, banking, and core business logic.
//! Proxies to Django backend for complex accounting operations.

use axum::{
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod routes;

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "clover_api=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load environment variables
    dotenvy::dotenv().ok();

    // Configure CORS for frontend
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Shared state for banking routes
    let banking_state = Arc::new(routes::banking::BankingState::default());

    // Build router
    let app = Router::new()
        // Health check
        .route("/health", get(|| async { "OK" }))
        // Auth routes
        .route("/api/auth/login", post(routes::auth::login))
        .route("/api/auth/signup", post(routes::auth::signup))
        .route("/api/auth/me", get(routes::auth::me))
        .route("/api/auth/logout", post(routes::auth::logout))
        .route("/api/auth/config", get(routes::auth::config))
        // Banking routes (proxy to Django)
        .route("/api/banking/health", get(routes::banking::health))
        .route(
            "/api/banking/find-matches",
            post(routes::banking::find_matches),
        )
        .route(
            "/api/banking/confirm-match",
            post(routes::banking::confirm_match),
        )
        .route("/api/banking/allocate", post(routes::banking::allocate))
        .route(
            "/api/banking/progress/:account_id",
            get(routes::banking::get_progress),
        )
        .route(
            "/api/banking/check-duplicates",
            post(routes::banking::check_duplicates),
        )
        // Add shared state for banking
        .with_state(banking_state)
        // Add middleware
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], 3001));
    tracing::info!("🚀 Clover API starting on http://{}", addr);
    tracing::info!("📊 Banking routes: /api/banking/*");

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
