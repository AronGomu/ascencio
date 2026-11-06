use crate::{
    config::{self, Config},
    host::Host,
    identity,
    xml::{self, Result},
};
use serde_json::{json, Value};
use std::{fs, time::Duration};
pub(crate) fn now() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .expect("UTC timestamp")
}

pub(crate) fn hardware() -> Value {
    let cpu = fs::read_to_string("/proc/cpuinfo")
        .unwrap_or_default()
        .lines()
        .find_map(|l| l.strip_prefix("model name\t: "))
        .unwrap_or("unavailable")
        .to_owned();
    let memory = fs::read_to_string("/proc/meminfo")
        .unwrap_or_default()
        .lines()
        .find_map(|l| l.strip_prefix("MemTotal:"))
        .and_then(|s| s.split_whitespace().next())
        .and_then(|s| s.parse::<u64>().ok())
        .map(|n| n * 1024);
    json!({"node":"host-reported","os":format!("{} {} {}",std::env::consts::OS,std::env::consts::ARCH,fs::read_to_string("/proc/sys/kernel/osrelease").unwrap_or_default().trim()),"cpu":cpu,"memory_bytes":memory})
}

pub(crate) fn rss(pid: u32) -> u64 {
    fs::read_to_string(format!("/proc/{pid}/status"))
        .ok()
        .and_then(|s| {
            s.lines()
                .find(|l| l.starts_with("VmRSS:"))
                .map(str::to_owned)
        })
        .and_then(|s| {
            s.split_whitespace()
                .nth(1)
                .and_then(|s| s.parse::<u64>().ok())
        })
        .unwrap_or(0)
        * 1024
}

pub(crate) fn init(host: &mut Host, c: &Config) -> Result<Value> {
    let codes = [&c.deck, &c.deck_b]
        .into_iter()
        .flat_map(|deck| deck.as_object().unwrap().values())
        .flat_map(|v| v.as_array().unwrap().iter().cloned())
        .collect::<Vec<_>>();
    host.send(&json!({"type":"initialize","snapshot":c.snapshot,"codes":codes,"bots":c.bots}))?;
    loop {
        let value = host.receive(Duration::from_secs(120))?;
        match value["type"].as_str() {
            Some("ready") => {
                config::validate_deck(&c.deck, &value["cards"], &c.rules)?;
                config::validate_deck(&c.deck_b, &value["cards"], &c.rules)?;
                return Ok(value);
            }
            Some("diagnostic") => (),
            _ => return Err(format!("Host initialization: {value}").into()),
        }
    }
}

pub(crate) fn manifest(c: &Config, ready: &Value, run: &str) -> Result<Value> {
    let mut bots = json!({});
    for (i, actor) in ["a", "b"].iter().enumerate() {
        let artifact = &ready["artifacts"][i];
        let dependencies = artifact["dependencies"]
            .as_array()
            .ok_or("Missing dependencies")?
            .iter()
            .map(|d| {
                let file = xml::text(&d["path"])?;
                let bytes = fs::read(file)?;
                if bytes != xml::text(&d["source"])?.as_bytes() {
                    return Err("Bot dependency changed during startup".into());
                }
                Ok(json!({"path":file,"sha256":identity::sha(bytes)}))
            })
            .collect::<Result<Vec<_>>>()?;
        bots[*actor] = json!({"module":artifact["module"],"artifact_sha256":identity::digest(&json!({"source":artifact["source"],"dependencies":dependencies})),"artifact_source":artifact["source"],"dependencies":{"dependency":dependencies},"config":artifact["config"],"config_sha256":identity::digest(&artifact["config"])});
    }
    let runtime_identity = crate::application_identity::digest()?;
    let revision = String::from_utf8(
        std::process::Command::new("git")
            .args(["rev-parse", "HEAD"])
            .output()?
            .stdout,
    )?
    .trim()
    .to_owned();
    let mut normalized = c.doc.clone();
    normalized["output"] = json!({});
    let mut saved_configuration = c.doc.clone();
    saved_configuration["starting_orders"]["fixture"] = json!(c.fixture);
    let deck = config::deck_doc(&c.deck);
    let opponent_deck = config::deck_doc(&c.deck_b);
    let engine = identity::sha(fs::read("vendor/ocgcore-wasm/0.1.2/lib/ocgcore.sync.wasm")?);
    let content = identity::digest(&ready["manifest"]);
    let banlist = identity::sha(fs::read(&c.banlist)?);
    let identity_hash = identity::digest(
        &json!({"configuration":normalized,"deck":deck,"opponent_deck":opponent_deck,"bots":bots,"engine":engine,"content":content,"banlist":banlist,"fixture":c.fixture,"revision":revision,"runtime":runtime_identity}),
    );
    Ok(
        json!({"run_id":run,"created_at":now(),"application_revision":revision,"runtime_sha256":runtime_identity,"runtime":{ "node":ready["node"], "node_flags":ready["node_flags"], "os":hardware()["os"], "cpu":hardware()["cpu"], "memory_bytes":hardware()["memory_bytes"] },"engine":{"version":"ocgcore-wasm-0.1.2","sha256":engine},"content":{"snapshot_id":ready["manifest"]["snapshotId"],"sha256":content},"rules":{"profile":c.profile,"banlist_sha256":banlist},"deck":{"sha256":identity::digest(&deck),"main":deck["main"],"extra":deck["extra"],"side":deck["side"]},"opponent_deck":{"sha256":identity::digest(&opponent_deck),"main":opponent_deck["main"],"extra":opponent_deck["extra"],"side":opponent_deck["side"]},"bots":bots,"configuration":saved_configuration,"identity_sha256":identity_hash}),
    )
}
