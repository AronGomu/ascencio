use crate::xml::Result;
use serde_json::Value;
use std::{
    io::{BufRead, BufReader, Read, Write},
    process::{Child, ChildStdin, Command, Stdio},
    sync::mpsc::{sync_channel, Receiver},
    time::Duration,
};
pub struct Host {
    child: Child,
    input: ChildStdin,
    receiver: Receiver<std::result::Result<Value, String>>,
}
impl Host {
    pub fn start() -> Result<Self> {
        let mut child = Command::new(std::env::var("ARO2_NODE").unwrap_or_else(|_| "node".into()))
            .args([
                "--experimental-vm-modules",
                "--disable-warning=ExperimentalWarning",
                "scripts/bot-evaluation/host.ts",
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()?;
        let input = child.stdin.take().unwrap();
        let output = child.stdout.take().unwrap();
        let (tx, receiver) = sync_channel(32);
        std::thread::spawn(move || {
            let mut reader = BufReader::new(output);
            loop {
                let mut line = String::new();
                match reader
                    .by_ref()
                    .take(64 * 1024 * 1024 + 1)
                    .read_line(&mut line)
                {
                    Ok(0) => {
                        let _ = tx.send(Err("Engine host exited".into()));
                        break;
                    }
                    Ok(_) => {
                        if line.len() > 64 * 1024 * 1024 {
                            let _ = tx.send(Err("Host frame exceeds limit".into()));
                            break;
                        }
                        if tx
                            .send(serde_json::from_str(&line).map_err(|e| e.to_string()))
                            .is_err()
                        {
                            break;
                        }
                    }
                    Err(e) => {
                        let _ = tx.send(Err(e.to_string()));
                        break;
                    }
                }
            }
        });
        Ok(Self {
            child,
            input,
            receiver,
        })
    }
    pub fn send(&mut self, v: &Value) -> Result<()> {
        serde_json::to_writer(&mut self.input, v)?;
        self.input.write_all(b"\n")?;
        self.input.flush()?;
        Ok(())
    }
    pub fn receive(&self, timeout: Duration) -> Result<Value> {
        self.receiver
            .recv_timeout(timeout)
            .map_err(|e| format!("host_timeout_or_exit: {e}"))?
            .map_err(Into::into)
    }
    pub fn kill(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
    pub fn pid(&self) -> u32 {
        self.child.id()
    }
}
impl Drop for Host {
    fn drop(&mut self) {
        self.kill();
    }
}
