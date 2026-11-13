//! Supervised target-only campaign. Each invocation stops at a review boundary.
mod agents;
mod archive;
mod config;
mod evaluation;
mod pool;
mod recovery;
mod report;
pub mod retention;
mod scoring;
use crate::{
    identity,
    improvement::{process, storage},
    xml::{self, Result},
};
use config::Config;
use serde_json::{json, Value};
use std::{
    fs,
    os::fd::AsRawFd,
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::{SystemTime, UNIX_EPOCH},
};
pub(super) fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}
pub(super) struct Campaign {
    c: Config,
    s: Value,
    stop: Arc<AtomicBool>,
}
impl Campaign {
    fn save(&self) -> Result<()> {
        storage::save(&self.c.output.join("state.json"), &self.s)
    }
    fn limit(&self, timeout: u64) -> Result<u64> {
        if self.stop.load(Ordering::SeqCst) || self.c.output.join("CANCEL").exists() {
            return Err("cancelled".into());
        }
        let elapsed = now().saturating_sub(self.s["started_ms"].as_u64().unwrap());
        if elapsed >= self.c.max_wall_ms {
            return Err("wall_budget".into());
        }
        if storage::size(&self.c.output)? > self.c.max_bytes {
            return Err("storage_budget".into());
        }
        Ok(timeout.min(self.c.max_wall_ms - elapsed))
    }
    fn guard(&self) -> Result<()> {
        if self.s["status"] != "completed" {
            self.limit(self.c.max_wall_ms)?;
        }
        if self.s["runtime"] != crate::application_identity::digest()?
            || self.s["commands"] != self.c.command_identity()?
            || self.s["inputs"] != input_identity(&self.c)?
        {
            return Err("Pinned implementation or inputs changed".into());
        }
        Ok(())
    }
    fn checks(&self, id: &str, dir: &Path) -> Result<()> {
        let (module, _) = archive::module(&self.c, id)?;
        for (i, args) in self.c.checks.iter().enumerate() {
            let mut cmd = std::process::Command::new(&args[0]);
            cmd.args(&args[1..])
                .env("BOT_CANDIDATE", module.clone())
                .env(
                    "BOT_STRATEGY",
                    module.parent().unwrap().join("strategy.mjs"),
                );
            process::execute(
                cmd,
                &self.c.output,
                &dir.join(format!("check-{i}.log")),
                self.limit(self.c.check_timeout_ms)?,
                self.c.max_bytes,
                &self.stop,
            )?;
        }
        Ok(())
    }
    fn gauntlet(
        &mut self,
        key: &str,
        deck: &str,
        id: &str,
        opponents: &[Value],
    ) -> Result<Vec<Value>> {
        let mut rows = vec![];
        for op in opponents {
            let mut row = op.clone();
            let op_deck = xml::text(&op["opponent_deck"])?;
            let op_id = xml::text(&op["opponent"])?;
            let job = format!("{key}-{op_deck}-{op_id}");
            let evidence = self.evaluate(&job, deck, id, op_deck, op_id)?;
            row["sample"] = evidence["sample"].clone();
            row["run"] = evidence["run"].clone();
            rows.push(row);
        }
        Ok(rows)
    }
    fn rank(&mut self, label: &str) -> Result<()> {
        self.guard()?;
        if self.s["rankings"]
            .as_array()
            .unwrap()
            .iter()
            .any(|r| r["label"] == label && r["epoch"] == self.s["epoch"])
        {
            return Ok(());
        }
        let frozen = self.s["pool"].clone();
        let mut next = json!({});
        let mut rankings = json!({});
        for deck in self.c.decks.iter().take(1).cloned().collect::<Vec<_>>() {
            let ids = self.s["decks"][&deck.id]["versions"]
                .as_array()
                .unwrap()
                .iter()
                .filter(|v| v["valid"] == true)
                .map(|v| v["id"].as_str().unwrap().to_string())
                .collect::<Vec<_>>();
            let (opponents, excluded) = pool::eligible(&self.s, &frozen, &deck.id, &ids)?;
            if opponents.is_empty() {
                // Reconsider every archive entry, but never manufacture a score
                // or compare identical packages to fill an empty intersection.
                next[&deck.id] = frozen[&deck.id].clone();
                rankings[&deck.id] = json!({"status":"unassessable_retained_previous_pool","conditions":[],"exclusions":excluded,"considered":ids,"ranking":[],"retained_from":self.s["rankings"].as_array().unwrap().last().map(|r|json!({"label":r["label"],"epoch":r["epoch"]})).unwrap_or(json!({"label":"initial_roster","epoch":0}))});
                continue;
            }
            let mut rows = vec![];
            for id in &ids {
                let results = self.gauntlet(
                    &format!("rank-{label}-{}-{id}", deck.id),
                    &deck.id,
                    id,
                    &opponents,
                )?;
                rows.push(
                    json!({"id":id,"aggregate":scoring::aggregate(&results)?,"results":results}),
                );
            }
            pool::order(&mut rows);
            next[&deck.id] = json!(rows
                .iter()
                .take(3)
                .map(|r| r["id"].clone())
                .collect::<Vec<_>>());
            rankings[&deck.id] = json!({"status":"ranked","conditions":opponents,"exclusions":excluded,"ranking":rows});
        }
        let record = json!({"label":label,"epoch":self.s["epoch"],"frozen_pool":frozen,"selected":next,"rankings":rankings,"tie_break":"ascending_content_hash"});
        let path = self
            .c
            .output
            .join(format!("ranking-e{}-{label}.json", self.s["epoch"]));
        storage::save(&path, &record)?;
        let mut s = self.s.clone();
        // Rankings never replace the frozen evaluation opponents.
        s["rankings"].as_array_mut().unwrap().push(record);
        storage::save(&self.c.output.join("state.json"), &s)?;
        self.s = s;
        Ok(())
    }
    // One invocation performs one reviewable stage. Opponents always use the
    // immutable initial pool; only the first configured deck may receive proposals.
    fn advance(&mut self) -> Result<()> {
        self.guard()?;
        self.recover_pending()?;
        let target = self.c.decks[0].id.clone();
        let round = self.s["completed_rounds"].as_u64().unwrap() + 1;
        let incumbent = self.s["decks"][&target]["incumbent"]
            .as_str()
            .unwrap()
            .to_owned();
        let stage = self.s["next_stage"]
            .as_str()
            .unwrap_or("diagnostics")
            .to_owned();
        let opponents = pool::eligible(&self.s, &self.s["pool"], &target, &[incumbent.clone()])?.0;
        match stage.as_str() {
            "diagnostics" => {
                let rows = self.gauntlet(
                    &format!("r{round}-diagnostic"),
                    &target,
                    &incumbent,
                    &opponents,
                )?;
                self.s["active"] = json!({"round":round,"diagnostics":rows});
                self.s["next_stage"] = json!("proposal");
            }
            "proposal" => {
                let diagnostics = self.s["active"]["diagnostics"].clone();
                let proposal = self.propose(round, &target, &diagnostics)?;
                self.s["active"]["proposal"] = proposal;
                self.s["next_stage"] = json!("comparison");
            }
            "comparison" => {
                let proposal = self.s["active"]["proposal"].clone();
                if let Some(candidate) =
                    proposal["candidate"].as_str().filter(|id| *id != incumbent)
                {
                    let candidates = self.gauntlet(
                        &format!("r{round}-candidate"),
                        &target,
                        candidate,
                        &opponents,
                    )?;
                    let controls = self.gauntlet(
                        &format!("r{round}-control"),
                        &target,
                        &incumbent,
                        &opponents,
                    )?;
                    self.s["active"]["assessment"] = scoring::promotion(&candidates, &controls)?;
                    self.s["active"]["candidate_results"] = json!(candidates);
                    self.s["active"]["control_results"] = json!(controls);
                }
                self.s["next_stage"] = json!("decision");
            }
            "decision" => {
                let mut record = self.s["active"].clone();
                let promote = record["assessment"]["supported"] == true;
                record["decision"] = json!(if promote {
                    "promoted"
                } else {
                    "retained_incumbent"
                });
                if promote {
                    self.s["decks"][&target]["incumbent"] = record["proposal"]["candidate"].clone();
                }
                record["epoch"] = self.s["epoch"].clone();
                let outcome = record["decision"].clone();
                record["decisions"] = json!({target.clone(): {"outcome":outcome,"proposal":record["proposal"],"comparison":{"assessment":record["assessment"],"candidate":record["candidate_results"],"incumbent":record["control_results"]}}});
                storage::save(
                    &self.c.output.join(format!("round-{round:04}.json")),
                    &record,
                )?;
                self.s["rounds"].as_array_mut().unwrap().push(record);
                self.s["completed_rounds"] = json!(round);
                self.s["active"] = Value::Null;
                self.s["next_stage"] = json!("analysis");
            }
            "analysis" => return Err(
                "Deliver loss analysis to the orchestrator, then prune-iteration before continuing"
                    .into(),
            ),
            "ranking" => {
                self.rank("final")?;
                self.s["next_stage"] = json!("export");
            }
            "export" => {
                let mut cmd = std::process::Command::new(
                    std::env::var("ARO2_NODE").unwrap_or_else(|_| "node".into()),
                );
                cmd.arg("scripts/bot-campaign/export-packages.ts")
                    .arg(&self.c.output);
                process::execute(
                    cmd,
                    &self.c.output,
                    &self.c.output.join("export.log"),
                    self.limit(self.c.check_timeout_ms)?,
                    self.c.max_bytes,
                    &self.stop,
                )?;
                self.s["exports"] = storage::read(&self.c.output.join("final/packages.json"))?;
                self.s["next_stage"] = json!("done");
            }
            _ => return Err("Unknown campaign stage".into()),
        }
        println!(
            "Finished {stage}; next stage: {}. Review evidence before explicit --resume.",
            self.s["next_stage"]
        );
        self.save()
    }
}

