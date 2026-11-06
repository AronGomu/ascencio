mod analysis;
mod application_identity;
mod bugs;
mod compare;
mod config;
mod execution;
mod host;
mod identity;
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
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    let command = args.first().map(String::as_str).unwrap_or("");
    let option = |key: &str| args.windows(2).find(|w| w[0] == key).map(|w| w[1].clone());
    let required = |key: &str| option(key).ok_or_else(|| format!("Missing {key}"));
    match command{
 "evaluate"=>runner::evaluate(config::read(Path::new(&required("--config")?))?,option("--resume").map(PathBuf::from)),
 "compare"=>compare::compare(Path::new(&required("--baseline")?),Path::new(&required("--candidate")?),Path::new(&required("--out")?)),
 "validate"=>{let file=required("--file")?;let root=required("--root")?;xml::read(Path::new(&file),&root)?;xml::validate(&root,&std::fs::read(file)?)?;Ok(0)},
 _=>Err("Usage: bot-evaluation evaluate --config evaluation.xml [--resume RUN] | compare --baseline RUN --candidate RUN --out DIRECTORY | validate --file FILE --root ROOT".into())}
}
