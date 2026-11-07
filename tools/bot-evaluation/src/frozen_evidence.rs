//! Frozen match completion markers, replay identities and corruption checks.
use crate::{
    frozen_pool::{read, save},
    identity,
    match_evidence::verify_evidence,
    xml::{self, Result},
};
use serde_json::{json, Value};
use std::{fs, path::Path};
pub fn replay_record(record: &Value, reports: &[Value; 2]) -> Value {
    json!({"games":xml::items(&record["games"],"game").iter().enumerate().map(|(i,g)|json!({"id":g["game_id"],"hash":g["evidence_sha256"],"configurations":[reports[0]["games"]["game"][i]["configuration_sha256"],reports[1]["games"]["game"][i]["configuration_sha256"]]})).collect::<Vec<_>>()})
}
fn evidence_files(base: &Path) -> Result<Value> {
    fn visit(base: &Path, dir: &Path, files: &mut Value) -> Result<()> {
        for e in fs::read_dir(dir)? {
            let p = e?.path();
            if p.is_dir() {
                visit(base, &p, files)?;
            } else if p.file_name().unwrap() != "done.json" {
                files[p.strip_prefix(base)?.to_string_lossy().as_ref()] =
                    json!(identity::sha(fs::read(&p)?));
            }
        }
        Ok(())
    }
    let mut files = json!({});
    visit(base, base, &mut files)?;
    Ok(files)
}
pub fn restore(base: &Path, manifest: &Value, id: &str) -> Result<(Value, [Value; 2])> {
    let completion = read(&base.join("done.json"))?;
    if completion["files"] != evidence_files(base)? {
        return Err("Completed evidence bytes changed".into());
    }
    let saved = xml::read(&base.join("manifest.xml"), "manifest")?;
    if saved["identity_sha256"] != manifest["identity_sha256"] {
        return Err("Completed match inputs changed".into());
    }
    let dir = base.join("matches").join(id);
    let record = xml::read(&dir.join("match.xml"), "match")?;
    let reports = [
        xml::read(&dir.join("player-a.xml"), "player-report")?,
        xml::read(&dir.join("player-b.xml"), "player-report")?,
    ];
    verify_evidence(&record, &reports, manifest, id)?;
    Ok((record, reports))
}
pub fn finalize(base: &Path) -> Result<()> {
    save(
        &base.join("done.json"),
        &json!({"files":evidence_files(base)?}),
    )
}
