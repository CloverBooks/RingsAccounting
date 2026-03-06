use axum::{
    extract::Request,
    http::{HeaderMap, HeaderValue},
    middleware::Next,
    response::Response,
};
use uuid::Uuid;

const CONTROL_PLANE_PREFIXES: [&str; 3] = [
    "/api/admin/",
    "/api/companion/",
    "/api/agentic/companion/",
];

pub fn resolve_request_id(headers: &HeaderMap) -> String {
    headers
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| Uuid::new_v4().to_string())
}

pub fn is_control_plane_path(path: &str) -> bool {
    CONTROL_PLANE_PREFIXES
        .iter()
        .any(|prefix| path.starts_with(prefix))
}

pub async fn control_plane_request_id_middleware(mut request: Request, next: Next) -> Response {
    if !is_control_plane_path(request.uri().path()) {
        return next.run(request).await;
    }

    let request_id = resolve_request_id(request.headers());
    if let Ok(value) = HeaderValue::from_str(&request_id) {
        request.headers_mut().insert("x-request-id", value.clone());
        let mut response = next.run(request).await;
        response.headers_mut().insert("x-request-id", value);
        return response;
    }

    next.run(request).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn control_plane_path_matches_expected_prefixes() {
        assert!(is_control_plane_path("/api/admin/users/"));
        assert!(is_control_plane_path("/api/companion/cockpit/status"));
        assert!(is_control_plane_path("/api/agentic/companion/summary"));
        assert!(!is_control_plane_path("/api/dashboard"));
    }
}
