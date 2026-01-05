//! Authentication routes for Clover Books API
//! 
//! Handles login, signup, session management, and JWT tokens.

use axum::{
    extract::Json,
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, decode, Header, EncodingKey, DecodingKey, Validation};

// JWT secret (in production, use environment variable)
const JWT_SECRET: &[u8] = b"clover-books-super-secret-key-change-in-production";

// ============================================================================
// Data Types
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
    #[serde(default)]
    pub remember_me: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SignupRequest {
    pub email: String,
    pub password: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub business_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub ok: bool,
    pub token: Option<String>,
    pub user: Option<UserInfo>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserInfo {
    pub id: String,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub business_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,  // user ID
    pub email: String,
    pub exp: usize,   // expiration timestamp
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthConfig {
    pub google_enabled: bool,
    pub magic_link_enabled: bool,
    pub password_enabled: bool,
}

// ============================================================================
// Route Handlers
// ============================================================================

/// POST /api/auth/login
/// 
/// Authenticate user with email/password and return JWT token.
pub async fn login(Json(payload): Json<LoginRequest>) -> impl IntoResponse {
    tracing::info!("Login attempt for: {}", payload.email);
    
    // TODO: Replace with real database lookup
    // For now, accept any login with password "demo123" for testing
    if payload.password != "demo123" {
        return (
            StatusCode::UNAUTHORIZED,
            Json(AuthResponse {
                ok: false,
                token: None,
                user: None,
                error: Some("Invalid email or password".to_string()),
            }),
        );
    }

    // Create user (mock - in production, fetch from database)
    let user = UserInfo {
        id: Uuid::new_v4().to_string(),
        email: payload.email.clone(),
        first_name: "Demo".to_string(),
        last_name: "User".to_string(),
        business_name: Some("Clover Books Demo".to_string()),
    };

    // Generate JWT token
    let expiration = if payload.remember_me {
        Utc::now() + Duration::days(30)
    } else {
        Utc::now() + Duration::hours(24)
    };

    let claims = Claims {
        sub: user.id.clone(),
        email: user.email.clone(),
        exp: expiration.timestamp() as usize,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(JWT_SECRET),
    )
    .unwrap();

    tracing::info!("Login successful for: {}", payload.email);

    (
        StatusCode::OK,
        Json(AuthResponse {
            ok: true,
            token: Some(token),
            user: Some(user),
            error: None,
        }),
    )
}

/// POST /api/auth/signup
/// 
/// Create a new user account.
pub async fn signup(Json(payload): Json<SignupRequest>) -> impl IntoResponse {
    tracing::info!("Signup attempt for: {}", payload.email);

    // Validate email
    if !payload.email.contains('@') {
        return (
            StatusCode::BAD_REQUEST,
            Json(AuthResponse {
                ok: false,
                token: None,
                user: None,
                error: Some("Invalid email address".to_string()),
            }),
        );
    }

    // Validate password
    if payload.password.len() < 6 {
        return (
            StatusCode::BAD_REQUEST,
            Json(AuthResponse {
                ok: false,
                token: None,
                user: None,
                error: Some("Password must be at least 6 characters".to_string()),
            }),
        );
    }

    // TODO: Check if user already exists in database
    // TODO: Hash password with bcrypt
    // TODO: Save user to database

    // Create user
    let user = UserInfo {
        id: Uuid::new_v4().to_string(),
        email: payload.email.clone(),
        first_name: payload.first_name.unwrap_or_else(|| "New".to_string()),
        last_name: payload.last_name.unwrap_or_else(|| "User".to_string()),
        business_name: payload.business_name,
    };

    // Generate JWT token
    let claims = Claims {
        sub: user.id.clone(),
        email: user.email.clone(),
        exp: (Utc::now() + Duration::hours(24)).timestamp() as usize,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(JWT_SECRET),
    )
    .unwrap();

    tracing::info!("Signup successful for: {}", payload.email);

    (
        StatusCode::CREATED,
        Json(AuthResponse {
            ok: true,
            token: Some(token),
            user: Some(user),
            error: None,
        }),
    )
}

/// GET /api/auth/me
/// 
/// Get current user from JWT token.
/// TODO: Extract token from Authorization header and validate
pub async fn me() -> impl IntoResponse {
    // TODO: Parse Bearer token from Authorization header
    // For now, return unauthorized
    (
        StatusCode::UNAUTHORIZED,
        Json(AuthResponse {
            ok: false,
            token: None,
            user: None,
            error: Some("Not authenticated".to_string()),
        }),
    )
}

/// POST /api/auth/logout
/// 
/// Invalidate user session (for stateful sessions).
/// With JWT, client just discards the token.
pub async fn logout() -> impl IntoResponse {
    Json(serde_json::json!({
        "ok": true,
        "message": "Logged out successfully"
    }))
}

/// GET /api/auth/config
/// 
/// Return authentication configuration for frontend.
pub async fn config() -> impl IntoResponse {
    Json(AuthConfig {
        google_enabled: true,
        magic_link_enabled: false,
        password_enabled: true,
    })
}
