use axum::Router;

use crate::AppState;

pub mod bills;
pub mod customers;
pub mod invoices;
pub mod vendors;
pub mod webhooks;

pub fn api_router(state: AppState) -> Router {
    Router::new()
        .nest("/api/vendors", vendors::router())
        .nest("/api/bills", bills::router())
        .nest("/api/customers", customers::router())
        .nest("/api/invoices", invoices::router())
        .with_state(state)
}

pub fn webhook_router(state: AppState) -> Router {
    Router::new()
        .route("/webhooks/payment_status", axum::routing::post(webhooks::payment_status))
        .with_state(state)
}
