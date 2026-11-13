//! Lossless linked evidence storage. JSON is machine state; .log files are agent views.
use crate::{
    improvement::storage,
    xml::{self, Result},
};
use serde_json::{json, Value};
use std::{
    fs,
    path::{Path, PathBuf},
};
pub fn physical(path: &Path) -> PathBuf {
    path.with_extension("json")
}
pub fn resolve(value: Value, base: &Path, depth: usize) -> Result<Value> {
    if depth > 64 {
        return Err("Evidence reference depth exceeded".into());
    }
    if let Some(reference) = value.get("$ref").and_then(Value::as_str) {
        let (file, pointer) = reference.split_once('#').unwrap_or((reference, ""));
        let path = base.join(file);
        let data: Value = serde_json::from_slice(&fs::read(&path)?)?;
        let selected = if pointer.is_empty() {
            data
        } else {
            data.pointer(pointer)
                .ok_or("Invalid evidence pointer")?
                .clone()
        };
        return resolve(selected, path.parent().ok_or("Missing parent")?, depth + 1);
    }
    match value {
        Value::Object(o) => Ok(Value::Object(
            o.into_iter()
                .map(|(k, v)| Ok((k, resolve(v, base, depth + 1)?)))
                .collect::<Result<_>>()?,
        )),
        Value::Array(a) => Ok(Value::Array(
            a.into_iter()
                .map(|v| resolve(v, base, depth + 1))
                .collect::<Result<_>>()?,
        )),
        v => Ok(v),
    }
}
pub fn read(path: &Path, root: &str) -> Result<Value> {
    let file = physical(path);
    let document: Value = serde_json::from_slice(&fs::read(&file)?)?;
    if root == "player-report" && document["retention"] == "actions-pruned" {
        return Err("Detailed game actions were pruned after loss analysis; use retained results and analysis report".into());
    }
    if document["kind"] != root {
        return Err("Evidence kind mismatch".into());
    }
    resolve(
        document["data"].clone(),
        file.parent().ok_or("No parent")?,
        0,
    )
}
pub fn write(path: &Path, root: &str, value: &Value) -> Result<()> {
    let file = physical(path);
    let base = file.parent().ok_or("No evidence directory")?;
    let mut data = value.clone();
    if root == "player-report" {
        let actor = xml::text(&value["perspective"])?;
        let games = xml::items(&value["games"], "game");
        let mut refs = vec![];
        for (i, game) in games.iter().enumerate() {
            let relative = format!("games/game-{}/{actor}.json", i + 1);
            let game_base = base.join(format!("games/game-{}", i + 1));
            let shared = json!({"game_id":game["game_id"],"stage":game["stage"],"starting_player":game["starting_player"]});
            storage::save(&game_base.join("metadata.json"), &shared)?;
            let mut actor_data = (*game).clone();
            for key in ["game_id", "stage", "starting_player"] {
                if !actor_data[key].is_null() {
                    actor_data[key] = json!({"$ref":format!("metadata.json#/{key}")});
                }
            }
            if !actor_data["initial"]["own_configuration"].is_null() {
                let configuration = actor_data["initial"]["own_configuration"].clone();
                let id = crate::identity::digest(&configuration);
                let file = base
                    .parent()
                    .and_then(Path::parent)
                    .ok_or("Missing evaluation directory")?
                    .join("configurations")
                    .join(format!("{id}.json"));
                if !file.exists() {
                    storage::save(&file, &configuration)?;
                }
                actor_data["initial"]["own_configuration"] =
                    json!({"$ref":format!("../../../../configurations/{id}.json")});
            }
            storage::save(&base.join(&relative), &actor_data)?;
            refs.push(json!({"$ref":relative}));
            let mut single = value.clone();
            single["games"] = json!({"game":[game]});
            crate::compact_log::save(
                &base.join(format!("games/game-{i1}/{actor}.log", i1 = i + 1)),
                &single,
            )?;
        }
        data["games"] = json!({"game":refs});
    } else if root == "match" {
        let mut refs = vec![];
        for (i, game) in xml::items(&value["games"], "game").iter().enumerate() {
            let relative = format!("games/game-{}/game.json", i + 1);
            let meta = base.join(format!("games/game-{}/metadata.json", i + 1));
            let mut game_data = (*game).clone();
            if meta.exists() {
                let shared: Value = serde_json::from_slice(&fs::read(&meta)?)?;
                for (key, target) in [
                    ("game_id", "game_id"),
                    ("stage", "stage"),
                    ("starter", "starting_player"),
                ] {
                    if !shared[target].is_null() && game_data[key] == shared[target] {
                        game_data[key] = json!({"$ref":format!("metadata.json#/{target}")});
                    }
                }
            }
            storage::save(&base.join(&relative), &game_data)?;
            refs.push(json!({"$ref":relative}));
        }
        data["games"] = json!({"game":refs});
    }
    storage::save(&file, &json!({"kind":root,"data":data}))
}
pub fn migrate(directory: &Path) -> Result<i32> {
    fn files(p: &Path, out: &mut Vec<PathBuf>) -> Result<()> {
        for entry in fs::read_dir(p)? {
            let p = entry?.path();
            if p.is_dir() {
                if p.file_name()
                    .is_some_and(|n| n == "agents" || n == "node_modules" || n == ".git")
                {
                    continue;
                }
                files(&p, out)?;
            } else if p.extension().is_some_and(|e| e == "xml" || e == "json") {
                out.push(p);
            }
        }
        Ok(())
    }
    let mut paths = vec![];
    files(directory, &mut paths)?;
    let mut verified = vec![];
    for path in &paths {
        let source = fs::read_to_string(path)?;
        let kind;
        let root = if path.extension().is_some_and(|e| e == "json") {
            let document: Value = serde_json::from_str(&source)?;
            if document.get("data").is_none() {
                continue;
            }
            kind = document["kind"]
                .as_str()
                .ok_or("Missing document kind")?
                .to_owned();
            kind.as_str()
        } else {
            kind = roxmltree::Document::parse(&source)?
                .root_element()
                .tag_name()
                .name()
                .to_owned();
            kind.as_str()
        };
        let value = xml::read(path, root)?;
        write(path, root, &value)?;
        if read(path, root)? != value {
            return Err(format!("Migration roundtrip failed: {}", path.display()).into());
        }
        if path.extension().is_some_and(|e| e == "xml") {
            verified.push(path.clone());
        }
    }
    for path in verified {
        fs::remove_file(path)?;
    }
    println!("Migrated {} XML documents losslessly", paths.len());
    Ok(0)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn linked_perspective_roundtrip() {
        let base = std::env::temp_dir().join(format!("hierarchy-{}", std::process::id()));
        let p = base.join("player-a.xml");
        let v =
            json!({"perspective":"a","games":{"game":[{"game_id":"g1","timeline":{"entry":[]}}]}});
        write(&p, "player-report", &v).unwrap();
        assert_eq!(read(&p, "player-report").unwrap(), v);
        assert!(!p.exists());
        fs::remove_dir_all(base).unwrap();
    }
}

