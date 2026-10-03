#[cfg(test)]
use serde::{Deserialize, Serialize};
#[cfg(test)]
use sha2::{Digest, Sha256};
#[cfg(test)]
use std::{
    fs::{self, File},
    io::{self, Read, Write},
    path::{Path, PathBuf},
};
#[cfg(test)]
use tauri::path::BaseDirectory;
use tauri::{Emitter, Manager};
#[cfg(test)]
use tauri_plugin_fs::{FsExt, OpenOptions};
use tauri_plugin_opener::OpenerExt;
#[cfg(target_os = "linux")]
mod linux_graphics;
#[cfg(test)]
mod native_commerce;
mod native_diagnostics;
mod native_io_trace;
mod native_mod_import;
mod native_mods;
#[cfg(test)]
mod native_package_manager;
mod native_startup;
#[cfg(test)]
mod native_storage;
mod native_user_data;
mod scoped_files;

#[cfg(test)]
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ReleasePackage {
    pub(crate) package_id: String,
    pub(crate) version: String,
    pub(crate) bytes: u64,
    pub(crate) sha256: String,
}

#[cfg(test)]
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ReleaseManifest {
    pub(crate) schema_version: u8,
    pub(crate) packages: Vec<ReleasePackage>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) generation: Option<u64>,
}

#[cfg(test)]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ContentStatus {
    content_folder: String,
    packages: Vec<ReleasePackage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    io_trace_session_id: Option<String>,
}

#[cfg(test)]
pub(crate) fn content_folder(handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    handle
        .path()
        .app_data_dir()
        .map(|path| path.join("game-content"))
        .map_err(|error| error.to_string())
}

#[cfg(test)]
pub(crate) fn manifest_is_valid(manifest: &ReleaseManifest) -> bool {
    if manifest.schema_version != 1
        || manifest
            .generation
            .is_some_and(|generation| generation > 9_007_199_254_740_991)
    {
        return false;
    }
    let mut ids = std::collections::HashSet::new();
    for package in &manifest.packages {
        let valid_id = native_package_manager::valid_id(&package.package_id);
        let valid_version = native_package_manager::valid_version(&package.version);
        if !valid_id {
            return false;
        }
        if !ids.insert(package.package_id.as_str())
            || !valid_version
            || package.bytes < 512
            || package.sha256.len() != 64
            || !package.sha256.bytes().all(|byte| byte.is_ascii_hexdigit())
        {
            return false;
        }
    }
    true
}

#[cfg(test)]
pub(crate) fn verified_file(path: &Path, package: &ReleasePackage) -> Result<bool, String> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(error.to_string()),
    };
    if !metadata.is_file() || metadata.len() != package.bytes {
        return Ok(false);
    }
    let _hash = native_io_trace::start(
        native_io_trace::Category::Registry,
        native_io_trace::Operation::Hash,
        "package-verification",
    );
    let mut read_span = native_io_trace::start(
        native_io_trace::Category::Registry,
        native_io_trace::Operation::Read,
        "package-verification",
    );
    let mut file = File::open(path).map_err(|error| error.to_string())?;
    let mut digest = Sha256::new();
    let mut total_bytes = 0_u64;
    let mut buffer = [0_u8; 1024 * 1024];
    loop {
        let count = file.read(&mut buffer).map_err(|error| error.to_string())?;
        if count == 0 {
            break;
        }
        total_bytes += count as u64;
        digest.update(&buffer[..count]);
    }
    if let Some(span) = &mut read_span {
        span.bytes(total_bytes);
    }
    Ok(format!("{:x}", digest.finalize()) == package.sha256)
}

#[cfg(test)]
fn resource_path(handle: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    handle
        .path()
        .resolve(format!("game-content/{name}"), BaseDirectory::Resource)
        .map_err(|error| error.to_string())
}

#[cfg(test)]
fn bundled_manifest(handle: &tauri::AppHandle) -> Result<ReleaseManifest, String> {
    let path = resource_path(handle, "release.json")?;
    let _read = native_io_trace::start(
        native_io_trace::Category::Registry,
        native_io_trace::Operation::Read,
        "bundled-release",
    );
    let source = handle
        .fs()
        .read_to_string(path)
        .map_err(|error| error.to_string())?;
    let manifest: ReleaseManifest =
        serde_json::from_str(&source).map_err(|error| error.to_string())?;
    if !manifest_is_valid(&manifest)
        || !["duel-core", "card-library", "freeplay", "chapter-01"]
            .iter()
            .all(|id| {
                manifest
                    .packages
                    .iter()
                    .any(|package| package.package_id == *id)
            })
    {
        return Err("Bundled content manifest is incomplete".into());
    }
    Ok(manifest)
}

