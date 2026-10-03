//! Authenticated base startup. Source directories are installation/authoring inputs only.
use crate::native_io_trace::{self, Category, Operation};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};
use tauri::{Emitter, Manager};

const MAX_CRITICAL: u64 = 128 * 1024 * 1024;
const MAX_TOTAL: u64 = 256 * 1024 * 1024;
const MAX_ENGINE: u64 = 16 * 1024 * 1024;
const MAX_MEDIA: u64 = 64 * 1024 * 1024;
const TRUSTED_RELEASE: &str = include_str!(concat!(env!("OUT_DIR"), "/critical-release.json"));
#[cfg(any(debug_assertions, feature = "native-acceptance"))]
pub(crate) mod acceptance;
pub(crate) mod maintenance;

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Resource {
    path: String,
    bytes: u64,
    sha256: String,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PackResource {
    package_id: String,
    version: String,
    path: String,
    bytes: u64,
    sha256: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Release {
    schema_version: u8,
    compiler_version: u8,
    packages: Vec<PackResource>,
    engine: Vec<Resource>,
}
#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct Mapping {
    id: String,
    path: String,
    mime: String,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Progress {
    session_id: String,
    phase: &'static str,
    completed: usize,
    total: usize,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Prepared {
    session_id: String,
    generation: u64,
    packages: Vec<PackResource>,
    metadata_bytes: usize,
    engine_bytes: usize,
    vendor_manifest: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    io_trace_session_id: Option<String>,
}
#[derive(Default)]
pub(crate) struct StartupState(Mutex<Option<Arc<Session>>>);
struct Session {
    id: String,
    cancelled: Arc<AtomicBool>,
    data: Mutex<Data>,
}
#[derive(Default)]
struct Data {
    metadata: Option<Vec<u8>>,
    engine: Option<Vec<u8>>,
    media: HashMap<String, (PathBuf, Mapping)>,
    progress: Option<Progress>,
    mods: HashMap<String, (PathBuf, Value)>,
    maintenance: Option<maintenance::Installed>,
    #[cfg(any(debug_assertions, feature = "native-acceptance"))]
    original_media: Option<(PathBuf, Mapping, Vec<u8>)>,
}
fn cancelled(session: &Session) -> Result<(), String> {
    if session.cancelled.load(Ordering::Acquire) {
        Err("OPERATION_CANCELLED".into())
    } else {
        Ok(())
    }
}
pub(crate) fn safe_path(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 1024
        && !value.contains(['\\', '\0', ':'])
        && value
            .split('/')
            .all(|s| !s.is_empty() && s != "." && s != "..")
}
fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn read_verified(
    root: &Path,
    resource: &Resource,
    cap: u64,
    category: Category,
) -> Result<Vec<u8>, String> {
    if !safe_path(&resource.path)
        || resource.bytes == 0
        || resource.bytes > cap
        || resource.sha256.len() != 64
    {
        return Err("BASE_ENVELOPE_INVALID".into());
    }
    let mut read = native_io_trace::start(category, Operation::Read, "critical-resource");
    let file = crate::scoped_files::open(root, &resource.path)
        .map_err(|e| format!("BASE_MISSING: {}: {e}", root.join(&resource.path).display()))?;
    let mut bytes = Vec::with_capacity(resource.bytes as usize);
    file.take(cap + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if let Some(span) = &mut read {
        span.bytes(bytes.len() as u64);
    }
    drop(read);
    let _hash = native_io_trace::start(category, Operation::Hash, "critical-resource");
    if bytes.len() as u64 != resource.bytes || digest(&bytes) != resource.sha256 {
        return Err(format!(
            "BASE_HASH_MISMATCH: {}: expected {} received {}",
            root.join(&resource.path).display(),
            resource.sha256,
            digest(&bytes)
        ));
    }
    Ok(bytes)
}
fn progress(
    handle: &tauri::AppHandle,
    session: &Session,
    phase: &'static str,
    completed: usize,
    total: usize,
) {
    let event = Progress {
        session_id: session.id.clone(),
        phase,
        completed,
        total,
    };
    session
        .data
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .progress = Some(event.clone());
    let _ = handle.emit("startup-progress", event);
}

fn install_tree(
    from: &Path,
    to: &Path,
    session: &Session,
    handle: &tauri::AppHandle,
) -> Result<(), String> {
    fs::create_dir_all(to).map_err(|e| e.to_string())?;
    if fs::symlink_metadata(to)
        .map_err(|e| e.to_string())?
        .file_type()
        .is_symlink()
    {
        return Err("MEDIA_PATH_REFUSED".into());
    }
    let root = cap_std::fs::Dir::open_ambient_dir(to, cap_std::ambient_authority())
        .map_err(|e| e.to_string())?;
    fn copy(
        from: &Path,
        relative: &Path,
        root: &cap_std::fs::Dir,
        session: &Session,
    ) -> Result<(), String> {
        cancelled(session)?;
        if !relative.as_os_str().is_empty() {
            root.create_dir_all(relative).map_err(|e| e.to_string())?;
        }
        for entry in fs::read_dir(from).map_err(|e| e.to_string())? {
            cancelled(session)?;
            let entry = entry.map_err(|e| e.to_string())?;
            let kind = entry.file_type().map_err(|e| e.to_string())?;
            let target = relative.join(entry.file_name());
            if kind.is_dir() {
                copy(&entry.path(), &target, root, session)?;
            } else if kind.is_file() {
                // Never overwrite user edits, and publish only a complete copied file.
                if root.symlink_metadata(&target).is_ok() {
                    continue;
                }
                let temporary =
                    relative.join(format!(".ascencio-{}.partial", uuid::Uuid::new_v4()));
                let result = (|| -> std::io::Result<()> {
                    let mut options = cap_std::fs::OpenOptions::new();
                    options.write(true).create_new(true);
                    let mut output = root.open_with(&temporary, &options)?;
                    let mut source = fs::File::open(entry.path())?;
                    std::io::copy(&mut source, &mut output)?;
                    // Optional media and readable authoring copies are recoverable resources,
                    // independent of the durable, authenticated critical generation.
                    drop(output);
                    match root.hard_link(&temporary, root, &target) {
                        Ok(()) => Ok(()),
                        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => Ok(()),
                        Err(error) => Err(error),
                    }
                })();
                let _ = root.remove_file(&temporary);
                result.map_err(|e| e.to_string())?;
            } else {
                return Err("BUNDLED_SOURCE_SYMLINK".into());
            }
        }
        Ok(())
    }
    progress(handle, session, "source-and-media-copy", 0, 1);
    let result = copy(from, Path::new(""), &root, session);
    if result.is_ok() {
        progress(handle, session, "source-and-media-copy", 1, 1);
    }
    result
}

fn load(handle: tauri::AppHandle, session: Arc<Session>) -> Result<Prepared, String> {
    let mut release: Release =
        serde_json::from_str(TRUSTED_RELEASE).map_err(|_| "BASE_RELEASE_UNAVAILABLE")?;
    if release.schema_version != 1
        || release.compiler_version != 1
        || release.packages.len() > 64
        || release.engine.len() != 2
        || release.packages.iter().map(|p| p.bytes).sum::<u64>() > MAX_TOTAL
    {
        return Err("BASE_ENVELOPE_INVALID".into());
    }
    let bundle = handle
        .path()
        .resolve("readable-content", tauri::path::BaseDirectory::Resource)
        .map_err(|e| e.to_string())?;
    let app = handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let identity = digest(TRUSTED_RELEASE.as_bytes());
    let generation = app.join("critical-generations").join(&identity);
    let all_packages = release.packages.clone();
    let selection_path = app.join(format!("critical-selection-{identity}.json"));
    let selected = maintenance::read_selection(&selection_path, &all_packages)?;
    if !generation.exists() {
        progress(
            &handle,
            &session,
            "installation",
            0,
            all_packages.len() + release.engine.len() + 1,
        );
        let temporary = generation.with_extension(format!("{}.partial", session.id));
        fs::create_dir_all(&temporary).map_err(|e| e.to_string())?;
        let result = (|| -> Result<(), String> {
            for (index, pack) in all_packages.iter().enumerate() {
                cancelled(&session)?;
                let resource = Resource {
                    path: pack.path.clone(),
                    bytes: pack.bytes,
                    sha256: pack.sha256.clone(),
                };
                let bytes = read_verified(&bundle, &resource, MAX_CRITICAL, Category::Maintenance)?;
                let target = temporary.join(&pack.path);
                fs::create_dir_all(target.parent().unwrap()).map_err(|e| e.to_string())?;
                let mut file = fs::File::create(target).map_err(|e| e.to_string())?;
                file.write_all(&bytes)
                    .and_then(|_| file.sync_all())
                    .map_err(|e| e.to_string())?;
                progress(
                    &handle,
                    &session,
                    "installation",
                    index + 1,
                    all_packages.len() + release.engine.len() + 1,
                );
            }
            for (index, resource) in release.engine.iter().enumerate() {
                cancelled(&session)?;
                let bytes = read_verified(&bundle, resource, MAX_ENGINE, Category::Maintenance)?;
                let target = temporary.join(&resource.path);
                fs::create_dir_all(target.parent().unwrap()).map_err(|e| e.to_string())?;
                let mut file = fs::File::create(target).map_err(|e| e.to_string())?;
                file.write_all(&bytes)
                    .and_then(|_| file.sync_all())
                    .map_err(|e| e.to_string())?;
                progress(
                    &handle,
                    &session,
                    "installation",
                    all_packages.len() + index + 1,
                    all_packages.len() + release.engine.len() + 1,
                );
            }
            cancelled(&session)?;
            fs::rename(&temporary, &generation).map_err(|e| e.to_string())?;
            let total = all_packages.len() + release.engine.len() + 1;
            progress(&handle, &session, "installation", total, total);
            Ok(())
        })();
        if temporary.exists() {
            let _ = fs::remove_dir_all(&temporary);
        }
        result?;
    }
    // Explicit first installation only. Existing readable sources/media are never reseeded.
    let authored = app.join("readable-content");
    if !generation.join(".media-install-attempted").exists() {
        let _enumeration = native_io_trace::start(
            Category::Maintenance,
            Operation::Metadata,
            "readable-source-installation",
        );
        match install_tree(&bundle, &authored, &session, &handle) {
            Ok(()) => {}
            Err(error) if error == "OPERATION_CANCELLED" => return Err(error),
            Err(error) => eprintln!("MEDIA_INSTALL_UNAVAILABLE: {error}"),
        }
        if let Err(error) = fs::write(generation.join(".media-install-attempted"), b"1\n") {
            eprintln!("MEDIA_INSTALL_MARKER_UNAVAILABLE: {error}");
        }
    }
    release
        .packages
        .retain(|pack| selected.contains(&pack.package_id));
    let mut metadata = vec![b'['];
    let mut media = HashMap::new();
    let mut catalog = Vec::new();
    progress(&handle, &session, "verification", 0, release.packages.len());
    for (index, pack) in release.packages.iter().enumerate() {
        cancelled(&session)?;
        let bytes = read_verified(
            &generation,
            &Resource {
                path: pack.path.clone(),
                bytes: pack.bytes,
                sha256: pack.sha256.clone(),
            },
            MAX_CRITICAL,
            Category::Gameplay,
        )?;
        let _parse =
            native_io_trace::start(Category::Gameplay, Operation::Parse, "critical-snapshot");
        let value: Value = serde_json::from_slice(&bytes)
            .map_err(|e| format!("BASE_JSON_INVALID: {}: {e}", pack.path))?;
        if value["schemaVersion"] != 1
            || value["compilerVersion"] != 1
            || value["manifest"]["packageId"] != pack.package_id
            || value["manifest"]["version"] != pack.version
        {
            return Err(format!("BASE_ENVELOPE_INVALID: {}", pack.path));
        }
        catalog.push(maintenance::active_pack(pack, &value["manifest"]));
        for key in [
            "cards",
            "scripts",
            "sets",
            "decks",
            "opponents",
            "limits",
            "stories",
            "media",
        ] {
            if !value[key].as_array().is_some_and(|a| a.len() <= 100_000) {
                return Err(format!("BASE_SIZE_INVALID: {key}"));
            }
        }
        let mappings: Vec<Mapping> =
            serde_json::from_value(value["media"].clone()).map_err(|e| e.to_string())?;
        for mapping in mappings {
            media.insert(
                format!("{}:{}", pack.package_id, mapping.id),
                (authored.join(&pack.package_id), mapping),
            );
        }
        if index > 0 {
            metadata.push(b',');
        }
        metadata.extend_from_slice(&bytes);
        progress(
            &handle,
            &session,
            "verification",
            index + 1,
            release.packages.len(),
        );
    }
    metadata.push(b']');
    let mut engine = None;
    let mut vendor_manifest = None;
    progress(
        &handle,
        &session,
        "engine-preparation",
        0,
        release.engine.len(),
    );
    for (i, resource) in release.engine.iter().enumerate() {
        cancelled(&session)?;
        let bytes = read_verified(&generation, resource, MAX_ENGINE, Category::Engine)?;
        if resource.path.ends_with("ocgcore.sync.wasm") {
            if !bytes.starts_with(b"\0asm\x01\0\0\0") {
                return Err("ENGINE_INCOMPATIBLE".into());
            }
            engine = Some(bytes);
        } else {
            let _: Value = serde_json::from_slice(&bytes).map_err(|_| "ENGINE_MANIFEST_INVALID")?;
            vendor_manifest =
                Some(String::from_utf8(bytes).map_err(|_| "ENGINE_MANIFEST_INVALID")?);
        }
        progress(
            &handle,
            &session,
            "engine-preparation",
            i + 1,
            release.engine.len(),
        );
    }
    cancelled(&session)?;
    let engine = engine.ok_or("ENGINE_MISSING")?;
    let result = Prepared {
        session_id: session.id.clone(),
        generation: maintenance::generation(&selected),
        packages: release.packages,
        metadata_bytes: metadata.len(),
        engine_bytes: engine.len(),
        vendor_manifest: vendor_manifest.ok_or("ENGINE_MANIFEST_MISSING")?,
        io_trace_session_id: native_io_trace::session_id(),
    };
    *session.data.lock().map_err(|e| e.to_string())? = Data {
        metadata: Some(metadata),
        engine: Some(engine),
        media,
        progress: Some(Progress {
            session_id: session.id.clone(),
            phase: "engine-preparation",
            completed: release.engine.len(),
            total: release.engine.len(),
        }),
        mods: HashMap::new(),
        maintenance: Some(maintenance::Installed {
            selected,
            catalog,
            trusted: all_packages,
            selection_path,
            root: generation,
        }),
        #[cfg(any(debug_assertions, feature = "native-acceptance"))]
        original_media: None,
    };
    Ok(result)
}
fn session(state: &StartupState, token: &str) -> Result<Arc<Session>, String> {
    state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .as_ref()
        .filter(|s| s.id == token)
        .cloned()
        .ok_or("STARTUP_SESSION_INVALID".into())
}
pub(crate) fn mod_cancellation(
    state: &StartupState,
    token: &str,
) -> Result<Arc<AtomicBool>, String> {
    let current = session(state, token)?;
    cancelled(&current)?;
    Ok(current.cancelled.clone())
}
pub(crate) fn register_mod_roots(
    state: &StartupState,
    token: &str,
    roots: Vec<(String, PathBuf, Value)>,
) -> Result<(), String> {
    let current = session(state, token)?;
    cancelled(&current)?;
    let mut data = current.data.lock().map_err(|e| e.to_string())?;
    data.mods = roots
        .into_iter()
        .map(|(id, path, manifest)| (id, (path, manifest)))
        .collect();
    Ok(())
}
pub(crate) fn activate_mod_media(
    state: &StartupState,
    token: &str,
    owners: Vec<crate::native_mods::MediaOwner>,
) -> Result<(), String> {
    if owners.len() > 100_000 {
        return Err("MOD_SIZE".into());
    }
    let current = session(state, token)?;
    cancelled(&current)?;
    let mut data = current.data.lock().map_err(|e| e.to_string())?;
    let mut selected = Vec::new();
    for owner in owners {
        let (root, manifest) = data.mods.get(&owner.mod_id).ok_or("MOD_MEDIA_UNDECLARED")?;
        let raw = manifest["media"]
            .as_array()
            .and_then(|a| {
                a.iter()
                    .find(|m| m["packageId"] == owner.package_id && m["id"] == owner.id)
            })
            .ok_or("MOD_MEDIA_UNDECLARED")?;
        let mapping = Mapping {
            id: owner.id.clone(),
            path: raw["path"].as_str().ok_or("MOD_MEDIA_UNDECLARED")?.into(),
            mime: raw["mime"].as_str().ok_or("MOD_MEDIA_UNDECLARED")?.into(),
        };
        selected.push((
            format!("{}:{}", owner.package_id, owner.id),
            (root.clone(), mapping),
        ));
    }
    for (key, mapping) in selected {
        data.media.insert(key, mapping);
    }
    data.mods.clear();
    Ok(())
}
#[tauri::command]
pub(crate) async fn native_startup_load(
    handle: tauri::AppHandle,
    state: tauri::State<'_, StartupState>,
    session_id: String,
) -> Result<Prepared, String> {
    uuid::Uuid::parse_str(&session_id).map_err(|_| "STARTUP_SESSION_INVALID")?;
    let current = Arc::new(Session {
        id: session_id,
        cancelled: Arc::new(AtomicBool::new(false)),
        data: Mutex::new(Data::default()),
    });
    let loading_id = current.id.clone();
    {
        let mut slot = state.0.lock().map_err(|e| e.to_string())?;
        if slot.is_some() {
            return Err("STARTUP_SESSION_ACTIVE".into());
        }
        *slot = Some(current.clone());
    }
    native_io_trace::mark_startup();
    let result = match tauri::async_runtime::spawn_blocking(move || load(handle, current)).await {
        Ok(result) => result,
        Err(error) => Err(error.to_string()),
    };
    if result.is_err() {
        let mut slot = state.0.lock().map_err(|e| e.to_string())?;
        if slot.as_ref().is_some_and(|s| s.id == loading_id) {
            *slot = None;
        }
    }
    result
}
#[tauri::command]
pub(crate) fn native_startup_metadata(
    state: tauri::State<'_, StartupState>,
    session_id: String,
) -> Result<tauri::ipc::Response, String> {
    let current = session(&state, &session_id)?;
    cancelled(&current)?;
    let bytes = current
        .data
        .lock()
        .map_err(|e| e.to_string())?
        .metadata
        .take()
        .ok_or("STARTUP_TRANSFER_CONSUMED")?;
    Ok(tauri::ipc::Response::new(bytes))
}
#[tauri::command]
pub(crate) fn native_startup_engine(
    state: tauri::State<'_, StartupState>,
    session_id: String,
) -> Result<tauri::ipc::Response, String> {
    let current = session(&state, &session_id)?;
    cancelled(&current)?;
    let bytes = current
        .data
        .lock()
        .map_err(|e| e.to_string())?
        .engine
        .take()
        .ok_or("STARTUP_TRANSFER_CONSUMED")?;
    Ok(tauri::ipc::Response::new(bytes))
}
#[tauri::command]
pub(crate) fn native_startup_cancel(
    state: tauri::State<'_, StartupState>,
    session_id: String,
) -> Result<(), String> {
    let current = session(&state, &session_id)?;
    current.cancelled.store(true, Ordering::Release);
    Ok(())
}
#[tauri::command]
pub(crate) fn native_startup_close(
    state: tauri::State<'_, StartupState>,
    session_id: String,
) -> Result<(), String> {
    let mut slot = state.0.lock().map_err(|e| e.to_string())?;
    if slot.as_ref().is_some_and(|s| s.id == session_id) {
        let s = slot.take().unwrap();
        s.cancelled.store(true, Ordering::Release);
    }
    Ok(())
}
#[tauri::command]
pub(crate) async fn native_live_media_read(
    state: tauri::State<'_, StartupState>,
    session_id: String,
    package_id: String,
    logical_id: String,
) -> Result<tauri::ipc::Response, String> {
    let current = session(&state, &session_id)?;
    let mapping = current
        .data
        .lock()
        .map_err(|e| e.to_string())?
        .media
        .get(&format!("{package_id}:{logical_id}"))
        .cloned()
        .ok_or("MEDIA_UNMAPPED")?;
    tauri::async_runtime::spawn_blocking(move || {
        cancelled(&current)?;
        let bytes = read_media(&mapping.0, &mapping.1)?;
        cancelled(&current)?;
        Ok(tauri::ipc::Response::new(bytes))
    })
    .await
    .map_err(|e| e.to_string())?
}
fn read_media(root: &Path, mapping: &Mapping) -> Result<Vec<u8>, String> {
    if !safe_path(&mapping.path) || mapping.mime.len() > 256 {
        return Err("MEDIA_PATH_REFUSED".into());
    }
    let _metadata = native_io_trace::start(Category::Media, Operation::Metadata, "live-media");
    let file = crate::scoped_files::open(root, &mapping.path)?;
    let metadata = file.metadata().map_err(|e| e.to_string())?;
    if !metadata.is_file() || metadata.len() > MAX_MEDIA {
        return Err("MEDIA_TOO_LARGE".into());
    }
    drop(_metadata);
    let mut span = native_io_trace::start(Category::Media, Operation::Read, "live-media");
    let mut bytes = Vec::new();
    file.take(MAX_MEDIA + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > MAX_MEDIA {
        return Err("MEDIA_TOO_LARGE".into());
    }
    if let Some(span) = &mut span {
        span.bytes(bytes.len() as u64);
    }
    Ok(bytes)
}

fn media_revision(root: &Path, mapping: &Mapping) -> Option<String> {
    if !safe_path(&mapping.path) {
        return None;
    }
    let _span = native_io_trace::start(Category::Media, Operation::Metadata, "live-media-revision");
    let file = crate::scoped_files::open(root, &mapping.path).ok()?;
    let metadata = file.metadata().ok()?;
    if !metadata.is_file() || metadata.len() > MAX_MEDIA {
        return None;
    }
    let modified = metadata
        .modified()
        .ok()?
        .duration_since(std::time::UNIX_EPOCH)
        .ok()?;
    #[cfg(unix)]
    let identity = {
        use std::os::unix::fs::MetadataExt;
        format!(
            "{}:{}:{}:{}",
            metadata.dev(),
            metadata.ino(),
            metadata.ctime(),
            metadata.ctime_nsec()
        )
    };
    #[cfg(not(unix))]
    let identity = format!("{:?}", metadata.created().ok());
    Some(format!(
        "{}:{}:{}",
        metadata.len(),
        modified.as_nanos(),
        identity
    ))
}
#[tauri::command]
pub(crate) async fn native_live_media_revision(
    state: tauri::State<'_, StartupState>,
    session_id: String,
    package_id: String,
    logical_id: String,
) -> Result<Option<String>, String> {
    let current = session(&state, &session_id)?;
    let mapping = current
        .data
        .lock()
        .map_err(|e| e.to_string())?
        .media
        .get(&format!("{package_id}:{logical_id}"))
        .cloned();
    tauri::async_runtime::spawn_blocking(move || {
        cancelled(&current)?;
        Ok(mapping.and_then(|(root, mapping)| media_revision(&root, &mapping)))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub(crate) fn native_content_location(handle: tauri::AppHandle) -> Result<String, String> {
    Ok(handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("readable-content")
        .to_string_lossy()
        .into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn hashes_and_parses_the_same_bounded_buffer() {
        let root = std::env::temp_dir().join(format!("ascencio-snapshot-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let bytes = br#"{"schemaVersion":1}"#;
        fs::write(root.join("critical.json"), bytes).unwrap();
        let resource = Resource {
            path: "critical.json".into(),
            bytes: bytes.len() as u64,
            sha256: digest(bytes),
        };
        let read = read_verified(&root, &resource, 100, Category::Gameplay).unwrap();
        assert_eq!(
            serde_json::from_slice::<Value>(&read).unwrap()["schemaVersion"],
            1
        );
        fs::write(root.join("critical.json"), b"corrupt").unwrap();
        assert!(read_verified(&root, &resource, 100, Category::Gameplay)
            .unwrap_err()
            .contains("BASE_HASH_MISMATCH"));
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn media_containment_rechecked_and_missing_media_is_not_a_startup_input() {
        let root = std::env::temp_dir().join(format!("ascencio-media-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let mapping = Mapping {
            id: "test".into(),
            path: "../user-data.json".into(),
            mime: "image/png".into(),
        };
        assert_eq!(
            read_media(&root, &mapping).unwrap_err(),
            "MEDIA_PATH_REFUSED"
        );
        let mapping = Mapping {
            path: "image.png".into(),
            ..mapping
        };
        assert!(read_media(&root, &mapping).is_err());
        fs::write(root.join("image.png"), b"one").unwrap();
        assert_eq!(read_media(&root, &mapping).unwrap(), b"one");
        fs::write(root.join("image.png"), b"two").unwrap();
        assert_eq!(read_media(&root, &mapping).unwrap(), b"two");
        fs::remove_dir_all(root).unwrap();
    }
}
