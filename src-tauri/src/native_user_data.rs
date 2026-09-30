use rusqlite::{params, Connection, DatabaseName, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{collections::HashMap, fs, path::PathBuf, sync::Mutex};
use tauri::Manager;
use uuid::Uuid;

const MAX_BACKUP_BYTES: usize = 256 * 1024 * 1024;
const MAX_PAYLOAD_BYTES: usize = 16 * 1024 * 1024;
const NAMESPACES: &[&str] = &[
    "decks",
    "deck-meta",
    "deck-autosaves",
    "story",
    "preferences",
    "story-read-log",
];
const SCHEMA: &str = "PRAGMA journal_mode=DELETE; PRAGMA user_version=1; CREATE TABLE user_data_meta (singleton INTEGER PRIMARY KEY CHECK (singleton=1),format TEXT NOT NULL CHECK (format='ascencio-user-data'),schema_version INTEGER NOT NULL CHECK (schema_version=1),revision INTEGER NOT NULL CHECK (revision>=0)); INSERT INTO user_data_meta VALUES (1,'ascencio-user-data',1,0); CREATE TABLE user_records (namespace TEXT NOT NULL,record_key TEXT NOT NULL,revision INTEGER NOT NULL CHECK (revision>=1),payload_json TEXT NOT NULL,PRIMARY KEY (namespace,record_key));";

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub(crate) enum Outcome {
    Ok { value: Value },
    Failed { error: Error },
}
#[derive(Serialize)]
pub(crate) struct Error {
    code: &'static str,
}
fn ok(value: Value) -> Outcome {
    Outcome::Ok { value }
}
fn failed(code: &'static str) -> Outcome {
    Outcome::Failed {
        error: Error { code },
    }
}

#[derive(Clone)]
struct Backup {
    path: PathBuf,
    digest: String,
    current_revision: i64,
}
#[derive(Default)]
pub(crate) struct BackupState(Mutex<HashMap<String, Backup>>);

fn database_path(handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    handle
        .path()
        .app_data_dir()
        .map(|directory| directory.join("user-data.sqlite"))
        .map_err(|error| error.to_string())
}
fn backup_folder(handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let root = handle
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("user-backups");
    if fs::symlink_metadata(&root).is_ok_and(|info| !info.is_dir() || info.file_type().is_symlink())
    {
        return Err("Backup directory invalid".into());
    }
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    Ok(root)
}
pub(crate) fn clear_stale_backups(handle: &tauri::AppHandle) -> Result<(), String> {
    let root = handle
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("user-backups");
    if !root.exists() {
        return Ok(());
    }
    if fs::symlink_metadata(&root)
        .map_err(|error| error.to_string())?
        .file_type()
        .is_symlink()
    {
        return Err("Backup directory is a link".into());
    }
    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();
        let staged = name
            .strip_suffix(".staged")
            .is_some_and(|token| Uuid::parse_str(token).is_ok());
        let export = name
            .strip_prefix("export-")
            .and_then(|value| value.strip_suffix(".sqlite"))
            .is_some_and(|token| Uuid::parse_str(token).is_ok());
        if staged || export {
            fs::remove_file(entry.path()).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}
fn open_database(handle: &tauri::AppHandle) -> Result<Connection, String> {
    let path = database_path(handle)?;
    fs::create_dir_all(path.parent().ok_or("No data directory")?)
        .map_err(|error| error.to_string())?;
    let create = !path.exists();
    let db = Connection::open(path).map_err(|error| error.to_string())?;
    if create {
        db.execute_batch(SCHEMA)
            .map_err(|error| error.to_string())?;
    }
    db.execute_batch("PRAGMA trusted_schema=OFF;")
        .map_err(|error| error.to_string())?;
    validate_meta(&db)?;
    Ok(db)
}
fn validate_meta(db: &Connection) -> Result<i64, String> {
    let (format, schema, revision): (String, i64, i64) = db
        .query_row(
            "SELECT format,schema_version,revision FROM user_data_meta WHERE singleton=1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|error| error.to_string())?;
    if format != "ascencio-user-data" || schema != 1 || revision < 0 {
        return Err("Invalid user database".into());
    }
    Ok(revision)
}
fn valid_key(namespace: &str, key: &str) -> bool {
    NAMESPACES.contains(&namespace) && !key.is_empty() && key.len() <= 256 && !key.contains('\0')
}
fn row_value(
    namespace: String,
    key: String,
    revision: i64,
    payload_json: String,
) -> Result<Value, String> {
    if !valid_key(&namespace, &key) || revision < 1 || payload_json.len() > MAX_PAYLOAD_BYTES {
        return Err("Invalid user record".into());
    }
    let payload: Value = serde_json::from_str(&payload_json).map_err(|error| error.to_string())?;
    Ok(json!({"namespace":namespace,"key":key,"revision":revision,"payload":payload}))
}
fn rows(db: &Connection, namespace: Option<&str>) -> Result<Vec<Value>, String> {
    let sql = if namespace.is_some() {
        "SELECT namespace,record_key,revision,payload_json FROM user_records WHERE namespace=? ORDER BY record_key"
    } else {
        "SELECT namespace,record_key,revision,payload_json FROM user_records ORDER BY namespace,record_key"
    };
    let mut statement = db.prepare(sql).map_err(|error| error.to_string())?;
    let mut query = if let Some(value) = namespace {
        statement.query(params![value])
    } else {
        statement.query([])
    }
    .map_err(|error| error.to_string())?;
    let mut found = Vec::new();
    while let Some(row) = query.next().map_err(|error| error.to_string())? {
        found.push(row_value(
            row.get(0).map_err(|error| error.to_string())?,
            row.get(1).map_err(|error| error.to_string())?,
            row.get(2).map_err(|error| error.to_string())?,
            row.get(3).map_err(|error| error.to_string())?,
        )?);
    }
    Ok(found)
}

#[tauri::command]
pub(crate) fn native_user_read(
    handle: tauri::AppHandle,
    namespace: String,
    key: String,
) -> Outcome {
    if !valid_key(&namespace, &key) {
        return failed("USER_DATA_INVALID");
    }
    let result = (|| -> Result<Value, String> {
        let db = open_database(&handle)?;
        let row: Option<(String,String,i64,String)> = db.query_row("SELECT namespace,record_key,revision,payload_json FROM user_records WHERE namespace=? AND record_key=?", params![namespace,key], |row| Ok((row.get(0)?,row.get(1)?,row.get(2)?,row.get(3)?))).optional().map_err(|error| error.to_string())?;
        row.map(|(ns, k, r, p)| row_value(ns, k, r, p))
            .transpose()
            .map(|item| item.unwrap_or(Value::Null))
    })();
    result.map_or_else(|_| failed("USER_DATA_INVALID"), ok)
}
#[tauri::command]
pub(crate) fn native_user_list(handle: tauri::AppHandle, namespace: String) -> Outcome {
    if !NAMESPACES.contains(&namespace.as_str()) {
        return failed("USER_DATA_INVALID");
    }
    match open_database(&handle).and_then(|db| rows(&db, Some(&namespace))) {
        Ok(found) => ok(Value::Array(found)),
        Err(_) => failed("USER_DATA_INVALID"),
    }
}

#[derive(Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "lowercase",
    rename_all_fields = "camelCase"
)]
pub(crate) enum Mutation {
    Put {
        namespace: String,
        key: String,
        expected_revision: Option<i64>,
        payload: Value,
    },
    Delete {
        namespace: String,
        key: String,
        expected_revision: i64,
    },
}
impl Mutation {
    fn key(&self) -> (&str, &str) {
        match self {
            Self::Put { namespace, key, .. } | Self::Delete { namespace, key, .. } => {
                (namespace, key)
            }
        }
    }
}
#[tauri::command]
pub(crate) fn native_user_write(handle: tauri::AppHandle, mutations: Vec<Mutation>) -> Outcome {
    if mutations.len() > 1000 {
        return failed("USER_DATA_INVALID");
    }
    let mut seen = std::collections::HashSet::new();
    for mutation in &mutations {
        let (namespace, key) = mutation.key();
        if !valid_key(namespace, key) || !seen.insert((namespace.to_owned(), key.to_owned())) {
            return failed("USER_DATA_INVALID");
        }
    }
    let result = (|| -> Result<Value, &'static str> {
        let mut db = open_database(&handle).map_err(|_| "USER_DATA_INVALID")?;
        let transaction = db.transaction().map_err(|_| "STORAGE_UNAVAILABLE")?;
        let current_revision = validate_meta(&transaction).map_err(|_| "USER_DATA_INVALID")?;
        let mut returned = Vec::new();
        for mutation in mutations {
            let (namespace, key) = mutation.key();
            let existing: Option<i64> = transaction
                .query_row(
                    "SELECT revision FROM user_records WHERE namespace=? AND record_key=?",
                    params![namespace, key],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|_| "USER_DATA_INVALID")?;
            match mutation {
                Mutation::Put {
                    namespace,
                    key,
                    expected_revision,
                    payload,
                } => {
                    if existing != expected_revision {
                        return Err("STORAGE_CONFLICT");
                    }
                    let next = existing
                        .unwrap_or(0)
                        .checked_add(1)
                        .ok_or("USER_DATA_INVALID")?;
                    let encoded =
                        serde_json::to_string(&payload).map_err(|_| "USER_DATA_INVALID")?;
                    if encoded.len() > MAX_PAYLOAD_BYTES {
                        return Err("USER_DATA_TOO_LARGE");
                    }
                    transaction.execute("INSERT INTO user_records(namespace,record_key,revision,payload_json) VALUES(?,?,?,?) ON CONFLICT(namespace,record_key) DO UPDATE SET revision=excluded.revision,payload_json=excluded.payload_json",params![namespace,key,next,encoded]).map_err(|_| "USER_DATA_INVALID")?;
                    returned.push(
                        json!({"namespace":namespace,"key":key,"revision":next,"payload":payload}),
                    );
                }
                Mutation::Delete {
                    namespace,
                    key,
                    expected_revision,
                } => {
                    if existing != Some(expected_revision) {
                        return Err("STORAGE_CONFLICT");
                    }
                    transaction
                        .execute(
                            "DELETE FROM user_records WHERE namespace=? AND record_key=?",
                            params![namespace, key],
                        )
                        .map_err(|_| "USER_DATA_INVALID")?;
                }
            }
        }
        if !returned.is_empty() || !seen.is_empty() {
            transaction
                .execute(
                    "UPDATE user_data_meta SET revision=? WHERE singleton=1",
                    params![current_revision.checked_add(1).ok_or("USER_DATA_INVALID")?],
                )
                .map_err(|_| "USER_DATA_INVALID")?;
        }
        transaction.commit().map_err(|_| "STORAGE_UNAVAILABLE")?;
        Ok(Value::Array(returned))
    })();
    result.map_or_else(failed, ok)
}