#[cfg(test)]
fn seed_content(handle: &tauri::AppHandle) -> Result<ContentStatus, String> {
    let folder = content_folder(handle)?;
    fs::create_dir_all(&folder).map_err(|error| error.to_string())?;
    let active_path = folder.join("active.json");
    if active_path.exists() {
        let active: ReleaseManifest = serde_json::from_slice(
            &native_io_trace::read(
                &active_path,
                native_io_trace::Category::Registry,
                "active-manifest",
            )
            .map_err(|error| error.to_string())?,
        )
        .map_err(|error| error.to_string())?;
        if !manifest_is_valid(&active) {
            return Err("Installed content manifest is invalid".into());
        }
        for package in &active.packages {
            let path = folder.join(format!("{}-{}.sqlite", package.package_id, package.version));
            if !verified_file(&path, package)? {
                return Err(format!(
                    "Installed package is missing or corrupt: {}",
                    package.package_id
                ));
            }
        }
        return Ok(ContentStatus {
            content_folder: folder.to_string_lossy().into_owned(),
            packages: active.packages,
            io_trace_session_id: native_io_trace::session_id(),
        });
    }
    let release = bundled_manifest(handle)?;
    for package in &release.packages {
        let file_name = format!("{}-{}.sqlite", package.package_id, package.version);
        let target = folder.join(&file_name);
        if verified_file(&target, package)? {
            continue;
        }
        let source = resource_path(handle, &format!("{}.sqlite", package.package_id))?;
        let mut options = OpenOptions::new();
        options.read(true);
        let _read = native_io_trace::start(
            native_io_trace::Category::Registry,
            native_io_trace::Operation::Read,
            "bundled-package-copy",
        );
        let mut input = handle
            .fs()
            .open(source, options)
            .map_err(|error| error.to_string())?;
        let temporary = folder.join(format!("{file_name}.partial"));
        let mut output = File::create(&temporary).map_err(|error| error.to_string())?;
        io::copy(&mut input, &mut output).map_err(|error| error.to_string())?;
        output.sync_all().map_err(|error| error.to_string())?;
        drop(output);
        if !verified_file(&temporary, package)? {
            let _ = fs::remove_file(&temporary);
            return Err(format!(
                "Bundled package failed verification: {}",
                package.package_id
            ));
        }
        fs::rename(&temporary, &target).map_err(|error| error.to_string())?;
    }
    let temporary = folder.join("active.json.partial");
    let mut output = File::create(&temporary).map_err(|error| error.to_string())?;
    output
        .write_all(&serde_json::to_vec_pretty(&release).map_err(|error| error.to_string())?)
        .map_err(|error| error.to_string())?;
    output.sync_all().map_err(|error| error.to_string())?;
    drop(output);
    fs::rename(&temporary, active_path).map_err(|error| error.to_string())?;
    Ok(ContentStatus {
        content_folder: folder.to_string_lossy().into_owned(),
        packages: release.packages,
        io_trace_session_id: native_io_trace::session_id(),
    })
}

#[cfg(test)]
#[tauri::command]
async fn native_content_status(handle: tauri::AppHandle) -> Result<ContentStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _command = native_io_trace::start(
            native_io_trace::Category::Registry,
            native_io_trace::Operation::Command,
            "native_content_status",
        );
        seed_content(&handle)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
fn open_content_folder(handle: tauri::AppHandle) -> Result<(), String> {
    let folder = handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("readable-content");
    std::fs::create_dir_all(&folder).map_err(|error| error.to_string())?;
    handle
        .opener()
        .open_path(folder.to_string_lossy().into_owned(), None::<&str>)
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    linux_graphics::configure();

    let builder = tauri::Builder::default();
    #[cfg(any(debug_assertions, feature = "native-acceptance"))]
    let builder = builder.on_page_load(|webview, payload| {
        if matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
            native_startup::acceptance::inject_recovery(webview);
        }
    });
    builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(native_diagnostics::ExitControl::default())
        .manage(native_diagnostics::Diagnostics::default())
        .setup(|app| {
            app.state::<native_diagnostics::Diagnostics>()
                .initialize(app.path().app_log_dir().map_err(|e| e.to_string()));
            Ok(())
        })
        .manage(native_user_data::UserJsonState::default())
        .manage(native_startup::StartupState::default())
        .invoke_handler(tauri::generate_handler![
            native_startup::native_content_location,
            native_startup::maintenance::native_critical_maintenance,
            native_startup::maintenance::native_startup_repair,
            #[cfg(any(debug_assertions, feature = "native-acceptance"))]
            native_startup::acceptance::native_io_trace_media_fixture,
            #[cfg(any(debug_assertions, feature = "native-acceptance"))]
            native_startup::acceptance::native_io_trace_chapter_fixture,
            native_io_trace::native_io_trace_maintenance,
            native_startup::native_startup_load,
            native_startup::native_startup_metadata,
            native_startup::native_startup_engine,
            native_startup::native_startup_cancel,
            native_startup::native_startup_close,
            native_startup::native_live_media_read,
            native_startup::native_live_media_revision,
            native_mods::native_mods_load,
            native_mods::native_mods_activate,
            native_mod_import::native_mods_choose_root,
            native_mod_import::native_mods_import,
            native_diagnostics::native_startup_log_status,
            native_diagnostics::native_startup_log_record,
            native_diagnostics::native_startup_log_open,
            native_diagnostics::native_startup_quit,
            native_io_trace::native_io_trace_snapshot,
            native_io_trace::native_io_trace_baseline_ready,
            native_io_trace::native_io_trace_ready,
            native_io_trace::native_io_trace_acceptance_result,
            open_content_folder,
            native_user_data::native_user_json_open,
            native_user_data::native_user_json_commit,
            native_user_data::native_user_json_close,
        ])
        .build(tauri::generate_context!())
        .expect("failed to build Ascencio")
        .run(|handle, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                if !handle
                    .state::<native_diagnostics::ExitControl>()
                    .0
                    .load(std::sync::atomic::Ordering::Acquire)
                {
                    api.prevent_exit();
                    let _ = handle.emit("application-close-requested", ());
                }
            }
        });
}
