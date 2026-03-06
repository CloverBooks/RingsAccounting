use once_cell::sync::OnceCell;
use std::env;

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub app_port: u16,
    pub database_url: String,
    pub allowed_countries: Vec<String>,
}

impl AppConfig {
    fn from_env() -> Result<Self, String> {
        let app_port = env::var("APP_PORT")
            .unwrap_or_else(|_| "8080".to_string())
            .parse::<u16>()
            .map_err(|_| "APP_PORT must be a valid u16".to_string())?;

        let database_url = env::var("DATABASE_URL")
            .map_err(|_| "DATABASE_URL is required".to_string())?;

        let allowed_countries = env::var("ALLOWED_COUNTRIES")
            .unwrap_or_else(|_| "CA,US".to_string())
            .split(',')
            .map(|item| item.trim().to_uppercase())
            .filter(|item| !item.is_empty())
            .collect::<Vec<_>>();

        Ok(Self {
            app_port,
            database_url,
            allowed_countries,
        })
    }
}

static CONFIG: OnceCell<AppConfig> = OnceCell::new();

pub fn get_config() -> &'static AppConfig {
    CONFIG.get_or_init(|| AppConfig::from_env().expect("Failed to load config"))
}
