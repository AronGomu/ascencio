//! Three persistent, bounded XML/IO lanes for one match commit. They never own
//! engines or schedule games. Each lane retains its own compiled XSD context.
use crate::xml::{self, Result};
use std::{cell::RefCell, fs, io::Write, path::PathBuf, sync::mpsc, thread, time::Instant};
struct Job {
    path: PathBuf,
    root: String,
    bytes: Vec<u8>,
}
struct Lane {
    input: Option<mpsc::SyncSender<Job>>,
    output: mpsc::Receiver<std::result::Result<[f64; 2], String>>,
    thread: Option<thread::JoinHandle<()>>,
}
impl Lane {
    fn new() -> Self {
        let (input, jobs) = mpsc::sync_channel::<Job>(1);
        let (results, output) = mpsc::sync_channel(1);
        let thread = thread::spawn(move || {
            let mut timeline_prepared = false;
            while let Ok(job) = jobs.recv() {
                let result = (|| -> Result<[f64; 2]> {
                    let start = Instant::now();
                    if job.root == "player-report" {
                        if !timeline_prepared {
                            crate::evidence_validation::prepare()?;
                            timeline_prepared = true;
                        }
                        crate::evidence_validation::report(&job.bytes)?;
                    } else {
                        xml::validate(&job.root, &job.bytes)?;
                    }
                    let validation = start.elapsed().as_secs_f64() * 1000.0;
                    let start = Instant::now();
                    let mut file = fs::File::create(job.path)?;
                    file.write_all(&job.bytes)?;
                    file.sync_all()?;
                    Ok([validation, start.elapsed().as_secs_f64() * 1000.0])
                })()
                .map_err(|e| e.to_string());
                if results.send(result).is_err() {
                    break;
                }
            }
        });
        Self {
            input: Some(input),
            output,
            thread: Some(thread),
        }
    }
}
impl Drop for Lane {
    fn drop(&mut self) {
        self.input.take();
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}
thread_local! { static LANES:RefCell<Option<[Lane;3]>>=const {RefCell::new(None)}; }
/// All writes must finish before the caller publishes match.xml as commit marker.
pub fn flush(files: Vec<(PathBuf, String, Vec<u8>)>) -> Result<[f64; 2]> {
    if files.len() != 3 {
        return Err("Expected exactly two perspectives and one match".into());
    }
    LANES.with(|pool| {
        let mut pool = pool.borrow_mut();
        let lanes = pool.get_or_insert_with(|| std::array::from_fn(|_| Lane::new()));
        for (lane, (path, root, bytes)) in lanes.iter().zip(files) {
            lane.input
                .as_ref()
                .unwrap()
                .send(Job { path, root, bytes })?;
        }
        let mut costs = [0.0; 2];
        let mut error = None;
        // Drain every lane even on error: no write may outlive its match commit.
        for lane in lanes {
            match lane.output.recv() {
                Ok(Ok(c)) => {
                    costs[0] += c[0];
                    costs[1] += c[1];
                }
                Ok(Err(e)) => {
                    error = Some(e);
                }
                Err(e) => {
                    error = Some(e.to_string());
                }
            }
        }
        if let Some(e) = error {
            return Err(e.into());
        }
        Ok(costs)
    })
}
pub fn shutdown() {
    LANES.with(|pool| {
        pool.borrow_mut().take();
    });
}
