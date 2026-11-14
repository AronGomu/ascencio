//! Opt-in, independent writer allowances. Reconcile once on startup; account every
//! atomic replacement including its full staging copy. No cross-worker write lock.
use crate::xml::Result;
use std::{
    collections::BTreeMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{Arc, Mutex, OnceLock},
};
struct Budget {
    used: u64,
    limit: u64,
}
type Budgets = BTreeMap<PathBuf, Arc<Mutex<Budget>>>;
static BUDGETS: OnceLock<Mutex<Budgets>> = OnceLock::new();
fn budgets() -> &'static Mutex<Budgets> {
    BUDGETS.get_or_init(Default::default)
}
pub fn register(root: &Path, limit: u64) -> Result<()> {
    register_inner(root, limit, false, false)
}
pub fn register_control(root: &Path, limit: u64, flat: bool) -> Result<()> {
    register_inner(root, limit, true, flat)
}
fn register_inner(root: &Path, limit: u64, control: bool, flat: bool) -> Result<()> {
    fs::create_dir_all(root)?;
    fn size(root: &Path, control: bool, flat: bool) -> Result<u64> {
        let mut total = 0;
        for entry in fs::read_dir(root)? {
            let p = entry?.path();
            let meta = fs::symlink_metadata(&p)?;
            if meta.file_type().is_symlink() {
                return Err("Worker output must not contain symlinks".into());
            }
            if control
                && p.file_name()
                    .is_some_and(|n| n == "workers" || (flat && n == "matches"))
            {
                if !meta.is_dir() {
                    return Err("Invalid worker directory".into());
                }
                continue;
            }
            total += if meta.is_dir() {
                size(&p, false, false)?
            } else {
                meta.len()
            };
        }
        Ok(total)
    }
    let used = size(root, control, flat)?;
    if used > limit {
        return Err("Existing output exceeds worker allowance".into());
    }
    budgets().lock().unwrap().insert(
        root.to_owned(),
        Arc::new(Mutex::new(Budget { used, limit })),
    );
    Ok(())
}
pub fn alias(path: &Path, worker: &Path) -> Result<()> {
    let mut scopes = budgets().lock().unwrap();
    let budget = scopes.get(worker).ok_or("Missing worker budget")?.clone();
    if let Some(old) = scopes.get(path) {
        if !Arc::ptr_eq(old, &budget) {
            return Err("Match writer ownership changed".into());
        }
        return Ok(());
    }
    let used = if path.exists() {
        let (data, meta) = crate::output_storage::usage(path)?;
        data + meta
    } else {
        0
    };
    {
        let mut b = budget.lock().unwrap();
        if b.used.saturating_add(used) > b.limit {
            return Err("Existing match evidence exceeds worker allowance".into());
        }
        b.used += used;
    }
    scopes.insert(path.to_owned(), budget);
    Ok(())
}
pub fn write(path: &Path, bytes: &[u8]) -> Option<Result<()>> {
    let budget = {
        let scopes = budgets().lock().unwrap();
        path.ancestors().find_map(|p| scopes.get(p).cloned())
    }?;
    Some((|| -> Result<()> {
        let mut b = budget.lock().unwrap();
        let size = bytes.len() as u64;
        if b.used.saturating_add(size) > b.limit {
            return Err("max-output-bytes: worker allowance exhausted".into());
        }
        let old = fs::metadata(path).map(|m| m.len()).unwrap_or(0);
        fs::create_dir_all(path.parent().ok_or("Missing output parent")?)?;
        let stage = path.with_file_name(format!(
            "{}.batch-stage",
            path.file_name().unwrap().to_string_lossy()
        ));
        // A leftover staging file is already charged by startup reconciliation.
        if stage.exists() {
            return Err("Interrupted staging file requires recovery".into());
        }
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&stage)?;
        b.used += size;
        if let Err(e) = file.write_all(bytes).and_then(|_| file.sync_all()) {
            if fs::remove_file(&stage).is_ok() {
                b.used -= size;
            }
            return Err(e.into());
        }
        fs::rename(&stage, path)?;
        b.used -= old;
        fs::File::open(path.parent().unwrap())?.sync_all()?;
        Ok(())
    })())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn replacements_reserve_staging_and_workers_are_independent() {
        let root =
            std::env::temp_dir().join(format!("ascencio-worker-budget-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        register(&root, 10).unwrap();
        let file = root.join("a");
        write(&file, b"123456").unwrap().unwrap();
        assert!(write(&file, b"12345").unwrap().is_err());
        write(&file, b"1234").unwrap().unwrap();
        let child = root.join("worker");
        register(&child, 10).unwrap();
        write(&child.join("b"), b"1234567890").unwrap().unwrap();
        assert_eq!(fs::read(file).unwrap(), b"1234");
        fs::remove_dir_all(root).unwrap();
    }
}
