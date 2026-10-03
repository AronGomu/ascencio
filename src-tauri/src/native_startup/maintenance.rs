//! Explicit maintenance of the bundled, digest-pinned package selection.
//! A change is durable for the next startup; current metadata/media handles stay fixed.
use super::*;
use serde_json::json;

pub(super) struct Installed {
    pub selected: Vec<String>,
    pub catalog: Vec<Value>,
    pub trusted: Vec<PackResource>,
    pub selection_path: PathBuf,
    pub root: PathBuf,
}
pub(super) fn generation(selected: &[String]) -> u64 {
    let mut ordered = selected.to_vec();
    ordered.sort();
    u64::from_str_radix(&digest(ordered.join("\n").as_bytes())[..12], 16).unwrap()
}
pub(super) fn active_pack(pack: &PackResource, manifest: &Value) -> Value {
    let mut value = manifest.clone();
    value["fileKey"] = json!(format!("snapshot:{}", pack.package_id));
    value["bytes"] = json!(pack.bytes);
    value["sha256"] = json!(pack.sha256);
    value
}
fn required(selected: &[String], trusted: &[PackResource]) -> Result<(), String> {
    if selected.len() > 64
        || selected.iter().enumerate().any(|(i, id)| {
            selected[..i].contains(id) || !trusted.iter().any(|pack| &pack.package_id == id)
        })
    {
        return Err("PACKAGE_INVALID".into());
    }
    // Core routes must remain repairable through the bundled application.
    if ["duel-core", "card-library", "freeplay"]
        .iter()
        .any(|id| !selected.iter().any(|selected| selected == id))
    {
        return Err("PACKAGE_REFERENCED".into());
    }
    Ok(())
}
pub(super) fn read_selection(path: &Path, trusted: &[PackResource]) -> Result<Vec<String>, String> {
    let _read = native_io_trace::start(Category::Registry, Operation::Read, "critical-selection");
    let selected: Vec<String> = match fs::File::open(path) {
        Ok(file) => {
            let mut bytes = Vec::new();
            file.take(16 * 1024 + 1)
                .read_to_end(&mut bytes)
                .map_err(|e| e.to_string())?;
            if bytes.len() > 16 * 1024 {
                return Err("PACKAGE_INVALID".into());
            }
            serde_json::from_slice(&bytes)
                .map_err(|e| format!("PACKAGE_INVALID: {}: {e}", path.display()))?
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            trusted.iter().map(|p| p.package_id.clone()).collect()
        }
        Err(error) => return Err(format!("PACKAGE_INVALID: {}: {error}", path.display())),
    };
    required(&selected, trusted)?;
    Ok(selected)
}
fn stack(installed: &Installed) -> Value {
    json!({"generation": generation(&installed.selected), "packages": installed.catalog.iter()
        .filter(|p| installed.selected.iter().any(|id| p["packageId"] == *id)).collect::<Vec<_>>()})
}
fn activate(installed: &mut Installed, selected: Vec<String>) -> Result<(), String> {
    required(&selected, &installed.trusted)?;
    for pack in installed
        .catalog
        .iter()
        .filter(|p| selected.iter().any(|id| p["packageId"] == *id))
    {
        if pack["dependencies"].as_array().is_some_and(|dependencies| {
            dependencies
                .iter()
                .any(|dependency| !selected.iter().any(|id| dependency["packageId"] == *id))
        }) {
            return Err("PACKAGE_REFERENCED".into());
        }
    }
    let temporary = installed
        .selection_path
        .with_extension(format!("{}.partial", uuid::Uuid::new_v4()));
    let _write = native_io_trace::start(
        Category::Maintenance,
        Operation::Write,
        "critical-selection-activation",
    );
    let result = (|| -> std::io::Result<()> {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        file.write_all(&serde_json::to_vec(&selected)?)?;
        file.sync_all()?;
        drop(file);
        fs::rename(&temporary, &installed.selection_path)?;
        #[cfg(unix)]
        fs::File::open(installed.selection_path.parent().unwrap())?.sync_all()?;
        Ok(())
    })();
    let _ = fs::remove_file(&temporary);
    result.map_err(|e| format!("STORAGE_UNAVAILABLE: {e}"))?;
    installed.selected = selected;
    Ok(())
}
fn operate(
    installed: &mut Installed,
    operation: &str,
    expected: u64,
    package_id: &str,
    sources: Vec<String>,
) -> Result<Value, String> {
    if expected != generation(&installed.selected) {
        return Err("STORAGE_CONFLICT".into());
    }
    match operation {
        "import" => {
            if sources.is_empty() || sources.len() > 64 {
                return Err("PACKAGE_SOURCE_INCOMPLETE".into());
            }
            if sources.iter().map(|s| s.len() as u64).sum::<u64>() > 256 * 1024 * 1024 {
                return Err("PACKAGE_INVALID".into());
            }
            let mut selected = installed.selected.clone();
            let mut verified = Vec::new();
            for source in sources {
                if source.len() as u64 > MAX_CRITICAL {
                    return Err("PACKAGE_INVALID".into());
                }
                let value: Value = serde_json::from_str(&source).map_err(|_| "PACKAGE_INVALID")?;
                let id = value["manifest"]["packageId"]
                    .as_str()
                    .ok_or("PACKAGE_INVALID")?;
                let trusted = installed
                    .trusted
                    .iter()
                    .find(|p| p.package_id == id)
                    .ok_or("PACKAGE_INTEGRITY_FAILED")?;
                if source.len() as u64 != trusted.bytes
                    || digest(source.as_bytes()) != trusted.sha256
                {
                    return Err("PACKAGE_INTEGRITY_FAILED".into());
                }
                verified.push((trusted.path.clone(), source.into_bytes()));
                if !installed.catalog.iter().any(|p| p["packageId"] == id) {
                    installed
                        .catalog
                        .push(active_pack(trusted, &value["manifest"]));
                }
                if !selected.iter().any(|p| p == id) {
                    selected.push(id.into());
                }
            }
            // All candidate bytes are authenticated before writing any application-owned snapshot.
            for (path, bytes) in verified {
                let target = installed.root.join(path);
                fs::create_dir_all(target.parent().ok_or("PACKAGE_INVALID")?)
                    .map_err(|e| e.to_string())?;
                let temporary = target.with_extension(format!("{}.partial", uuid::Uuid::new_v4()));
                let result = (|| -> std::io::Result<()> {
                    let mut file = fs::OpenOptions::new()
                        .write(true)
                        .create_new(true)
                        .open(&temporary)?;
                    file.write_all(&bytes)?;
                    file.sync_all()?;
                    drop(file);
                    fs::rename(&temporary, &target)?;
                    #[cfg(unix)]
                    fs::File::open(target.parent().unwrap())?.sync_all()?;
                    Ok(())
                })();
                let _ = fs::remove_file(&temporary);
                result.map_err(|e| format!("STORAGE_UNAVAILABLE: {e}"))?;
            }
            activate(installed, selected)?;
            Ok(stack(installed))
        }
        "remove" => {
            if !installed.selected.iter().any(|id| id == package_id) {
                return Err("PACKAGE_NOT_FOUND".into());
            }
            let selected = installed
                .selected
                .iter()
                .filter(|id| *id != package_id)
                .cloned()
                .collect();
            activate(installed, selected)?;
            Ok(json!({"stack": stack(installed), "cleanupPending": false}))
        }
        "verify" => {
            for pack in installed
                .trusted
                .iter()
                .filter(|p| installed.selected.contains(&p.package_id))
            {
                read_verified(
                    &installed.root,
                    &Resource {
                        path: pack.path.clone(),
                        bytes: pack.bytes,
                        sha256: pack.sha256.clone(),
                    },
                    MAX_CRITICAL,
                    Category::Maintenance,
                )?;
            }
            Ok(stack(installed))
        }
        // Retain complete trusted generations for repair/rollback. No media or saves are deleted.
        "cleanup" => Ok(json!({"removedFiles": 0, "remainingFiles": 0})),
        _ => Err("RPC_INVALID".into()),
    }
}
#[tauri::command]
pub(crate) async fn native_critical_maintenance(
    state: tauri::State<'_, StartupState>,
    session_id: String,
    operation: String,
    expected_generation: u64,
    package_id: Option<String>,
    sources: Option<Vec<String>>,
) -> Result<Value, String> {
    let current = session(&state, &session_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        cancelled(&current)?;
        let mut data = current.data.lock().map_err(|e| e.to_string())?;
        let installed = data.maintenance.as_mut().ok_or("STARTUP_NOT_PREPARED")?;
        operate(
            installed,
            &operation,
            expected_generation,
            package_id.as_deref().unwrap_or(""),
            sources.unwrap_or_default(),
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maintenance_authenticates_import_and_preserves_current_data_until_restart() {
        let root =
            std::env::temp_dir().join(format!("ascencio-maintenance-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let ids = ["duel-core", "card-library", "freeplay", "chapter-01"];
        let sources = ids.map(|id| {
            serde_json::to_string(&json!({"manifest": {"packageId": id, "dependencies": []}}))
                .unwrap()
        });
        let trusted = ids
            .iter()
            .zip(&sources)
            .map(|(id, bytes)| PackResource {
                package_id: id.to_string(),
                version: "1.0.0".into(),
                path: format!("{id}/critical.json"),
                bytes: bytes.len() as u64,
                sha256: digest(bytes.as_bytes()),
            })
            .collect::<Vec<_>>();
        let catalog = trusted
            .iter()
            .zip(&sources)
            .map(|(p, bytes)| {
                active_pack(
                    p,
                    &serde_json::from_str::<Value>(bytes).unwrap()["manifest"],
                )
            })
            .collect();
        let mut installed = Installed {
            selected: ids.iter().map(|id| id.to_string()).collect(),
            catalog,
            trusted,
            selection_path: root.join("selection.json"),
            root: root.clone(),
        };
        fs::write(root.join("user-data.json"), b"saved").unwrap();
        let before = generation(&installed.selected);
        assert!(operate(&mut installed, "remove", before, "duel-core", vec![]).is_err());
        operate(&mut installed, "remove", before, "chapter-01", vec![]).unwrap();
        assert_eq!(
            read_selection(&installed.selection_path, &installed.trusted)
                .unwrap()
                .len(),
            3
        );
        assert!(operate(
            &mut installed,
            "import",
            before,
            "",
            vec![sources[3].clone()]
        )
        .is_err());
        let next = generation(&installed.selected);
        assert!(operate(
            &mut installed,
            "import",
            next,
            "",
            vec![sources[3].clone() + " "]
        )
        .is_err());
        assert_eq!(installed.selected.len(), 3);
        operate(&mut installed, "import", next, "", vec![sources[3].clone()]).unwrap();
        assert_eq!(installed.selected.len(), 4);
        assert_eq!(
            fs::read(root.join("chapter-01/critical.json")).unwrap(),
            sources[3].as_bytes()
        );
        assert_eq!(fs::read(root.join("user-data.json")).unwrap(), b"saved");
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn explicit_repair_authenticates_before_replacement_and_retains_prior_bytes() {
        let root = std::env::temp_dir().join(format!("ascencio-repair-{}", uuid::Uuid::new_v4()));
        let bundle = root.join("bundle");
        let app = root.join("app");
        fs::create_dir_all(&bundle).unwrap();
        let prior = app.join("critical-generations/test");
        fs::create_dir_all(&prior).unwrap();
        fs::write(prior.join("critical.json"), b"previous").unwrap();
        fs::write(app.join("user-data.json"), b"saved").unwrap();
        fs::write(bundle.join("critical.json"), b"wrong").unwrap();
        let release = || Release {
            schema_version: 1,
            compiler_version: 1,
            packages: vec![PackResource {
                package_id: "freeplay".into(),
                version: "1.0.0".into(),
                path: "critical.json".into(),
                bytes: 8,
                sha256: digest(b"verified"),
            }],
            engine: vec![],
        };
        assert!(repair_release(&bundle, &app, release(), "test".into()).is_err());
        assert_eq!(fs::read(prior.join("critical.json")).unwrap(), b"previous");
        fs::write(bundle.join("critical.json"), b"verified").unwrap();
        repair_release(&bundle, &app, release(), "test".into()).unwrap();
        assert_eq!(fs::read(prior.join("critical.json")).unwrap(), b"verified");
        let quarantined = fs::read_dir(app.join("critical-generations"))
            .unwrap()
            .filter_map(Result::ok)
            .find(|p| p.file_name().to_string_lossy().ends_with(".quarantine"))
            .unwrap()
            .path();
        assert_eq!(
            fs::read(quarantined.join("critical.json")).unwrap(),
            b"previous"
        );
        assert_eq!(fs::read(app.join("user-data.json")).unwrap(), b"saved");
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn selection_never_authorizes_unpinned_content_or_removing_core() {
        let trusted =
            ["duel-core", "card-library", "freeplay", "chapter-01"].map(|id| PackResource {
                package_id: id.into(),
                version: "1.0.0".into(),
                path: format!("{id}/critical.json"),
                bytes: 1,
                sha256: "0".repeat(64),
            });
        let ids = trusted
            .iter()
            .map(|p| p.package_id.clone())
            .collect::<Vec<_>>();
        assert!(required(&ids, &trusted).is_ok());
        assert!(required(&ids[..2], &trusted).is_err());
        let mut bad = ids.clone();
        bad.push("chapter-untrusted".into());
        assert!(required(&bad, &trusted).is_err());
        let mut reversed = ids.clone();
        reversed.reverse();
        assert_eq!(generation(&ids), generation(&reversed));
    }
}

fn repair(bundle: &Path, app: &Path) -> Result<(), String> {
    let release: Release =
        serde_json::from_str(TRUSTED_RELEASE).map_err(|_| "BASE_RELEASE_UNAVAILABLE")?;
    repair_release(bundle, app, release, digest(TRUSTED_RELEASE.as_bytes()))
}
fn repair_release(
    bundle: &Path,
    app: &Path,
    release: Release,
    identity: String,
) -> Result<(), String> {
    let target = app.join("critical-generations").join(identity);
    let temporary = target.with_extension(format!("{}.partial", uuid::Uuid::new_v4()));
    fs::create_dir_all(&temporary).map_err(|e| e.to_string())?;
    let result = (|| -> Result<(), String> {
        let resources = release
            .packages
            .iter()
            .map(|p| Resource {
                path: p.path.clone(),
                bytes: p.bytes,
                sha256: p.sha256.clone(),
            })
            .chain(release.engine.iter().cloned());
        for resource in resources {
            let bytes = read_verified(bundle, &resource, MAX_CRITICAL, Category::Maintenance)?;
            let file_path = temporary.join(&resource.path);
            fs::create_dir_all(file_path.parent().unwrap()).map_err(|e| e.to_string())?;
            let mut file = fs::OpenOptions::new()
                .create_new(true)
                .write(true)
                .open(file_path)
                .map_err(|e| e.to_string())?;
            file.write_all(&bytes)
                .and_then(|_| file.sync_all())
                .map_err(|e| e.to_string())?;
        }
        if target.join(".media-install-attempted").exists() {
            fs::write(temporary.join(".media-install-attempted"), b"1\n")
                .map_err(|e| e.to_string())?;
        }
        // Retain the old bytes for inspection. Only application-owned critical files move.
        let previous = target.with_extension(format!("{}.quarantine", uuid::Uuid::new_v4()));
        let existed = target.exists();
        if existed {
            fs::rename(&target, &previous).map_err(|e| e.to_string())?;
        }
        if let Err(error) = fs::rename(&temporary, &target) {
            if existed {
                let _ = fs::rename(&previous, &target);
            }
            return Err(error.to_string());
        }
        #[cfg(unix)]
        fs::File::open(target.parent().unwrap())
            .and_then(|file| file.sync_all())
            .map_err(|e| e.to_string())?;
        Ok(())
    })();
    let _ = fs::remove_dir_all(&temporary);
    result
}

#[tauri::command]
pub(crate) async fn native_startup_repair(
    handle: tauri::AppHandle,
    state: tauri::State<'_, StartupState>,
) -> Result<(), String> {
    let current = Arc::new(Session {
        id: uuid::Uuid::new_v4().to_string(),
        cancelled: Arc::new(AtomicBool::new(false)),
        data: Mutex::new(Data::default()),
    });
    let token = current.id.clone();
    {
        let mut slot = state.0.lock().map_err(|e| e.to_string())?;
        if slot.is_some() {
            return Err("APP_SESSION_ACTIVE".into());
        }
        *slot = Some(current);
    }
    let result = tauri::async_runtime::spawn_blocking(move || {
        let bundle = handle
            .path()
            .resolve("readable-content", tauri::path::BaseDirectory::Resource)
            .map_err(|e| e.to_string())?;
        let app = handle.path().app_data_dir().map_err(|e| e.to_string())?;
        repair(&bundle, &app)
    })
    .await
    .map_err(|e| e.to_string())
    .and_then(|result| result);
    let mut slot = state.0.lock().map_err(|e| e.to_string())?;
    if slot.as_ref().is_some_and(|s| s.id == token) {
        *slot = None;
    }
    result
}
