use crate::{identity, xml::Result};
use serde_json::Value;
use std::{
    fs::{self, File, OpenOptions},
    io::Write,
    path::Path,
};
pub fn save(path: &Path, value: &Value) -> Result<()> {
    fs::create_dir_all(path.parent().unwrap())?;
    let temp = path.with_extension("tmp");
    let mut file = File::create(&temp)?;
    file.write_all(&serde_json::to_vec_pretty(value)?)?;
    file.sync_all()?;
    fs::rename(temp, path)?;
    File::open(path.parent().unwrap())?.sync_all()?;
    Ok(())
}
pub fn read(path: &Path) -> Result<Value> {
    Ok(serde_json::from_slice(&fs::read(path)?)?)
}
pub fn size(path: &Path) -> Result<u64> {
    let meta = fs::symlink_metadata(path)?;
    if meta.file_type().is_symlink() {
        return Err("Symlink in campaign evidence".into());
    }
    if meta.is_dir() {
        fs::read_dir(path)?.try_fold(0, |n, e| Ok(n + size(&e?.path())?))
    } else {
        Ok(meta.len())
    }
}
pub fn archive(root: &Path, source: &[u8]) -> Result<String> {
    let id = identity::sha(source);
    let dir = root.join("versions").join(&id);
    fs::create_dir_all(&dir)?;
    let path = dir.join("strategy.mjs");
    if path.exists() {
        if fs::read(path)? != source {
            return Err("Archive changed".into());
        }
    } else {
        let mut f = OpenOptions::new().write(true).create_new(true).open(path)?;
        f.write_all(source)?;
        f.sync_all()?;
    }
    File::open(&dir)?.sync_all()?;
    File::open(dir.parent().unwrap())?.sync_all()?;
    Ok(id)
}
pub fn verify(root: &Path) -> Result<()> {
    for entry in fs::read_dir(root.join("versions"))? {
        let entry = entry?;
        if identity::sha(fs::read(entry.path().join("strategy.mjs"))?)
            != entry.file_name().to_string_lossy()
        {
            return Err("Archived version hash mismatch".into());
        }
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn archive_deduplicates_and_detects_tampering() {
        let root = std::env::temp_dir().join(format!("bot-archive-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        let id = archive(&root, b"source").unwrap();
        assert_eq!(id, archive(&root, b"source").unwrap());
        verify(&root).unwrap();
        fs::write(
            root.join("versions").join(id).join("strategy.mjs"),
            "changed",
        )
        .unwrap();
        assert!(verify(&root).is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
pub fn evidence_digest(root: &Path) -> Result<String> {
    fn visit(root: &Path, path: &Path, records: &mut Vec<(String, String)>) -> Result<()> {
        let meta = fs::symlink_metadata(path)?;
        if meta.file_type().is_symlink() {
            return Err("Symlink in immutable evidence".into());
        }
        if meta.is_dir() {
            let mut entries = fs::read_dir(path)?
                .map(|e| e.map(|e| e.path()))
                .collect::<std::io::Result<Vec<_>>>()?;
            entries.sort();
            for entry in entries {
                visit(root, &entry, records)?;
            }
        } else if path != root.join("decision.json") {
            records.push((
                path.strip_prefix(root)?.to_string_lossy().to_string(),
                identity::sha(fs::read(path)?),
            ));
        }
        Ok(())
    }
    let mut records = Vec::new();
    visit(root, root, &mut records)?;
    Ok(identity::digest(&serde_json::json!(records)))
}
