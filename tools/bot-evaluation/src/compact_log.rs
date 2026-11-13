//! Actor-relative text projection; XML remains the machine-verifiable evidence.
use crate::xml::{self, Result};
use serde_json::Value;
use std::{collections::BTreeMap, fs, path::Path};
fn text(v: &Value) -> String {
    match v {
        Value::String(s) => s.replace(['\n', '\r', '|'], " "),
        Value::Null => "?".into(),
        _ => v.to_string(),
    }
}
fn flatten(v: &Value, prefix: &str, out: &mut Vec<String>) {
    match v {
        Value::Null => {}
        Value::Object(o) => {
            for (k, v) in o {
                if !matches!(k.as_str(), "duration_ms" | "captured_at" | "explanation") {
                    flatten(
                        v,
                        &if prefix.is_empty() {
                            k.clone()
                        } else {
                            format!("{prefix}.{k}")
                        },
                        out,
                    )
                }
            }
        }
        Value::Array(a) => {
            for (i, v) in a.iter().enumerate() {
                flatten(v, &format!("{prefix}.{i}"), out)
            }
        }
        _ => out.push(format!("{prefix}={}", text(v))),
    }
}
fn fields(v: &Value) -> String {
    let mut out = vec![];
    flatten(v, "", &mut out);
    out.join(" ")
}
pub fn render(report: &Value) -> String {
    let mut cards = BTreeMap::new();
    for game in xml::items(&report["games"], "game") {
        for e in xml::items(&game["timeline"], "entry") {
            for c in xml::items(&e["prompt"]["choices"], "choice") {
                if !c["card_code"].is_null() {
                    let code = text(&c["card_code"]);
                    cards
                        .entry(code.to_owned())
                        .or_insert_with(|| text(&c["label"]));
                }
            }
        }
    }
    let mut out = format!(
        "LOG v1 | match={} actor={} bot={}\n",
        text(&report["match_id"]),
        text(&report["perspective"]),
        text(&report["bot_artifact_sha256"])
    );
    for (code, label) in cards {
        out.push_str(&format!("CARD {code} {label}\n"));
    }
    for game in xml::items(&report["games"], "game") {
        out.push_str(&format!(
            "\nGAME {} | first={} stage={} status={}\n",
            text(&game["game_id"]),
            text(&game["starting_player"]),
            text(&game["stage"]),
            text(&game["status"])
        ));
        out.push_str(&format!("INITIAL {}\n", fields(&game["initial"])));
        for e in xml::items(&game["timeline"], "entry") {
            let prefix = format!(
                "T{} {} {}",
                text(&e["turn"]),
                text(&e["actor"]),
                text(&e["phase"])
            );
            if e["kind"] == "decision" {
                let selected = xml::items(&e["selected_choice_ids"], "choice_id")
                    .iter()
                    .map(|v| text(v))
                    .collect::<Vec<_>>();
                let choices = xml::items(&e["prompt"]["choices"], "choice");
                let describe = |c: &Value| {
                    format!(
                        "{}:{}{}",
                        text(&c["action"]),
                        text(&c["card_code"]),
                        if c["value"].is_null() {
                            String::new()
                        } else {
                            format!(":{}", text(&c["value"]))
                        }
                    )
                };
                let chosen = choices
                    .iter()
                    .filter(|c| selected.contains(&text(&c["id"])))
                    .map(|c| describe(c))
                    .collect::<Vec<_>>();
                let offered = choices.iter().map(|c| describe(c)).collect::<Vec<_>>();
                out.push_str(&format!(
                    "{prefix} D{} CHOOSE {} | OFFERED {} | reason={}\n",
                    text(&e["decision_id"]),
                    chosen.join(","),
                    offered.join(","),
                    text(&e["reason"]["code"])
                ));
            } else {
                out.push_str(&format!(
                    "{prefix} E{} {} | {} {}\n",
                    text(&e["sequence"]),
                    text(&e["event"]),
                    fields(&e["changes"]),
                    fields(&e["details"])
                ));
            }
        }
        out.push_str(&format!("RESULT {}\n", fields(&game["result"])));
    }
    out.push_str(&format!("SIDEBOARD {}\n", fields(&report["sideboarding"])));
    out
}
pub fn save(path: &Path, report: &Value) -> Result<()> {
    if let Some(p) = path.parent() {
        fs::create_dir_all(p)?;
    }
    fs::write(path, render(report))?;
    Ok(())
}
pub fn convert(run: &Path, out: &Path) -> Result<i32> {
    let mut matches = fs::read_dir(run.join("matches"))?.collect::<std::io::Result<Vec<_>>>()?;
    matches.sort_by_key(|e| e.file_name());
    for m in matches {
        if !m.path().is_dir() {
            continue;
        }
        for actor in ["a", "b"] {
            let report = xml::read(
                &m.path().join(format!("player-{actor}.xml")),
                "player-report",
            )?;
            save(
                &out.join(m.file_name()).join(format!("player-{actor}.log")),
                &report,
            )?;
        }
    }
    println!("{}", out.display());
    Ok(0)
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn logs_decision_ids_choices_and_hidden_values() {
        let r = json!({"match_id":"m1","perspective":"a","games":{"game":[{"game_id":"g1","timeline":{"entry":[{"kind":"decision","decision_id":"d1","turn":1,"actor":"a","prompt":{"choices":{"choice":[{"id":"c1","action":"setSpellTrap","card_code":"69162969","label":"Lightning Vortex"}]}},"selected_choice_ids":{"choice_id":["c1"]},"reason":{"code":"develop_board"}}]}}]}});
        let log = render(&r);
        assert!(log.contains("Dd1 CHOOSE setSpellTrap:69162969"));
        assert!(log.contains("CARD 69162969"));
        assert!(!log.contains("duration_ms"));
    }
}
