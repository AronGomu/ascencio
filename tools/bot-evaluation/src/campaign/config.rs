use crate::{
    improvement::{command_identity, storage},
    xml::Result,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::BTreeSet,
    path::{Path, PathBuf},
};
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Deck {
    pub id: String,
    pub deck: PathBuf,
    pub strategy: PathBuf,
    pub config: Value,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    pub evaluation: PathBuf,
    #[serde(default)]
    pub baseline_campaign: Option<PathBuf>,
    pub output: PathBuf,
    pub decks: Vec<Deck>,
    pub agent: Vec<String>,
    pub bug_agent: Vec<String>,
    pub checks: Vec<Vec<String>>,
    pub recovery_checks: Vec<Vec<String>>,
    pub command_inputs: Vec<PathBuf>,
    pub rounds: u64,
    #[serde(default = "fifty")]
    pub matches: u64,
    pub max_games: u64,
    pub max_wall_ms: u64,
    pub max_bytes: u64,
    pub agent_timeout_ms: u64,
    pub evaluation_timeout_ms: u64,
    pub check_timeout_ms: u64,
    pub recovery_timeout_ms: u64,
    pub max_retries: u64,
    pub max_fixes: u64,
}
fn fifty() -> u64 {
    50
}
impl Config {
    pub fn read(path: &Path) -> Result<Self> {
        let path = path.canonicalize()?;
        let base = path.parent().unwrap();
        let mut value = storage::read(&path)?;
        let policy: Value =
            serde_json::from_str(include_str!("../../../../config/bot-campaign-policy.json"))?;
        for (key, default) in policy["defaults"]
            .as_object()
            .ok_or("Missing policy defaults")?
        {
            if value.get(key).is_none() {
                value[key] = default.clone();
            }
        }
        if value.get("max_games").is_none() {
            let rounds = value["rounds"].as_u64().ok_or("Invalid rounds")?;
            let matches = value["matches"].as_u64().ok_or("Invalid matches")?;
            let decks = value["decks"].as_array().ok_or("Missing decks")?.len() as u64;
            let opponents = if decks <= 1 { 1 } else { decks - 1 };
            value["max_games"] = serde_json::json!(rounds
                .checked_mul(2)
                .and_then(|n| n.checked_add(2))
                .and_then(|n| n.checked_mul(opponents))
                .and_then(|n| n.checked_mul(matches))
                .and_then(|n| n.checked_mul(4))
                .ok_or("Game ceiling overflow")?);
        }
        let mut c: Self = serde_json::from_value(value)?;
        let evaluation = base.join(&c.evaluation);
        c.evaluation = if evaluation.exists() {
            evaluation.canonicalize()?
        } else {
            crate::hierarchy::physical(&evaluation).canonicalize()?
        };
        c.baseline_campaign = c
            .baseline_campaign
            .map(|p| base.join(p).canonicalize())
            .transpose()?;
        c.output = std::path::absolute(base.join(c.output))?;
        let mut ids = BTreeSet::new();
        for d in &mut c.decks {
            if d.id.is_empty()
                || !d
                    .id
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
                || !ids.insert(d.id.clone())
            {
                return Err("Invalid/duplicate deck id".into());
            }
            d.deck = base.join(&d.deck).canonicalize()?;
            d.strategy = base.join(&d.strategy).canonicalize()?;
            if d.config.as_object().is_none_or(|v| {
                v.contains_key("__campaign_package_json")
                    || v.values()
                        .any(|v| !(v.is_string() || v.is_number() || v.is_boolean()))
            }) {
                return Err("Package configuration must be scalar".into());
            }
        }
        for input in &mut c.command_inputs {
            *input = std::path::absolute(base.join(&input))?;
        }
        if c.decks.is_empty()
            || c.rounds == 0
            || c.matches == 0
            || c.matches > 10000
            || c.max_retries > 10
            || c.max_fixes > 100
        {
            return Err("Invalid roster/round/match/recovery limits".into());
        }
        if [
            c.max_games,
            c.max_wall_ms,
            c.max_bytes,
            c.agent_timeout_ms,
            c.evaluation_timeout_ms,
            c.check_timeout_ms,
            c.recovery_timeout_ms,
        ]
        .contains(&0)
        {
            return Err("Resource limits must be positive".into());
        }
        if c.checks.is_empty()
            || c.recovery_checks.is_empty()
            || c.commands().iter().any(|v| v.is_empty())
        {
            return Err("Agent and trusted validation commands required".into());
        }
        Ok(c)
    }
    pub fn commands(&self) -> Vec<Vec<String>> {
        [
            vec![self.agent.clone(), self.bug_agent.clone()],
            self.checks.clone(),
            self.recovery_checks.clone(),
        ]
        .concat()
    }
    pub fn command_identity(&self) -> Result<String> {
        command_identity::commands(&self.commands(), &self.command_inputs)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn single_target_configuration_defaults_to_fifty_and_accepts_override() {
        let mut value = json!({"evaluation":"evaluation.xml","output":"out","decks":[{"id":"goat","deck":"deck.ydk","strategy":"strategy.mjs","config":{}}],"agent":["agent"],"bug_agent":["bug"],"checks":[["check"]],"recovery_checks":[["check"]],"command_inputs":[],"rounds":1,"max_games":1000,"max_wall_ms":1000,"max_bytes":1000,"agent_timeout_ms":1000,"evaluation_timeout_ms":1000,"check_timeout_ms":1000,"recovery_timeout_ms":1000,"max_retries":0,"max_fixes":0});
        let defaults: Config = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(defaults.matches, 50);
        assert_eq!(defaults.decks.len(), 1);
        value["matches"] = json!(7);
        let explicit: Config = serde_json::from_value(value).unwrap();
        assert_eq!(explicit.matches, 7);
    }
}
