use crate::{identity, xml::Result};
use serde_json::Value;
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    os::unix::fs::{FileTypeExt, OpenOptionsExt},
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
pub fn regular_bytes(path: &Path, limit: u64) -> Result<Vec<u8>> {
    let file = OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_NOFOLLOW | libc::O_NONBLOCK)
        .open(path)?;
    let metadata = file.metadata()?;
    if !metadata.is_file() || metadata.len() > limit {
        return Err("Expected bounded regular file".into());
    }
    let mut bytes = Vec::new();
    file.take(limit + 1).read_to_end(&mut bytes)?;
    if bytes.len() as u64 > limit {
        return Err("File exceeds byte limit".into());
    }
    Ok(bytes)
}
pub fn read(path: &Path) -> Result<Value> {
    Ok(serde_json::from_slice(&regular_bytes(
        path,
        64 * 1024 * 1024,
    )?)?)
}
pub fn size(path: &Path) -> Result<u64> {
    // Writers atomically rename temporary reports during the scan. Missing
    // entries are normal; all other I/O errors remain failures.
    let meta = match fs::symlink_metadata(path) {
        Ok(meta) => meta,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(0),
        Err(error) => return Err(error.into()),
    };
    if !meta.is_dir() {
        return Ok(meta.len());
    }
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(0),
        Err(error) => return Err(error.into()),
    };
    let mut total = 0_u64;
    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(error) => return Err(error.into()),
        };
        total = total
            .checked_add(size(&entry.path())?)
            .ok_or("Storage size overflow")?;
    }
    Ok(total)
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
            records.push((
                path.strip_prefix(root)?.to_string_lossy().to_string(),
                format!("symlink:{}", fs::read_link(path)?.to_string_lossy()),
            ));
            return Ok(());
        }
        if !meta.is_dir() && !meta.is_file() {
            records.push((
                path.strip_prefix(root)?.to_string_lossy().to_string(),
                format!(
                    "special:fifo={}:socket={}",
                    meta.file_type().is_fifo(),
                    meta.file_type().is_socket()
                ),
            ));
            return Ok(());
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
#[cfg(test)]
mod untrusted_files_tests {
    use super::*;
    #[test]
    fn links_are_accounted_without_traversal_and_cannot_be_read_as_results() {
        let root = std::env::temp_dir().join(format!("loop-links-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        std::os::unix::fs::symlink(&root, root.join("cycle")).unwrap();
        assert_eq!(
            size(&root).unwrap(),
            fs::symlink_metadata(root.join("cycle")).unwrap().len()
        );
        assert!(evidence_digest(&root).is_ok());
        assert!(regular_bytes(&root.join("cycle"), 1024).is_err());
        let fifo = root.join("fifo");
        let name = std::ffi::CString::new(fifo.to_str().unwrap()).unwrap();
        assert_eq!(unsafe { libc::mkfifo(name.as_ptr(), 0o600) }, 0);
        assert!(regular_bytes(&fifo, 1024).is_err());
        assert!(evidence_digest(&root).is_ok());
        fs::remove_dir_all(root).unwrap();
    }
}
#[cfg(test)]
mod concurrent_scan_tests {
    use super::*;
    #[test]
    fn atomic_report_publication_does_not_fail_size_scans() {
        let root = std::env::temp_dir().join(format!("loop-scan-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        assert_eq!(size(&root.join("already-renamed.tmp")).unwrap(), 0);
        let target = root.clone();
        let writer = std::thread::spawn(move || {
            for _ in 0..500 {
                fs::write(target.join("report.tmp"), b"report").unwrap();
                fs::rename(target.join("report.tmp"), target.join("report.xml")).unwrap();
            }
        });
        for _ in 0..1000 {
            assert!(size(&root).is_ok());
        }
        writer.join().unwrap();
        assert_eq!(size(&root).unwrap(), 6);
        fs::remove_dir_all(root).unwrap();
    }
}
