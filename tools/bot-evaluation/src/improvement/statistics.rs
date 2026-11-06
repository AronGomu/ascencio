//! Each independent four-game match is one bounded observation, including draws.
use crate::xml::{self, Result};
use serde_json::{json, Value};
use std::path::Path;
pub fn assess(run: &Path, matches: u64) -> Result<Value> {
    let summary = xml::read(&run.join("summary.xml"), "summary")?;
    if summary["status"] != "completed"
        || xml::integer(&summary["counts"]["matches_completed"])? != matches
        || xml::integer(&summary["counts"]["matches_incomplete"])? != 0
    {
        return Err("Incomplete evaluation cannot establish promotion".into());
    }
    let mut values = Vec::new();
    for m in 1..=matches {
        let record = xml::read(
            &run.join(format!("matches/match-{m:06}/match.xml")),
            "match",
        )?;
        let games = xml::items(&record["games"], "game");
        if record["status"] != "completed" || games.len() != 4 {
            return Err("Invalid match cluster".into());
        }
        let mut score = 0.0;
        for game in games {
            if game["status"] != "completed" {
                return Err("Failed game in promotion evidence".into());
            }
            score += match game["winner"].as_str() {
                Some("a") => 1.0,
                Some("b") => -1.0,
                _ if game["winner"].is_null() => 0.0,
                _ => return Err("Invalid winner".into()),
            };
        }
        values.push(score / 4.0);
    }
    Ok(interval(&values))
}
pub fn interval(values: &[f64]) -> Value {
    if values.is_empty() {
        return json!({"supported":false,"mean":null,"lower":null});
    }
    let mean = values.iter().sum::<f64>() / values.len() as f64;
    // Two-sided Hoeffding bound for independent clusters in [-1, 1].
    // Valid even for zero variance; no resampling or adaptive sample size.
    let radius = (2.0 * 40.0_f64.ln() / values.len() as f64).sqrt();
    json!({"method":"match_cluster_hoeffding_two_sided_95_v1","matches":values.len(),"mean":mean,"lower":(mean-radius).max(-1.0),"upper":(mean+radius).min(1.0),"supported":mean-radius>0.0})
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn uncertainty_is_conservative_including_degenerate_samples() {
        assert_eq!(interval(&[])["supported"], false);
        assert_eq!(interval(&[1.0])["supported"], false);
        assert_eq!(interval(&vec![0.0; 1000])["supported"], false);
        assert_eq!(interval(&vec![-1.0; 1000])["supported"], false);
        assert_eq!(interval(&vec![1.0; 1000])["supported"], true);
        assert_eq!(interval(&[0.25, -0.25, 0.0, 0.0])["mean"], 0.0);
    }
}
