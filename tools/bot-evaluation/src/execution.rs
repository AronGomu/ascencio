use crate::{
    config::{self, Config},
    host::Host,
    identity,
    match_evidence::map_players,
    runtime_identity::{now, rss},
    xml::{self, Result},
};
use serde_json::{json, Value};
use std::{
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};
pub(crate) struct Game {
    pub(crate) records: [Value; 2],
    pub(crate) neutral: Value,
    pub(crate) failure: Option<Value>,
    pub(crate) checkpoint: Value,
    pub(crate) elapsed: f64,
    pub(crate) host_dead: bool,
    pub(crate) peak: u64,
}

pub(crate) fn play(
    host: &mut Host,
    c: &Config,
    game: &Value,
    decks: &[Value; 2],
    orders: Value,
    stop: &AtomicBool,
) -> Result<Game> {
    let swapped = game["starter"] == "b";
    let order = if swapped { [1, 0] } else { [0, 1] };
    let start = Instant::now();
    host.send(&json!({"type":"game","game_id":game["game_id"],"profile":c.profile,"limits":c.limits,"decks":[decks[order[0]],decks[order[1]]],"orders":orders,"bot_order":order}))?;
    let mut records=[0,1].map(|i|json!({"configuration_sha256":identity::digest(&config::deck_doc(&decks[i])),"game_id":game["game_id"],"stage":game["stage"],"starting_player":game["starter"],"status":"failed","initial":null,"timeline":{"entry":[]},"result":{}}));
    let mut checkpoint = json!({"captured_at":now(),"pending_prompt":null,"attempted_response":null,"recent_engine_events":{"entry":[]},"private_engine_state":null,"bot_debug_state":null,"player":null});
    let mut deadline =
        Instant::now() + Duration::from_millis(xml::integer(&c.limits["game_wall_time_ms"])?);
    let wall = deadline;
    let mut failure = None;
    let mut terminal = None;
    let mut host_dead = false;
    let mut peak = 0;
    let mut entries = 0u64;
    let mut evidence_bytes = 0usize;
    let mut cleanup = json!({"handles_created":0,"handles_destroyed":0});
    loop {
        if entries % 256 == 0 {
            peak = peak.max(rss(std::process::id()) + rss(host.pid()));
        }
        if stop.load(Ordering::SeqCst) || Instant::now() >= deadline.min(wall) {
            failure = Some(
                json!({"category":if stop.load(Ordering::SeqCst){"interrupted"}else{"timeout"},"message":"Execution host exceeded external deadline or was interrupted","stack":null,"last_progress_sequence":entries,"limit_ms":if checkpoint["pending_prompt"].is_null(){c.limits["game_wall_time_ms"].clone()}else{c.limits["decision_wall_time_ms"].clone()}}),
            );
            host.kill();
            host_dead = true;
            break;
        }
        let wait = deadline
            .min(wall)
            .saturating_duration_since(Instant::now())
            .min(Duration::from_millis(100));
        let frame = match host.receive(wait) {
            Ok(v) => v,
            Err(e) => {
                if e.to_string().contains("timed out") {
                    continue;
                }
                failure = Some(
                    json!({"category":"host_crash","message":e.to_string(),"stack":null,"last_progress_sequence":entries}),
                );
                host.kill();
                host_dead = true;
                break;
            }
        };
        let actor = frame["actor"].as_u64().unwrap_or(0) as usize;
        if actor > 1 {
            return Err("Invalid host actor".into());
        }
        let mapped = order[actor];
        match frame["type"].as_str().unwrap_or("") {
            "handle_created" => cleanup["handles_created"] = json!(1),
            "initial" => {
                records[mapped]["initial"] = frame["initial"].clone();
                map_players(&mut records[mapped]["initial"], swapped);
            }
            "event" | "decision" => {
                entries += 1;
                evidence_bytes += value_size(&frame);
                if entries > 1_000_000 || evidence_bytes > 64 * 1024 * 1024 {
                    failure = Some(
                        json!({"category":"evidence_limit","message":"One game exceeded the bounded evidence entry limit","stack":null,"last_progress_sequence":entries}),
                    );
                    host.kill();
                    host_dead = true;
                    break;
                }
                let mut entry = frame["entry"].clone();
                map_players(&mut entry, swapped);
                if frame["type"] == "decision" {
                    deadline = wall;
                    checkpoint["pending_prompt"] = Value::Null;
                }
                records[mapped]["timeline"]["entry"]
                    .as_array_mut()
                    .unwrap()
                    .push(entry.clone());
                let recent = checkpoint["recent_engine_events"]["entry"]
                    .as_array_mut()
                    .unwrap();
                recent.push(entry);
                if recent.len() > 32 {
                    recent.remove(0);
                }
            }
            "decision_started" => {
                deadline = Instant::now()
                    + Duration::from_millis(xml::integer(&c.limits["decision_wall_time_ms"])?);
                checkpoint["pending_prompt"] = frame["prompt"].clone();
                checkpoint["player"] = json!(if mapped == 0 { "a" } else { "b" });
            }
            "attempted_response" => checkpoint["attempted_response"] = frame["response"].clone(),
            "failure" => {
                failure = Some(frame["failure"].clone());
                terminal = Some(frame);
            }
            "done" => terminal = Some(frame),
            "cleanup" => {
                peak = peak
                    .max(rss(std::process::id()) + xml::integer(&frame["rss_bytes"]).unwrap_or(0));
                cleanup = json!({"handles_created":1,"handles_destroyed":if frame["handles_created"]==frame["handles_destroyed"] {1}else{0}});
                if frame["handles_created"] != frame["handles_destroyed"] {
                    failure = Some(
                        json!({"category":"handle_cleanup","message":"Core handles were not balanced","stack":null}),
                    );
                }
                break;
            }
            "diagnostic" => checkpoint["last_action"] = frame["entry"].clone(),
            "host_error" => {
                failure =
                    Some(json!({"category":"host_error","message":frame["message"],"stack":null}));
                break;
            }
            _ => return Err("Unknown host frame".into()),
        }
    }
    let elapsed = start.elapsed().as_secs_f64() * 1000.0;
    let mut neutral = game.clone();
    neutral.as_object_mut().unwrap().remove("skip_reason");
    let status = if failure.is_some() {
        "failed"
    } else if terminal.is_some() {
        "completed"
    } else {
        return Err("Host omitted result".into());
    };
    let result = terminal.unwrap_or_else(|| json!({}));
    let winner = result["winner"]
        .as_u64()
        .map(|s| if order[s as usize] == 0 { "a" } else { "b" });
    neutral["status"] = json!(status);
    if host_dead {
        cleanup["released_by_host_termination"] = cleanup["handles_created"].clone();
    }
    neutral["cleanup"] = cleanup;
    neutral["winner"] = if status == "completed" {
        json!(winner)
    } else {
        Value::Null
    };
    neutral["draw"] = if status == "completed" {
        json!(winner.is_none())
    } else {
        Value::Null
    };
    if let Some(f) = &failure {
        neutral["failure_category"] = f["category"].clone()
    }
    for (i, record) in records.iter_mut().enumerate() {
        record["status"] = json!(status);
        record["result"] = json!({"outcome":if status=="failed"{"failed"}else if winner.is_none(){"draw"}else if winner==Some(if i==0{"a"}else{"b"}){"win"}else{"loss"},"engine_reason":result["engine_reason"],"turns":result["turns"],"duration_ms":elapsed,"engine_time_ms":result["engine_time_ms"],"bot_time_ms":result["bot_time_ms"],"evidence_sha256":null,"bug_id":null});
    }
    let hash = identity::evidence(
        &json!({"game_id":game["game_id"],"configurations":[records[0]["configuration_sha256"],records[1]["configuration_sha256"]],"failure_category":neutral["failure_category"],"records":records}),
    );
    neutral["evidence_sha256"] = json!(hash);
    for record in &mut records {
        record["result"]["evidence_sha256"] = json!(hash)
    }
    Ok(Game {
        records,
        neutral,
        failure,
        checkpoint,
        elapsed,
        host_dead,
        peak,
    })
}

