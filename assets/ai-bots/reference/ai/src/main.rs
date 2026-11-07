use ascencio_reference_bot::Bot;
use serde_json::{Value, json};
use std::io::{self, BufRead, Write};
fn main() {
    let mut bot = Bot::default();
    let mut out = io::BufWriter::new(io::stdout().lock());
    for line in io::stdin().lock().lines() {
        let parsed = line.map_err(|e| e.to_string()).and_then(|line| {
            if line.len() > 64 * 1024 * 1024 {
                return Err("Input exceeds 64 MiB".into());
            }
            serde_json::from_str::<Value>(&line).map_err(|e| e.to_string())
        });
        let start = std::time::Instant::now();
        let result = match parsed.as_ref() {
            Ok(request) => bot.request(request),
            Err(error) => Err(error.clone()),
        };
        let compute_ns = start.elapsed().as_nanos() as u64;
        let response = match result {
            Ok(value) => json!({"ok":value,"computeNs":compute_ns}),
            Err(error) => json!({"error":error}),
        };
        writeln!(out, "{response}").unwrap();
        out.flush().unwrap();
    }
}
