//! Session-scoped HTTP resources backed by verified startup buffers and media capabilities.
use super::{cancelled, media_revision, read_media, session, StartupState};
use tauri::http::{header, HeaderValue, Method, Request, Response, StatusCode};
use tauri::{AppHandle, Manager};

enum Resource<'a> {
    Metadata,
    Engine,
    Media { package: &'a str, logical: String },
    Revision { package: &'a str, logical: String },
}

fn decode_logical(value: &str) -> Option<String> {
    if value.is_empty() || value.len() > 2048 || value.len() % 2 != 0 {
        return None;
    }
    let bytes = value
        .as_bytes()
        .chunks_exact(2)
        .map(|pair| {
            let digit = |byte: u8| match byte {
                b'0'..=b'9' => Some(byte - b'0'),
                b'a'..=b'f' => Some(byte - b'a' + 10),
                _ => None,
            };
            Some(digit(pair[0])? * 16 + digit(pair[1])?)
        })
        .collect::<Option<Vec<_>>>()?;
    let logical = String::from_utf8(bytes).ok()?;
    (!logical.contains('\0')).then_some(logical)
}

fn resource(path: &str) -> Option<(&str, Resource<'_>)> {
    if path.len() > 2304 {
        return None;
    }
    let parts = path
        .strip_prefix("/game-content/")?
        .split('/')
        .collect::<Vec<_>>();
    let token = *parts.first()?;
    uuid::Uuid::parse_str(token).ok()?;
    let item = match parts.as_slice() {
        [_, "metadata.json"] => Resource::Metadata,
        [_, "engine.wasm"] => Resource::Engine,
        [_, kind @ ("media" | "revision"), package, hex]
            if !package.is_empty()
                && package.len() <= 128
                && package
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || b"-_.".contains(&byte)) =>
        {
            let logical = decode_logical(hex)?;
            if *kind == "media" {
                Resource::Media { package, logical }
            } else {
                Resource::Revision { package, logical }
            }
        }
        _ => return None,
    };
    Some((token, item))
}

fn response(status: StatusCode, mime: &str, bytes: Vec<u8>, head: bool) -> Response<Vec<u8>> {
    let length = bytes.len();
    let mut response = Response::new(if head { Vec::new() } else { bytes });
    *response.status_mut() = status;
    let headers = response.headers_mut();
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers.insert(header::VARY, HeaderValue::from_static("Origin"));
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(mime)
            .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
    );
    if let Ok(length) = HeaderValue::from_str(&length.to_string()) {
        headers.insert(header::CONTENT_LENGTH, length);
    }
    if status == StatusCode::METHOD_NOT_ALLOWED {
        headers.insert(header::ALLOW, HeaderValue::from_static("GET, HEAD"));
    }
    response
}

fn allowed_origin(
    handle: &AppHandle,
    webview_label: &str,
    request: &Request<Vec<u8>>,
) -> Result<Option<HeaderValue>, ()> {
    let mut origins = request.headers().get_all(header::ORIGIN).iter();
    let Some(value) = origins.next() else {
        return Ok(None);
    };
    if origins.next().is_some() {
        return Err(());
    }
    let origin = value.to_str().map_err(|_| ())?;
    let native_origin = matches!(
        origin,
        "tauri://localhost" | "http://tauri.localhost" | "https://tauri.localhost"
    );
    #[cfg(debug_assertions)]
    let development_origin = handle
        .config()
        .build
        .dev_url
        .as_ref()
        .is_some_and(|url| origin == url.origin().ascii_serialization());
    #[cfg(not(debug_assertions))]
    let development_origin = false;
    let native_opaque_origin = origin == "null"
        && handle
            .get_webview_window(webview_label)
            .and_then(|webview| webview.url().ok())
            .is_some_and(|url| match url.scheme() {
                "tauri" => url.host_str() == Some("localhost") && url.port().is_none(),
                "http" | "https" => {
                    url.host_str() == Some("tauri.localhost") && url.port().is_none()
                }
                _ => false,
            });
    if native_origin || development_origin || native_opaque_origin {
        Ok(Some(value.clone()))
    } else {
        Err(())
    }
}

pub(crate) fn respond(
    handle: &AppHandle,
    webview_label: &str,
    request: Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    let origin = match allowed_origin(handle, webview_label, &request) {
        Ok(origin) => origin,
        Err(()) => {
            return response(
                StatusCode::FORBIDDEN,
                "text/plain",
                Vec::new(),
                request.method() == Method::HEAD,
            );
        }
    };
    let mut reply = respond_resource(&handle.state::<StartupState>(), request);
    if let Some(origin) = origin {
        reply
            .headers_mut()
            .insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, origin);
    }
    reply
}

fn respond_resource(state: &StartupState, request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    let head = request.method() == Method::HEAD;
    let error = |status| response(status, "text/plain", Vec::new(), head);
    if request.method() != Method::GET && !head {
        return error(StatusCode::METHOD_NOT_ALLOWED);
    }
    let Some((token, resource)) = resource(request.uri().path()) else {
        return error(StatusCode::NOT_FOUND);
    };
    let Ok(current) = session(state, token) else {
        return error(StatusCode::GONE);
    };
    if cancelled(&current).is_err() {
        return error(StatusCode::GONE);
    }
    let revision = matches!(&resource, Resource::Revision { .. });
    let result = match resource {
        Resource::Metadata | Resource::Engine => {
            let Ok(data) = current.data.lock() else {
                return error(StatusCode::INTERNAL_SERVER_ERROR);
            };
            let (buffer, mime) = match resource {
                Resource::Metadata => (&data.metadata, "application/json"),
                _ => (&data.engine, "application/wasm"),
            };
            let Some(bytes) = buffer.as_ref() else {
                return error(StatusCode::GONE);
            };
            let mut reply = response(
                StatusCode::OK,
                mime,
                if head { Vec::new() } else { bytes.clone() },
                head,
            );
            if head {
                if let Ok(length) = HeaderValue::from_str(&bytes.len().to_string()) {
                    reply.headers_mut().insert(header::CONTENT_LENGTH, length);
                }
            }
            reply
        }
        Resource::Media { package, logical } | Resource::Revision { package, logical } => {
            let mapping = match current.data.lock() {
                Ok(data) => data.media.get(&format!("{package}:{logical}")).cloned(),
                Err(_) => return error(StatusCode::INTERNAL_SERVER_ERROR),
            };
            if revision {
                let value = mapping.and_then(|(root, mapping)| media_revision(&root, &mapping));
                let Ok(bytes) = serde_json::to_vec(&value) else {
                    return error(StatusCode::INTERNAL_SERVER_ERROR);
                };
                response(StatusCode::OK, "application/json", bytes, head)
            } else {
                let Some((root, mapping)) = mapping else {
                    return error(StatusCode::NOT_FOUND);
                };
                if head {
                    if media_revision(&root, &mapping).is_none() {
                        return error(StatusCode::NOT_FOUND);
                    }
                    let mut reply = response(StatusCode::OK, &mapping.mime, Vec::new(), true);
                    reply.headers_mut().remove(header::CONTENT_LENGTH);
                    reply
                } else {
                    let Ok(bytes) = read_media(&root, &mapping) else {
                        return error(StatusCode::NOT_FOUND);
                    };
                    response(StatusCode::OK, &mapping.mime, bytes, false)
                }
            }
        }
    };
    if cancelled(&current).is_err() {
        return error(StatusCode::GONE);
    }
    result
}
