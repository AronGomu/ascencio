use quick_xml::{
    events::{BytesDecl, BytesEnd, BytesStart, BytesText, Event},
    Writer,
};
use serde_json::{Map, Value};
use std::{fs, io::Write, path::Path};
pub type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;
fn collection_item(parent: &str, name: &str) -> bool {
    matches!(
        name,
        "game"
            | "entry"
            | "choice"
            | "choice_id"
            | "change"
            | "exchange"
            | "metric"
            | "metric_reference"
            | "reference"
            | "limitation"
            | "occurrence"
            | "criterion"
            | "dependency"
            | "sample"
            | "card_decision"
            | "investigation"
            | "recommendation"
            | "note"
            | "factor"
            | "record"
            | "item"
    ) || (name == "card" && matches!(parent, "main" | "extra" | "side" | "own_opening_hand"))
        || (name == "contribution" && parent == "mandatory_contributions")
        || (name == "game_id"
            && matches!(
                parent,
                "completed_game_ids" | "incomplete_match_ids" | "observed_game_ids"
            ))
        || (name == "bug_id"
            && matches!(
                parent,
                "bug_ids"
                    | "bugs"
                    | "bug_references"
                    | "new_bug_ids"
                    | "previously_observed_bugs_not_seen"
                    | "recurring_failure_signatures"
                    | "new_bug_references"
                    | "recurring_failure_references"
            ))
        || (name == "match_id" && parent == "incomplete_match_ids")
        || (name == "match" && parent == "matches")
        || (name == "execution" && parent == "affected_executions")
        || (name == "failure" && parent == "failures_by_category")
        || (name == "observation" && parent == "observations")
}
pub fn read(path: &Path, root: &str) -> Result<Value> {
    let bytes = fs::read_to_string(path)?;
    let value = parse(&bytes, root)?;
    validate(root, bytes.as_bytes())?;
    semantics(root, &value)?;
    Ok(value)
}
pub fn parse(source: &str, root: &str) -> Result<Value> {
    if source.len() > 128 * 1024 * 1024 {
        return Err("XML document limit exceeded".into());
    }
    let lower = source.to_ascii_lowercase();
    if [
        "<!doctype",
        "<!entity",
        "schemalocation",
        "xinclude",
        "xml-stylesheet",
    ]
    .iter()
    .any(|p| lower.contains(p))
    {
        return Err("External XML features forbidden".into());
    }
    let document = roxmltree::Document::parse(source)?;
    let element = document.root_element();
    if element.tag_name().name() != root || element.attribute("schema_version") != Some("1") {
        return Err("Invalid document root/version".into());
    }
    fn node(n: roxmltree::Node, depth: usize) -> Result<Value> {
        if depth > 64 || n.tag_name().namespace().is_some() {
            return Err("XML depth/namespace violation".into());
        }
        if n.attributes().any(|a| {
            !([
                "schema_version",
                "nil",
                "path",
                "game_id",
                "decision_id",
                "classification",
                "manifest_path",
            ]
            .contains(&a.name()))
        }) {
            return Err("Unexpected XML attribute".into());
        }
        let children: Vec<_> = n.children().filter(|c| c.is_element()).collect();
        if n.attribute(("http://www.w3.org/2001/XMLSchema-instance", "nil")) == Some("true") {
            if !children.is_empty() || n.text().is_some_and(|s| !s.trim().is_empty()) {
                return Err("Nonempty nil".into());
            }
            return Ok(Value::Null);
        }
        let attributes = n
            .attributes()
            .filter(|a| !["schema_version", "nil"].contains(&a.name()))
            .map(|a| (a.name().to_owned(), Value::String(a.value().to_owned())))
            .collect::<Map<_, _>>();
        if children.is_empty() && attributes.is_empty() {
            return Ok(match n.text() {
                Some(s) => Value::String(s.to_owned()),
                None => Value::Object(Map::new()),
            });
        }
        let mut map = attributes;
        for child in children {
            let key = child.tag_name().name().to_owned();
            let v = node(child, depth + 1)?;
            if collection_item(n.tag_name().name(), &key) {
                map.entry(key)
                    .or_insert_with(|| Value::Array(vec![]))
                    .as_array_mut()
                    .unwrap()
                    .push(v);
            } else if map.insert(key, v).is_some() {
                return Err("Duplicate scalar element".into());
            }
        }
        Ok(Value::Object(map))
    }
    node(element, 0)
}
fn emit(writer: &mut Writer<Vec<u8>>, name: &str, value: &Value) -> Result<()> {
    if !name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || "_-".contains(c))
    {
        return Err("Invalid XML field".into());
    }
    if let Value::Array(values) = value {
        for v in values {
            emit(writer, name, v)?
        }
        return Ok(());
    }
    let is_attribute = |key: &str| {
        (name == "reference" && ["path", "game_id", "decision_id", "classification"].contains(&key))
            || (["baseline", "candidate"].contains(&name) && key == "manifest_path")
    };
    let mut start = BytesStart::new(name);
    if let Value::Object(map) = value {
        for (key, v) in map {
            if is_attribute(key) {
                start.push_attribute((key.as_str(), text(v)?));
            }
        }
    }
    if value.is_null() {
        start.push_attribute(("xsi:nil", "true"));
        writer.write_event(Event::Empty(start))?;
        return Ok(());
    }
    writer.write_event(Event::Start(start))?;
    if let Value::Object(map) = value {
        for (k, v) in map {
            if is_attribute(k) {
                continue;
            }
            emit(writer, k, v)?
        }
    } else {
        let text = match value {
            Value::String(s) => s.clone(),
            _ => value.to_string(),
        };
        if text
            .chars()
            .any(|c| c < ' ' && !['\t', '\n', '\r'].contains(&c))
        {
            return Err("Forbidden XML control character".into());
        }
        writer.write_event(Event::Text(BytesText::new(&text)))?;
    }
    writer.write_event(Event::End(BytesEnd::new(name)))?;
    Ok(())
}
pub fn fragment(name: &str, value: &Value) -> Result<Vec<u8>> {
    let mut writer = Writer::new(Vec::new());
    emit(&mut writer, name, value)?;
    Ok(writer.into_inner())
}
pub fn encode(root: &str, value: &Value) -> Result<Vec<u8>> {
    let mut w = Writer::new(Vec::new());
    w.write_event(Event::Decl(BytesDecl::new("1.0", Some("UTF-8"), None)))?;
    let mut start = BytesStart::new(root);
    start.push_attribute(("schema_version", "1"));
    start.push_attribute(("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance"));
    w.write_event(Event::Start(start))?;
    for (k, v) in value.as_object().ok_or("Expected XML object")? {
        emit(&mut w, k, v)?
    }
    w.write_event(Event::End(BytesEnd::new(root)))?;
    Ok(w.into_inner())
}
thread_local! {
 static SCHEMAS: std::cell::RefCell<std::collections::HashMap<String,libxml::schemas::SchemaValidationContext>> = std::cell::RefCell::new(std::collections::HashMap::new());
}
pub fn validate(root: &str, bytes: &[u8]) -> Result<()> {
    if ![
        "evaluation",
        "manifest",
        "progress",
        "match",
        "player-report",
        "summary",
        "evaluation-report",
        "comparison",
        "comparison-report",
        "bug-ticket",
        "diagnostics",
        "starting-orders",
        "timeline-fragment",
    ]
    .contains(&root)
    {
        return Err("Unknown schema root".into());
    }
    let document = libxml::parser::Parser::default()
        .parse_string_with_options(
            bytes,
            libxml::parser::ParserOptions {
                no_net: true,
                recover: false,
                no_def_dtd: true,
                ..Default::default()
            },
        )
        .map_err(|e| format!("XML parse: {e:?}"))?;
    SCHEMAS.with(|cache| {
        let mut cache = cache.borrow_mut();
        if !cache.contains_key(root) {
            #[cfg(not(test))]
            let schema_directory = std::path::PathBuf::from("schemas/bot-evaluation/v1");
            #[cfg(test)]
            let schema_directory =
                Path::new(env!("CARGO_MANIFEST_DIR")).join("../../schemas/bot-evaluation/v1");
            let schema = fs::read_to_string(schema_directory.join(format!("{root}.xsd")))?;
            if schema.contains("schemaLocation")
                || schema.contains("<!DOCTYPE")
                || schema.contains("<!ENTITY")
            {
                return Err("External schema resolution forbidden".into());
            }
            let mut parser = libxml::schemas::SchemaParserContext::from_buffer(schema.as_bytes());
            let context = libxml::schemas::SchemaValidationContext::from_parser(&mut parser)
                .map_err(|errors| format!("Invalid bundled schema: {errors:?}"))?;
            cache.insert(root.to_owned(), context);
        }
        cache
            .get_mut(root)
            .unwrap()
            .validate_document(&document)
            .map_err(|errors| format!("Schema validation failed: {errors:?}").into())
    })
}

