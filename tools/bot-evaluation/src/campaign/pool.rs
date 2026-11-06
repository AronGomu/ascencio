use crate::xml::Result;
use serde_json::{json, Value};
/// Intersection across evaluated versions. Ranking all versions of a deck uses
/// precisely this common support; incomparable raw gauntlet rates never compete.
pub fn eligible(
    state: &Value,
    pool: &Value,
    deck: &str,
    evaluated: &[String],
) -> Result<(Vec<Value>, Vec<Value>)> {
    let mut included = vec![];
    let mut excluded = vec![];
    let versions = state["decks"][deck]["versions"]
        .as_array()
        .ok_or("Missing archive")?;
    let oldest = evaluated
        .iter()
        .map(|id| {
            versions
                .iter()
                .position(|v| v["id"] == *id)
                .ok_or("Unknown evaluated version")
        })
        .collect::<std::result::Result<Vec<_>, _>>()?
        .into_iter()
        .min()
        .ok_or("No evaluated versions")?;
    for (op_deck, ids) in pool.as_object().ok_or("Missing pool")? {
        for id in ids.as_array().ok_or("Missing pool versions")? {
            let id = id.as_str().ok_or("Invalid version id")?;
            let reason = if evaluated.iter().any(|e| e == id) {
                Some("identical_version")
            } else if op_deck == deck
                && versions
                    .iter()
                    .position(|v| v["id"] == id)
                    .is_none_or(|n| n >= oldest)
            {
                Some("own_version_not_strictly_older_than_every_compared_version")
            } else {
                None
            };
            let mut row = json!({"opponent_deck":op_deck,"opponent":id});
            if let Some(reason) = reason {
                row["reason"] = json!(reason);
                excluded.push(row);
            } else {
                included.push(row);
            }
        }
    }
    Ok((included, excluded))
}
pub fn order(rows: &mut [Value]) {
    rows.sort_by(|a, b| {
        b["aggregate"]["score"]
            .as_f64()
            .unwrap()
            .total_cmp(&a["aggregate"]["score"].as_f64().unwrap())
            .then_with(|| a["id"].as_str().unwrap().cmp(b["id"].as_str().unwrap()))
    });
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn common_support_and_own_age_are_frozen() {
        let s = json!({"decks":{"a":{"versions":[{"id":"a0"},{"id":"a1"},{"id":"a2"}]}}});
        let pool = json!({"a":["a0","a1","a2"],"b":["b0"]});
        let (rows, excluded) = eligible(&s, &pool, "a", &["a1".into(), "a2".into()]).unwrap();
        assert_eq!(
            rows.iter()
                .map(|r| r["opponent"].as_str().unwrap())
                .collect::<Vec<_>>(),
            vec!["a0", "b0"]
        );
        assert_eq!(excluded.len(), 2);
        assert_eq!(
            eligible(&s, &pool, "a", &["a0".into(), "a1".into(), "a2".into()])
                .unwrap()
                .0
                .len(),
            1
        );
        assert_eq!(pool["a"].as_array().unwrap().len(), 3);
    }
}
