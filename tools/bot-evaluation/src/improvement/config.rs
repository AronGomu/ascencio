use crate::xml::Result;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
};
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    pub evaluation: PathBuf,
    pub initial_strategy: PathBuf,
    pub output: PathBuf,
    pub agent: Vec<String>,
    pub checks: Vec<Vec<String>>,
    pub command_inputs: Vec<PathBuf>,
    pub max_iterations: u64,
    pub max_games: u64,
    pub max_no_improvement: u64,
    pub development_matches: u64,
    pub confirmation_matches: u64,
    pub max_wall_ms: u64,
    pub agent_timeout_ms: u64,
    pub check_timeout_ms: u64,
    pub evaluation_timeout_ms: u64,
    pub max_bytes: u64,
}
impl Config {
    pub fn read(file: &Path) -> Result<Self> {
        let file = file.canonicalize()?;
        let base = file.parent().unwrap();
        let mut c: Self = serde_json::from_slice(&fs::read(&file)?)?;
        c.evaluation = base.join(&c.evaluation).canonicalize()?;
        c.initial_strategy = base.join(&c.initial_strategy).canonicalize()?;
        c.output = base.join(&c.output);
        c.command_inputs = c.command_inputs.iter().map(|p| base.join(p)).collect();
        if c.agent.is_empty() || c.checks.is_empty() || c.checks.iter().any(Vec::is_empty) {
            return Err("Agent and trusted targeted checks required".into());
        }
        if [
            c.max_iterations,
            c.max_games,
            c.max_no_improvement,
            c.development_matches,
            c.confirmation_matches,
            c.max_wall_ms,
            c.agent_timeout_ms,
            c.check_timeout_ms,
            c.evaluation_timeout_ms,
            c.max_bytes,
        ]
        .contains(&0)
            || c.development_matches > 10000
            || c.confirmation_matches > 10000
        {
            return Err("Invalid finite loop limits".into());
        }
        Ok(c)
    }
}