thread_local! {static WRITE_MS:std::cell::Cell<f64>=const {std::cell::Cell::new(0.0)};}
thread_local! {static COSTS:std::cell::Cell<[f64;3]>=const {std::cell::Cell::new([0.0;3])};}
pub fn costs() -> [f64; 3] {
    COSTS.with(|v| v.get())
}
fn cost(index: usize, start: std::time::Instant) {
    COSTS.with(|v| {
        let mut c = v.get();
        c[index] += start.elapsed().as_secs_f64() * 1000.0;
        v.set(c);
    });
}
pub fn write_time_ms() -> f64 {
    WRITE_MS.with(|v| v.get())
}
pub struct WriteTimer(std::time::Instant);
impl WriteTimer {
    pub fn start() -> Self {
        Self(std::time::Instant::now())
    }
}
impl Drop for WriteTimer {
    fn drop(&mut self) {
        WRITE_MS.with(|v| v.set(v.get() + self.0.elapsed().as_secs_f64() * 1000.0));
    }
}
pub fn write(path: &Path, root: &str, value: &Value) -> Result<()> {
    let _timer = WriteTimer::start();
    let start = std::time::Instant::now();
    semantics(root, value)?;
    let bytes = encode(root, value)?;
    cost(0, start);
    let start = std::time::Instant::now();
    if root == "player-report" {
        crate::evidence_validation::report(&bytes)?;
    } else {
        validate(root, &bytes)?;
    }
    cost(1, start);
    let start = std::time::Instant::now();
    fs::create_dir_all(path.parent().ok_or("No parent")?)?;
    let tmp = path.with_extension("xml.tmp");
    let mut file = fs::File::create(&tmp)?;
    file.write_all(&bytes)?;
    file.sync_all()?;
    fs::rename(tmp, path)?;
    #[cfg(unix)]
    fs::File::open(path.parent().unwrap())?.sync_all()?;
    cost(2, start);
    Ok(())
}
/// One durable match commit. Evidence files are flushed concurrently, then
/// renamed in order with match.xml last, followed by one directory fsync.
/// This is bounded filesystem concurrency, never parallel game execution.
pub fn write_match(files: &[(std::path::PathBuf, &str, &Value)]) -> Result<()> {
    let _timer = WriteTimer::start();
    let parent = files
        .first()
        .and_then(|f| f.0.parent())
        .ok_or("Empty match write")?;
    let mut prepared = Vec::with_capacity(files.len());
    for (path, root, value) in files {
        if path.parent() != Some(parent) {
            return Err("Match files must share one directory".into());
        }
        let start = std::time::Instant::now();
        semantics(root, value)?;
        let bytes = encode(root, value)?;
        cost(0, start);
        prepared.push((path.with_extension("xml.tmp"), root.to_string(), bytes));
    }
    fs::create_dir_all(parent)?;
    let lane_costs = crate::evidence_writer::flush(prepared)?;
    COSTS.with(|v| {
        let mut c = v.get();
        c[1] += lane_costs[0];
        c[2] += lane_costs[1];
        v.set(c);
    });
    let start = std::time::Instant::now();
    for (path, _, _) in files {
        fs::rename(path.with_extension("xml.tmp"), path)?;
    }
    #[cfg(unix)]
    fs::File::open(parent)?.sync_all()?;
    cost(2, start);
    Ok(())
}
pub fn text(v: &Value) -> Result<&str> {
    v.as_str().ok_or_else(|| "Expected string".into())
}
pub fn number(v: &Value) -> Result<f64> {
    let n = if let Some(n) = v.as_f64() {
        n
    } else {
        text(v)?.parse()?
    };
    if !n.is_finite() {
        return Err("Expected finite number".into());
    }
    Ok(n)
}
pub fn integer(v: &Value) -> Result<u64> {
    let n = number(v)?;
    if n < 0.0 || n.fract() != 0.0 || !n.is_finite() {
        return Err("Expected nonnegative integer".into());
    }
    Ok(n as u64)
}
pub fn items<'a>(v: &'a Value, key: &str) -> Vec<&'a Value> {
    match &v[key] {
        Value::Array(a) => a.iter().collect(),
        Value::Null => vec![],
        x => vec![x],
    }
}

