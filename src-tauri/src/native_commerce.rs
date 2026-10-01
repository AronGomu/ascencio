use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
const RARITIES: [&str; 7] = [
    "common",
    "rare",
    "super-rare",
    "ultra-rare",
    "secret-rare",
    "ultimate-rare",
    "ghost-rare",
];
fn exact(v: &Value, keys: &[&str]) -> bool {
    v.as_object()
        .is_some_and(|o| o.len() == keys.len() && keys.iter().all(|key| o.contains_key(*key)))
}
fn number(v: &Value, min: u64, max: u64) -> bool {
    v.as_u64().is_some_and(|n| n >= min && n <= max)
}
fn reference(v: &Value) -> bool {
    v.as_str().is_some_and(|s| {
        !s.is_empty()
            && s.len() <= 128
            && s.bytes().next().is_some_and(|b| b.is_ascii_alphanumeric())
            && s.bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
    })
}
fn list(v: &Value, max: usize) -> bool {
    v.as_array().is_some_and(|a| a.len() <= max)
}
fn unique(v: &Value, key: &str) -> bool {
    let mut seen = HashSet::new();
    v.as_array()
        .is_some_and(|a| a.iter().all(|item| seen.insert(item[key].as_str())))
}
pub(crate) fn valid_content(v: &Value) -> bool {
    if !exact(v, &["schemaVersion", "economies", "boosters", "shops"]) || v["schemaVersion"] != 1 {
        return false;
    }
    for kind in ["economies", "boosters", "shops"] {
        if !list(&v[kind], 10000) || !unique(&v[kind], "id") {
            return false;
        }
    }
    for e in v["economies"].as_array().unwrap() {
        if !exact(
            e,
            &["id", "sellPrices", "singlesMultiplier", "maxPackResale"],
        ) || !reference(&e["id"])
            || !exact(&e["sellPrices"], &RARITIES)
            || !RARITIES
                .iter()
                .all(|r| number(&e["sellPrices"][*r], 0, 1_000_000_000))
            || !number(&e["singlesMultiplier"], 1, 1000)
            || !number(&e["maxPackResale"], 0, 1_000_000_000)
        {
            return false;
        }
    }
    for b in v["boosters"].as_array().unwrap() {
        if !exact(b, &["id", "name", "setId", "replacement", "slots"])
            || !reference(&b["id"])
            || !reference(&b["setId"])
            || !b["name"].as_str().is_some_and(|s| {
                !s.trim().is_empty()
                    && s.encode_utf16().count() <= 512
                    && !s.chars().any(|c| (c as u32) < 32)
            })
            || b["replacement"] != "with"
            || !list(&b["slots"], 100)
            || b["slots"].as_array().unwrap().is_empty()
        {
            return false;
        }
        let mut count = 0;
        for slot in b["slots"].as_array().unwrap() {
            if !exact(slot, &["count", "rarities", "fallback"])
                || !number(&slot["count"], 1, 100)
                || slot["fallback"] != "all"
                || !list(&slot["rarities"], 7)
                || slot["rarities"].as_array().unwrap().is_empty()
                || !unique(&slot["rarities"], "rarity")
            {
                return false;
            }
            count += slot["count"].as_u64().unwrap();
            for r in slot["rarities"].as_array().unwrap() {
                if !exact(r, &["rarity", "weight"])
                    || !r["rarity"].as_str().is_some_and(|s| RARITIES.contains(&s))
                    || !number(&r["weight"], 1, 1_000_000)
                {
                    return false;
                }
            }
        }
        if count > 100 {
            return false;
        }
    }
    for shop in v["shops"].as_array().unwrap() {
        if !exact(shop, &["id", "economyId", "offers", "singles"])
            || !reference(&shop["id"])
            || !reference(&shop["economyId"])
            || !shop["singles"].is_boolean()
            || !list(&shop["offers"], 10000)
            || !unique(&shop["offers"], "boosterId")
        {
            return false;
        }
        for offer in shop["offers"].as_array().unwrap() {
            if !exact(
                offer,
                &["boosterId", "priceDp", "enabled", "requiresProgress"],
            ) || !reference(&offer["boosterId"])
                || !number(&offer["priceDp"], 0, 1_000_000_000)
                || !offer["enabled"].is_boolean()
                || !crate::native_package_manager::valid_chapter_module(
                    &json!({"apiVersion":1,"choiceBeatId":null,"requiresProgress":offer["requiresProgress"],"completion":[]}),
                )
            {
                return false;
            }
        }
    }
    true
}
/** Canonical definitions compose additively; overrides must already be compiled. */
pub(crate) fn validate_stack(
    configs: &HashMap<String, Value>,
    headers: &HashMap<String, Value>,
    sets: &HashMap<String, String>,
) -> Result<(), String> {
    let mut entities: HashMap<(String, String), (String, &Value)> = HashMap::new();
    for (id, config) in configs {
        if let Some(content) = config.get("commerce") {
            if !valid_content(content) {
                return Err("Invalid commerce content".into());
            }
            for kind in ["economies", "boosters", "shops"] {
                for entity in content[kind].as_array().unwrap() {
                    let key = (kind.to_owned(), entity["id"].as_str().unwrap().to_owned());
                    if entities.insert(key, (id.clone(), entity)).is_some() {
                        return Err("Commerce identity conflict".into());
                    }
                }
            }
        }
    }
    for (id, config) in configs {
        let mut allowed = HashSet::new();
        let mut pending = vec![id.clone()];
        while let Some(next) = pending.pop() {
            if !allowed.insert(next.clone()) {
                continue;
            }
            if let Some(deps) = headers[&next]["dependencies"].as_array() {
                for dep in deps {
                    pending.push(
                        dep["packageId"]
                            .as_str()
                            .ok_or("Invalid dependency")?
                            .to_owned(),
                    );
                }
            }
        }
        let get = |kind: &str, key: &str| -> Result<&Value, String> {
            entities
                .get(&(kind.to_owned(), key.to_owned()))
                .filter(|(owner, _)| allowed.contains(owner))
                .map(|(_, entity)| *entity)
                .ok_or("Missing commerce dependency".into())
        };
        if let Some(content) = config.get("commerce") {
            for booster in content["boosters"].as_array().unwrap() {
                if sets
                    .get(booster["setId"].as_str().unwrap())
                    .is_none_or(|owner| !allowed.contains(owner))
                {
                    return Err("Missing commerce set".into());
                }
            }
            for shop in content["shops"].as_array().unwrap() {
                get("economies", shop["economyId"].as_str().unwrap())?;
                for offer in shop["offers"].as_array().unwrap() {
                    get("boosters", offer["boosterId"].as_str().unwrap())?;
                }
            }
        }
        if let Some(shop_id) = config.get("shopId") {
            let shop = get("shops", shop_id.as_str().ok_or("Invalid shop ID")?)?;
            for offer in shop["offers"].as_array().unwrap() {
                let booster = get("boosters", offer["boosterId"].as_str().unwrap())?;
                if !config["setIds"]
                    .as_array()
                    .is_some_and(|ids| ids.contains(&booster["setId"]))
                {
                    return Err("Shop set outside chapter".into());
                }
            }
        }
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    fn content() -> Value {
        json!({"schemaVersion":1,"economies":[{"id":"base","sellPrices":{"common":1,"rare":2,"super-rare":5,"ultra-rare":20,"secret-rare":50,"ultimate-rare":50,"ghost-rare":50},"singlesMultiplier":4,"maxPackResale":21}],"boosters":[{"id":"pack","name":"Pack","setId":"set-a","replacement":"with","slots":[{"count":3,"rarities":[{"rarity":"common","weight":2}],"fallback":"all"}]}],"shops":[{"id":"shop","economyId":"base","singles":false,"offers":[{"boosterId":"pack","priceDp":0,"enabled":true,"requiresProgress":[]}]}]})
    }
    #[test]
    fn bounds_and_supported_draw_vocabulary_are_enforced() {
        let base = content();
        assert!(valid_content(&base));
        for (pointer, replacement) in [
            ("/boosters/0/slots/0/count", json!(101)),
            ("/boosters/0/slots/0/rarities/0/weight", json!(0)),
            ("/boosters/0/replacement", json!("without")),
            ("/shops/0/offers/0/priceDp", json!(-1)),
            ("/economies/0/singlesMultiplier", json!(1001)),
        ] {
            let mut candidate = base.clone();
            *candidate.pointer_mut(pointer).unwrap() = replacement;
            assert!(!valid_content(&candidate), "{pointer}");
        }
        let mut unknown = base;
        unknown["boosters"][0]["unknown"] = json!(true);
        assert!(!valid_content(&unknown));
    }
    #[test]
    fn composition_requires_declared_dependency_and_selected_chapter_sets() {
        let mut configs = HashMap::from([
            ("card-library".into(), json!({"commerce":content()})),
            (
                "chapter-01".into(),
                json!({"shopId":"shop","setIds":["set-a"]}),
            ),
        ]);
        let mut headers = HashMap::from([
            ("card-library".into(), json!({"dependencies":[]})),
            (
                "chapter-01".into(),
                json!({"dependencies":[{"packageId":"card-library"}]}),
            ),
        ]);
        let sets = HashMap::from([("set-a".into(), "card-library".into())]);
        assert!(validate_stack(&configs, &headers, &sets).is_ok());
        headers.get_mut("chapter-01").unwrap()["dependencies"] = json!([]);
        assert!(validate_stack(&configs, &headers, &sets).is_err());
        headers.get_mut("chapter-01").unwrap()["dependencies"] =
            json!([{"packageId":"card-library"}]);
        configs.get_mut("chapter-01").unwrap()["setIds"] = json!([]);
        assert_eq!(
            validate_stack(&configs, &headers, &sets).unwrap_err(),
            "Shop set outside chapter"
        );
        configs.insert("addon".into(), json!({"commerce":content()}));
        headers.insert("addon".into(), json!({"dependencies":[]}));
        assert_eq!(
            validate_stack(&configs, &headers, &sets).unwrap_err(),
            "Commerce identity conflict"
        );
    }
    #[test]
    fn installed_sibling_policy_requires_declared_dependency() {
        let base = content();
        let mut sibling = base.clone();
        sibling["economies"][0]["id"] = json!("sibling-policy");
        sibling["boosters"] = json!([]);
        sibling["shops"] = json!([]);
        let mut addon = base.clone();
        addon["economies"] = json!([]);
        addon["boosters"] = json!([]);
        addon["shops"][0]["id"] = json!("addon-shop");
        addon["shops"][0]["economyId"] = json!("sibling-policy");
        let configs = HashMap::from([
            ("base".into(), json!({"commerce":base})),
            ("policy".into(), json!({"commerce":sibling})),
            ("addon".into(), json!({"commerce":addon})),
        ]);
        let mut headers = HashMap::from([
            ("base".into(), json!({"dependencies":[]})),
            (
                "policy".into(),
                json!({"dependencies":[{"packageId":"base"}]}),
            ),
            (
                "addon".into(),
                json!({"dependencies":[{"packageId":"base"}]}),
            ),
        ]);
        let sets = HashMap::from([("set-a".into(), "base".into())]);
        assert!(validate_stack(&configs, &headers, &sets).is_err());
        headers.get_mut("addon").unwrap()["dependencies"] =
            json!([{"packageId":"base"},{"packageId":"policy"}]);
        assert!(validate_stack(&configs, &headers, &sets).is_ok());
    }
}
