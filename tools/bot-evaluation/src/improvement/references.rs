//! Proposals may cite only real games/decisions in the evidence supplied to them.
use crate::xml::{self, Result};
use serde_json::Value;
use std::path::{Path, PathBuf};
pub fn validate(references: &Value, current: &Value, history: &Value) -> Result<()> {
    let mut runs = vec![PathBuf::from(xml::text(&current["run"])?)];
    for record in history.as_array().ok_or("Missing history")? {
        for phase in ["incumbent_evidence", "development", "confirmation"] {
            if let Some(run) = record[phase]["run"].as_str() {
                runs.push(PathBuf::from(run));
            }
        }
    }
    let runs = runs
        .iter()
        .map(|p| p.canonicalize())
        .collect::<std::io::Result<Vec<_>>>()?;
    let references = references
        .as_array()
        .filter(|r| !r.is_empty())
        .ok_or("Proposal requires evidence references")?;
    for reference in references {
        let path = Path::new(xml::text(&reference["path"])?).canonicalize()?;
        let relative = runs
            .iter()
            .find_map(|run| path.strip_prefix(run).ok())
            .ok_or("Reference outside supplied evidence")?;
        let parts = relative.iter().collect::<Vec<_>>();
        if parts.len() != 3
            || parts[0] != "matches"
            || !(parts[2] == "player-a.xml" || parts[2] == "player-b.xml")
        {
            return Err("Reference must target a supplied actor-relative report".into());
        }
        let report = xml::read(&path, "player-report")?;
        validate_game(reference, &report)?;
    }
    Ok(())
}
fn validate_game(reference: &Value, report: &Value) -> Result<()> {
    let game_id = xml::text(&reference["game_id"])?;
    let game = xml::items(&report["games"], "game")
        .into_iter()
        .find(|g| g["game_id"] == game_id)
        .ok_or("Referenced game does not exist")?;
    if let Some(decision) = reference.get("decision_id") {
        let decision = xml::text(decision)?;
        if !xml::items(&game["timeline"], "entry")
            .into_iter()
            .any(|e| e["kind"] == "decision" && e["decision_id"] == decision)
        {
            return Err("Referenced decision does not exist in that game".into());
        }
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn rejects_invented_games_decisions_and_malformed_references() {
        let report = json!({"games":{"game":[{"game_id":"g1","timeline":{"entry":[{"kind":"decision","decision_id":"d1"}]}}]}});
        assert!(validate_game(&json!({"game_id":"g1","decision_id":"d1"}), &report).is_ok());
        assert!(validate_game(&json!({"game_id":"g1"}), &report).is_ok());
        for reference in [
            Value::Null,
            json!({"game_id":"invented"}),
            json!({"game_id":"g1","decision_id":"invented"}),
            json!({"game_id":"g1","decision_id":null}),
        ] {
            assert!(validate_game(&reference, &report).is_err());
        }
    }
}
