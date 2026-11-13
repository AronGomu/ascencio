use crate::xml::Result;
use serde_json::{json, Value};
/// Every version uses the same frozen initial opponents, including itself.
pub fn eligible(
    state: &Value,
    pool: &Value,
    deck: &str,
    evaluated: &[String],
) -> Result<(Vec<Value>, Vec<Value>)> {
    let _ = (state, deck, evaluated);
    let mut included = vec![];
    for (op_deck, ids) in pool.as_object().ok_or("Missing pool")? {
        for id in ids.as_array().ok_or("Missing pool versions")? {
            let id = id.as_str().ok_or("Invalid version id")?;
            included.push(json!({"opponent_deck":op_deck,"opponent":id}));
        }
    }
    Ok((included, vec![]))
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
    fn self_play_and_identical_packages_remain_eligible() {
        let state = json!({"decks":{"target":{"versions":[{"id":"initial"}]}}});
        let frozen = json!({"target":["initial"],"other":["initial"]});
        let (rows, exclusions) = eligible(&state, &frozen, "target", &["initial".into()]).unwrap();
        assert_eq!(rows.len(), 2);
        assert!(exclusions.is_empty());
        assert_eq!(frozen["target"], json!(["initial"]));
    }
}
