//! Durable process identities let a new dispatcher terminate only its dead owner's hosts.
use crate::{
    frozen_pool::{read, save},
    xml::Result,
};
use serde_json::{json, Value};
use std::{
    fs,
    path::{Path, PathBuf},
    time::{Duration, Instant},
};
pub struct Owners {
    path: PathBuf,
    document: Value,
}
fn token(pid: u32) -> Option<String> {
    let stat = fs::read_to_string(format!("/proc/{pid}/stat")).ok()?;
    let fields = stat
        .rsplit_once(") ")?
        .1
        .split_whitespace()
        .collect::<Vec<_>>();
    if fields.first() == Some(&"Z") {
        return None;
    }
    Some(fields.get(19)?.to_string()) // starttime is field 22; state is field 3.
}
impl Owners {
    pub fn start(output: &Path, resume: bool) -> Result<Self> {
        let path = output.join("owners.json");
        if resume && path.exists() {
            let old = read(&path)?;
            let root = old["dispatcher"]["pid"]
                .as_u64()
                .ok_or("Missing dispatcher pid")? as u32;
            if token(root).is_some_and(|t| old["dispatcher"]["start"] == t) {
                return Err("Previous dispatcher still owns this output".into());
            }
            for host in old["hosts"].as_array().ok_or("Missing owned hosts")? {
                let pid = host["pid"].as_u64().ok_or("Missing owned host pid")? as u32;
                if token(pid).is_some_and(|t| host["start"] == t) {
                    #[cfg(target_os = "linux")]
                    unsafe {
                        if libc::kill(pid as libc::pid_t, libc::SIGKILL) != 0 {
                            return Err(std::io::Error::last_os_error().into());
                        }
                    }
                    #[cfg(not(target_os = "linux"))]
                    return Err(
                        "Automatic dead-host recovery requires Linux process identity evidence"
                            .into(),
                    );
                    let deadline = Instant::now() + Duration::from_secs(5);
                    while token(pid).is_some_and(|t| host["start"] == t) {
                        if Instant::now() >= deadline {
                            return Err("Previous execution host did not terminate".into());
                        }
                        std::thread::sleep(Duration::from_millis(10));
                    }
                }
            }
        }
        let pid = std::process::id();
        let this = Self {
            path,
            document: json!({"dispatcher":{"pid":pid,"start":token(pid)},"hosts":[]}),
        };
        save(&this.path, &this.document)?;
        Ok(this)
    }
    pub fn register(&mut self, pid: u32) -> Result<()> {
        self.document["hosts"]
            .as_array_mut()
            .unwrap()
            .push(json!({"pid":pid,"start":token(pid)}));
        save(&self.path, &self.document)
    }
}
