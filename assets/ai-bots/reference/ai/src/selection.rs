use crate::{Bot, V, array, ids, n, s};
use std::collections::HashSet;
fn empty(p: &V) -> bool {
    p["cancelable"] == true
        && ["selectCard", "selectTribute", "sortCard", "sortChain"].contains(&s(&p["kind"]))
}
pub(crate) fn counts(p: &V) -> Vec<usize> {
    if p["kind"] == "selectUnselectCard" {
        return vec![1];
    }
    let capacity = if p["kind"] == "selectCounter" {
        array(&p["choices"])
            .iter()
            .map(|c| n(&c["allocationMaximum"]) as usize)
            .sum()
    } else {
        array(&p["choices"]).len()
    };
    let min = n(&p["minimum"]) as usize;
    let max = (n(&p["maximum"]) as usize).min(capacity);
    let mut result: Vec<usize> = if min <= max {
        (min..=max).collect()
    } else {
        vec![]
    };
    if empty(p) && min > 0 {
        result.push(0)
    }
    result
}
pub(crate) fn legal(
    p: &V,
    order: &[usize],
    counts: &[usize],
    mut random: Option<&mut Bot>,
) -> Result<Vec<V>, String> {
    let original = array(&p["choices"]);
    let choices: Vec<V> = order.iter().map(|&i| original[i].clone()).collect();
    for &count in counts {
        if count == 0 && empty(p) {
            return Ok(vec![]);
        }
        if p["ordered"] == true {
            return Ok(choices.iter().map(|c| c["id"].clone()).collect());
        }
        if p["kind"] == "selectCounter" {
            let mut selected = vec![];
            let mut remaining: Vec<usize> = choices
                .iter()
                .map(|c| n(&c["allocationMaximum"]) as usize)
                .collect();
            while selected.len() < count {
                let mut available: Vec<usize> =
                    (0..choices.len()).filter(|&i| remaining[i] > 0).collect();
                if let Some(bot) = random.as_deref_mut() {
                    bot.shuffle(&mut available)
                }
                let Some(&i) = available.first() else { break };
                selected.push(choices[i]["id"].clone());
                remaining[i] -= 1;
            }
            if selected.len() == count {
                return Ok(selected);
            }
        } else if p["kind"] == "selectSum" && !p["requiredTotal"].is_null() {
            if let Some(selection) = sum(
                &choices,
                &p["mandatoryContributions"],
                n(&p["requiredTotal"]),
                s(&p["sumMode"]),
                count,
                count,
            ) {
                return Ok(ids(&choices, &selection));
            }
        } else if p["kind"] == "selectTribute" {
            let target = p["requiredTotal"].as_f64().unwrap_or(n(&p["minimum"]));
            let mut states = vec![(0.0, Vec::<usize>::new())];
            let mut keys = HashSet::from([(0, 0.0_f64.to_bits())]);
            for (i, c) in choices.iter().enumerate() {
                let mut next = states.clone();
                for (total, selected) in &states {
                    if selected.len() >= count {
                        continue;
                    }
                    let total =
                        (total + c["card"]["contribution"].as_f64().unwrap_or(1.0)).min(target);
                    let mut selected = selected.clone();
                    selected.push(i);
                    if keys.insert((selected.len(), total.to_bits())) {
                        next.push((total, selected));
                    }
                }
                states = next;
            }
            if let Some((_, selected)) = states
                .iter()
                .find(|(total, selected)| *total == target && selected.len() == count)
            {
                return Ok(ids(&choices, selected));
            }
        } else if count <= choices.len() {
            return Ok(choices
                .iter()
                .take(count)
                .map(|c| c["id"].clone())
                .collect());
        }
    }
    Err(format!("No legal response for {}", s(&p["kind"])))
}
fn options(c: &V) -> Vec<f64> {
    let mut v = vec![n(&c["contribution"])];
    if !c["alternativeContribution"].is_null() {
        v.push(n(&c["alternativeContribution"]))
    }
    v
}
pub(crate) fn sum(
    choices: &[V],
    mandatory: &V,
    target: f64,
    mode: &str,
    min: usize,
    max: usize,
) -> Option<Vec<usize>> {
    if mode == "atLeast" {
        return at_least(choices, mandatory, target, min, max);
    }
    let mut totals = vec![0.0];
    for c in array(mandatory) {
        let mut next = vec![];
        for t in &totals {
            for value in options(c) {
                let t = t + value;
                if t <= target && !next.contains(&t) {
                    next.push(t)
                }
            }
        }
        totals = next;
    }
    let mut states: Vec<(f64, Vec<usize>)> = totals.into_iter().map(|t| (t, vec![])).collect();
    let mut keys: HashSet<(usize, u64)> = states.iter().map(|(t, _)| (0, t.to_bits())).collect();
    for (index, c) in choices.iter().enumerate() {
        let mut next = states.clone();
        for (total, selected) in &states {
            if selected.len() >= max {
                continue;
            }
            for value in options(&c["card"]) {
                let t = total + value;
                if value <= 0.0 || t > target {
                    continue;
                }
                let mut selected = selected.clone();
                selected.push(index);
                if keys.insert((selected.len(), t.to_bits())) {
                    next.push((t, selected));
                }
            }
        }
        states = next;
    }
    for count in min..=max {
        if let Some((_, selected)) = states
            .iter()
            .find(|(t, selected)| *t == target && selected.len() == count)
        {
            return Some(selected.clone());
        }
    }
    None
}
#[derive(Clone)]
struct State {
    selected: Vec<usize>,
    min: f64,
    max: f64,
    smallest: f64,
}
impl State {
    fn add(&self, c: &V, index: Option<usize>) -> Self {
        let v = options(c);
        let min = v.iter().copied().fold(f64::INFINITY, f64::min);
        let max = v.iter().copied().fold(f64::NEG_INFINITY, f64::max);
        let mut selected = self.selected.clone();
        if let Some(i) = index {
            selected.push(i)
        }
        Self {
            selected,
            min: self.min + min,
            max: self.max + max,
            smallest: self.smallest.min(min),
        }
    }
    fn key(&self, target: f64) -> (usize, u64, u64, u64) {
        (
            self.selected.len(),
            self.min.to_bits(),
            self.max.min(target).to_bits(),
            self.smallest.to_bits(),
        )
    }
    fn valid(&self, target: f64) -> bool {
        self.smallest != f64::INFINITY && self.max >= target && self.min - self.smallest < target
    }
}
fn at_least(
    choices: &[V],
    mandatory: &V,
    target: f64,
    min: usize,
    max: usize,
) -> Option<Vec<usize>> {
    let mut initial = State {
        selected: vec![],
        min: 0.0,
        max: 0.0,
        smallest: f64::INFINITY,
    };
    for c in array(mandatory) {
        initial = initial.add(c, None)
    }
    if min == 0 && initial.valid(target) {
        return Some(vec![]);
    }
    let mut keys = HashSet::from([initial.key(target)]);
    let mut states = vec![initial];
    for (index, c) in choices.iter().enumerate() {
        let mut next = states.clone();
        for state in &states {
            if state.selected.len() >= max {
                continue;
            }
            let added = state.add(&c["card"], Some(index));
            if added.smallest != f64::INFINITY && added.min - added.smallest >= target {
                continue;
            }
            if keys.insert(added.key(target)) {
                next.push(added)
            }
        }
        states = next;
        for state in &states {
            if state.selected.len() >= min && state.selected.len() <= max && state.valid(target) {
                return Some(state.selected.clone());
            }
        }
    }
    None
}
