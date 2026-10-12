use std::{fs, path::Path};

// APK assets cannot be walked with std::fs. Embed the exact staged file inventory.
pub(crate) fn inventory(root: &Path, dir: &Path, files: &mut Vec<(String, u64)>, total: &mut u64) {
    for entry in fs::read_dir(dir).expect("read bundled resources") {
        let entry = entry.expect("read bundled entry");
        let path = entry.path();
        let relative = path
            .strip_prefix(root)
            .unwrap()
            .to_str()
            .expect("UTF-8 bundle path")
            .replace(std::path::MAIN_SEPARATOR, "/");
        assert!(
            relative.len() <= 1024
                && !relative.contains(['\\', '\0', ':'])
                && relative
                    .split('/')
                    .all(|part| !part.is_empty() && part != "." && part != ".."),
            "unsafe bundled resource path"
        );
        let kind = entry.file_type().expect("bundled file type");
        if kind.is_dir() {
            inventory(root, &path, files, total);
        } else {
            assert!(
                kind.is_file(),
                "bundled resources must not contain symlinks"
            );
            let bytes = entry.metadata().expect("bundled file size").len();
            *total += bytes;
            assert!(
                bytes <= 128 * 1024 * 1024 && *total <= 16 * 1024 * 1024 * 1024,
                "bundled resource byte limit"
            );
            assert!(files.len() < 200_000, "bundled resource count limit");
            files.push((relative, bytes));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn temp() -> std::path::PathBuf {
        let name = format!("ascencio-inventory-{}", uuid::Uuid::new_v4());
        std::env::temp_dir().join(name)
    }
    #[test]
    fn staged_inventory_contains_nested_sources_and_media_with_exact_lengths() {
        let root = temp();
        fs::create_dir_all(root.join("cards")).unwrap();
        fs::create_dir_all(root.join("media")).unwrap();
        fs::write(root.join("cards/one.json"), b"{}").unwrap();
        fs::write(root.join("media/one.png"), b"image").unwrap();
        let mut entries = vec![];
        let mut total = 0;
        inventory(&root, &root, &mut entries, &mut total);
        entries.sort();
        assert_eq!(
            entries,
            vec![("cards/one.json".into(), 2), ("media/one.png".into(), 5)]
        );
        assert_eq!(total, 7);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn oversized_staged_resource_is_refused_before_embedding() {
        let root = temp();
        fs::create_dir_all(&root).unwrap();
        fs::File::create(root.join("large"))
            .unwrap()
            .set_len(128 * 1024 * 1024 + 1)
            .unwrap();
        let result = std::panic::catch_unwind(|| inventory(&root, &root, &mut vec![], &mut 0));
        fs::remove_dir_all(root).unwrap();
        assert!(result.is_err());
    }
    #[test]
    #[cfg(unix)]
    fn staged_symlinks_are_refused_before_embedding() {
        let root = temp();
        fs::create_dir_all(&root).unwrap();
        std::os::unix::fs::symlink("/etc/passwd", root.join("escape")).unwrap();
        let result = std::panic::catch_unwind(|| inventory(&root, &root, &mut vec![], &mut 0));
        fs::remove_dir_all(root).unwrap();
        assert!(result.is_err());
    }
}
