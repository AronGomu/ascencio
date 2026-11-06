//! XML analysis indexes refer to aggregate truth and concrete decision evidence.
use crate::xml::{self, Result};
use serde_json::{json, Value};
use std::path::Path;
pub fn decision_reference(run: &Path) -> Result<Option<Value>> {
    let directory = run.join("matches");
    if !directory.exists() {
        return Ok(None);
    }
    let mut matches = std::fs::read_dir(directory)?
        .map(|e| e.map(|e| e.path()))
        .collect::<std::io::Result<Vec<_>>>()?;
    matches.sort();
    for base in matches {
        for actor in ["a", "b"] {
            let path = base.join(format!("player-{actor}.xml"));
            let report = xml::read(&path, "player-report")?;
            for game in xml::items(&report["games"], "game") {
                if let Some(entry) = xml::items(&game["timeline"], "entry")
                    .into_iter()
                    .find(|e| e["kind"] == "decision")
                {
                    return Ok(Some(
                        json!({"path":path,"game_id":game["game_id"],"decision_id":entry["decision_id"]}),
                    ));
                }
            }
        }
    }
    Ok(None)
}
pub fn report(run: &Path, id: &str, bugs: &[String]) -> Result<Value> {
    let evidence = decision_reference(run)?;
    let investigations=evidence.map(|e|vec![json!({"observation":"Reason frequencies and legal opportunities are indexed in summary.xml decision_behavior and card_decisions.","hypothesis":"Repeated selection reasons may hide opportunities to distinguish available actions; inspect their actual constraints before changing policy.","evidence":{"reference":[e]},"suggested_next_step":"Inspect the cited choice and alternatives, then evaluate one policy revision against a fixed reference opponent."})]).unwrap_or_default();
    Ok(
        json!({"run_id":id,"manifest_path":"manifest.xml","summary_path":"summary.xml","configuration_description":"Fixed input deck; four sequential games; independent pre-side histories; Rust supervisor with frozen-core bridge.","results":{"metric_references":{"metric_reference":["results.a.game_win_rate","results.b.game_win_rate","results.by_stage","counts.matches_incomplete"]},"observations":{"observation":["Competitive denominators exclude infrastructure failures; completed games from incomplete matches remain valid observations."]}},"decision_investigations":{"investigation":investigations},"sideboarding":{"metric_reference":"sideboarding","observations":{"observation":"Exchanges preserve the original deck multiset and sizes; post-side associations are not causal effects."},"evidence":{}},"performance_and_reliability":{"metric_reference":["performance","reliability"],"bug_references":{"bug_id":bugs}},"comparison_references":{},"limitations":{"limitation":["Card/action rates are associations, not causal decision-quality estimates.","Opportunities count repeated decision prompts, not distinct strategic opportunities.","Decision latency quantiles use bounded logarithmic buckets with at most 0.1 percent relative width above one millisecond; game quantiles are exact nearest rank.","Headline uncertainty is match-cluster sandwich normal 95 percent, null below two clusters.","Symmetric self-play cannot establish strength improvement.","Progress keeps bounded identifier metadata (at most 40000 game IDs); timelines are retained for one match only.","Execution hosts are recycled every 100 matches to bound VM/module retention; per-game core handles are explicitly destroyed."]}}),
    )
}
