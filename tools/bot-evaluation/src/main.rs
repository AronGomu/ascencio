mod analysis;
mod application_identity;
mod bugs;
#[cfg(target_os = "linux")]
mod campaign;
mod compare;
mod config;
mod evidence_validation;
mod evidence_writer;
mod execution;
mod host;
mod identity;
#[cfg(target_os = "linux")]
mod improvement;
#[cfg(not(target_os = "linux"))]
mod improvement {
    pub fn run(_: &std::path::Path, _: bool) -> crate::xml::Result<i32> {
        Err("Bot improvement currently requires Linux and bubblewrap".into())
    }
}
mod match_evidence;
mod metrics;
mod runner;
mod runtime_identity;
mod streaming_xml;
mod xml;
use std::path::{Path, PathBuf};
fn main() {
    match execute() {
        Ok(code) => std::process::exit(code),
        Err(e) => {
            eprintln!("bot-evaluation: {e}");
            std::process::exit(1)
        }
    }
}
fn execute() -> xml::Result<i32> {
    let command_start = std::time::Instant::now();
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    let command = args.first().map(String::as_str).unwrap_or("");
    let option = |key: &str| args.windows(2).find(|w| w[0] == key).map(|w| w[1].clone());
    let required = |key: &str| option(key).ok_or_else(|| format!("Missing {key}"));
    match command{
 #[cfg(target_os = "linux")]
 "campaign"=>campaign::run(Path::new(&required("--config")?), args.iter().any(|a| a == "--resume")),
 "improve"=>improvement::run(Path::new(&required("--config")?), args.iter().any(|a| a == "--resume")),
 "benchmark"=>{if option("--resume").is_some(){return Err("A benchmark never resumes an existing run".into());} runner::benchmark(config::read(Path::new(&required("--config")?))?, command_start)},
 "evaluate"=>runner::evaluate(config::read(Path::new(&required("--config")?))?,option("--resume").map(PathBuf::from)),
 "compare"=>compare::compare(Path::new(&required("--baseline")?),Path::new(&required("--candidate")?),Path::new(&required("--out")?)),
 "validate"=>{let file=required("--file")?;let root=required("--root")?;xml::read(Path::new(&file),&root)?;xml::validate(&root,&std::fs::read(file)?)?;Ok(0)},
 _=>Err("Usage: bot-evaluation benchmark --config evaluation.xml | evaluate --config evaluation.xml [--resume RUN] | compare --baseline RUN --candidate RUN --out DIRECTORY | validate --file FILE --root ROOT".into())}
}
