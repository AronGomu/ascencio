use serde_json::Value;
use sha2::{Digest, Sha256};
pub fn sha(bytes: impl AsRef<[u8]>) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
/// Version 1 canonical tree: object keys sorted, scalar lexical values normalized,
/// arrays ordered. Timing, timestamps, filesystem paths and hash fields excluded.
#[cfg(test)]
pub fn canonical(value: &Value, evidence: bool) -> Value {
    match value {
        Value::Object(o) => Value::Object(
            o.iter()
                .filter(|(_, v)| !v.as_array().is_some_and(|a| a.is_empty()))
                .filter(|(k, _)| {
                    !evidence
                        || (!k.ends_with("_sha256")
                            && !k.ends_with("_path")
                            && !matches!(
                                k.as_str(),
                                "evidence_sha256"
                                    | "bug_id"
                                    | "duration_ms"
                                    | "engine_time_ms"
                                    | "bot_time_ms"
                                    | "bridge_time_ms"
                                    | "captured_at"
                                    | "created_at"
                                    | "updated_at"
                                    | "path"
                            ))
                })
                .map(|(k, v)| (k.clone(), canonical(v, evidence)))
                .collect(),
        ),
        Value::Array(a) => Value::Array(a.iter().map(|v| canonical(v, evidence)).collect()),
        Value::Null => Value::Null,
        Value::String(_) => value.clone(),
        _ => Value::String(value.to_string()),
    }
}
use serde::{
    ser::{SerializeMap, SerializeSeq},
    Serialize, Serializer,
};
struct Canonical<'a>(&'a Value, bool);
fn excluded(key: &str) -> bool {
    key.ends_with("_sha256")
        || key.ends_with("_path")
        || matches!(
            key,
            "bug_id"
                | "duration_ms"
                | "engine_time_ms"
                | "bot_time_ms"
                | "bridge_time_ms"
                | "captured_at"
                | "created_at"
                | "updated_at"
                | "path"
        )
}
impl Serialize for Canonical<'_> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self.0 {
            Value::Object(o) => {
                let mut map = serializer.serialize_map(None)?;
                for (key, value) in o {
                    if value.as_array().is_some_and(|a| a.is_empty()) || (self.1 && excluded(key)) {
                        continue;
                    }
                    map.serialize_entry(key, &Canonical(value, self.1))?;
                }
                map.end()
            }
            Value::Array(a) => {
                let mut seq = serializer.serialize_seq(Some(a.len()))?;
                for value in a {
                    seq.serialize_element(&Canonical(value, self.1))?;
                }
                seq.end()
            }
            Value::Null => serializer.serialize_none(),
            Value::String(s) => serializer.serialize_str(s),
            v => serializer.serialize_str(&v.to_string()),
        }
    }
}
#[derive(Serialize)]
struct Evidence<T: Serialize> {
    encoding_version: &'static str,
    evidence: T,
}
pub fn digest(value: &Value) -> String {
    sha(serde_json::to_vec(&Canonical(value, false)).unwrap())
}
#[cfg(test)]
pub fn evidence(value: &Value) -> String {
    sha(serde_json::to_vec(&Evidence {
        encoding_version: "1",
        evidence: Canonical(value, true),
    })
    .unwrap())
}
pub fn game_evidence(
    game_id: &Value,
    configurations: [&Value; 2],
    failure_category: &Value,
    records: [&Value; 2],
) -> String {
    #[derive(Serialize)]
    struct Game<'a> {
        configurations: [Canonical<'a>; 2],
        failure_category: Canonical<'a>,
        game_id: Canonical<'a>,
        records: [Canonical<'a>; 2],
    }
    sha(serde_json::to_vec(&Evidence {
        encoding_version: "1",
        evidence: Game {
            configurations: configurations.map(|v| Canonical(v, true)),
            failure_category: Canonical(failure_category, true),
            game_id: Canonical(game_id, true),
            records: records.map(|v| Canonical(v, true)),
        },
    })
    .unwrap())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn borrowed_encoding_is_byte_compatible_with_version_one() {
        let value = json!({"array":[null,true,123,0.25,r#"<&\""#],"empty":[],"duration_ms":99,"configuration_sha256":"abc","nested":{"path":"x","entries":[{"code":"001"}]}});
        assert_eq!(
            digest(&value),
            sha(serde_json::to_vec(&canonical(&value, false)).unwrap())
        );
        assert_eq!(
            evidence(&value),
            sha(serde_json::to_vec(
                &json!({"encoding_version":"1","evidence":canonical(&value,true)})
            )
            .unwrap())
        );
        let configs = [json!("a"), json!("b")];
        let id = json!("g1");
        let failure = Value::Null;
        assert_eq!(
            game_evidence(&id, [&configs[0], &configs[1]], &failure, [&value, &value]),
            evidence(
                &json!({"game_id":id,"configurations":configs,"failure_category":failure,"records":[value,value]})
            )
        );
    }
    #[test]
    fn canonical_xml_roundtrip_preserves_order_and_null() {
        let value = json!({"timeline":{"entry":[{"sequence":1,"choices":{"choice":[{"card":{"controller":0,"contribution":2}}]},"constraints":{"mandatory_contributions":{"contribution":[{"contribution":1}]}},"selected_choice_ids":{"choice_id":[]},"reason":null}]}});
        let bytes = crate::xml::encode("test", &value).unwrap();
        let parsed = crate::xml::parse(std::str::from_utf8(&bytes).unwrap(), "test").unwrap();
        assert_eq!(canonical(&value, true), canonical(&parsed, true));
    }
    #[test]
    fn evidence_excludes_timings_not_decisions() {
        let a = json!({"choice_id":["one","two"],"duration_ms":1,"evidence_sha256":null});
        let mut b = a.clone();
        b["duration_ms"] = json!(999);
        assert_eq!(evidence(&a), evidence(&b));
        b["choice_id"] = json!(["two", "one"]);
        assert_ne!(evidence(&a), evidence(&b));
    }
}
