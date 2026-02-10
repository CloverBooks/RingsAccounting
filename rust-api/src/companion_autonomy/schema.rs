use sqlx::SqlitePool;

pub async fn run_migrations(pool: &SqlitePool) -> Result<(), sqlx::migrate::MigrateError> {
    // Ensure legacy core tables exist for migrations that extend them in fresh in-memory DBs.
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS core_business (
            id INTEGER PRIMARY KEY,
            currency TEXT NOT NULL DEFAULT 'CAD',
            is_deleted INTEGER NOT NULL DEFAULT 0
        )"
    )
    .execute(pool)
    .await
    .map_err(sqlx::migrate::MigrateError::Execute)?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS core_item (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            business_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            sku TEXT,
            description TEXT,
            price REAL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )"
    )
    .execute(pool)
    .await
    .map_err(sqlx::migrate::MigrateError::Execute)?;

    sqlx::migrate!("./migrations").run(pool).await
}

pub async fn auto_init(pool: &SqlitePool) -> Result<(), sqlx::migrate::MigrateError> {
    if std::env::var("CAE_SCHEMA_AUTOINIT").ok().as_deref() == Some("1") {
        run_migrations(pool).await?;
    }
    Ok(())
}
