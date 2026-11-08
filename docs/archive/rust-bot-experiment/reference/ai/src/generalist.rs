use crate::{array, n, s, selection, Bot, V};
use serde_json::json;
impl Bot {
    pub(crate) fn generalist(&mut self, input: &V) -> Result<Vec<V>, String> {
        let p = &input["prompt"];
        let o = &input["observation"];
        let choices = array(&p["choices"]);
        let phase = format!("{}:{}", o["turn"], s(&o["phase"]));
        if phase != self.phase {
            self.phase = phase;
            self.attempts.clear();
        }
        let key = |c: &V| {
            json!([p["kind"], c["action"], c["card"]["instanceId"], c["value"]]).to_string()
        };
        let enemies = array(
            &o["publicState"]["players"][if n(&p["player"]) == 0.0 { 1 } else { 0 }]["monsters"],
        );
        let threat = enemies
            .iter()
            .filter(|c| c["faceUp"] == true)
            .map(|c| {
                c["code"]
                    .as_u64()
                    .and_then(|code| self.cards.get(&code))
                    .map(|card| n(&card["attack"]).max(0.0))
                    .unwrap_or(0.0)
            })
            .fold(0.0, f64::max);
        let mut ranked: Vec<(usize, f64)> = choices
            .iter()
            .enumerate()
            .map(|(i, c)| {
                let attack = self.attack(c).max(0.0);
                let defense = self.stat(c, "defense").max(0.0);
                let action = s(&c["action"]);
                let mut score = match s(&p["kind"]) {
                    "idleCommand" => {
                        let mut score = match action {
                            "summon" => 100.0,
                            "specialSummon" => 110.0,
                            "flipSummon" => 90.0,
                            "activate" => 60.0,
                            "setMonster" => 50.0,
                            "setSpellTrap" => 40.0,
                            "battlePhase" => 20.0,
                            "endPhase" => 10.0,
                            "changePosition" => -10.0,
                            "shuffle" => -100.0,
                            _ => 0.0,
                        };
                        if ["summon", "specialSummon", "flipSummon"].contains(&action) {
                            score += attack / 1000.0;
                        }
                        if action == "setMonster" {
                            score += defense / 1000.0;
                        }
                        if action == "changePosition"
                            && c["card"]["position"] == "faceUpDefense"
                            && attack >= threat
                        {
                            score = 80.0;
                        }
                        score
                    }
                    "battleCommand" => match action {
                        "attack" => {
                            if enemies.is_empty() || attack >= threat {
                                100.0 + attack / 1000.0
                            } else {
                                -10.0
                            }
                        }
                        "mainPhase2" => 20.0,
                        "endPhase" => 10.0,
                        _ => 0.0,
                    },
                    "chain" | "effectYesNo" | "yesNo" => {
                        if action == "yes" || action == "activate" {
                            10.0
                        } else {
                            0.0
                        }
                    }
                    "selectPosition" => {
                        if n(&c["value"])
                            == if attack >= threat && attack >= defense {
                                1.0
                            } else {
                                4.0
                            }
                        {
                            10.0
                        } else {
                            0.0
                        }
                    }
                    "selectTribute" => -attack,
                    "selectCard" if c["card"].is_object() => {
                        if c["card"]["controller"] == p["player"] {
                            attack
                        } else {
                            -attack
                        }
                    }
                    "selectUnselectCard" => {
                        if action == "finish" {
                            10.0
                        } else if c["selected"] == true {
                            -1.0
                        } else {
                            0.0
                        }
                    }
                    _ => 0.0,
                };
                if ["idleCommand", "battleCommand"].contains(&s(&p["kind"]))
                    && self.attempts.get(&key(c)).copied().unwrap_or(0) >= 2
                {
                    score = -1e9;
                }
                (i, score)
            })
            .collect();
        // JavaScript's subtraction comparator ties -0 and +0; stable sort keeps
        // their offered order. total_cmp would distinguish those two scores.
        ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        let selected = selection::legal(
            p,
            &ranked.iter().map(|x| x.0).collect::<Vec<_>>(),
            &selection::counts(p),
            None,
        )?;
        for c in choices.iter().filter(|c| selected.contains(&c["id"])) {
            *self.attempts.entry(key(c)).or_default() += 1;
        }
        Ok(selected)
    }
}
