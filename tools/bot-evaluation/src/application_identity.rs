//! Executable and interoperability identity, including uncommitted runtime changes.
use crate::{identity, xml::Result};
use serde_json::json;
use std::{fs, path::Path};
pub fn digest() -> Result<String> {
    digest_for(&std::env::current_exe()?)
}
pub fn digest_for(executable_path: &Path) -> Result<String> {
    fn visit(path: &Path, records: &mut Vec<(String, String)>) -> Result<()> {
        if path.is_dir() {
            let mut entries = fs::read_dir(path)?
                .map(|e| e.map(|e| e.path()))
                .collect::<std::io::Result<Vec<_>>>()?;
            entries.sort();
            for entry in entries {
                visit(&entry, records)?;
            }
        } else {
            records.push((
                path.to_string_lossy().into_owned(),
                identity::sha(fs::read(path)?),
            ));
        }
        Ok(())
    }
    let mut records = Vec::new();
    for path in [
        "scripts/bot-evaluation",
        "src/battle",
        "src/storage",
        "src/decks",
        "schemas/bot-evaluation",
        "vendor/ocgcore-wasm/0.1.2",
        "package-lock.json",
    ] {
        visit(Path::new(path), &mut records)?;
    }
    let executable = identity::sha(fs::read(executable_path)?);
    Ok(identity::digest(
        &json!({"executable":executable,"sources":records}),
    ))
}
