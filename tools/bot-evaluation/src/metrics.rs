use crate::xml;
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};
#[derive(Default)]
pub struct Metrics {
    pub matches: u64,
    pub incomplete: u64,
    pub completed: u64,
    pub failed: u64,
    pub skipped: u64,
    pub wins: [u64; 2],
    pub draws: u64,
    pub match_wins: [u64; 2],
    pub ties: u64,
    pub durations: Vec<f64>,
    pub samples: Vec<Value>,
    pub decision_times: Histogram,
    pub engine: f64,
    pub bot: f64,
    pub writes: f64,
    pub elapsed: f64,
    pub timing_incomplete: bool,
    pub peak: u64,
    pub stages: [[u64; 3]; 2],
    pub stage_durations: [Vec<f64>; 2],
    pub failures: BTreeMap<String, u64>,
    pub handles_created: u64,
    pub handles_destroyed: u64,
    pub match_clusters: Vec<[u64; 3]>,
    pub card: BTreeMap<String, [u64; 5]>,
    pub events: BTreeMap<String, u64>,
    pub resolved_effects: BTreeMap<String, u64>,
    pub side_records: BTreeMap<String, u64>,
    pub reasons: BTreeMap<String, u64>,
    pub clusters: Vec<[u64; 3]>,
    pub scores: BTreeMap<String, u64>,
    pub side_exchanges: u64,
    pub game_observations_in_incomplete: u64,
}
#[derive(Default)]
pub struct Histogram {
    bins: BTreeMap<u64, u64>,
    count: u64,
    max: f64,
}
impl Histogram {
    pub fn add(&mut self, n: f64) {
        *self
            .bins
            .entry(((1.0 + n).ln() * 1000.0).ceil().min(65535.0) as u64)
            .or_default() += 1;
        self.count += 1;
        self.max = self.max.max(n)
    }
    pub fn report(&self) -> Value {
        let percentile = |p: f64| {
            let target = (self.count as f64 * p).ceil() as u64;
            let mut count = 0;
            for (k, n) in &self.bins {
                count += n;
                if count >= target {
                    return Some((*k as f64 / 1000.0).exp() - 1.0);
                }
            }
            None
        };
        json!({"p50":percentile(0.5),"p95":percentile(0.95),"p99":percentile(0.99),"maximum":if self.count==0{None}else{Some(self.max)}})
    }
}
pub fn rate(n: u64, d: u64) -> Value {
    json!({"value":if d==0{None}else{Some(n as f64/d as f64)},"numerator":n,"denominator":d})
}
pub fn uncertainty(clusters: &[[u64; 3]], actor: usize) -> Value {
    let n = clusters.len();
    let den: f64 = clusters.iter().map(|c| c[2] as f64).sum();
    let wins: f64 = clusters.iter().map(|c| c[actor] as f64).sum();
    let p = if den > 0.0 { wins / den } else { 0.0 };
    let variance = if n > 1 && den > 0.0 {
        Some(
            n as f64 / (n - 1) as f64
                * clusters
                    .iter()
                    .map(|c| (c[actor] as f64 - p * c[2] as f64).powi(2))
                    .sum::<f64>()
                / den.powi(2),
        )
    } else {
        None
    };
    json!({"method":"match_cluster_sandwich_normal_95_v1","sample_size":n,"confidence_level":0.95,"standard_error":variance.map(f64::sqrt),"interval_percentage_points":variance.map(|v|json!({"lower":100.0*(p-1.96*v.sqrt()).max(0.0),"upper":100.0*(p+1.96*v.sqrt()).min(1.0)}))})
}
impl Metrics {
    pub fn game(&mut self, neutral: &Value, records: &[Value; 2]) {
        self.handles_created += xml::integer(&neutral["cleanup"]["handles_created"]).unwrap_or(0);
        self.handles_destroyed +=
            xml::integer(&neutral["cleanup"]["handles_destroyed"]).unwrap_or(0);
        match neutral["status"].as_str().unwrap_or("") {
            "skipped" => {
                self.skipped += 1;
                return;
            }
            "failed" => {
                self.failed += 1;
                *self
                    .failures
                    .entry(
                        neutral["failure_category"]
                            .as_str()
                            .unwrap_or("unknown")
                            .to_owned(),
                    )
                    .or_default() += 1;
                return;
            }
            "completed" => self.completed += 1,
            _ => return,
        }
        let winner = neutral["winner"].as_str();
        let stage = if neutral["stage"] == "pre_side" { 0 } else { 1 };
        if let Some(w) = winner {
            let i = if w == "a" { 0 } else { 1 };
            self.wins[i] += 1;
            self.stages[stage][i] += 1
        } else {
            self.draws += 1;
            self.stages[stage][2] += 1
        }
        let duration = xml::number(&neutral["duration_ms"])
            .or_else(|_| xml::number(&records[0]["result"]["duration_ms"]))
            .unwrap_or(0.0);
        self.durations.push(duration);
        if self.samples.len() < 4 {
            self.samples.push(json!({"game_id":neutral["game_id"],"stage":neutral["stage"],"duration_ms":duration,"costs":neutral["costs"]}));
        }
        self.stage_durations[stage].push(duration);
        self.engine += xml::number(&records[0]["result"]["engine_time_ms"]).unwrap_or(0.0);
        self.bot += xml::number(&records[0]["result"]["bot_time_ms"]).unwrap_or(0.0);
        for (actor, record) in records.iter().enumerate() {
            let mut seen = BTreeSet::new();
            for entry in xml::items(&record["timeline"], "entry") {
                if entry["kind"] == "event" {
                    let event = entry["event"].as_str().unwrap_or("unknown");
                    *self
                        .events
                        .entry(format!("{}:{event}", if actor == 0 { "a" } else { "b" }))
                        .or_default() += 1;
                    for detail in xml::items(&entry["details"], "item") {
                        if detail["type"] == "effect_resolved"
                            && detail["player"] == if actor == 0 { "a" } else { "b" }
                        {
                            let code = detail["card_code"].as_str().unwrap_or("unknown");
                            *self
                                .resolved_effects
                                .entry(format!("{}:{code}", if actor == 0 { "a" } else { "b" }))
                                .or_default() += 1;
                        }
                        if detail["type"] == "material_attached"
                            || detail["type"] == "material_detached"
                        {
                            *self
                                .events
                                .entry(format!(
                                    "{}:{}",
                                    if actor == 0 { "a" } else { "b" },
                                    detail["type"].as_str().unwrap()
                                ))
                                .or_default() += 1;
                        }
                    }
                    continue;
                }
                if entry["kind"] != "decision" {
                    continue;
                }
                self.decision_times
                    .add(xml::number(&entry["duration_ms"]).unwrap_or(0.0));
                *self
                    .reasons
                    .entry(
                        entry["reason"]["code"]
                            .as_str()
                            .unwrap_or("unknown")
                            .to_owned(),
                    )
                    .or_default() += 1;
                let selected: BTreeSet<_> = xml::items(&entry["selected_choice_ids"], "choice_id")
                    .into_iter()
                    .filter_map(Value::as_str)
                    .collect();
                let mut opportunities = BTreeSet::new();
                let mut chosen = BTreeSet::new();
                for choice in xml::items(&entry["prompt"]["choices"], "choice") {
                    if let (Some(code), Some(action)) =
                        (choice["card_code"].as_str(), choice["action"].as_str())
                    {
                        let key = format!("{}:{code}:{action}", if actor == 0 { "a" } else { "b" });
                        opportunities.insert(key.clone());
                        if selected.contains(choice["id"].as_str().unwrap_or("")) {
                            *self
                                .card
                                .entry(key.clone())
                                .or_default()
                                .get_mut(0)
                                .unwrap() += 1;
                            seen.insert(key.clone());
                            chosen.insert(key);
                        }
                    }
                }
                for key in opportunities {
                    let c = self.card.entry(key.clone()).or_default();
                    c[3] += 1;
                    if !chosen.contains(&key) {
                        c[4] += 1
                    }
                }
            }
            for key in seen {
                let c = self.card.entry(key).or_default();
                c[1] += 1;
                if winner == Some(if actor == 0 { "a" } else { "b" }) {
                    c[2] += 1
                }
            }
        }
    }
    pub fn sideboard(&mut self, report: &Value) {
        for exchange in xml::items(&report["sideboarding"]["exchanges"], "exchange") {
            let key = format!(
                "{}:{}:{}:{}:{}",
                report["perspective"].as_str().unwrap_or("unknown"),
                exchange["card_code"].as_str().unwrap_or("unknown"),
                exchange["from_section"].as_str().unwrap_or("unknown"),
                exchange["to_section"].as_str().unwrap_or("unknown"),
                exchange["reason_code"].as_str().unwrap_or("unknown")
            );
            *self.side_records.entry(key).or_default() += 1;
            self.side_exchanges += 1;
        }
    }
    pub fn finish_match(&mut self, record: &Value) {
        if record["sideboarding"]["status"] == "failed" {
            *self
                .failures
                .entry("sideboarding_failure".to_owned())
                .or_default() += 1;
        }
        let games = xml::items(&record["games"], "game");
        let mut cluster = [0, 0, 0];
        for g in games {
            if g["status"] == "completed" {
                cluster[2] += 1;
                if g["winner"] == "a" {
                    cluster[0] += 1
                } else if g["winner"] == "b" {
                    cluster[1] += 1
                }
            }
        }
        if cluster[2] > 0 {
            self.clusters.push(cluster);
        }
        if record["status"] != "completed" {
            self.incomplete += 1;
            self.game_observations_in_incomplete += cluster[2];
            return;
        }
        self.matches += 1;
        self.match_clusters.push([
            u64::from(cluster[0] > cluster[1]),
            u64::from(cluster[1] > cluster[0]),
            1,
        ]);
        *self
            .scores
            .entry(format!(
                "{}-{}-{}",
                cluster[0],
                cluster[1],
                cluster[2] - cluster[0] - cluster[1]
            ))
            .or_default() += 1;
        if cluster[0] > cluster[1] {
            self.match_wins[0] += 1
        } else if cluster[1] > cluster[0] {
            self.match_wins[1] += 1
        } else {
            self.ties += 1
        }
    }
    pub fn summary(
        &self,
        run: &str,
        status: &str,
        requested: u64,
        startup: f64,
        target: f64,
        bugs: Value,
        memory: Value,
    ) -> Value {
        let measured = |value: f64| (!self.timing_incomplete).then_some(value);
        let mut durations = self.durations.clone();
        durations.sort_by(f64::total_cmp);
        let pct = |p: f64| {
            durations
                .get(((durations.len() as f64 * p).ceil() as usize).saturating_sub(1))
                .copied()
        };
        let player = |i: usize| json!({"game_wins":self.wins[i],"game_losses":self.wins[1-i],"game_draws":self.draws,"game_win_rate":rate(self.wins[i],self.completed),"match_wins":self.match_wins[i],"match_losses":self.match_wins[1-i],"match_ties":self.ties,"match_win_rate":rate(self.match_wins[i],self.matches),"uncertainty":uncertainty(&self.clusters,i),"match_uncertainty":uncertainty(&self.match_clusters,i)});
        let stage = |i: usize| json!({"a":rate(self.stages[i][0],self.stages[i].iter().sum()),"b":rate(self.stages[i][1],self.stages[i].iter().sum()),"draws":self.stages[i][2]});
        json!({"run_id":run,"status":status,"counts":{"matches_requested":requested,"matches_completed":self.matches,"matches_incomplete":self.incomplete,"games_scheduled":requested*4,"games_completed":self.completed,"games_failed":self.failed,"games_skipped":self.skipped,"completed_games_from_incomplete_matches":self.game_observations_in_incomplete},
 "aggregation_rules":{"record":aggregation_rules()},
 "results":{"a":player(0),"b":player(1),"match_score_distribution":{"record":self.scores.iter().map(|(name,count)|json!({"name":name,"count":count})).collect::<Vec<_>>()},"by_stage":{"pre_side":stage(0),"post_side":stage(1)}},
 "card_decisions":{"card_decision":self.card.iter().map(|(key,c)|{let fields:Vec<_>=key.split(':').collect();json!({"player":fields[0],"card_code":fields[1],"action":fields[2],"event_count":c[0],"player_games_with_action":c[1],"wins_in_those_games":c[2],"conditional_win_rate":rate(c[2],c[1]),"legal_opportunities":c[3],"opportunities_declined":c[4]})}).collect::<Vec<_>>()},
 "effects":{"successful_resolutions":{"record":self.resolved_effects.iter().map(|(name,count)|json!({"name":name,"event_count":count})).collect::<Vec<_>>()},"record":self.events.iter().filter(|(k,_)|k.contains("chain")).map(|(name,count)|json!({"name":name,"event_count":count})).collect::<Vec<_>>()},
 "combat":{"record":self.events.iter().filter(|(k,_)|k.contains("attack")||k.contains("battle")||k.contains("damage")).map(|(name,count)|json!({"name":name,"event_count":count})).collect::<Vec<_>>()},
 "materials":{"record":self.events.iter().filter(|(k,_)|k.contains("material_")).map(|(name,count)|json!({"name":name,"event_count":count})).collect::<Vec<_>>()},"resources":{"record":self.events.iter().filter(|(k,_)|k.contains("life_points")||k.contains("recover")).map(|(name,count)|json!({"name":name,"event_count":count})).collect::<Vec<_>>()},"sideboarding":{"event_count":self.side_exchanges,"records":{"record":self.side_records.iter().map(|(name,count)|json!({"name":name,"event_count":count})).collect::<Vec<_>>()}},
 "decision_behavior":{"record":self.reasons.iter().map(|(name,count)|json!({"name":name,"event_count":count})).collect::<Vec<_>>()},
 "performance":{"game_samples":if requested==1 {json!({"game":self.samples.iter().map(|sample| { let mut s=sample.clone(); s["passed"]=json!(xml::number(&s["duration_ms"]).is_ok_and(|v|v<target)); s }).collect::<Vec<_>>()})} else {json!({})},"startup_ms":startup,"elapsed_ms":measured(self.elapsed),"timing_complete":!self.timing_incomplete,"by_stage":{"pre_side":quantiles(&self.stage_durations[0]),"post_side":quantiles(&self.stage_durations[1])},"completed_games_per_second":if self.elapsed>0.0 && !self.timing_incomplete{Some(self.completed as f64/(self.elapsed/1000.0))}else{None},"game_duration_ms":{"p50":pct(0.5),"p95":pct(0.95),"p99":pct(0.99),"maximum":durations.last()},"decision_duration_ms":self.decision_times.report(),"engine_time_ms":self.engine,"bot_time_ms":self.bot,"report_write_time_ms":measured(self.writes),"bridge_time_ms":measured((self.elapsed-self.engine-self.bot-self.writes).max(0.0)),"peak_resident_memory_bytes":if self.peak==0 || self.timing_incomplete{None}else{Some(self.peak)},"acceptance_target":{"warm_game_p95_ms":target,"criterion":if requested==1{"all_four_games_strictly_below_limit"}else{"warm_game_p95"},"passed":if requested==1 {Some(self.completed==4 && self.failed==0 && self.incomplete==0 && durations.iter().all(|v|*v<target))}else{pct(0.95).map(|v|v<=target)}},"memory_samples":memory},"reliability":{"cleanup":{"handles_created":self.handles_created,"handles_destroyed":self.handles_destroyed},"failures_by_category":{"failure":self.failures.iter().map(|(category,count)|json!({"category":category,"count":count})).collect::<Vec<_>>()},"bugs":bugs}})
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn headline_rates_include_draws() {
        assert_eq!(rate(2, 4)["value"], 0.5);
        assert!(rate(0, 0)["value"].is_null());
    }
    #[test]
    fn clustering_is_per_match_and_small_samples_null() {
        assert!(uncertainty(&[[2, 2, 4]], 0)["standard_error"].is_null());
        assert_eq!(uncertainty(&[[4, 0, 4], [0, 4, 4]], 0)["sample_size"], 2);
        assert!(
            uncertainty(&[[4, 0, 4], [0, 4, 4]], 0)["standard_error"]
                .as_f64()
                .unwrap()
                > 0.4
        );
    }
}

fn quantiles(values: &[f64]) -> Value {
    let mut v = values.to_vec();
    v.sort_by(f64::total_cmp);
    let at = |p: f64| v.get(((v.len() as f64 * p).ceil() as usize).saturating_sub(1));
    json!({"p50":at(0.5),"p95":at(0.95),"p99":at(0.99),"maximum":v.last(),"sample_size":v.len()})
}

fn aggregation_rules() -> Vec<Value> {
    [
("counts","Sum authoritative lifecycle states; scheduled is requested matches times four. Pending matches remain unstarted on interruption."),
("results.*.game_win_rate","Wins divided by completed games including draws; failures and skipped games excluded."),
("results.*.match_win_rate","Wins divided by completed matches including ties; incomplete matches excluded."),
("results.by_stage","Same completed-game denominator, partitioned by pre_side/post_side."),
("card_decisions","Event count counts selected choices. Player-games are deduplicated per player/card/action, including draws. Opportunities and declines are deduplicated per prompt/card/action, including repeated prompts."),
("effects","Raw chain event counts per observer; successful_resolutions counts normal CHAIN_SOLVED links from their controller perspective only, with permitted source identity."),
("materials","Public material attach/detach observations per observer; no inferred fusion/synchro usage or cost classification."),
("combat/resources","Raw named public event occurrences per observer, with no quality score."),
("sideboarding","Sum submitted legal exchange records; records partition player/card/direction/reason. No causal effectiveness inferred."),
("decision_behavior","Count bot-provided reasons for completed-game own decisions."),
("performance","Cold initialization separately timed. Exact nearest-rank game latency includes mandatory evidence persistence. Decision histogram uses bounded log buckets. Peak memory is maximum sampled combined supervisor/host RSS. Throughput includes batch orchestration and evidence I/O. Aggregate elapsed/write/bridge/peak metrics are null when a resumed process has no complete earlier timing checkpoint; game latency remains reconstructible from persisted game records."),
("reliability","Failed game and sideboarding categories counted separately from competitive outcomes; cleanup counts explicit host acknowledgements."),
("results.*.uncertainty","Match-cluster sandwich variance with normal 95 percent interval. All completed games within one match form one cluster; estimates null below two informative matches.")
].into_iter().map(|(metric_reference,aggregation_rule)|json!({"metric_reference":metric_reference,"aggregation_rule":aggregation_rule})).collect()
}
