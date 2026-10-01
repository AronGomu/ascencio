use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    fs,
    io::{self, Write},
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::Manager;
use uuid::Uuid;

const MAX_BYTES: usize = 256 * 1024 * 1024;
const MAX_SAFE_REVISION: u64 = 9_007_199_254_740_991;
const NAMESPACES: &[&str] = &[
    "decks",
    "deck-meta",
    "deck-autosaves",
    "story",
    "preferences",
    "story-read-log",
];

#[derive(Default)]
pub(crate) struct UserJsonState(Mutex<()>);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Document {
    format: String,
    schema_version: u8,
    revision: u64,
    records: Vec<Record>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Record {
    namespace: String,
    key: String,
    revision: u64,
    payload: Value,
}

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub(crate) enum WriteOutcome {
    Ok { value: () },
    Failed { error: WriteError },
}
#[derive(Serialize)]
pub(crate) struct WriteError {
    code: &'static str,
}
fn failed(code: &'static str) -> WriteOutcome {
    WriteOutcome::Failed {
        error: WriteError { code },
    }
}

fn user_path(handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    handle
        .path()
        .app_data_dir()
        .map(|root| root.join("user-data.json"))
        .map_err(|e| e.to_string())
}

fn read_source(path: &Path) -> Result<Option<String>, String> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(info) => info,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.to_string()),
    };
    if !metadata.is_file() || metadata.len() > MAX_BYTES as u64 {
        return Err("Invalid user data file".into());
    }
    fs::read_to_string(path)
        .map(Some)
        .map_err(|e| e.to_string())
}

fn validate_source(source: &str) -> Result<Document, &'static str> {
    if source.len() > MAX_BYTES {
        return Err("USER_DATA_TOO_LARGE");
    }
    let document: Document = serde_json::from_str(source).map_err(|_| "USER_DATA_INVALID")?;
    if document.format != "ascencio-user-data-json"
        || document.schema_version != 1
        || document.revision > MAX_SAFE_REVISION
    {
        return Err("USER_DATA_INVALID");
    }
    let mut keys = std::collections::HashSet::new();
    for record in &document.records {
        if !NAMESPACES.contains(&record.namespace.as_str())
            || record.key.is_empty()
            || record.key.encode_utf16().count() > 256
            || record.key.contains('\0')
            || record.revision == 0
            || record.revision > MAX_SAFE_REVISION
            || !keys.insert((&record.namespace, &record.key))
        {
            return Err("USER_DATA_INVALID");
        }
        if serde_json::to_vec(&record.payload)
            .map_err(|_| "USER_DATA_INVALID")?
            .len()
            > 16 * 1024 * 1024
        {
            return Err("USER_DATA_TOO_LARGE");
        }
    }
    Ok(document)
}

fn write_source(path: &Path, source: &str, expected: Option<&str>) -> WriteOutcome {
    let document = match validate_source(source) {
        Ok(value) => value,
        Err(code) => return failed(code),
    };
    let current = match read_source(path) {
        Ok(value) => value,
        Err(_) => return failed("STORAGE_UNAVAILABLE"),
    };
    if current.as_deref() != expected {
        return failed("STORAGE_CONFLICT");
    }
    let revision = match current.as_deref() {
        Some(value) => match validate_source(value) {
            Ok(value) => value.revision,
            Err(code) => return failed(code),
        },
        None => 0,
    };
    if revision == MAX_SAFE_REVISION || document.revision != revision + 1 {
        return failed("STORAGE_CONFLICT");
    }
    let Some(parent) = path.parent() else {
        return failed("STORAGE_UNAVAILABLE");
    };
    let temporary = parent.join(format!("user-data-{}.json.tmp", Uuid::new_v4()));
    let result = (|| -> io::Result<()> {
        fs::create_dir_all(parent)?;
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        file.write_all(source.as_bytes())?;
        file.sync_all()?;
        drop(file);
        fs::rename(&temporary, path)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
        return failed("STORAGE_UNAVAILABLE");
    }
    WriteOutcome::Ok { value: () }
}

#[tauri::command]
pub(crate) fn native_user_json_read(
    handle: tauri::AppHandle,
    state: tauri::State<'_, UserJsonState>,
) -> Result<Option<String>, String> {
    let _guard = state.0.lock().map_err(|e| e.to_string())?;
    read_source(&user_path(&handle)?)
}

#[tauri::command]
pub(crate) fn native_user_json_write(
    handle: tauri::AppHandle,
    state: tauri::State<'_, UserJsonState>,
    source: String,
    expected: Option<String>,
) -> WriteOutcome {
    let Ok(_guard) = state.0.lock() else {
        return failed("STORAGE_UNAVAILABLE");
    };
    let Ok(path) = user_path(&handle) else {
        return failed("STORAGE_UNAVAILABLE");
    };
    write_source(&path, &source, expected.as_deref())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn source(revision: u64) -> String {
        format!(
            r#"{{"format":"ascencio-user-data-json","schemaVersion":1,"revision":{revision},"records":[]}}"#
        )
    }
    #[test]
    fn writes_reopens_and_rejects_stale_replacement() {
        let root = std::env::temp_dir().join(format!("ascencio-json-test-{}", Uuid::new_v4()));
        let path = root.join("user-data.json");
        assert!(matches!(
            write_source(&path, &source(1), None),
            WriteOutcome::Ok { .. }
        ));
        let first = read_source(&path).unwrap().unwrap();
        assert!(matches!(
            write_source(&path, &source(2), Some(&first)),
            WriteOutcome::Ok { .. }
        ));
        assert!(matches!(
            write_source(&path, &source(3), Some(&first)),
            WriteOutcome::Failed {
                error: WriteError {
                    code: "STORAGE_CONFLICT"
                }
            }
        ));
        assert_eq!(read_source(&path).unwrap(), Some(source(2)));
        assert_eq!(fs::read_dir(&root).unwrap().count(), 1);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn invalid_document_does_not_replace_saved_data() {
        let root = std::env::temp_dir().join(format!("ascencio-json-test-{}", Uuid::new_v4()));
        let path = root.join("user-data.json");
        let first = source(1);
        assert!(matches!(
            write_source(&path, &first, None),
            WriteOutcome::Ok { .. }
        ));
        assert!(matches!(
            write_source(&path, "{}", Some(&first)),
            WriteOutcome::Failed { .. }
        ));
        assert_eq!(read_source(&path).unwrap(), Some(first));
        fs::remove_dir_all(root).unwrap();
    }
}