/// Canonical ownership: run references iterations; iterations reference proposals
/// and evaluations. Large evaluation receipts are never copied into the run file.
pub fn split_state(path: &Path, value: &Value) -> Result<Value> {
    let base = path.parent().ok_or("Missing run directory")?;
    let mut state = value.clone();
    let round = value["completed_rounds"].as_u64().unwrap_or(0) + 1;
    let mut evaluation_refs = std::collections::BTreeMap::new();
    if let Some(jobs) = value["jobs"].as_object() {
        for (key, job) in jobs {
            let initial = value["decks"]
                .as_object()
                .and_then(|d| d.get(job["deck"].as_str().unwrap_or("")))
                .and_then(|d| d["versions"].as_array())
                .and_then(|v| v.first())
                .map(|v| &v["id"]);
            let folder = if initial == Some(&job["version"]) {
                "baseline".to_owned()
            } else {
                format!(
                    "iterations/iteration-{:03}",
                    value["decks"]
                        .as_object()
                        .and_then(|d| d.get(job["deck"].as_str().unwrap_or("")))
                        .and_then(|d| d["versions"].as_array())
                        .and_then(|v| v.iter().find(|v| v["id"] == job["version"]))
                        .and_then(|v| v["round"].as_u64())
                        .unwrap_or(round)
                )
            };
            let reference = format!("{folder}/evaluations/{key}/evaluation.json");
            storage::save(&base.join(&reference), job)?;
            state["jobs"][key] = json!({"$ref":reference});
            evaluation_refs.insert(
                (job["version"].to_string(), job["opponent"].to_string()),
                reference,
            );
        }
    }
    if let Some(proposals) = value["proposals"].as_object() {
        for (key, proposal) in proposals {
            let number = key
                .strip_prefix('r')
                .and_then(|v| v.split('-').next())
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(round);
            let reference = format!("iterations/iteration-{number:03}/proposal.json");
            storage::save(&base.join(&reference), proposal)?;
            state["proposals"][key] = json!({"$ref":reference});
        }
    }
    if let Some(rounds) = value["rounds"].as_array() {
        for (i, record) in rounds.iter().enumerate() {
            let number = record["round"].as_u64().unwrap_or(i as u64 + 1);
            let reference = format!("iterations/iteration-{number:03}/iteration.json");
            storage::save(
                &base.join(&reference),
                &link_evaluation_rows(record, &value["jobs"], &evaluation_refs),
            )?;
            state["rounds"][i] = json!({"$ref":reference});
        }
    }
    if !value["active"].is_null() {
        let reference = format!("iterations/iteration-{round:03}/iteration.json");
        let mut active = value["active"].clone();
        // The current proposal belongs to its proposal receipt, not both documents.
        if !active["proposal"].is_null() {
            let key = value["proposals"]
                .as_object()
                .and_then(|p| p.iter().find(|(_, p)| p["result"] == active["proposal"]))
                .map(|(k, _)| k);
            if let Some(key) = key {
                let proposal = value["proposals"][key].clone();
                storage::save(
                    &base.join(format!("iterations/iteration-{round:03}/proposal.json")),
                    &proposal,
                )?;
                active["proposal"] = json!({"$ref":"proposal.json#/result"});
            }
        }
        storage::save(
            &base.join(&reference),
            &link_evaluation_rows(&active, &value["jobs"], &evaluation_refs),
        )?;
        state["active"] = json!({"$ref":reference});
    }
    Ok(state)
}

