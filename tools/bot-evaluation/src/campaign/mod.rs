//! Multi-deck state machine. Only this supervisor schedules evaluator children.
mod agents;
mod archive;
mod config;
mod evaluation;
mod pool;
mod recovery;
mod report;
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
        for deck in self.c.decks.clone() {
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
        s["pool"] = next;
        s["rankings"].as_array_mut().unwrap().push(record);
        storage::save(&self.c.output.join("state.json"), &s)?;
        self.s = s;
        Ok(())
    }
    fn round(&mut self, round: u64) -> Result<()> {
        self.guard()?;
        let epoch = self.s["epoch"].as_u64().unwrap();
        let frozen = if self.s["active"].is_null() {
            self.s["active"] =
                json!({"round":round,"epoch":epoch,"pool":self.s["pool"],"started_ms":now()});
            self.save()?;
            self.s["pool"].clone()
        } else {
            self.s["active"]["pool"].clone()
        };
        let mut diagnostics = json!({});
        for d in self.c.decks.clone() {
            let id = self.s["decks"][&d.id]["incumbent"]
                .as_str()
                .unwrap()
                .to_owned();
            let (opponents, excluded) = pool::eligible(&self.s, &frozen, &d.id, &[id.clone()])?;
            if opponents.is_empty() {
                return Err(format!("No diagnostic support for {}", d.id).into());
            }
            let rows = self.gauntlet(
                &format!("r{round}-diagnostic-{}", d.id),
                &d.id,
                &id,
                &opponents,
            )?;
            diagnostics[&d.id] = json!({"results":rows,"excluded":excluded});
        }
        let mut decisions = json!({});
        let mut incumbents = json!({});
        for d in self.c.decks.clone() {
            let incumbent = self.s["decks"][&d.id]["incumbent"]
                .as_str()
                .unwrap()
                .to_owned();
            let proposal = self.propose(round, &d.id, &diagnostics[&d.id])?;
            let mut record =
                json!({"incumbent":incumbent,"proposal":proposal,"outcome":"no_change"});
            if !proposal["invalid_candidate"].is_null() {
                record["outcome"] = json!("rejected_invalid_package");
            }
            let mut accepted = incumbent.clone();
            if let Some(candidate) = proposal["candidate"].as_str() {
                record["outcome"] = json!("unchanged_package");
                if candidate != incumbent {
                    let (opponents, excluded) = pool::eligible(
                        &self.s,
                        &frozen,
                        &d.id,
                        &[incumbent.clone(), candidate.to_owned()],
                    )?;
                    if opponents.is_empty() {
                        record["outcome"] = json!("unassessable_no_common_opponents");
                        record["comparison"] = json!({"candidate":[],"incumbent":[],"excluded":excluded,"assessment":null});
                        incumbents[&d.id] = json!(accepted);
                        decisions[&d.id] = record;
                        continue;
                    }
                    let candidate_rows = self.gauntlet(
                        &format!("r{round}-candidate-{}", d.id),
                        &d.id,
                        candidate,
                        &opponents,
                    )?;
                    let incumbent_rows = self.gauntlet(
                        &format!("r{round}-control-{}", d.id),
                        &d.id,
                        &incumbent,
                        &opponents,
                    )?;
                    let assessment = scoring::promotion(&candidate_rows, &incumbent_rows)?;
                    let promoted = assessment["supported"] == true;
                    record["outcome"] = json!(if promoted {
                        "promoted"
                    } else {
                        "rejected_regression_or_inconclusive"
                    });
                    record["comparison"] = json!({"candidate":candidate_rows,"incumbent":incumbent_rows,"excluded":excluded,"assessment":assessment});
                    if promoted {
                        accepted = candidate.to_owned();
                    }
                }
            }
            incumbents[&d.id] = json!(accepted);
            decisions[&d.id] = record;
        }
        // Ranking never activates a rejected version. All decisions are committed
        // together only after final-round ranking and evidence persistence succeed.
        if round % 10 == 0 || round == self.c.rounds {
            self.rank(&format!("round-{round}"))?;
        }
        let record = json!({"round":round,"epoch":epoch,"pool":frozen,"diagnostics":diagnostics,"decisions":decisions,"completed_ms":now()});
        storage::save(
            &self.c.output.join(format!("round-{round:04}.json")),
            &record,
        )?;
        let mut s = self.s.clone();
        for d in &self.c.decks {
            s["decks"][&d.id]["incumbent"] = incumbents[&d.id].clone();
        }
        s["rounds"].as_array_mut().unwrap().push(record);
        s["completed_rounds"] = json!(round);
        s["active"] = Value::Null;
        storage::save(&self.c.output.join("state.json"), &s)?;
        self.s = s;
        report::write(&self.c, &self.s)?;
        println!(
            "completed round {round}/{}; reserved {} games",
            self.c.rounds, self.s["reserved_games"]
        );
        Ok(())
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
    let exists = c.output.join("state.json").exists();
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
        let mut s = json!({"configuration_sha256":fingerprint,"commands":c.command_identity()?,"inputs":input_identity(&c)?,"runtime":crate::application_identity::digest()?,"epoch":0,"started_ms":now(),"status":"running","reason":null,"completed_rounds":0,"reserved_games":0,"decks":{},"pool":{},"jobs":{},"proposals":{},"rounds":[],"rankings":[],"fixes":[],"bugs":{},"abandoned":[],"active":null});
        for d in &c.decks {
            let id = archive::package(
                &c,
                &storage::regular_bytes(&d.strategy, 1024 * 1024)?,
                &d.config,
            )?;
            s["decks"][&d.id] = json!({"incumbent":id,"agent_id":format!("deck-{}-{}",d.id,now()),"versions":[{"id":id,"round":0,"parent":null,"valid":true}]});
            s["pool"][&d.id] = json!([id]);
        }
        for d in &c.decks {
            let (opponents, _) = pool::eligible(
                &s,
                &s["pool"],
                &d.id,
                &[s["decks"][&d.id]["incumbent"].as_str().unwrap().to_owned()],
            )?;
            if opponents.is_empty() {
                return Err(
                    "Initial roster needs nonidentical eligible opponents for every deck".into(),
                );
            }
        }
        storage::save(
            &c.output.join("configuration.json"),
            &json!({"configuration":c,"protocol":"equal-deck/equal-version; weighted independent match-cluster Hoeffding two-sided 95%; draws count as nonwins; no adaptive samples; top-three; refresh10/end/epoch; hash ties; ranking common intersection","runtime":s["runtime"],"inputs":s["inputs"],"fixed_decks":c.decks.iter().map(|d|Ok(json!({"id":d.id,"ydk":fs::read_to_string(&d.deck)?}))).collect::<Result<Vec<Value>>>()?}),
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
        loop {
            match campaign.recover_pending() {
                Err(e) if e.to_string() == "epoch_changed" => continue,
                result => result?,
            }
            if campaign.s["pending_epoch_ranking"] == true {
                match campaign.rank(&format!("epoch-{}", campaign.s["epoch"])) {
                    Err(e) if e.to_string() == "epoch_changed" => continue,
                    result => result?,
                }
                campaign.s["pending_epoch_ranking"] = json!(false);
                campaign.save()?;
            }
            let round = campaign.s["completed_rounds"].as_u64().unwrap() + 1;
            if round > campaign.c.rounds {
                break;
            }
            match campaign.round(round) {
                Ok(()) => (),
                Err(e) if e.to_string() == "epoch_changed" => continue,
                Err(e) => return Err(e),
            }
        }
        let mut export = std::process::Command::new(
            std::env::var("ARO2_NODE").unwrap_or_else(|_| "node".into()),
        );
        export
            .arg("scripts/bot-campaign/export-packages.ts")
            .arg(&campaign.c.output);
        process::execute(
            export,
            &campaign.c.output,
            &campaign.c.output.join("export.log"),
            campaign.limit(campaign.c.check_timeout_ms)?,
            campaign.c.max_bytes,
            &campaign.stop,
        )?;
        let packages = storage::read(&campaign.c.output.join("final/packages.json"))?;
        campaign.s["exports"] = packages;
        Ok(())
    })();
    campaign.s["status"] = json!(if result.is_ok() {
        "completed"
    } else {
        "incomplete"
    });
    campaign.s["reason"] = json!(result.err().map(|e| e.to_string()));
    campaign.save()?;
    report::write(&campaign.c, &campaign.s)?;
    println!("{}", campaign.c.output.display());
    Ok(if campaign.s["status"] == "completed" {
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
