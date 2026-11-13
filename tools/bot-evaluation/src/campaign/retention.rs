//! Explicit, resumable deletion of action traces after delivered loss analysis.
use super::{config::Config, now, report, scoring};
use crate::{
    identity,
    improvement::storage,
    xml::{self, Result},
};
use serde_json::{json, Value};
use std::{
    collections::BTreeSet,
    fs,
    os::fd::AsRawFd,
    path::{Path, PathBuf},
};
fn collect_runs(value: &Value, out: &mut BTreeSet<PathBuf>) {
    if value.get("sample").is_some() {
        if let Some(run) = value["run"].as_str() {
            out.insert(PathBuf::from(run));
        }
    }
    match value {
        Value::Object(o) => {
            for v in o.values() {
                collect_runs(v, out)
            }
        }
        Value::Array(a) => {
            for v in a {
                collect_runs(v, out)
            }
        }
        _ => {}
    }
}
fn remove_op(file: &Path) -> Result<Value> {
    let bytes = storage::regular_bytes(file, 128 * 1024 * 1024)?;
    Ok(
        json!({"path":file,"old_sha256":identity::sha(&bytes),"bytes":bytes.len(),"operation":"remove"}),
    )
}
fn replace_op(file: &Path, value: Value) -> Result<Value> {
    let bytes = storage::regular_bytes(file, 128 * 1024 * 1024)?;
    Ok(
        json!({"path":file,"old_sha256":identity::sha(&bytes),"bytes":bytes.len(),"operation":"replace","replacement":serde_json::to_string(&value)?}),
    )
}
fn plan(run: &Path) -> Result<Vec<Value>> {
    let mut operations = vec![];
    let mut matches = fs::read_dir(run.join("matches"))?.collect::<std::io::Result<Vec<_>>>()?;
    matches.sort_by_key(|e| e.file_name());
    for entry in matches {
        let base = entry.path();
        if !base.is_dir() {
            continue;
        }
        let record = xml::read(&base.join("match.xml"), "match")?;
        if record["status"] != "completed" {
            return Err("Cannot prune an unfinished match".into());
        }
        for actor in ["a", "b"] {
            let file = base.join(format!("player-{actor}.json"));
            let mut document: Value =
                serde_json::from_slice(&storage::regular_bytes(&file, 128 * 1024 * 1024)?)?;
            document["retention"] = json!("actions-pruned");
            let refs = xml::items(&record["games"], "game")
                .iter()
                .enumerate()
                .map(|(i, _)| json!({"$ref":format!("games/game-{}/game.json",i+1)}))
                .collect::<Vec<_>>();
            document["data"]["games"] = json!({"game":refs});
            operations.push(replace_op(&file, document)?);
            let aggregate = base.join(format!("player-{actor}.log"));
            if aggregate.exists() {
                operations.push(remove_op(&aggregate)?);
            }
            for n in 1..=4 {
                for extension in ["log", "json"] {
                    let p = base.join(format!("games/game-{n}/{actor}.{extension}"));
                    if p.exists() {
                        operations.push(remove_op(&p)?);
                    }
                }
            }
        }
    }
    Ok(operations)
}
fn apply(operations: &[Value], owner: &Path) -> Result<u64> {
    let mut removed = 0;
    for operation in operations {
        let file = Path::new(xml::text(&operation["path"])?);
        if !file.starts_with(owner) {
            return Err("Pruning path outside owned run".into());
        }
        if !file.exists() {
            if operation["operation"] == "remove" {
                continue;
            }
            return Err("Missing retained metadata during pruning".into());
        }
        let bytes = storage::regular_bytes(file, 128 * 1024 * 1024)?;
        let hash = identity::sha(&bytes);
        if operation["operation"] == "replace"
            && hash == identity::sha(xml::text(&operation["replacement"])?.as_bytes())
        {
            continue;
        }
        if operation["old_sha256"] != hash {
            return Err("Pruning target changed since preparation".into());
        }
        if operation["operation"] == "remove" {
            fs::remove_file(file)?;
            removed += bytes.len() as u64;
        } else if operation["operation"] == "replace" {
            storage::save(
                file,
                &serde_json::from_str(xml::text(&operation["replacement"])?)?,
            )?;
        } else {
            return Err("Invalid pruning operation".into());
        }
    }
    Ok(removed)
}
pub fn prune(directory: &Path, iteration: u64, delivered: bool) -> Result<i32> {
    prune_scope(directory, iteration, delivered, false)
}
pub fn prune_baseline(directory: &Path, delivered: bool) -> Result<i32> {
    prune_scope(directory, 0, delivered, true)
}
fn prune_scope(directory: &Path, iteration: u64, delivered: bool, baseline: bool) -> Result<i32> {
    if !delivered {
        return Err("Loss analysis must be delivered to the orchestrator before pruning".into());
    }
    let directory = directory.canonicalize()?;
    let lock = fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(directory.join("lock"))?;
    if unsafe { libc::flock(lock.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } != 0 {
        return Err("Run already running".into());
    }
    let mut state = storage::read(&directory.join("state.json"))?;
    if !baseline && (iteration == 0 || state["completed_rounds"].as_u64().unwrap_or(0) < iteration)
    {
        return Err("Cannot prune an unfinished iteration".into());
    }
    let scope = if baseline {
        "baseline".to_owned()
    } else {
        iteration.to_string()
    };
    let folder = if baseline {
        directory.join("baseline")
    } else {
        directory.join(format!("iterations/iteration-{iteration:03}"))
    };
    let analysis = folder.join("loss-analysis.md");
    let analysis_bytes = storage::regular_bytes(&analysis, 1024 * 1024)?;
    let analysis_text = std::str::from_utf8(&analysis_bytes)?;
    if !analysis_text.starts_with("# Loss Analysis") || analysis_text.trim().len() < 40 {
        return Err("Missing or invalid loss-analysis report".into());
    }
    let report_hash = identity::sha(&analysis_bytes);
    let receipt_file = folder.join("retention.json");
    let mut receipt = if receipt_file.exists() {
        let receipt = storage::read(&receipt_file)?;
        if receipt["analysis_sha256"] != report_hash {
            return Err("Delivered analysis changed during retention".into());
        }
        if receipt["status"] == "completed" {
            println!("Analysis scope {scope} already pruned");
            return Ok(0);
        }
        receipt
    } else {
        let mut runs = BTreeSet::new();
        if baseline {
            for job in state["jobs"]
                .as_object()
                .ok_or("Missing evaluations")?
                .values()
            {
                let initial = state["decks"]
                    .as_object()
                    .and_then(|d| d.get(job["deck"].as_str().unwrap_or("")))
                    .and_then(|d| d["versions"].as_array())
                    .and_then(|v| v.first())
                    .map(|v| &v["id"]);
                if job["status"] == "completed" && initial == Some(&job["version"]) {
                    collect_runs(&job["result"], &mut runs);
                }
            }
            if runs.is_empty() {
                return Err("No completed baseline evaluations".into());
            }
        } else {
            let round = state["rounds"]
                .as_array()
                .and_then(|r| r.iter().find(|r| r["round"].as_u64() == Some(iteration)))
                .ok_or("Missing iteration record")?;
            collect_runs(round, &mut runs);
        }
        let mut operations = vec![];
        let mut jobs = vec![];
        let mut external = vec![];
        for run in runs {
            let run = run.canonicalize()?;
            if !run.starts_with(&directory) {
                external.push(run);
                continue;
            }
            let (key, job) = state["jobs"]
                .as_object()
                .and_then(|j| {
                    j.iter()
                        .find(|(_, j)| j["result"]["run"] == run.to_string_lossy().as_ref())
                })
                .ok_or("Untracked evaluation")?;
            if job["retention"]["actions_pruned"] == true {
                continue;
            }
            if job["status"] != "completed" {
                return Err("Cannot prune an unfinished evaluation".into());
            }
            let evidence = Path::new(xml::text(&job["directory"])?);
            if job["evidence_sha256"] != storage::evidence_digest(evidence)? {
                return Err("Evidence changed before pruning".into());
            }
            let count = job["result"]["sample"]["matches"]
                .as_u64()
                .ok_or("Missing match count")?;
            let mut sample = scoring::sample(&run, count)?;
            sample["pairing"] = job["result"]["sample"]["pairing"].clone();
            if sample != job["result"]["sample"] {
                return Err("Results differ before pruning".into());
            }
            operations.extend(plan(&run)?);
            jobs.push(json!({"key":key,"directory":evidence,"old_hash":job["evidence_sha256"]}));
        }
        let receipt = json!({"status":"prepared","scope":scope,"iteration":iteration,"analysis":analysis,"analysis_sha256":report_hash,"delivered":true,"prepared_ms":now(),"planned_removed_bytes":operations.iter().filter(|o|o["operation"]=="remove").map(|o|o["bytes"].as_u64().unwrap_or(0)).sum::<u64>(),"operations":operations,"jobs":jobs,"external_evidence_preserved":external});
        storage::save(&receipt_file, &receipt)?;
        receipt
    };
    let removed = apply(
        receipt["operations"]
            .as_array()
            .ok_or("Missing pruning plan")?,
        &directory,
    )?;
    // A prepared journal permits recovery after any file deletion. Numeric records
    // and schedules are never deletion targets; only their detailed actor views are.
    for job in receipt["jobs"]
        .as_array()
        .ok_or("Missing retained evaluations")?
    {
        let key = xml::text(&job["key"])?;
        let hash = storage::evidence_digest(Path::new(xml::text(&job["directory"])?))?;
        let run = Path::new(xml::text(&state["jobs"][key]["result"]["run"])?);
        let count = state["jobs"][key]["result"]["sample"]["matches"]
            .as_u64()
            .ok_or("Missing match count")?;
        let mut sample = scoring::sample(run, count)?;
        sample["pairing"] = state["jobs"][key]["result"]["sample"]["pairing"].clone();
        if sample != state["jobs"][key]["result"]["sample"] {
            return Err("Results changed after pruning".into());
        }
        state["jobs"][key]["evidence_sha256"] = json!(hash);
        state["jobs"][key]["retention"] = json!({"actions_pruned":true,"receipt":receipt_file});
    }
    let configuration = storage::read(&directory.join("configuration.json"))?;
    let mut config: Config = serde_json::from_value(
        state
            .get("latest_configuration")
            .cloned()
            .unwrap_or(configuration["configuration"].clone()),
    )?;
    config.output = directory.clone();
    state["analysis_deliveries"][scope.clone()] = json!({"receipt":receipt_file});
    if !baseline
        && state["next_stage"] == "analysis"
        && state["completed_rounds"].as_u64() == Some(iteration)
    {
        state["next_stage"] = json!(if iteration >= config.rounds {
            "ranking"
        } else {
            "diagnostics"
        });
        state["status"] = json!("paused");
        state["reason"] = Value::Null;
    }
    storage::save(&directory.join("state.json"), &state)?;
    receipt["status"] = json!("completed");
    receipt["completed_ms"] = json!(now());
    receipt["removed_bytes_this_pass"] = json!(removed);
    storage::save(&receipt_file, &receipt)?;
    report::write(&config, &state)?;
    println!("Pruned {scope}; numeric results retained");
    Ok(0)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn deletions_are_resumable_and_preserve_numeric_files() {
        let root = std::env::temp_dir().join(format!("retention-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        let log = root.join("a.log");
        let result = root.join("game.json");
        fs::write(&log, "actions").unwrap();
        fs::write(&result, "numeric results").unwrap();
        let operations = vec![remove_op(&log).unwrap()];
        assert_eq!(apply(&operations, &root).unwrap(), 7);
        assert_eq!(apply(&operations, &root).unwrap(), 0);
        assert_eq!(fs::read_to_string(result).unwrap(), "numeric results");
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn changed_targets_are_not_deleted() {
        let root = std::env::temp_dir().join(format!("retention-changed-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        let log = root.join("a.log");
        fs::write(&log, "original").unwrap();
        let op = remove_op(&log).unwrap();
        fs::write(&log, "changed").unwrap();
        assert!(apply(&[op], &root).is_err());
        assert!(log.exists());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn pruning_a_match_keeps_results_pairing_and_sideboarding() {
        let root = std::env::temp_dir().join(format!("retention-match-{}", std::process::id()));
        let base = root.join("matches/match-000001");
        fs::create_dir_all(&base).unwrap();
        let manifest = json!({"bots":{"a":{"artifact_sha256":"a".repeat(64)},"b":{"artifact_sha256":"b".repeat(64)}}});
        let (mut record, _) = crate::match_evidence::new_match("run", "match-000001", &manifest);
        record["status"] = json!("completed");
        record["result"] = json!({"a_wins":4,"b_wins":0,"draws":0,"outcome":"a"});
        for g in record["games"]["game"].as_array_mut().unwrap() {
            g["status"] = json!("completed");
            g["winner"] = json!("a");
            g["draw"] = json!(false);
            g["evidence_sha256"] = json!("e".repeat(64));
            g.as_object_mut().unwrap().remove("skip_reason");
        }
        xml::write(&base.join("match.xml"), "match", &record).unwrap();
        storage::save(&root.join("pairing.json"), &json!({"seed":"fixed"})).unwrap();
        for actor in ["a", "b"] {
            storage::save(&base.join(format!("player-{actor}.json")),&json!({"kind":"player-report","data":{"perspective":actor,"sideboarding":{"status":"completed","reason":"retain_deck"},"games":{"game":[]}}})).unwrap();
            for n in 1..=4 {
                let folder = base.join(format!("games/game-{n}"));
                storage::save(
                    &folder.join(format!("{actor}.json")),
                    &json!({"timeline":{"entry":["action"]}}),
                )
                .unwrap();
                fs::write(folder.join(format!("{actor}.log")), "action").unwrap();
            }
        }
        let before = xml::read(&base.join("match.xml"), "match").unwrap();
        let operations = plan(&root).unwrap();
        storage::save(
            &root.join("retention.json"),
            &json!({"operations":operations}),
        )
        .unwrap();
        let stored = storage::read(&root.join("retention.json")).unwrap();
        let operations = stored["operations"].as_array().unwrap().clone();
        apply(&operations, &root).unwrap();
        assert_eq!(xml::read(&base.join("match.xml"), "match").unwrap(), before);
        assert!(root.join("pairing.json").exists());
        assert!(!base.join("games/game-1/a.log").exists());
        assert!(!base.join("games/game-1/a.json").exists());
        assert!(
            crate::hierarchy::read(&base.join("player-a.xml"), "player-report")
                .unwrap_err()
                .to_string()
                .contains("pruned")
        );
        let retained = storage::read(&base.join("player-a.json")).unwrap();
        assert_eq!(retained["data"]["sideboarding"]["status"], "completed");
        apply(&operations, &root).unwrap();
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn unfinished_iteration_is_not_pruned() {
        let root =
            std::env::temp_dir().join(format!("retention-incomplete-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        storage::save(
            &root.join("state.json"),
            &json!({"completed_rounds":0,"jobs":{},"rounds":[]}),
        )
        .unwrap();
        let file = root.join("a.log");
        fs::write(&file, "actions").unwrap();
        assert!(prune(&root, 1, true)
            .unwrap_err()
            .to_string()
            .contains("unfinished iteration"));
        assert!(file.exists());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn rejects_pruning_before_delivery() {
        assert!(prune(Path::new("unused"), 1, false)
            .unwrap_err()
            .to_string()
            .contains("delivered"));
    }
}
