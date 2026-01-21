use sqlx::{postgres::PgPoolOptions, PgPool};

use crate::config::AppConfig;

pub async fn init_db_pool(config: &AppConfig) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(5)
        .connect(&config.database_url)
        .await
}
