//! Shared logical byte quota and atomic publication, interoperable with Node writers.
use crate::xml::Result;
use serde_json::{json, Value};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    time::Duration,
};
pub const DEFAULT_MAX: u64 = 20_000_000_000;
pub const CONTROL_RESERVE: u64 = 16_000_000;
static WRITER: Mutex<()> = Mutex::new(());
static SEQUENCE: AtomicU64 = AtomicU64::new(0);
pub fn root(file: &Path) -> Option<PathBuf> {
    file.parent()?
        .ancestors()
        .filter(|p| p.join(".output-budget.json").is_file())
        .last()
        .map(Path::to_owned)
}
fn control(path: &Path) -> bool {
    let name = path.file_name().unwrap().to_string_lossy();
    let name = name.split(".output-stage-").next().unwrap();
    matches!(
        name,
        "control.json"
            | "report.json"
            | "report.md"
            | "state.json"
            | "run.json"
            | "progress.json"
            | "result.json"
            | "summary.xml"
            | "replay.json"
            | "owners.json"
            | ".output-budget.json"
            | ".storage-stop"
            | ".batch-output-lease.json"
    )
}
fn alive(pid: i32) -> bool {
    unsafe {
        libc::kill(pid, 0) == 0
            || std::io::Error::last_os_error().raw_os_error() != Some(libc::ESRCH)
    }
}
struct Lock {
    file: PathBuf,
    owner: PathBuf,
}
impl Drop for Lock {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.file);
        let _ = fs::remove_file(&self.owner);
    }
}
/// Only this exclusive guard may reclaim a dead writer. A second reaper
/// must reread the owner after acquiring it, so it cannot unlink a new lock.
fn reclaim_dead_writer(root: &Path, owner: &Path) -> Result<bool> {
    let recovery = root.join(".output-storage.recovery");
    match fs::hard_link(owner, &recovery) {
        Ok(()) => (),
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => return Ok(false),
        Err(e) => return Err(e.into()),
    }
    struct Recovery(PathBuf);
    impl Drop for Recovery {
        fn drop(&mut self) {
            let _ = fs::remove_file(&self.0);
        }
    }
    let _guard = Recovery(recovery);
    let lock = root.join(".output-storage.lock");
    let pid = match fs::read_to_string(&lock) {
        Ok(owner) => owner.parse::<i32>().ok(),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
        Err(e) => return Err(e.into()),
    };
    if pid.is_some_and(|pid| pid > 0 && !alive(pid)) {
        match fs::remove_file(&lock) {
            Ok(()) => return Ok(true),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
            Err(e) => return Err(e.into()),
        }
    }
    Ok(false)
}
fn lock(root: &Path) -> Result<Lock> {
    let file = root.join(".output-storage.lock");
    let owner = root.join(format!(
        ".output-lock-{}-{}",
        std::process::id(),
        SEQUENCE.fetch_add(1, Ordering::SeqCst)
    ));
    let mut f = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&owner)?;
    write!(f, "{}", std::process::id())?;
    f.sync_all()?;
    for n in 0..1500 {
        match fs::hard_link(&owner, &file) {
            Ok(()) => return Ok(Lock { file, owner }),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                if let Ok(pid) = fs::read_to_string(&file).unwrap_or_default().parse::<i32>() {
                    if pid > 0 && !alive(pid) {
                        if reclaim_dead_writer(root, &owner)? {
                            continue;
                        }
                    }
                }
                if n < 1499 {
                    std::thread::sleep(Duration::from_millis(20));
                }
            }
            Err(e) => {
                let _ = fs::remove_file(owner);
                return Err(e.into());
            }
        }
    }
    let _ = fs::remove_file(owner);
    if root.join(".output-storage.recovery").exists() {
        Err("Output storage recovery is incomplete; reconcile the owned recovery lock before resume".into())
    } else {
        Err("Output storage writer is busy".into())
    }
}
pub fn usage(root: &Path) -> Result<(u64, u64)> {
    fn visit(
        path: &Path,
        data: &mut u64,
        meta: &mut u64,
        lease: Option<&(PathBuf, u64)>,
        charged: &mut bool,
    ) -> Result<()> {
        let entries = match fs::read_dir(path) {
            Ok(entries) => entries,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(e) => return Err(e.into()),
        };
        for e in entries {
            let e = match e {
                Ok(e) => e,
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue,
                Err(e) => return Err(e.into()),
            };
            let name = e.file_name();
            let name = name.to_string_lossy();
            if name == ".output-storage.lock"
                || name == ".output-storage.recovery"
                || name.starts_with(".output-lock-")
            {
                continue;
            }
            let p = e.path();
            if let Some((leased, allowance)) = lease {
                if p == *leased {
                    *data = data.saturating_add(*allowance);
                    *charged = true;
                    continue;
                }
            }
            let s = match fs::symlink_metadata(&p) {
                Ok(s) => s,
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue,
                Err(e) => return Err(e.into()),
            };
            if s.is_dir() {
                visit(&p, data, meta, lease, charged)?
            } else if control(&p) {
                *meta = meta.saturating_add(s.len())
            } else {
                *data = data.saturating_add(s.len())
            }
        }
        Ok(())
    }
    let lease = match fs::read(root.join(".batch-output-lease.json")) {
        Ok(bytes) => {
            let value: Value = serde_json::from_slice(&bytes)?;
            if value["active"] == true {
                let relative = Path::new(
                    value["evaluation"]
                        .as_str()
                        .ok_or("Invalid batch lease path")?,
                );
                let amount = value["maxBytes"]
                    .as_u64()
                    .filter(|n| *n > 0)
                    .ok_or("Invalid batch lease allowance")?;
                if value["schemaVersion"] != 1
                    || relative.as_os_str().is_empty()
                    || relative
                        .components()
                        .any(|c| !matches!(c, std::path::Component::Normal(_)))
                {
                    return Err("Invalid batch storage lease".into());
                }
                Some((root.join(relative), amount))
            } else {
                None
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
        Err(e) => return Err(e.into()),
    };
    let (mut data, mut meta) = (0, 0);
    let mut charged = false;
    visit(root, &mut data, &mut meta, lease.as_ref(), &mut charged)?;
    if !charged {
        if let Some((_, amount)) = lease {
            data = data.saturating_add(amount);
        }
    }
    Ok((data, meta))
}
fn atomic(path: &Path, bytes: &[u8]) -> Result<()> {
    atomic_with_hook(path, bytes, |_| Ok(()))
}
fn atomic_with_hook(
    path: &Path,
    bytes: &[u8],
    before_publish: impl FnOnce(&Path) -> Result<()>,
) -> Result<()> {
    fs::create_dir_all(path.parent().ok_or("Missing output parent")?)?;
    let stage = PathBuf::from(format!(
        "{}.output-stage-{}-{}",
        path.display(),
        std::process::id(),
        SEQUENCE.fetch_add(1, Ordering::SeqCst)
    ));
    let result = (|| -> Result<()> {
        let mut f = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&stage)?;
        f.write_all(bytes)?;
        f.sync_all()?;
        before_publish(&stage)?;
        fs::rename(&stage, path)?;
        fs::File::open(path.parent().unwrap())?.sync_all()?;
        Ok(())
    })();
    let _ = fs::remove_file(stage);
    result
}
fn limits(root: &Path) -> Result<(u64, u64)> {
    let limits: Value = serde_json::from_slice(&fs::read(root.join(".output-budget.json"))?)?;
    let max = limits["maxBytes"].as_u64().ok_or("Invalid output limit")?;
    let reserve = limits["controlReserveBytes"]
        .as_u64()
        .ok_or("Invalid output reserve")?;
    if reserve == 0 || max <= reserve {
        return Err("Invalid output budget configuration".into());
    }
    Ok((max, reserve))
}
fn mark_exhausted(root: &Path, total: u64, max: u64) -> Result<()> {
    let flag = root.join(".storage-stop");
    if !flag.exists() && total.saturating_add(17) <= max {
        atomic(&flag, b"max-output-bytes\n")?;
    }
    Ok(())
}
pub fn configure(root: &Path, max: u64, reserve: u64) -> Result<()> {
    if reserve == 0 || max <= reserve {
        return Err("Output limit must exceed control reserve".into());
    }
    fs::create_dir_all(root)?;
    if self::root(&root.join(".budget-probe")).is_some_and(|parent| parent != root) {
        return Ok(());
    }
    let _thread = WRITER.lock().unwrap();
    let _lock = lock(root)?;
    if !root.join(".output-budget.json").exists() {
        atomic(
            &root.join(".output-budget.json"),
            &serde_json::to_vec(&json!({"maxBytes":max,"controlReserveBytes":reserve}))?,
        )?;
    }
    let (max, reserve) = limits(root)?;
    let (data, meta) = usage(root)?;
    let total = data.saturating_add(meta);
    if total >= max.saturating_sub(reserve) {
        mark_exhausted(root, total, max)?;
    }
    Ok(())
}
pub fn write(path: &Path, bytes: &[u8]) -> Result<()> {
    if let Some(result) = crate::worker_storage::write(path, bytes) {
        return result;
    }
    let Some(root) = root(path) else {
        return atomic(path, bytes);
    };
    let _thread = WRITER.lock().unwrap();
    let _lock = lock(&root)?;
    let (max, reserve) = limits(&root)?;
    let (data, meta) = usage(&root)?;
    let size = bytes.len() as u64;
    let is_control = control(path);
    let total = data.saturating_add(meta);
    let peak = total.saturating_add(size);
    if (!is_control && exhausted(&root))
        || peak > max
        || (!is_control && peak > max.saturating_sub(reserve))
    {
        if !is_control {
            mark_exhausted(&root, total, max)?;
        }
        return Err(format!(
            "max-output-bytes: refusing {size} bytes for {}; checkpoint reserve is protected",
            path.display()
        )
        .into());
    }
    atomic(path, bytes)
}
pub fn exhausted(root: &Path) -> bool {
    self::root(&root.join(".budget-probe"))
        .unwrap_or_else(|| root.to_owned())
        .join(".storage-stop")
        .is_file()
}
#[cfg(test)]
mod tests {
    use super::*;
    struct Directory(PathBuf);
    impl Directory {
        fn new() -> Self {
            let p = std::env::temp_dir().join(format!(
                "quota-{}-{}",
                std::process::id(),
                SEQUENCE.fetch_add(1, Ordering::SeqCst)
            ));
            fs::create_dir_all(&p).unwrap();
            Self(p)
        }
    }
    impl Drop for Directory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    #[test]
    fn quota_includes_staging_and_protects_control_reserve() {
        let dir = Directory::new();
        let root = &dir.0;
        configure(root, 4096, 1024).unwrap();
        write(&root.join("game.log"), &vec![1; 2500]).unwrap();
        assert!(write(&root.join("other.log"), &vec![2; 600]).is_err());
        write(&root.join("report.json"), b"{\"status\":\"suspended\"}").unwrap();
        assert!(exhausted(root));
        assert_eq!(fs::read(root.join("game.log")).unwrap().len(), 2500);
        assert!(write(&root.join("game.log"), &vec![3; 2500]).is_err());
        let (data, meta) = usage(root).unwrap();
        assert!(data <= 4096 - 1024);
        assert!(meta <= 1024);
        assert!(data + meta <= 4096);
    }
    #[test]
    fn interruption_before_rename_preserves_the_committed_file() {
        let dir = Directory::new();
        let file = dir.0.join("game.log");
        atomic(&file, b"committed checkpoint").unwrap();
        let error = atomic_with_hook(&file, b"next checkpoint", |stage| {
            assert_eq!(fs::read(stage)?, b"next checkpoint");
            assert_eq!(fs::read(&file)?, b"committed checkpoint");
            Err("simulated interruption before publication".into())
        });
        assert!(error.is_err());
        assert_eq!(fs::read(&file).unwrap(), b"committed checkpoint");
        assert_eq!(fs::read_dir(&dir.0).unwrap().count(), 1);
        atomic(&file, b"next checkpoint").unwrap();
        assert_eq!(fs::read(file).unwrap(), b"next checkpoint");
    }
    #[test]
    fn exhaustion_marker_cannot_exceed_the_total_cap() {
        let dir = Directory::new();
        let root = &dir.0;
        configure(root, 4096, 1024).unwrap();
        let (_, used) = usage(root).unwrap();
        fs::write(root.join("report.json"), vec![0; 4096 - used as usize]).unwrap();
        assert!(write(&root.join("game.log"), &vec![1; 3073]).is_err());
        assert!(!exhausted(root));
        let (data, meta) = usage(root).unwrap();
        assert_eq!(meta, 4096);
        assert_eq!(data, 0);
    }
    #[test]
    fn scans_tolerate_removed_paths_and_do_not_follow_symlinks() {
        let dir = Directory::new();
        assert_eq!(usage(&dir.0.join("already-removed")).unwrap(), (0, 0));
        #[cfg(unix)]
        {
            let target = dir.0.join("missing-target");
            let link = dir.0.join("unfollowed-link");
            std::os::unix::fs::symlink(target, &link).unwrap();
            let size = fs::symlink_metadata(link).unwrap().len();
            assert_eq!(usage(&dir.0).unwrap(), (size, 0));
        }
    }
    #[test]
    fn control_can_use_remaining_capacity_but_data_must_leave_reserve_free() {
        let dir = Directory::new();
        let root = &dir.0;
        configure(root, 4096, 1024).unwrap();
        write(&root.join("report.json"), &vec![0; 1500]).unwrap();
        // Existing metadata consumes capacity too: 1,500 data bytes fit, 1,600 do not.
        write(&root.join("game.log"), &vec![1; 1500]).unwrap();
        assert!(write(&root.join("extra.log"), &vec![2; 100]).is_err());
        write(&root.join("progress.json"), &vec![3; 800]).unwrap();
        let (data, meta) = usage(root).unwrap();
        assert!(meta > 1024);
        assert!(data + meta <= 4096);
    }
    #[test]
    fn configure_detects_existing_output_above_the_data_admission_threshold() {
        let dir = Directory::new();
        let root = &dir.0;
        fs::write(root.join("existing.log"), vec![0; 3100]).unwrap();
        configure(root, 4096, 1024).unwrap();
        assert!(exhausted(root));
        assert_eq!(fs::read(root.join("existing.log")).unwrap().len(), 3100);
        let (data, meta) = usage(root).unwrap();
        assert!(data + meta <= 4096);
    }
    #[test]
    fn dead_writer_recovery_is_exclusive_and_rechecks_the_current_owner() {
        let dir = Directory::new();
        let root = &dir.0;
        let owner = root.join(".output-lock-test");
        atomic(&owner, std::process::id().to_string().as_bytes()).unwrap();
        let writer = root.join(".output-storage.lock");
        atomic(&writer, i32::MAX.to_string().as_bytes()).unwrap();
        assert!(reclaim_dead_writer(root, &owner).unwrap());
        assert!(!writer.exists());
        assert!(!root.join(".output-storage.recovery").exists());
        // A prior stale-owner observation must not authorize deleting a new live owner.
        atomic(&writer, std::process::id().to_string().as_bytes()).unwrap();
        assert!(!reclaim_dead_writer(root, &owner).unwrap());
        assert!(writer.exists());
        // Interrupted recovery is never automatically broken by another reaper.
        atomic(&writer, i32::MAX.to_string().as_bytes()).unwrap();
        fs::hard_link(&owner, root.join(".output-storage.recovery")).unwrap();
        assert!(!reclaim_dead_writer(root, &owner).unwrap());
        assert!(writer.exists());
        assert_eq!(usage(root).unwrap(), (0, 0));
    }
    #[test]
    fn batch_lease_holds_capacity_without_double_counting_files() {
        let dir = Directory::new();
        let root = &dir.0;
        configure(root, 8192, 1024).unwrap();
        fs::write(
            root.join(".batch-output-lease.json"),
            br#"{"schemaVersion":1,"evaluation":"evaluation","maxBytes":5000,"active":true}"#,
        )
        .unwrap();
        assert_eq!(usage(root).unwrap().0, 5000);
        fs::create_dir(root.join("evaluation")).unwrap();
        fs::write(root.join("evaluation/game.log"), vec![0; 2000]).unwrap();
        assert_eq!(usage(root).unwrap().0, 5000);
        assert!(write(&root.join("outside.log"), &vec![0; 2200]).is_err());
    }
    #[test]
    fn final_summary_and_hash_map_can_publish_after_a_data_stop() {
        let dir = Directory::new();
        let root = &dir.0;
        configure(root, 8192, 2048).unwrap();
        write(&root.join("game.log"), &vec![0; 5000]).unwrap();
        assert!(write(&root.join("next-game.log"), &vec![1; 1500]).is_err());
        assert!(exhausted(root));
        write(
            &root.join("summary.xml"),
            b"<summary status=\"interrupted\"/>",
        )
        .unwrap();
        write(
            &root.join("replay.json"),
            br#"{"match-1":{"games":[{"id":"game-1","hash":"sha256"}]}}"#,
        )
        .unwrap();
        write(
            &root.join("result.json"),
            br#"{"status":"interrupted","stoppingReason":"max-output-bytes"}"#,
        )
        .unwrap();
        assert!(root.join("summary.xml").is_file());
        assert!(root.join("replay.json").is_file());
        assert!(root.join("result.json").is_file());
        assert!(write(
            &root.join("another-game.log"),
            b"even a small game remains stopped"
        )
        .is_err());
        let (data, meta) = usage(root).unwrap();
        assert!(data + meta <= 8192);
    }
    #[test]
    fn invalid_persisted_limits_fail_closed() {
        let dir = Directory::new();
        let root = &dir.0;
        configure(root, 4096, 1024).unwrap();
        fs::write(
            root.join(".output-budget.json"),
            br#"{"maxBytes":10,"controlReserveBytes":20}"#,
        )
        .unwrap();
        assert!(write(&root.join("game.log"), b"data").is_err());
        assert!(!root.join("game.log").exists());
    }
}
