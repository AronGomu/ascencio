//! Quarantine at child-process boundaries; centrally validate and apply fixes.
use super::{now, Campaign};
use crate::{
    identity,
    improvement::{process, storage},
    xml::{self, Result},
};
use serde_json::json;
use std::{fs, path::Path, process::Command};
impl Campaign {
    pub(super) fn recover_pending(&mut self) -> Result<()> {
        let jobs = self.s["jobs"]
            .as_object()
            .unwrap()
            .iter()
            .filter(|(_, j)| j["status"] == "quarantined" && j["epoch"] == self.s["epoch"])
            .map(|(key, j)| {
                (
                    key.clone(),
                    j["attempts"].as_array().unwrap().last().unwrap().clone(),
                )
            })
            .collect::<Vec<_>>();
        for (key, attempt) in jobs {
            self.recover(
                &key,
                Path::new(xml::text(&attempt["directory"])?),
                xml::text(&attempt["error"])?,
            )?;
        }
        Ok(())
    }
    pub(super) fn recover(&mut self, job: &str, evidence: &Path, error: &str) -> Result<()> {
        self.limit(self.c.recovery_timeout_ms)?;
        let mut signatures = vec![];
        if let Ok(runs) = fs::read_dir(evidence.join("runs")) {
            for run in runs.flatten() {
                if let Ok(bugs) = fs::read_dir(run.path().join("bugs")) {
                    for bug in bugs.flatten() {
                        signatures.push(bug.file_name().to_string_lossy().to_string());
                    }
                }
            }
        }
        signatures.retain(|s| s.ends_with(".xml") && !s.ends_with(".diagnostics.xml"));
        signatures.sort();
        signatures.dedup();
        if signatures.is_empty() {
            let log = String::from_utf8_lossy(&storage::regular_bytes(
                &evidence.join("evaluation.log"),
                8 * 1024 * 1024,
            )?)
            .replace(&evidence.display().to_string(), "<attempt>");
            signatures.push(identity::digest(&json!({"error":error,"log":log})));
        }
        let signature = match signatures
            .iter()
            .map(|cause| identity::digest(&json!({"cause":cause,"epoch":self.s["epoch"]})))
            .find(|id| self.s["bugs"][id]["resolution"] != "transient")
        {
            Some(id) => id,
            None => return Ok(()),
        };
        if self.s["bugs"][&signature]["resolution"] == "unresolved" {
            return Err(format!("unresolved_bug: {signature}").into());
        }
        if self.s["bugs"][&signature].is_null()
            && self.s["bugs"].as_object().unwrap().len() as u64 >= self.c.max_fixes
        {
            return Err("recovery_budget".into());
        }
        loop {
            self.guard()?;
            let attempts = self.s["bugs"][&signature]["attempts"].as_u64().unwrap_or(0);
            if attempts > self.c.max_retries {
                return Err(format!("diagnosis_retry_budget: {signature}").into());
            }
            match self.diagnose_attempt(&signature, job, evidence, error, attempts + 1) {
                Ok(()) => return self.recover(job, evidence, error),
                Err(e) if e.to_string() == "epoch_changed" => return Err(e),
                Err(e) => {
                    // Cancellation leaves the running record intact. Resume
                    // replaces that interrupted attempt before reserving games.
                    self.guard()?;
                    self.s["bugs"][&signature]["status"] = json!("failed_attempt");
                    self.s["bugs"][&signature]["error"] = json!(e.to_string());
                    self.save()?;
                    if self.s["bugs"][&signature]["resolution"] == "unresolved" {
                        return Err(e);
                    }
                }
            }
        }
    }
    fn diagnose_attempt(
        &mut self,
        signature: &str,
        job: &str,
        evidence: &Path,
        error: &str,
        attempt: u64,
    ) -> Result<()> {
        let root_dir = self.c.output.join("recovery").join(signature);
        let dir = root_dir.join(format!("attempt-{attempt}"));
        fs::create_dir_all(&dir)?;
        let home = root_dir.join("agent-state");
        fs::create_dir_all(&home)?;
        let previous = self.s["bugs"][signature].clone();
        let request = json!({"kind":"bug_fix","bug_id":signature,"attempt":attempt,"previous":previous,"job":job,"evidence":evidence,"error":error,"epoch":self.s["epoch"],"required_model":"gpt-6.1-sol","required_effort":"high","repository":std::env::current_dir()?,"instructions":"Diagnose root cause from complete retained evaluator logs/XML. Continue the same logical bug session using retained previous attempts. Do not modify repository. Write fix.patch and response.json with diagnosis, root_cause (stable signature), resolution (fix|transient|unresolved), tests (regressions required). Fix only scripts/bot-evaluation/recoverable-strategy.mjs: self-contained adjustScore(score,input,choice), executed inside the isolated bot VM. This policy sees actor-relative inputs only. If the cause lies in protected host, legality, validation, sideboarding transactions, projection or engine code, return unresolved. Never alter frozen vendor, legality/validation/safeguards, campaign scoring, deck lists, or unrelated files. Shared fixes are applied centrally after this phase, validated, and start a new epoch. No approval prompts. If no safe fix exists return unresolved."});
        storage::save(&dir.join("request.json"), &request)?;
        if !previous.is_null() {
            self.s["abandoned"]
                .as_array_mut()
                .unwrap()
                .push(json!({"kind":"diagnosis_attempt","bug":signature,"attempt":previous}));
        }
        self.s["bugs"][signature] = json!({"status":"running","attempts":attempt,"job":job,"directory":dir,"epoch":self.s["epoch"],"created_ms":now()});
        self.save()?;
        let mut cmd = process::agent_with_state(&self.c.bug_agent, &dir, &home)?;
        cmd.env("BOT_AGENT_STATE", &home);
        process::execute(
            cmd,
            &self.c.output,
            &dir.join("agent.log"),
            self.limit(self.c.recovery_timeout_ms)?,
            self.c.max_bytes,
            &self.stop,
        )?;
        let response = storage::read(&dir.join("response.json"))?;
        let execution = storage::read(&home.join("session.json"))?;
        if execution["model"] != "gpt-6.1-sol"
            || execution["effort"] != "high"
            || execution["session_id"].as_str().is_none()
        {
            return Err("Required Sol 6.1 high bug agent unavailable".into());
        }
        let root = xml::text(&response["root_cause"])?;
        if root.trim().is_empty() {
            return Err("Bug diagnosis needs a root cause".into());
        }
        // A previously diagnosed root cause cannot spawn an unlimited fix loop.
        if self.s["bugs"].as_object().unwrap().iter().any(|(k, b)| {
            k != signature
                && b["root_cause"] == root
                && b["epoch"] == self.s["epoch"]
                && (b["resolution"] == "fixed" || b["resolution"] == "unresolved")
        }) {
            self.s["bugs"][signature]["resolution"] = json!("unresolved");
            self.save()?;
            return Err("duplicate_root_cause_unresolved".into());
        }
        self.s["bugs"][&signature]["root_cause"] = json!(root);
        self.s["bugs"][&signature]["execution"] = execution.clone();
        self.s["bugs"][&signature]["response"] = response.clone();
        self.save()?;
        match response["resolution"].as_str() {
            Some("transient") => {
                self.s["bugs"][&signature]["resolution"] = json!("transient");
                self.s["bugs"][&signature]["status"] = json!("completed");
                self.save()?;
                return Ok(());
            }
            Some("fix") => (),
            Some("unresolved") => {
                self.s["bugs"][signature]["resolution"] = json!("unresolved");
                self.s["bugs"][signature]["status"] = json!("completed");
                self.save()?;
                return Err("bug_agent_could_not_resolve".into());
            }
            _ => return Err("bug_agent_could_not_resolve".into()),
        }
        let patch = storage::regular_bytes(&dir.join("fix.patch"), 1024 * 1024)?;
        let paths = patch_paths(std::str::from_utf8(&patch)?)?;
        let originals = paths
            .iter()
            .map(|p| Ok((p.clone(), fs::read(p)?)))
            .collect::<Result<Vec<_>>>()?;
        let mut check = Command::new("git");
        check.args(["apply", "--check"]).arg(dir.join("fix.patch"));
        process::execute(
            check,
            &self.c.output,
            &dir.join("patch-check.log"),
            self.limit(self.c.check_timeout_ms)?,
            self.c.max_bytes,
            &self.stop,
        )?;
        storage::save(
            &dir.join("originals.json"),
            &json!(originals
                .iter()
                .map(|(path, bytes)| json!({"path":path,"bytes":bytes}))
                .collect::<Vec<_>>()),
        )?;
        // Record the prepared transaction before changing shared behavior. A crash
        // is explicitly incomplete and cannot resume under the old fingerprint.
        self.s["bugs"][&signature]["status"] = json!("applying_fix");
        self.save()?;
        let applied = (|| -> Result<()> {
            let mut apply = Command::new("git");
            apply.arg("apply").arg(dir.join("fix.patch"));
            process::execute(
                apply,
                &self.c.output,
                &dir.join("patch-apply.log"),
                self.limit(self.c.check_timeout_ms)?,
                self.c.max_bytes,
                &self.stop,
            )?;
            let policy = storage::regular_bytes(Path::new(REPAIR_SURFACE), 1024 * 1024)?;
            let source = std::str::from_utf8(&policy)?;
            if source.contains("import") || source.contains("require(") {
                return Err("Recovery policy must be self-contained".into());
            }
            let mut check =
                Command::new(std::env::var("ARO2_NODE").unwrap_or_else(|_| "node".into()));
            check.args([
                "--experimental-vm-modules",
                "scripts/bot-campaign/check-recovery.ts",
            ]);
            process::execute(
                check,
                &self.c.output,
                &dir.join("policy-check.log"),
                self.limit(self.c.check_timeout_ms)?,
                self.c.max_bytes,
                &self.stop,
            )?;
            for (i, args) in self.c.recovery_checks.iter().enumerate() {
                let mut cmd = Command::new(&args[0]);
                cmd.args(&args[1..]);
                process::execute(
                    cmd,
                    &self.c.output,
                    &dir.join(format!("regression-{i}.log")),
                    self.limit(self.c.check_timeout_ms)?,
                    self.c.max_bytes,
                    &self.stop,
                )?;
            }
            Ok(())
        })();
        if let Err(e) = applied {
            for (path, bytes) in originals {
                fs::write(path, bytes)?;
            }
            self.s["bugs"][&signature]["status"] = json!("failed_validation");
            self.save()?;
            return Err(e);
        }
        let new_runtime = crate::application_identity::digest()?;
        let old = self.s["runtime"].clone();
        let mut next = self.s.clone();
        next["epoch"] = json!(self.s["epoch"].as_u64().unwrap() + 1);
        next["runtime"] = json!(new_runtime);
        next["bugs"][signature]["resolution"] = json!("fixed");
        next["bugs"][signature]["status"] = json!("completed");
        let epoch = next["epoch"].clone();
        next["fixes"].as_array_mut().unwrap().push(json!({"bug":signature,"execution":execution,"old_runtime":old,"new_runtime":new_runtime,"epoch":epoch,"patch_sha256":identity::sha(&patch),"directory":dir}));
        let abandoned = next["active"].take();
        next["abandoned"]
            .as_array_mut()
            .unwrap()
            .push(json!({"reason":"shared_behavior_fix","round_attempt":abandoned}));
        next["pending_epoch_ranking"] = json!(true);
        storage::save(&self.c.output.join("state.json"), &next)?;
        self.s = next;
        Err("epoch_changed".into())
    }
}
const REPAIR_SURFACE: &str = "scripts/bot-evaluation/recoverable-strategy.mjs";
fn validate_patch_headers(patch: &str) -> Result<()> {
    let headers = patch
        .lines()
        .filter(|l| l.starts_with("diff --git "))
        .collect::<Vec<_>>();
    let old = patch
        .lines()
        .filter(|l| l.starts_with("--- "))
        .collect::<Vec<_>>();
    let new = patch
        .lines()
        .filter(|l| l.starts_with("+++ "))
        .collect::<Vec<_>>();
    if headers != [format!("diff --git a/{REPAIR_SURFACE} b/{REPAIR_SURFACE}")]
        || old != [format!("--- a/{REPAIR_SURFACE}")]
        || new != [format!("+++ b/{REPAIR_SURFACE}")]
        || [
            "GIT binary patch",
            "Binary files",
            "rename from",
            "new file mode",
            "deleted file mode",
            "old mode",
            "new mode",
        ]
        .iter()
        .any(|v| patch.contains(v))
    {
        return Err("Recovery patches must edit only the isolated scoring policy".into());
    }
    Ok(())
}
fn patch_paths(patch: &str) -> Result<Vec<String>> {
    validate_patch_headers(patch)?;
    let path = Path::new(REPAIR_SURFACE);
    if !fs::symlink_metadata(path)?.is_file()
        || path.canonicalize()? != std::env::current_dir()?.join(path)
    {
        return Err("Recovery surface must be an unaliased regular file".into());
    }
    Ok(vec![REPAIR_SURFACE.into()])
}

