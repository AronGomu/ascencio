//! Explicit user-selected mod import. Installed files are inert until a new startup validates them.
use serde::Deserialize;
use serde_json::Value;
use std::{collections::HashSet, fs, io::Write, path::Path};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ModBundle {
    schema_version: u8,
    manifest: Value,
    files: Vec<BundleFile>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct BundleFile {
    path: String,
    bytes: Vec<u8>,
}
fn import(root: &Path, source: &str) -> Result<String, String> {
    if source.len() > 128 * 1024 * 1024 {
        return Err("MOD_IMPORT_SIZE".into());
    }
    let bundle: ModBundle =
        serde_json::from_str(source).map_err(|e| format!("MOD_IMPORT_JSON: {e}"))?;
    let id = bundle.manifest["id"]
        .as_str()
        .filter(|id| crate::native_mods::valid_id(id))
        .ok_or("MOD_IMPORT_ID")?;
    if bundle.schema_version != 1 || bundle.files.len() > 10_000 {
        return Err("MOD_IMPORT_SCHEMA".into());
    }
    let mut declared = HashSet::new();
    let mut required = HashSet::new();
    for key in ["entities", "media"] {
        for entity in bundle.manifest[key].as_array().ok_or("MOD_IMPORT_SCHEMA")? {
            let path = entity["path"].as_str().ok_or("MOD_IMPORT_SCHEMA")?;
            if !crate::native_startup::safe_path(path)
                || path.split('/').count() > 8
                || path == "mod.json"
                || !declared.insert(path.to_string())
            {
                return Err("MOD_IMPORT_PATH".into());
            }
            if key == "entities" {
                required.insert(path.to_string());
            }
        }
    }
    let mut seen = HashSet::new();
    let mut total = 0_usize;
    for file in &bundle.files {
        total += file.bytes.len();
        if !declared.contains(&file.path)
            || !seen.insert(file.path.clone())
            || file.bytes.len() > 64 * 1024 * 1024
            || total > 64 * 1024 * 1024
        {
            return Err("MOD_IMPORT_FILES".into());
        }
    }
    if !required.is_subset(&seen) {
        return Err("MOD_IMPORT_FILES".into());
    }
    fs::create_dir_all(root).map_err(|e| e.to_string())?;
    if root.join(id).exists() {
        return Err(
            "MOD_ALREADY_INSTALLED: change the mod ID or remove the old mod explicitly".into(),
        );
    }
    let temporary = root.join(format!(".import-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&temporary).map_err(|e| e.to_string())?;
    let result = (|| {
        for file in &bundle.files {
            let target = temporary.join(&file.path);
            fs::create_dir_all(target.parent().unwrap()).map_err(|e| e.to_string())?;
            let mut output = fs::OpenOptions::new()
                .create_new(true)
                .write(true)
                .open(target)
                .map_err(|e| e.to_string())?;
            output
                .write_all(&file.bytes)
                .and_then(|_| output.sync_all())
                .map_err(|e| e.to_string())?;
        }
        let mut manifest = fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(temporary.join("mod.json"))
            .map_err(|e| e.to_string())?;
        manifest
            .write_all(&serde_json::to_vec_pretty(&bundle.manifest).map_err(|e| e.to_string())?)
            .and_then(|_| manifest.sync_all())
            .map_err(|e| e.to_string())?;
        fs::rename(&temporary, root.join(id)).map_err(|e| e.to_string())?;
        Ok(id.to_string())
    })();
    if temporary.exists() {
        let _ = fs::remove_dir_all(temporary);
    }
    result
}
#[tauri::command]
pub(crate) async fn native_mods_import(
    handle: tauri::AppHandle,
    source: String,
) -> Result<String, String> {
    let root = handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("mods");
    tauri::async_runtime::spawn_blocking(move || import(&root, &source))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub(crate) async fn native_mods_choose_root(
    handle: tauri::AppHandle,
) -> Result<Option<String>, String> {
    #[cfg(mobile)]
    {
        let _ = handle;
        Err("MOD_ROOT_DESKTOP_ONLY".into())
    }
    #[cfg(not(mobile))]
    {
        tauri::async_runtime::spawn_blocking(move || {
            handle
                .dialog()
                .file()
                .set_title("Select mod root")
                .blocking_pick_folder()
                .map(|file| {
                    let path = file.into_path().map_err(|e| e.to_string())?;
                    path.canonicalize()
                        .map(|path| path.to_string_lossy().into_owned())
                        .map_err(|e| e.to_string())
                })
                .transpose()
        })
        .await
        .map_err(|e| e.to_string())?
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn import_is_declared_atomic_and_never_replaces_an_existing_mod() {
        let root =
            std::env::temp_dir().join(format!("ascencio-mod-import-{}", uuid::Uuid::new_v4()));
        let bundle = serde_json::json!({"schemaVersion":1,"manifest":{"id":"test-mod","entities":[{"path":"cards/card.json"}],"media":[]},"files":[{"path":"cards/card.json","bytes":[123,125]}]}).to_string();
        assert_eq!(import(&root, &bundle).unwrap(), "test-mod");
        assert_eq!(
            fs::read(root.join("test-mod/cards/card.json")).unwrap(),
            b"{}"
        );
        assert!(import(&root, &bundle)
            .unwrap_err()
            .starts_with("MOD_ALREADY_INSTALLED"));
        let unsafe_bundle = bundle.replace("cards/card.json", "../user-data.json");
        assert_eq!(
            import(&root, &unsafe_bundle).unwrap_err(),
            "MOD_IMPORT_PATH"
        );
        fs::remove_dir_all(root).unwrap();
    }
}
