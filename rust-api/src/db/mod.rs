// Database connection module
// Provides SQLite connection pool for accessing the existing database

pub mod models;
pub mod queries;

use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use std::env;
use std::path::PathBuf;

/// Shared database state used across the application
#[derive(Clone)]
pub struct DbPool {
    pub pool: SqlitePool,
}

impl DbPool {
    /// Create a new database connection pool
    pub async fn new() -> Result<Self, sqlx::Error> {
        let database_url = get_database_url();
        
        let pool = SqlitePoolOptions::new()
            .max_connections(10)
            .connect(&database_url)
            .await?;
        
        tracing::info!("Connected to SQLite database");
        
        Ok(Self { pool })
    }
    
    /// Get the underlying pool reference
    #[allow(dead_code)]
    pub fn get(&self) -> &SqlitePool {
        &self.pool
    }
}

/// Get the database URL, defaulting to the SQLite database
fn get_database_url() -> String {
    if let Ok(url) = env::var("DATABASE_URL") {
        return url;
    }
    
    // Default: SQLite database in legacy/db folder
    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    path.pop(); // Go up from rust-api
    path.push("legacy");
    path.push("db");
    path.push("db.sqlite3");
    
    format!("sqlite:{}", path.display())
}

/// Ensure QBO parity fields exist in the `accounts` table and backfill baseline data.
/// This is idempotent and safe to run at startup.
pub async fn ensure_coa_qbo_parity(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    let has_accounts: Option<String> = sqlx::query_scalar(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'accounts'"
    )
    .fetch_optional(pool)
    .await?;

    if has_accounts.is_none() {
        tracing::warn!("accounts table not found; skipping COA parity bootstrap");
        return Ok(());
    }

    let add_columns = [
        "ALTER TABLE accounts ADD COLUMN account_number TEXT",
        "ALTER TABLE accounts ADD COLUMN detail_type TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE accounts ADD COLUMN classification TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE accounts ADD COLUMN system_account_kind TEXT",
        "ALTER TABLE accounts ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE accounts ADD COLUMN is_suspense INTEGER NOT NULL DEFAULT 0",
    ];

    for stmt in add_columns {
        if let Err(err) = sqlx::query(stmt).execute(pool).await {
            let msg = err.to_string().to_lowercase();
            if msg.contains("duplicate column name") {
                continue;
            }
            return Err(err);
        }
    }

    let backfill = [
        "UPDATE accounts
         SET account_number = code
         WHERE (account_number IS NULL OR account_number = '')
           AND code IS NOT NULL
           AND code <> ''",
        "UPDATE accounts
         SET classification = CASE UPPER(COALESCE(type, ''))
             WHEN 'ASSET' THEN 'Asset'
             WHEN 'LIABILITY' THEN 'Liability'
             WHEN 'EQUITY' THEN 'Equity'
             WHEN 'INCOME' THEN 'Revenue'
             WHEN 'EXPENSE' THEN 'Expense'
             ELSE 'Other'
         END
         WHERE classification = ''",
        "UPDATE accounts
         SET detail_type = CASE
             WHEN UPPER(COALESCE(type, '')) = 'ASSET' AND LOWER(COALESCE(name, '')) LIKE '%receivable%' THEN 'Accounts Receivable'
             WHEN UPPER(COALESCE(type, '')) = 'ASSET' AND LOWER(COALESCE(name, '')) LIKE '%checking%' THEN 'Checking'
             WHEN UPPER(COALESCE(type, '')) = 'ASSET' AND LOWER(COALESCE(name, '')) LIKE '%savings%' THEN 'Savings'
             WHEN UPPER(COALESCE(type, '')) = 'ASSET' THEN 'Other Current Assets'
             WHEN UPPER(COALESCE(type, '')) = 'LIABILITY' AND LOWER(COALESCE(name, '')) LIKE '%payable%' THEN 'Accounts Payable'
             WHEN UPPER(COALESCE(type, '')) = 'LIABILITY' THEN 'Other Current Liabilities'
             WHEN UPPER(COALESCE(type, '')) = 'EQUITY' THEN 'Owner''s Equity'
             WHEN UPPER(COALESCE(type, '')) = 'INCOME' THEN 'Service/Fee Income'
             WHEN UPPER(COALESCE(type, '')) = 'EXPENSE' THEN 'Office/General Administrative Expenses'
             ELSE 'Other'
         END
         WHERE detail_type = ''",
        "INSERT INTO accounts (
            business_id,
            code,
            account_number,
            name,
            type,
            parent_id,
            is_active,
            description,
            legacy_id,
            detail_type,
            classification,
            system_account_kind,
            is_favorite,
            is_suspense
         )
         SELECT
             b.id,
             eq.code,
             eq.code,
             eq.name,
             'EQUITY',
             NULL,
             1,
             'Auto-created for QBO parity baseline',
             NULL,
             eq.detail_type,
             'Equity',
             eq.system_kind,
             eq.is_favorite,
             0
         FROM core_business b
         JOIN (
             SELECT '3000' AS code, 'Owner''s Equity' AS name, 'Owner''s Equity' AS detail_type, 'owners_equity' AS system_kind, 1 AS is_favorite
             UNION ALL
             SELECT '3200', 'Retained Earnings', 'Retained Earnings', 'retained_earnings', 1
             UNION ALL
             SELECT '3300', 'Opening Balance Equity', 'Opening Balance Equity', 'opening_balance_equity', 0
         ) eq
         WHERE NOT EXISTS (
             SELECT 1
             FROM accounts a
             WHERE a.business_id = b.id
               AND UPPER(COALESCE(a.type, '')) = 'EQUITY'
         )
         AND COALESCE(b.is_deleted, 0) = 0
         AND NOT EXISTS (
             SELECT 1
             FROM accounts a2
             WHERE a2.business_id = b.id
               AND UPPER(COALESCE(a2.type, '')) = 'EQUITY'
               AND LOWER(COALESCE(a2.name, '')) = LOWER(eq.name)
         )",
    ];

    for stmt in backfill {
        sqlx::query(stmt).execute(pool).await?;
    }

    Ok(())
}
