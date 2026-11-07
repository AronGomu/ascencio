//! One coordinator owns progress; bounded workers own disjoint match directories.
use crate::{
    config::{self, Config},
    frozen_evidence::{finalize, replay_record, restore},
    host::Host,
    identity,
    metrics::Metrics,
    process_memory::tree_rss,
    runtime_identity::now,
    xml::{self, Result},
};
use serde_json::{json, Value};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc, Mutex,
    },
    time::{Duration, Instant},
};

pub fn save(path: &Path, value: &Value) -> Result<()> {
    fs::create_dir_all(path.parent().ok_or("Missing parent")?)?;
    let temporary = path.with_extension("json.tmp");
    let mut file = fs::File::create(&temporary)?;
    file.write_all(&serde_json::to_vec_pretty(value)?)?;
    file.sync_all()?;
    fs::rename(temporary, path)?;
    fs::File::open(path.parent().unwrap())?.sync_all()?;
    Ok(())
}
pub(crate) fn read(path: &Path) -> Result<Value> {
    Ok(serde_json::from_slice(&fs::read(path)?)?)
}
fn configuration(job: &Value, item: &Value, output: &Path) -> Config {
    Config {
        doc: json!({"batch":{"matches":1,"execution":"frozen"}}),
        deck: item["decks"][0].clone(),
        bots: json!([]),
        snapshot: PathBuf::from(job["content"].as_str().unwrap()),
        banlist: PathBuf::from(job["banlist"].as_str().unwrap()),
        rules: job["rules"].clone(),
        profile: job["profile"].as_str().unwrap().into(),
        matches: 1,
        limits: job["limits"].clone(),
        output: output.to_owned(),
        fixture: None,
        target: 100.0,
        frozen: Some(item.clone()),
    }
}
fn initialize(host: &mut Host, job: &Value, item: &Value, c: &Config) -> Result<Value> {
    host.send(
        &json!({"type":"initialize","snapshot":c.snapshot,"codes":[],"bots":[],
        "frozen":{"bots":item["bots"],"engine":job["engine"]}}),
    )?;
    loop {
        let ready = host.receive(Duration::from_secs(120))?;
        match ready["type"].as_str() {
            Some("diagnostic") => continue,
            Some("ready") => {
                for d in item["decks"].as_array().ok_or("Missing decks")? {
                    config::validate_deck(d, &ready["cards"], &c.rules)?;
                }
                return Ok(ready);
            }
            _ => return Err(format!("Frozen host initialization: {ready}").into()),
        }
    }
}
fn match_manifest(job: &Value, item: &Value, runtime: &str) -> Value {
    let bots = json!({"a":{"artifact_sha256":item["identities"][0]},"b":{"artifact_sha256":item["identities"][1]}});
    json!({"run_id":job["identity"],"created_at":now(),"application_revision":env!("CARGO_PKG_VERSION"),
        "runtime_sha256":runtime,"runtime":{},"engine":{"sha256":job["engineHash"]},
        "content":{"sha256":job["fixtureIdentity"]},"rules":{"profile":job["profile"]},
        "deck":config::deck_doc(&item["decks"][0]),"bots":bots,"configuration":{"batch":{"matches":1}},
        "identity_sha256":identity::digest(&json!([job["identity"],item,runtime]))})
}
fn observe(metrics: &mut Metrics, record: &Value, reports: &[Value; 2]) {
    for (i, g) in xml::items(&record["games"], "game").iter().enumerate() {
        metrics.game(
            g,
            &[
                reports[0]["games"]["game"][i].clone(),
                reports[1]["games"]["game"][i].clone(),
            ],
        );
    }
    for r in reports {
        metrics.sideboard(r);
    }
    metrics.finish_match(record);
}
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
    if resume {
        if read(&meta)? != execution_identity {
            return Err("Resume runtime/input identity mismatch".into());
        }
    } else {
        save(&meta, &execution_identity)?;
    }
    let previous = if resume {
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
    let (tx, rx) = mpsc::sync_channel::<Value>(workers);
    let rx = Arc::new(Mutex::new(rx));
    let (results, done) = mpsc::sync_channel(workers);
    let mut metrics = Metrics::default();
    let mut completed = BTreeSet::new();
    let mut replay = BTreeMap::new();
    let mut pending = vec![];
    for item in items {
        let id = item["match"]["id"].as_str().ok_or("Missing match id")?;
        let base = output.join("matches").join(id);
        let manifest = match_manifest(&job, item, &runtime);
        if base.join("done.json").exists() {
            let (record, reports) = restore(&base, &manifest, id)?;
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
    let max_games = job["budget"]["maxGames"].as_u64().unwrap_or(u64::MAX);
    let max_wall = job["budget"]["maxWallMs"].as_f64().unwrap_or(f64::MAX);
    let mut error: Option<String> = None;
    std::thread::scope(|scope| {
        for _ in 0..workers {
            let rx = rx.clone();
            let results = results.clone();
            let stop = stop.clone();
            let job = job.clone();
            let runtime = &runtime;
            scope.spawn(move || {
                let mut host: Option<Host> = None;
                loop {
                    let item = match rx.lock().unwrap().recv() {
                        Ok(v) => v,
                        Err(_) => break,
                    };
                    let id = item["match"]["id"].as_str().unwrap().to_owned();
                    let base = output.join("matches").join(&id);
                    let result = (|| -> Result<(Value, [Value; 2])> {
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
                        }
                        let active = host.as_mut().unwrap();
                        let ready = initialize(active, &job, &item, &c)?;
                        let manifest = match_manifest(&job, &item, runtime);
                        xml::write(&base.join("manifest.xml"), "manifest", &manifest)?;
                        save(&base.join("fixture.json"), &item)?;
                        let evidence = crate::frozen_match::execute(
                            &c, active, &ready, &manifest, &base, &stop,
                        )?;
                        if !stop.load(Ordering::SeqCst) {
                            finalize(&base)?;
                        }
                        // Failed/terminated hosts never poison the next independent match.
                        if evidence.0["status"] != "completed" {
                            host.take();
                        }
                        Ok(evidence)
                    })()
                    .map_err(|e| e.to_string());
                    let interrupted = stop.load(Ordering::SeqCst);
                    if results.send((id, result, interrupted)).is_err() {
                        break;
                    }
                }
                drop(host);
                crate::evidence_writer::shutdown();
            });
        }
        drop(results);
        let mut next = pending.into_iter();
        let mut active = 0;
        loop {
            while active < workers
                && !stop.load(Ordering::SeqCst)
                && reserved.saturating_add(4) <= max_games
                && previous_ms + started.elapsed().as_secs_f64() * 1000.0 < max_wall
            {
                let Some(item) = next.next() else {
                    break;
                };
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
                if tx.send(item).is_err() {
                    break;
                }
                active += 1;
            }
            if active == 0 {
                break;
            }
            match done.recv_timeout(Duration::from_millis(100)) {
                Ok((id, result, interrupted)) => {
                    active -= 1;
                    match result {
                        Ok((record, reports)) => {
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
            if previous_ms + started.elapsed().as_secs_f64() * 1000.0 >= max_wall {
                stop.store(true, Ordering::SeqCst);
            }
        }
        drop(tx);
    });
    memory_done.store(true, Ordering::SeqCst);
    let peak = memory.join().unwrap_or(0);
    let status = if error.is_some() {
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
        &json!({"schemaVersion":1,"replayIdentity":identity::digest(&replay),"identity":job["identity"],"fixtureIdentity":job["fixtureIdentity"],"workers":workers,"status":status,"matches":metrics.matches,"incompleteMatches":metrics.incomplete,"completedGames":metrics.completed,"failedGames":metrics.failed,"skippedGames":metrics.skipped,"failures":metrics.failures,"elapsedMs":elapsed,"gamesPerSecond":metrics.completed as f64/(elapsed/1000.0),"processTreePeakRssBytes":peak,"memorySampleMs":100,"memoryMethod":"Linux /proc summed RSS; each descendant once, shared pages may be counted in multiple processes","error":error}),
    )?;
    println!("{}", output.display());
    Ok(if status == "completed" && metrics.incomplete == 0 {
        0
    } else {
        2
    })
}
