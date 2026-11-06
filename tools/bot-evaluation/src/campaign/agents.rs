use super::{archive, now, Campaign};
use crate::{
    improvement::{process, references, storage},
    xml::{self, Result},
};
use serde_json::{json, Value};
use std::{fs, path::Path};
impl Campaign {
    pub(super) fn propose(&mut self, round: u64, deck: &str, diagnostic: &Value) -> Result<Value> {
        loop {
            match self.propose_once(round, deck, diagnostic) {
                Ok(v) => return Ok(v),
                Err(error) => {
                    self.guard()?;
                    let key = format!("r{round}-{deck}");
                    let proposal = &self.s["proposals"][&key];
                    let attempts = proposal["attempts"].as_u64().unwrap_or(0);
                    // Once validated, the immutable package is the round's one
                    // proposal. Retry its checks on resume, never ask for another.
                    if proposal["status"] == "validated" || attempts == 0 {
                        return Err(error);
                    }
                    let failed = proposal.clone();
                    self.s["abandoned"].as_array_mut().unwrap().push(
                        json!({"kind":"agent_attempt","attempt":failed,"error":error.to_string()}),
                    );
                    self.s["proposals"][&key]["status"] = json!("failed");
                    self.s["proposals"][&key]["error"] = json!(error.to_string());
                    self.save()?;
                    if attempts > self.c.max_retries {
                        return Err(error);
                    }
                }
            }
        }
    }
    fn propose_once(&mut self, round: u64, deck: &str, diagnostic: &Value) -> Result<Value> {
        self.guard()?;
        let key = format!("r{round}-{deck}");
        if self.s["proposals"][&key]["status"] == "completed" {
            return Ok(self.s["proposals"][&key]["result"].clone());
        }
        if self.s["proposals"][&key]["status"] == "validated" {
            return self.finalize_proposal(
                &key,
                round,
                deck,
                self.s["proposals"][&key]["result"].clone(),
            );
        }
        let incumbent = self.s["decks"][deck]["incumbent"]
            .as_str()
            .unwrap()
            .to_owned();
        let logical_id = self.s["decks"][deck]["agent_id"].clone();
        let home = self.c.output.join("agents").join(deck);
        fs::create_dir_all(&home)?;
        let prior = self.s["proposals"][&key]["attempts"].as_u64().unwrap_or(0);
        if prior > self.c.max_retries {
            return Err("agent_retry_budget".into());
        }
        if prior > 0 && self.s["proposals"][&key]["status"] != "failed" {
            let interrupted = self.s["proposals"][&key].clone();
            self.s["abandoned"].as_array_mut().unwrap().push(json!({"kind":"agent_attempt","attempt":interrupted,"error":"interrupted_before_validation"}));
        }
        let dir = self
            .c
            .output
            .join("proposals")
            .join(&key)
            .join(format!("attempt-{}", prior + 1));
        fs::create_dir_all(&dir)?;
        let mut histories = vec![];
        let mut evidence = vec![];
        for job in self.s["jobs"].as_object().unwrap().values() {
            if job["status"] == "completed" && (job["deck"] == deck || job["opponent_deck"] == deck)
            {
                let actor = if job["deck"] == deck { "a" } else { "b" };
                let run = xml::text(&job["result"]["run"])?;
                for m in 1..=self.c.matches {
                    let path =
                        Path::new(run).join(format!("matches/match-{m:06}/player-{actor}.xml"));
                    let report = xml::read(&path, "player-report")?;
                    let games=xml::items(&report["games"],"game").iter().map(|g|json!({"game_id":g["game_id"],"outcome":g["result"]["outcome"],"decisions":xml::items(&g["timeline"],"entry").iter().filter(|e| e["kind"]=="decision").take(20).map(|e|e["decision_id"].clone()).collect::<Vec<_>>()})).collect::<Vec<_>>();
                    evidence.push(json!({"path":path,"epoch":job["epoch"],"version":if actor=="a" {&job["version"]} else {&job["opponent"]},"games":games}));
                }
                histories.push(json!({"incumbent_evidence":{"run":run}}));
            }
        }
        let index = home.join(format!("evidence-round-{round}.json"));
        storage::save(&index, &json!(evidence))?;
        let deck_config = self.c.decks.iter().find(|d| d.id == deck).unwrap();
        {
            fs::copy(
                self.c
                    .output
                    .join("versions")
                    .join(&incumbent)
                    .join("strategy.mjs"),
                dir.join("strategy.mjs"),
            )?;
            let (_, configuration) = archive::module(&self.c, &incumbent)?;
            storage::save(&dir.join("config.json"), &configuration)?;
            let handoff = json!({"logical_agent_id":logical_id,"round":round,"epoch":self.s["epoch"],"incumbent":incumbent,"fixed_deck_path":deck_config.deck,"fixed_deck_source":fs::read_to_string(&deck_config.deck)?,"evidence_index":index,"diagnostic":diagnostic,"previous_proposals":self.s["proposals"].as_object().unwrap().iter().filter(|(_,p)|p["deck"]==deck).map(|(k,v)|json!({"key":k,"directory":v["directory"],"response":v["result"]["response"],"candidate":v["result"]["candidate"]})).collect::<Vec<_>>(),"outcomes":self.s["rounds"].as_array().unwrap().iter().map(|r|json!({"round":r["round"],"epoch":r["epoch"],"outcome":r["decisions"][deck]["outcome"],"assessment":r["decisions"][deck]["comparison"]["assessment"],"evidence":self.c.output.join(format!("round-{:04}.json",r["round"].as_u64().unwrap()))})).collect::<Vec<_>>(),"rankings":self.s["rankings"].as_array().unwrap().iter().map(|r|json!({"label":r["label"],"epoch":r["epoch"],"selected":r["selected"][deck],"evidence":self.c.output.join(format!("ranking-e{}-{}.json",r["epoch"],r["label"].as_str().unwrap()))})).collect::<Vec<_>>(),"instructions":"Continue from accepted incumbent. Edit only strategy.mjs (self-contained createStrategy and optional sideboard) and scalar config.json. Do not change decks, legality, safeguards, shared runtime, evaluation or access hidden opponent state. Full actor-relative reports are linked by evidence_index. Return response.json: no_change boolean, nonempty diagnosis, evidence [{path, game_id, optional decision_id}], play_changes, sideboarding_changes, tests. No-change is valid. Do not invent tests/results. At most one proposal per round. Persist lessons in session context; history is retained."});
            storage::save(&home.join("handoff.json"), &handoff)?;
            storage::save(&dir.join("request.json"), &handoff)?;
            self.s["proposals"][&key] = json!({"status":"running","attempts":prior+1,"deck":deck,"directory":dir,"logical_agent_id":logical_id,"started_ms":now()});
            self.save()?;
            let mut permitted = evidence
                .iter()
                .map(|e| std::path::PathBuf::from(e["path"].as_str().unwrap()))
                .collect::<Vec<_>>();
            for version in self.s["decks"][deck]["versions"].as_array().unwrap() {
                for file in ["strategy.mjs", "package.json", "bot.mjs"] {
                    permitted.push(
                        self.c
                            .output
                            .join("versions")
                            .join(version["id"].as_str().unwrap())
                            .join(file),
                    );
                }
            }
            let mut cmd =
                process::deck_agent(&self.c.agent, &dir, &home, &self.c.output, &permitted)?;
            cmd.env("BOT_AGENT_STATE", &home);
            process::execute(
                cmd,
                &self.c.output,
                &dir.join("agent.log"),
                self.limit(self.c.agent_timeout_ms)?,
                self.c.max_bytes,
                &self.stop,
            )?;
            self.s["proposals"][&key]["status"] = json!("returned");
            self.save()?;
        }
        self.guard()?;
        let response = storage::read(&dir.join("response.json"))?;
        if response["no_change"].as_bool().is_none()
            || response["diagnosis"]
                .as_str()
                .is_none_or(|v| v.trim().is_empty())
        {
            return Err("Malformed proposal".into());
        }
        let session = storage::read(&home.join("session.json"))?;
        if session["session_id"].as_str().is_none_or(|s| s.is_empty())
            || session["model"].as_str().is_none()
        {
            return Err("Missing agent execution identity".into());
        }
        let mut result = json!({"response":response,"directory":dir,"logical_agent_id":logical_id,"session":session,"epoch":self.s["epoch"],"parent":incumbent});
        if response["no_change"] == false {
            for key in ["play_changes", "sideboarding_changes", "tests"] {
                if response[key].as_str().is_none_or(|v| v.trim().is_empty())
                    && response[key].as_array().is_none_or(|a| {
                        a.iter()
                            .any(|v| v.as_str().is_none_or(|v| v.trim().is_empty()))
                    })
                {
                    return Err("Incomplete proposal description".into());
                }
            }
            let allowed = evidence
                .iter()
                .map(|e| e["path"].as_str().unwrap())
                .collect::<Vec<_>>();
            for reference in response["evidence"]
                .as_array()
                .ok_or("Missing references")?
            {
                if !allowed.contains(&xml::text(&reference["path"])?) {
                    return Err("Evidence must use this deck's supplied perspective".into());
                }
            }
            let current = diagnostic["results"]
                .as_array()
                .and_then(|a| a.first())
                .ok_or("No diagnostic")?;
            references::validate(&response["evidence"], current, &json!(histories))?;
            let source = storage::regular_bytes(&dir.join("strategy.mjs"), 1024 * 1024)?;
            let config = storage::read(&dir.join("config.json"))?;
            if config.as_object().is_none_or(|o| {
                o.contains_key("__campaign_package_json")
                    || o.values()
                        .any(|v| !(v.is_string() || v.is_number() || v.is_boolean()))
            }) {
                return Err("Invalid package config".into());
            }
            let id = archive::package(&self.c, &source, &config)?;
            result["candidate"] = json!(id);
        }
        // Files merely existing is not acceptance. Persist a validated response
        // and archived package before running resumable trusted checks.
        self.s["proposals"][&key]["status"] = json!("validated");
        self.s["proposals"][&key]["result"] = result.clone();
        self.save()?;
        self.finalize_proposal(&key, round, deck, result)
    }
    fn finalize_proposal(
        &mut self,
        key: &str,
        round: u64,
        deck: &str,
        mut result: Value,
    ) -> Result<Value> {
        let dir = std::path::PathBuf::from(xml::text(&result["directory"])?);
        let incumbent = xml::text(&result["parent"])?.to_owned();
        let mut next = self.s.clone();
        if let Some(id) = result["candidate"].as_str().map(str::to_owned) {
            // The returned package is immutable even when its trusted checks fail.
            archive::verify_one(&self.c.output.join("versions").join(&id), &id)?;
            let checked = self.checks(&id, &dir);
            archive::register(&mut next, deck, &id, round, &incumbent, result.clone());
            if let Err(error) = checked {
                self.limit(self.c.check_timeout_ms)?;
                for v in next["decks"][deck]["versions"].as_array_mut().unwrap() {
                    if v["id"] == id {
                        v["valid"] = json!(false);
                    }
                }
                result["invalid_candidate"] = result["candidate"].take();
                result["validation_failure"] = json!(error.to_string());
            }
        }
        storage::save(&dir.join("proposal.json"), &result)?;
        next["proposals"][key]["status"] = json!("completed");
        next["proposals"][key]["result"] = result.clone();
        next["proposals"][key]["evidence_sha256"] = json!(storage::evidence_digest(&dir)?);
        storage::save(&self.c.output.join("state.json"), &next)?;
        self.s = next;
        Ok(result)
    }
}
