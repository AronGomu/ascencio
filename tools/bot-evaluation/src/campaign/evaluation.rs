use super::{archive, scoring, Campaign};
use crate::{
    improvement::{process, storage},
    xml::{self, Result},
};
use serde_json::{json, Value};
use std::{fs, path::Path, process::Command};
impl Campaign {
    pub(super) fn evaluate(
        &mut self,
        key: &str,
        deck: &str,
        id: &str,
        op_deck: &str,
        op_id: &str,
    ) -> Result<Value> {
        self.guard()?;
        let key = format!("e{}-{key}", self.s["epoch"]);
        if self.s["jobs"][&key]["status"] == "completed" {
            return Ok(self.s["jobs"][&key]["result"].clone());
        }
        if self.s["jobs"][&key]["status"] == "quarantined" {
            let previous = self.s["jobs"][&key]["attempts"]
                .as_array()
                .unwrap()
                .last()
                .unwrap()
                .clone();
            self.recover(
                &key,
                Path::new(xml::text(&previous["directory"])?),
                xml::text(&previous["error"])?,
            )?;
        }
        let mut attempts = self.s["jobs"][&key]["attempts"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        // Interrupted reservations count against both retry and game budgets.
        if self.s["jobs"][&key]["status"] == "running" {
            if let Some(last) = attempts.last_mut() {
                last["status"] = json!("abandoned_interrupted");
            }
        }
        while attempts.len() as u64 <= self.c.max_retries {
            let count = self.c.matches.checked_mul(4).ok_or("game_budget")?;
            let total = self.s["reserved_games"]
                .as_u64()
                .unwrap()
                .checked_add(count)
                .ok_or("game_budget")?;
            if total > self.c.max_games {
                return Err("game_budget".into());
            }
            let dir = self
                .c
                .output
                .join("evaluations")
                .join(&key)
                .join(format!("attempt-{}", attempts.len() + 1));
            fs::create_dir_all(&dir)?;
            let mut doc = xml::read(&self.c.evaluation, "evaluation")?;
            let base = self.c.evaluation.parent().unwrap();
            for (outer, inner) in [("rules", "banlist"), ("content", "snapshot")] {
                doc[outer][inner] =
                    json!(base.join(xml::text(&doc[outer][inner])?).canonicalize()?);
            }
            doc["deck"] =
                json!({"path":self.c.decks.iter().find(|d|d.id==deck).ok_or("Unknown deck")?.deck});
            doc["opponent_deck"] = json!({"path":self.c.decks.iter().find(|d|d.id==op_deck).ok_or("Unknown opponent deck")?.deck});
            let (a, ac) = archive::module(&self.c, id)?;
            let (b, bc) = archive::module(&self.c, op_id)?;
            doc["bots"] = json!({"a":{"module":a,"config":{"__campaign_package_json":serde_json::to_string(&ac)?}},"b":{"module":b,"config":{"__campaign_package_json":serde_json::to_string(&bc)?}}});
            doc["batch"]["matches"] = json!(self.c.matches);
            doc["output"]["directory"] = json!(dir.join("runs"));
            let config = dir.join("evaluation.xml");
            xml::write(&config, "evaluation", &doc)?;
            attempts.push(json!({"directory":dir,"status":"running","reserved_games":count}));
            self.s["jobs"][&key] = json!({"status":"running","attempts":attempts,"deck":deck,"version":id,"opponent_deck":op_deck,"opponent":op_id,"epoch":self.s["epoch"]});
            self.s["reserved_games"] = json!(total);
            self.save()?;
            let result = (|| -> Result<Value> {
                let mut cmd = Command::new(std::env::current_exe()?);
                cmd.args(["evaluate", "--config"]).arg(&config);
                process::execute(
                    cmd,
                    &self.c.output,
                    &dir.join("evaluation.log"),
                    self.limit(self.c.evaluation_timeout_ms)?,
                    self.c.max_bytes,
                    &self.stop,
                )?;
                let paths = fs::read_dir(dir.join("runs"))?.collect::<std::io::Result<Vec<_>>>()?;
                if paths.len() != 1 {
                    return Err("Expected one run".into());
                }
                let run = paths[0].path();
                let sample = scoring::sample(&run, self.c.matches)?;
                Ok(json!({"run":run,"sample":sample}))
            })();
            match result {
                Ok(result) => {
                    attempts.last_mut().unwrap()["status"] = json!("completed");
                    let hash = storage::evidence_digest(&dir)?;
                    self.s["jobs"][&key] = json!({"status":"completed","attempts":attempts,"deck":deck,"version":id,"opponent_deck":op_deck,"opponent":op_id,"epoch":self.s["epoch"],"directory":dir,"evidence_sha256":hash,"result":result});
                    self.save()?;
                    return Ok(result);
                }
                Err(e) => {
                    let message = e.to_string();
                    attempts.last_mut().unwrap()["status"] = json!("failed");
                    attempts.last_mut().unwrap()["error"] = json!(message);
                    self.s["jobs"][&key]["attempts"] = json!(attempts);
                    self.s["jobs"][&key]["status"] = json!("quarantined");
                    self.save()?;
                    self.limit(self.c.evaluation_timeout_ms)?;
                    // All evaluation failures enter recovery at this process boundary.
                    // The recovery agent may diagnose a transient error; only then
                    // can the declared bounded retry rerun the same conditions.
                    self.recover(&key, Path::new(&dir), &message)?;
                }
            }
        }
        Err(format!("retry_budget: {key}").into())
    }
}
