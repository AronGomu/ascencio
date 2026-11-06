use super::storage;
use crate::xml::Result;
use std::os::unix::process::CommandExt;
use std::{
    fs::File,
    path::Path,
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};
pub fn execute(
    mut command: Command,
    root: &Path,
    log: &Path,
    timeout: u64,
    max_bytes: u64,
    stop: &Arc<AtomicBool>,
) -> Result<()> {
    let output = File::create(log)?;
    command
        .stdin(Stdio::null())
        .stdout(Stdio::from(output.try_clone()?))
        .stderr(Stdio::from(output))
        .process_group(0);
    let mut child = command.spawn()?;
    let start = Instant::now();
    let result = (|| loop {
        if stop.load(Ordering::SeqCst) || root.join("CANCEL").exists() {
            return Err("cancelled".into());
        }
        if start.elapsed().as_millis() >= timeout as u128 {
            return Err("process_timeout".into());
        }
        if storage::size(root)? > max_bytes {
            return Err("storage_budget".into());
        }
        if let Some(status) = child.try_wait()? {
            return if status.success() {
                Ok(())
            } else {
                Err(format!("process_failed: {status}").into())
            };
        }
        std::thread::sleep(Duration::from_millis(100));
    })();
    // Also reap descendants on success: agents must not leave writable background jobs.
    unsafe {
        libc::kill(-(child.id() as i32), libc::SIGKILL);
    }
    let _ = child.wait();
    result
}
pub fn agent(argv: &[String], workspace: &Path) -> Result<Command> {
    let mut cmd = Command::new("bwrap");
    cmd.args([
        "--die-with-parent",
        "--unshare-pid",
        "--ro-bind",
        "/",
        "/",
        "--dev",
        "/dev",
        "--proc",
        "/proc",
        "--tmpfs",
        "/tmp",
        "--bind",
    ])
    .arg(workspace)
    .arg(workspace)
    .arg("--ro-bind")
    .arg(workspace.join("request.json"))
    .arg(workspace.join("request.json"))
    .arg("--chdir")
    .arg(workspace)
    .arg("--")
    .args(argv);
    Ok(cmd)
}
pub fn agent_with_state(argv: &[String], workspace: &Path, state: &Path) -> Result<Command> {
    let mut cmd = Command::new("bwrap");
    cmd.args([
        "--die-with-parent",
        "--unshare-pid",
        "--ro-bind",
        "/",
        "/",
        "--dev",
        "/dev",
        "--proc",
        "/proc",
        "--tmpfs",
        "/tmp",
        "--bind",
    ])
    .arg(workspace)
    .arg(workspace)
    .arg("--bind")
    .arg(state)
    .arg(state)
    .arg("--ro-bind")
    .arg(workspace.join("request.json"))
    .arg(workspace.join("request.json"))
    .arg("--chdir")
    .arg(workspace)
    .arg("--")
    .args(argv);
    Ok(cmd)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn watchdog_and_cancellation_stop_process_groups() {
        let root = std::env::temp_dir().join(format!("loop-watchdog-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let mut cmd = Command::new("sh");
        cmd.args(["-c", "sleep 30 & wait"]);
        let start = Instant::now();
        let result = execute(
            cmd,
            &root,
            &root.join("timeout.log"),
            100,
            100000,
            &Arc::new(AtomicBool::new(false)),
        );
        assert!(result.unwrap_err().to_string().contains("timeout"));
        assert!(start.elapsed() < Duration::from_secs(3));
        let mut cmd = Command::new("sleep");
        cmd.arg("30");
        assert_eq!(
            execute(
                cmd,
                &root,
                &root.join("cancel.log"),
                10000,
                100000,
                &Arc::new(AtomicBool::new(true))
            )
            .unwrap_err()
            .to_string(),
            "cancelled"
        );
        std::fs::remove_dir_all(root).unwrap();
    }
}
#[cfg(test)]
mod isolation_tests {
    use super::*;
    #[test]
    fn coding_agent_can_only_write_proposal_and_cannot_rewrite_request() {
        let root = std::env::temp_dir().join(format!("loop-isolation-{}", std::process::id()));
        let workspace = root.join("proposal");
        std::fs::create_dir_all(&workspace).unwrap();
        std::fs::write(root.join("protected"), "original").unwrap();
        std::fs::write(workspace.join("request.json"), "request").unwrap();
        let command = agent(
            &[
                "sh".into(),
                "-c".into(),
                "echo changed > strategy.mjs; ! echo bad > ../protected; ! echo bad > request.json"
                    .into(),
            ],
            &workspace,
        )
        .unwrap();
        execute(
            command,
            &root,
            &root.join("agent.log"),
            3000,
            100000,
            &Arc::new(AtomicBool::new(false)),
        )
        .unwrap();
        assert_eq!(
            std::fs::read_to_string(root.join("protected")).unwrap(),
            "original"
        );
        assert_eq!(
            std::fs::read_to_string(workspace.join("request.json")).unwrap(),
            "request"
        );
        assert!(workspace.join("strategy.mjs").exists());
        std::fs::remove_dir_all(root).unwrap();
    }
}

/// A deck agent sees a filtered campaign tree. Only its own reports, package
/// sources and handoff/session directory are re-mounted after hiding the archive.
pub fn deck_agent(
    argv: &[String],
    workspace: &Path,
    state: &Path,
    campaign: &Path,
    permitted: &[std::path::PathBuf],
) -> Result<Command> {
    let campaign = campaign.canonicalize()?;
    let mut cmd = Command::new("bwrap");
    cmd.args([
        "--die-with-parent",
        "--unshare-pid",
        "--ro-bind",
        "/",
        "/",
        "--dev",
        "/dev",
        "--proc",
        "/proc",
        "--tmpfs",
        "/tmp",
        "--tmpfs",
    ])
    .arg(&campaign);
    for path in permitted {
        let path = path.canonicalize()?;
        if !path.starts_with(&campaign) || !std::fs::symlink_metadata(&path)?.is_file() {
            return Err("Invalid permitted evidence path".into());
        }
        cmd.arg("--ro-bind").arg(&path).arg(&path);
    }
    cmd.arg("--bind")
        .arg(workspace)
        .arg(workspace)
        .arg("--bind")
        .arg(state)
        .arg(state)
        .arg("--ro-bind")
        .arg(workspace.join("request.json"))
        .arg(workspace.join("request.json"))
        .arg("--chdir")
        .arg(workspace)
        .arg("--")
        .args(argv);
    Ok(cmd)
}
#[cfg(test)]
mod filtered_evidence_tests {
    use super::*;
    #[test]
    fn deck_agent_cannot_read_opposing_reports_or_sessions() {
        let root = std::env::temp_dir().join(format!("campaign-view-{}", std::process::id()));
        let workspace = root.join("proposal");
        let state = root.join("agents/a");
        for dir in [
            &workspace,
            &state,
            &root.join("agents/b"),
            &root.join("reports"),
        ] {
            std::fs::create_dir_all(dir).unwrap();
        }
        std::fs::write(workspace.join("request.json"), "request").unwrap();
        std::fs::write(root.join("reports/a.xml"), "permitted").unwrap();
        std::fs::write(root.join("reports/b.xml"), "private").unwrap();
        std::fs::write(root.join("agents/b/session.json"), "private conversation").unwrap();
        let script=format!("cat '{}/reports/a.xml'; test ! -e '{}/reports/b.xml'; test ! -e '{}/agents/b/session.json'; echo ok > result",root.display(),root.display(),root.display());
        let cmd = deck_agent(
            &["sh".into(), "-ec".into(), script],
            &workspace,
            &state,
            &root,
            &[root.join("reports/a.xml")],
        )
        .unwrap();
        execute(
            cmd,
            &root,
            &root.join("agent.log"),
            3000,
            100000,
            &Arc::new(AtomicBool::new(false)),
        )
        .unwrap();
        assert_eq!(
            std::fs::read_to_string(workspace.join("result")).unwrap(),
            "ok\n"
        );
        std::fs::remove_dir_all(root).unwrap();
    }
}
