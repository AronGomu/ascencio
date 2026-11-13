//! Compact orchestrator handoff derived from the authoritative checkpoint.
use super::config::Config;
use crate::{improvement::storage, xml::Result};
use serde_json::Value;
use std::fs;

pub fn write(c: &Config, s: &Value) -> Result<()> {
    let number = |key: &str| s[key].as_u64().unwrap_or(0);
    let elapsed = super::now().saturating_sub(number("started_ms"));
    let bytes = storage::size(&c.output)?;
    let target = &c.decks[0].id;
    let incumbent = s["decks"][target]["incumbent"]
        .as_str()
        .ok_or("Missing incumbent")?;
    let mut out = format!(
        "# Campaign handoff\n\n## State\n\n| Field | Value |\n|---|---|\n| Status | {} |\n| Next stage | {} |\n| Stop reason | {} |\n| Target | {} |\n| Rounds completed | {} / {} |\n| Accepted AI | [{}](versions/{}/package.json) |\n| Comparison epoch | {} |\n\n",
        s["status"].as_str().unwrap_or("unknown"),
        s["next_stage"].as_str().unwrap_or("none"),
        s["reason"].as_str().unwrap_or("none"), target,
        number("completed_rounds"), c.rounds, incumbent, incumbent, number("epoch")
    );
    out.push_str("## Completed evaluations\n\n| AI version | Opponent | Matches | Games | Win rate | Evidence |\n|---|---|---:|---:|---:|---|\n");
    for job in s["jobs"].as_object().ok_or("Missing jobs")?.values() {
        if job["status"] != "completed" {
            continue;
        }
        let sample = &job["result"]["sample"];
        let clusters = sample["clusters"]
            .as_array()
            .ok_or("Missing match scores")?;
        let rate = if clusters.is_empty() {
            "unavailable".into()
        } else {
            format!(
                "{:.2}%",
                clusters
                    .iter()
                    .map(|v| v.as_f64().unwrap_or(0.))
                    .sum::<f64>()
                    / clusters.len() as f64
                    * 100.
            )
        };
        out.push_str(&format!(
            "| {} | {} | {} | {} | {} | [run]({}) · [pairing]({}/pairing.json) |\n",
            job["version"].as_str().unwrap_or("unknown"),
            job["opponent_deck"].as_str().unwrap_or("unknown"),
            sample["matches"],
            sample["games"],
            rate,
            job["result"]["run"].as_str().unwrap_or(""),
            job["directory"].as_str().unwrap_or("")
        ));
    }
    out.push_str("\n## Decisions\n\n| Round | Outcome | Candidate win rate | Incumbent win rate | Change (pp) | Evidence |\n|---|---|---:|---:|---:|---|\n");
    let rate = |v: &Value| {
        v.as_f64()
            .map(|n| format!("{:.2}%", n * 100.))
            .unwrap_or_else(|| "—".into())
    };
    for round in s["rounds"].as_array().ok_or("Missing rounds")? {
        let decision = &round["decisions"][target];
        let assessment = &decision["comparison"]["assessment"];
        let change = assessment["delta"]
            .as_f64()
            .map(|n| format!("{:+.2}", n * 100.))
            .unwrap_or_else(|| "—".into());
        let n = round["round"].as_u64().ok_or("Missing round number")?;
        out.push_str(&format!(
            "| {n} | {} | {} | {} | {change} | [round](round-{n:04}.json) |\n",
            decision["outcome"].as_str().unwrap_or("unknown"),
            rate(&assessment["candidate"]["score"]),
            rate(&assessment["incumbent"]["score"])
        ));
    }
    out.push_str(&format!("\n## Budgets\n\n| Resource | Used / limit | Remaining |\n|---|---:|---:|\n| Reserved games (includes failed attempts) | {} / {} | {} |\n| Wall time (ms, includes review pauses) | {} / {} | {} |\n| Retained output (bytes) | {} / {} | {} |\n\nImported reusable games: {}. Completed cached batches are reused without new reservations.\n\n",
        number("reserved_games"),c.max_games,c.max_games.saturating_sub(number("reserved_games")),
        elapsed,c.max_wall_ms,c.max_wall_ms.saturating_sub(elapsed),bytes,c.max_bytes,c.max_bytes.saturating_sub(bytes),number("reused_games")));
    let shared_policy = std::env::current_dir()?.join("config/bot-campaign-policy.json");
    out.push_str(&format!(
        "## References\n\n- [Shared policy]({})\n- [Campaign configuration](configuration.json)\n",
        shared_policy.display()
    ));
    out.push_str("- [Checkpoint and active-stage evidence](run.json)\n- [Proposals](proposals/)\n- [Evaluation attempts and failures](evaluations/)\n");
    if c.output.join("compact-logs/index.md").exists() {
        out.push_str("- [Compact match logs](compact-logs/index.md)\n");
    }
    if let Some(deliveries) = s["analysis_deliveries"].as_object() {
        for (iteration, delivery) in deliveries {
            let receipt = storage::read(std::path::Path::new(
                delivery["receipt"]
                    .as_str()
                    .ok_or("Missing retention receipt")?,
            ))?;
            out.push_str(&format!(
                "- [{iteration} loss analysis]({}) · [Pruning receipt]({})\n",
                receipt["analysis"].as_str().unwrap_or(""),
                delivery["receipt"].as_str().unwrap_or("")
            ));
        }
    }
    if !s["rankings"]
        .as_array()
        .ok_or("Missing rankings")?
        .is_empty()
    {
        for ranking in s["rankings"].as_array().unwrap() {
            out.push_str(&format!(
                "- [Ranking {}](ranking-e{}-{}.json)\n",
                ranking["label"].as_str().unwrap_or("unknown"),
                ranking["epoch"],
                ranking["label"].as_str().unwrap_or("unknown")
            ));
        }
    }
    if !s["exports"].is_null() {
        out.push_str("- [Accepted exports](final/packages.json)\n");
    }
    fs::write(c.output.join("report.md"), out)?;
    Ok(())
}
