use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File},
    io::{self, Read, Write},
    path::{Path, PathBuf},
};
use tauri::{path::BaseDirectory, Manager};
use tauri_plugin_fs::{FsExt, OpenOptions};
use tauri_plugin_opener::OpenerExt;
mod native_package_manager;
mod native_storage;
mod native_user_data;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ReleasePackage {
    pub(crate) package_id: String,
    pub(crate) version: String,
    pub(crate) bytes: u64,
    pub(crate) sha256: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ReleaseManifest {
    pub(crate) schema_version: u8,
    pub(crate) packages: Vec<ReleasePackage>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) generation: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ContentStatus {
    content_folder: String,
    packages: Vec<ReleasePackage>,
}

pub(crate) fn content_folder(handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    handle
        .path()
        .app_data_dir()
        .map(|path| path.join("game-content"))
        .map_err(|error| error.to_string())
}

pub(crate) fn manifest_is_valid(manifest: &ReleaseManifest) -> bool {
    if manifest.schema_version != 1 || manifest.packages.is_empty() {
        return false;
    }
    let mut ids = std::collections::HashSet::new();
    for package in &manifest.packages {
        let chapter = package.package_id.strip_prefix("chapter-");
        let valid_id = matches!(
            package.package_id.as_str(),
            "duel-core" | "card-library" | "freeplay"
        ) || chapter.is_some_and(|number| {
            number.len() >= 2
                && number.bytes().all(|byte| byte.is_ascii_digit())
                && !number.starts_with("00")
                && number != "00"
        });
        let valid_version = package.version.split('.').count() == 3
            && package
                .version
                .split('.')
                .all(|part| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_digit()));
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
    let mut chapters: Vec<u32> = ids
        .iter()
        .filter_map(|id| {
            id.strip_prefix("chapter-")
                .and_then(|value| value.parse().ok())
        })
        .collect();
    chapters.sort_unstable();
    if chapters
        .iter()
        .enumerate()
        .any(|(index, chapter)| *chapter != (index + 1) as u32)
    {
        return false;
    }
    ["duel-core", "card-library", "freeplay", "chapter-01"]
        .iter()
        .all(|required| ids.contains(required))
}

pub(crate) fn verified_file(path: &Path, package: &ReleasePackage) -> Result<bool, String> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(error.to_string()),
    };
    if !metadata.is_file() || metadata.len() != package.bytes {
        return Ok(false);
    }
    let mut file = File::open(path).map_err(|error| error.to_string())?;
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 1024 * 1024];
    loop {
        let count = file.read(&mut buffer).map_err(|error| error.to_string())?;
        if count == 0 {
            break;
        }
        digest.update(&buffer[..count]);
    }
    Ok(format!("{:x}", digest.finalize()) == package.sha256)
}

fn resource_path(handle: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    handle
        .path()
        .resolve(format!("game-content/{name}"), BaseDirectory::Resource)
        .map_err(|error| error.to_string())
}

fn bundled_manifest(handle: &tauri::AppHandle) -> Result<ReleaseManifest, String> {
    let path = resource_path(handle, "release.json")?;
    let source = handle
        .fs()
        .read_to_string(path)
        .map_err(|error| error.to_string())?;
    let manifest: ReleaseManifest =
        serde_json::from_str(&source).map_err(|error| error.to_string())?;
    if !manifest_is_valid(&manifest) {
        return Err("Bundled content manifest is incomplete".into());
    }
    Ok(manifest)
}

fn seed_content(handle: &tauri::AppHandle) -> Result<ContentStatus, String> {
    let folder = content_folder(handle)?;
    fs::create_dir_all(&folder).map_err(|error| error.to_string())?;
    let active_path = folder.join("active.json");
    if active_path.exists() {
        let active: ReleaseManifest =
            serde_json::from_slice(&fs::read(&active_path).map_err(|error| error.to_string())?)
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
        });
    }
    #[cfg(debug_assertions)]
    if !resource_path(handle, "release.json")?.exists() {
        return Ok(ContentStatus {
            content_folder: folder.to_string_lossy().into_owned(),
            packages: Vec::new(),
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
    })
}

#[tauri::command]
fn native_content_status(handle: tauri::AppHandle) -> Result<ContentStatus, String> {
    seed_content(&handle)
}

#[tauri::command]
fn open_content_folder(handle: tauri::AppHandle) -> Result<(), String> {
    let folder = content_folder(&handle)?;
    fs::create_dir_all(&folder).map_err(|error| error.to_string())?;
    handle
        .opener()
        .open_path(folder.to_string_lossy().into_owned(), None::<&str>)
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(native_user_data::BackupState::default())
        .manage(native_package_manager::PackageManager::default())
        .setup(|app| {
            native_user_data::clear_stale_backups(app.handle()).map_err(std::io::Error::other)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            native_content_status,
            open_content_folder,
            native_storage::native_package_stack,
            native_storage::native_content_query,
            native_user_data::native_user_read,
            native_user_data::native_user_list,
            native_user_data::native_user_write,
            native_user_data::native_user_export,
            native_user_data::native_user_inspect,
            native_user_data::native_user_discard,
            native_user_data::native_user_restore,
            native_package_manager::native_import_begin,
            native_package_manager::native_import_chunk,
            native_package_manager::native_import_preview,
            native_package_manager::native_import_commit,
            native_package_manager::native_import_cancel,
            native_package_manager::native_package_acquire,
            native_package_manager::native_package_release,
            native_package_manager::native_package_cleanup,
            native_package_manager::native_package_remove,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Ascencio");
}
