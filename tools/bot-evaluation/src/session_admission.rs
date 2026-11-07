//! Session-control admission stays with the coordinator; workers never mutate shared state.
use crate::{
    host::Host,
    identity,
    xml::{self, Result},
};
use serde_json::{json, Value};
use std::{
    fs,
    path::{Path, PathBuf},
    time::Duration,
};
pub struct Admission {
    host: Host,
    session: PathBuf,
}
pub enum Reservation {
    Launch(u64),
    Wait,
    Stop,
}
impl Admission {
    pub fn start(binding: &Value) -> Result<Self> {
        let mut this = Self {
            host: Host::start_script("scripts/bot-improvement/runner-control-host.ts")?,
            session: PathBuf::from(binding["session"].as_str().ok_or("Missing session path")?),
        };
        this.call(json!({"type":"initialize","binding":binding}))?;
        Ok(this)
    }
    pub fn pid(&self) -> u32 {
        self.host.pid()
    }
    fn call(&mut self, command: Value) -> Result<Value> {
        self.host.send(&command)?;
        let response = self.host.receive(Duration::from_secs(120))?;
        if response["type"] != "control" {
            return Err(format!("Session control: {}", response["message"]).into());
        }
        Ok(response["plan"].clone())
    }
    pub fn cancelled(&mut self) -> Result<bool> {
        Ok(!self.call(json!({"type":"plan"}))?["stoppingReason"].is_null())
    }
    pub fn stop(&mut self) -> Result<()> {
        self.call(json!({"type":"stop"}))?;
        Ok(())
    }
    fn games(&self, base: &Path, record: &Value) -> Result<Value> {
        let id = record["match_id"].as_str().ok_or("Missing match id")?;
        let file = base.join("matches").join(id).join("match.xml");
        let relative = file
            .strip_prefix(&self.session)
            .map_err(|_| "Ledger evidence must be session-relative")?;
        let evidence =
            json!({"path":relative.to_string_lossy(),"sha256":identity::sha(fs::read(&file)?)});
        Ok(json!(xml::items(&record["games"],"game").iter().filter(|g|g["status"]=="completed").map(|g|json!({"number":g["number"].as_u64().or_else(||g["number"].as_str().and_then(|s|s.parse::<u64>().ok())).unwrap(),"evidence":evidence})).collect::<Vec<_>>()))
    }
    pub fn reserve(&mut self, id: &str, recovered: Option<(&Path, &Value)>) -> Result<Reservation> {
        let games = match recovered {
            Some((base, record)) => self.games(base, record)?,
            None => json!([]),
        };
        let plan = self.call(
            json!({"type":"reserve","match":id,"recover":recovered.is_some(),"games":games}),
        )?;
        if !plan["stoppingReason"].is_null() {
            return Ok(Reservation::Stop);
        }
        let reservation = &plan["reservation"];
        if reservation.is_null() {
            return Ok(Reservation::Wait);
        }
        if reservation["launch"] != true {
            return Err("Match already running/complete in ledger; resume its original evidence and reconcile dead owners before retrying".into());
        }
        Ok(Reservation::Launch(
            reservation["attempt"]["attempt"]
                .as_u64()
                .ok_or("Missing attempt number")?,
        ))
    }
    pub fn settle(
        &mut self,
        id: &str,
        attempt: u64,
        evidence: Option<(&Path, &Value)>,
        interrupted: bool,
    ) -> Result<()> {
        let games = match evidence {
            Some((base, record)) => self.games(base, record)?,
            None => json!([]),
        };
        let status = if interrupted {
            "interrupted"
        } else if evidence.is_some_and(|(_, r)| r["status"] == "completed") {
            "complete"
        } else {
            "failed"
        };
        self.call(
            json!({"type":"settle","match":id,"attempt":attempt,"status":status,"games":games}),
        )?;
        Ok(())
    }
}
