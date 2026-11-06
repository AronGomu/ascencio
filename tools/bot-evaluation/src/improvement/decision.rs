//! Persist evidence and the complete state transition before exposing promotion.
use super::storage;
use crate::xml::Result;
use serde_json::{json, Value};
use std::path::Path;
pub fn commit(root: &Path, state: &mut Value, directory: &Path, mut record: Value) -> Result<()> {
    record["directory"] = json!(directory);
    record["evidence_sha256"] = json!(storage::evidence_digest(directory)?);
    storage::save(&directory.join("decision.json"), &record)?;
    let mut next = state.clone();
    if record["outcome"] == "promoted" {
        next["incumbent"] = record["candidate"].clone();
    }
    next["no_improvement"] = json!(if record["outcome"] == "promoted" {
        0
    } else {
        state["no_improvement"]
            .as_u64()
            .ok_or("Missing non-improvement count")?
            + 1
    });
    next["next_iteration"] = json!(record["iteration"].as_u64().ok_or("Missing iteration")? + 1);
    next["history"]
        .as_array_mut()
        .ok_or("Missing history")?
        .push(record);
    next["active"] = Value::Null;
    storage::save(&root.join("state.json"), &next)?;
    *state = next;
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    #[test]
    fn promotion_is_atomic_with_history_and_never_survives_failed_persistence() {
        let root = std::env::temp_dir().join(format!("loop-decision-{}", std::process::id()));
        let dir = root.join("attempt");
        fs::create_dir_all(&dir).unwrap();
        let mut state = json!({"incumbent":"old","active":{"phase":"confirmation"},"no_improvement":2,"next_iteration":1,"history":[]});
        storage::save(&root.join("state.json"), &state).unwrap();
        let old = state.clone();
        let record = json!({"iteration":1,"candidate":"new","outcome":"promoted"});
        fs::create_dir(dir.join("decision.json")).unwrap();
        assert!(commit(&root, &mut state, &dir, record.clone()).is_err());
        assert_eq!(state, old);
        assert_eq!(storage::read(&root.join("state.json")).unwrap(), old);
        fs::remove_dir(dir.join("decision.json")).unwrap();
        fs::create_dir(root.join("state.tmp")).unwrap();
        assert!(commit(&root, &mut state, &dir, record.clone()).is_err());
        assert_eq!(state, old);
        assert_eq!(storage::read(&root.join("state.json")).unwrap(), old);
        fs::remove_dir(root.join("state.tmp")).unwrap();
        commit(&root, &mut state, &dir, record).unwrap();
        assert_eq!(state["incumbent"], "new");
        assert!(state["active"].is_null());
        assert_eq!(state["history"][0]["outcome"], "promoted");
        assert_eq!(state["next_iteration"], 2);
        assert_eq!(storage::read(&root.join("state.json")).unwrap(), state);
        fs::remove_dir_all(root).unwrap();
    }
}
