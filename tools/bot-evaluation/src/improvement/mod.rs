//! Bounded strategy improvement atop the existing Rust evaluator; Linux isolation.
mod config;
mod process;
mod references;
mod statistics;
mod storage;
use crate::{
    identity,
    xml::{self, Result},
};
use config::Config;
use serde_json::{json, Value};
use std::{
    fs,
    fs::OpenOptions,
    os::fd::AsRawFd,
    path::{Path, PathBuf},
    process::Command,
    sync::{atomic::AtomicBool, Arc},
    time::{SystemTime, UNIX_EPOCH},
};
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}
fn input_identity(c: &Config) -> Result<String> {
    let e = crate::config::read(&c.evaluation)?;
    Ok(identity::digest(
        &json!({"evaluation":e.doc,"deck":e.deck,"rules":e.rules,"content_manifest":identity::sha(fs::read(e.snapshot.join("manifest.json"))?)}),
    ))
}
fn checkpoint(c: &Config, s: &Value) -> Result<()> {
    storage::save(&c.output.join("state.json"), s)
}
fn bridge(c: &Config, id: &str) -> Result<PathBuf> {
    let dir = c.output.join("versions").join(id);
    let file = dir.join("bot.mjs");
    let shared = std::env::current_dir()?.join("src/battle/worker/bot/generalist-bot.ts");
    let source=format!("import {{createGeneralistBotModule as shared}} from {};\nimport * as strategy from './strategy.mjs';\nexport function createBotModule(dependencies) {{ const base=shared(dependencies,strategy.createStrategy(dependencies)); return {{contractVersion:1,create(config) {{ const bot=base.create(config); return strategy.sideboard ? {{...bot,sideboard:strategy.sideboard}} : bot; }} }}; }}\n",serde_json::to_string(&shared)?);
    if file.exists() && fs::read_to_string(&file)? != source {
        return Err("Trusted package bridge changed".into());
    }
    if !file.exists() {
        fs::write(&file, source)?;
    }
    Ok(file)
}
fn remaining(c: &Config, s: &Value, limit: u64) -> Result<u64> {
    let elapsed = now().saturating_sub(s["started_ms"].as_u64().unwrap());
    if elapsed >= c.max_wall_ms {
        return Err("wall_budget".into());
    }
    Ok(limit.min(c.max_wall_ms - elapsed))
}
fn batch(
    c: &Config,
    s: &mut Value,
    dir: &Path,
    label: &str,
    a: &str,
    b: &str,
    matches: u64,
    stop: &Arc<AtomicBool>,
) -> Result<Value> {
    let games = s["reserved_games"].as_u64().unwrap();
    let total = games.checked_add(matches * 4).ok_or("game_budget")?;
    if total > c.max_games {
        return Err("game_budget".into());
    }
    if crate::application_identity::digest()?
        != s["runtime"].as_str().ok_or("Missing runtime identity")?
    {
        return Err("Runtime changed during improvement".into());
    }
    storage::verify(&c.output)?;
    if s["inputs"] != input_identity(c)? {
        return Err("Evaluation inputs changed during improvement".into());
    }
    let mut doc = xml::read(&c.evaluation, "evaluation")?;
    doc["bots"] =
        json!({"a":{"module":bridge(c,a)?,"config":{}},"b":{"module":bridge(c,b)?,"config":{}}});
    // Paths are normalized once and pinned in config identity before launching.
    let base = c.evaluation.parent().unwrap();
    for parts in [
        ["deck", "path"],
        ["rules", "banlist"],
        ["content", "snapshot"],
    ] {
        doc[parts[0]][parts[1]] = json!(base
            .join(xml::text(&doc[parts[0]][parts[1]])?)
            .canonicalize()?);
    }
    doc["batch"]["matches"] = json!(matches);
    doc["output"]["directory"] = json!(dir.join(label));
    let cfg = dir.join(format!("{label}.xml"));
    xml::write(&cfg, "evaluation", &doc)?;
    s["reserved_games"] = json!(total);
    s["active"] = json!({"iteration":s["next_iteration"],"phase":label,"directory":dir});
    checkpoint(c, s)?;
    let mut cmd = Command::new(std::env::current_exe()?);
    cmd.args(["evaluate", "--config"]).arg(cfg);
    process::execute(
        cmd,
        &c.output,
        &dir.join(format!("{label}.log")),
        remaining(c, s, c.evaluation_timeout_ms)?,
        c.max_bytes,
        stop,
    )?;
    let dirs = fs::read_dir(dir.join(label))?.collect::<std::io::Result<Vec<_>>>()?;
    if dirs.len() != 1 {
        return Err("Expected one evaluation run".into());
    }
    let run = dirs[0].path();
    let assessment = statistics::assess(&run, matches)?;
    Ok(json!({"run":run,"assessment":assessment}))
}
pub fn run(file: &Path, resume: bool) -> Result<i32> {
    let c = Config::read(file)?;
    let exists = c.output.join("state.json").exists();
    if exists != resume {
        return Err("Use --resume only for an existing loop".into());
    }
    fs::create_dir_all(&c.output)?;
    let lock = OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(c.output.join("lock"))?;
    if unsafe { libc::flock(lock.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } != 0 {
        return Err("Loop already running".into());
    }
    let evaluation = crate::config::read(&c.evaluation)?;
    if evaluation.fixture.is_some() {
        return Err("This loop uses fresh production shuffles; fixtures are not supported".into());
    }
    let immutable = json!({"configuration":serde_json::to_value(&c)?,"evaluation":evaluation.doc,"deck":evaluation.deck,"rules":evaluation.rules,"initial":identity::sha(fs::read(&c.initial_strategy)?),"runtime":crate::application_identity::digest()?,"content_manifest":identity::sha(fs::read(evaluation.snapshot.join("manifest.json"))?)});
    let fingerprint = identity::digest(&immutable);
    let mut s = if resume {
        let s = storage::read(&c.output.join("state.json"))?;
        if s["identity"] != fingerprint {
            return Err("Resume configuration/runtime/content identity mismatch".into());
        }
        storage::verify(&c.output)?;
        for record in s["history"].as_array().ok_or("Missing history")? {
            if let Some(directory) = record["directory"].as_str() {
                let directory = Path::new(directory);
                if record["evidence_sha256"] != storage::evidence_digest(directory)?
                    || storage::read(&directory.join("decision.json"))? != *record
                {
                    return Err("Finalized evidence changed".into());
                }
            }
        }
        s
    } else {
        storage::save(&c.output.join("configuration.json"), &immutable)?;
        let baseline = storage::archive(&c.output, &fs::read(&c.initial_strategy)?)?;
        json!({"identity":fingerprint,"inputs":input_identity(&c)?,"runtime":immutable["runtime"],"started_ms":now(),"baseline":baseline,"incumbent":baseline,"next_iteration":1,"reserved_games":0,"no_improvement":0,"active":null,"history":[],"status":"running","reason":null})
    };
    if s["status"] == "completed" {
        println!("{}", c.output.display());
        return Ok(0);
    }
    // An interrupted attempt is retained, never overwritten or counted as a result.
    if !s["active"].is_null() {
        let active = s["active"].take();
        s["history"]
            .as_array_mut()
            .unwrap()
            .push(json!({"outcome":"abandoned_interrupted","attempt":active}));
        s["next_iteration"] = json!(s["next_iteration"].as_u64().unwrap() + 1);
        s["no_improvement"] = json!(s["no_improvement"].as_u64().unwrap() + 1);
    }
    s["status"] = json!("running");
    s["reason"] = Value::Null;
    checkpoint(&c, &s)?;
    let stop = Arc::new(AtomicBool::new(false));
    let flag = stop.clone();
    ctrlc::set_handler(move || flag.store(true, std::sync::atomic::Ordering::SeqCst))?;
    let outcome = (|| -> Result<()> {
        loop {
            remaining(&c, &s, c.max_wall_ms)?;
            if s["next_iteration"].as_u64().unwrap() > c.max_iterations
                || s["no_improvement"].as_u64().unwrap() >= c.max_no_improvement
            {
                break;
            }
            if stop.load(std::sync::atomic::Ordering::SeqCst) || c.output.join("CANCEL").exists() {
                return Err("cancelled".into());
            }
            let i = s["next_iteration"].as_u64().unwrap();
            let incumbent = s["incumbent"].as_str().unwrap().to_owned();
            let dir = c.output.join(format!("attempt-{i:04}"));
            s["active"] = json!({"iteration":i,"phase":"starting","directory":dir});
            checkpoint(&c, &s)?;
            fs::create_dir(&dir)?;
            let evidence = batch(
                &c,
                &mut s,
                &dir,
                "incumbent",
                &incumbent,
                &incumbent,
                c.development_matches,
                &stop,
            )?;
            let workspace = dir.join("proposal");
            fs::create_dir(&workspace)?;
            fs::copy(
                c.output
                    .join("versions")
                    .join(&incumbent)
                    .join("strategy.mjs"),
                workspace.join("strategy.mjs"),
            )?;
            storage::save(
                &workspace.join("request.json"),
                &json!({"iteration":i,"incumbent":incumbent,"deck":evaluation.deck,"evidence":evidence,"history":s["history"],"instructions":"Inspect permitted player reports. Edit only strategy.mjs, preserving export createStrategy(dependencies), which returns a choice scoring function; optional export sideboard(input) uses shared validated exchanges. No imports, dynamic imports, filesystem/network access or concealed opponent information. Do not reimplement legality or change decks/runtime. Write response.json with no_change boolean, diagnosis, evidence array of game/decision references, play_changes, sideboarding_changes and tests. No-change requires an explanation. Trusted checks and evaluator run independently. You may write notes here; history and accepted incumbent survive rejection."}),
            )?;
            s["active"] = json!({"iteration":i,"phase":"agent","directory":dir});
            checkpoint(&c, &s)?;
            process::execute(
                process::agent(&c.agent, &workspace)?,
                &c.output,
                &dir.join("agent.log"),
                remaining(&c, &s, c.agent_timeout_ms)?,
                c.max_bytes,
                &stop,
            )?;
            let response = storage::read(&workspace.join("response.json"))?;
            if response["no_change"].as_bool().is_none()
                || response["diagnosis"]
                    .as_str()
                    .is_none_or(|v| v.trim().is_empty())
            {
                return Err("Invalid agent response".into());
            }
            let mut record = json!({"iteration":i,"incumbent":incumbent,"response":response,"incumbent_evidence":evidence,"outcome":"no_change"});
            if response["no_change"] == false {
                if response["evidence"]
                    .as_array()
                    .is_none_or(|refs| refs.is_empty())
                    || ["play_changes", "sideboarding_changes", "tests"]
                        .iter()
                        .any(|key| {
                            !(response[*key]
                                .as_str()
                                .is_some_and(|v| !v.trim().is_empty())
                                || response[*key].as_array().is_some_and(|items| {
                                    items
                                        .iter()
                                        .all(|v| v.as_str().is_some_and(|v| !v.trim().is_empty()))
                                }))
                        })
                {
                    return Err(
                        "Proposal requires evidence and play/sideboard/test descriptions".into(),
                    );
                }
                references::validate(&response["evidence"], &evidence, &s["history"])?;
                let source = storage::regular_bytes(&workspace.join("strategy.mjs"), 1024 * 1024)?;
                // Imports would let archived strategy depend on mutable or privileged sources.
                let text = std::str::from_utf8(&source)?;
                if text.contains("import") || text.contains("require(") {
                    return Err("Strategy must be self-contained (no imports)".into());
                }
                let candidate = storage::archive(&c.output, &source)?;
                record["candidate"] = json!(candidate);
                storage::save(&dir.join("proposal.json"), &record)?;
                if candidate == incumbent {
                    record["outcome"] = json!("unchanged_package");
                } else {
                    let candidate_path = bridge(&c, &candidate)?;
                    for (n, argv) in c.checks.iter().enumerate() {
                        let mut cmd = Command::new(&argv[0]);
                        cmd.args(&argv[1..])
                            .env("BOT_CANDIDATE", &candidate_path)
                            .env("BOT_STRATEGY", workspace.join("strategy.mjs"));
                        process::execute(
                            cmd,
                            &c.output,
                            &dir.join(format!("check-{n}.log")),
                            remaining(&c, &s, c.check_timeout_ms)?,
                            c.max_bytes,
                            &stop,
                        )?;
                    }
                    let dev = batch(
                        &c,
                        &mut s,
                        &dir,
                        "development",
                        &candidate,
                        &incumbent,
                        c.development_matches,
                        &stop,
                    )?;
                    record["development"] = dev.clone();
                    record["outcome"] = json!("rejected_development");
                    if dev["assessment"]["mean"].as_f64().unwrap() > 0.0 {
                        let confirmation = batch(
                            &c,
                            &mut s,
                            &dir,
                            "confirmation",
                            &candidate,
                            &incumbent,
                            c.confirmation_matches,
                            &stop,
                        )?;
                        record["confirmation"] = confirmation.clone();
                        record["outcome"] = json!("rejected_inconclusive");
                        if confirmation["assessment"]["supported"] == true {
                            s["incumbent"] = json!(candidate);
                            record["outcome"] = json!("promoted");
                        }
                    }
                }
            }
            record["directory"] = json!(dir);
            record["evidence_sha256"] = json!(storage::evidence_digest(&dir)?);
            storage::save(&dir.join("decision.json"), &record)?;
            s["no_improvement"] = json!(if record["outcome"] == "promoted" {
                0
            } else {
                s["no_improvement"].as_u64().unwrap() + 1
            });
            s["history"].as_array_mut().unwrap().push(record);
            s["active"] = Value::Null;
            s["next_iteration"] = json!(i + 1);
            checkpoint(&c, &s)?;
        }
        Ok(())
    })();
    match outcome {
        Ok(()) => {
            s["status"] = json!("completed");
            s["reason"] = json!("iteration_or_no_improvement_limit");
        }
        Err(e) => {
            s["status"] = json!("incomplete");
            s["reason"] = json!(e.to_string());
        }
    }
    checkpoint(&c, &s)?;
    println!("{}", c.output.display());
    Ok(if s["status"] == "completed" { 0 } else { 2 })
}
