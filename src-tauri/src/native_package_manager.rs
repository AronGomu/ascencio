use crate::native_storage::{installed, open_package, package_header, package_path};
use crate::{content_folder, manifest_is_valid, verified_file, ReleaseManifest, ReleasePackage};
use rusqlite::{Connection, DatabaseName};
use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::PathBuf,
    sync::Mutex,
};
use uuid::Uuid;

#[derive(Default)]
pub(crate) struct PackageManager(Mutex<ManagerState>);
#[derive(Default)]
struct ManagerState {
    imports: HashMap<String, Staging>,
    sessions: HashSet<String>,
}
struct Staging {
    folder: PathBuf,
    expected_generation: u64,
    files: Vec<StagedFile>,
}
struct StagedFile {
    size: u64,
    copied: u64,
    path: PathBuf,
}
#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub(crate) enum Outcome {
    Ok { value: Value },
    Failed { error: Failure },
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Failure {
    code: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    package_id: Option<String>,
}
fn ok(value: Value) -> Outcome {
    Outcome::Ok { value }
}
fn failed(code: &'static str, package_id: Option<&str>) -> Outcome {
    Outcome::Failed {
        error: Failure {
            code,
            package_id: package_id.map(str::to_owned),
        },
    }
}
fn generation(manifest: &ReleaseManifest) -> u64 {
    manifest.generation.unwrap_or(1)
}

