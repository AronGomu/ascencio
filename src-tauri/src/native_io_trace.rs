//! Opt-in, bounded logical I/O evidence. No paths, payloads, or save values.
use serde::Serialize;
use std::{
    fs, io,
    path::Path,
    sync::{Mutex, OnceLock},
    time::Instant,
};
use uuid::Uuid;

const LIMIT: usize = 4096;

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "kebab-case")]
#[allow(dead_code)] // Complete wire contract, including later implementation slices.
pub(crate) enum Category {
    Registry,
    Gameplay,
    Config,
    UserData,
    Scripts,
    Engine,
    Media,
    Maintenance,
    Diagnostics,
}

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum Operation {
    Command,
    Read,
    Metadata,
    Write,
    SqliteOpen,
    SqlQuery,
    Hash,
    Parse,
    Phase,
}

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "kebab-case")]
#[allow(dead_code)] // READY is intentionally not emitted by the current package gate.
pub(crate) enum Phase {
    Startup,
    Verification,
    UserState,
    ModComposition,
    DomainProjections,
    EnginePreparation,
    BaselineReady,
    Ready,
    Failed,
    Cancelled,
    Maintenance,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Event {
    session_id: String,
    sequence: u64,
    phase: Phase,
    category: Category,
    operation: Operation,
    label: &'static str,
    started_ms: f64,
    duration_ms: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    bytes: Option<u64>,
}

struct Buffer {
    phase: Phase,
    sequence: u64,
    dropped_events: u64,
    pending_events: u64,
    events: Vec<Event>,
}

pub(crate) struct Trace {
    enabled: bool,
    session_id: String,
    origin: Instant,
    limit: usize,
    buffer: Mutex<Buffer>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Snapshot {
    schema_version: u8,
    session_id: String,
    enabled: bool,
    dropped_events: u64,
    pending_events: u64,
    events: Vec<Event>,
}

pub(crate) struct Span<'a> {
    trace: &'a Trace,
    event: Event,
}

impl Trace {
    fn new(enabled: bool, limit: usize) -> Self {
        Self {
            enabled,
            limit,
            session_id: Uuid::new_v4().to_string(),
            origin: Instant::now(),
            buffer: Mutex::new(Buffer {
                phase: Phase::Startup,
                sequence: 0,
                dropped_events: 0,
                pending_events: 0,
                events: Vec::new(),
            }),
        }
    }

    fn start(
        &self,
        category: Category,
        operation: Operation,
        label: &'static str,
    ) -> Option<Span<'_>> {
        if !self.enabled {
            return None;
        }
        let mut buffer = self
            .buffer
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        buffer.sequence += 1;
        buffer.pending_events += 1;
        Some(Span {
            trace: self,
            event: Event {
                session_id: self.session_id.clone(),
                sequence: buffer.sequence,
                phase: buffer.phase,
                category,
                operation,
                label,
                started_ms: self.origin.elapsed().as_secs_f64() * 1000.0,
                duration_ms: 0.0,
                bytes: None,
            },
        })
    }

    fn mark(&self, phase: Phase, label: &'static str) {
        if !self.enabled {
            return;
        }
        // Assign phase and marker atomically relative to concurrent native reads.
        let mut buffer = self
            .buffer
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        buffer.phase = phase;
        buffer.sequence += 1;
        let sequence = buffer.sequence;
        let event = Event {
            session_id: self.session_id.clone(),
            sequence,
            phase,
            category: Category::Diagnostics,
            operation: Operation::Phase,
            label,
            started_ms: self.origin.elapsed().as_secs_f64() * 1000.0,
            duration_ms: 0.0,
            bytes: None,
        };
        if buffer.events.len() < self.limit {
            buffer.events.push(event);
        } else {
            buffer.dropped_events += 1;
        }
    }

    fn snapshot(&self) -> Snapshot {
        let buffer = self
            .buffer
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let mut events = buffer.events.clone();
        events.sort_by_key(|event| event.sequence);
        Snapshot {
            schema_version: 1,
            session_id: self.session_id.clone(),
            enabled: self.enabled,
            dropped_events: buffer.dropped_events,
            pending_events: buffer.pending_events,
            events,
        }
    }
}

impl Span<'_> {
    pub(crate) fn bytes(&mut self, bytes: u64) {
        self.event.bytes = Some(bytes);
    }
}

impl Drop for Span<'_> {
    fn drop(&mut self) {
        self.event.duration_ms =
            self.trace.origin.elapsed().as_secs_f64() * 1000.0 - self.event.started_ms;
        let mut buffer = self
            .trace
            .buffer
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        buffer.pending_events -= 1;
        if buffer.events.len() < self.trace.limit {
            buffer.events.push(self.event.clone());
        } else {
            buffer.dropped_events += 1;
        }
    }
}

fn trace() -> &'static Trace {
    static TRACE: OnceLock<Trace> = OnceLock::new();
    TRACE.get_or_init(|| {
        Trace::new(
            std::env::var("ASCENCIO_IO_TRACE").as_deref() == Ok("1"),
            LIMIT,
        )
    })
}

pub(crate) fn session_id() -> Option<String> {
    trace().enabled.then(|| trace().session_id.clone())
}

pub(crate) fn start(
    category: Category,
    operation: Operation,
    label: &'static str,
) -> Option<Span<'static>> {
    trace().start(category, operation, label)
}

pub(crate) fn read(path: &Path, category: Category, label: &'static str) -> io::Result<Vec<u8>> {
    let mut span = start(category, Operation::Read, label);
    let result = fs::read(path);
    if let (Some(span), Ok(bytes)) = (&mut span, &result) {
        span.bytes(bytes.len() as u64);
    }
    result
}

