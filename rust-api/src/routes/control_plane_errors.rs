use axum::{
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};

use crate::routes::request_ids::resolve_request_id;

pub fn control_plane_error(
    status: StatusCode,
    domain: &str,
    message: &str,
    request_id: &str,
) -> (StatusCode, Json<Value>) {
    let error_type = normalize_error_type(message);
    let error_code = request_scoped_error_code(domain, &error_type, request_id);
    (
        status,
        Json(json!({
            "ok": false,
            "result_state": "failed",
            "message": message,
            "detail": message,
            "error": message,
            "error_type": error_type,
            "error_code": error_code,
            "http_status": status.as_u16(),
            "request_id": request_id
        })),
    )
}

pub fn control_plane_error_from_headers(
    status: StatusCode,
    domain: &str,
    headers: &HeaderMap,
    message: &str,
) -> (StatusCode, Json<Value>) {
    let request_id = resolve_request_id(headers);
    control_plane_error(status, domain, message, &request_id)
}

fn normalize_error_type(message: &str) -> String {
    let mut token = String::new();
    let mut previous_was_separator = false;

    for ch in message.chars() {
        if ch.is_ascii_alphanumeric() {
            token.push(ch.to_ascii_lowercase());
            previous_was_separator = false;
        } else if !previous_was_separator && !token.is_empty() {
            token.push('_');
            previous_was_separator = true;
        }
    }

    let normalized = token.trim_matches('_').to_string();
    if normalized.is_empty() {
        "request_failed".to_string()
    } else {
        normalized
    }
}

fn request_scoped_error_code(domain: &str, error_type: &str, request_id: &str) -> String {
    let request_fragment: String = request_id
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .take(12)
        .collect();
    let request_fragment = if request_fragment.is_empty() {
        "UNKNOWN".to_string()
    } else {
        request_fragment.to_ascii_uppercase()
    };

    let domain = domain
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect::<String>()
        .to_ascii_uppercase();

    format!(
        "{}_{}_{}",
        domain,
        error_type.to_ascii_uppercase(),
        request_fragment
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn control_plane_error_formats_request_scoped_codes() {
        let (_, body) = control_plane_error(
            StatusCode::BAD_REQUEST,
            "COMPANION",
            "workspace_id required",
            "trace-01",
        );
        let body = body.0;

        assert_eq!(body["error_type"], "workspace_id_required");
        assert_eq!(body["error_code"], "COMPANION_WORKSPACE_ID_REQUIRED_TRACE01");
        assert_eq!(body["request_id"], "trace-01");
        assert_eq!(body["http_status"], 400);
    }
}
