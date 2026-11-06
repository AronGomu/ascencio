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
