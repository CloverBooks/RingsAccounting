use sqlx::SqlitePool;

pub struct ToolGateway {
    pub allowed_domains: Vec<String>,
    pub allowed_models: Vec<String>,
}

impl ToolGateway {
    pub fn new(_pool: SqlitePool) -> Self {
        Self {
            allowed_domains: env_list("ENGINE_ALLOWLIST_DOMAINS"),
            allowed_models: env_list("ENGINE_LLM_ALLOWED_MODELS"),
        }
    }
}

fn env_list(key: &str) -> Vec<String> {
    std::env::var(key)
        .unwrap_or_default()
        .split(',')
        .filter_map(|value| {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        })
        .collect()
}
