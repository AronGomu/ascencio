use crate::{
    bugs::BugStore,
    identity,
    runtime_identity::now,
    xml::{self, Result},
};
use serde_json::{json, Value};
use std::path::Path;
pub(crate) fn skipped(id: &str, n: u64, reason: &str) -> Value {
    json!({"game_id":format!("{id}-game-{n}"),"number":n,"stage":if n<3{"pre_side"}else{"post_side"},"starter":if n%2==1{"a"}else{"b"},"status":"skipped","winner":null,"draw":null,"evidence_sha256":null,"bug_id":null,"skip_reason":reason})
}

pub(crate) fn perspective_skip(game: &Value) -> Value {
    json!({"game_id":game["game_id"],"stage":game["stage"],"starting_player":game["starter"],"status":"skipped","skip_reason":game["skip_reason"]})
}

pub(crate) fn new_match(run: &str, id: &str, manifest: &Value) -> (Value, [Value; 2]) {
    let games = (1..=4)
        .map(|n| skipped(id, n, "not_started"))
        .collect::<Vec<_>>();
    let reports=["a","b"].map(|actor|json!({"run_id":run,"match_id":id,"perspective":actor,"bot_artifact_sha256":manifest["bots"][actor]["artifact_sha256"],"games":{"game":games.iter().map(perspective_skip).collect::<Vec<_>>()},"sideboarding":{"status":"skipped","skip_reason":"pre_side_not_completed"}}));
    let record = json!({"run_id":run,"match_id":id,"status":"incomplete","games":{"game":games},"sideboarding":{"status":"skipped","a_configuration_sha256":null,"b_configuration_sha256":null,"bug_id":null},"result":{"a_wins":0,"b_wins":0,"draws":0,"outcome":null},"perspective_reports":{"a":"player-a.xml","b":"player-b.xml"}});
    (record, reports)
}

pub(crate) fn save_match(dir: &Path, record: &Value, reports: &[Value; 2]) -> Result<()> {
    save_match_progress(dir, record, reports, None)
}
pub(crate) fn save_match_progress(
    dir: &Path,
    record: &Value,
    reports: &[Value; 2],
    progress: Option<&Value>,
) -> Result<()> {
    let base = dir.join("matches").join(xml::text(&record["match_id"])?);
    let mut files = vec![
        (base.join("player-a.xml"), "player-report", &reports[0]),
        (base.join("player-b.xml"), "player-report", &reports[1]),
        (base.join("match.xml"), "match", record),
    ];
    if let Some(progress) = progress {
        files.push((dir.join("progress.xml"), "progress", progress));
    }
    for (path, _, _) in &files {
        if crate::hierarchy::physical(path)
            .with_extension("tmp")
            .is_dir()
        {
            return Err("Evidence temporary path is a directory".into());
        }
    }
    for (path, root, value) in &files {
        xml::write(path, root, value)?;
    }
    for (actor, report) in ["a", "b"].iter().zip(reports) {
        crate::compact_log::save(&base.join(format!("player-{actor}.log")), report)?;
    }
    Ok(())
}

#[derive(Default)]
pub(crate) struct ProgressLedger {
    pub completed: Vec<String>,
    pub incomplete: Vec<String>,
}
impl ProgressLedger {
    pub fn observe(&mut self, record: &Value) {
        for game in xml::items(&record["games"], "game") {
            if game["status"] == "completed" {
                let id = game["game_id"].as_str().unwrap().to_owned();
                if self.completed.last() != Some(&id) && self.completed.binary_search(&id).is_err()
                {
                    self.completed.push(id);
                }
            }
        }
        if record["status"] == "incomplete" {
            let id = record["match_id"].as_str().unwrap().to_owned();
            if self.incomplete.binary_search(&id).is_err() {
                self.incomplete.push(id);
            }
        }
    }
}
pub(crate) fn progress(
    dir: &Path,
    run: &str,
    status: &str,
    last: u64,
    active: Option<u64>,
    game: Option<u64>,
    next: u64,
    ledger: &ProgressLedger,
    bugs: &BugStore,
) -> Result<()> {
    xml::write(
        &dir.join("progress.xml"),
        "progress",
        &progress_document(run, status, last, active, game, next, ledger, bugs),
    )
}
pub(crate) fn progress_document(
    run: &str,
    status: &str,
    last: u64,
    active: Option<u64>,
    game: Option<u64>,
    next: u64,
    ledger: &ProgressLedger,
    bugs: &BugStore,
) -> Value {
    json!({"run_id":run,"status":status,"updated_at":now(),"last_finalized_match":last,"active_match":active,"active_game":game,"next_unstarted_match":next,"completed_game_ids":{"game_id":ledger.completed},"incomplete_match_ids":{"match_id":ledger.incomplete},"bug_ids":{"bug_id":bugs.ids}})
}

