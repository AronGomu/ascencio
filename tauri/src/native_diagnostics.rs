use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::{fs, io::Write, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager};
#[derive(Default)]
pub(crate) struct ExitControl(pub(crate) AtomicBool);
use tauri_plugin_opener::OpenerExt;
use uuid::Uuid;

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Location {
    file: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pointer: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    line: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    column: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    mod_id: Option<String>,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Note {
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    source: Option<Location>,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Diagnostic {
    code: String,
    severity: String,
    phase: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    source: Option<Location>,
    #[serde(skip_serializing_if = "Option::is_none")]
    expected: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    received: Option<String>,
    notes: Vec<Note>,
    causes: Vec<String>,
    remediation: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Status {
    session_id: String,
    path: Option<String>,
    logging_error: Option<String>,
    diagnostics: Vec<Diagnostic>,
    dropped_diagnostics: u64,
}
pub(crate) struct Diagnostics(Mutex<Log>);
struct Log {
    status: Status,
    json: Option<fs::File>,
    text: Option<fs::File>,
    folder: Option<PathBuf>,
}

impl Default for Diagnostics {
    fn default() -> Self {
        Self(Mutex::new(Log {
            status: Status {
                session_id: Uuid::new_v4().to_string(),
                path: None,
                logging_error: None,
                diagnostics: vec![],
                dropped_diagnostics: 0,
            },
            json: None,
            text: None,
            folder: None,
        }))
    }
}
impl Diagnostics {
    pub(crate) fn initialize(&self, directory: Result<PathBuf, String>) {
        let mut log = self.0.lock().unwrap_or_else(|e| e.into_inner());
        let result = (|| -> Result<(PathBuf, fs::File, fs::File), String> {
            let root = directory?;
            fs::create_dir_all(&root).map_err(|e| e.to_string())?;
            let mut old = fs::read_dir(&root)
                .map_err(|e| e.to_string())?
                .filter_map(Result::ok)
                .filter(|entry| {
                    entry
                        .file_name()
                        .to_string_lossy()
                        .starts_with("ascencio-startup-")
                        && entry.file_type().is_ok_and(|kind| kind.is_file())
                })
                .collect::<Vec<_>>();
            old.sort_by_key(|entry| entry.metadata().and_then(|m| m.modified()).ok());
            let excess = old.len().saturating_sub(10);
            for entry in old.into_iter().take(excess) {
                let _ = fs::remove_file(entry.path());
            }
            let path = root.join(format!("ascencio-startup-{}.jsonl", log.status.session_id));
            let json = fs::OpenOptions::new()
                .create_new(true)
                .write(true)
                .open(&path)
                .map_err(|e| e.to_string())?;
            let text = fs::OpenOptions::new()
                .create_new(true)
                .write(true)
                .open(path.with_extension("txt"))
                .map_err(|e| e.to_string())?;
            Ok((path, json, text))
        })();
        match result {
            Ok((path, json, text)) => {
                log.folder = path.parent().map(PathBuf::from);
                log.status.path = Some(path.to_string_lossy().into_owned());
                log.json = Some(json);
                log.text = Some(text);
            }
            Err(error) => {
                log.status.logging_error = Some(error);
            }
        }
    }
    pub(crate) fn record(&self, diagnostic: Diagnostic) -> Result<Status, String> {
        if serde_json::to_vec(&diagnostic)
            .map_err(|e| e.to_string())?
            .len()
            > 32 * 1024
            || !["error", "warning"].contains(&diagnostic.severity.as_str())
            || diagnostic.code.is_empty()
            || diagnostic.code.len() > 80
            || !diagnostic
                .code
                .bytes()
                .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == b'_')
            || diagnostic.phase.len() > 80
            || diagnostic.notes.len() > 32
            || diagnostic.causes.len() > 8
        {
            return Err("DIAGNOSTIC_INVALID".into());
        }
        let mut log = self.0.lock().unwrap_or_else(|e| e.into_inner());
        if log.status.diagnostics.len() == 256 {
            log.status.dropped_diagnostics += 1;
            return Ok(log.status.clone());
        }
        let line = serde_json::to_string(&diagnostic).map_err(|e| e.to_string())?;
        let readable = format!(
            "{} [{}] {}\nOrigin: {}\nExpected: {}\nReceived: {}\nNotes: {}\nRemedy: {}\nCauses: {}\n\n",
            diagnostic.severity,
            diagnostic.code,
            diagnostic.message,
            diagnostic
                .source
                .as_ref()
                .map(|s| format!("{}{}{}", s.file, s.pointer.as_deref().unwrap_or(""), s.line.map(|line| format!(":{line}{}", s.column.map(|column| format!(":{column}")).unwrap_or_default())).unwrap_or_default()))
                .unwrap_or_else(|| diagnostic.phase.clone()),
            diagnostic.expected.as_deref().unwrap_or(""),
            diagnostic.received.as_deref().unwrap_or(""),
            diagnostic.notes.iter().map(|note| format!("{}{}", note.message, note.source.as_ref().map(|s| format!(" at {}{}", s.file, s.pointer.as_deref().unwrap_or(""))).unwrap_or_default())).collect::<Vec<_>>().join("\n"),
            diagnostic.remediation,
            diagnostic.causes.join(" -> ")
        );
        let result = (|| -> std::io::Result<()> {
            if let Some(file) = &mut log.json {
                writeln!(file, "{line}")?;
                file.flush()?;
            }
            if let Some(file) = &mut log.text {
                file.write_all(readable.as_bytes())?;
                file.flush()?;
            }
            Ok(())
        })();
        if let Err(error) = result {
            log.status.logging_error = Some(error.to_string());
            log.status.path = None;
            log.json = None;
            log.text = None;
        }
        log.status.diagnostics.push(diagnostic);
        Ok(log.status.clone())
    }
}

#[tauri::command]
pub(crate) fn native_startup_log_status(state: tauri::State<'_, Diagnostics>) -> Status {
    state
        .0
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .status
        .clone()
}
#[tauri::command]
pub(crate) fn native_startup_log_record(
    state: tauri::State<'_, Diagnostics>,
    diagnostic: Diagnostic,
) -> Result<Status, String> {
    state.record(diagnostic)
}
#[tauri::command]
pub(crate) fn native_startup_log_open(
    handle: AppHandle,
    state: tauri::State<'_, Diagnostics>,
    folder: bool,
) -> Result<(), String> {
    let log = state.0.lock().map_err(|e| e.to_string())?;
    let path = if folder {
        log.folder.clone().filter(|_| log.status.path.is_some())
    } else {
        log.status.path.as_ref().map(PathBuf::from)
    }
    .ok_or("LOG_UNAVAILABLE")?;
    handle
        .opener()
        .open_path(path.to_string_lossy().into_owned(), None::<&str>)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub(crate) fn native_startup_quit(handle: AppHandle) {
    handle
        .state::<ExitControl>()
        .0
        .store(true, Ordering::Release);
    handle.exit(0);
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn logger_preserves_memory_when_directory_fails() {
        let state = Diagnostics::default();
        state.initialize(Err("denied".into()));
        let diagnostic = Diagnostic {
            code: "BASE_HASH_MISMATCH".into(),
            severity: "error".into(),
            phase: "verification".into(),
            message: "Corrupt snapshot".into(),
            source: None,
            expected: None,
            received: None,
            notes: vec![],
            causes: vec![],
            remediation: "Reinstall official content".into(),
        };
        let result = state.record(diagnostic).unwrap();
        assert!(result.path.is_none());
        assert_eq!(result.diagnostics.len(), 1);
        assert_eq!(result.logging_error.as_deref(), Some("denied"));
    }
    #[test]
    fn logger_writes_the_exact_reported_file_and_bounds_entries() {
        let root = std::env::temp_dir().join(format!("ascencio-log-{}", Uuid::new_v4()));
        let state = Diagnostics::default();
        state.initialize(Ok(root.clone()));
        let diagnostic = Diagnostic {
            code: "MOD_LUA_SYNTAX".into(),
            severity: "error".into(),
            phase: "startup".into(),
            message: "Expected a document".into(),
            source: Some(Location {
                file: "broken.lua".into(),
                pointer: None,
                line: Some(2),
                column: None,
                mod_id: None,
            }),
            expected: None,
            received: None,
            notes: vec![],
            causes: vec![],
            remediation: "Correct JSON".into(),
        };
        for _ in 0..258 {
            state.record(diagnostic.clone()).unwrap();
        }
        let log = state.0.lock().unwrap();
        assert_eq!(log.status.dropped_diagnostics, 2);
        let readable = fs::read_to_string(
            std::path::Path::new(log.status.path.as_ref().unwrap()).with_extension("txt"),
        )
        .unwrap();
        assert!(readable.contains("Origin: broken.lua:2\n"));
        assert_eq!(
            fs::read_to_string(log.status.path.as_ref().unwrap())
                .unwrap()
                .lines()
                .count(),
            256
        );
        drop(log);
        drop(state);
        fs::remove_dir_all(root).unwrap();
    }
}
