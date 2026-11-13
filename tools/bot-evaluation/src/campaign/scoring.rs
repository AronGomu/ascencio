//! Independent four-game match clusters, equal opponent-deck then version weights.
//! Weighted Hoeffding bound for the difference of two independent fresh samples.
use crate::xml::{self, Result};
use serde_json::{json, Value};
use std::{collections::BTreeMap, path::Path};
pub fn sample(run: &Path, count: u64) -> Result<Value> {
    let summary = xml::read(&run.join("summary.xml"), "summary")?;
    if summary["status"] != "completed"
        || xml::integer(&summary["counts"]["matches_completed"])? != count
        || xml::integer(&summary["counts"]["matches_incomplete"])? != 0
    {
        return Err("Incomplete comparison".into());
    }
    let mut clusters = vec![];
    let mut pre = 0.;
    let mut post = 0.;
    let mut draws = 0;
    for m in 1..=count {
        let record = xml::read(
            &run.join(format!("matches/match-{m:06}/match.xml")),
            "match",
        )?;
        let games = xml::items(&record["games"], "game");
        if record["status"] != "completed" || games.len() != 4 {
            return Err("Incomplete match cluster".into());
        }
        let mut wins = 0.;
        for (i, g) in games.iter().enumerate() {
            if g["status"] != "completed" {
                return Err("Failed game cannot be scored".into());
            }
            let win = match g["winner"].as_str() {
                Some("a") => 1.,
                Some("b") => 0.,
                None if g["winner"].is_null() && (g["draw"] == "true" || g["draw"] == true) => {
                    draws += 1;
                    0.
                }
                _ => return Err("Invalid game outcome".into()),
            };
            wins += win;
            if i < 2 {
                pre += win;
            } else {
                post += win;
            }
        }
        clusters.push(wins / 4.);
    }
    Ok(
        json!({"clusters":clusters,"pre_side":pre/(2*count) as f64,"post_side":post/(2*count) as f64,"draws":draws,"games":4*count,"matches":count}),
    )
}
pub fn weights(rows: &[Value]) -> Result<Vec<f64>> {
    let mut counts = BTreeMap::<&str, usize>::new();
    for row in rows {
        *counts
            .entry(row["opponent_deck"].as_str().ok_or("Missing stratum")?)
            .or_default() += 1;
    }
    if counts.is_empty() {
        return Err("No common eligible opponents".into());
    }
    Ok(rows
        .iter()
        .map(|r| 1. / counts.len() as f64 / counts[r["opponent_deck"].as_str().unwrap()] as f64)
        .collect())
}
pub fn aggregate(rows: &[Value]) -> Result<Value> {
    let weights = weights(rows)?;
    let mut score = 0.;
    let mut pre = 0.;
    let mut post = 0.;

    for (row, w) in rows.iter().zip(weights) {
        let values = row["sample"]["clusters"]
            .as_array()
            .filter(|v| !v.is_empty())
            .ok_or("No complete clusters")?;
        let mut sum = 0.;
        for value in values {
            let v = value
                .as_f64()
                .filter(|v| (0.0..=1.0).contains(v))
                .ok_or("Invalid cluster")?;
            sum += v;
        }
        score += w * sum / values.len() as f64;
        pre += w * row["sample"]["pre_side"]
            .as_f64()
            .ok_or("Missing pre-side")?;
        post += w * row["sample"]["post_side"]
            .as_f64()
            .ok_or("Missing post-side")?;
    }
    Ok(json!({"score":score,"pre_side":pre,"post_side":post}))
}
pub fn promotion(candidate: &[Value], incumbent: &[Value]) -> Result<Value> {
    if candidate.len() != incumbent.len()
        || candidate.iter().zip(incumbent).any(|(a, b)| {
            a["opponent"] != b["opponent"]
                || a["opponent_deck"] != b["opponent_deck"]
                || a["sample"]["clusters"].as_array().map(Vec::len)
                    != b["sample"]["clusters"].as_array().map(Vec::len)
        })
    {
        return Err("Promotion conditions differ".into());
    }
    if candidate.iter().zip(incumbent).any(|(a, b)| {
        a["sample"]["pairing"].as_str().is_none()
            || a["sample"]["pairing"] != b["sample"]["pairing"]
    }) {
        return Err("Missing or mismatched paired schedule".into());
    }
    let c = aggregate(candidate)?;
    let i = aggregate(incumbent)?;
    let delta = c["score"].as_f64().unwrap() - i["score"].as_f64().unwrap();
    Ok(
        json!({"method":"paired_saved_match_win_rate_v1","candidate":c,"incumbent":i,"delta":delta,"supported":delta>0.}),
    )
}
#[cfg(test)]
mod tests {
    use super::*;
    fn row(deck: &str, id: &str, values: Vec<f64>) -> Value {
        json!({"opponent_deck":deck,"opponent":id,"sample":{"pairing":"test-schedule","clusters":values,"pre_side":0.,"post_side":0.}})
    }
    #[test]
    fn strata_draws_and_degenerate_samples() {
        let rows = vec![
            row("a", "1", vec![1.; 10]),
            row("a", "2", vec![1.; 10]),
            row("b", "3", vec![0.; 10]),
        ];
        assert_eq!(aggregate(&rows).unwrap()["score"], 0.5);
        assert_eq!(promotion(&rows, &rows).unwrap()["supported"], false);
        assert_eq!(
            promotion(&[row("a", "1", vec![1.])], &[row("a", "1", vec![0.])]).unwrap()["supported"],
            true
        );
        assert_eq!(
            promotion(
                &[row("a", "1", vec![1.; 100])],
                &[row("a", "1", vec![0.; 100])]
            )
            .unwrap()["supported"],
            true
        );
        let mut different = row("a", "1", vec![1.; 10]);
        different["sample"]["pairing"] = json!("other-seeds");
        assert!(promotion(&[different], &[row("a", "1", vec![0.; 10])]).is_err());
        assert!(promotion(&[], &[]).is_err());
        assert!(promotion(&rows, &[row("a", "9", vec![0.; 10])]).is_err());
    }
}
