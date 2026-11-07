//! The existing four-game executor, scoped to one frozen match evidence owner.
use crate::{
    bugs::BugStore,
    config::Config,
    execution::{play, sideboard},
    host::Host,
    match_evidence::{finish, new_match, save_match, verify_evidence},
    xml::{self, Result},
};
use serde_json::{json, Value};
use std::{
    path::Path,
    sync::atomic::{AtomicBool, Ordering},
};

pub fn execute(
    c: &Config,
    host: &mut Host,
    ready: &Value,
    manifest: &Value,
    directory: &Path,
    stop: &AtomicBool,
) -> Result<(Value, [Value; 2])> {
    let f = c.frozen.as_ref().ok_or("Missing frozen match")?;
    let id = xml::text(&f["match"]["id"])?;
    let run = xml::text(&manifest["run_id"])?;
    let (mut record, mut reports) = new_match(run, id, manifest);
    let mut bugs = BugStore::new(directory);
    let mut decks = [f["decks"][0].clone(), f["decks"][1].clone()];
    save_match(directory, &record, &reports)?;
    let mut failed = false;
    for index in 0..4 {
        if failed || stop.load(Ordering::SeqCst) {
            break;
        }
        if index == 2 {
            let mut checkpoint = json!({"captured_at":crate::runtime_identity::now(),"pending_prompt":{"kind":"sideboarding"},"player":null});
            if let Err(error) =
                sideboard(host, c, ready, &mut reports, &mut record, &mut checkpoint)
            {
                host.kill();
                let failure = json!({"category":"sideboarding_failure","message":error.to_string(),"stack":null});
                let bug =
                    bugs.record(run, id, None, "sideboarding", &failure, None, &checkpoint)?;
                record["sideboarding"]["status"] = json!("failed");
                record["sideboarding"]["bug_id"] = json!(bug);
                for r in &mut reports {
                    r["sideboarding"] = json!({"status":"failed","bug_id":bug});
                }
                break;
            }
            decks = [
                record["sideboarding"]["decks"][0].clone(),
                record["sideboarding"]["decks"][1].clone(),
            ];
        }
        let mut result = play(
            host,
            c,
            &record["games"]["game"][index],
            &decks,
            Value::Null,
            stop,
        )?;
        if let Some(failure) = &result.failure {
            failed = true;
            let bug = bugs.record(
                run,
                id,
                result.neutral["game_id"].as_str(),
                "game",
                failure,
                result.neutral["evidence_sha256"].as_str(),
                &result.checkpoint,
            )?;
            result.neutral["bug_id"] = json!(bug);
            for r in &mut result.records {
                r["result"]["bug_id"] = json!(bug);
            }
        }
        record["games"]["game"][index] = result.neutral;
        for (i, r) in reports.iter_mut().enumerate() {
            r["games"]["game"][index] = result.records[i].clone();
        }
        finish(&mut record);
        save_match(directory, &record, &reports)?;
    }
    finish(&mut record);
    for (index, g) in record["games"]["game"]
        .as_array_mut()
        .unwrap()
        .iter_mut()
        .enumerate()
    {
        if g["status"] == "skipped" {
            g["skip_reason"] = json!(if stop.load(Ordering::SeqCst) {
                "interrupted"
            } else {
                "earlier_execution_failed"
            });
            for r in &mut reports {
                r["games"]["game"][index] = crate::match_evidence::perspective_skip(g);
            }
        }
    }
    save_match(directory, &record, &reports)?;
    verify_evidence(&record, &reports, manifest, id)?;
    Ok((record, reports))
}
