//! Startup-only declared-path discovery. Lua chunks are compiled, never executed here.
use crate::native_io_trace::{self, Category, Operation};
use mlua::{ChunkMode, Lua, LuaOptions, StdLib};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    io::Read,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};
use tauri::Manager;

const MAX_FILE: u64 = 4 * 1024 * 1024;
const MAX_TOTAL: u64 = 128 * 1024 * 1024;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Preferences {
    schema_version: u8,
    mode: String,
    root: Root,
    enabled: Vec<String>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Root {
    kind: String,
    path: Option<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ModResult {
    mods: Vec<Value>,
    diagnostics: Vec<Value>,
    dropped_diagnostics: usize,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct MediaOwner {
    pub(crate) mod_id: String,
    pub(crate) package_id: String,
    pub(crate) id: String,
}

pub(crate) fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 80
        && id.bytes().next().is_some_and(|b| b.is_ascii_lowercase())
        && id.split('-').all(|s| {
            !s.is_empty()
                && s.bytes()
                    .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
        })
}
fn safe_path(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 1024
        && !value.contains(['\\', '\0', ':'])
        && value.split('/').count() <= 8
        && value
            .split('/')
            .all(|s| !s.is_empty() && s != "." && s != "..")
}
fn issue(
    id: &str,
    file: &str,
    pointer: &str,
    code: &str,
    message: &str,
    position: Option<(usize, usize)>,
) -> Value {
    let mut location = json!({ "file": file, "modId": id, "pointer": pointer });
    if let Some((line, column)) = position {
        location["line"] = json!(line);
        location["column"] = json!(column);
    }
    json!({ "code": code, "severity": "error", "phase": "mod-composition", "message": message, "source": location, "notes": [], "causes": [], "remediation": "Correct or explicitly disable this enabled mod, then retry startup." })
}
fn read_declared(
    root: &Path,
    relative: &str,
    total: &mut u64,
    cancel: &AtomicBool,
) -> Result<Vec<u8>, String> {
    if cancel.load(Ordering::Acquire) {
        return Err("OPERATION_CANCELLED".into());
    }
    if !safe_path(relative) {
        return Err("MOD_PATH_REFUSED".into());
    }
    let mut span =
        native_io_trace::start(Category::Gameplay, Operation::Read, "enabled-mod-source");
    let file = crate::scoped_files::open(root, relative)?;
    let metadata = file.metadata().map_err(|e| e.to_string())?;
    if !metadata.is_file() || metadata.len() > MAX_FILE {
        return Err("MOD_SIZE".into());
    }
    let mut bytes = Vec::new();
    file.take(MAX_FILE + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    *total += bytes.len() as u64;
    if bytes.len() as u64 > MAX_FILE || *total > MAX_TOTAL {
        return Err("MOD_SIZE".into());
    }
    if let Some(span) = &mut span {
        span.bytes(bytes.len() as u64);
    }
    Ok(bytes)
}
fn parse_script(lua: &Lua, file: &str, bytes: &[u8]) -> Result<String, String> {
    let source = std::str::from_utf8(bytes).map_err(|_| "LUA_UTF8_INVALID")?;
    lua.load(source)
        .set_name(format!("@{file}"))
        .set_mode(ChunkMode::Text)
        .into_function()
        .map_err(|e| e.to_string())?;
    Ok(source.to_owned())
}
fn scan(
    root: &Path,
    enabled: &[String],
    cancel: Arc<AtomicBool>,
) -> Result<(ModResult, Vec<(String, PathBuf, Value)>), String> {
    if enabled.len() > 32
        || enabled.iter().any(|id| !valid_id(id))
        || enabled.iter().collect::<HashSet<_>>().len() != enabled.len()
    {
        return Err("MOD_PREFERENCES_INVALID".into());
    }
    let root = root
        .canonicalize()
        .map_err(|e| format!("MOD_ROOT_UNAVAILABLE: {e}"))?;
    let lua = Lua::new_with(StdLib::NONE, LuaOptions::default()).map_err(|e| e.to_string())?;
    lua.set_memory_limit(32 * 1024 * 1024)
        .map_err(|e| e.to_string())?;
    let mut total = 0;
    let mut result = ModResult {
        mods: vec![],
        diagnostics: vec![],
        dropped_diagnostics: 0,
    };
    let mut roots = vec![];
    for id in enabled {
        if cancel.load(Ordering::Acquire) {
            return Err("OPERATION_CANCELLED".into());
        }
        let path = match root.join(id).canonicalize() {
            Ok(p) if p.starts_with(&root) => p,
            _ => {
                result.diagnostics.push(issue(
                    id,
                    "mod.json",
                    "",
                    "MOD_MANIFEST_MISSING",
                    "Enabled mod directory is missing or outside the selected root",
                    None,
                ));
                continue;
            }
        };
        let bytes = match read_declared(&path, "mod.json", &mut total, &cancel) {
            Ok(b) => b,
            Err(e) => {
                result.diagnostics.push(issue(
                    id,
                    "mod.json",
                    "",
                    "MOD_SOURCE_UNREADABLE",
                    &e,
                    None,
                ));
                continue;
            }
        };
        let manifest: Value = match serde_json::from_slice(&bytes) {
            Ok(v) => v,
            Err(e) => {
                result.diagnostics.push(issue(
                    id,
                    "mod.json",
                    "",
                    "MOD_JSON_SYNTAX",
                    &e.to_string(),
                    Some((e.line(), e.column())),
                ));
                continue;
            }
        };
        if manifest["id"] != id.as_str()
            || manifest["schemaVersion"] != 1
            || manifest["contentApi"] != 1
            || !manifest["entities"]
                .as_array()
                .is_some_and(|a| a.len() <= 10_000)
            || !manifest["media"]
                .as_array()
                .is_some_and(|a| a.len() <= 10_000)
        {
            result.diagnostics.push(issue(
                id,
                "mod.json",
                "",
                "MOD_MANIFEST_SCHEMA",
                "Expected a matching versioned content API 1 manifest with bounded entities/media",
                None,
            ));
            continue;
        }
        let mut digest = Sha256::new();
        digest.update(&bytes);
        let mut files = vec![];
        let mut paths = HashSet::new();
        for (i, entity) in manifest["entities"].as_array().unwrap().iter().enumerate() {
            let Some(file) = entity["path"].as_str() else {
                result.diagnostics.push(issue(
                    id,
                    "mod.json",
                    &format!("/entities/{i}/path"),
                    "MOD_ENTITY_SCHEMA",
                    "Expected a scoped entity path",
                    None,
                ));
                continue;
            };
            if !paths.insert(file) {
                result.diagnostics.push(issue(
                    id,
                    "mod.json",
                    &format!("/entities/{i}/path"),
                    "MOD_SOURCE_DUPLICATE",
                    "Duplicate entity path",
                    None,
                ));
                continue;
            }
            let bytes = match read_declared(&path, file, &mut total, &cancel) {
                Ok(b) => b,
                Err(e) => {
                    result
                        .diagnostics
                        .push(issue(id, file, "", "MOD_SOURCE_UNREADABLE", &e, None));
                    continue;
                }
            };
            digest.update(file.as_bytes());
            digest.update([0]);
            digest.update(&bytes);
            let value = if entity["kind"] == "scripts" {
                match parse_script(&lua, file, &bytes) {
                    Ok(source) => Value::String(source),
                    Err(e) => {
                        let mut diagnostic = issue(id, file, "", "MOD_LUA_SYNTAX", &e, None);
                        if let Some(line) = e
                            .split(&format!("{file}:"))
                            .nth(1)
                            .and_then(|suffix| suffix.split(':').next())
                            .and_then(|line| line.parse::<usize>().ok())
                        {
                            diagnostic["source"]["line"] = json!(line);
                        }
                        result.diagnostics.push(diagnostic);
                        continue;
                    }
                }
            } else {
                match serde_json::from_slice::<Value>(&bytes) {
                    Ok(v) => v,
                    Err(e) => {
                        result.diagnostics.push(issue(
                            id,
                            file,
                            "",
                            "MOD_JSON_SYNTAX",
                            &e.to_string(),
                            Some((e.line(), e.column())),
                        ));
                        continue;
                    }
                }
            };
            files.push(json!({ "path": file, "value": value }));
            if result.diagnostics.len() > 128 {
                result.dropped_diagnostics += result.diagnostics.len() - 128;
                result.diagnostics.truncate(128);
            }
        }
        roots.push((id.clone(), path, manifest.clone()));
        result.mods.push(json!({ "manifest": manifest, "files": files, "sha256": format!("{:x}", digest.finalize()) }));
    }
    Ok((result, roots))
}
#[tauri::command]
pub(crate) async fn native_mods_load(
    handle: tauri::AppHandle,
    state: tauri::State<'_, crate::native_startup::StartupState>,
    session_id: String,
    preferences: Preferences,
) -> Result<ModResult, String> {
    let cancel = crate::native_startup::mod_cancellation(&state, &session_id)?;
    if preferences.schema_version != 1 || !["normal", "modded"].contains(&preferences.mode.as_str())
    {
        return Err("MOD_PREFERENCES_INVALID".into());
    }
    if preferences.mode == "normal" || preferences.enabled.is_empty() {
        return Ok(ModResult {
            mods: vec![],
            diagnostics: vec![],
            dropped_diagnostics: 0,
        });
    }
    let root = match (preferences.root.kind.as_str(), preferences.root.path) {
        ("managed", None) => handle
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("mods"),
        ("desktop", Some(path)) if Path::new(&path).is_absolute() => PathBuf::from(path),
        _ => return Err("MOD_ROOT_INVALID".into()),
    };
    let (result, roots) =
        tauri::async_runtime::spawn_blocking(move || scan(&root, &preferences.enabled, cancel))
            .await
            .map_err(|e| e.to_string())??;
    crate::native_startup::register_mod_roots(&state, &session_id, roots)?;
    Ok(result)
}
#[tauri::command]
pub(crate) fn native_mods_activate(
    state: tauri::State<'_, crate::native_startup::StartupState>,
    session_id: String,
    owners: Vec<MediaOwner>,
) -> Result<(), String> {
    crate::native_startup::activate_mod_media(&state, &session_id, owners)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    #[test]
    fn lua53_syntax_is_compiled_without_executing_native_operations() {
        let lua = Lua::new_with(StdLib::NONE, LuaOptions::default()).unwrap();
        parse_script(
            &lua,
            "effect.lua",
            b"while true do end; os.execute('not executed')",
        )
        .unwrap();
        assert!(parse_script(&lua, "effect.lua", b"function bad(").is_err());
        assert!(parse_script(&lua, "effect.lua", b"local x <const> = 1").is_err());
        // 5.4 syntax cannot enter the 5.3 core.
    }
    #[test]
    fn disabled_mods_are_never_read_and_enabled_errors_have_source_locations() {
        let root = std::env::temp_dir().join(format!("ascencio-mod-scan-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("enabled")).unwrap();
        fs::create_dir(root.join("disabled")).unwrap();
        fs::write(root.join("disabled/mod.json"), "invalid").unwrap();
        fs::write(root.join("enabled/mod.json"), "{\ninvalid").unwrap();
        let result = scan(&root, &["enabled".into()], Arc::new(AtomicBool::new(false)))
            .unwrap()
            .0;
        assert_eq!(result.diagnostics.len(), 1);
        assert_eq!(result.diagnostics[0]["source"]["modId"], "enabled");
        assert_eq!(result.diagnostics[0]["source"]["line"], 2);
        assert!(scan(&root, &[], Arc::new(AtomicBool::new(false)))
            .unwrap()
            .0
            .diagnostics
            .is_empty());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn lua_errors_report_the_available_source_line() {
        let root = std::env::temp_dir().join(format!("ascencio-mod-lua-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("enabled")).unwrap();
        fs::write(root.join("enabled/mod.json"), serde_json::to_vec(&json!({
            "schemaVersion": 1, "id": "enabled", "version": "1.0.0", "contentApi": 1,
            "base": [], "dependencies": [], "media": [],
            "entities": [{"kind": "scripts", "packageId": "card-library", "operation": "add", "id": "card:enabled:broken", "path": "broken.lua", "resolves": []}]
        })).unwrap()).unwrap();
        fs::write(root.join("enabled/broken.lua"), "-- header\nlocal =\n").unwrap();
        let result = scan(&root, &["enabled".into()], Arc::new(AtomicBool::new(false)))
            .unwrap()
            .0;
        assert_eq!(result.diagnostics[0]["code"], "MOD_LUA_SYNTAX");
        assert_eq!(result.diagnostics[0]["source"]["file"], "broken.lua");
        assert_eq!(result.diagnostics[0]["source"]["line"], 2);
        assert!(result.diagnostics[0]["source"].get("column").is_none());
        fs::remove_dir_all(root).unwrap();
    }
}
