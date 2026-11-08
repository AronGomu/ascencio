//! Contract v1: JSON permitted observations/choices in; choice IDs out.
//! No engine, filesystem, clock, network, or learned state is available here.
mod basic;
mod generalist;
mod selection;
#[cfg(target_arch = "wasm32")]
mod wasm;
use serde_json::{Value as V, json};
use std::collections::HashMap;
pub(crate) fn n(v: &V) -> f64 {
    v.as_f64().unwrap_or(0.0)
}
pub(crate) fn s(v: &V) -> &str {
    v.as_str().unwrap_or("")
}
pub(crate) fn array(v: &V) -> &[V] {
    v.as_array().map(Vec::as_slice).unwrap_or(&[])
}
pub(crate) fn ids(choices: &[V], selected: &[usize]) -> Vec<V> {
    selected.iter().map(|&i| choices[i]["id"].clone()).collect()
}
#[derive(Default)]
pub struct Bot {
    policy: String,
    cards: HashMap<u64, V>,
    basic: basic::Loop,
    phase: String,
    attempts: HashMap<String, usize>,
    rng: u32,
    draws: Vec<u32>,
}
impl Bot {
    pub fn request(&mut self, request: &V) -> Result<V, String> {
        match s(&request["op"]) {
            "create" => {
                if n(&request["contractVersion"]) != 1.0 {
                    return Err("Unsupported contract version".into());
                }
                let policy = s(&request["policy"]);
                if !["basic", "generalist", "random"].contains(&policy) {
                    return Err("Unknown policy".into());
                }
                if request["configuration"]
                    .as_object()
                    .is_some_and(|o| !o.is_empty())
                {
                    return Err("Configuration must be empty".into());
                }
                *self = Self::default();
                self.policy = policy.to_owned();
                self.rng = request["seed"].as_u64().unwrap_or(1) as u32;
                if self.rng == 0 {
                    self.rng = 1;
                }
                for card in array(&request["cards"]) {
                    let code = card["code"].as_u64().ok_or("Invalid card code")?;
                    self.cards.insert(code, card.clone());
                }
                Ok(json!({"contractVersion":1}))
            }
            "sideboard" if !self.policy.is_empty() => Ok(
                json!({"exchanges":[],"reason":{"code":"retain_deck","explanation":"Retain the declared deck."}}),
            ),
            "decide" if !self.policy.is_empty() => {
                let input = &request["input"];
                let prompt = &input["prompt"];
                if array(&prompt["choices"]).len() > 4096 {
                    return Err("Choice limit exceeded".into());
                }
                self.draws.clear();
                let selected = match self.policy.as_str() {
                    "basic" => self.basic(input)?,
                    "generalist" => self.generalist(input)?,
                    "random" => {
                        let mut order: Vec<usize> = (0..array(&prompt["choices"]).len()).collect();
                        self.shuffle(&mut order);
                        let mut counts = selection::counts(prompt);
                        self.shuffle(&mut counts);
                        selection::legal(prompt, &order, &counts, Some(self))?
                    }
                    _ => unreachable!(),
                };
                Ok(
                    json!({"choiceIds":selected,"reason":{"code":"rust_reference","explanation":"Equivalent reference policy."},"randomDraws":self.draws}),
                )
            }
            _ => Err("Uninitialized bot or unknown operation".into()),
        }
    }
    pub(crate) fn attack(&self, choice: &V) -> f64 {
        self.stat(choice, "attack")
    }
    pub(crate) fn stat(&self, choice: &V, field: &str) -> f64 {
        choice["card"]["code"]
            .as_u64()
            .and_then(|c| self.cards.get(&c))
            .map(|c| n(&c[field]))
            .unwrap_or(0.0)
    }
    // xorshift32; divide by 2^32, exactly representable in JavaScript binary64.
    pub(crate) fn shuffle<T>(&mut self, values: &mut [T]) {
        for i in (1..values.len()).rev() {
            let mut x = self.rng;
            x ^= x << 13;
            x ^= x >> 17;
            x ^= x << 5;
            self.rng = x;
            self.draws.push(x);
            let j = (x as f64 / 4294967296.0 * (i + 1) as f64).floor() as usize;
            values.swap(i, j);
        }
    }
}
