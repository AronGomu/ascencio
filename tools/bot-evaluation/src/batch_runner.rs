//! Independent v1 runner: persistent engine hosts, durable batch reservations and
//! disjoint writer allowances. Never opens or mutates the legacy session ledger.
use crate::{
    frozen_evidence::{finalize, restore},
    frozen_match_support::{configuration, initialize, match_manifest, observe, read, save},
    host::Host,
    metrics::Metrics,
    process_ownership::Owners,
    xml::Result,
};
use serde_json::{json, Value};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
fn clock() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}
struct Queue {
    items: Vec<Value>,
    owners: BTreeMap<String, usize>,
    reserved: u64,
}
pub fn run(
    file: &Path,
    output: &Path,
    workers: usize,
    batch_size: usize,
    resume: bool,
) -> Result<i32> {
    let begin = Instant::now();
    if workers == 0 || workers > std::thread::available_parallelism()?.get() || batch_size == 0 || batch_size > 256 {
        return Err("Workers must be within available logical CPUs; batch size 1–256".into());
    }
    let output = std::path::absolute(output)?;
    let job = Arc::new(read(file)?);
    let flat = job["sessionBinding"].is_object();
    if let Some(parent) = crate::output_storage::root(&output.join(".probe")) {
        let lease = read(&parent.join(".batch-output-lease.json"))?;
        if !flat
            || lease["active"] != true
            || lease["token"] != job["storageLease"]["token"]
            || parent.join(lease["evaluation"].as_str().ok_or("Missing lease path")?) != output
            || lease["maxBytes"] != job["batchStorageBytes"]
        {
            return Err("Session batch output needs a valid parent quota lease".into());
        }
    } else if flat {
        return Err("Session binding requires a parent quota lease".into());
    }
    if !job["sessionControl"].is_null() || !job["storage"].is_null() {
        return Err("Batch runner requires an independent prepared job without legacy sessionControl/storage".into());
    }
    let items = job["matches"].as_array().ok_or("Missing matches")?;
    if items.is_empty() {
        return Err("Empty schedule".into());
    }
    let mut ids = BTreeSet::new();
    for item in items {
        let id = item["match"]["id"]
            .as_str()
            .ok_or("Missing match identity")?;
        if !id.starts_with("match-")
            || id.len() == 6
            || !id[6..].chars().all(|c| c.is_ascii_digit())
            || !ids.insert(id)
            || item["match"]["games"]
                .as_array()
                .is_none_or(|g| g.len() != 4)
        {
            return Err("Unsafe/duplicate match or invalid four-game schedule".into());
        }
    }
    let workers = workers
        .min(items.len())
        .min(std::thread::available_parallelism()?.get());
    let max_bytes = job["batchStorageBytes"].as_u64().unwrap_or(20_000_000_000);
    let control_bytes = job["coordinatorReserveBytes"]
        .as_u64()
        .unwrap_or(16_000_000);
    if max_bytes <= control_bytes + workers as u64 {
        return Err("Output allowance must exceed checkpoint reserve".into());
    }
    let max_games = job["budget"]["maxGames"]
        .as_u64()
        .ok_or("Missing game budget")?;
    let max_wall = job["budget"]["maxWallMs"]
        .as_u64()
        .ok_or("Missing wall budget")?;
    if max_games == 0 || max_wall == 0 {
        return Err("Budgets must be positive".into());
    }
    if output.exists() && !resume {
        return Err("Batch output exists; use --resume".into());
    }
    if resume {
        fs::create_dir_all(&output)?;
    } else {
        fs::create_dir_all(output.parent().unwrap())?;
        fs::create_dir(&output)?;
    }
    let owner_lock = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(output.join(".batch-lock"))?;
    #[cfg(target_os = "linux")]
    {
        use std::os::fd::AsRawFd;
        if unsafe { libc::flock(owner_lock.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } != 0 {
            return Err("Batch output already owned".into());
        }
    }
    #[cfg(not(target_os = "linux"))]
    return Err("Independent runner currently requires Linux ownership locking".into());
    // Reject a live previous owner before touching its outputs.
    let runtime = crate::application_identity::digest()?;
    let mut resume_job = job.as_ref().clone();
    if flat {
        if let Some(source) = resume_job["stopSource"].as_object_mut() {
            source.remove("acknowledged");
        }
    }
    let binding = json!({"format":"independent-batch/v1","job":crate::identity::digest(&resume_job),"runtime":runtime,"workers":workers,"batchSize":batch_size,"maxBytes":max_bytes});
    let meta = output.join(if flat {
        "batch-execution.json"
    } else {
        "execution.json"
    });
    if resume && read(&meta)? != binding {
        return Err("Batch resume identity/settings changed".into());
    }
    if resume && flat {
        let public = fs::read(
            job["publicExecutionPath"]
                .as_str()
                .ok_or("Missing public execution document")?,
        )?;
        if json!(crate::identity::sha(&public)) != job["publicExecutionHash"]
            || fs::read(output.join("execution.json"))? != public
        {
            return Err("Public execution metadata changed".into());
        }
    }
    if resume {
        clean_staging(&output)?;
    }
    crate::worker_storage::register_control(&output, control_bytes, flat)?;
    let owners = Arc::new(Mutex::new(Owners::start(&output, resume)?));
    // Ownership evidence, unlike a stale directory lock, can distinguish a dead dispatcher.
    if !resume {
        save(&meta, &binding)?;
        if flat {
            let public = fs::read(
                job["publicExecutionPath"]
                    .as_str()
                    .ok_or("Missing public execution document")?,
            )?;
            if json!(crate::identity::sha(&public)) != job["publicExecutionHash"] {
                return Err("Public execution bytes changed".into());
            }
            crate::output_storage::write(&output.join("execution.json"), &public)?;
        }
        save(&output.join("run.json"), &json!({"startedAt":clock()}))?;
    }
    let started = read(&output.join("run.json"))?["startedAt"]
        .as_u64()
        .ok_or("Missing start time")?;
    let stop = Arc::new(AtomicBool::new(false));
    let signal = stop.clone();
    ctrlc::set_handler(move || signal.store(true, Ordering::SeqCst))?;
    if output.join("workers").exists() {
        let expected = (1..=workers)
            .map(|w| format!("worker-{w:04}"))
            .collect::<BTreeSet<_>>();
        for entry in fs::read_dir(output.join("workers"))? {
            let entry = entry?;
            if !entry.file_type()?.is_dir()
                || !expected.contains(entry.file_name().to_str().ok_or("Invalid worker path")?)
            {
                return Err("Unexpected worker output outside allocated scopes".into());
            }
        }
    }
    let mut completed = BTreeSet::new();
    let mut reserved = 0;
    let mut journals = vec![];
    let mut assignments = BTreeMap::new();
    let mut metrics = Metrics::default();
    let mut index = json!({});
    for worker in 0..workers {
        let root = output.join(format!("workers/worker-{:04}", worker + 1));
        if resume {
            clean_staging(&root)?;
        }
        crate::worker_storage::register(&root, (max_bytes - control_bytes) / workers as u64)?;
        let journal = if resume && root.join("journal.json").exists() {
            read(&root.join("journal.json"))?
        } else {
            json!({"reservedGames":0,"batch":[],"owned":[]})
        };
        reserved += journal["reservedGames"]
            .as_u64()
            .ok_or("Invalid worker reservations")?;
        if flat {
            for id in journal["owned"]
                .as_array()
                .ok_or("Missing worker assignments")?
            {
                let id = id.as_str().ok_or("Invalid assignment")?;
                if !ids.contains(id) || assignments.insert(id.to_owned(), worker).is_some() {
                    return Err("Duplicate/unknown match owner".into());
                }
                crate::worker_storage::alias(&output.join("matches").join(id), &root)?;
            }
        }
        save(&root.join("journal.json"), &journal)?;
        for item in items {
            let id = item["match"]["id"].as_str().unwrap();
            if flat && assignments.get(id) != Some(&worker) {
                continue;
            }
            let base = if flat {
                output.join("matches").join(id)
            } else {
                root.join("matches").join(id)
            };
            if base.join("done.json").exists() {
                if !completed.insert(id.to_owned()) {
                    return Err("Duplicate worker completion".into());
                }
                let (record, reports) = restore(&base, &match_manifest(&job, item, &runtime), id)?;
                observe(&mut metrics, &record, &reports);
                index[id] = if flat {
                    json!(format!("matches/{id}"))
                } else {
                    json!(format!("workers/worker-{:04}/matches/{id}", worker + 1))
                };
            }
        }
        journals.push((worker, root, journal));
    }
    if flat && output.join("matches").exists() {
        for entry in fs::read_dir(output.join("matches"))? {
            let entry = entry?;
            if !entry.file_type()?.is_dir()
                || !assignments
                    .contains_key(entry.file_name().to_str().ok_or("Invalid match path")?)
            {
                return Err("Unassigned match output".into());
            }
        }
    }
    let queue = Mutex::new(Queue {
        items: items
            .iter()
            .filter(|i| !completed.contains(i["match"]["id"].as_str().unwrap()))
            .cloned()
            .collect(),
        owners: assignments,
        reserved,
    });
    let metrics = Mutex::new(metrics);
    let results = Mutex::new(Vec::new());
    let done = AtomicBool::new(false);
    let monitor_stop = stop.clone();
    let monitor_output = output.clone();
    let stop_file = job["stopFile"]
        .as_str()
        .map(PathBuf::from)
        .unwrap_or_else(|| output.join("OWNER_STOP"));
    let deadline = job["sessionDeadlineMs"].as_u64().unwrap_or(u64::MAX);
    let stop_source = job["stopSource"].clone();
    let error = Mutex::new(None::<String>);
    std::thread::scope(|scope| {
        let done = &done;
        let owners_monitor = owners.clone();
        let monitor = scope.spawn(move || {
            let mut peak = 0;
            let mut stopping = None;
            while !done.load(Ordering::SeqCst) {
                peak = peak.max(crate::process_memory::tree_rss());
                let owner_stop = stop_source["path"].as_str().is_some_and(|p| {
                    fs::read(p).ok().is_some_and(|bytes| {
                        json!(crate::identity::sha(bytes)) != stop_source["acknowledged"]
                    })
                });
                if owner_stop
                    || clock() >= deadline
                    || clock().saturating_sub(started) >= max_wall
                    || stop_file.exists()
                    || monitor_output.join("OWNER_STOP").exists()
                {
                    monitor_stop.store(true, Ordering::SeqCst);
                }
                if monitor_stop.load(Ordering::SeqCst) {
                    let at = stopping.get_or_insert_with(Instant::now);
                    if at.elapsed() >= Duration::from_secs(60) {
                        let _ = owners_monitor.lock().unwrap().terminate_hosts();
                    }
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            peak
        });
        let mut handles = vec![];
        for (worker, root, mut journal) in journals {
            let output = &output;
            let job = &job;
            let runtime = &runtime;
            let queue = &queue;
            let results = &results;
            let stop = &stop;
            let error = &error;
            let owners = &owners;
            let metrics = &metrics;
            handles.push(scope.spawn(move || {
                let work = (|| -> Result<()> {
                    let mut host = None;
                    loop {
                        if stop.load(Ordering::SeqCst) {
                            break;
                        }
                        let batch = {
                            let mut q = queue.lock().unwrap();
                            let n = batch_size
                                .min(items.len().div_ceil(workers))
                                .min(q.items.len())
                                .min((max_games.saturating_sub(q.reserved) / 4) as usize);
                            if n == 0 {
                                break;
                            }
                            let mut batch = vec![];
                            for _ in 0..n {
                                let Some(at) = q.items.iter().position(|i| {
                                    q.owners
                                        .get(i["match"]["id"].as_str().unwrap())
                                        .is_none_or(|owner| *owner == worker)
                                }) else {
                                    break;
                                };
                                let item = q.items.remove(at);
                                let id = item["match"]["id"].as_str().unwrap();
                                q.owners.insert(id.to_owned(), worker);
                                if flat
                                    && !journal["owned"].as_array().unwrap().iter().any(|v| v == id)
                                {
                                    journal["owned"].as_array_mut().unwrap().push(json!(id));
                                }
                                batch.push(item);
                            }
                            if batch.is_empty() {
                                break;
                            }
                            let n = batch.len();
                            journal["reservedGames"] =
                                json!(journal["reservedGames"].as_u64().unwrap() + n as u64 * 4);
                            journal["batch"] = json!(batch
                                .iter()
                                .map(|i| i["match"]["id"].clone())
                                .collect::<Vec<_>>());
                            save(&root.join("journal.json"), &journal)?;
                            if flat {
                                for item in &batch {
                                    crate::worker_storage::alias(
                                        &output
                                            .join("matches")
                                            .join(item["match"]["id"].as_str().unwrap()),
                                        &root,
                                    )?;
                                }
                            }
                            q.reserved += n as u64 * 4;
                            batch
                        };
                        for item in batch {
                            if stop.load(Ordering::SeqCst) {
                                break;
                            }
                            let id = item["match"]["id"].as_str().unwrap();
                            let base = if flat {
                                output.join("matches").join(id)
                            } else {
                                root.join("matches").join(id)
                            };
                            // Interrupted evidence remains charged and retained, never overwritten.
                            if base.exists() {
                                fs::create_dir_all(root.join("attempts"))?;
                                fs::rename(
                                    &base,
                                    root.join("attempts").join(format!("{id}-{}", clock())),
                                )?;
                            }
                            let c = configuration(job, &item, &base);
                            if host.is_none() {
                                host = Some(Host::start()?);
                                owners
                                    .lock()
                                    .unwrap()
                                    .register(host.as_ref().unwrap().pid())?;
                            }
                            let active = host.as_mut().unwrap();
                            let ready = initialize(active, job, &item, &c)?;
                            let manifest = match_manifest(job, &item, runtime);
                            let (record, reports) = crate::frozen_match::execute(
                                &c,
                                active,
                                &ready,
                                &manifest,
                                &base,
                                stop,
                                &mut |h| {
                                    h.kill();
                                    *h = Host::start()?;
                                    owners.lock().unwrap().register(h.pid())?;
                                    initialize(h, job, &item, &c)
                                },
                            )?;
                            if stop.load(Ordering::SeqCst) {
                                break;
                            }
                            finalize(&base)?;
                            observe(&mut metrics.lock().unwrap(), &record, &reports);
                            results.lock().unwrap().push((id.to_owned(), base));
                            if record["status"] != "completed" {
                                host.take();
                            }
                        }
                        journal["batch"] = json!([]);
                        save(&root.join("journal.json"), &journal)?;
                    }
                    Ok(())
                })();
                if let Err(e) = work {
                    *error.lock().unwrap() = Some(e.to_string());
                    stop.store(true, Ordering::SeqCst);
                }
            }));
        }
        for handle in handles {
            if handle.join().is_err() {
                *error.lock().unwrap() = Some("Worker panicked".into());
                stop.store(true, Ordering::SeqCst);
            }
        }
        done.store(true, Ordering::SeqCst);
        metrics.lock().unwrap().peak = monitor.join().unwrap_or(0);
    });
    let mut metrics = metrics.into_inner().unwrap();
    for (id, base) in results.into_inner().unwrap() {
        completed.insert(id.clone());
        index[&id] = json!(base.strip_prefix(&output)?.to_string_lossy());
    }
    metrics.elapsed = begin.elapsed().as_secs_f64() * 1000.
        + if resume && output.join("result.json").exists() {
            read(&output.join("result.json"))?["elapsedMs"]
                .as_f64()
                .unwrap_or(0.)
        } else {
            0.
        };
    let error = error.into_inner().unwrap();
    let storage_stop = error
        .as_ref()
        .is_some_and(|e| e.starts_with("max-output-bytes:"));
    let status = if storage_stop {
        "interrupted"
    } else if error.is_some() {
        "failed"
    } else if completed.len() == items.len() {
        "completed"
    } else {
        "interrupted"
    };
    let result = json!({"schemaVersion":1,"runner":"independent-batch/v1","status":status,"identity":job["identity"],"workers":workers,"batchSize":batch_size,"matches":metrics.matches,"completedGames":metrics.completed,"failedGames":metrics.failed,"skippedGames":metrics.skipped,"reservedGames":queue.into_inner().unwrap().reserved,"elapsedMs":metrics.elapsed,"gamesPerSecond":metrics.completed as f64/(metrics.elapsed/1000.),"processTreePeakRssBytes":metrics.peak,"stoppingReason":if storage_stop{Some("max-output-bytes")}else if clock()>=deadline || clock().saturating_sub(started)>=max_wall{Some("max-wall-ms")}else if completed.len()!=items.len() && !stop.load(Ordering::SeqCst){Some("max-games")}else if stop.load(Ordering::SeqCst){Some("cancelled")}else{None},"error":error});
    save(&output.join("matches.json"), &index)?;
    save(&output.join("result.json"), &result)?;
    println!("{result}");
    Ok(
        if status == "completed"
            && metrics.skipped == 0
            && metrics.failures.keys().all(|k| k == "timeout")
        {
            0
        } else {
            2
        },
    )
}
fn clean_staging(root: &Path) -> Result<()> {
    if !root.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(root)? {
        let p = entry?.path();
        let meta = fs::symlink_metadata(&p)?;
        if meta.file_type().is_symlink() {
            return Err("Worker output symlink".into());
        }
        if meta.is_dir() {
            clean_staging(&p)?;
        } else if p
            .file_name()
            .unwrap()
            .to_string_lossy()
            .ends_with(".batch-stage")
        {
            fs::remove_file(&p)?;
            fs::File::open(root)?.sync_all()?;
        }
    }
    Ok(())
}
