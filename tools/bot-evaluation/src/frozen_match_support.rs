use crate::xml;
use crate::{
    config::{self, Config},
    host::Host,
    identity,
    metrics::Metrics,
    runtime_identity::now,
    xml::Result,
};
use serde_json::{json, Value};
use std::{
    fs,
    path::{Path, PathBuf},
    time::Duration,
};
pub fn save(path: &Path, value: &Value) -> Result<()> {
    crate::output_storage::write(path, &serde_json::to_vec_pretty(value)?)
}

pub fn read(path: &Path) -> Result<Value> {
    Ok(serde_json::from_slice(&fs::read(path)?)?)
}
pub fn configuration(job: &Value, item: &Value, output: &Path) -> Config {
    Config {
        doc: json!({"batch":{"matches":1,"execution":"frozen"}}),
        deck: item["decks"][0].clone(),
        bots: json!([]),
        snapshot: PathBuf::from(job["content"].as_str().unwrap()),
        banlist: PathBuf::from(job["banlist"].as_str().unwrap()),
        rules: job["rules"].clone(),
        profile: job["profile"].as_str().unwrap().into(),
        matches: 1,
        limits: job["limits"].clone(),
        output: output.to_owned(),
        fixture: None,
        target: 100.0,
        frozen: Some(item.clone()),
    }
}
pub fn initialize(host: &mut Host, job: &Value, item: &Value, c: &Config) -> Result<Value> {
    host.send(
        &json!({"type":"initialize","snapshot":c.snapshot,"codes":[],"bots":[],
        "frozen":{"bots":item["bots"],"engine":job["engine"]}}),
    )?;
    loop {
        let ready = host.receive(Duration::from_secs(120))?;
        match ready["type"].as_str() {
            Some("diagnostic") => continue,
            Some("ready") => {
                for d in item["decks"].as_array().ok_or("Missing decks")? {
                    config::validate_deck(d, &ready["cards"], &c.rules)?;
                }
                return Ok(ready);
            }
            _ => return Err(format!("Frozen host initialization: {ready}").into()),
        }
    }
}
pub fn match_manifest(job: &Value, item: &Value, runtime: &str) -> Value {
    let bots = json!({"a":{"artifact_sha256":item["identities"][0]},"b":{"artifact_sha256":item["identities"][1]}});
    json!({"run_id":job["identity"],"created_at":now(),"application_revision":env!("CARGO_PKG_VERSION"),
        "runtime_sha256":runtime,"runtime":{},"engine":{"sha256":job["engineHash"]},
        "content":{"sha256":job["fixtureIdentity"]},"rules":{"profile":job["profile"]},
        "deck":config::deck_doc(&item["decks"][0]),"bots":bots,"configuration":{"batch":{"matches":1}},
        "identity_sha256":identity::digest(&json!([job["identity"],item,runtime]))})
}
pub fn observe(metrics: &mut Metrics, record: &Value, reports: &[Value; 2]) {
    for (i, g) in xml::items(&record["games"], "game").iter().enumerate() {
        metrics.game(
            g,
            &[
                reports[0]["games"]["game"][i].clone(),
                reports[1]["games"]["game"][i].clone(),
            ],
        );
    }
    for r in reports {
        metrics.sideboard(r);
    }
    metrics.finish_match(record);
}
