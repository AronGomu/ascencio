use crate::native_io_trace::{self, Category, Operation};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    fs,
    io::{self, Write},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
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
pub(crate) struct UserJsonState(Arc<Mutex<Option<UserWriter>>>);

struct UserWriter {
    token: String,
    path: PathBuf,
    _lock: fs::File,
    initial: Option<String>,
    revision: u64,
    last_digest: Option<String>,
    uncertain: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UserOpened {
    session_id: String,
    source: Option<String>,
}

fn open_writer(path: PathBuf) -> Result<UserWriter, String> {
    let parent = path.parent().ok_or("STORAGE_UNAVAILABLE")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let lock = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(parent.join("user-data.lock"))
        .map_err(|e| e.to_string())?;
    lock.try_lock().map_err(|_| "APP_ALREADY_OPEN")?;
    let initial = read_source(&path)?;
    let revision = match &initial {
        Some(source) => {
            // Preserve syntax locations from the same startup buffer for recovery.
            let _: serde_json::Value = serde_json::from_str(source)
                .map_err(|e| format!("USER_DATA_INVALID: user-data.json: {e}"))?;
            validate_source(source).map_err(|code| format!("{code}: user-data.json"))?.revision
        },
        None => 0,
    };
    Ok(UserWriter {
        token: Uuid::new_v4().to_string(),
        path,
        _lock: lock,
        initial,
        revision,
        last_digest: None,
        uncertain: false,
    })
}
fn write_cached(
    writer: &mut UserWriter,
    source: &str,
    expected_revision: u64,
) -> Result<WriteOutcome, String> {
    use sha2::{Digest, Sha256};
    let document = match validate_source(source) {
        Ok(d) => d,
        Err(code) => return Ok(failed(code)),
    };
    let digest = format!("{:x}", Sha256::digest(source.as_bytes()));
    if writer.uncertain {
        return Err("USER_WRITE_OUTCOME_UNKNOWN".into());
    }
    // Exact retry after a lost IPC acknowledgement, with no file read.
    if document.revision == writer.revision
        && writer.last_digest.as_ref() == Some(&digest)
        && expected_revision.checked_add(1) == Some(writer.revision)
    {
        return Ok(WriteOutcome::Ok { value: () });
    }
    if expected_revision != writer.revision
        || writer.revision == MAX_SAFE_REVISION
        || document.revision != writer.revision + 1
    {
        return Ok(failed("STORAGE_CONFLICT"));
    }
    let parent = writer.path.parent().ok_or("STORAGE_UNAVAILABLE")?;
    let temporary = parent.join(format!("user-data-{}.json.tmp", Uuid::new_v4()));
    let _write = native_io_trace::start(
        Category::UserData,
        Operation::Write,
        "user-json-cached-atomic-write",
    );
    let result = (|| -> io::Result<()> {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        file.write_all(source.as_bytes())?;
        file.sync_all()?;
        drop(file);
        fs::rename(&temporary, &writer.path)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
        return Ok(failed("STORAGE_UNAVAILABLE"));
    }
    // Unix directory synchronization makes the replacement durable across power loss.
    #[cfg(unix)]
    if fs::File::open(parent)
        .and_then(|dir| dir.sync_all())
        .is_err()
    {
        writer.uncertain = true;
        return Err("USER_WRITE_OUTCOME_UNKNOWN".into());
    }
    writer.revision = document.revision;
    writer.last_digest = Some(digest);
    writer.initial = None;
    Ok(WriteOutcome::Ok { value: () })
}

#[tauri::command]
pub(crate) async fn native_user_json_open(
    handle: tauri::AppHandle,
    state: tauri::State<'_, UserJsonState>,
) -> Result<UserOpened, String> {
    let path = user_path(&handle)?;
    if state.0.lock().map_err(|e| e.to_string())?.is_some() {
        return Err("USER_WRITER_SESSION_ACTIVE".into());
    }
    let writer = tauri::async_runtime::spawn_blocking(move || open_writer(path))
        .await
        .map_err(|e| e.to_string())??;
    let mut current = state.0.lock().map_err(|e| e.to_string())?;
    if current.is_some() {
        return Err("USER_WRITER_SESSION_ACTIVE".into());
    }
    let result = UserOpened {
        session_id: writer.token.clone(),
        source: writer.initial.clone(),
    };
    *current = Some(writer);
    Ok(result)
}
#[tauri::command]
pub(crate) fn native_user_json_close(
    state: tauri::State<'_, UserJsonState>,
    session_id: String,
) -> Result<(), String> {
    let mut current = state.0.lock().map_err(|e| e.to_string())?;
    if current.as_ref().is_some_and(|w| w.token == session_id) {
        *current = None;
    }
    Ok(())
}
#[tauri::command]
pub(crate) async fn native_user_json_commit(
    state: tauri::State<'_, UserJsonState>,
    session_id: String,
    source: String,
    expected_revision: u64,
) -> Result<WriteOutcome, String> {
    let shared = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut current = shared.lock().map_err(|e| e.to_string())?;
        let writer = current
            .as_mut()
            .filter(|w| w.token == session_id)
            .ok_or("USER_WRITER_SESSION_INVALID")?;
        write_cached(writer, &source, expected_revision)
    })
    .await
    .map_err(|e| e.to_string())?
}

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
    let metadata = {
        let _metadata = native_io_trace::start(
            Category::UserData,
            Operation::Metadata,
            "user-json-metadata",
        );
        match fs::symlink_metadata(path) {
            Ok(info) => info,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(error.to_string()),
        }
    };
    if !metadata.is_file() || metadata.len() > MAX_BYTES as u64 {
        return Err("Invalid user data file".into());
    }
    native_io_trace::read_to_string(path, Category::UserData, "user-json")
        .map(Some)
        .map_err(|e| e.to_string())
}

