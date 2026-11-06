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
    // Retain the declared route as well as its resolved identity. Canonicalizing
    // the key alone loses link selections when both targets are already visited.
    let path = std::path::absolute(path)?;
    if records.contains_key(&path) {
        return Ok(());
    }
    let metadata = fs::symlink_metadata(&path)?;
    let resolved = path.canonicalize()?;
    if metadata.file_type().is_symlink() {
        records.insert(
            path.clone(),
            format!(
                "link:{}:resolved:{}",
                fs::read_link(&path)?.display(),
                resolved.display()
            ),
        );
        visit(&resolved, records)?;
    } else if metadata.is_dir() {
        records.insert(path.clone(), format!("directory:{}", resolved.display()));
        for entry in fs::read_dir(path)? {
            visit(&entry?.path(), records)?;
        }
    } else if metadata.is_file() {
        records.insert(
            path.clone(),
            format!(
                "file:{}:{}",
                resolved.display(),
                identity::sha(fs::read(path)?)
            ),
        );
    } else {
        return Err(
            "Command dependencies must be regular files/directories or resolvable links".into(),
        );
    }
    Ok(())
}
fn executable(name: &str) -> Result<PathBuf> {
    let path = Path::new(name);
    if path.components().count() > 1 {
        return Ok(std::path::absolute(path)?);
    }
    for directory in std::env::split_paths(&std::env::var_os("PATH").unwrap_or_default()) {
        let candidate = directory.join(name);
        if candidate.is_file() {
            return Ok(std::path::absolute(candidate)?);
        }
    }
    Err(format!("Command executable not found: {name}").into())
}
pub fn digest(c: &Config) -> Result<String> {
    commands(
        &std::iter::once(c.agent.clone())
            .chain(c.checks.clone())
            .collect::<Vec<_>>(),
        &c.command_inputs,
    )
}
pub fn commands(argvs: &[Vec<String>], inputs: &[PathBuf]) -> Result<String> {
    let mut records = BTreeMap::new();
    visit(Path::new("scripts/bot-improvement"), &mut records)?;
    if Path::new("scripts/bot-campaign").exists() {
        visit(Path::new("scripts/bot-campaign"), &mut records)?;
    }
    for argv in argvs {
        visit(&executable(&argv[0])?, &mut records)?;
        for argument in &argv[1..] {
            let path = Path::new(argument);
            if path.is_file() {
                visit(path, &mut records)?;
            }
        }
    }
    for path in inputs {
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
#[cfg(test)]
mod symlink_tests {
    use super::*;
    #[test]
    fn retargeted_directory_entries_and_loaded_config_inputs_change_identity() {
        let root = std::env::temp_dir().join(format!("loop-command-links-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("a.js"), "a").unwrap();
        fs::write(root.join("b.js"), "b").unwrap();
        let link = root.join("selected.js");
        std::os::unix::fs::symlink("a.js", &link).unwrap();
        // Both targets already appear in the declared dependency tree.
        let mut before = BTreeMap::new();
        visit(&root, &mut before).unwrap();
        fs::remove_file(&link).unwrap();
        std::os::unix::fs::symlink("b.js", &link).unwrap();
        let mut after = BTreeMap::new();
        visit(&root, &mut after).unwrap();
        assert_ne!(before, after);
        fs::write(root.join("evaluation.xml"), "").unwrap();
        fs::write(root.join("initial.mjs"), "").unwrap();
        let config = root.join("loop.json");
        fs::write(&config,serde_json::to_vec(&json!({"evaluation":"evaluation.xml","initial_strategy":"initial.mjs","output":"output","agent":["true"],"checks":[["true"]],"command_inputs":["selected.js"],"max_iterations":1,"max_games":4,"max_no_improvement":1,"development_matches":1,"confirmation_matches":1,"max_wall_ms":1000,"agent_timeout_ms":100,"check_timeout_ms":100,"evaluation_timeout_ms":100,"max_bytes":1000})).unwrap()).unwrap();
        let loaded = Config::read(&config).unwrap();
        assert_eq!(loaded.command_inputs[0], link);
        let mut before = BTreeMap::new();
        visit(&loaded.command_inputs[0], &mut before).unwrap();
        fs::remove_file(&link).unwrap();
        std::os::unix::fs::symlink("a.js", &link).unwrap();
        let mut after = BTreeMap::new();
        visit(&loaded.command_inputs[0], &mut after).unwrap();
        assert_ne!(before, after);
        // A resolvable directory cycle is finite, while a broken link is rejected.
        std::os::unix::fs::symlink(".", root.join("cycle")).unwrap();
        let mut records = BTreeMap::new();
        visit(&root, &mut records).unwrap();
        fs::remove_file(&link).unwrap();
        std::os::unix::fs::symlink("missing.js", &link).unwrap();
        assert!(visit(&link, &mut BTreeMap::new()).is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