#[tauri::command]
pub(crate) fn native_import_begin(
    handle: tauri::AppHandle,
    state: tauri::State<'_, PackageManager>,
    sizes: Vec<u64>,
    expected_generation: u64,
) -> Outcome {
    if sizes.is_empty()
        || sizes.len() > 64
        || sizes
            .iter()
            .any(|size| *size < 512 || *size > 8_000_000_000)
    {
        return failed("PACKAGE_INVALID", None);
    }
    let current = match installed(&handle) {
        Ok(value) => value,
        Err(_) => return failed("STORAGE_UNAVAILABLE", None),
    };
    if generation(&current) != expected_generation {
        return failed("STORAGE_CONFLICT", None);
    }
    let root = match content_folder(&handle) {
        Ok(value) => value,
        Err(_) => return failed("STORAGE_UNAVAILABLE", None),
    };
    let token = Uuid::new_v4().to_string();
    let imports_root = root.join(".imports");
    if fs::symlink_metadata(&imports_root)
        .is_ok_and(|info| !info.is_dir() || info.file_type().is_symlink())
    {
        return failed("STORAGE_UNAVAILABLE", None);
    }
    let folder = imports_root.join(&token);
    if fs::create_dir_all(&folder).is_err() {
        return failed("STORAGE_UNAVAILABLE", None);
    }
    let files = sizes
        .into_iter()
        .enumerate()
        .map(|(index, size)| StagedFile {
            size,
            copied: 0,
            path: folder.join(format!("{index}.sqlite")),
        })
        .collect();
    let mut guard = match state.0.lock() {
        Ok(value) => value,
        Err(_) => return failed("STORAGE_UNAVAILABLE", None),
    };
    if !guard.sessions.is_empty() {
        let _ = fs::remove_dir_all(&folder);
        return failed("APP_SESSION_ACTIVE", None);
    }
    guard.imports.insert(
        token.clone(),
        Staging {
            folder,
            expected_generation,
            files,
        },
    );
    ok(json!({"token":token}))
}
#[tauri::command]
pub(crate) fn native_import_chunk(
    state: tauri::State<'_, PackageManager>,
    request: tauri::ipc::Request,
) -> Outcome {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return failed("RPC_INVALID", None);
    };
    let Some(token) = request
        .headers()
        .get("x-content-token")
        .and_then(|value| value.to_str().ok())
    else {
        return failed("RPC_INVALID", None);
    };
    let Some(index) = request
        .headers()
        .get("x-content-index")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<usize>().ok())
    else {
        return failed("RPC_INVALID", None);
    };
    if bytes.is_empty() || bytes.len() > 1024 * 1024 {
        return failed("PACKAGE_INVALID", None);
    }
    let mut guard = match state.0.lock() {
        Ok(value) => value,
        Err(_) => return failed("STORAGE_UNAVAILABLE", None),
    };
    let Some(staging) = guard.imports.get_mut(token) else {
        return failed("STORAGE_CONFLICT", None);
    };
    let Some(file) = staging.files.get_mut(index) else {
        return failed("PACKAGE_INVALID", None);
    };
    if file.copied.saturating_add(bytes.len() as u64) > file.size {
        return failed("PACKAGE_INVALID", None);
    }
    let result = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file.path)
        .and_then(|mut output| output.write_all(&bytes));
    if result.is_err() {
        return failed("STORAGE_UNAVAILABLE", None);
    }
    file.copied += bytes.len() as u64;
    ok(json!({"copiedBytes":file.copied}))
}
#[tauri::command]
pub(crate) fn native_import_preview(
    state: tauri::State<'_, PackageManager>,
    token: String,
) -> Outcome {
    let guard = match state.0.lock() {
        Ok(value) => value,
        Err(_) => return failed("STORAGE_UNAVAILABLE", None),
    };
    let Some(staging) = guard.imports.get(&token) else {
        return failed("STORAGE_CONFLICT", None);
    };
    if staging.files.iter().any(|file| file.copied != file.size) {
        return failed("PACKAGE_SOURCE_INCOMPLETE", None);
    }
    let mut entries = Vec::new();
    for file in &staging.files {
        if File::open(&file.path)
            .and_then(|handle| handle.sync_all())
            .is_err()
        {
            return failed("STORAGE_UNAVAILABLE", None);
        }
        let (package, header) = match examine(&file.path) {
            Ok(value) => value,
            Err(_) => return failed("PACKAGE_INVALID", None),
        };
        entries.push(json!({"packageId":package.package_id,"version":package.version,"bytes":package.bytes,"sha256":package.sha256,"manifest":header}));
    }
    ok(Value::Array(entries))
}
fn examine(path: &PathBuf) -> Result<(ReleasePackage, Value), String> {
    let metadata = fs::symlink_metadata(path).map_err(|error| error.to_string())?;
    if !metadata.is_file() || metadata.len() < 512 {
        return Err("Invalid package file".into());
    }
    let mut file = File::open(path).map_err(|error| error.to_string())?;
    let mut digest = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let count = file.read(&mut buffer).map_err(|error| error.to_string())?;
        if count == 0 {
            break;
        }
        digest.update(&buffer[..count]);
    }
    let db = open_package(path)?;
    let version: i64 = db
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    let integrity: String = db
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    if version != 1 || integrity != "ok" {
        return Err("Package integrity failed".into());
    }
    let schema_type = schema_type(&db)?;
    let foreign_keys = db
        .prepare("PRAGMA foreign_key_check")
        .map_err(|error| error.to_string())?
        .exists([])
        .map_err(|error| error.to_string())?;
    if foreign_keys {
        return Err("Package foreign keys invalid".into());
    }
    let header = package_header(&db)?;
    if header["packageType"] != schema_type {
        return Err("Package schema type mismatch".into());
    }
    let id = header["packageId"]
        .as_str()
        .ok_or("Invalid package ID")?
        .to_owned();
    let package_version = header["version"]
        .as_str()
        .ok_or("Invalid package version")?
        .to_owned();
    if !valid_id(&id)
        || !valid_version(&package_version)
        || header["schemaVersion"] != 1
        || !valid_header_dependencies(&header)
    {
        return Err("Invalid package header".into());
    }
    validate_asset_rows(&db, header["packageType"].as_str().ok_or("package type")?)?;
    validate_content_rows(&db, &header)?;
    Ok((
        ReleasePackage {
            package_id: id,
            version: package_version,
            bytes: metadata.len(),
            sha256: format!("{:x}", digest.finalize()),
        },
        header,
    ))
}
fn schema_type(db: &Connection) -> Result<&'static str, String> {
    let mut statement = db
        .prepare("SELECT type,name,tbl_name FROM sqlite_schema ORDER BY type,name")
        .map_err(|error| error.to_string())?;
    let found = statement
        .query_map([], |row| {
            Ok(format!(
                "{}:{}:{}",
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?
            ))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    let common = [
        "table:package_manifest:package_manifest",
        "table:package_meta:package_meta",
        "table:assets:assets",
        "index:sqlite_autoindex_package_manifest_1:package_manifest",
        "index:sqlite_autoindex_package_meta_1:package_meta",
        "index:sqlite_autoindex_assets_1:assets",
    ];
    let variants: [(&str, &[&str]); 4] = [
        ("duel-core", &[]),
        (
            "card-library",
            &[
                "table:cards:cards",
                "table:card_texts:card_texts",
                "table:scripts:scripts",
                "table:sets:sets",
                "table:set_cards:set_cards",
                "table:card_search:card_search",
                "index:sqlite_autoindex_card_texts_1:card_texts",
                "index:sqlite_autoindex_scripts_1:scripts",
                "index:sqlite_autoindex_sets_1:sets",
                "index:sqlite_autoindex_set_cards_1:set_cards",
                "index:sqlite_autoindex_card_search_1:card_search",
                "index:card_search_name:card_search",
            ],
        ),
        (
            "freeplay",
            &[
                "table:decks:decks",
                "table:opponents:opponents",
                "table:freeplay_card_limits:freeplay_card_limits",
                "index:sqlite_autoindex_decks_1:decks",
                "index:sqlite_autoindex_opponents_1:opponents",
            ],
        ),
        (
            "chapter",
            &[
                "table:decks:decks",
                "table:opponents:opponents",
                "table:chapter_card_limits:chapter_card_limits",
                "table:story_documents:story_documents",
                "index:sqlite_autoindex_decks_1:decks",
                "index:sqlite_autoindex_opponents_1:opponents",
                "index:sqlite_autoindex_story_documents_1:story_documents",
            ],
        ),
    ];
    for (kind, extra) in variants {
        let mut expected = common
            .iter()
            .chain(extra.iter())
            .map(|item| item.to_string())
            .collect::<Vec<_>>();
        expected.sort();
        if found == expected {
            return Ok(kind);
        }
    }
    Err("Unexpected package schema objects".into())
}
fn validate_asset_rows(db: &Connection, package_type: &str) -> Result<(), String> {
    let mut statement = db
        .prepare("SELECT rowid,path,mime,byte_length,sha256 FROM assets ORDER BY path")
        .map_err(|error| error.to_string())?;
    let mut rows = statement.query([]).map_err(|error| error.to_string())?;
    let mut folded = HashSet::new();
    let mut required = HashSet::new();
    while let Some(row) = rows.next().map_err(|error| error.to_string())? {
        let rowid: i64 = row.get(0).map_err(|error| error.to_string())?;
        let path: String = row.get(1).map_err(|error| error.to_string())?;
        let mime: String = row.get(2).map_err(|error| error.to_string())?;
        let length: i64 = row.get(3).map_err(|error| error.to_string())?;
        let expected: String = row.get(4).map_err(|error| error.to_string())?;
        if !valid_asset_path(&path)
            || !owned_asset_path(package_type, &path)
            || mime.is_empty()
            || length < 0
            || expected.len() != 64
            || !expected.bytes().all(|byte| byte.is_ascii_hexdigit())
            || !folded.insert(path.to_lowercase())
        {
            return Err("Invalid asset metadata".into());
        }
        let cap = if package_type == "duel-core" {
            16 * 1024 * 1024
        } else {
            64 * 1024 * 1024
        };
        if length > cap {
            return Err("Asset too large".into());
        }
        let mut blob = db
            .blob_open(DatabaseName::Main, "assets", "data", rowid, true)
            .map_err(|error| error.to_string())?;
        if blob.len() as i64 != length {
            return Err("Asset length mismatch".into());
        }
        let mut digest = Sha256::new();
        let mut buffer = [0u8; 64 * 1024];
        loop {
            let count = blob.read(&mut buffer).map_err(|error| error.to_string())?;
            if count == 0 {
                break;
            }
            digest.update(&buffer[..count]);
        }
        if format!("{:x}", digest.finalize()) != expected {
            return Err("Asset digest mismatch".into());
        }
        required.insert(path);
    }
    if package_type == "duel-core"
        && !["engine/ocgcore.sync.wasm", "engine/vendor-manifest.json"]
            .iter()
            .all(|path| required.contains(*path))
    {
        return Err("Required engine asset missing".into());
    }
    Ok(())
}
fn valid_asset_path(path: &str) -> bool {
    !path.is_empty()
        && path.len() <= 1024
        && !path.starts_with('/')
        && !path.contains('\\')
        && !path.contains('\0')
        && path
            .split('/')
            .all(|part| !part.is_empty() && part != "." && part != "..")
}
fn owned_asset_path(package_type: &str, path: &str) -> bool {
    match package_type {
        "duel-core" => ["engine/ocgcore.sync.wasm", "engine/vendor-manifest.json"].contains(&path),
        "freeplay" => false,
        "chapter" => path.starts_with("media/"),
        "card-library" => {
            path == "card-back.jpg"
                || (path.starts_with("cards/full/") || path.starts_with("cards/cropped/"))
                    && path.ends_with(".jpg")
                || path.starts_with("sets/") && path.rsplit_once('.').is_some()
        }
        _ => false,
    }
}
pub(crate) fn valid_id(id: &str) -> bool {
    matches!(id, "duel-core" | "card-library" | "freeplay")
        || (id.len() <= 128
            && id.strip_prefix("card-pack-").is_some_and(|suffix| {
                !suffix.is_empty()
                    && suffix.split('-').all(|part| {
                        !part.is_empty()
                            && part
                                .bytes()
                                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
                    })
            }))
        || id.strip_prefix("chapter-").is_some_and(|suffix| {
            suffix.len() >= 2
                && suffix.bytes().all(|b| b.is_ascii_digit())
                && !suffix.starts_with("00")
        })
}
fn valid_version(version: &str) -> bool {
    version.split('.').count() == 3
        && version.split('.').all(|part| {
            !part.is_empty()
                && part.bytes().all(|b| b.is_ascii_digit())
                && (part.len() == 1 || !part.starts_with('0'))
        })
}
fn valid_header_dependencies(header: &Value) -> bool {
    let Some(id) = header["packageId"].as_str() else {
        return false;
    };
    let Some(dependencies) = header["dependencies"].as_array() else {
        return false;
    };
    let expected_type = if id == "duel-core" {
        "duel-core"
    } else if id == "card-library" || id.starts_with("card-pack-") {
        "card-library"
    } else if id == "freeplay" {
        "freeplay"
    } else {
        "chapter"
    };
    if header["packageType"] != expected_type {
        return false;
    }
    let required = if id.starts_with("card-pack-") {
        Some("card-library")
    } else if id == "card-library" {
        Some("duel-core")
    } else if id == "freeplay" {
        Some("card-library")
    } else {
        None
    };
    if id == "duel-core" && !dependencies.is_empty()
        || required.is_some_and(|required| {
            !dependencies
                .iter()
                .any(|dependency| dependency["packageId"] == required)
        })
        || expected_type == "chapter" && dependencies.is_empty()
    {
        return false;
    }
    let mut previous = "";
    for dependency in dependencies {
        let Some(required_id) = dependency["packageId"].as_str() else {
            return false;
        };
        let Some(version) = dependency["version"].as_str() else {
            return false;
        };
        if !valid_id(required_id)
            || !valid_version(version)
            || required_id <= previous
            || required_id == id
            || !["exact", "minimum"].contains(&dependency["requirement"].as_str().unwrap_or(""))
        {
            return false;
        }
        previous = required_id;
    }
    true
}
fn dependencies_valid(headers: &HashMap<String, Value>) -> bool {
    fn visit<'a>(
        id: &'a str,
        headers: &'a HashMap<String, Value>,
        visiting: &mut HashSet<&'a str>,
        visited: &mut HashSet<&'a str>,
    ) -> bool {
        if visiting.contains(id) {
            return false;
        }
        if visited.contains(id) {
            return true;
        }
        visiting.insert(id);
        if let Some(dependencies) = headers
            .get(id)
            .and_then(|header| header["dependencies"].as_array())
        {
            for dependency in dependencies {
                if let Some(required) = dependency["packageId"].as_str() {
                    if !visit(required, headers, visiting, visited) {
                        return false;
                    }
                }
            }
        }
        visiting.remove(id);
        visited.insert(id);
        true
    }
    let mut visited = HashSet::new();
    for id in headers.keys() {
        if !visit(id, headers, &mut HashSet::new(), &mut visited) {
            return false;
        }
    }

    for (id, header) in headers {
        let Some(dependencies) = header["dependencies"].as_array() else {
            return false;
        };
        for dependency in dependencies {
            let Some(required_id) = dependency["packageId"].as_str() else {
                return false;
            };
            let Some(required_version) = dependency["version"].as_str() else {
                return false;
            };
            let Some(actual) = headers.get(required_id) else {
                return false;
            };
            let Some(actual_version) = actual["version"].as_str() else {
                return false;
            };
            match dependency["requirement"].as_str() {
                Some("exact") if actual_version == required_version => {}
                Some("minimum")
                    if version_parts(actual_version) >= version_parts(required_version) => {}
                _ => return false,
            }
            if required_id == id {
                return false;
            }
        }
    }
    true
}
fn version_parts(value: &str) -> Vec<u64> {
    value
        .split('.')
        .map(|part| part.parse().unwrap_or(0))
        .collect()
}
fn write_active(root: &PathBuf, manifest: &ReleaseManifest) -> Result<(), String> {
    let temp = root.join(format!("active.{}.partial", Uuid::new_v4()));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp)
        .map_err(|error| error.to_string())?;
    file.write_all(&serde_json::to_vec_pretty(manifest).map_err(|error| error.to_string())?)
        .map_err(|error| error.to_string())?;
    file.sync_all().map_err(|error| error.to_string())?;
    fs::rename(&temp, root.join("active.json")).map_err(|error| error.to_string())
}
#[tauri::command]
pub(crate) fn native_import_commit(
    handle: tauri::AppHandle,
    state: tauri::State<'_, PackageManager>,
    token: String,
) -> Outcome {
    let mut guard = match state.0.lock() {
        Ok(value) => value,
        Err(_) => return failed("STORAGE_UNAVAILABLE", None),
    };
    if !guard.sessions.is_empty() {
        return failed("APP_SESSION_ACTIVE", None);
    }
    let Some(staging) = guard.imports.remove(&token) else {
        return failed("STORAGE_CONFLICT", None);
    };
    let result = (|| -> Result<(), &'static str> {
        let mut active = installed(&handle).map_err(|_| "STORAGE_UNAVAILABLE")?;
        if generation(&active) != staging.expected_generation {
            return Err("STORAGE_CONFLICT");
        }
        let root = content_folder(&handle).map_err(|_| "STORAGE_UNAVAILABLE")?;
        let mut headers = HashMap::new();
        for package in &active.packages {
            let header = package_header(
                &open_package(&package_path(&root, package)).map_err(|_| "PACKAGE_INVALID")?,
            )
            .map_err(|_| "PACKAGE_INVALID")?;
            headers.insert(package.package_id.clone(), header);
        }
        let mut staged = Vec::new();
        let mut ids = HashSet::new();
        for file in &staging.files {
            if file.copied != file.size {
                return Err("PACKAGE_SOURCE_INCOMPLETE");
            }
            let (package, header) = examine(&file.path).map_err(|_| "PACKAGE_INVALID")?;
            if !ids.insert(package.package_id.clone()) {
                return Err("PACKAGE_DUPLICATE");
            }
            if let Some(existing) = active.packages.iter().find(|item| {
                item.package_id == package.package_id && item.version == package.version
            }) {
                if existing.sha256 != package.sha256 {
                    return Err("PACKAGE_IDENTITY_CONFLICT");
                }
            }
            headers.insert(package.package_id.clone(), header);
            staged.push((file.path.clone(), package));
        }
        if !dependencies_valid(&headers) {
            return Err("PACKAGE_DEPENDENCY_INCOMPATIBLE");
        }
        let mut paths: HashMap<String, PathBuf> = active
            .packages
            .iter()
            .map(|package| (package.package_id.clone(), package_path(&root, package)))
            .collect();
        for (source, package) in &staged {
            paths.insert(package.package_id.clone(), source.clone());
        }
        validate_candidate_content(&paths, &headers).map_err(|_| "PACKAGE_SOURCE_INCOMPLETE")?;
        let mut changed = false;
        for (source, package) in staged {
            let target = package_path(&root, &package);
            let active_same_identity = active.packages.iter().any(|item| {
                item.package_id == package.package_id
                    && item.version == package.version
                    && item.sha256 == package.sha256
            });
            let target_matches = matches!(verified_file(&target, &package), Ok(true));
            if active_same_identity && target_matches {
                continue;
            }
            if !target_matches {
                if target.exists() && !active_same_identity {
                    return Err("PACKAGE_IDENTITY_CONFLICT");
                }
                if fs::symlink_metadata(&target)
                    .is_ok_and(|info| !info.is_file() || info.file_type().is_symlink())
                {
                    return Err("PACKAGE_INVALID");
                }
                let temporary = root.join(format!(
                    "{}.{}.partial",
                    target.file_name().unwrap_or_default().to_string_lossy(),
                    Uuid::new_v4()
                ));
                fs::copy(&source, &temporary).map_err(|_| "STORAGE_UNAVAILABLE")?;
                File::open(&temporary)
                    .and_then(|handle| handle.sync_all())
                    .map_err(|_| "STORAGE_UNAVAILABLE")?;
                if !matches!(verified_file(&temporary, &package), Ok(true)) {
                    let _ = fs::remove_file(&temporary);
                    return Err("PACKAGE_INTEGRITY_FAILED");
                }
                fs::rename(&temporary, &target).map_err(|_| "STORAGE_UNAVAILABLE")?;
                if !matches!(verified_file(&target, &package), Ok(true)) {
                    return Err("PACKAGE_INTEGRITY_FAILED");
                }
            }
            active
                .packages
                .retain(|item| item.package_id != package.package_id);
            active.packages.push(package);
            changed = true;
        }
        if !changed {
            return Ok(());
        }
        active
            .packages
            .sort_by(|a, b| a.package_id.cmp(&b.package_id));
        active.generation = Some(
            generation(&active)
                .checked_add(1)
                .ok_or("STORAGE_CONFLICT")?,
        );
        if !manifest_is_valid(&active) {
            return Err("PACKAGE_DEPENDENCY_MISSING");
        }
        write_active(&root, &active).map_err(|_| "STORAGE_UNAVAILABLE")?;
        Ok(())
    })();
    let _ = fs::remove_dir_all(staging.folder);
    match result {
        Ok(()) => ok(json!({"committed":true})),
        Err(code) => failed(code, None),
    }
}
#[tauri::command]
pub(crate) fn native_import_cancel(state: tauri::State<'_, PackageManager>, token: String) {
    if let Ok(mut guard) = state.0.lock() {
        if let Some(staging) = guard.imports.remove(&token) {
            let _ = fs::remove_dir_all(staging.folder);
        }
    }
}
#[tauri::command]
pub(crate) fn native_package_acquire(
    handle: tauri::AppHandle,
    state: tauri::State<'_, PackageManager>,
) -> Outcome {
    let mut guard = match state.0.lock() {
        Ok(value) => value,
        Err(_) => return failed("STORAGE_UNAVAILABLE", None),
    };
    let active = match installed(&handle) {
        Ok(value) => value,
        Err(_) => return failed("STORAGE_UNAVAILABLE", None),
    };
    let session_id = Uuid::new_v4().to_string();
    guard.sessions.insert(session_id.clone());
    ok(json!({"sessionId":session_id,"generation":generation(&active)}))
}
#[tauri::command]
pub(crate) fn native_package_release(state: tauri::State<'_, PackageManager>, session_id: String) {
    if let Ok(mut guard) = state.0.lock() {
        guard.sessions.remove(&session_id);
    }
}
#[tauri::command]
pub(crate) fn native_package_cleanup(
    handle: tauri::AppHandle,
    state: tauri::State<'_, PackageManager>,
) -> Outcome {
    let guard = match state.0.lock() {
        Ok(value) => value,
        Err(_) => return failed("STORAGE_UNAVAILABLE", None),
    };
    if !guard.sessions.is_empty() || !guard.imports.is_empty() {
        return failed("APP_SESSION_ACTIVE", None);
    }
    let active = match installed(&handle) {
        Ok(value) => value,
        Err(_) => return failed("STORAGE_UNAVAILABLE", None),
    };
    let root = match content_folder(&handle) {
        Ok(value) => value,
        Err(_) => return failed("STORAGE_UNAVAILABLE", None),
    };
    let keep: HashSet<_> = active
        .packages
        .iter()
        .map(|p| format!("{}-{}.sqlite", p.package_id, p.version))
        .collect();
    let mut removed = 0;
    let mut remaining = 0;
    let entries = match fs::read_dir(root) {
        Ok(value) => value,
        Err(_) => return failed("STORAGE_UNAVAILABLE", None),
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name.ends_with(".sqlite") || !valid_content_filename(&name) {
            continue;
        }
        if keep.contains(&name) {
            remaining += 1;
        } else if fs::remove_file(entry.path()).is_ok() {
            removed += 1;
        } else {
            return failed("STORAGE_UNAVAILABLE", None);
        }
    }
    ok(json!({"removedFiles":removed,"remainingFiles":remaining}))
}
fn valid_content_filename(value: &str) -> bool {
    let Some(base) = value.strip_suffix(".sqlite") else {
        return false;
    };
    let Some((id, version)) = base.rsplit_once('-') else {
        return false;
    };
    valid_id(id) && valid_version(version)
}