pub(crate) fn map_players(value: &mut Value, swapped: bool) {
    match value {
        Value::Object(o) => {
            for (k, v) in o {
                if k == "life_points" && swapped && v.is_object() {
                    let a = v["a"].clone();
                    v["a"] = v["b"].clone();
                    v["b"] = a;
                    continue;
                }
                if matches!(
                    k.as_str(),
                    "actor" | "player" | "controller" | "owner" | "turn_player"
                ) {
                    if v == 0 {
                        *v = json!(if swapped { "b" } else { "a" })
                    } else if v == 1 {
                        *v = json!(if swapped { "a" } else { "b" })
                    }
                } else {
                    map_players(v, swapped)
                }
            }
        }
        Value::Array(a) => {
            for v in a {
                map_players(v, swapped)
            }
        }
        _ => (),
    }
}

pub(crate) fn finish(record: &mut Value) {
    let games = xml::items(&record["games"], "game");
    let a = games.iter().filter(|g| g["winner"] == "a").count();
    let b = games.iter().filter(|g| g["winner"] == "b").count();
    let draws = games
        .iter()
        .filter(|g| g["draw"] == true || g["draw"] == "true")
        .count();
    let completed = games.iter().all(|g| g["status"] == "completed");
    record["status"] = json!(if completed { "completed" } else { "incomplete" });
    record["result"] = json!({"a_wins":a,"b_wins":b,"draws":draws,"outcome":if !completed{None}else{Some(if a>b{"a"}else if b>a{"b"}else{"tie"})}});
    record["sideboarding"]
        .as_object_mut()
        .unwrap()
        .remove("decks");
}

pub(crate) fn verify_evidence(
    record: &Value,
    reports: &[Value; 2],
    manifest: &Value,
    expected_id: &str,
) -> Result<()> {
    if record["match_id"] != expected_id || record["run_id"] != manifest["run_id"] {
        return Err("Match identity mismatch".into());
    }
    for (i, actor) in ["a", "b"].iter().enumerate() {
        if reports[i]["match_id"] != expected_id
            || reports[i]["run_id"] != manifest["run_id"]
            || reports[i]["perspective"] != *actor
            || reports[i]["bot_artifact_sha256"] != manifest["bots"][*actor]["artifact_sha256"]
        {
            return Err("Perspective identity mismatch".into());
        }
    }
    for (i, g) in xml::items(&record["games"], "game").iter().enumerate() {
        let perspectives = [
            reports[0]["games"]["game"][i].clone(),
            reports[1]["games"]["game"][i].clone(),
        ];
        if g["game_id"] != format!("{expected_id}-game-{}", i + 1) {
            return Err("Game identity mismatch".into());
        }
        if g["status"] == "skipped" {
            if !g["evidence_sha256"].is_null() {
                return Err("Skipped game has a hash".into());
            }
            continue;
        }
        if g["status"] != "completed" && g["status"] != "failed" {
            return Err("Invalid game status".into());
        }
        for (actor, p) in perspectives.iter().enumerate() {
            let outcome = if g["status"] == "failed" {
                "failed"
            } else if g["winner"].is_null() {
                "draw"
            } else if g["winner"] == if actor == 0 { "a" } else { "b" } {
                "win"
            } else {
                "loss"
            };
            if p["game_id"] != g["game_id"]
                || p["status"] != g["status"]
                || p["stage"] != g["stage"]
                || p["starting_player"] != g["starter"]
                || p["result"]["evidence_sha256"] != g["evidence_sha256"]
                || p["result"]["outcome"] != outcome
            {
                return Err("Perspective/result accounting mismatch".into());
            }
        }
        let configs = [
            perspectives[0]["configuration_sha256"].clone(),
            perspectives[1]["configuration_sha256"].clone(),
        ];
        let hash = identity::game_evidence(
            &g["game_id"],
            [&configs[0], &configs[1]],
            &g["failure_category"],
            [&perspectives[0], &perspectives[1]],
        );
        if g["evidence_sha256"] != hash {
            return Err(format!("Evidence identity mismatch for {}", g["game_id"]).into());
        }
        if g["status"] == "failed" && (!g["winner"].is_null() || !g["draw"].is_null()) {
            return Err("Failed game has competitive result".into());
        }
    }
    Ok(())
}
