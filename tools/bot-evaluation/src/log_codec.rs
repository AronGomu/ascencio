//! Typed text log records: one logical record per line, exact values for replay.
use crate::xml::Result;
use serde_json::{json, Value};
fn pointer(s: &str) -> String {
    s.replace('~', "~0").replace('/', "~1").replace('=', "~2")
}
pub fn record(tag: &str, value: &Value) -> String {
    fn visit(value: &Value, path: &str, fields: &mut Vec<String>) {
        let token = match value {
            Value::Null => "z".into(),
            Value::Bool(v) => format!("b:{}", u8::from(*v)),
            Value::Number(v) => format!("n:{v}"),
            Value::String(v) => format!("s:{}", serde_json::to_string(v).unwrap()),
            Value::Array(_) => "a".into(),
            Value::Object(_) => "o".into(),
        };
        fields.push(format!("{path}={token}"));
        match value {
            Value::Array(a) => {
                for (i, v) in a.iter().enumerate() {
                    visit(v, &format!("{path}/{i}"), fields);
                }
            }
            Value::Object(o) => {
                for (k, v) in o {
                    visit(v, &format!("{path}/{}", pointer(k)), fields);
                }
            }
            _ => {}
        }
    }
    let mut fields = vec![];
    visit(value, "", &mut fields);
    format!("{tag}\t{}\n", fields.join("\t"))
}
/// Store repeated field paths once per file; actor loss views remain expanded.
pub fn compact(text: &str) -> Result<String> {
    let mut lines = text.lines();
    let header = lines.next().ok_or("Missing log header")?;
    let lines = lines.collect::<Vec<_>>();
    let mut paths = vec![];
    let mut ids = std::collections::BTreeMap::new();
    for line in &lines {
        for field in line.split('\t').skip(1) {
            let (path, _) = field.split_once('=').ok_or("Malformed log field")?;
            if !ids.contains_key(path) {
                ids.insert(path.to_owned(), paths.len());
                paths.push(path.to_owned());
            }
        }
    }
    let mut out = format!("{header}\n{}", record("FIELDS", &json!(paths)));
    for line in lines {
        let mut fields = line.split('\t');
        out.push_str(fields.next().ok_or("Missing record")?);
        for field in fields {
            let (path, value) = field.split_once('=').ok_or("Malformed log field")?;
            out.push_str(&format!("\t#{}={value}", ids[path]));
        }
        out.push('\n');
    }
    Ok(out)
}
pub fn parse(text: &str, header: &str) -> Result<Vec<(String, Value)>> {
    if !text.ends_with('\n') {
        return Err("Truncated text log".into());
    }
    let mut lines = text.lines();
    if lines.next() != Some(header) {
        return Err("Invalid text log header".into());
    }
    let mut result = vec![];
    let mut dictionary: Option<Vec<String>> = None;
    for raw in lines {
        let expanded;
        let line = if let Some(paths) = dictionary.as_ref() {
            let mut parts = raw.split('\t');
            let mut fields = vec![parts.next().ok_or("Missing log tag")?.to_owned()];
            for part in parts {
                let (alias, value) = part.split_once('=').ok_or("Invalid log alias")?;
                let number = alias.strip_prefix('#').ok_or("Missing log alias")?;
                let index: usize = number.parse()?;
                if index.to_string() != number {
                    return Err("Invalid log alias index".into());
                }
                fields.push(format!(
                    "{}={value}",
                    paths.get(index).ok_or("Unknown log alias")?
                ));
            }
            expanded = fields.join("\t");
            expanded.as_str()
        } else {
            raw
        };
        let mut fields = line.split('\t');
        let tag = fields.next().ok_or("Missing log tag")?;
        if tag.is_empty() || !tag.bytes().all(|b| b.is_ascii_uppercase() || b == b'_') {
            return Err("Invalid log tag".into());
        }
        let mut value = Value::Null;
        let mut seen = std::collections::BTreeSet::new();
        for field in fields {
            let (path, token) = field.split_once('=').ok_or("Malformed log field")?;
            if !path.is_empty() && !path.starts_with('/') {
                return Err("Invalid log pointer".into());
            }
            if !seen.insert(path.to_owned()) {
                return Err("Duplicate log field".into());
            }
            let decoded = match token {
                "z" => Value::Null,
                "o" => json!({}),
                "a" => json!([]),
                "b:0" => json!(false),
                "b:1" => json!(true),
                s if s.starts_with("s:") => {
                    let v: Value = serde_json::from_str(&s[2..])?;
                    if !v.is_string() {
                        return Err("Invalid log string".into());
                    }
                    v
                }
                s if s.starts_with("n:") => {
                    let v: Value = serde_json::from_str(&s[2..])?;
                    if !v.is_number() {
                        return Err("Invalid log number".into());
                    }
                    v
                }
                _ => return Err("Invalid log type".into()),
            };
            if path.is_empty() {
                if seen.len() != 1 {
                    return Err("Log root order".into());
                }
                value = decoded;
                continue;
            }
            let (parent, key) = path.rsplit_once('/').ok_or("Invalid log pointer")?;
            let parent = parent.replace("~2", "=");
            let node = value.pointer_mut(&parent).ok_or("Missing log parent")?;
            let key = key.replace("~2", "=").replace("~1", "/").replace("~0", "~");
            if let Some(a) = node.as_array_mut() {
                let n: usize = key.parse()?;
                if key != n.to_string() || n != a.len() {
                    return Err("Invalid array order".into());
                }
                a.push(decoded);
            } else {
                node.as_object_mut()
                    .ok_or("Invalid log container")?
                    .insert(key, decoded);
            }
        }
        if !seen.contains("") {
            return Err("Missing log root".into());
        }
        if tag == "FIELDS" {
            if dictionary.is_some() || !result.is_empty() {
                return Err("Invalid dictionary position".into());
            }
            let paths = value
                .as_array()
                .ok_or("Invalid field dictionary")?
                .iter()
                .map(|v| {
                    v.as_str()
                        .map(str::to_owned)
                        .ok_or("Invalid dictionary path")
                })
                .collect::<std::result::Result<Vec<_>, _>>()?;
            if paths
                .iter()
                .collect::<std::collections::BTreeSet<_>>()
                .len()
                != paths.len()
            {
                return Err("Duplicate dictionary path".into());
            }
            dictionary = Some(paths);
        } else {
            result.push((tag.into(), value));
        }
    }
    Ok(result)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn exact_roundtrip_and_truncation() {
        let value = json!({"text":"tabs\tlines\n= and / ~ café", "array":[null,{},[],true,1.5],"a/b":{"~":0},"key=with=equals":{"nested=key":"value"}});
        let log = format!("HEADER\n{}", record("EVENT", &value));
        assert_eq!(parse(&log, "HEADER").unwrap()[0].1, value);
        assert_eq!(
            parse(&compact(&log).unwrap(), "HEADER").unwrap()[0].1,
            value
        );
        assert!(parse(log.trim_end(), "HEADER").is_err());
    }
    #[test]
    fn rejects_ambiguous_or_incomplete_records() {
        for body in [
            "EVENT\t=o\t/x=n:1\t/x=n:2\n",
            "EVENT\t=a\t/01=z\n",
            "EVENT\t=o\t/absent/child=z\n",
            "EVENT\t=o\t/x=s:42\n",
            "EVENT\t=o\t/x=n:true\n",
            "EVENT\t/x=z\n",
            "event\t=z\n",
        ] {
            assert!(
                parse(&format!("HEADER\n{body}"), "HEADER").is_err(),
                "{body}"
            );
        }
    }
}