#[tauri::command]
pub(crate) fn native_package_remove(
    handle: tauri::AppHandle,
    state: tauri::State<'_, PackageManager>,
    package_id: String,
    expected_generation: u64,
) -> Outcome {
    if !valid_id(&package_id) {
        return failed("RPC_INVALID", None);
    }
    let guard = match state.0.lock() {
        Ok(value) => value,
        Err(_) => return failed("STORAGE_UNAVAILABLE", None),
    };
    if !guard.sessions.is_empty() || !guard.imports.is_empty() {
        return failed("APP_SESSION_ACTIVE", None);
    }
    let mut active = match installed(&handle) {
        Ok(value) => value,
        Err(_) => return failed("STORAGE_UNAVAILABLE", None),
    };
    if generation(&active) != expected_generation {
        return failed("STORAGE_CONFLICT", None);
    }
    if !active
        .packages
        .iter()
        .any(|item| item.package_id == package_id)
    {
        return failed("PACKAGE_NOT_FOUND", Some(&package_id));
    }
    let root = match content_folder(&handle) {
        Ok(value) => value,
        Err(_) => return failed("STORAGE_UNAVAILABLE", None),
    };
    for package in &active.packages {
        if package.package_id == package_id {
            continue;
        }
        let header =
            match open_package(&package_path(&root, package)).and_then(|db| package_header(&db)) {
                Ok(value) => value,
                Err(_) => return failed("PACKAGE_INVALID", Some(&package.package_id)),
            };
        if header["dependencies"]
            .as_array()
            .is_some_and(|deps| deps.iter().any(|dep| dep["packageId"] == package_id))
        {
            return failed("PACKAGE_REFERENCED", Some(&package_id));
        }
    }
    active.packages.retain(|item| item.package_id != package_id);
    if !manifest_is_valid(&active) {
        return failed("PACKAGE_REFERENCED", Some(&package_id));
    }
    active.generation = Some(generation(&active).saturating_add(1));
    if write_active(&root, &active).is_err() {
        return failed("STORAGE_UNAVAILABLE", None);
    }
    ok(json!({"cleanupPending":true}))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    fn header(id: &str, kind: &str, dependencies: &[&str]) -> Value {
        json!({"packageId":id,"packageType":kind,"version":"1.0.0","schemaVersion":1,"createdAt":"2026-09-24T00:00:00.000Z","dependencies":dependencies.iter().map(|id|json!({"packageId":id,"requirement":"minimum","version":"1.0.0"})).collect::<Vec<_>>()})
    }
    #[test]
    fn module_graph_allows_absent_previous_chapters_and_rejects_cycles() {
        let mut headers = HashMap::from([
            (
                "duel-core".to_owned(),
                header("duel-core", "duel-core", &[]),
            ),
            (
                "card-library".to_owned(),
                header("card-library", "card-library", &["duel-core"]),
            ),
            (
                "chapter-02".to_owned(),
                header("chapter-02", "chapter", &["card-library"]),
            ),
        ]);
        assert!(headers.values().all(valid_header_dependencies));
        assert!(dependencies_valid(&headers));
        headers.insert(
            "chapter-02".into(),
            header("chapter-02", "chapter", &["chapter-03"]),
        );
        headers.insert(
            "chapter-03".into(),
            header("chapter-03", "chapter", &["chapter-02"]),
        );
        assert!(!dependencies_valid(&headers));
    }
    #[test]
    fn versioned_progress_requirements_and_card_pack_ids_are_validated() {
        assert!(valid_id("card-pack-expansion-one"));
        assert!(!valid_id("card-pack-../escape"));
        let module = json!({"apiVersion":1,"choiceBeatId":null,"requiresProgress":[{"kind":"chapter-completed","chapterId":"chapter-01"},{"kind":"fact","id":"chapter-01:choice","equals":"trust-rin"}],"completion":[]});
        assert!(valid_chapter_module(&module));
        let mut future = module.clone();
        future["apiVersion"] = json!(2);
        assert!(!valid_chapter_module(&future));
        let mut malformed = module;
        malformed["requiresProgress"][1]["id"] = json!("unqualified");
        assert!(!valid_chapter_module(&malformed));
    }
    #[test]
    fn active_registry_can_be_empty_or_contain_only_a_later_chapter() {
        let mut active = ReleaseManifest {
            schema_version: 1,
            generation: Some(8),
            packages: vec![],
        };
        assert!(manifest_is_valid(&active));
        active.packages.push(ReleasePackage {
            package_id: "chapter-02".into(),
            version: "1.0.0".into(),
            bytes: 1024,
            sha256: "a".repeat(64),
        });
        assert!(manifest_is_valid(&active));
    }
    #[test]
    fn candidate_cards_require_declared_modules_and_conflicts_are_rejected() {
        let root = std::env::temp_dir().join(format!("ascencio-modules-{}", Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let mut paths = HashMap::new();
        for (id, code) in [("card-library", 1), ("card-pack-extra", 999)] {
            let path = root.join(format!("{id}.sqlite"));
            let db = Connection::open(&path).unwrap();
            db.execute_batch("CREATE TABLE cards(code INTEGER,definition_json TEXT);CREATE TABLE card_texts(card_code INTEGER,locale TEXT,name TEXT,description TEXT,strings_json TEXT);CREATE TABLE scripts(name TEXT,source TEXT);CREATE TABLE sets(id TEXT);").unwrap();
            db.execute(
                "INSERT INTO cards VALUES (?,?)",
                params![code, format!("{{\"code\":{code}}}")],
            )
            .unwrap();
            paths.insert(id.to_owned(), path);
        }
        let chapter = root.join("chapter.sqlite");
        let db = Connection::open(&chapter).unwrap();
        db.execute_batch("CREATE TABLE decks(cards_json TEXT);CREATE TABLE chapter_card_limits(card_code INTEGER);CREATE TABLE package_meta(key TEXT,value_json TEXT);INSERT INTO decks VALUES ('{\"main\":[999],\"extra\":[],\"side\":[]}');INSERT INTO package_meta VALUES ('config','{\"setIds\":[]}');").unwrap();
        drop(db);
        paths.insert("chapter-02".into(), chapter);
        let mut headers = HashMap::from([
            (
                "card-library".into(),
                header("card-library", "card-library", &[]),
            ),
            (
                "card-pack-extra".into(),
                header("card-pack-extra", "card-library", &["card-library"]),
            ),
            (
                "chapter-02".into(),
                header("chapter-02", "chapter", &["card-library"]),
            ),
        ]);
        assert!(validate_candidate_content(&paths, &headers).is_err());
        headers.insert(
            "chapter-02".into(),
            header(
                "chapter-02",
                "chapter",
                &["card-library", "card-pack-extra"],
            ),
        );
        assert!(validate_candidate_content(&paths, &headers).is_ok());
        let db = Connection::open(&paths["card-pack-extra"]).unwrap();
        db.execute_batch(
            "UPDATE cards SET code=1,definition_json='{\"code\":1,\"conflicting\":true}'",
        )
        .unwrap();
        drop(db);
        assert!(validate_candidate_content(&paths, &headers).is_err());
        fs::remove_dir_all(root).unwrap();
    }

    fn fixture() -> PathBuf {
        let path =
            std::env::temp_dir().join(format!("ascencio-native-package-{}.sqlite", Uuid::new_v4()));
        let db = Connection::open(&path).unwrap();
        db.execute_batch("PRAGMA journal_mode=DELETE; PRAGMA user_version=1;
            CREATE TABLE package_manifest (package_id TEXT PRIMARY KEY,package_type TEXT NOT NULL,version TEXT NOT NULL,schema_version INTEGER NOT NULL,dependencies_json TEXT NOT NULL,created_at TEXT NOT NULL);
            CREATE TABLE package_meta (key TEXT PRIMARY KEY,value_json TEXT NOT NULL);
            CREATE TABLE assets (path TEXT PRIMARY KEY,mime TEXT NOT NULL,byte_length INTEGER NOT NULL,sha256 TEXT NOT NULL,data BLOB NOT NULL);") .unwrap();
        db.execute("INSERT INTO package_manifest VALUES ('duel-core','duel-core','1.0.0',1,'[]','2026-09-24T00:00:00.000Z')",[]).unwrap();
        db.execute("INSERT INTO package_meta VALUES ('config','{\"coreVersion\":[11,0],\"wasmPath\":\"engine/ocgcore.sync.wasm\",\"vendorManifestPath\":\"engine/vendor-manifest.json\",\"strings\":{}}')", [])
            .unwrap();
        for (name, data) in [
            ("engine/ocgcore.sync.wasm", b"wasm".as_slice()),
            ("engine/vendor-manifest.json", b"{}".as_slice()),
        ] {
            let digest = format!("{:x}", Sha256::digest(data));
            db.execute(
                "INSERT INTO assets VALUES (?,?,?,?,?)",
                params![
                    name,
                    "application/octet-stream",
                    data.len() as i64,
                    digest,
                    data
                ],
            )
            .unwrap();
        }
        drop(db);
        path
    }
    #[test]
    fn rejects_corrupt_asset_before_package_activation() {
        let path = fixture();
        assert!(examine(&path).is_ok());
        let db = Connection::open(&path).unwrap();
        db.execute("UPDATE assets SET sha256='0000000000000000000000000000000000000000000000000000000000000000' WHERE path='engine/ocgcore.sync.wasm'",[]).unwrap();
        drop(db);
        assert!(examine(&path).is_err());
        fs::remove_file(path).unwrap();
    }
    #[test]
    fn rejects_extra_schema_objects_before_reading_package() {
        let path = fixture();
        let db = Connection::open(&path).unwrap();
        db.execute_batch("CREATE TRIGGER unexpected AFTER INSERT ON assets BEGIN SELECT 1; END;")
            .unwrap();
        drop(db);
        assert!(examine(&path).is_err());
        fs::remove_file(path).unwrap();
    }
}

fn validate_content_rows(db: &Connection, header: &Value) -> Result<(), String> {
    let manifests: i64 = db
        .query_row("SELECT count(*) FROM package_manifest", [], |row| {
            row.get(0)
        })
        .map_err(|error| error.to_string())?;
    if manifests != 1 {
        return Err("Package manifest count invalid".into());
    }
    let meta: i64 = db
        .query_row("SELECT count(*) FROM package_meta", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    if meta != 1 {
        return Err("Package config count invalid".into());
    }
    let config_json: String = db
        .query_row(
            "SELECT value_json FROM package_meta WHERE key='config'",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    let config: Value = serde_json::from_str(&config_json).map_err(|error| error.to_string())?;
    let kind = header["packageType"].as_str().ok_or("package type")?;
    if !config.is_object() {
        return Err("Package config invalid".into());
    }
    match kind {
        "duel-core" => {
            if config["coreVersion"] != json!([11, 0])
                || config["wasmPath"] != "engine/ocgcore.sync.wasm"
                || config["vendorManifestPath"] != "engine/vendor-manifest.json"
                || !config["strings"].is_object()
            {
                return Err("Core config invalid".into());
            }
        }
        "card-library" => {
            if config["defaultLocale"] != "en"
                || !config["locales"].is_array()
                || !config["requiredScripts"].is_object()
            {
                return Err("Library config invalid".into());
            }
            let mut stmt = db
                .prepare("SELECT code,definition_json FROM cards ORDER BY code")
                .map_err(|error| error.to_string())?;
            let mut rows = stmt.query([]).map_err(|error| error.to_string())?;
            while let Some(row) = rows.next().map_err(|error| error.to_string())? {
                let code: i64 = row.get(0).map_err(|error| error.to_string())?;
                let definition: String = row.get(1).map_err(|error| error.to_string())?;
                let parsed: Value =
                    serde_json::from_str(&definition).map_err(|error| error.to_string())?;
                if parsed["code"] != code {
                    return Err("Card code mismatch".into());
                }
            }
            let mut stmt = db
                .prepare("SELECT strings_json FROM card_texts")
                .map_err(|error| error.to_string())?;
            let mut rows = stmt.query([]).map_err(|error| error.to_string())?;
            while let Some(row) = rows.next().map_err(|error| error.to_string())? {
                let text: String = row.get(0).map_err(|error| error.to_string())?;
                if !serde_json::from_str::<Value>(&text)
                    .map_err(|error| error.to_string())?
                    .is_array()
                {
                    return Err("Card text invalid".into());
                }
            }
            let mut stmt = db
                .prepare("SELECT name,source,sha256 FROM scripts")
                .map_err(|error| error.to_string())?;
            let mut rows = stmt.query([]).map_err(|error| error.to_string())?;
            while let Some(row) = rows.next().map_err(|error| error.to_string())? {
                let name: String = row.get(0).map_err(|error| error.to_string())?;
                let source: String = row.get(1).map_err(|error| error.to_string())?;
                let expected: String = row.get(2).map_err(|error| error.to_string())?;
                if !name.ends_with(".lua")
                    || format!("{:x}", Sha256::digest(source.as_bytes())) != expected
                {
                    return Err("Script hash mismatch".into());
                }
            }
            let mut stmt = db
                .prepare("SELECT id,metadata_json FROM sets")
                .map_err(|error| error.to_string())?;
            let mut rows = stmt.query([]).map_err(|error| error.to_string())?;
            while let Some(row) = rows.next().map_err(|error| error.to_string())? {
                let id: String = row.get(0).map_err(|error| error.to_string())?;
                let metadata: String = row.get(1).map_err(|error| error.to_string())?;
                let parsed: Value =
                    serde_json::from_str(&metadata).map_err(|error| error.to_string())?;
                if parsed["id"] != id {
                    return Err("Set ID mismatch".into());
                }
            }
        }
        "freeplay" | "chapter" => {
            if !config["title"].is_string() || !config["defaults"].is_object() {
                return Err("Play config invalid".into());
            }
            if kind == "chapter"
                && config
                    .get("module")
                    .is_some_and(|module| !valid_chapter_module(module))
            {
                return Err("Chapter module API invalid".into());
            }
            if kind == "chapter"
                && config["chapterNumber"].as_u64()
                    != header["packageId"]
                        .as_str()
                        .and_then(|id| id.strip_prefix("chapter-"))
                        .and_then(|number| number.parse().ok())
            {
                return Err("Chapter number mismatch".into());
            }
            let mut stmt = db
                .prepare("SELECT cards_json FROM decks")
                .map_err(|error| error.to_string())?;
            let mut rows = stmt.query([]).map_err(|error| error.to_string())?;
            while let Some(row) = rows.next().map_err(|error| error.to_string())? {
                let cards: String = row.get(0).map_err(|error| error.to_string())?;
                let parsed: Value =
                    serde_json::from_str(&cards).map_err(|error| error.to_string())?;
                if !["main", "extra", "side"].iter().all(|key| {
                    parsed[*key]
                        .as_array()
                        .is_some_and(|items| items.iter().all(|code| code.as_u64().is_some()))
                }) {
                    return Err("Deck row invalid".into());
                }
            }
            let invalid_policy: i64 = db
                .query_row(
                    "SELECT count(*) FROM opponents WHERE policy_id!='basic'",
                    [],
                    |row| row.get(0),
                )
                .map_err(|error| error.to_string())?;
            if invalid_policy > 0 {
                return Err("Opponent policy invalid".into());
            }
            if kind == "chapter" {
                let mut stmt = db
                    .prepare("SELECT id,payload_json FROM story_documents")
                    .map_err(|error| error.to_string())?;
                let mut rows = stmt.query([]).map_err(|error| error.to_string())?;
                while let Some(row) = rows.next().map_err(|error| error.to_string())? {
                    let id: String = row.get(0).map_err(|error| error.to_string())?;
                    let payload: String = row.get(1).map_err(|error| error.to_string())?;
                    let parsed: Value =
                        serde_json::from_str(&payload).map_err(|error| error.to_string())?;
                    if parsed["contentId"] != id {
                        return Err("Story ID mismatch".into());
                    }
                }
            }
        }
        _ => return Err("Unknown package type".into()),
    }
    Ok(())
}

fn valid_chapter_module(value: &Value) -> bool {
    let Some(object) = value.as_object() else {
        return false;
    };
    fn requirements(value: &Value) -> bool {
        value.as_array().is_some_and(|items| {
            items.len() <= 1000
                && items.iter().all(|item| {
                    let Some(record) = item.as_object() else {
                        return false;
                    };
                    let reference = |value: &Value| {
                        value.as_str().is_some_and(|s| {
                            !s.is_empty() && s.encode_utf16().count() <= 256 && !s.contains('\0')
                        })
                    };
                    match item["kind"].as_str() {
                        Some("chapter-completed") => {
                            record.len() == 2 && reference(&item["chapterId"])
                        }
                        Some("fact") => {
                            record.len() == 3
                                && record.contains_key("equals")
                                && reference(&item["id"])
                                && item["id"].as_str().is_some_and(|id| id.contains(':'))
                                && (item["equals"].is_null()
                                    || item["equals"].is_boolean()
                                    || item["equals"].is_number()
                                    || item["equals"]
                                        .as_str()
                                        .is_some_and(|s| s.encode_utf16().count() <= 4096))
                        }
                        _ => false,
                    }
                })
        })
    }
    object.len() == 4
        && object.contains_key("choiceBeatId")
        && value["apiVersion"] == 1
        && requirements(&value["requiresProgress"])
        && requirements(&value["completion"])
        && (value["choiceBeatId"].is_null()
            || value["choiceBeatId"].as_str().is_some_and(|id| {
                !id.is_empty() && id.encode_utf16().count() <= 256 && !id.contains('\0')
            }))
}

fn validate_candidate_content(
    paths: &HashMap<String, PathBuf>,
    headers: &HashMap<String, Value>,
) -> Result<(), String> {
    let mut identities: HashMap<String, Value> = HashMap::new();
    let mut cards: HashMap<u64, HashSet<String>> = HashMap::new();
    let mut sets: HashMap<String, String> = HashMap::new();
    for (id, path) in paths {
        if headers[id]["packageType"] != "card-library" {
            continue;
        }
        let db = open_package(path)?;
        for (sql, prefix) in [
            ("SELECT CAST(code AS TEXT), definition_json FROM cards", "card"),
            ("SELECT CAST(card_code AS TEXT)||':'||locale, json_array(name,description,strings_json) FROM card_texts", "text"),
            ("SELECT name, json_quote(source) FROM scripts", "script"),
        ] {
            let mut stmt = db.prepare(sql).map_err(|error| error.to_string())?;
            let rows = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?,row.get::<_, String>(1)?))).map_err(|error| error.to_string())?;
            for row in rows {
                let (key, payload) = row.map_err(|error| error.to_string())?;
                let value: Value = serde_json::from_str(&payload).map_err(|error| error.to_string())?;
                let identity = format!("{prefix}:{key}");
                if identities.get(&identity).is_some_and(|previous| previous != &value) { return Err("Module content identity conflict".into()); }
                identities.insert(identity,value);
                if prefix == "card" { cards.entry(key.parse().map_err(|_| "Invalid card ID")?).or_default().insert(id.clone()); }
            }
        }
        let mut stmt = db
            .prepare("SELECT id FROM sets")
            .map_err(|error| error.to_string())?;
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|error| error.to_string())?;
        for row in rows {
            if sets
                .insert(row.map_err(|error| error.to_string())?, id.clone())
                .is_some()
            {
                return Err("Module set identity conflict".into());
            }
        }
    }
    for (id, path) in paths {
        let kind = headers[id]["packageType"]
            .as_str()
            .ok_or("Package type missing")?;
        if !["chapter", "freeplay"].contains(&kind) {
            continue;
        }
        let mut allowed = HashSet::new();
        let mut pending = vec![id.clone()];
        while let Some(required) = pending.pop() {
            if !allowed.insert(required.clone()) {
                continue;
            }
            for dependency in headers[&required]["dependencies"]
                .as_array()
                .ok_or("Invalid dependencies")?
            {
                pending.push(
                    dependency["packageId"]
                        .as_str()
                        .ok_or("Invalid dependency")?
                        .to_owned(),
                );
            }
        }
        let has_card = |code: u64| {
            cards
                .get(&code)
                .is_some_and(|owners| owners.iter().any(|owner| allowed.contains(owner)))
        };
        let db = open_package(path)?;
        let mut stmt = db
            .prepare("SELECT cards_json FROM decks")
            .map_err(|error| error.to_string())?;
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|error| error.to_string())?;
        for row in rows {
            let deck: Value = serde_json::from_str(&row.map_err(|error| error.to_string())?)
                .map_err(|error| error.to_string())?;
            for group in ["main", "extra", "side"] {
                for code in deck[group].as_array().ok_or("Invalid deck")? {
                    if !code.as_u64().is_some_and(has_card) {
                        return Err("Missing module card".into());
                    }
                }
            }
        }
        let table = if kind == "chapter" {
            "chapter_card_limits"
        } else {
            "freeplay_card_limits"
        };
        let mut limits = db
            .prepare(&format!("SELECT card_code FROM {table}"))
            .map_err(|error| error.to_string())?;
        let rows = limits
            .query_map([], |row| row.get::<_, u64>(0))
            .map_err(|error| error.to_string())?;
        for code in rows {
            if !has_card(code.map_err(|error| error.to_string())?) {
                return Err("Missing module limit card".into());
            }
        }
        if kind == "chapter" {
            let source: String = db
                .query_row(
                    "SELECT value_json FROM package_meta WHERE key='config'",
                    [],
                    |row| row.get(0),
                )
                .map_err(|error| error.to_string())?;
            let config: Value = serde_json::from_str(&source).map_err(|error| error.to_string())?;
            if config["setIds"].as_array().is_none_or(|ids| {
                ids.iter().any(|id| {
                    id.as_str()
                        .is_none_or(|id| sets.get(id).is_none_or(|owner| !allowed.contains(owner)))
                })
            }) {
                return Err("Missing module set".into());
            }
        }
    }
    Ok(())
}