pub(super) fn rollback_interrupted(
    c: &super::config::Config,
    s: &mut serde_json::Value,
) -> Result<()> {
    for bug in s["bugs"]
        .as_object_mut()
        .ok_or("Missing bugs")?
        .values_mut()
    {
        if bug["status"] == "applying_fix" && bug["resolution"] != "fixed" {
            let dir = std::path::PathBuf::from(xml::text(&bug["directory"])?);
            let originals = storage::read(&dir.join("originals.json"))?;
            for original in originals.as_array().ok_or("Missing patch originals")? {
                let path = xml::text(&original["path"])?;
                // Reuse the allowed-path validator before writing retained backups.
                patch_paths(&format!(
                    "diff --git a/{path} b/{path}\n--- a/{path}\n+++ b/{path}\n"
                ))?;
                let bytes: Vec<u8> = serde_json::from_value(original["bytes"].clone())?;
                fs::write(path, bytes)?;
            }
            bug["status"] = json!("rolled_back_interrupted_fix");
        }
    }
    storage::save(&c.output.join("state.json"), s)
}

#[cfg(test)]
mod boundary_tests {
    use super::*;
    #[test]
    fn only_the_isolated_policy_is_a_repair_surface() {
        let policy=format!("diff --git a/{REPAIR_SURFACE} b/{REPAIR_SURFACE}\n--- a/{REPAIR_SURFACE}\n+++ b/{REPAIR_SURFACE}\n@@ -1 +1 @@\n-a\n+b\n");
        assert!(validate_patch_headers(&policy).is_ok());
        for protected in [
            "scripts/bot-evaluation/host.ts",
            "src/battle/worker/bot/sideboard.ts",
            "src/battle/worker/bot/generalist-bot.ts",
            "vendor/ocgcore-wasm/0.1.2/lib/ocgcore.sync.wasm",
        ] {
            assert!(validate_patch_headers(&policy.replace(REPAIR_SURFACE, protected)).is_err());
        }
        assert!(validate_patch_headers(&(policy.clone()+"diff --git a/scripts/bot-evaluation/host.ts b/scripts/bot-evaluation/host.ts\nGIT binary patch\n")).is_err());
        assert!(validate_patch_headers(&(policy + "old mode 100644\nnew mode 120000\n")).is_err());
    }
}
