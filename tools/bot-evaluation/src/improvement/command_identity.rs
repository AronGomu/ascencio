//! Pin built-in adapters, invoked executable/script files and declared dependencies.
use super::config::Config;
use crate::{identity, xml::Result};
use serde_json::json;
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};
fn visit(path: &Path, records: &mut BTreeMap<PathBuf, String>) -> Result<()> {
    let path = path.canonicalize()?;
    if records.contains_key(&path) {
        return Ok(());
    }
    if path.is_dir() {
        records.insert(path.clone(), "directory".into());
        for entry in fs::read_dir(path)? {
            visit(&entry?.path(), records)?;
        }
    } else {
        records.insert(path.clone(), identity::sha(fs::read(path)?));
    }
    Ok(())
}
fn executable(name: &str) -> Result<PathBuf> {
    let path = Path::new(name);
    if path.components().count() > 1 {
        return Ok(path.canonicalize()?);
    }
    for directory in std::env::split_paths(&std::env::var_os("PATH").unwrap_or_default()) {
        let candidate = directory.join(name);
        if candidate.is_file() {
            return Ok(candidate.canonicalize()?);
        }
    }
    Err(format!("Command executable not found: {name}").into())
}
pub fn digest(c: &Config) -> Result<String> {
    let mut records = BTreeMap::new();
    visit(Path::new("scripts/bot-improvement"), &mut records)?;
    for argv in std::iter::once(&c.agent).chain(c.checks.iter()) {
        visit(&executable(&argv[0])?, &mut records)?;
        for argument in &argv[1..] {
            let path = Path::new(argument);
            if path.is_file() {
                visit(path, &mut records)?;
            }
        }
    }
    for path in &c.command_inputs {
        visit(path, &mut records)?;
    }
    Ok(identity::digest(&json!(records)))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn declared_dependency_content_changes_identity() {
        let root = std::env::temp_dir().join(format!("loop-command-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        let source = root.join("check-dependency.js");
        fs::write(&source, "original").unwrap();
        let mut before = BTreeMap::new();
        visit(&root, &mut before).unwrap();
        fs::write(&source, "changed").unwrap();
        let mut after = BTreeMap::new();
        visit(&root, &mut after).unwrap();
        assert_ne!(before, after);
        fs::remove_dir_all(root).unwrap();
    }
}
