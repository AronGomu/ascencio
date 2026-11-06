use crate::{
    bugs::BugStore,
    config::Config,
    execution::{fixture, play, sideboard},
    host::Host,
    identity,
    match_evidence::{
        finish, new_match, perspective_skip, progress, save_match, verify_evidence, ProgressLedger,
    },
    metrics::Metrics,
    runtime_identity::{init, manifest, now, rss},
    xml::{self, Result},
};
use serde_json::{json, Value};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::{Instant, SystemTime, UNIX_EPOCH},
};
pub fn evaluate(c: Config, resume: Option<PathBuf>) -> Result<i32> {
    evaluate_inner(c, resume)
}

fn evaluate_inner(c: Config, resume: Option<PathBuf>) -> Result<i32> {
    let start = Instant::now();
    let stop = Arc::new(AtomicBool::new(false));
    let signal = stop.clone();
    ctrlc::set_handler(move || signal.store(true, Ordering::SeqCst))?;
    let mut host = Host::start()?;
    let mut ready = init(&mut host, &c)?;
    let run = if let Some(dir) = &resume {
        xml::text(&xml::read(&dir.join("manifest.xml"), "manifest")?["run_id"])?.to_owned()
    } else {
        format!(
            "run-{}",
            SystemTime::now().duration_since(UNIX_EPOCH)?.as_millis()
        )
    };
    let directory = resume.clone().unwrap_or_else(|| c.output.join(&run));
    let expected = manifest(&c, &ready, &run)?;
    let saved_manifest = if resume.is_some() {
        let old = xml::read(&directory.join("manifest.xml"), "manifest")?;
        let mut old_identity = old.clone();
        let mut expected_identity = expected.clone();
        for field in ["created_at", "runtime"] {
            old_identity.as_object_mut().unwrap().remove(field);
            expected_identity.as_object_mut().unwrap().remove(field);
        }
        if identity::digest(&old_identity) != identity::digest(&expected_identity) {
            return Err("Resume input/application/dependency identity mismatch".into());
        }
        old
    } else {
        if directory.exists() {
            return Err("Output run already exists".into());
        }
        xml::write(&directory.join("manifest.xml"), "manifest", &expected)?;
        expected
    };
    let mut failure_guard = FailureGuard {
        directory: directory.clone(),
        armed: true,
    };
    let mut metrics = Metrics::default();
    let mut ledger = ProgressLedger::default();
    let mut bugs = BugStore::new(&directory);
    bugs.restore()?;
    let mut next = 1;
    let mut last = 0;
    let mut memory = vec![];
    let mut previous_elapsed = 0.0;
    let mut previous_writes = 0.0;
    if resume.is_some() {
        let p = xml::read(&directory.join("progress.xml"), "progress")?;
        next = xml::integer(&p["next_unstarted_match"])?;
        last = xml::integer(&p["last_finalized_match"])?;
        if next > c.matches + 1 || last >= next {
            return Err("Invalid progress watermark".into());
        }
        if next > 1 {
            metrics.timing_incomplete = true;
            if directory.join("summary.xml").exists() {
                let previous = xml::read(&directory.join("summary.xml"), "summary")?;
                let covered = xml::integer(&previous["counts"]["matches_completed"])?
                    + xml::integer(&previous["counts"]["matches_incomplete"])?;
                let performance = &previous["performance"];
                if covered == next - 1 && performance["timing_complete"] == "true" {
                    previous_elapsed = xml::number(&performance["elapsed_ms"])?;
                    previous_writes = xml::number(&performance["report_write_time_ms"])?;
                    metrics.peak = xml::integer(&performance["peak_resident_memory_bytes"])?;
                    memory = xml::items(&performance["memory_samples"], "sample")
                        .into_iter()
                        .cloned()
                        .collect();
                    metrics.timing_incomplete = false;
                }
            }
        }
        for m in 1..next {
            let id = format!("match-{m:06}");
            let base = directory.join("matches").join(&id);
            let mut record = xml::read(&base.join("match.xml"), "match")?;
            let mut reports = [
                xml::read(&base.join("player-a.xml"), "player-report")?,
                xml::read(&base.join("player-b.xml"), "player-report")?,
            ];
            verify_evidence(&record, &reports, &saved_manifest, &id)?;
            if m > last {
                for i in 0..4 {
                    if record["games"]["game"][i]["status"] == "skipped" {
                        record["games"]["game"][i]["skip_reason"] =
                            json!("interrupted_before_finalization");
                        for report in &mut reports {
                            report["games"]["game"][i] =
                                perspective_skip(&record["games"]["game"][i]);
                        }
                    }
                }
                record["status"] = json!("incomplete");
                record["result"]["outcome"] = Value::Null;
                save_match(&directory, &record, &reports)?;
                last = m;
            }
            for (i, g) in xml::items(&record["games"], "game").iter().enumerate() {
                metrics.game(
                    g,
                    &[
                        reports[0]["games"]["game"][i].clone(),
                        reports[1]["games"]["game"][i].clone(),
                    ],
                );
            }
            for report in &reports {
                metrics.sideboard(report);
            }
            ledger.observe(&record);
            metrics.finish_match(&record);
        }
        for id in xml::items(&p["completed_game_ids"], "game_id") {
            if ledger
                .completed
                .binary_search(&xml::text(id)?.to_owned())
                .is_err()
            {
                return Err("Progress references unavailable finalized game".into());
            }
        }
        for id in xml::items(&p["incomplete_match_ids"], "match_id") {
            if ledger
                .incomplete
                .binary_search(&xml::text(id)?.to_owned())
                .is_err()
            {
                return Err("Progress references unavailable incomplete match".into());
            }
        }
        if p["status"] == "completed" && next == c.matches + 1 {
            failure_guard.armed = false;
            println!("{}", directory.display());
            return Ok(if metrics.incomplete > 0 { 2 } else { 0 });
        }
    }
    let startup = start.elapsed().as_secs_f64() * 1000.0;
    let warm = Instant::now();
    let writes_at_warm = xml::write_time_ms();
    let mut host_dead = false;
    let mut interrupted = false;
    for m in next..=c.matches {
        if stop.load(Ordering::SeqCst) {
            interrupted = true;
            break;
        }
        if host_dead || (m > next && (m - 1) % 100 == 0) {
            host.kill();
            host = Host::start()?;
            ready = init(&mut host, &c)?;
            if manifest(&c, &ready, &run)?["identity_sha256"] != saved_manifest["identity_sha256"] {
                return Err("Input identity changed while recycling execution host".into());
            }
            host_dead = false;
        }
        let id = format!("match-{m:06}");
        let (mut record, mut reports) = new_match(&run, &id, &saved_manifest);
        save_match(&directory, &record, &reports)?;
        progress(
            &directory,
            &run,
            "running",
            last,
            Some(m),
            Some(1),
            m + 1,
            &ledger,
            &bugs,
        )?;
        let mut decks = [c.deck.clone(), c.deck.clone()];
        let mut failed = false;
        for index in 0..4 {
            let n = index + 1;
            if failed {
                record["games"]["game"][index]["skip_reason"] = json!("earlier_execution_failed");
                for report in &mut reports {
                    report["games"]["game"][index]["skip_reason"] =
                        json!("earlier_execution_failed");
                }
                continue;
            }
            if index == 2 {
                let mut checkpoint = json!({"captured_at":now(),"pending_prompt":{"kind":"sideboarding","constraints":{"preserve_section_sizes":true,"preserve_total_multiset":true}},"attempted_response":null,"player":null,"private_engine_state":null,"bot_debug_state":null,"recent_engine_events":{}});
                if let Err(e) = sideboard(
                    &mut host,
                    &c,
                    &ready,
                    &mut reports,
                    &mut record,
                    &mut checkpoint,
                ) {
                    host.kill();
                    host_dead = true;
                    failed = true;
                    let f = json!({"category":"sideboarding_failure","message":e.to_string(),"stack":null,"limit_ms":c.limits["sideboarding_wall_time_ms"]});
                    let bug =
                        bugs.record(&run, &id, None, "sideboarding", &f, None, &checkpoint)?;
                    record["sideboarding"]["status"] = json!("failed");
                    record["sideboarding"]["bug_id"] = json!(bug);
                    for report in &mut reports {
                        report["sideboarding"] = json!({"status":"failed","bug_id":bug});
                    }
                    record["games"]["game"][index]["skip_reason"] = json!("sideboarding_failed");
                    for report in &mut reports {
                        report["games"]["game"][index]["skip_reason"] =
                            json!("sideboarding_failed");
                    }
                    continue;
                }
                decks = [
                    record["sideboarding"]["decks"][0].clone(),
                    record["sideboarding"]["decks"][1].clone(),
                ];
                record["sideboarding"]
                    .as_object_mut()
                    .unwrap()
                    .remove("decks");
            }
            progress(
                &directory,
                &run,
                "running",
                last,
                Some(m),
                Some(n as u64),
                m + 1,
                &ledger,
                &bugs,
            )?;
            let orders = fixture(&c, m, n as u64, &decks)?;
            let full_path_start = Instant::now();
            let mut result = play(
                &mut host,
                &c,
                &record["games"]["game"][index],
                &decks,
                orders,
                &stop,
            )?;
            host_dead = result.host_dead;
            metrics.peak = metrics.peak.max(result.peak);
            if let Some(f) = &result.failure {
                failed = true;
                let bug = bugs.record(
                    &run,
                    &id,
                    result.neutral["game_id"].as_str(),
                    "game",
                    f,
                    result.neutral["evidence_sha256"].as_str(),
                    &result.checkpoint,
                )?;
                result.neutral["bug_id"] = json!(bug);
                for r in &mut result.records {
                    r["result"]["bug_id"] = json!(bug);
                }
            }
            record["games"]["game"][index] = result.neutral.clone();
            for (i, report) in reports.iter_mut().enumerate() {
                report["games"]["game"][index] = result.records[i].clone();
            }
            finish(&mut record);
            let write_start = Instant::now();
            save_match(&directory, &record, &reports)?;
            let write_ms = write_start.elapsed().as_secs_f64() * 1000.0;

            // This full-path latency includes mandatory XML serialization, XSD validation and durable writes.
            for r in &mut result.records {
                r["result"]["duration_ms"] = json!(result.elapsed + write_ms);
            }
            for report in &mut reports {
                report["games"]["game"][index]["result"]["duration_ms"] =
                    json!(result.elapsed + write_ms);
            }
            if result.neutral["status"] == "completed" {
                ledger
                    .completed
                    .push(result.neutral["game_id"].as_str().unwrap().to_owned());
            }
            progress(
                &directory,
                &run,
                "running",
                last,
                Some(m),
                Some(n as u64),
                m + 1,
                &ledger,
                &bugs,
            )?;
            record["games"]["game"][index]["duration_ms"] =
                json!(full_path_start.elapsed().as_secs_f64() * 1000.0);
            if stop.load(Ordering::SeqCst) {
                failed = true;
                interrupted = true;
            }
        }
        finish(&mut record);
        save_match(&directory, &record, &reports)?;
        for (i, g) in xml::items(&record["games"], "game").iter().enumerate() {
            metrics.game(
                g,
                &[
                    reports[0]["games"]["game"][i].clone(),
                    reports[1]["games"]["game"][i].clone(),
                ],
            );
        }
        for report in &reports {
            metrics.sideboard(report);
        }
        ledger.observe(&record);
        metrics.finish_match(&record);
        last = m;
        metrics.peak = metrics
            .peak
            .max(rss(std::process::id()) + if host_dead { 0 } else { rss(host.pid()) });
        if m % 100 == 0 || m == 1 || m == c.matches {
            memory.push(json!({"number":m,"rss_bytes":rss(std::process::id())+if host_dead{0}else{rss(host.pid())}}));
            eprintln!(
                "matches {m}/{}; completed games {}; incomplete {}",
                c.matches, metrics.completed, metrics.incomplete
            );
        }
        progress(
            &directory,
            &run,
            if interrupted {
                "interrupted"
            } else {
                "running"
            },
            last,
            None,
            None,
            m + 1,
            &ledger,
            &bugs,
        )?;
        if interrupted {
            break;
        }
    }
    metrics.writes = previous_writes + xml::write_time_ms() - writes_at_warm;
    metrics.elapsed = previous_elapsed + warm.elapsed().as_secs_f64() * 1000.0;
    let status = if interrupted {
        "interrupted"
    } else {
        "completed"
    };
    let summary = metrics.summary(
        &run,
        status,
        c.matches,
        startup,
        c.target,
        json!({"bug_id":bugs.ids}),
        json!({"sample":memory}),
    );
    xml::write(&directory.join("summary.xml"), "summary", &summary)?;
    xml::write(
        &directory.join("report.xml"),
        "evaluation-report",
        &crate::analysis::report(&directory, &run, &bugs.ids)?,
    )?;
    progress(
        &directory,
        &run,
        status,
        last,
        None,
        None,
        last + 1,
        &ledger,
        &bugs,
    )?;
    failure_guard.armed = false;
    println!("{}", directory.display());
    Ok(if interrupted || metrics.incomplete > 0 {
        2
    } else {
        0
    })
}

struct FailureGuard {
    directory: PathBuf,
    armed: bool,
}
impl Drop for FailureGuard {
    fn drop(&mut self) {
        if self.armed {
            let path = self.directory.join("progress.xml");
            if let Ok(mut p) = xml::read(&path, "progress") {
                p["status"] = json!("failed");
                p["updated_at"] = json!(now());
                let _ = xml::write(&path, "progress", &p);
            }
        }
    }
}
