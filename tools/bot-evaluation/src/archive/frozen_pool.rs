use crate::frozen_match_support::{read,save,configuration,initialize,match_manifest,observe};
// Archived coordinator: one coordinator owns progress; bounded workers own disjoint match directories.
use crate::{
    frozen_evidence::{finalize, replay_record, restore},
    host::Host,
    identity,
    metrics::Metrics,
    process_memory::tree_rss,
    process_ownership::Owners,
    session_admission::{Admission, Reservation},
    xml::{self, Result},
};
use serde_json::{json, Value};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc, Mutex,
    },
    time::{Duration, Instant},
};

pub fn run(file: &Path, output: &Path, workers: usize, resume: bool) -> Result<i32> {
    let started = Instant::now();
    let job = Arc::new(read(file)?);
    let runtime = crate::application_identity::digest()?;
    let mut execution_identity = job.as_ref().clone();
    execution_identity["runtime"] = json!(runtime);
    if output.exists() && !resume {
        return Err("Evaluation output exists; use --resume".into());
    }
    fs::create_dir_all(output)?;
    let storage_root = job["storage"]["root"]
        .as_str()
        .map(PathBuf::from)
        .unwrap_or_else(|| output.to_owned());
    crate::output_storage::configure(
        &storage_root,
        job["storage"]["maxBytes"]
            .as_u64()
            .unwrap_or(crate::output_storage::DEFAULT_MAX),
        job["storage"]["controlReserveBytes"]
            .as_u64()
            .unwrap_or(crate::output_storage::CONTROL_RESERVE),
    )?;
    if !fs::canonicalize(output)?.starts_with(fs::canonicalize(&storage_root)?) {
        return Err("Storage root must contain evaluation output".into());
    }
    // Exclusive evaluation ownership survives crashes for explicit operator recovery.
    let lock = output.join("runner.lock");
    fs::create_dir(&lock).map_err(|e| format!("Evaluation locked at {}: {e}", lock.display()))?;
    struct Lock(PathBuf);
    impl Drop for Lock {
        fn drop(&mut self) {
            let _ = fs::remove_dir(&self.0);
        }
    }
    let _lock = Lock(lock);
    let meta = output.join("execution.json");
    let startup_resume = resume
        && !meta.exists()
        && output.join("result.json").is_file()
        && read(&output.join("result.json"))?["stoppingReason"] == "max-output-bytes"
        && read(&output.join("result.json"))?["completedGames"] == 0
        && !output.join("matches").exists();
    if resume && !startup_resume {
        if read(&meta)? != execution_identity {
            return Err("Resume runtime/input identity mismatch".into());
        }
    } else {
        if let Err(e) = save(&meta, &execution_identity) {
            if !e.to_string().starts_with("max-output-bytes:") {
                return Err(e);
            }
            save(
                &output.join("result.json"),
                &json!({"schemaVersion":1,"status":"interrupted","stoppingReason":"max-output-bytes","completedGames":0,"failedGames":0,"skippedGames":0,"matches":0,"elapsedMs":0}),
            )?;
            return Ok(2);
        }
    }
    let previous = if resume && !startup_resume {
        read(&output.join("progress.json"))?
    } else {
        json!({"reservedGames":0,"elapsedMs":0})
    };
    let mut reserved = previous["reservedGames"].as_u64().unwrap_or(0);
    let previous_ms = previous["elapsedMs"].as_f64().unwrap_or(0.0);
    let stop = Arc::new(AtomicBool::new(false));
    let signal = stop.clone();
    ctrlc::set_handler(move || signal.store(true, Ordering::SeqCst))?;
    let memory_done = Arc::new(AtomicBool::new(false));
    let memory_signal = memory_done.clone();
    let memory = std::thread::spawn(move || {
        let mut peak = 0;
        while !memory_signal.load(Ordering::SeqCst) {
            peak = peak.max(tree_rss());
            std::thread::sleep(Duration::from_millis(100));
        }
        peak
    });
    let owners = Arc::new(Mutex::new(Owners::start(output, resume)?));
    let mut admission = if job["sessionControl"].is_object() {
        Some(Admission::start(&job["sessionControl"])?)
    } else {
        None
    };
    if let Some(control) = admission.as_ref() {
        owners.lock().unwrap().register(control.pid())?;
    }
    let items = job["matches"].as_array().ok_or("Missing matches")?;
    let mut unique = BTreeSet::new();
    for item in items {
        let id = item["match"]["id"].as_str().ok_or("Missing match id")?;
        if !id.starts_with("match-")
            || !id[6..].chars().all(|c| c.is_ascii_digit())
            || !unique.insert(id.to_owned())
            || item["match"]["games"]
                .as_array()
                .is_none_or(|g| g.len() != 4)
        {
            return Err("Duplicate/unsafe match identity or invalid four-game schedule".into());
        }
    }
    let workers = workers
        .max(1)
        .min(std::thread::available_parallelism()?.get())
        .min(items.len().max(1));
    let (tx, rx) = mpsc::sync_channel::<(Value, u64)>(workers);
    let rx = Arc::new(Mutex::new(rx));
    let (results, done) = mpsc::sync_channel(workers);
    let mut metrics = Metrics::default();
    let mut completed = BTreeSet::new();
    let mut replay = BTreeMap::new();
    let mut completed_latencies = Vec::<f64>::new();
    let mut pending = vec![];
    for item in items {
        let id = item["match"]["id"].as_str().ok_or("Missing match id")?;
        let base = output.join("matches").join(id);
        let manifest = match_manifest(&job, item, &runtime);
        if base.join("done.json").exists() {
            let (record, reports) = restore(&base, &manifest, id)?;
            if record["status"] == "completed" {
                if let Ok(t) = read(&base.join("latency.json")) {
                    if let Some(ms) = t["elapsedMs"].as_f64() {
                        completed_latencies.push(ms);
                    }
                }
            }
            observe(&mut metrics, &record, &reports);
            replay.insert(id.to_owned(), replay_record(&record, &reports));
            completed.insert(id.to_owned());
        } else {
            pending.push(item.clone());
        }
    }
    if pending.is_empty() {
        memory_done.store(true, Ordering::SeqCst);
        let _ = memory.join();
        println!("{}", output.display());
        return Ok(if metrics.incomplete == 0 { 0 } else { 2 });
    }
    let max_games = if admission.is_some() {
        job["sessionControl"]["maxGamesOverride"]
            .as_u64()
            .unwrap_or(u64::MAX)
    } else {
        job["budget"]["maxGames"].as_u64().unwrap_or(u64::MAX)
    };
    let max_wall = if admission.is_some() {
        job["sessionControl"]["maxWallMsOverride"]
            .as_f64()
            .unwrap_or(f64::MAX)
    } else {
        job["budget"]["maxWallMs"].as_f64().unwrap_or(f64::MAX)
    };
    let mut error: Option<String> = None;
    let mut last_poll = Instant::now();
    std::thread::scope(|scope| {
        for _ in 0..workers {
            let rx = rx.clone();
            let results = results.clone();
            let stop = stop.clone();
            let job = job.clone();
            let runtime = &runtime;
            let owners = owners.clone();
            scope.spawn(move || {
                let mut host: Option<Host> = None;
                loop {
                    let (item, attempt) = match rx.lock().unwrap().recv() {
                        Ok(v) => v,
                        Err(_) => break,
                    };
                    let id = item["match"]["id"].as_str().unwrap().to_owned();
                    let base = output.join("matches").join(&id);
                    let match_start=Instant::now();
                    let result = (|| -> Result<(Value, [Value; 2], PathBuf)> {
                        if base.exists() {
                            fs::create_dir_all(output.join("attempts"))?;
                            fs::rename(
                                &base,
                                output.join("attempts").join(format!(
                                    "{id}-{}",
                                    time::OffsetDateTime::now_utc().unix_timestamp_nanos()
                                )),
                            )?;
                        }
                        let c = configuration(&job, &item, &base);
                        if host.is_none() {
                            host = Some(Host::start()?);
                            owners
                                .lock()
                                .unwrap()
                                .register(host.as_ref().unwrap().pid())?;
                        }
                        let active = host.as_mut().unwrap();
                        let ready = initialize(active, &job, &item, &c)?;
                        let manifest = match_manifest(&job, &item, runtime);
                        let evidence_result = crate::frozen_match::execute(
                            &c, active, &ready, &manifest, &base, &stop,
                            &mut |host| {
                                host.kill();
                                *host = Host::start()?;
                                owners.lock().unwrap().register(host.pid())?;
                                initialize(host, &job, &item, &c)
                            },
                        );
                        let evidence=match evidence_result {
                            Ok(evidence)=>evidence,
                            Err(error) if error.to_string().starts_with("max-output-bytes:")=>{
                                stop.store(true,Ordering::SeqCst);
                                let(record,reports,_,_)=crate::native_match_evidence::restore(&base)?;
                                crate::match_evidence::verify_evidence(&record,&reports,&manifest,&id)?;
                                (record,reports)
                            },
                            Err(error)=>return Err(error),
                        };
                        if !stop.load(Ordering::SeqCst){save(&base.join("latency.json"),&json!({"match":id,"elapsedMs":match_start.elapsed().as_secs_f64()*1000.0,"completed":evidence.0["status"]=="completed","boundary":"Worker start before host initialization through all four games, sideboarding, canonical verification and durable logs; excludes admission queue, latency/commit marker metadata and coordinator settlement."}))?;}
                        if !stop.load(Ordering::SeqCst) {
                            finalize(&base)?;
                        }
                        // Failed/terminated hosts never poison the next independent match.
                        if evidence.0["status"] != "completed" {
                            host.take();
                        }
                        let mut persisted = base.clone();
                        if stop.load(Ordering::SeqCst) {
                            fs::create_dir_all(output.join("attempts"))?;
                            persisted = output.join("attempts").join(format!(
                                "{id}-attempt-{attempt}-{}",
                                time::OffsetDateTime::now_utc().unix_timestamp_nanos()
                            ));
                            fs::rename(&base, &persisted)?;
                        }
                        Ok((evidence.0, evidence.1, persisted))
                    })()
                    .map_err(|e| e.to_string());
                    let result=match result {
                        Err(ref message) if message.starts_with("max-output-bytes:")=>{
                            stop.store(true,Ordering::SeqCst);
                            match crate::native_match_evidence::restore(&base) {
                                Ok((record,reports,_,_))=>{
                                    let recovered=(||->Result<(Value,[Value;2],PathBuf)>{
                                        crate::match_evidence::verify_evidence(&record,&reports,&match_manifest(&job,&item,runtime),&id)?;
                                        fs::create_dir_all(output.join("attempts"))?;
                                        let archive=output.join("attempts").join(format!("{id}-storage-attempt-{attempt}-{}",time::OffsetDateTime::now_utc().unix_timestamp_nanos()));
                                        fs::rename(&base,&archive)?;
                                        Ok((record,reports,archive))
                                    })();
                                    recovered.map_err(|e|e.to_string())
                                },Err(_)=>result,
                            }
                        },_=>result,
                    };
                    let interrupted = stop.load(Ordering::SeqCst) || result.as_ref().err().is_some_and(|e|e.starts_with("max-output-bytes:"));
                    if interrupted{stop.store(true,Ordering::SeqCst);}
                    if results.send((id, attempt, result, interrupted)).is_err() {
                        break;
                    }
                }
                drop(host);
                crate::evidence_writer::shutdown();
            });
        }
        drop(results);
        let mut next = pending.into_iter().peekable();
        let mut active = 0;
        loop {
            if crate::output_storage::exhausted(&storage_root) {
                stop.store(true, Ordering::SeqCst);
            }
            while active < workers
                && !crate::output_storage::exhausted(&storage_root)
                && !stop.load(Ordering::SeqCst)
                && reserved.saturating_add(4) <= max_games
                && previous_ms + started.elapsed().as_secs_f64() * 1000.0 < max_wall
            {
                let Some(item) = next.peek().cloned() else {
                    break;
                };
                let id = item["match"]["id"].as_str().unwrap();
                let attempt = if let Some(control) = admission.as_mut() {
                    let base = output.join("matches").join(id);
                    let recovered = if resume && base.exists() && !base.join("done.json").exists() {
                        match crate::native_match_evidence::restore(&base) {
                            Ok((record, [a, b], _, _)) => {
                                if crate::match_evidence::verify_evidence(
                                    &record,
                                    &[a, b],
                                    &match_manifest(&job, &item, &runtime),
                                    id,
                                )
                                .is_ok()
                                {
                                    let archive = output.join("attempts").join(format!(
                                        "{id}-recovered-{}",
                                        time::OffsetDateTime::now_utc().unix_timestamp_nanos()
                                    ));
                                    if let Err(e) = fs::create_dir_all(output.join("attempts"))
                                        .and_then(|_| fs::rename(&base, &archive))
                                    {
                                        error = Some(e.to_string());
                                        stop.store(true, Ordering::SeqCst);
                                        break;
                                    }
                                    Some((archive, record))
                                } else {
                                    None
                                }
                            }
                            Err(_) => None,
                        }
                    } else {
                        None
                    };
                    match control.reserve(id, recovered.as_ref().map(|(p, r)| (p.as_path(), r))) {
                        Ok(Reservation::Launch(n)) => n,
                        Ok(Reservation::Wait) => break,
                        Ok(Reservation::Stop) => {
                            stop.store(true, Ordering::SeqCst);
                            break;
                        }
                        Err(e) => {
                            error = Some(e.to_string());
                            stop.store(true, Ordering::SeqCst);
                            break;
                        }
                    }
                } else {
                    1
                };
                next.next();
                reserved += 4;
                // Reserve before dispatch: interrupted attempts cannot evade the game budget.
                if let Err(e) = save(
                    &output.join("progress.json"),
                    &json!({"status":"running","reservedGames":reserved,"elapsedMs":previous_ms+started.elapsed().as_secs_f64()*1000.0,"finalizedMatches":completed}),
                ) {
                    error = Some(e.to_string());
                    stop.store(true, Ordering::SeqCst);
                    break;
                }
                if tx.send((item, attempt)).is_err() {
                    break;
                }
                active += 1;
            }
            if active == 0 {
                if next.peek().is_some()
                    && !stop.load(Ordering::SeqCst)
                    && reserved.saturating_add(4) <= max_games
                    && previous_ms + started.elapsed().as_secs_f64() * 1000.0 < max_wall
                {
                    std::thread::sleep(Duration::from_millis(100));
                    continue;
                }
                break;
            }
            match done.recv_timeout(Duration::from_millis(100)) {
                Ok((id, attempt, result, interrupted)) => {
                    if let Some(control) = admission.as_mut() {
                        let evidence = result.as_ref().ok().map(|(r, _, p)| (p.as_path(), r));
                        if let Err(e) = control.settle(&id, attempt, evidence, interrupted) {
                            error = Some(e.to_string());
                            stop.store(true, Ordering::SeqCst);
                        }
                    }
                    active -= 1;
                    match result {
                        Ok((record, reports, base)) => {
                            if record["status"] == "completed" {
                                if let Ok(t) = read(&base.join("latency.json")) {
                                    if let Some(ms) = t["elapsedMs"].as_f64() {
                                        completed_latencies.push(ms);
                                    }
                                }
                            }
                            replay.insert(id.clone(), replay_record(&record, &reports));
                            observe(&mut metrics, &record, &reports);
                            if !interrupted {
                                completed.insert(id);
                            }
                        }
                        Err(e) => {
                            error = Some(e);
                            stop.store(true, Ordering::SeqCst);
                        }
                    }
                    eprintln!(
                        "frozen matches {}/{}; games {}; failed {}; skipped {}",
                        completed.len(),
                        items.len(),
                        metrics.completed,
                        metrics.failed,
                        metrics.skipped
                    );
                    if let Err(e) = save(
                        &output.join("progress.json"),
                        &json!({"status":"running","reservedGames":reserved,"elapsedMs":previous_ms+started.elapsed().as_secs_f64()*1000.0,"finalizedMatches":completed}),
                    ) {
                        error = Some(e.to_string());
                        stop.store(true, Ordering::SeqCst);
                    }
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {}
                Err(_) => break,
            }
            if last_poll.elapsed() >= Duration::from_millis(1000) {
                if let Some(control) = admission.as_mut() {
                    match control.cancelled() {
                        Ok(true) => stop.store(true, Ordering::SeqCst),
                        Ok(false) => {}
                        Err(e) => {
                            error = Some(e.to_string());
                            stop.store(true, Ordering::SeqCst);
                        }
                    }
                }
                last_poll = Instant::now();
            }
            if previous_ms + started.elapsed().as_secs_f64() * 1000.0 >= max_wall {
                stop.store(true, Ordering::SeqCst);
            }
        }
        if stop.load(Ordering::SeqCst) {
            if let Some(control) = admission.as_mut() {
                if let Err(e) = control.stop() {
                    error = Some(e.to_string());
                }
            }
        }
        drop(tx);
    });
    memory_done.store(true, Ordering::SeqCst);
    let peak = memory.join().unwrap_or(0);
    let storage_stopped = crate::output_storage::exhausted(&storage_root);
    let status = if storage_stopped {
        "interrupted"
    } else if error.is_some() {
        "failed"
    } else if completed.len() == items.len() {
        "completed"
    } else {
        "interrupted"
    };
    metrics.elapsed = previous_ms + started.elapsed().as_secs_f64() * 1000.0;
    metrics.peak = peak;
    let summary = metrics.summary(
        job["identity"].as_str().unwrap(),
        status,
        items.len() as u64,
        0.0,
        100.0,
        json!({"bug_id":[]}),
        json!({"sample":[]}),
    );
    xml::write(&output.join("summary.xml"), "summary", &summary)?;
    let elapsed = previous_ms + started.elapsed().as_secs_f64() * 1000.0;
    save(
        &output.join("progress.json"),
        &json!({"status":status,"reservedGames":reserved,"elapsedMs":elapsed,"finalizedMatches":completed}),
    )?;
    let replay = json!(replay);
    save(&output.join("replay.json"), &replay)?;
    save(
        &output.join("result.json"),
        &json!({"schemaVersion":1,"averageCompletedMatchLatencyMs":if completed_latencies.is_empty(){None}else{Some(completed_latencies.iter().sum::<f64>()/completed_latencies.len() as f64)},"completedMatchLatencySamples":completed_latencies.len(),"amortizedWallMsPerCompletedMatch":if metrics.matches>0{Some(elapsed/metrics.matches as f64)}else{None},"replayIdentity":identity::digest(&replay),"identity":job["identity"],"fixtureIdentity":job["fixtureIdentity"],"workers":workers,"status":status,"stoppingReason":if storage_stopped{Some("max-output-bytes")}else{None},"matches":metrics.matches,"incompleteMatches":metrics.incomplete,"completedGames":metrics.completed,"failedGames":metrics.failed,"skippedGames":metrics.skipped,"failures":metrics.failures,"elapsedMs":elapsed,"gamesPerSecond":metrics.completed as f64/(elapsed/1000.0),"processTreePeakRssBytes":peak,"memorySampleMs":100,"memoryMethod":"Linux /proc summed RSS; each descendant once, shared pages may be counted in multiple processes","error":error}),
    )?;
    println!("{}", output.display());
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
