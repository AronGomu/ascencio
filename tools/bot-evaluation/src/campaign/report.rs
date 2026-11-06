use super::config::Config;
use crate::{improvement::storage, xml::Result};
use serde_json::Value;
use std::fs;
pub fn write(c: &Config, s: &Value) -> Result<()> {
    let mut out=format!("# Multi-deck bot campaign\n\nStatus: **{}**. Completed **{} / {} rounds**. Reason: {}.\n\nThis campaign uses the existing sequential real-engine four-game evaluator. One logical agent per deck proposes from its accepted incumbent. Candidate and control batches are fresh, equally sized and share a frozen eligible pool. Draws remain nonwins. Promotion requires a positive lower bound from a predeclared two-sided 95% weighted match-cluster Hoeffding interval. This is per comparison, not a campaign-wide guarantee.\n\nConfiguration: [configuration.json](configuration.json). Full checkpoint: [state.json](state.json). Matches per opponent: {}. Reserved games (including interrupted/failed work): {}. Elapsed wall time: {} seconds. Epoch: {}.\n\n",s["status"],s["completed_rounds"],c.rounds,s["reason"],c.matches,s["reserved_games"],super::now().saturating_sub(s["started_ms"].as_u64().unwrap())/1000,s["epoch"]);
    out.push_str("## Final accepted packages\n\n| Deck | Logical agent | Accepted package |\n|---|---|---|\n");
    for d in &c.decks {
        let id = s["decks"][&d.id]["incumbent"].as_str().unwrap();
        out.push_str(&format!("| {} | {} | [{}](versions/{}/package.json) — [simulator module](versions/{}/bot.mjs) |\n",d.id,s["decks"][&d.id]["agent_id"],id,id,id));
    }
    out.push_str("\nPortable simulator modules and their configurations are in [final/packages.json](final/packages.json) after completion.\n");
    out.push_str("\n## Decisions under comparable conditions\n\nEach row identifies its round's frozen pool and epoch. Scores across different rows/pools are not a fixed-benchmark progression.\n\n| Round | Epoch | Deck | Outcome | Candidate / incumbent score | 95% difference interval | Pre-side C/I | Post-side C/I | Evidence |\n|---|---|---|---|---|---|---|---|---|\n");
    for r in s["rounds"].as_array().unwrap() {
        for d in &c.decks {
            let rec = &r["decisions"][&d.id];
            let a = &rec["comparison"]["assessment"];
            out.push_str(&format!("| {} | {} | {} | {} | {} / {} | [{}, {}] | {} / {} | {} / {} | [round](round-{:04}.json) |\n",r["round"],r["epoch"],d.id,rec["outcome"],a["candidate"]["score"],a["incumbent"]["score"],a["lower"],a["upper"],a["candidate"]["pre_side"],a["incumbent"]["pre_side"],a["candidate"]["post_side"],a["incumbent"]["post_side"],r["round"].as_u64().unwrap()));
        }
    }
    out.push_str("\nUnassessable comparisons have no score or interval (shown as null); the incumbent is retained. If a ranking intersection is empty, its record lists all considered versions and exclusions, retains the prior pool with provenance, and assigns no scores.\n\n## Pools, recovery and costs\n\n");
    for rank in s["rankings"].as_array().unwrap() {
        out.push_str(&format!("- Epoch {}, refresh {}: [conditions, exclusions, scores and tie breaks](ranking-e{}-{}.json).\n",rank["epoch"],rank["label"],rank["epoch"],rank["label"].as_str().unwrap()));
    }
    let jobs = s["jobs"].as_object().unwrap();
    let completed = jobs.values().filter(|j| j["status"] == "completed").count();
    let abandoned = jobs
        .values()
        .flat_map(|j| j["attempts"].as_array().unwrap())
        .filter(|a| a["status"] == "abandoned_interrupted")
        .count();
    out.push_str(&format!("\nCompleted evaluation batches: {completed}. Reserved matches: {}. Interrupted attempts: {abandoned}. Bug records: {}. Shared fixes: {}. Retained storage: {} bytes. Agent requests and session execution identities are retained in proposals/ and agents/. Failed comparisons, quarantine and superseding retries are retained in evaluations/ and state.json; fixes and regression logs are in recovery/.\n\n",s["reserved_games"].as_u64().unwrap()/4,s["bugs"].as_object().unwrap().len(),s["fixes"].as_array().unwrap().len(),storage::size(&c.output)?));
    let mut input = 0_u64;
    let mut cached = 0_u64;
    let mut output = 0_u64;
    let mut measured = 0_u64;
    for proposal in s["proposals"].as_object().unwrap().values() {
        let usage = &proposal["result"]["session"]["usage"];
        if let Some(tokens) = usage["input_tokens"].as_u64() {
            input += tokens;
            cached += usage["cached_input_tokens"].as_u64().unwrap_or(0);
            output += usage["output_tokens"].as_u64().unwrap_or(0);
            measured += 1;
        }
    }
    out.push_str(&format!("Reported usage for {measured} completed deck-agent turns: {input} input tokens (including {cached} cached), {output} output tokens. Failed attempts and recovery-agent usage remain in their logs and execution records; these totals are not a complete billing estimate.\n\n"));
    out.push_str("## Limits of conclusions\n\nZero accepted improvements is valid. Small samples can be inconclusive even when the point estimate improves; this conservative bound remains nonzero for degenerate samples. Scores use equal weights across eligible opponent decks and then versions. Ranking uses the intersection of eligible opponents across all compared versions, with ascending content-hash ties. Ranking membership never activates a rejected package. Changing opponent pools and evaluation epochs must not be interpreted as fixed-benchmark learning curves. Only completed comparisons enter a decision. A partial campaign does not satisfy 100-round acceptance.\n");
    fs::write(c.output.join("report.md"), out)?;
    Ok(())
}
