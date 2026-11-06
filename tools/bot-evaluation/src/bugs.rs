use crate::{
    identity,
    xml::{self, Result},
};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
pub struct BugStore {
    root: PathBuf,
    pub ids: Vec<String>,
    counts: std::collections::BTreeMap<String, u64>,
}
impl BugStore {
    pub fn new(root: &Path) -> Self {
        Self {
            root: root.to_owned(),
            ids: vec![],
            counts: Default::default(),
        }
    }
    pub fn restore(&mut self) -> Result<()> {
        let directory = self.root.join("bugs");
        if !directory.exists() {
            return Ok(());
        }
        for entry in std::fs::read_dir(directory)? {
            let path = entry?.path();
            let name = path.file_name().unwrap().to_string_lossy();
            if !name.ends_with(".xml") || name.ends_with(".diagnostics.xml") {
                continue;
            }
            let id = name.strip_suffix(".xml").ok_or("Invalid bug name")?;
            if !id.starts_with("bug-") || !id[4..].chars().all(|c| c.is_ascii_hexdigit()) {
                return Err("Invalid bug identity".into());
            }
            let diagnostics = path.with_file_name(format!("{id}.diagnostics.xml"));
            crate::streaming_xml::validate(&path, "bug-ticket")?;
            crate::streaming_xml::validate(&diagnostics, "diagnostics")?;
            let count = crate::streaming_xml::count(&diagnostics, "occurrence")?;
            if count != crate::streaming_xml::count(&path, "execution")? {
                return Err("Bug occurrence evidence mismatch".into());
            }
            if crate::streaming_xml::scalar(&path, "bug_id")? != id
                || crate::streaming_xml::scalar(&diagnostics, "bug_id")? != id
                || crate::streaming_xml::scalar(&path, "failure_signature")?
                    != crate::streaming_xml::scalar(&diagnostics, "failure_signature")?
                || crate::streaming_xml::scalar(&path, "occurrence_count")?.parse::<u64>()? != count
            {
                return Err("Bug metadata mismatch".into());
            }
            self.counts.insert(id.to_owned(), count);
            self.ids.push(id.to_owned());
        }
        self.ids.sort();
        Ok(())
    }
    pub fn record(
        &mut self,
        run: &str,
        match_id: &str,
        game_id: Option<&str>,
        phase: &str,
        failure: &Value,
        hash: Option<&str>,
        checkpoint: &Value,
    ) -> Result<String> {
        let category = failure["category"].as_str().unwrap_or("host_error");
        let signature = identity::digest(
            &json!({"category":category,"phase":phase,"prompt_kind":checkpoint["pending_prompt"]["kind"]}),
        );
        let id = format!("bug-{}", &signature[..16]);
        let ticket = self.root.join("bugs").join(format!("{id}.xml"));
        let diagnostics = self.root.join("bugs").join(format!("{id}.diagnostics.xml"));
        let count = self.counts.get(&id).copied().unwrap_or(0) + 1;
        let occurrence_id = format!("occurrence-{count:06}");
        let occurrence = json!({"occurrence_id":occurrence_id,"run_id":run,"match_id":match_id,"game_id":game_id,"phase":phase,"player":checkpoint["player"],"evidence_sha256":hash,"failure":failure,"identity":{"manifest":"../manifest.xml"},"last_checkpoint":checkpoint,"unavailable_evidence":{"reason":"Only acknowledged host frames are available; state after the last checkpoint was not queried."}});
        let single = json!({"bug_id":id,"classification":"privileged_debug_only","failure_signature":signature,"occurrences":{"occurrence":[occurrence]}});
        let execution = json!({"occurrence_id":occurrence_id,"run_id":run,"match_id":match_id,"game_id":game_id,"phase":phase,"player":checkpoint["player"],"partial_evidence_sha256":hash});
        if count > 1 {
            xml::validate("diagnostics", &xml::encode("diagnostics", &single)?)?;
            crate::streaming_xml::append(
                &diagnostics,
                "occurrences",
                "occurrence",
                &occurrence,
                None,
            )?;
            crate::streaming_xml::append(
                &ticket,
                "affected_executions",
                "execution",
                &execution,
                Some(count),
            )?;
            self.counts.insert(id.clone(), count);
            return Ok(id);
        }
        xml::write(&diagnostics, "diagnostics", &single)?;
        let executions = vec![execution];
        let document = json!({"bug_id":id,"title":format!("{category}: execution could not complete"),"status":"needs_diagnosis","failure_signature":signature,"occurrence_count":executions.len(),"expected_behavior":"Legal decisions and an authoritative game result within configured safety limits.","observed_behavior":failure["message"],"affected_executions":{"execution":executions},"environment":{"manifest_path":"../manifest.xml","identity_notes":"Pinned inputs, bot artifacts, runtime and hardware are in the immutable manifest."},"reproduction":{"reproducibility":"best_effort","starting_conditions_reference":{"path":format!("../matches/{match_id}/player-a.xml")},"last_action":checkpoint["attempted_response"],"pending_prompt_reference":checkpoint["pending_prompt"],"attempted_response_reference":checkpoint["attempted_response"],"observed_random_events_reference":{},"command_or_configuration":"../manifest.xml","missing_evidence":"Unacknowledged host execution and later random events are unavailable."},"attachments":{"reference":[{"path":format!("../matches/{match_id}/player-a.xml"),"classification":"player_a_perspective"},{"path":format!("../matches/{match_id}/player-b.xml"),"classification":"player_b_perspective"},{"path":format!("{id}.diagnostics.xml"),"classification":"privileged_debug_only"}]},"diagnosis":{"known_facts":{"observation":failure["message"]},"hypotheses":{},"next_investigation_step":"Inspect the last acknowledged prompt/response and both partial perspective timelines; reproduce under the saved input identities."},"acceptance_criteria":{"criterion":["Cover the captured case with a regression.","Fix the diagnosed cause and pass targeted checks.","Rerun the affected real-core scenario."]}});
        xml::write(&ticket, "bug-ticket", &document)?;
        if !self.ids.contains(&id) {
            self.ids.push(id.clone());
        }
        self.counts.insert(id.clone(), count);
        Ok(id)
    }
}