#[cfg(test)]
mod state_tests {
    use super::*;
    #[test]
    fn checkpoint_references_iteration_and_evaluation_without_copying() {
        let base = std::env::temp_dir().join(format!("linked-run-{}", std::process::id()));
        let value = json!({"completed_rounds":0,"decks":{"a":{"versions":[{"id":"initial"}]}},"jobs":{"job1":{"deck":"a","version":"initial","opponent":"initial","status":"completed"}},"proposals":{},"rounds":[],"active":{"round":1}});
        storage::save(&base.join("state.json"), &value).unwrap();
        assert!(!base.join("state.json").exists());
        let physical: Value =
            serde_json::from_slice(&fs::read(base.join("run.json")).unwrap()).unwrap();
        assert!(physical["jobs"]["job1"].get("$ref").is_some());
        assert!(physical["active"].get("$ref").is_some());
        assert_eq!(storage::read(&base.join("state.json")).unwrap(), value);
        fs::remove_dir_all(base).unwrap();
    }
}

pub fn link_evaluation_rows(
    value: &Value,
    jobs: &Value,
    refs: &std::collections::BTreeMap<(String, String), String>,
) -> Value {
    if let Some(run) = value.get("run").and_then(Value::as_str) {
        if value.get("sample").is_some() {
            if let Some(job) = jobs
                .as_object()
                .and_then(|o| o.values().find(|j| j["result"]["run"] == run))
            {
                if let Some(file) =
                    refs.get(&(job["version"].to_string(), job["opponent"].to_string()))
                {
                    let mut row = value.clone();
                    for key in ["sample", "run"] {
                        row[key] = json!({"$ref":format!("../../{file}#/result/{key}")});
                    }
                    return row;
                }
            }
        }
    }
    match value {
        Value::Object(o) => Value::Object(
            o.iter()
                .map(|(k, v)| (k.clone(), link_evaluation_rows(v, jobs, refs)))
                .collect(),
        ),
        Value::Array(a) => Value::Array(
            a.iter()
                .map(|v| link_evaluation_rows(v, jobs, refs))
                .collect(),
        ),
        v => v.clone(),
    }
}