pub(crate) fn read_to_string(
    path: &Path,
    category: Category,
    label: &'static str,
) -> io::Result<String> {
    let mut span = start(category, Operation::Read, label);
    let result = fs::read_to_string(path);
    if let (Some(span), Ok(source)) = (&mut span, &result) {
        span.bytes(source.len() as u64);
    }
    result
}

#[tauri::command]
pub(crate) fn native_io_trace_snapshot() -> Snapshot {
    trace().snapshot()
}

#[tauri::command]
pub(crate) fn native_io_trace_baseline_ready() {
    trace().mark(Phase::BaselineReady, "baseline-ready");
}
pub(crate) fn mark_startup() {
    trace().mark(Phase::Startup, "startup");
}
pub(crate) fn mark_ready() {
    trace().mark(Phase::Ready, "ready");
}
#[tauri::command]
pub(crate) fn native_io_trace_maintenance() {
    trace().mark(Phase::Maintenance, "maintenance");
}
#[tauri::command]
pub(crate) fn native_io_trace_ready(handle: tauri::AppHandle) {
    mark_ready();
    let snapshot = trace().snapshot();
    if snapshot.enabled {
        use tauri::Manager;
        if let Ok(folder) = handle.path().app_log_dir() {
            let file = folder.join(format!(
                "ascencio-startup-{}-io-ready.json",
                snapshot.session_id
            ));
            if let Ok(bytes) = serde_json::to_vec(&snapshot) {
                let _ = std::fs::write(file, bytes);
            }
        }
        eprintln!("ASCENCIO_IO_READY");
        #[cfg(any(debug_assertions, feature = "native-acceptance"))]
        if crate::native_startup::acceptance::recovery_scenario().is_none()
            && std::env::var("ASCENCIO_NATIVE_ACCEPTANCE").as_deref() == Ok("1")
            && handle.path().app_data_dir().is_ok_and(|path| {
                path.parent().is_some_and(|parent| {
                    parent
                        .file_name()
                        .is_some_and(|name| name == "startup-native-data")
                })
            })
        {
            if let Some(window) = handle.get_webview_window("main") {
                let _ = window.eval(include_str!("../../scripts/native-startup-acceptance.js"));
            }
        }
    }
}
#[tauri::command]
pub(crate) fn native_io_trace_acceptance_result(
    handle: tauri::AppHandle,
    report: serde_json::Value,
) -> Result<(), String> {
    use tauri::Manager;
    if !cfg!(any(debug_assertions, feature = "native-acceptance"))
        || std::env::var("ASCENCIO_NATIVE_ACCEPTANCE").as_deref() != Ok("1")
        || !handle.path().app_data_dir().is_ok_and(|path| {
            path.parent().is_some_and(|parent| {
                parent
                    .file_name()
                    .is_some_and(|name| name == "startup-native-data")
            })
        })
    {
        return Err("ACCEPTANCE_FIXTURE_REQUIRED".into());
    }
    let bytes = serde_json::to_vec(&report).map_err(|e| e.to_string())?;
    if bytes.len() > 1024 * 1024 {
        return Err("ACCEPTANCE_REPORT_SIZE".into());
    }
    let folder = handle.path().app_log_dir().map_err(|e| e.to_string())?;
    std::fs::write(
        folder.join(format!(
            "ascencio-startup-{}-acceptance.json",
            trace().session_id
        )),
        bytes,
    )
    .map_err(|e| e.to_string())?;
    eprintln!("ASCENCIO_NATIVE_ACCEPTANCE_RECORDED");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disabled_tracing_collects_nothing() {
        let trace = Trace::new(false, 2);
        drop(trace.start(Category::UserData, Operation::Read, "user-json"));
        trace.mark(Phase::BaselineReady, "baseline-ready");
        assert!(trace.snapshot().events.is_empty());
        assert!(!trace.snapshot().enabled);
    }

    #[test]
    fn spans_keep_start_phase_and_reveal_pending_and_truncated_evidence() {
        let trace = Trace::new(true, 2);
        let mut read = trace
            .start(Category::UserData, Operation::Read, "user-json")
            .unwrap();
        assert_eq!(trace.snapshot().pending_events, 1);
        trace.mark(Phase::BaselineReady, "baseline-ready");
        read.bytes(128);
        drop(read);
        let snapshot = trace.snapshot();
        assert_eq!(snapshot.pending_events, 0);
        assert_eq!(snapshot.events[0].sequence, 1);
        assert_eq!(snapshot.events[0].bytes, Some(128));
        assert!(matches!(snapshot.events[0].phase, Phase::Startup));
        drop(trace.start(Category::Gameplay, Operation::SqliteOpen, "package"));
        assert_eq!(trace.snapshot().dropped_events, 1);
    }

    #[test]
    fn wire_contract_matches_typescript_and_does_not_include_paths_or_payloads() {
        let trace = Trace::new(true, 2);
        drop(trace.start(Category::UserData, Operation::SqliteOpen, "test"));
        let value = serde_json::to_value(trace.snapshot()).unwrap();
        assert_eq!(value["events"][0]["category"], "user-data");
        assert_eq!(value["events"][0]["operation"], "sqlite-open");
        assert_eq!(value["events"][0]["phase"], "startup");
        assert_eq!(value["pendingEvents"], 0);
        assert!(value["events"][0].get("path").is_none());
        assert!(value["events"][0].get("payload").is_none());
    }
}
