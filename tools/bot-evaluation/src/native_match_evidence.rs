//! Authoritative lossless text evidence. No per-game JSON or duplicate actor files.
use crate::{
    log_codec::{compact, parse, record as line},
    xml::{self, Result},
};
use serde_json::{json, Value};
use std::{fs, path::Path};
fn without(value: &Value, keys: &[&str]) -> Value {
    let mut v = value.clone();
    if let Some(o) = v.as_object_mut() {
        for k in keys {
            o.remove(*k);
        }
    }
    v
}
pub fn save(
    directory: &Path,
    record: &Value,
    reports: &[Value; 2],
    manifest: &Value,
    fixture: &Value,
) -> Result<()> {
    let root = directory.join("native");
    fs::create_dir_all(&root)?;
    let games = xml::items(&record["games"], "game");
    let mut index = "ASCENCIO_MATCH_LOG\t2\n".to_owned();
    index += &line("MATCH", &without(record, &["games", "perspective_reports"]));
    index += &line("MANIFEST", manifest);
    index += &line("FIXTURE", fixture);
    for (i, report) in reports.iter().enumerate() {
        index += &line(
            if i == 0 { "REPORT_A" } else { "REPORT_B" },
            &without(report, &["games"]),
        );
    }
    for (i, game) in games.iter().enumerate() {
        let folder = root.join(format!("games/game-{}", i + 1));
        fs::create_dir_all(&folder)?;
        let mut text = "ASCENCIO_GAME_LOG\t2\n".to_owned();
        text += &line("GAME", game);
        for (actor, report) in ["a", "b"].iter().zip(reports) {
            let own = &report["games"]["game"][i];
            text += &line("ACTOR", &json!(actor));
            text += &line("RECORD", &without(own, &["initial", "timeline", "result"]));
            // Sideboarding precedes initial state. Pre-side games carry no later decisions.
            text += &line(
                "SIDEBOARD",
                &if i < 2 {
                    json!({"status":"not_applicable","applies_now":false,"carried_forward":false,"exchanges":{"exchange":[]}})
                } else {
                    let mut sideboard = report["sideboarding"].clone();
                    sideboard["applies_now"] = json!(i == 2);
                    sideboard["carried_forward"] = json!(i == 3);
                    sideboard["applied_before_game"] = json!(3);
                    sideboard
                },
            );
            text += &line("INITIAL", &own["initial"]);
            for event in xml::items(&own["timeline"], "entry") {
                text += &line("EVENT", event);
            }
            text += &line("RESULT", &own["result"]);
            text += &line("END_ACTOR", &json!(actor));
        }
        text += &line("END_GAME", &game["game_id"]);
        let file = folder.join("game.log");
        let bytes = compact(&text)?;
        if fs::read(&file).ok().as_deref() != Some(bytes.as_bytes()) {
            crate::output_storage::write(&file, bytes.as_bytes())?;
        }
        // Only outcome metadata in the match index, never another copy of gameplay.
        index += &line(
            "GAME_REF",
            &json!({"number":i+1,"path":format!("games/game-{}/game.log",i+1),"id":game["game_id"],"status":game["status"],"winner":game["winner"],"draw":game["draw"],"checkpoint_game":game}),
        );
    }
    index += &line("END_MATCH", &record["match_id"]);
    let file = root.join("match.log");
    let bytes = compact(&index)?;
    if fs::read(&file).ok().as_deref() != Some(bytes.as_bytes()) {
        crate::output_storage::write(&file, bytes.as_bytes())?;
    }
    Ok(())
}
pub fn restore(directory: &Path) -> Result<(Value, [Value; 2], Value, Value)> {
    let root = directory.join("native");
    let index = parse(
        &fs::read_to_string(root.join("match.log"))?,
        "ASCENCIO_MATCH_LOG\t2",
    )?;
    let at = |tag: &str| -> Result<Value> {
        let values = index.iter().filter(|(t, _)| t == tag).collect::<Vec<_>>();
        if values.len() != 1 {
            return Err("Missing/duplicate match log record".into());
        }
        Ok(values[0].1.clone())
    };
    let mut record = at("MATCH")?;
    let manifest = at("MANIFEST")?;
    let fixture = at("FIXTURE")?;
    if at("END_MATCH")? != record["match_id"]
        || index.last().map(|(tag, _)| tag.as_str()) != Some("END_MATCH")
    {
        return Err("Truncated match log".into());
    }
    let game_count = index.iter().filter(|(tag, _)| tag == "GAME_REF").count();
    let expected_count = fixture["match"]["games"]
        .as_array()
        .map(|games| games.len())
        .unwrap_or(game_count);
    if game_count == 0 || game_count != expected_count || index.len() != game_count + 6 {
        return Err("Invalid match log game coverage".into());
    }
    let mut reports = [at("REPORT_A")?, at("REPORT_B")?];
    let mut games = vec![];
    let mut own = [vec![], vec![]];
    for (i, (_, r)) in index.iter().filter(|(t, _)| t == "GAME_REF").enumerate() {
        let expected = format!("games/game-{}/game.log", i + 1);
        if r["path"] != expected || r["number"] != i + 1 {
            return Err("Invalid game log reference".into());
        }
        // The index is the commit point. A crash can leave an atomically
        // published next-game file ahead of the old index; restore the old
        // skipped record, preserving every previously committed completed game.
        if r["status"] == "skipped" && r["checkpoint_game"].is_object() {
            let game = r["checkpoint_game"].clone();
            if game["game_id"] != r["id"] || game["status"] != "skipped" {
                return Err("Invalid checkpoint game snapshot".into());
            }
            for rows in &mut own {
                rows.push(crate::match_evidence::perspective_skip(&game));
            }
            games.push(game);
            continue;
        }
        let lines = parse(
            &fs::read_to_string(root.join(expected))?,
            "ASCENCIO_GAME_LOG\t2",
        )?;
        let mut lines = lines.into_iter();
        let take = |lines: &mut std::vec::IntoIter<(String, Value)>, tag: &str| -> Result<Value> {
            let (t, v) = lines.next().ok_or("Truncated game log")?;
            if t != tag {
                return Err(format!("Expected log record {tag}").into());
            }
            Ok(v)
        };
        let game = take(&mut lines, "GAME")?;
        if ["status", "winner", "draw"]
            .iter()
            .any(|field| r[*field] != game[*field])
            || r["id"] != game["game_id"]
        {
            return Err("Game index metadata mismatch".into());
        }
        for (a, actor) in ["a", "b"].iter().enumerate() {
            if take(&mut lines, "ACTOR")? != *actor {
                return Err("Invalid actor".into());
            }
            let mut row = take(&mut lines, "RECORD")?;
            take(&mut lines, "SIDEBOARD")?;
            row["initial"] = take(&mut lines, "INITIAL")?;
            let mut entries = vec![];
            loop {
                let (t, v) = lines.next().ok_or("Truncated events")?;
                if t == "EVENT" {
                    entries.push(v)
                } else if t == "RESULT" {
                    row["result"] = v;
                    break;
                } else {
                    return Err("Invalid event record".into());
                }
            }
            row["timeline"] = json!({"entry":entries});
            if take(&mut lines, "END_ACTOR")? != *actor {
                return Err("Truncated actor".into());
            }
            own[a].push(row);
        }
        if take(&mut lines, "END_GAME")? != game["game_id"] || lines.next().is_some() {
            return Err("Truncated/trailing game log".into());
        }
        games.push(game);
    }
    record["games"] = json!({"game":games});
    for (a, rows) in own.into_iter().enumerate() {
        reports[a]["games"] = json!({"game":rows});
    }
    Ok((record, reports, manifest, fixture))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn logs_roundtrip_without_game_json() {
        let dir = std::env::temp_dir().join(format!("native-log-{}", std::process::id()));
        let g = json!({"game_id":"m-game-1","number":1,"stage":"pre_side","starter":"a","status":"completed"});
        let row = json!({"game_id":"m-game-1","initial":{},"timeline":{"entry":[{"kind":"decision","decision_id":"0-decision-1","sequence":1,"prompt":{"choices":[1,2]}}]},"result":{"outcome":"loss"}});
        let r = json!({"match_id":"m","games":{"game":[g]}});
        let p = json!({"perspective":"a","games":{"game":[row]},"sideboarding":{}});
        save(&dir, &r, &[p.clone(), p.clone()], &json!({}), &json!({})).unwrap();
        let (back, reports, _, _) = restore(&dir).unwrap();
        assert_eq!(back, r);
        assert_eq!(reports, [p.clone(), p]);
        let files = fs::read_dir(dir.join("native/games/game-1"))
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect::<Vec<_>>();
        assert_eq!(files, ["game.log"]);
        let original = fs::read_to_string(dir.join("native/match.log")).unwrap();
        fs::write(dir.join("native/match.log"), original.trim_end()).unwrap();
        assert!(restore(&dir).is_err());
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn uncommitted_next_game_cannot_invalidate_the_previous_checkpoint() {
        let dir = std::env::temp_dir().join(format!("native-crash-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let g1 = json!({"game_id":"m-game-1","number":1,"stage":"pre_side","starter":"a","status":"completed","winner":"a","draw":false});
        let g2 = crate::match_evidence::skipped("m", 2, "not_started");
        let r = json!({"match_id":"m","games":{"game":[g1,g2]}});
        let first = json!({"game_id":"m-game-1","initial":{},"timeline":{"entry":[]},"result":{"outcome":"win"}});
        let p = json!({"perspective":"a","games":{"game":[first,crate::match_evidence::perspective_skip(&r["games"]["game"][1])]},"sideboarding":{}});
        save(&dir, &r, &[p.clone(), p.clone()], &json!({}), &json!({})).unwrap();
        let committed = fs::read(dir.join("native/games/game-1/game.log")).unwrap();
        // Simulate a crash after the next game's atomic file publish, before
        // publication of the new match index. The old index remains authoritative.
        crate::output_storage::write(
            &dir.join("native/games/game-2/game.log"),
            b"advanced-but-not-committed\n",
        )
        .unwrap();
        let (back, reports, _, _) = restore(&dir).unwrap();
        assert_eq!(back, r);
        assert_eq!(reports[0]["games"]["game"][0], p["games"]["game"][0]);
        assert_eq!(reports[0]["games"]["game"][1]["status"], "skipped");
        assert_eq!(
            fs::read(dir.join("native/games/game-1/game.log")).unwrap(),
            committed
        );
        fs::remove_dir_all(dir).unwrap();
    }
}
