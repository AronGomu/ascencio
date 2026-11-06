//! Compositional XSD validation for immutable evidence timelines. The timeline
//! type has no context-dependent assertions/keys. Validate each distinct byte
//! content once, then validate its containing report with the same (empty)
//! timeline type. Reads always validate the complete persisted XML document.
use crate::{
    identity,
    xml::{self, Result},
};
use quick_xml::{events::Event, Reader};
use std::{cell::RefCell, collections::VecDeque};
thread_local! {static VALIDATED:RefCell<VecDeque<String>>=const {RefCell::new(VecDeque::new())};}
const PREFIX: &[u8] = br#"<timeline-fragment schema_version="1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">"#;
const SUFFIX: &[u8] = b"</timeline-fragment>";
pub fn prepare() -> Result<()> {
    validate_timeline(b"")
}
/// Validate the exact serialized bytes that will be persisted, avoiding a second
/// serialization of every previous game's timeline. The scanner recognizes only
/// the report/games/game/timeline path; other elements remain in the parent XSD.
pub fn report(bytes: &[u8]) -> Result<()> {
    let mut reader = Reader::from_reader(bytes);
    let mut path = Vec::new();
    let mut skeleton = Vec::new();
    let mut copied = 0;
    loop {
        match reader.read_event()? {
            Event::Start(start) => {
                if start.name().as_ref() == b"timeline"
                    && path == [b"player-report".as_slice(), b"games", b"game"]
                {
                    let content_start = reader.buffer_position() as usize;
                    let span = reader.read_to_end(start.name())?;
                    let content_end = span.end as usize;
                    timeline(&bytes[content_start..content_end])?;
                    skeleton.extend_from_slice(&bytes[copied..content_start]);
                    copied = content_end;
                } else {
                    path.push(start.name().as_ref().to_vec());
                }
            }
            Event::End(_) => {
                path.pop();
            }
            Event::Eof => break,
            _ => {}
        }
    }
    skeleton.extend_from_slice(&bytes[copied..]);
    xml::validate("player-report", &skeleton)
}
fn validate_timeline(bytes: &[u8]) -> Result<()> {
    let mut fragment = Vec::with_capacity(PREFIX.len() + bytes.len() + SUFFIX.len());
    fragment.extend_from_slice(PREFIX);
    fragment.extend_from_slice(bytes);
    fragment.extend_from_slice(SUFFIX);
    xml::validate("timeline-fragment", &fragment)
}
fn timeline(bytes: &[u8]) -> Result<()> {
    let hash = identity::sha(bytes);
    if VALIDATED.with(|cache| cache.borrow().contains(&hash)) {
        return Ok(());
    }
    validate_timeline(bytes)?;
    VALIDATED.with(|cache| {
        let mut cache = cache.borrow_mut();
        if cache.len() == 8 {
            cache.pop_front();
        }
        cache.push_back(hash);
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn compositional_validation_rechecks_mutation_and_parent_structure() {
        let manifest = json!({"bots":{"a":{"artifact_sha256":"a".repeat(64)},"b":{"artifact_sha256":"b".repeat(64)}}});
        let (_, mut reports) = crate::match_evidence::new_match("run", "match-000001", &manifest);
        reports[0]["games"]["game"][0]["timeline"] = json!({"entry":[{"sequence":1,"kind":"event","actor":null,"turn":0,"phase":"draw","event":"test <&>"}]});
        let bytes = xml::encode("player-report", &reports[0]).unwrap();
        xml::validate("player-report", &bytes).unwrap();
        report(&bytes).unwrap();
        report(&bytes).unwrap();
        let malformed = String::from_utf8(bytes.clone())
            .unwrap()
            .replace("<sequence>1</sequence>", "<sequence>0</sequence>");
        assert!(report(malformed.as_bytes()).is_err());
        assert!(xml::validate("player-report", malformed.as_bytes()).is_err());
        let malformed = String::from_utf8(bytes.clone())
            .unwrap()
            .replace("<timeline>", "<timeline unexpected=\"true\">");
        assert!(report(malformed.as_bytes()).is_err());
        let malformed = String::from_utf8(bytes.clone())
            .unwrap()
            .replace("<perspective>a</perspective>", "");
        assert!(report(malformed.as_bytes()).is_err());
        report(&bytes).unwrap();
    }
    #[test]
    fn failed_lane_never_publishes_match_commit_and_all_lanes_are_drained() {
        let root = std::env::temp_dir().join(format!("aro2-writer-{}", std::process::id()));
        let manifest = json!({"bots":{"a":{"artifact_sha256":"a".repeat(64)},"b":{"artifact_sha256":"b".repeat(64)}}});
        let (mut record, reports) =
            crate::match_evidence::new_match("run", "match-000001", &manifest);
        crate::match_evidence::save_match(&root, &record, &reports).unwrap();
        let base = root.join("matches/match-000001");
        let before = std::fs::read(base.join("match.xml")).unwrap();
        std::fs::create_dir(base.join("player-a.xml.tmp")).unwrap();
        record["games"]["game"][0]["skip_reason"] = json!("changed");
        assert!(crate::match_evidence::save_match(&root, &record, &reports).is_err());
        assert_eq!(std::fs::read(base.join("match.xml")).unwrap(), before);
        std::fs::remove_dir(base.join("player-a.xml.tmp")).unwrap();
        crate::match_evidence::save_match(&root, &record, &reports).unwrap();
        assert_ne!(std::fs::read(base.join("match.xml")).unwrap(), before);
        crate::evidence_writer::shutdown();
        std::fs::remove_dir_all(root).unwrap();
    }
}