pub(crate) fn fixture(c: &Config, m: u64, n: u64, decks: &[Value; 2]) -> Result<Value> {
    let Some(f) = &c.fixture else {
        return Ok(Value::Null);
    };
    let record = xml::items(&f["matches"], "match")
        .into_iter()
        .find(|v| xml::integer(&v["number"]).ok() == Some(m))
        .ok_or("Missing fixture match")?;
    let game = xml::items(&record["games"], "game")
        .into_iter()
        .find(|v| xml::integer(&v["number"]).ok() == Some(n))
        .ok_or("Missing fixture game")?;
    let mut result = vec![];
    for (i, actor) in ["a", "b"].iter().enumerate() {
        let mut deck = json!({"main":[],"extra":[],"side":decks[i]["side"]});
        for section in ["main", "extra"] {
            for code in xml::items(&game[*actor][section], "card") {
                deck[section]
                    .as_array_mut()
                    .unwrap()
                    .push(json!(xml::integer(code)?));
            }
        }
        if identity::digest(&config::deck_doc(&deck))
            != identity::digest(&config::deck_doc(&decks[i]))
        {
            return Err(
                "Starting fixture is incompatible with resolved sideboarding configuration".into(),
            );
        }
        result.push(deck);
    }
    if n % 2 == 0 {
        result.swap(0, 1)
    }
    Ok(json!(result))
}