pub fn semantics(root: &str, value: &Value) -> Result<()> {
    let allowed = |v: &Value, values: &[&str]| -> Result<()> {
        if v.as_str().is_some_and(|s| values.contains(&s)) {
            Ok(())
        } else {
            Err("Invalid status/outcome enum".into())
        }
    };
    match root {
        "progress" | "summary" => allowed(
            &value["status"],
            &["running", "completed", "interrupted", "failed"],
        )?,
        "match" => {
            allowed(&value["status"], &["completed", "incomplete"])?;
            let games = items(&value["games"], "game");
            if games.len() != 4 {
                return Err("Match must contain exactly four scheduled games".into());
            }
            for (i, g) in games.iter().enumerate() {
                if integer(&g["number"])? != i as u64 + 1
                    || g["stage"] != if i < 2 { "pre_side" } else { "post_side" }
                    || g["starter"] != if i % 2 == 0 { "a" } else { "b" }
                {
                    return Err("Invalid four-game schedule".into());
                }
                allowed(&g["status"], &["completed", "failed", "skipped"])?;
                if g["status"] == "completed" {
                    let draw = g["draw"] == true || g["draw"] == "true";
                    if draw != g["winner"].is_null() {
                        return Err("Inconsistent completed game outcome".into());
                    }
                    if !g["winner"].is_null() {
                        allowed(&g["winner"], &["a", "b"])?
                    }
                    if g["evidence_sha256"].as_str().is_none_or(|h| h.len() != 64) {
                        return Err("Missing game hash".into());
                    }
                } else if !g["winner"].is_null() || !g["draw"].is_null() {
                    return Err("Infrastructure failure cannot be a competitive outcome".into());
                }
                if g["status"] == "skipped"
                    && (!g["evidence_sha256"].is_null() || g["skip_reason"].as_str().is_none())
                {
                    return Err("Invalid skipped game".into());
                }
                if g["status"] == "failed"
                    && (g["bug_id"].is_null()
                        || g["failure_category"].is_null()
                        || g["evidence_sha256"].is_null())
                {
                    return Err("Failed game lacks bug/evidence".into());
                }
            }
            let wins = ["a", "b"].map(|actor| {
                games
                    .iter()
                    .filter(|g| g["status"] == "completed" && g["winner"] == actor)
                    .count() as u64
            });
            let draws = games
                .iter()
                .filter(|g| {
                    g["status"] == "completed" && (g["draw"] == true || g["draw"] == "true")
                })
                .count() as u64;
            if integer(&value["result"]["a_wins"])? != wins[0]
                || integer(&value["result"]["b_wins"])? != wins[1]
                || integer(&value["result"]["draws"])? != draws
            {
                return Err("Match score disagrees with authoritative game records".into());
            }
            if value["status"] == "completed"
                && value["result"]["outcome"]
                    != if wins[0] > wins[1] {
                        "a"
                    } else if wins[1] > wins[0] {
                        "b"
                    } else {
                        "tie"
                    }
            {
                return Err("Incorrect match outcome".into());
            }
            if value["status"] == "completed" && games.iter().any(|g| g["status"] != "completed") {
                return Err("Completed match contains incomplete game".into());
            }
            if value["status"] == "incomplete" && !value["result"]["outcome"].is_null() {
                return Err("Incomplete match has competitive result".into());
            }
        }
        "player-report" => {
            allowed(&value["perspective"], &["a", "b"])?;
            let games = items(&value["games"], "game");
            if games.len() != 4 {
                return Err("Perspective report must include four games".into());
            }
            for g in games {
                allowed(&g["status"], &["completed", "failed", "skipped"])?;
                if g["status"] == "skipped" {
                    if g["skip_reason"].as_str().is_none()
                        || ["initial", "timeline", "result", "configuration_sha256"]
                            .iter()
                            .any(|k| g.get(*k).is_some())
                    {
                        return Err(
                            "Skipped perspective must contain only identity and skip reason".into(),
                        );
                    }
                } else {
                    if !g["timeline"].is_object() || g["configuration_sha256"].as_str().is_none() {
                        return Err(
                            "Executed perspective lacks timeline/configuration identity".into()
                        );
                    }
                    if g["status"] == "completed"
                        && (!g["initial"].is_object()
                            || g["result"]["engine_reason"].as_str().is_none()
                            || g["result"]["turns"].is_null()
                            || !g["result"]["bug_id"].is_null())
                    {
                        return Err(
                            "Completed perspective lacks initial/result evidence or carries a bug"
                                .into(),
                        );
                    }
                    if g["status"] == "failed" && g["result"]["bug_id"].as_str().is_none() {
                        return Err("Failed perspective lacks bug reference".into());
                    }
                    let mut sequence = 0;
                    for entry in items(&g["timeline"], "entry") {
                        let next = integer(&entry["sequence"])?;
                        if next <= sequence {
                            return Err("Timeline sequence must increase".into());
                        }
                        sequence = next;
                        match entry["kind"].as_str() {
                            Some("decision")
                                if [
                                    "decision_id",
                                    "prompt",
                                    "selected_choice_ids",
                                    "reason",
                                    "duration_ms",
                                ]
                                .iter()
                                .all(|k| entry.get(*k).is_some()) =>
                            {
                                ()
                            }
                            Some("event")
                                if ["event", "changes", "details"]
                                    .iter()
                                    .all(|k| entry.get(*k).is_some()) =>
                            {
                                ()
                            }
                            _ => {
                                return Err(
                                    "Timeline entry lacks its discriminated evidence fields".into(),
                                )
                            }
                        }
                    }
                    allowed(
                        &g["result"]["outcome"],
                        if g["status"] == "completed" {
                            &["win", "loss", "draw"]
                        } else {
                            &["failed"]
                        },
                    )?;
                }
            }
        }
        _ => (),
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn refuses_external_xml_features() {
        for source in ["<!DOCTYPE test SYSTEM 'file:///etc/passwd'><test schema_version='1'/>","<test schema_version='1' xmlns:xi='http://www.w3.org/2001/XInclude'><xi:include href='file:///etc/passwd'/></test>"]{assert!(parse(source,"test").is_err());}
    }
    #[test]
    fn escaping_roundtrip() {
        let v = serde_json::json!({"explanation":"<&\"' hello"});
        let bytes = encode("test", &v).unwrap();
        assert_eq!(
            parse(std::str::from_utf8(&bytes).unwrap(), "test").unwrap(),
            v
        );
    }
    #[test]
    fn rejects_competitive_infrastructure_failure() {
        let v = serde_json::json!({"status":"incomplete","games":{"game":[{"number":1,"stage":"pre_side","starter":"a","status":"failed","winner":"a","draw":false},{},{},{}]},"result":{"outcome":null}});
        assert!(semantics("match", &v).is_err());
    }
}
