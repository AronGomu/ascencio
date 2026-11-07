//! Bundled/installed bot snapshots and preemptible native reference sessions.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, ChildStdout, Command, Stdio},
    sync::{mpsc, Arc, Mutex},
    time::Duration,
};
use tauri::Manager;
const MAX_BYTES: usize = 4 * 1024 * 1024;
fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn reference_digest() -> String {
    digest(include_bytes!(
        "../../assets/ai-bots/reference/dist/ai.wasm"
    ))
}
fn safe_relative(value: &Value, prefix: &str) -> Result<PathBuf, String> {
    let s = value.as_str().ok_or("Missing resource path")?;
    if s.len() > 240
        || s.contains('\\')
        || !s.starts_with(prefix)
        || s.split('/').any(|p| p.is_empty() || p == "." || p == "..")
    {
        return Err("Unsafe bot resource path".into());
    }
    Ok(PathBuf::from(s))
}
fn read_package(folder: &Path) -> Result<Value, String> {
    let metadata = fs::symlink_metadata(folder.join("bot.json")).map_err(|e| e.to_string())?;
    if metadata.file_type().is_symlink() || metadata.len() > 16384 {
        return Err("Unsafe bot manifest".into());
    }
    let manifest: Value =
        serde_json::from_slice(&fs::read(folder.join("bot.json")).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
    let id = manifest["id"].as_str().ok_or("Missing bot identity")?;
    let policies = manifest["policies"]
        .as_array()
        .ok_or("Missing bot policies")?;
    let version = manifest["packageVersion"]
        .as_str()
        .ok_or("Missing package version")?;
    let numeric = version.split(['-', '+']).next().unwrap_or("");
    if numeric.split('.').count() != 3
        || numeric
            .split('.')
            .any(|p| p.is_empty() || !p.bytes().all(|c| c.is_ascii_digit()))
        || version.len() > 128
        || policies.is_empty()
        || policies
            .iter()
            .any(|p| !matches!(p.as_str(), Some("basic" | "generalist" | "random")))
    {
        return Err("Unsupported bot manifest".into());
    }

    if id.is_empty()
        || !id.as_bytes()[0].is_ascii_alphanumeric()
        || id.len() > 80
        || !id
            .bytes()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || b"._-".contains(&c))
        || manifest["contractVersion"] != 1
        || manifest["packageVersion"].as_str().is_none()
    {
        return Err("Unsupported bot manifest".into());
    }
    safe_relative(&manifest["source"], "ai/")?;
    let relative = safe_relative(&manifest["wasm"], "dist/")?;
    let root = folder.canonicalize().map_err(|e| e.to_string())?;
    let path = root
        .join(relative)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    if !path.starts_with(&root)
        || fs::metadata(&path).map_err(|e| e.to_string())?.len() > MAX_BYTES as u64
    {
        return Err("Unsafe bot executable".into());
    }
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    if bytes.len() > MAX_BYTES {
        return Err("Bot executable too large".into());
    }
    let hash = digest(&bytes);
    Ok(
        json!({"manifest":manifest,"bytes":bytes,"digest":hash,"nativeCompatible":id=="ascencio.reference"&&hash==reference_digest()}),
    )
}
fn roots(app: &tauri::AppHandle) -> Result<Vec<PathBuf>, String> {
    Ok(vec![
        app.path()
            .resource_dir()
            .map_err(|e| e.to_string())?
            .join("ai-bots"),
        app.path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("ai-bots"),
    ])
}
#[derive(Default)]
struct PackageInventory {
    valid: BTreeMap<String, Value>,
    failures: BTreeMap<String, String>,
}
fn scan_packages(roots: &[PathBuf]) -> Result<PackageInventory, String> {
    let mut result = PackageInventory::default();
    for root in roots {
        if !root.exists() {
            continue;
        }
        let mut identities = std::collections::BTreeSet::new();
        let mut entries = fs::read_dir(root)
            .map_err(|e| format!("Cannot read AI directory {}: {e}", root.display()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        entries.sort_by_key(|entry| entry.file_name());
        for entry in entries {
            if !entry.file_type().map_err(|e| e.to_string())?.is_dir()
                || !entry.path().join("bot.json").exists()
            {
                continue;
            }
            // Even invalid executables can have a recognizable manifest identity.
            // Bound this diagnostic read just like the primary manifest reader.
            let manifest_path = entry.path().join("bot.json");
            let identity = fs::symlink_metadata(&manifest_path)
                .ok()
                .filter(|m| m.is_file() && !m.file_type().is_symlink() && m.len() <= 16384)
                .and_then(|_| fs::read(&manifest_path).ok())
                .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
                .and_then(|m| m["id"].as_str().map(str::to_owned))
                .unwrap_or_else(|| entry.file_name().to_string_lossy().into_owned());
            let failure = if !identities.insert(identity.clone()) {
                Err(format!(
                    "Duplicate AI identity {identity}; remove one package folder"
                ))
            } else {
                read_package(&entry.path())
            };
            match failure {
                Ok(value) if !result.failures.contains_key(&identity) => {
                    result.valid.insert(identity, value);
                }
                Ok(_) => {}
                Err(error) => {
                    let detail = format!("AI {identity} in {} is unavailable: {error}. Repair or remove that package folder and retry.", entry.path().display());
                    eprintln!("{detail}");
                    result.valid.remove(&identity);
                    result.failures.insert(identity, detail);
                }
            }
        }
    }
    Ok(result)
}
#[tauri::command]
pub fn native_bot_list(app: tauri::AppHandle) -> Result<Vec<Value>, String> {
    Ok(scan_packages(&roots(&app)?)?
        .valid
        .into_values()
        .map(|mut p| {
            p.as_object_mut().unwrap().remove("bytes");
            p
        })
        .collect())
}
#[tauri::command]
pub fn native_bot_pin(app: tauri::AppHandle, id: String) -> Result<Value, String> {
    let mut inventory = scan_packages(&roots(&app)?)?;
    if let Some(error) = inventory.failures.remove(&id) {
        return Err(error);
    }
    inventory.valid.remove(&id).ok_or(format!("Required AI {id} is missing. Install its folder in the app-data ai-bots directory and retry."))
}
struct Session {
    child: Mutex<Child>,
    input: Mutex<ChildStdin>,
    output: Mutex<BufReader<ChildStdout>>,
    operation: Mutex<()>,
}
impl Drop for Session {
    fn drop(&mut self) {
        if let Ok(child) = self.child.get_mut() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}
#[derive(Default)]
pub struct BotSessions(Mutex<BTreeMap<String, Arc<Session>>>);
#[tauri::command]
pub fn native_bot_open(
    app: tauri::AppHandle,
    state: tauri::State<BotSessions>,
    digest: String,
) -> Result<String, String> {
    if digest != reference_digest() {
        return Err("No trusted native build for this package version".into());
    }
    let mut sessions = state.0.lock().map_err(|e| e.to_string())?;
    if sessions.len() >= 16 {
        return Err("Native bot session limit reached".into());
    }
    let executable = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join(if cfg!(windows) {
            "ai-bots/native/ascencio-reference-bot.exe"
        } else {
            "ai-bots/native/ascencio-reference-bot"
        });
    let mut command = Command::new(executable);
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        unsafe {
            command.pre_exec(|| {
                let limit = libc::rlimit {
                    rlim_cur: 768 * 1024 * 1024,
                    rlim_max: 768 * 1024 * 1024,
                };
                if libc::setrlimit(libc::RLIMIT_AS, &limit) != 0 {
                    return Err(std::io::Error::last_os_error());
                }
                Ok(())
            });
        }
    }
    let mut child = command.spawn().map_err(|e| e.to_string())?;
    let input = child.stdin.take().ok_or("Missing native stdin")?;
    let output = BufReader::new(child.stdout.take().ok_or("Missing native stdout")?);
    let id = uuid::Uuid::new_v4().to_string();
    sessions.insert(
        id.clone(),
        Arc::new(Session {
            child: Mutex::new(child),
            input: Mutex::new(input),
            output: Mutex::new(output),
            operation: Mutex::new(()),
        }),
    );
    Ok(id)
}
#[tauri::command]
pub async fn native_bot_request(
    state: tauri::State<'_, BotSessions>,
    session: String,
    request: String,
) -> Result<Value, String> {
    if request.len() > 64 * 1024 * 1024 {
        return Err("Native bot input limit exceeded".into());
    }
    let bot = state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .get(&session)
        .cloned()
        .ok_or("Bot session closed")?;
    tauri::async_runtime::spawn_blocking(move || {
        execute_request(bot, request, Duration::from_secs(2))
    })
    .await
    .map_err(|e| e.to_string())?
}
fn execute_request(
    bot: Arc<Session>,
    request: String,
    deadline: Duration,
) -> Result<Value, String> {
    let _operation = bot
        .operation
        .try_lock()
        .map_err(|_| "Bot request already pending")?;
    let (tx, rx) = mpsc::channel();
    let running = bot.clone();
    std::thread::spawn(move || {
        let result = (|| {
            let mut input = running.input.lock().map_err(|e| e.to_string())?;
            writeln!(input, "{request}").map_err(|e| e.to_string())?;
            input.flush().map_err(|e| e.to_string())?;
            drop(input);
            let mut output = running.output.lock().map_err(|e| e.to_string())?;
            let mut line = String::new();
            let size = std::io::Read::take(&mut *output, 1024 * 1024 + 1)
                .read_line(&mut line)
                .map_err(|e| e.to_string())?;
            if size == 0 || size > 1024 * 1024 {
                return Err("Invalid native response size".into());
            }
            serde_json::from_str::<Value>(&line).map_err(|e| e.to_string())
        })();
        let _ = tx.send(result);
    });
    match rx.recv_timeout(deadline) {
        Ok(result) => result,
        Err(_) => {
            if let Ok(mut child) = bot.child.lock() {
                let _ = child.kill();
            }
            Err("Native bot execution timed out".into())
        }
    }
}

#[tauri::command]
pub fn native_bot_close(state: tauri::State<BotSessions>, session: String) -> Result<(), String> {
    if let Some(bot) = state.0.lock().map_err(|e| e.to_string())?.remove(&session) {
        if let Ok(mut child) = bot.child.lock() {
            let _ = child.kill();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn native_bot_memory(
    state: tauri::State<BotSessions>,
    session: String,
) -> Result<Option<u64>, String> {
    let bot = state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .get(&session)
        .cloned()
        .ok_or("Bot session closed")?;
    let pid = bot.child.lock().map_err(|e| e.to_string())?.id();
    #[cfg(target_os = "linux")]
    {
        let status =
            fs::read_to_string(format!("/proc/{pid}/status")).map_err(|e| e.to_string())?;
        Ok(status.lines().find_map(|line| {
            line.strip_prefix("VmRSS:")
                .and_then(|s| s.split_whitespace().next()?.parse::<u64>().ok())
                .map(|kb| kb * 1024)
        }))
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = pid;
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pins_bytes_and_rejects_resource_escape() {
        let root = std::env::temp_dir().join(format!("ascencio-bot-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("dist")).unwrap();
        let mut manifest = json!({"id":"test.bot","packageVersion":"1.0.0","contractVersion":1,"source":"ai/Cargo.toml","wasm":"dist/ai.wasm","policies":["basic"]});
        fs::write(root.join("bot.json"), manifest.to_string()).unwrap();
        fs::write(root.join("dist/ai.wasm"), [1, 2, 3]).unwrap();
        let pinned = read_package(&root).unwrap();
        fs::write(root.join("dist/ai.wasm"), [4, 5, 6]).unwrap();
        assert_ne!(pinned["digest"], read_package(&root).unwrap()["digest"]);
        assert_eq!(pinned["bytes"], json!([1, 2, 3]));
        manifest["wasm"] = json!("dist/../../outside");
        fs::write(root.join("bot.json"), manifest.to_string()).unwrap();
        assert!(read_package(&root).is_err());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn broken_packages_do_not_hide_other_identities() {
        let root = std::env::temp_dir().join(format!("ascencio-packages-{}", uuid::Uuid::new_v4()));
        let good = root.join("good");
        let broken = root.join("broken");
        fs::create_dir_all(good.join("dist")).unwrap();
        fs::create_dir_all(&broken).unwrap();
        fs::write(good.join("bot.json"), json!({"id":"test.good","packageVersion":"1.0.0","contractVersion":1,"source":"ai/Cargo.toml","wasm":"dist/ai.wasm","policies":["basic"]}).to_string()).unwrap();
        fs::write(good.join("dist/ai.wasm"), [1, 2, 3]).unwrap();
        fs::write(broken.join("bot.json"), "invalid JSON").unwrap();
        let inventory = scan_packages(&[root.clone()]).unwrap();
        assert!(inventory.valid.contains_key("test.good"));
        assert!(inventory.failures["broken"].contains("Repair or remove"));
        fs::write(broken.join("bot.json"), json!({"id":"test.broken","packageVersion":"1.0.0","contractVersion":1,"source":"ai/Cargo.toml","wasm":"dist/missing.wasm","policies":["basic"]}).to_string()).unwrap();
        let inventory = scan_packages(&[root.clone()]).unwrap();
        assert!(inventory.valid.contains_key("test.good"));
        assert!(inventory.failures.contains_key("test.broken"));
        fs::remove_dir_all(root).unwrap();
    }
    #[cfg(unix)]
    fn process(script: &str) -> Arc<Session> {
        let mut child = Command::new("sh")
            .args(["-c", script])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
            .unwrap();
        let input = child.stdin.take().unwrap();
        let output = BufReader::new(child.stdout.take().unwrap());
        Arc::new(Session {
            child: Mutex::new(child),
            input: Mutex::new(input),
            output: Mutex::new(output),
            operation: Mutex::new(()),
        })
    }
    #[cfg(unix)]
    #[test]
    fn kills_a_stalled_native_process_and_rejects_invalid_output() {
        let bot = process("read request; exec sleep 60");
        let start = std::time::Instant::now();
        let result = execute_request(bot.clone(), "{}".into(), Duration::from_millis(50));
        assert!(result.unwrap_err().contains("timed out"));
        assert!(start.elapsed() < Duration::from_secs(2));
        assert!(!bot.child.lock().unwrap().wait().unwrap().success());
        for script in ["read request; echo invalid", "read request; exit 1"] {
            assert!(execute_request(process(script), "{}".into(), Duration::from_secs(1)).is_err());
        }
    }
}
