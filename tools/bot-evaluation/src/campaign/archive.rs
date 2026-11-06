use super::config::Config;
use crate::{identity, improvement::storage, xml::Result};
use serde_json::{json, Value};
use std::{
    fs,
    path::{Path, PathBuf},
};
pub fn package(c: &Config, source: &[u8], config: &Value) -> Result<String> {
    let text = std::str::from_utf8(source)?;
    if text.contains("import") || text.contains("require(") {
        return Err("Strategy must be self-contained".into());
    }
    let value = json!({"source":text,"config":config});
    let id = identity::digest(&value);
    let dir = c.output.join("versions").join(&id);
    if dir.exists() {
        verify_one(&dir, &id)?;
    } else {
        let pending = c
            .output
            .join("pending-packages")
            .join(format!("{id}-{}", super::now()));
        fs::create_dir_all(&pending)?;
        storage::save(&pending.join("package.json"), &value)?;
        fs::write(pending.join("strategy.mjs"), source)?;
        fs::write(pending.join("bot.mjs"), bridge_source()?)?;
        for name in ["strategy.mjs", "bot.mjs"] {
            fs::File::open(pending.join(name))?.sync_all()?;
        }
        fs::File::open(&pending)?.sync_all()?;
        fs::create_dir_all(dir.parent().unwrap())?;
        fs::rename(pending, &dir)?;
        fs::File::open(dir.parent().unwrap())?.sync_all()?;
    }
    Ok(id)
}
fn bridge_source() -> Result<String> {
    let shared = std::env::current_dir()?.join("src/battle/worker/bot/generalist-bot.ts");
    let policy = std::env::current_dir()?.join("scripts/bot-evaluation/recoverable-strategy.mjs");
    Ok(format!("import {{adjustScore}} from {};\nimport {{createGeneralistBotModule as shared}} from {};\nimport * as strategy from './strategy.mjs';\nexport function createBotModule(dependencies) {{ return {{contractVersion:1,create(config) {{ const configuration=Object.freeze(Object.hasOwn(config,\"__campaign_package_json\") ? JSON.parse(config.__campaign_package_json) : {{...config}}); const score=strategy.createStrategy(dependencies,configuration); const base=shared(dependencies,(input,choice)=>adjustScore(score(input,choice),input,choice),strategy.selectCounts); const bot=base.create({{}}); return strategy.sideboard ? {{...bot,sideboard:(input)=>strategy.sideboard(input,configuration)}} : bot; }} }}; }}\n",serde_json::to_string(&policy)?,serde_json::to_string(&shared)?))
}
pub fn verify_one(dir: &Path, id: &str) -> Result<()> {
    let value = storage::read(&dir.join("package.json"))?;
    if identity::digest(&value) != id
        || storage::regular_bytes(&dir.join("strategy.mjs"), 1024 * 1024)?
            != value["source"].as_str().ok_or("Missing source")?.as_bytes()
        || fs::read_to_string(dir.join("bot.mjs"))? != bridge_source()?
    {
        return Err("Immutable package changed".into());
    }
    Ok(())
}
pub fn module(c: &Config, id: &str) -> Result<(PathBuf, Value)> {
    let dir = c.output.join("versions").join(id);
    verify_one(&dir, id)?;
    Ok((
        dir.join("bot.mjs"),
        storage::read(&dir.join("package.json"))?["config"].clone(),
    ))
}
pub fn register(s: &mut Value, deck: &str, id: &str, round: u64, parent: &str, proposal: Value) {
    let versions = s["decks"][deck]["versions"].as_array_mut().unwrap();
    if !versions.iter().any(|v| v["id"] == id) {
        versions
            .push(json!({"id":id,"round":round,"parent":parent,"proposal":proposal,"valid":true}));
    }
}