fn validate_source(source: &str) -> Result<Document, &'static str> {
    if source.len() > MAX_BYTES {
        return Err("USER_DATA_TOO_LARGE");
    }
    let _parse =
        native_io_trace::start(Category::UserData, Operation::Parse, "user-json-validation");
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

#[cfg(test)]
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
    let _write = native_io_trace::start(
        Category::UserData,
        Operation::Write,
        "user-json-atomic-write",
    );
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

#[cfg(test)]
mod tests {
    use super::*;
    fn source(revision: u64) -> String {
        format!(
            r#"{{"format":"ascencio-user-data-json","schemaVersion":1,"revision":{revision},"records":[]}}"#
        )
    }
    #[test]
    #[ignore = "requires ASCENCIO_IO_TRACE=1 and --test-threads=1"]
    fn traced_cached_writer_has_no_reads_after_ready() {
        assert!(native_io_trace::session_id().is_some());
        let root = std::env::temp_dir().join(format!("ascencio-cached-io-{}", Uuid::new_v4()));
        let path = root.join("user-data.json");
        let mut writer = open_writer(path.clone()).unwrap();
        assert!(matches!(
            write_cached(&mut writer, &source(1), 0).unwrap(),
            WriteOutcome::Ok { .. }
        ));
        native_io_trace::mark_ready();
        fs::write(&path, "external edit").unwrap();
        assert!(matches!(
            write_cached(&mut writer, &source(2), 1).unwrap(),
            WriteOutcome::Ok { .. }
        ));
        let trace = serde_json::to_value(native_io_trace::native_io_trace_snapshot()).unwrap();
        assert!(!trace["events"]
            .as_array()
            .unwrap()
            .iter()
            .any(|e| e["phase"] == "ready"
                && e["category"] == "user-data"
                && ["read", "metadata"].contains(&e["operation"].as_str().unwrap())));
        assert_eq!(trace["droppedEvents"], 0);
        assert_eq!(trace["pendingEvents"], 0);
        drop(writer);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn cached_writer_locks_reads_once_and_retries_exact_receipts() {
        let root = std::env::temp_dir().join(format!("ascencio-writer-{}", Uuid::new_v4()));
        let path = root.join("user-data.json");
        let mut writer = open_writer(path.clone()).unwrap();
        assert_eq!(open_writer(path.clone()).err().unwrap(), "APP_ALREADY_OPEN");
        assert!(matches!(
            write_cached(&mut writer, &source(1), 0).unwrap(),
            WriteOutcome::Ok { .. }
        ));
        fs::write(&path, "external edit").unwrap();
        assert!(matches!(
            write_cached(&mut writer, &source(2), 1).unwrap(),
            WriteOutcome::Ok { .. }
        ));
        assert!(matches!(
            write_cached(&mut writer, &source(2), 1).unwrap(),
            WriteOutcome::Ok { .. }
        ));
        assert!(matches!(
            write_cached(&mut writer, &source(4), 3).unwrap(),
            WriteOutcome::Failed {
                error: WriteError {
                    code: "STORAGE_CONFLICT"
                }
            }
        ));
        drop(writer);
        let reopened = open_writer(path).unwrap();
        assert_eq!(reopened.revision, 2);
        drop(reopened);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn failed_atomic_replacement_keeps_cached_revision_and_retained_retry() {
        let root = std::env::temp_dir().join(format!("ascencio-write-fault-{}", Uuid::new_v4()));
        let path = root.join("user-data.json");
        let mut writer = open_writer(path.clone()).unwrap();
        fs::create_dir(&path).unwrap();
        assert!(matches!(
            write_cached(&mut writer, &source(1), 0).unwrap(),
            WriteOutcome::Failed { .. }
        ));
        assert_eq!(writer.revision, 0);
        fs::remove_dir(&path).unwrap();
        assert!(matches!(
            write_cached(&mut writer, &source(1), 0).unwrap(),
            WriteOutcome::Ok { .. }
        ));
        assert_eq!(read_source(&path).unwrap().unwrap(), source(1));
        assert!(!fs::read_dir(&root).unwrap().any(|e| e
            .unwrap()
            .file_name()
            .to_string_lossy()
            .ends_with(".tmp")));
        drop(writer);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    #[ignore = "requires ASCENCIO_IO_TRACE=1 and --test-threads=1"]
    fn traced_writer_exposes_existing_compare_read() {
        assert!(
            native_io_trace::session_id().is_some(),
            "ASCENCIO_IO_TRACE=1 required"
        );
        let root = std::env::temp_dir().join(format!("ascencio-io-test-{}", Uuid::new_v4()));
        let path = root.join("user-data.json");
        let first = source(1);
        assert!(matches!(
            write_source(&path, &first, None),
            WriteOutcome::Ok { .. }
        ));
        native_io_trace::native_io_trace_baseline_ready();
        assert!(matches!(
            write_source(&path, &source(2), Some(&first)),
            WriteOutcome::Ok { .. }
        ));
        let trace = serde_json::to_value(native_io_trace::native_io_trace_snapshot()).unwrap();
        assert!(trace["events"]
            .as_array()
            .unwrap()
            .iter()
            .any(|event| event["phase"] == "baseline-ready"
                && event["category"] == "user-data"
                && event["operation"] == "read"
                && event["label"] == "user-json"
                && event["bytes"] == first.len()));
        assert_eq!(trace["droppedEvents"], 0);
        assert_eq!(trace["pendingEvents"], 0);
        fs::remove_dir_all(root).unwrap();
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
