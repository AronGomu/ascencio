use crate::xml::{self, Result};
use serde_json::{json, Value};
use std::{
    fs,
    path::{Path, PathBuf},
};
#[derive(Clone)]
pub struct Config {
    pub doc: Value,
    pub deck: Value,
    pub bots: Value,
    pub snapshot: PathBuf,
    pub banlist: PathBuf,
    pub rules: Value,
    pub profile: String,
    pub matches: u64,
    pub limits: Value,
    pub output: PathBuf,
    pub fixture: Option<Value>,
    pub target: f64,
}
fn resolve(base: &Path, v: &Value) -> Result<PathBuf> {
    let s = xml::text(v)?;
    if s.is_empty() {
        return Err("Empty path".into());
    }
    Ok(base.join(s).canonicalize()?)
}
pub fn read(file: &Path) -> Result<Config> {
    let source = file.canonicalize()?;
    let base = source.parent().unwrap();
    let mut doc = xml::read(&source, "evaluation")?;
    xml::validate("evaluation", &fs::read(&source)?)?;
    let matches = xml::integer(&doc["batch"]["matches"])?;
    if !(1..=10000).contains(&matches) || doc["batch"]["execution"] != "sequential" {
        return Err("Expected 1–10000 sequential matches".into());
    }
    let profile = xml::text(&doc["rules"]["profile"])?.to_string();
    if profile != "mr3" && profile != "mr5" {
        return Err("Unsupported rules profile".into());
    }
    let deck_file = resolve(base, &doc["deck"]["path"])?;
    let deck = parse_deck(&fs::read_to_string(deck_file)?)?;
    let mut bots = vec![];
    for actor in ["a", "b"] {
        let b = &doc["bots"][actor];
        let module = xml::text(&b["module"])?;
        let module = if module == "builtin:basic" {
            module.to_string()
        } else {
            resolve(base, &b["module"])?.to_string_lossy().into_owned()
        };
        let configuration = b["config"]
            .as_object()
            .ok_or("Bot config must be a scalar object")?;
        if configuration
            .values()
            .any(|v| !v.is_string() && !v.is_number() && !v.is_boolean())
        {
            return Err("Bot config values must be scalar".into());
        }
        bots.push(json!({"module":module,"config":b["config"]}));
    }
    let limits = doc["limits"].clone();
    for key in [
        "game_wall_time_ms",
        "decision_wall_time_ms",
        "sideboarding_wall_time_ms",
        "max_turns_per_game",
        "max_decisions_per_game",
    ] {
        if xml::integer(&limits[key])? == 0 {
            return Err(format!("Invalid {key}").into());
        }
    }
    let limits = json!({"game_wall_time_ms":xml::integer(&limits["game_wall_time_ms"])?,"decision_wall_time_ms":xml::integer(&limits["decision_wall_time_ms"])?,"sideboarding_wall_time_ms":xml::integer(&limits["sideboarding_wall_time_ms"])?,"max_turns_per_game":xml::integer(&limits["max_turns_per_game"])?,"max_decisions_per_game":xml::integer(&limits["max_decisions_per_game"])?});
    let snapshot = resolve(base, &doc["content"]["snapshot"])?;
    let banlist = resolve(base, &doc["rules"]["banlist"])?;
    let rules: Value = serde_json::from_slice(&fs::read(&banlist)?)?;
    if rules["defaultLimit"].as_u64().is_none_or(|n| n > 3)
        || !rules["limits"].is_object()
        || rules["limits"]
            .as_object()
            .unwrap()
            .values()
            .any(|v| v.as_u64().is_none_or(|n| n > 3))
    {
        return Err("Invalid JSON banlist".into());
    }
    let fixture = match xml::text(&doc["starting_orders"]["mode"])? {
        "normal" => {
            if !doc["starting_orders"]["fixture_path"].is_null() {
                return Err("Normal mode requires nil fixture".into());
            }
            None
        }
        "fixture" => Some(xml::read(
            &resolve(base, &doc["starting_orders"]["fixture_path"])?,
            "starting-orders",
        )?),
        _ => return Err("Invalid starting order mode".into()),
    };
    let output = base.join(xml::text(&doc["output"]["directory"])?);
    if doc["performance_target"].is_null() {
        // Owner's sample-first goal; snapshot the resolved default in the manifest.
        doc["performance_target"] = json!({"warm_game_p95_ms":100.0});
    }
    let target = xml::number(&doc["performance_target"]["warm_game_p95_ms"])?;
    if target <= 0.0 {
        return Err("Invalid latency target".into());
    }
    Ok(Config {
        doc,
        deck,
        bots: json!(bots),
        snapshot,
        banlist,
        rules,
        profile,
        matches,
        limits,
        output,
        fixture,
        target,
    })
}
fn parse_deck(text: &str) -> Result<Value> {
    let mut deck = json!({"main":[],"extra":[],"side":[]});
    let mut section = "";
    for l in text.lines() {
        let l = l.trim();
        match l {
            "#main" => section = "main",
            "#extra" => section = "extra",
            "!side" => section = "side",
            _ if l.is_empty() || l.starts_with('#') => (),
            _ => {
                let code: u32 = l.parse()?;
                if code == 0 || section.is_empty() {
                    return Err("Invalid deck code/section".into());
                }
                deck[section].as_array_mut().unwrap().push(json!(code));
            }
        }
    }
    Ok(deck)
}
pub fn deck_doc(deck: &Value) -> Value {
    let mut result = json!({});
    for section in ["main", "extra", "side"] {
        let mut counts = std::collections::BTreeMap::<String, u64>::new();
        for code in deck[section].as_array().unwrap() {
            *counts.entry(code.to_string()).or_default() += 1;
        }
        result[section] = json!({"card":counts.into_iter().map(|(card_code,copies)|json!({"card_code":card_code,"copies":copies})).collect::<Vec<_>>()});
    }
    result
}
pub fn validate_deck(deck: &Value, cards: &Value, rules: &Value) -> Result<()> {
    let lengths = [
        deck["main"].as_array().ok_or("Missing Main")?.len(),
        deck["extra"].as_array().ok_or("Missing Extra")?.len(),
        deck["side"].as_array().ok_or("Missing Side")?.len(),
    ];
    if !(40..=60).contains(&lengths[0]) || lengths[1] > 15 || lengths[2] > 15 {
        return Err("Illegal deck sizes".into());
    }
    let mut counts = std::collections::BTreeMap::<String, u64>::new();
    for section in ["main", "extra", "side"] {
        for code in deck[section].as_array().unwrap() {
            let code = code.as_u64().ok_or("Invalid card code")?.to_string();
            let card = cards
                .as_array()
                .ok_or("Missing card catalog")?
                .iter()
                .find(|c| c["code"] == code)
                .ok_or("Unavailable card")?;
            let ty = card["type"].as_u64().ok_or("Missing card type")?;
            let extra = ty & (0x40 | 0x2000 | 0x800000 | 0x4000000) != 0;
            if section == "extra" && !extra || section == "main" && extra || ty & 0x4000 != 0 {
                return Err("Illegal card placement/token".into());
            }
            let alias = xml::text(&card["alias"])?;
            *counts
                .entry(if alias == "0" { code } else { alias.to_owned() })
                .or_default() += 1;
        }
    }
    for (code, count) in counts {
        if count
            > rules["limits"][&code]
                .as_u64()
                .unwrap_or(rules["defaultLimit"].as_u64().unwrap())
        {
            return Err(format!("Copy restriction exceeded: {code}").into());
        }
    }
    Ok(())
}
