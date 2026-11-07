use crate::runtime_identity::rss;
use std::{collections::BTreeSet, fs};
/// Sum each process once, including Node hosts and bot subprocesses (threads share RSS).
pub fn tree_rss() -> u64 {
    let mut processes = vec![];
    if let Ok(entries) = fs::read_dir("/proc") {
        for entry in entries.flatten() {
            if let Ok(pid) = entry.file_name().to_string_lossy().parse::<u32>() {
                if let Ok(status) = fs::read_to_string(entry.path().join("status")) {
                    let parent = status
                        .lines()
                        .find_map(|l| l.strip_prefix("PPid:"))
                        .and_then(|s| s.trim().parse::<u32>().ok());
                    if let Some(parent) = parent {
                        processes.push((pid, parent));
                    }
                }
            }
        }
    }
    let mut ids = BTreeSet::from([std::process::id()]);
    loop {
        let before = ids.len();
        for (pid, parent) in &processes {
            if ids.contains(parent) {
                ids.insert(*pid);
            }
        }
        if ids.len() == before {
            break;
        }
    }
    ids.into_iter().map(rss).sum()
}