fn validate_backup(db: &Connection) -> Result<(i64, Vec<Value>), String> {
    let integrity: String = db
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    if integrity != "ok" {
        return Err("Backup integrity failed".into());
    }
    let version: i64 = db
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    if version != 1 {
        return Err("Backup version unsupported".into());
    }
    let revision = validate_meta(db)?;
    let objects: Vec<(String, String, String)> = {
        let mut statement = db
            .prepare("SELECT type,name,tbl_name FROM sqlite_schema ORDER BY type,name")
            .map_err(|error| error.to_string())?;
        let collected = statement
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
            .map_err(|error| error.to_string())?
            .collect::<Result<_, _>>()
            .map_err(|error| error.to_string())?;
        collected
    };
    if objects
        != [
            (
                "index".into(),
                "sqlite_autoindex_user_records_1".into(),
                "user_records".into(),
            ),
            (
                "table".into(),
                "user_data_meta".into(),
                "user_data_meta".into(),
            ),
            ("table".into(), "user_records".into(), "user_records".into()),
        ]
    {
        return Err("Backup schema invalid".into());
    }
    let columns = |table: &str| -> Result<Vec<(String, String, i64, i64)>, String> {
        let mut statement = db
            .prepare(&format!("PRAGMA table_info({table})"))
            .map_err(|error| error.to_string())?;
        let result = statement
            .query_map([], |row| {
                Ok((row.get(1)?, row.get(2)?, row.get(3)?, row.get(5)?))
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;
        Ok(result)
    };
    if columns("user_data_meta")?
        != [
            ("singleton".into(), "INTEGER".into(), 0, 1),
            ("format".into(), "TEXT".into(), 1, 0),
            ("schema_version".into(), "INTEGER".into(), 1, 0),
            ("revision".into(), "INTEGER".into(), 1, 0),
        ]
        || columns("user_records")?
            != [
                ("namespace".into(), "TEXT".into(), 1, 1),
                ("record_key".into(), "TEXT".into(), 1, 2),
                ("revision".into(), "INTEGER".into(), 1, 0),
                ("payload_json".into(), "TEXT".into(), 1, 0),
            ]
    {
        return Err("Backup columns invalid".into());
    }
    Ok((revision, rows(db, None)?))
}
#[tauri::command]
pub(crate) fn native_user_export(handle: tauri::AppHandle) -> Result<tauri::ipc::Response, String> {
    (|| -> Result<tauri::ipc::Response, String> {
        let db = open_database(&handle)?;
        validate_backup(&db)?;
        let root = backup_folder(&handle)?;
        let snapshot = root.join(format!("export-{}.sqlite", Uuid::new_v4()));
        let copied = db
            .backup(DatabaseName::Main, &snapshot, None)
            .map_err(|error| error.to_string());
        let bytes = copied.and_then(|_| fs::read(&snapshot).map_err(|error| error.to_string()));
        let _ = fs::remove_file(snapshot);
        let bytes = bytes?;
        if bytes.len() > MAX_BACKUP_BYTES {
            return Err("Backup too large".into());
        }
        Ok(tauri::ipc::Response::new(bytes))
    })()
}
#[tauri::command]
pub(crate) fn native_user_inspect(
    handle: tauri::AppHandle,
    state: tauri::State<'_, BackupState>,
    request: tauri::ipc::Request,
) -> Outcome {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return failed("USER_DATA_INVALID");
    };
    if bytes.len() > MAX_BACKUP_BYTES {
        return failed("USER_DATA_TOO_LARGE");
    }
    if !bytes.starts_with(b"SQLite format 3\0") {
        return failed("USER_DATA_INVALID");
    }
    let result = (|| -> Result<Value, String> {
        let current = open_database(&handle)?;
        let current_revision = validate_meta(&current)?;
        let root = backup_folder(&handle)?;
        let token = Uuid::new_v4().to_string();
        let path = root.join(format!("{token}.staged"));
        let mut output = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
            .map_err(|error| error.to_string())?;
        std::io::Write::write_all(&mut output, bytes).map_err(|error| error.to_string())?;
        output.sync_all().map_err(|error| error.to_string())?;
        let inspection = (|| -> Result<Value, String> {
            let db = Connection::open_with_flags(&path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
                .map_err(|error| error.to_string())?;
            db.execute_batch("PRAGMA trusted_schema=OFF; PRAGMA query_only=ON;")
                .map_err(|error| error.to_string())?;
            let (_, found) = validate_backup(&db)?;
            let mut counts = json!({"decks":0,"deck-meta":0,"deck-autosaves":0,"story":0,"preferences":0,"story-read-log":0});
            for row in &found {
                let namespace = row["namespace"].as_str().ok_or("namespace")?;
                counts[namespace] = json!(counts[namespace].as_u64().unwrap_or(0) + 1);
            }
            state.0.lock().map_err(|error| error.to_string())?.insert(
                token.clone(),
                Backup {
                    path: path.clone(),
                    digest: format!("{:x}", Sha256::digest(bytes)),
                    current_revision,
                },
            );
            Ok(
                json!({"token":token,"currentRevision":current_revision,"counts":counts,"rows":found}),
            )
        })();
        if inspection.is_err() {
            let _ = fs::remove_file(path);
        }
        inspection
    })();
    result.map_or_else(|_| failed("USER_DATA_INVALID"), ok)
}
#[tauri::command]
pub(crate) fn native_user_discard(state: tauri::State<'_, BackupState>, token: String) {
    if let Ok(mut staged) = state.0.lock() {
        if let Some(backup) = staged.remove(&token) {
            let _ = fs::remove_file(backup.path);
        }
    }
}
#[tauri::command]
pub(crate) fn native_user_restore(
    handle: tauri::AppHandle,
    state: tauri::State<'_, BackupState>,
    token: String,
    expected_revision: i64,
    confirmed: bool,
) -> Outcome {
    if !confirmed {
        return failed("RESTORE_CONFIRMATION_REQUIRED");
    }
    let Some(backup) = state
        .0
        .lock()
        .ok()
        .and_then(|mut staged| staged.remove(&token))
    else {
        return failed("STORAGE_CONFLICT");
    };
    let result = (|| -> Result<Value, &'static str> {
        let bytes = fs::read(&backup.path).map_err(|_| "USER_DATA_INVALID")?;
        if format!("{:x}", Sha256::digest(&bytes)) != backup.digest {
            return Err("USER_DATA_INVALID");
        }
        let staged =
            Connection::open_with_flags(&backup.path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
                .map_err(|_| "USER_DATA_INVALID")?;
        staged
            .execute_batch("PRAGMA trusted_schema=OFF; PRAGMA query_only=ON;")
            .map_err(|_| "USER_DATA_INVALID")?;
        let (_, found) = validate_backup(&staged).map_err(|_| "USER_DATA_INVALID")?;
        let mut db = open_database(&handle).map_err(|_| "USER_DATA_INVALID")?;
        let transaction = db.transaction().map_err(|_| "STORAGE_UNAVAILABLE")?;
        let live_revision = validate_meta(&transaction).map_err(|_| "USER_DATA_INVALID")?;
        if live_revision != expected_revision || backup.current_revision != expected_revision {
            return Err("STORAGE_CONFLICT");
        }
        transaction
            .execute("DELETE FROM user_records", [])
            .map_err(|_| "USER_DATA_INVALID")?;
        for row in found {
            transaction.execute("INSERT INTO user_records(namespace,record_key,revision,payload_json) VALUES(?,?,?,?)",params![row["namespace"].as_str(),row["key"].as_str(),row["revision"].as_i64(),row["payload"].to_string()]).map_err(|_| "USER_DATA_INVALID")?;
        }
        let next = live_revision.checked_add(1).ok_or("USER_DATA_INVALID")?;
        transaction
            .execute(
                "UPDATE user_data_meta SET revision=? WHERE singleton=1",
                params![next],
            )
            .map_err(|_| "USER_DATA_INVALID")?;
        transaction.commit().map_err(|_| "STORAGE_UNAVAILABLE")?;
        Ok(json!({"revision":next}))
    })();
    let _ = fs::remove_file(backup.path);
    result.map_or_else(failed, ok)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn backup_rejects_unexpected_trigger() {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(SCHEMA).unwrap();
        assert!(validate_backup(&db).is_ok());
        db.execute_batch(
            "CREATE TRIGGER malicious AFTER INSERT ON user_records BEGIN SELECT 1; END;",
        )
        .unwrap();
        assert!(validate_backup(&db).is_err());
    }
}
