//! Open paths relative to a directory capability; symlink races cannot escape that root.
use cap_std::{ambient_authority, fs::Dir};
use std::{fs::File, path::Path};
pub(crate) fn open(root: &Path, relative: &str) -> Result<File, String> {
    if !crate::native_startup::safe_path(relative) {
        return Err("SOURCE_PATH_REFUSED".into());
    }
    Dir::open_ambient_dir(root, ambient_authority())
        .and_then(|dir| dir.open(relative))
        .map(|file| file.into_std())
        .map_err(|error| error.to_string())
}
#[cfg(test)]
mod tests {
    #[test]
    #[cfg(unix)]
    fn refuses_symlink_escape_from_declared_root() {
        let root =
            std::env::temp_dir().join(format!("ascencio-containment-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&root).unwrap();
        std::os::unix::fs::symlink("/etc/passwd", root.join("escape")).unwrap();
        assert!(super::open(&root, "escape").is_err());
        std::fs::remove_dir_all(root).unwrap();
    }
}
