use crate::{Bot, V, array, ids, n, s, selection};
use serde_json::json;
use std::collections::HashSet;
#[derive(Default)]
pub(crate) struct Loop {
    signature: V,
    state: V,
    consecutive: usize,
    tried: HashSet<String>,
}
fn semantic(c: &V) -> V {
    json!({"action":c["action"],"card":if c["card"].is_null(){V::Null}else{json!({"instanceId":c["card"]["instanceId"],"controller":c["card"]["controller"],"location":c["card"]["location"],"sequence":c["card"]["sequence"],"position":c["card"]["position"]})},"place":c["place"],"value":c["value"],"selected":c["selected"],"allocationMaximum":c["allocationMaximum"]})
}
const EXITS: [&str; 5] = ["pass", "mainPhase2", "endPhase", "finish", "cancel"];
impl Bot {
    pub(crate) fn basic(&mut self, input: &V) -> Result<Vec<V>, String> {
        let p = &input["prompt"];
        let o = &input["observation"];
        let c = array(&p["choices"]);
        let normal = self.basic_normal(p)?;
        let signature = json!({"kind":p["kind"],"minimum":p["minimum"],"maximum":p["maximum"],"cancelable":p["cancelable"],"ordered":p["ordered"],"requiredTotal":p["requiredTotal"],"sumMode":p["sumMode"],"choices":c.iter().map(semantic).collect::<Vec<_>>()});
        let state = json!({"turn":o["turn"],"turnPlayer":o["turnPlayer"],"phase":o["phase"],"players":o["players"],"chainSize":o["chainSize"]});
        let keys: Vec<String> = c
            .iter()
            .filter(|c| normal.contains(&c["id"]))
            .map(|c| semantic(c).to_string())
            .collect();
        if self.basic.signature != signature || self.basic.state != state {
            self.basic = Loop {
                signature,
                state,
                consecutive: 1,
                tried: keys.into_iter().collect(),
            };
            return Ok(normal);
        }
        self.basic.consecutive += 1;
        self.basic.tried.extend(keys);
        if self.basic.consecutive < 3 || normal.len() != 1 || n(&p["maximum"]) != 1.0 {
            return Ok(normal);
        }
        if let Some(choice) = c.iter().find(|c| {
            !self.basic.tried.contains(&semantic(c).to_string())
                && !EXITS.contains(&s(&c["action"]))
        }) {
            self.basic.tried.insert(semantic(choice).to_string());
            return Ok(vec![choice["id"].clone()]);
        }
        for exit in EXITS {
            if let Some(choice) = c.iter().find(|c| c["action"] == exit) {
                return Ok(vec![choice["id"].clone()]);
            }
        }
        Ok(normal)
    }
    fn basic_normal(&self, p: &V) -> Result<Vec<V>, String> {
        let c = array(&p["choices"]);
        let min = n(&p["minimum"]) as usize;
        let max = n(&p["maximum"]) as usize;
        if c.is_empty() {
            return if min == 0 {
                Ok(vec![])
            } else {
                Err("No legal choices".into())
            };
        }
        let first = |actions: &[&str]| c.iter().position(|c| actions.contains(&s(&c["action"])));
        let one = |i: usize| Ok(vec![c[i]["id"].clone()]);
        match s(&p["kind"]) {
            "idleCommand" => {
                for actions in [
                    &["summon"][..],
                    &["specialSummon"],
                    &["activate"],
                    &["setMonster", "setSpellTrap"],
                    &["battlePhase", "endPhase"],
                ] {
                    if let Some(i) = first(actions) {
                        return one(i);
                    }
                }
                one(0)
            }
            "battleCommand" => {
                let mut attacks: Vec<usize> = c
                    .iter()
                    .enumerate()
                    .filter(|(_, c)| c["action"] == "attack")
                    .map(|(i, _)| i)
                    .collect();
                attacks.sort_by(|&a, &b| self.attack(&c[b]).total_cmp(&self.attack(&c[a])));
                one(attacks
                    .first()
                    .copied()
                    .or_else(|| first(&["mainPhase2"]))
                    .or_else(|| first(&["endPhase"]))
                    .unwrap_or(0))
            }
            "chain" => one(first(&["pass"]).unwrap_or(0)),
            "yesNo" | "effectYesNo" => one(first(&["no"]).unwrap_or(0)),
            "sortCard" | "sortChain" => Ok(c.iter().map(|c| c["id"].clone()).collect()),
            "selectSum" if !p["requiredTotal"].is_null() => selection::sum(
                c,
                &p["mandatoryContributions"],
                n(&p["requiredTotal"]),
                s(&p["sumMode"]),
                min,
                max,
            )
            .map(|v| ids(c, &v))
            .ok_or("No legal sum".into()),
            "selectCounter" => {
                let mut selected = vec![];
                for choice in c {
                    for _ in 0..(n(&choice["allocationMaximum"]) as usize).min(min - selected.len())
                    {
                        selected.push(choice["id"].clone());
                    }
                    if selected.len() == min {
                        return Ok(selected);
                    }
                }
                Err("No counter allocation".into())
            }
            "selectTribute" => {
                let mut total = 0.0;
                let mut selected = vec![];
                for choice in c.iter().take(max) {
                    selected.push(choice["id"].clone());
                    total += choice["card"]["contribution"].as_f64().unwrap_or(1.0);
                    if total >= p["requiredTotal"].as_f64().unwrap_or(min as f64) {
                        return Ok(selected);
                    }
                }
                Err("No legal tribute".into())
            }
            "selectCard"
            | "selectPlace"
            | "selectDisabledField"
            | "announceAttribute"
            | "announceRace"
            | "selectSum" => Ok(c.iter().take(min).map(|c| c["id"].clone()).collect()),
            "selectUnselectCard" => one(first(&["finish"]).unwrap_or(0)),
            "option" | "selectPosition" | "announceNumber" | "announceCard"
            | "rockPaperScissors" => one(0),
            _ => Err("Unsupported prompt".into()),
        }
    }
}
