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
    pub output: PathBuf,
    pub decks: Vec<Deck>,
    pub agent: Vec<String>,
    pub bug_agent: Vec<String>,
    pub checks: Vec<Vec<String>>,
    pub recovery_checks: Vec<Vec<String>>,
    pub command_inputs: Vec<PathBuf>,
    pub rounds: u64,
    #[serde(default = "ten")]
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
fn ten() -> u64 {
    10
}
impl Config {
    pub fn read(path: &Path) -> Result<Self> {
        let path = path.canonicalize()?;
        let base = path.parent().unwrap();
        let mut c: Self = serde_json::from_value(storage::read(&path)?)?;
        c.evaluation = base.join(c.evaluation).canonicalize()?;
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
        if c.decks.len() < 2
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
