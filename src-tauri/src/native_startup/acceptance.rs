//! Opt-in actual decoder fixture. Cannot target installed user data or caller-selected files.
use super::*;
#[tauri::command]
pub(crate) async fn native_io_trace_media_fixture(
    handle: tauri::AppHandle,
    state: tauri::State<'_, StartupState>,
    operation: String,
) -> Result<(), String> {
    if std::env::var("ASCENCIO_NATIVE_ACCEPTANCE").as_deref() != Ok("1")
        || !handle.path().app_data_dir().is_ok_and(|path| {
            path.parent().is_some_and(|parent| {
                parent
                    .file_name()
                    .is_some_and(|name| name == "startup-native-data")
            })
        })
    {
        return Err("ACCEPTANCE_FIXTURE_REQUIRED".into());
    }
    let current = state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("STARTUP_NOT_PREPARED")?;
    tauri::async_runtime::spawn_blocking(move || {
        if ![
            "delete",
            "restore",
            "replace",
            "truncate",
            "unsupported",
            "oversized",
        ]
        .contains(&operation.as_str())
        {
            return Err("FIXTURE_OPERATION_INVALID".into());
        }
        let mut data = current.data.lock().map_err(|e| e.to_string())?;
        if data.original_media.is_none() {
            // Freeplay's canonical starter cover. The mapping still comes from authenticated memory.
            let (root, mapping) = data
                .media
                .get("card-library:cards/cropped/97590747.jpg")
                .cloned()
                .ok_or("FIXTURE_MEDIA_UNMAPPED")?;
            let bytes = read_media(&root, &mapping)?;
            data.original_media = Some((root, mapping, bytes));
        }
        let (root, mapping, original) = data.original_media.as_ref().unwrap();
        let dir = cap_std::fs::Dir::open_ambient_dir(root, cap_std::ambient_authority())
            .map_err(|e| e.to_string())?;
        if operation == "delete" {
            return dir.remove_file(&mapping.path).map_err(|e| e.to_string());
        }
        let mut options = cap_std::fs::OpenOptions::new();
        options.write(true).create(true).truncate(true);
        let mut file = dir
            .open_with(&mapping.path, &options)
            .map_err(|e| e.to_string())?;
        match operation.as_str() {
            "restore" | "replace" => file.write_all(original),
            "truncate" => file.write_all(&original[..original.len().min(16)]),
            "unsupported" => file.write_all(b"unsupported media fixture"),
            "oversized" => file.set_len(MAX_MEDIA + 1),
            _ => return Err("FIXTURE_OPERATION_INVALID".into()),
        }
        .and_then(|_| file.sync_all())
        .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Inject failure recovery before Ready; the default optimized build excludes this hook.
pub(crate) fn recovery_scenario() -> Option<String> {
    std::env::var("ASCENCIO_NATIVE_RECOVERY")
        .ok()
        .filter(|scenario| {
            [
                "invalid-user",
                "invalid-base",
                "invalid-mod-json",
                "invalid-mod-lua",
                "missing-mod-root",
                "maintenance",
                "reopened",
            ]
            .contains(&scenario.as_str())
        })
}
pub(crate) fn inject_recovery(webview: &tauri::Webview) {
    let Some(scenario) = recovery_scenario() else {
        return;
    };
    if std::env::var("ASCENCIO_NATIVE_ACCEPTANCE").as_deref() != Ok("1")
        || std::env::var("ASCENCIO_IO_TRACE").as_deref() != Ok("1")
        || !webview
            .app_handle()
            .path()
            .app_data_dir()
            .is_ok_and(|path| {
                path.parent().is_some_and(|parent| {
                    parent
                        .file_name()
                        .is_some_and(|name| name == "startup-native-data")
                })
            })
    {
        return;
    }
    let encoded = serde_json::to_string(&scenario).expect("fixed scenario is serializable");
    let script = format!(
        "window.__ASCENCIO_NATIVE_RECOVERY__ = {encoded};\n{}",
        if scenario == "maintenance" {
            include_str!("../../../scripts/native-startup-maintenance-acceptance.js")
        } else {
            include_str!("../../../scripts/native-startup-recovery-acceptance.js")
        }
    );
    let _ = webview.eval(script);
}

#[tauri::command]
pub(crate) async fn native_io_trace_chapter_fixture(
    handle: tauri::AppHandle,
) -> Result<String, String> {
    if std::env::var("ASCENCIO_NATIVE_ACCEPTANCE").as_deref() != Ok("1")
        || !handle.path().app_data_dir().is_ok_and(|path| {
            path.parent().is_some_and(|parent| {
                parent
                    .file_name()
                    .is_some_and(|name| name == "startup-native-data")
            })
        })
    {
        return Err("ACCEPTANCE_FIXTURE_REQUIRED".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let release: Release =
            serde_json::from_str(TRUSTED_RELEASE).map_err(|_| "BASE_RELEASE_UNAVAILABLE")?;
        let chapter = release
            .packages
            .into_iter()
            .find(|pack| pack.package_id == "chapter-01")
            .ok_or("FIXTURE_CHAPTER_MISSING")?;
        let bundle = handle
            .path()
            .resolve("readable-content", tauri::path::BaseDirectory::Resource)
            .map_err(|e| e.to_string())?;
        let bytes = read_verified(
            &bundle,
            &Resource {
                path: chapter.path,
                bytes: chapter.bytes,
                sha256: chapter.sha256,
            },
            MAX_CRITICAL,
            Category::Maintenance,
        )?;
        String::from_utf8(bytes).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