pub(crate) fn validate_side(
    c: &Config,
    ready: &Value,
    original: &Value,
    result: &Value,
) -> Result<()> {
    for deck in result["decks"]
        .as_array()
        .ok_or("Missing sideboard decks")?
    {
        config::validate_deck(deck, &ready["cards"], &c.rules)?;
        let mut a = vec![];
        let mut b = vec![];
        for section in ["main", "extra", "side"] {
            let before = original[section].as_array().unwrap();
            let after = deck[section]
                .as_array()
                .ok_or("Missing sideboard section")?;
            if before.len() != after.len() {
                return Err("Sideboard changed section sizes".into());
            }
            a.extend(before.iter().map(Value::to_string));
            b.extend(after.iter().map(Value::to_string));
        }
        a.sort();
        b.sort();
        if a != b {
            return Err("Sideboard changed total multiset".into());
        }
    }
    Ok(())
}

pub(crate) fn history(report: &Value) -> Value {
    // Histories exclude future starting orders and every other perspective's private record.
    json!(xml::items(&report["games"],"game").iter().take(2).map(|g| {let mut initial=g["initial"].clone(); initial.as_object_mut().map(|o|o.remove("own_starting_order")); json!({"gameId":g["game_id"],"decisions":[],"events":g["timeline"]["entry"],"initial":initial,"outcome":g["result"]["outcome"]})}).collect::<Vec<_>>())
}

pub(crate) fn sideboard(
    host: &mut Host,
    c: &Config,
    ready: &Value,
    reports: &mut [Value; 2],
    record: &mut Value,
    checkpoint: &mut Value,
) -> Result<()> {
    host.send(&json!({"type":"sideboard","decks":[c.deck,c.deck],"histories":[history(&reports[0]),history(&reports[1])]}))?;
    let limit = Duration::from_millis(xml::integer(&c.limits["sideboarding_wall_time_ms"])?);
    let mut deadline = Instant::now() + limit;
    let frame = loop {
        let frame = host.receive(deadline.saturating_duration_since(Instant::now()))?;
        if frame["type"] == "sideboard_hook" {
            checkpoint["player"] = json!(if frame["actor"] == 0 { "a" } else { "b" });
            if !frame["response"].is_null() {
                checkpoint["attempted_response"] = frame["response"].clone();
            }
            if frame["phase"] == "start" {
                deadline = Instant::now() + limit;
            }
            continue;
        }
        break frame;
    };
    if frame["type"] != "sideboard_done" {
        return Err(format!("Sideboarding host failure: {frame}").into());
    }
    validate_side(c, ready, &c.deck, &frame)?;
    for (i, actor) in ["a", "b"].iter().enumerate() {
        let d = &frame["decisions"][i];
        if xml::number(&frame["durations"][i])?
            > xml::number(&c.limits["sideboarding_wall_time_ms"])?
        {
            return Err("Sideboard exceeded individual deadline".into());
        }
        reports[i]["sideboarding"] = json!({"status":"completed","observed_game_ids":{"game_id":xml::items(&reports[i]["games"],"game").iter().take(2).map(|g|g["game_id"].clone()).collect::<Vec<_>>()},"legal_constraints":{"preserve_section_sizes":true,"preserve_total_multiset":true},"exchanges":{"exchange":d["exchanges"].as_array().ok_or("Missing exchanges")?.iter().map(|e|json!({"from_section":e["from"],"to_section":e["to"],"card_code":e["cardCode"],"copies":e["copies"],"reason_code":e["reason"]["code"],"explanation":e["reason"]["explanation"]})).collect::<Vec<_>>()},"reason":d["reason"],"resulting_configuration":frame["configurations"][i],"resulting_configuration_sha256":identity::digest(&frame["configurations"][i]),"duration_ms":frame["durations"][i],"bug_id":null});
        record["sideboarding"][format!("{actor}_configuration_sha256")] =
            json!(identity::digest(&frame["configurations"][i]));
    }
    record["sideboarding"]["status"] = json!("completed");
    record["sideboarding"]["decks"] = frame["decks"].clone();
    Ok(())
}

pub(crate) fn value_size(v: &Value) -> usize {
    match v {
        Value::Object(o) => o.iter().map(|(k, v)| k.len() + 32 + value_size(v)).sum(),
        Value::Array(a) => a.iter().map(|v| 16 + value_size(v)).sum(),
        Value::String(s) => s.len(),
        _ => 16,
    }
}