fn input_identity(c: &Config) -> Result<String> {
    let eval = crate::config::read(&c.evaluation)?;
    let mut decks = vec![];
    for d in &c.decks {
        decks.push(json!({"id":d.id,"deck":identity::sha(fs::read(&d.deck)?),"initial":identity::sha(fs::read(&d.strategy)?),"config":d.config}));
    }
    Ok(identity::digest(
        &json!({"evaluation":eval.doc,"rules":eval.rules,"manifest":identity::sha(fs::read(eval.snapshot.join("manifest.json"))?),"decks":decks}),
    ))
}
/// Refresh a handoff without changing checkpoint state or advancing execution.
pub fn import_candidate(
    directory: &Path,
    source: &Path,
    previous_executable: &Path,
) -> Result<i32> {
    let lock = fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(directory.join("lock"))?;
    if unsafe { libc::flock(lock.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } != 0 {
        return Err("Campaign already running".into());
    }
    let mut state = storage::read(&directory.join("state.json"))?;
    if state["next_stage"] != "proposal" && state["next_stage"] != "comparison" {
        return Err("Candidate import requires proposal stage".into());
    }
    let config = storage::read(&directory.join("configuration.json"))?;
    let mut c: Config = serde_json::from_value(
        state
            .get("latest_configuration")
            .cloned()
            .unwrap_or(config["configuration"].clone()),
    )?;
    c.output = directory.canonicalize()?;
    if state["inputs"] != input_identity(&c)? || state["commands"] != c.command_identity()? {
        return Err("Pinned inputs or commands changed".into());
    }
    if state["runtime"] != crate::application_identity::digest_for(previous_executable)? {
        return Err("Previous executable or runtime sources do not match checkpoint".into());
    }
    for job in state["jobs"].as_object().ok_or("Missing jobs")?.values() {
        if job["status"] == "completed"
            && job["evidence_sha256"]
                != storage::evidence_digest(Path::new(xml::text(&job["directory"])?))?
        {
            return Err("Baseline evidence changed".into());
        }
    }
    let target = c.decks[0].id.clone();
    let round = state["completed_rounds"]
        .as_u64()
        .ok_or("Missing completed rounds")?
        + 1;
    let parent = xml::text(&state["decks"][&target]["incumbent"])?.to_owned();
    let candidate = archive::package(
        &c,
        &storage::regular_bytes(source, 1024 * 1024)?,
        &c.decks[0].config,
    )?;
    if state["next_stage"] == "comparison" && state["active"]["proposal"]["candidate"] != candidate
    {
        return Err("A different candidate is already imported".into());
    }
    let dir = c
        .output
        .join("proposals")
        .join(format!("r{round}-{target}"))
        .join(format!("external-{candidate}"));
    fs::create_dir_all(&dir)?;
    let campaign = Campaign {
        c,
        s: state.clone(),
        stop: Arc::new(AtomicBool::new(false)),
    };
    campaign.checks(&candidate, &dir)?;
    let result = json!({"candidate":candidate,"parent":parent,"directory":dir,"origin":"conversation-orchestrator","epoch":state["epoch"]});
    archive::register(
        &mut state,
        &target,
        &candidate,
        round,
        &parent,
        result.clone(),
    );
    let key = format!("r{round}-{target}");
    let previous_attempt = state["proposals"][&key].clone();
    if !previous_attempt.is_null() {
        state["abandoned"]
            .as_array_mut()
            .ok_or("Missing attempt archive")?
            .push(previous_attempt);
    }
    storage::save(&dir.join("proposal.json"), &result)?;
    state["proposals"][&key] = json!({"status":"completed","result":result,"directory":dir,"evidence_sha256":storage::evidence_digest(&dir)?});
    state["active"]["proposal"] = result;
    state["next_stage"] = json!("comparison");
    state["status"] = json!("paused");
    state["reason"] = Value::Null;
    let migration = json!({"reason":"external proposal import command; evaluation mechanics unchanged","old_runtime":state["runtime"],"new_runtime":crate::application_identity::digest()?,"previous_executable":previous_executable.canonicalize()?,"at_ms":now()});
    storage::save(&dir.join("import-receipt.json"), &migration)?;
    state["proposals"][&key]["evidence_sha256"] = json!(storage::evidence_digest(&dir)?);
    state["runtime"] = migration["new_runtime"].clone();
    state["runtime_transitions"]
        .as_array_mut()
        .map(|a| a.push(migration.clone()))
        .unwrap_or_else(|| state["runtime_transitions"] = json!([migration]));
    storage::save(&directory.join("state.json"), &state)?;
    report::write(&campaign.c, &state)?;
    println!("Imported {candidate}; paused before comparison");
    Ok(0)
}

pub fn refresh_report(directory: &Path) -> Result<i32> {
    let lock = fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(directory.join("lock"))?;
    if unsafe { libc::flock(lock.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } != 0 {
        return Err("Campaign already running".into());
    }
    let state = storage::read(&directory.join("state.json"))?;
    let configuration = storage::read(&directory.join("configuration.json"))?;
    let mut c: Config = serde_json::from_value(
        state
            .get("latest_configuration")
            .cloned()
            .unwrap_or(configuration["configuration"].clone()),
    )?;
    c.output = directory.canonicalize()?;
    report::write(&c, &state)?;
    println!("{}", c.output.join("report.md").display());
    Ok(0)
}

pub fn run(path: &Path, resume: bool) -> Result<i32> {
    let mut c = Config::read(path)?;
    fs::create_dir_all(&c.output)?;
    c.output = c.output.canonicalize()?;
    let lock = fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(c.output.join("lock"))?;
    if unsafe { libc::flock(lock.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } != 0 {
        return Err("Campaign already running".into());
    }
    let fingerprint = identity::digest(&serde_json::to_value(&c)?);
    let exists = c.output.join("state.json").exists() || c.output.join("run.json").exists();
    if exists != resume {
        return Err("Use --resume for an existing campaign only".into());
    }
    let s = if resume {
        let mut s = storage::read(&c.output.join("state.json"))?;
        if s["configuration_sha256"] != fingerprint {
            let prior = s.get("latest_configuration").cloned().unwrap_or(
                storage::read(&c.output.join("configuration.json"))?["configuration"].clone(),
            );
            let current = serde_json::to_value(&c)?;
            budget_extension(&prior, &current)?;
            let mut extensions = s["budget_extensions"]
                .as_array()
                .cloned()
                .unwrap_or_default();
            extensions.push(json!({"previous":prior,"extended":current,"at_ms":now(),"reserved_games":s["reserved_games"]}));
            s["budget_extensions"] = json!(extensions);
            s["latest_configuration"] = current;
            s["configuration_sha256"] = json!(fingerprint);
        }
        for d in &c.decks {
            for v in s["decks"][&d.id]["versions"]
                .as_array()
                .ok_or("Missing versions")?
            {
                let id = xml::text(&v["id"])?;
                archive::verify_one(&c.output.join("versions").join(id), id)?;
            }
        }
        for proposal in s["proposals"]
            .as_object()
            .ok_or("Missing proposals")?
            .values()
        {
            if proposal["status"] == "completed"
                && proposal["evidence_sha256"]
                    != storage::evidence_digest(Path::new(xml::text(&proposal["directory"])?))?
            {
                return Err("Finalized proposal evidence changed".into());
            }
        }
        for round in s["rounds"].as_array().ok_or("Missing rounds")? {
            if storage::read(&c.output.join(format!(
                "round-{:04}.json",
                round["round"].as_u64().unwrap()
            )))? != *round
            {
                return Err("Finalized round evidence changed".into());
            }
        }
        for job in s["jobs"].as_object().ok_or("Missing jobs")?.values() {
            if job["status"] == "completed"
                && job["evidence_sha256"]
                    != storage::evidence_digest(Path::new(xml::text(&job["directory"])?))?
            {
                return Err("Finalized evaluation evidence changed".into());
            }
        }
        s
    } else {
        let eval = crate::config::read(&c.evaluation)?;
        if eval.fixture.is_some() {
            return Err("Campaign requires production shuffles".into());
        }
        let mut s = json!({"protocol":"paired-v1","configuration_sha256":fingerprint,"commands":c.command_identity()?,"inputs":input_identity(&c)?,"runtime":crate::application_identity::digest()?,"epoch":0,"started_ms":now(),"status":"running","reason":null,"completed_rounds":0,"next_stage":"diagnostics","reserved_games":0,"decks":{},"pool":{},"jobs":{},"proposals":{},"rounds":[],"rankings":[],"fixes":[],"bugs":{},"abandoned":[],"active":null});
        for d in &c.decks {
            let id = archive::package(
                &c,
                &storage::regular_bytes(&d.strategy, 1024 * 1024)?,
                &d.config,
            )?;
            s["decks"][&d.id] = json!({"incumbent":id,"agent_id":format!("deck-{}-{}",d.id,now()),"versions":[{"id":id,"round":0,"parent":null,"valid":true}]});
            if c.decks.len() == 1 || d.id != c.decks[0].id {
                s["pool"][&d.id] = json!([id]);
            }
        }
        for d in &c.decks {
            let (opponents, _) = pool::eligible(
                &s,
                &s["pool"],
                &d.id,
                &[s["decks"][&d.id]["incumbent"].as_str().unwrap().to_owned()],
            )?;
            if opponents.is_empty() {
                return Err("Initial roster needs an eligible opponent".into());
            }
        }
        if let Some(source) = &c.baseline_campaign {
            let previous = storage::read(&source.join("state.json"))?;
            if previous["protocol"] != "paired-v1"
                || previous["inputs"] != s["inputs"]
                || previous["runtime"] != s["runtime"]
                || previous["commands"] != s["commands"]
            {
                return Err("Imported baseline implementation or inputs differ".into());
            }
            let mut reused = 0_u64;
            for (key, job) in previous["jobs"]
                .as_object()
                .ok_or("Missing imported jobs")?
            {
                if job["status"] != "completed" || job["epoch"] != s["epoch"] {
                    continue;
                }
                let directory = Path::new(xml::text(&job["directory"])?);
                if job["evidence_sha256"] != storage::evidence_digest(directory)? {
                    return Err("Imported baseline evidence changed".into());
                }
                let expected = identity::digest(
                    &json!({"protocol":"paired-seed-v1","inputs":s["inputs"],"matches":c.matches,"opponent_deck":job["opponent_deck"],"opponent":job["opponent"]}),
                );
                if job["result"]["sample"]["pairing"] != expected {
                    return Err("Imported baseline schedule differs".into());
                }
                let mut sample =
                    scoring::sample(Path::new(xml::text(&job["result"]["run"])?), c.matches)?;
                sample["pairing"] = json!(expected);
                if sample != job["result"]["sample"] {
                    return Err("Imported baseline sample differs".into());
                }
                s["jobs"][key] = job.clone();
                reused += c.matches * 4;
            }
            if reused == 0 {
                return Err("No compatible completed baseline batches to import".into());
            }
            s["reused_games"] = json!(reused);
            s["baseline_source"] = json!(source);
        }
        storage::save(
            &c.output.join("configuration.json"),
            &json!({"configuration":c,"protocol":"paired-v1; baseline reuse; strictly higher saved paired-match win rate; supervised-v2; first deck target only; immutable initial opponents; self-play allowed; equal-deck/equal-version;  draws count as nonwins; no adaptive samples; top-three; refresh10/end/epoch; hash ties; ranking common intersection","runtime":s["runtime"],"inputs":s["inputs"],"fixed_decks":c.decks.iter().map(|d|Ok(json!({"id":d.id,"ydk":fs::read_to_string(&d.deck)?}))).collect::<Result<Vec<Value>>>()?}),
        )?;
        storage::save(&c.output.join("state.json"), &s)?;
        s
    };
    let stop = Arc::new(AtomicBool::new(false));
    let flag = stop.clone();
    ctrlc::set_handler(move || flag.store(true, Ordering::SeqCst))?;
    let mut campaign = Campaign { c, s, stop };
    if resume {
        recovery::rollback_interrupted(&campaign.c, &mut campaign.s)?;
    }
    campaign.guard()?;
    if campaign.s["status"] == "completed" {
        report::write(&campaign.c, &campaign.s)?;
        return Ok(0);
    }
    campaign.s["status"] = json!("running");
    campaign.save()?;
    let result = (|| -> Result<()> {
        for d in campaign.c.decks.clone() {
            let id = campaign.s["decks"][&d.id]["incumbent"]
                .as_str()
                .unwrap()
                .to_owned();
            campaign.checks(&id, &campaign.c.output)?;
        }
        // Initial launch only freezes packages. Each explicit resume advances once.
        if resume {
            campaign.advance()?;
        }
        Ok(())
    })();
    campaign.s["status"] = json!(if result.is_ok() {
        if campaign.s["next_stage"] == "done" {
            "completed"
        } else {
            "paused"
        }
    } else {
        "incomplete"
    });
    campaign.s["reason"] = json!(result.err().map(|e| e.to_string()));
    campaign.save()?;
    report::write(&campaign.c, &campaign.s)?;
    println!("{}", campaign.c.output.display());
    Ok(if campaign.s["status"] != "incomplete" {
        0
    } else {
        2
    })
}

fn budget_extension(before: &Value, after: &Value) -> Result<()> {
    let mut normalized = after.clone();
    for key in [
        "max_games",
        "max_wall_ms",
        "max_bytes",
        "max_retries",
        "max_fixes",
    ] {
        if after[key].as_u64().ok_or("Invalid budget")?
            < before[key].as_u64().ok_or("Missing original budget")?
        {
            return Err("Resume budgets may only increase".into());
        }
        normalized[key] = before[key].clone();
    }
    if &normalized != before {
        return Err("Resume configuration mismatch outside resource ceilings".into());
    }
    Ok(())
}
#[cfg(test)]
mod checkpoint_tests {
    use super::*;
    #[test]
    fn extension_never_changes_experiment_or_resets_consumption() {
        let old = json!({"matches":10,"rounds":100,"max_games":100,"max_wall_ms":100,"max_bytes":100,"max_retries":1,"max_fixes":1});
        let mut next = old.clone();
        next["max_games"] = json!(200);
        assert!(budget_extension(&old, &next).is_ok());
        next["matches"] = json!(20);
        assert!(budget_extension(&old, &next).is_err());
        next = old.clone();
        next["max_retries"] = json!(0);
        assert!(budget_extension(&old, &next).is_err());
    }
}

/// Explicit format migration, with old runtime/evidence verified before deletion.
pub fn migrate_run(directory: &Path, previous_executable: &Path) -> Result<i32> {
    let lock = fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(directory.join("lock"))?;
    if unsafe { libc::flock(lock.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } != 0 {
        return Err("Run already running".into());
    }
    let mut state = storage::read(&directory.join("state.json"))?;
    let config = storage::read(&directory.join("configuration.json"))?;
    let mut c: Config = serde_json::from_value(
        state
            .get("latest_configuration")
            .cloned()
            .unwrap_or(config["configuration"].clone()),
    )?;
    c.output = directory.canonicalize()?;
    if state["runtime"] != crate::application_identity::digest_for(previous_executable)?
        || state["inputs"] != input_identity(&c)?
        || state["commands"] != c.command_identity()?
    {
        return Err("Pre-migration identity mismatch".into());
    }
    for job in state["jobs"].as_object().ok_or("Missing jobs")?.values() {
        if job["status"] == "completed"
            && job["evidence_sha256"]
                != storage::evidence_digest(Path::new(xml::text(&job["directory"])?))?
        {
            if !directory.join("run.json").exists()
                || !directory.join("hierarchy-migration.json").exists()
            {
                return Err("Pre-migration evidence changed".into());
            }
            // Resume our interrupted representation-only normalization. Verify
            // original per-game canonical hashes and scores before any writes.
            let run = std::path::PathBuf::from(xml::text(&job["result"]["run"])?);
            let manifest = xml::read(&run.join("manifest.xml"), "manifest")?;
            for n in 1..=c.matches {
                let id = format!("match-{n:06}");
                let base = run.join("matches").join(&id);
                let record = xml::read(&base.join("match.xml"), "match")?;
                let views = [
                    xml::read(&base.join("player-a.xml"), "player-report")?,
                    xml::read(&base.join("player-b.xml"), "player-report")?,
                ];
                crate::match_evidence::verify_evidence(&record, &views, &manifest, &id)?;
            }
            let mut sample = scoring::sample(&run, c.matches)?;
            sample["pairing"] = job["result"]["sample"]["pairing"].clone();
            if sample != job["result"]["sample"] {
                return Err("Interrupted normalization changed results".into());
            }
        }
    }
    crate::hierarchy::migrate(directory)?;
    for job in state["jobs"]
        .as_object_mut()
        .ok_or("Missing jobs")?
        .values_mut()
    {
        if job["status"] != "completed" {
            continue;
        }
        let run = std::path::PathBuf::from(xml::text(&job["result"]["run"])?);
        let manifest = xml::read(&run.join("manifest.xml"), "manifest")?;
        for n in 1..=c.matches {
            let id = format!("match-{n:06}");
            let base = run.join("matches").join(&id);
            let record = xml::read(&base.join("match.xml"), "match")?;
            let reports = [
                xml::read(&base.join("player-a.xml"), "player-report")?,
                xml::read(&base.join("player-b.xml"), "player-report")?,
            ];
            crate::match_evidence::verify_evidence(&record, &reports, &manifest, &id)?;
        }
        let mut sample = scoring::sample(&run, c.matches)?;
        sample["pairing"] = job["result"]["sample"]["pairing"].clone();
        if sample != job["result"]["sample"] {
            return Err("Post-migration results differ".into());
        }
        job["evidence_sha256"] = json!(storage::evidence_digest(Path::new(xml::text(
            &job["directory"]
        )?))?);
    }
    let migration = json!({"kind":"hierarchical-evidence-v1","previous_runtime":state["runtime"],"runtime":crate::application_identity::digest()?,"at_ms":now(),"results_verified":true});
    storage::save(&directory.join("hierarchy-migration.json"), &migration)?;
    state["runtime"] = migration["runtime"].clone();
    storage::save(&directory.join("state.json"), &state)?;
    if storage::read(&directory.join("run.json"))? != state {
        return Err("Checkpoint roundtrip mismatch".into());
    }
    if directory.join("state.json").exists() {
        fs::remove_file(directory.join("state.json"))?;
    }
    report::write(&c, &state)?;
    println!(
        "Migration complete; stage preserved: {}",
        state["next_stage"]
    );
    Ok(0)
}
