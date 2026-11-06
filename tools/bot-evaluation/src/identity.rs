use serde_json::Value;
use sha2::{Digest, Sha256};
pub fn sha(bytes: impl AsRef<[u8]>) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
/// Version 1 canonical tree: object keys sorted, scalar lexical values normalized,
/// arrays ordered. Timing, timestamps, filesystem paths and hash fields excluded.
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
pub fn digest(value: &Value) -> String {
    sha(serde_json::to_vec(&canonical(value, false)).unwrap())
}
pub fn evidence(value: &Value) -> String {
    sha(serde_json::to_vec(
        &serde_json::json!({"encoding_version":"1","evidence":canonical(value,true)}),
    )
    .unwrap())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
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
