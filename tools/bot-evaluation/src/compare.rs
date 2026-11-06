use crate::{
    identity,
    xml::{self, Result},
};
use serde_json::json;
use std::{fs, path::Path};
pub fn compare(baseline: &Path, candidate: &Path, out: &Path) -> Result<i32> {
    let baseline = baseline.canonicalize()?;
    let candidate = candidate.canonicalize()?;
    if out.exists() {
        return Err("Comparison destination exists".into());
    }
    let bm = xml::read(&baseline.join("manifest.xml"), "manifest")?;
    let cm = xml::read(&candidate.join("manifest.xml"), "manifest")?;
    let bs = xml::read(&baseline.join("summary.xml"), "summary")?;
    let cs = xml::read(&candidate.join("summary.xml"), "summary")?;
    let same_deck = bm["deck"]["sha256"] == cm["deck"]["sha256"];
    let same_rules = bm["rules"] == cm["rules"];
    let same_content = bm["content"] == cm["content"] && bm["engine"] == cm["engine"];
    let same_bot = |actor: &str| {
        bm["bots"][actor]["artifact_sha256"] == cm["bots"][actor]["artifact_sha256"]
            && bm["bots"][actor]["config_sha256"] == cm["bots"][actor]["config_sha256"]
    };
    let changed = if same_bot("a") && !same_bot("b") {
        Some("b")
    } else if same_bot("b") && !same_bot("a") {
        Some("a")
    } else {
        None
    };
    let confounded = !(same_deck && same_rules && same_content && changed.is_some());
    let mut metrics = vec![];
    for actor in ["a", "b"] {
        for name in ["game_win_rate", "match_win_rate"] {
            let a = &bs["results"][actor][name];
            let b = &cs["results"][actor][name];
            let delta = xml::number(&b["value"])
                .ok()
                .zip(xml::number(&a["value"]).ok())
                .map(|(b, a)| 100.0 * (b - a));
            let uncertainty = if name == "game_win_rate" {
                "uncertainty"
            } else {
                "match_uncertainty"
            };
            let sa = xml::number(&bs["results"][actor][uncertainty]["standard_error"]).ok();
            let sb = xml::number(&cs["results"][actor][uncertainty]["standard_error"]).ok();
            let interval = {
                delta.zip(sa.zip(sb)).map(|(d, (a, b))| {
                    let e = 196.0 * (a * a + b * b).sqrt();
                    json!({"lower":d-e,"upper":d+e})
                })
            };
            metrics.push(json!({"name":format!("{actor}.{name}"),"baseline":a,"candidate":b,"delta_percentage_points":delta,"uncertainty":{"method":"independent_match_cluster_sandwich_normal_95_v1","confidence_level":0.95,"baseline_sample_size":bs["results"][actor][uncertainty]["sample_size"],"candidate_sample_size":cs["results"][actor][uncertainty]["sample_size"],"interval_percentage_points":interval}}));
        }
    }
    let references = [
        crate::analysis::decision_reference(&baseline)?,
        crate::analysis::decision_reference(&candidate)?,
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>();
    let mut reasons = std::collections::BTreeSet::new();
    for summary in [&bs, &cs] {
        for r in xml::items(&summary["decision_behavior"], "record") {
            reasons.insert(xml::text(&r["name"])?.to_owned());
        }
    }
    let count = |summary: &serde_json::Value, name: &str| -> u64 {
        xml::items(&summary["decision_behavior"], "record")
            .into_iter()
            .find(|r| r["name"] == name)
            .and_then(|r| xml::integer(&r["event_count"]).ok())
            .unwrap_or(0)
    };
    let behavior = json!({"records":{"record":reasons.iter().map(|name|{let a=count(&bs,name);let b=count(&cs,name);json!({"name":name,"baseline":a,"candidate":b,"delta_count":b as i64-a as i64})}).collect::<Vec<_>>()},"observations":{"observation":"Counts measure decision reasons across the saved batch; different game lengths and outcomes affect exposure. Inspect alternatives before attributing quality."},"evidence":{"reference":references}});
    let same_orders = bm["configuration"]["starting_orders"]["mode"] == "fixture"
        && cm["configuration"]["starting_orders"]["mode"] == "fixture"
        && bm["configuration"]["starting_orders"]["fixture"]
            == cm["configuration"]["starting_orders"]["fixture"]
        && bs["counts"]["matches_completed"] == cs["counts"]["matches_completed"]
        && bs["counts"]["matches_incomplete"] == "0"
        && cs["counts"]["matches_incomplete"] == "0";
    let performance = json!({"baseline":bs["performance"],"candidate":cs["performance"]});
    let base_bugs = xml::items(&bs["reliability"]["bugs"], "bug_id");
    let candidate_bugs = xml::items(&cs["reliability"]["bugs"], "bug_id");
    let new = candidate_bugs
        .iter()
        .filter(|id| !base_bugs.contains(id))
        .map(|v| (*v).clone())
        .collect::<Vec<_>>();
    let recurring = candidate_bugs
        .iter()
        .filter(|id| base_bugs.contains(id))
        .map(|v| (*v).clone())
        .collect::<Vec<_>>();
    let gone = base_bugs
        .iter()
        .filter(|id| !candidate_bugs.contains(id))
        .map(|v| (*v).clone())
        .collect::<Vec<_>>();
    let side_references = [
        crate::analysis::sideboarding_reference(&baseline)?,
        crate::analysis::sideboarding_reference(&candidate)?,
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>();
    let side_changes = json!({"baseline":bs["sideboarding"],"candidate":cs["sideboarding"],"observations":{"observation":"Legal exchange counts are partitioned by player, card, direction and reason. Exposure and observed match histories differ; these changes do not establish exchange quality."},"evidence":{"reference":side_references}});
    let mut categories = std::collections::BTreeSet::new();
    for summary in [&bs, &cs] {
        for failure in xml::items(&summary["reliability"]["failures_by_category"], "failure") {
            categories.insert(xml::text(&failure["category"])?.to_owned());
        }
    }
    let failure_count = |summary: &serde_json::Value, category: &str| {
        xml::items(&summary["reliability"]["failures_by_category"], "failure")
            .into_iter()
            .find(|r| r["category"] == category)
            .and_then(|r| xml::integer(&r["count"]).ok())
            .unwrap_or(0)
    };
    let bug_refs = |run: &Path, ids: &[serde_json::Value]| {
        ids.iter()
            .map(|id| json!({"path":run.join("bugs").join(format!("{}.xml",id.as_str().unwrap()))}))
            .collect::<Vec<_>>()
    };
    let new_refs = bug_refs(&candidate, &new);
    let recurring_refs = bug_refs(&candidate, &recurring);
    let reliability_changes = json!({"baseline":bs["counts"],"candidate":cs["counts"],"records":{"record":categories.iter().map(|category|{let a=failure_count(&bs,category);let b=failure_count(&cs,category);json!({"category":category,"baseline":a,"candidate":b,"delta_count":b as i64-a as i64})}).collect::<Vec<_>>()},"observations":{"observation":"Failure counts retain infrastructure outcomes separately from competitive results. A previously observed signature not seen is not proof that its defect is fixed."},"new_bug_references":{"reference":new_refs},"recurring_failure_references":{"reference":recurring_refs}});
    let id = format!(
        "comparison-{}",
        &identity::digest(&json!([baseline, candidate]))[..16]
    );
    let doc = json!({"comparison_id":id,"baseline_run":baseline,"candidate_run":candidate,"baseline_manifest_sha256":identity::sha(fs::read(baseline.join("manifest.xml"))?),"candidate_manifest_sha256":identity::sha(fs::read(candidate.join("manifest.xml"))?),"comparison_mode":"unpaired","comparability":{"same_input_deck":same_deck,"same_rules_and_banlist":same_rules,"same_engine_and_content":same_content,"same_opponent_artifact_and_config":changed.is_some(),"same_starting_order_cases":same_orders,"changed_bot":changed,"confounded":confounded,"notes":{"note":"Same fixture is not proof of identical later random execution; comparison uses unpaired match clusters."}},"metrics":{"metric":metrics},"decision_changes":behavior,"performance_changes":performance,"sideboarding_changes":side_changes,"reliability_changes":reliability_changes,"new_bug_ids":{"bug_id":new},"recurring_failure_signatures":{"bug_id":recurring},"previously_observed_bugs_not_seen":{"bug_id":gone},"limitations":{"limitation":["Self-play symmetry is not evidence of strength improvement.","Starting orders do not control subsequent random outcomes.","Conditional action rates and sideboard differences do not establish causality."]}});
    xml::write(&out.join("comparison.xml"), "comparison", &doc)?;
    xml::write(
        &out.join("report.xml"),
        "comparison-report",
        &json!({"comparison_id":id,"comparison_path":"comparison.xml","compared_runs":{"baseline":{"manifest_path":baseline.join("manifest.xml")},"candidate":{"manifest_path":candidate.join("manifest.xml")}},"comparability":{"assessment":if confounded{"Inputs do not isolate one changed bot against a fixed opponent; do not infer strength improvement."}else{"Deck, engine, content, rules and reference opponent identities are fixed."},"limitations":doc["limitations"]},"result_changes":{"metric_references":{"metric_reference":["metrics","comparability"]},"observations":{}},"decision_changes":{"metric_reference":"decision_changes","evidence":behavior["evidence"]},"sideboarding_changes":{"metric_reference":"sideboarding_changes","observations":side_changes["observations"],"evidence":side_changes["evidence"]},"performance_changes":{"metric_reference":"performance_changes"},"reliability_changes":{"metric_reference":"reliability_changes","observations":reliability_changes["observations"],"new_bug_references":reliability_changes["new_bug_references"],"recurring_failure_references":reliability_changes["recurring_failure_references"]},"recommendations":{"recommendation":[{"hypothesis":"A changed reason distribution may identify a policy decision worth investigating; outcome associations alone are insufficient.","evidence":behavior["evidence"],"next_step":"Inspect cited legal choices and rerun a single policy change against the fixed reference opponent."}]}}),
    )?;
    println!("{}", out.display());
    Ok(0)
}
