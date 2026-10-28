// Pet instances: creation, validated updates and restore from saved state.
use crate::i18n;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

pub const LIMIT: usize = 12;
/// The longest personality a friend keeps.
pub const PERSONA_MAX: usize = 400;

/// How a friend is drawn: its pet file's own sheet, or the realistic one the file may also ship.
/// Saved and sent to the page as "illustrated" / "realistic".
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VisualStyle {
    #[default]
    Illustrated,
    Realistic,
}

impl VisualStyle {
    /// The style a JSON value names, if it names one.
    pub fn from_value(value: &Value) -> Option<Self> {
        Self::deserialize(value).ok()
    }
}

#[derive(Clone, Copy, Debug, Serialize)]
pub struct Pos {
    pub x: i64,
    pub y: i64,
}

#[derive(Clone, Debug, Serialize)]
pub struct Pet {
    pub id: String,
    #[serde(rename = "assetId")]
    pub asset_id: String,
    pub name: String,
    #[serde(rename = "visualStyle")]
    pub visual_style: VisualStyle,
    pub size: f64,
    pub x: f64,
    pub y: f64,
    #[serde(rename = "providerId")]
    pub provider_id: String,
    pub persona: String,
    /// Who wrote the persona: "owner" (typed in the settings), "chat" (the friend described
    /// itself when the owner asked in a conversation), or "" (still the pet file's introduction).
    #[serde(rename = "personaFrom")]
    pub persona_from: String,
    /// How this friend relates to its owner: "" (a friend), or one of RELATIONS.
    pub relation: String,
    /// What this friend calls its owner, if the owner said.
    #[serde(rename = "callMe")]
    pub call_me: String,
    #[serde(rename = "desktopPosition")]
    pub desktop_position: Option<Pos>,
}

/// The relationships a friend can have with its owner besides being a friend. What each one
/// means for the prompt is in chat/prompt.rs (RELATION_PRESETS, tested to match this list).
pub const RELATIONS: [&str; 3] = ["partner", "senior", "junior"];
/// Where a persona can come from, besides the pet file ("").
pub const PERSONA_SOURCES: [&str; 2] = ["owner", "chat"];

/// Fields a patch or a saved state may set: numbers with their range, texts with their length.
const NUMBER_RANGES: [(&str, f64, f64); 3] = [("size", 64.0, 192.0), ("x", 0.0, 1.0), ("y", 0.0, 1.0)];
const TEXT_LIMITS: [(&str, usize); 6] = [
    ("name", 24),
    ("providerId", 80),
    ("persona", PERSONA_MAX),
    ("personaFrom", 8),
    ("relation", 12),
    ("callMe", 24),
];

fn set_number(pet: &mut Pet, key: &str, value: f64, (min, max): (f64, f64)) {
    let value = value.clamp(min, max);
    match key {
        "size" => pet.size = value,
        "x" => pet.x = value,
        _ => pet.y = value,
    }
}

fn set_text(pet: &mut Pet, key: &str, value: &str, cap: usize) {
    let value: String = value.chars().take(cap).collect();
    match key {
        "name" => pet.name = value,
        "persona" => pet.persona = value,
        "personaFrom" => {
            pet.persona_from = if PERSONA_SOURCES.contains(&value.as_str()) {
                value
            } else {
                String::new()
            }
        }
        // An unknown relationship falls back to being a friend.
        "relation" => {
            pet.relation = if RELATIONS.contains(&value.as_str()) {
                value
            } else {
                String::new()
            }
        }
        "callMe" => pet.call_me = value,
        _ => pet.provider_id = value,
    }
}

pub fn create_pet(asset_id: &str, pets: &[Pet]) -> Result<Pet, String> {
    if pets.len() >= LIMIT {
        return Err(i18n::tr("error.pets_limit", &[("limit", &LIMIT.to_string())]));
    }
    if asset_id.is_empty() {
        return Err(i18n::t("error.pet_unselected"));
    }
    let n = pets.len() as f64;
    Ok(Pet {
        id: Uuid::new_v4().to_string(),
        asset_id: asset_id.into(),
        name: String::new(),
        visual_style: VisualStyle::Illustrated,
        size: 112.0,
        x: 0.18 + (pets.len() % 4) as f64 * 0.2,
        y: 0.3 + (n / 4.0).floor() * 0.22,
        provider_id: String::new(),
        persona: String::new(),
        persona_from: String::new(),
        relation: String::new(),
        call_me: String::new(),
        desktop_position: None,
    })
}

pub fn create_pet_with_options(asset_id: &str, pets: &[Pet], options: &Value) -> Result<Pet, String> {
    let mut pet = create_pet(asset_id, pets)?;
    if options.is_null() {
        return Ok(pet);
    }
    let obj = options.as_object().ok_or_else(|| i18n::t("error.bad_settings"))?;
    // Creation accepts only fields that need no provider or conversation side effects.
    if obj.keys().any(|key| key != "name" && key != "visualStyle") {
        return Err(i18n::t("error.bad_settings"));
    }
    let id = pet.id.clone();
    update_pet(std::slice::from_mut(&mut pet), &id, options)?;
    Ok(pet)
}

pub fn update_pet(pets: &mut [Pet], id: &str, patch: &Value) -> Result<(), String> {
    let pet = pets
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| i18n::t("error.friend_missing"))?;
    let obj = patch.as_object().ok_or_else(|| i18n::t("error.bad_settings"))?;
    let visual_style = obj
        .get("visualStyle")
        .map(|value| VisualStyle::from_value(value).ok_or_else(|| i18n::t("error.bad_settings")))
        .transpose()?;
    // Every field is checked before any is set: a patch with one wrong field changes nothing.
    let mut numbers = Vec::new();
    for (key, min, max) in NUMBER_RANGES {
        if let Some(v) = obj.get(key) {
            let n = v
                .as_f64()
                .filter(|n| n.is_finite())
                .ok_or_else(|| i18n::t("error.number_expected"))?;
            numbers.push((key, n, (min, max)));
        }
    }
    let mut texts = Vec::new();
    for (key, cap) in TEXT_LIMITS {
        if let Some(v) = obj.get(key) {
            let s = v.as_str().ok_or_else(|| i18n::t("error.text_expected"))?;
            texts.push((key, s.trim(), cap));
        }
    }
    if let Some(style) = visual_style {
        pet.visual_style = style;
    }
    for (key, n, range) in numbers {
        set_number(pet, key, n, range);
    }
    for (key, s, cap) in texts {
        set_text(pet, key, s, cap);
    }
    // A persona written through the settings is the owner's own words; cleared, the pet file's
    // introduction speaks again.
    if obj.contains_key("persona") && !obj.contains_key("personaFrom") {
        pet.persona_from = if pet.persona.is_empty() {
            String::new()
        } else {
            "owner".into()
        };
    }
    Ok(())
}

/// Unlike a patch, a saved state is never refused: whatever in it is unusable is left out.
pub fn restore_pets(raw: &Value, asset_ids: &[String]) -> Vec<Pet> {
    let mut pets: Vec<Pet> = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for p in raw.get("pets").and_then(|v| v.as_array()).cloned().unwrap_or_default() {
        let id = p.get("id").and_then(|v| v.as_str()).unwrap_or("");
        let asset = p.get("assetId").and_then(|v| v.as_str()).unwrap_or("");
        if id.is_empty() || id.len() > 80 || seen.contains(id) || !asset_ids.iter().any(|a| a == asset) {
            continue;
        }
        if pets.len() == LIMIT {
            break;
        }
        seen.insert(id.to_string());
        let Ok(mut pet) = create_pet(asset, &pets) else {
            break;
        };
        pet.id = id.into();
        // An unknown or missing style is drawn the pet file's own way rather than losing the friend.
        pet.visual_style = p
            .get("visualStyle")
            .and_then(VisualStyle::from_value)
            .unwrap_or_default();
        for (key, min, max) in NUMBER_RANGES {
            if let Some(n) = p.get(key).and_then(|v| v.as_f64()).filter(|n| n.is_finite()) {
                set_number(&mut pet, key, n, (min, max));
            }
        }
        for (key, cap) in TEXT_LIMITS {
            if let Some(s) = p.get(key).and_then(|v| v.as_str()) {
                set_text(&mut pet, key, s, cap);
            }
        }
        if let (Some(x), Some(y)) = (
            p.pointer("/desktopPosition/x")
                .and_then(|v| v.as_f64())
                .filter(|n| n.is_finite()),
            p.pointer("/desktopPosition/y")
                .and_then(|v| v.as_f64())
                .filter(|n| n.is_finite()),
        ) {
            pet.desktop_position = Some(Pos {
                x: x.round() as i64,
                y: y.round() as i64,
            });
        }
        pets.push(pet);
    }
    pets
}

/// The saved friends `restore_pets` could not bring back (their pet file was not found this time,
/// a folder unplugged or moved, or there were more than the limit), kept as they were so that a
/// later start that finds the file has them again, with their bond, instead of losing them.
/// Only records that could become a friend again are kept (an id and a pet file named), and at
/// most twice the yard's limit, so the list cannot grow without end.
pub fn parked_pets(raw: &Value, kept: &[Pet]) -> Vec<Value> {
    let mut seen: std::collections::HashSet<String> = kept.iter().map(|p| p.id.clone()).collect();
    raw.get("pets")
        .and_then(|v| v.as_array())
        .into_iter()
        .flatten()
        .filter(|p| {
            let id = p.get("id").and_then(|v| v.as_str()).unwrap_or("");
            let asset = p.get("assetId").and_then(|v| v.as_str()).unwrap_or("");
            !id.is_empty() && id.len() <= 80 && !asset.is_empty() && seen.insert(id.to_string())
        })
        .take(LIMIT * 2)
        .cloned()
        .collect()
}

/// The name of a friend kept for later that still needs the pet file `asset_id` (`fallback`, the
/// file's own name, when it has none of its own).
pub fn parked_user(parked: &[Value], asset_id: &str, fallback: &str) -> Option<String> {
    let pet = parked.iter().find(|p| p["assetId"] == asset_id)?;
    let name = pet.get("name").and_then(|v| v.as_str()).map(str::trim).unwrap_or("");
    Some(if name.is_empty() { fallback } else { name }.chars().take(40).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn invitation_options_are_validated_before_a_friend_can_be_added() {
        let existing = vec![create_pet("same", &[]).unwrap()];
        let chosen =
            create_pet_with_options("same", &existing, &json!({"name":" Aria 2 ","visualStyle":"realistic"})).unwrap();
        assert_eq!(chosen.name, "Aria 2");
        assert_eq!(chosen.visual_style, VisualStyle::Realistic);
        assert_eq!(existing.len(), 1);
        assert_eq!(existing[0].visual_style, VisualStyle::Illustrated);
        assert_eq!(
            create_pet_with_options("same", &existing, &Value::Null)
                .unwrap()
                .visual_style,
            VisualStyle::Illustrated
        );
        for invalid in [
            json!({"visualStyle":"unknown"}),
            json!({"name":12}),
            json!({"providerId":"unchecked"}),
            json!([]),
        ] {
            assert!(create_pet_with_options("same", &existing, &invalid).is_err());
            assert_eq!(existing.len(), 1);
        }
    }

    #[test]
    fn visual_style_is_per_pet_validated_and_restored_with_legacy_default() {
        let a = create_pet("same", &[]).unwrap();
        let b = create_pet("same", std::slice::from_ref(&a)).unwrap();
        let mut pets = vec![a.clone(), b];
        assert_eq!(pets[0].visual_style, VisualStyle::Illustrated);
        update_pet(&mut pets, &a.id, &json!({"visualStyle":"realistic"})).unwrap();
        assert_eq!(pets[0].visual_style, VisualStyle::Realistic);
        assert_eq!(pets[1].visual_style, VisualStyle::Illustrated);
        for invalid in [json!("unknown"), json!(12), json!(null)] {
            assert!(update_pet(&mut pets, &a.id, &json!({"size":180,"visualStyle":invalid})).is_err());
            assert_eq!(pets[0].size, a.size, "invalid style rejects the whole patch");
            assert_eq!(pets[0].visual_style, VisualStyle::Realistic);
        }
        let saved = json!({"pets":pets});
        let restored = restore_pets(&saved, &["same".into()]);
        assert_eq!(restored[0].visual_style, VisualStyle::Realistic);
        for style in [None, Some(json!("unknown")), Some(json!(false))] {
            let mut legacy = json!({"pets":[{"id":"old","assetId":"same"}]});
            if let Some(style) = style {
                legacy["pets"][0]["visualStyle"] = style;
            }
            assert_eq!(
                restore_pets(&legacy, &["same".into()])[0].visual_style,
                VisualStyle::Illustrated
            );
        }
    }

    #[test]
    fn the_saved_style_keeps_its_words_and_an_unknown_one_keeps_the_friend() {
        let mut pet = create_pet("same", &[]).unwrap();
        assert_eq!(serde_json::to_value(&pet).unwrap()["visualStyle"], "illustrated");
        pet.visual_style = VisualStyle::Realistic;
        assert_eq!(serde_json::to_value(&pet).unwrap()["visualStyle"], "realistic");
        // The page and older saves spell it exactly so; any other spelling is not a style.
        for unknown in ["Realistic", "photo", ""] {
            let saved = json!({"pets":[{"id":"old","assetId":"same","name":"Mochi","visualStyle":unknown}]});
            let restored = restore_pets(&saved, &["same".into()]);
            assert_eq!(restored.len(), 1, "{unknown:?} keeps the friend");
            assert_eq!(
                (restored[0].name.as_str(), restored[0].visual_style),
                ("Mochi", VisualStyle::Illustrated)
            );
            let mut pets = restored;
            assert_eq!(
                update_pet(&mut pets, "old", &json!({"visualStyle":unknown})),
                Err(i18n::t("error.bad_settings"))
            );
        }
    }

    #[test]
    fn same_character_creates_independent_pets_and_updates_clamp() {
        let a = create_pet("white", &[]).unwrap();
        let b = create_pet("white", std::slice::from_ref(&a)).unwrap();
        assert_ne!(a.id, b.id);
        assert_eq!(a.asset_id, b.asset_id);
        let mut pets = vec![a.clone(), b.clone()];
        update_pet(&mut pets, &a.id, &json!({"size": 160, "x": 2, "y": -2})).unwrap();
        assert_eq!(pets[0].size, 160.0);
        assert_eq!(pets[1].size, b.size);
        assert_eq!((pets[0].x, pets[0].y), (1.0, 0.0));
        assert!(update_pet(&mut pets, &a.id, &json!({"size": "NaN"})).is_err());
        let full: Vec<Pet> = (0..12).map(|_| a.clone()).collect();
        assert!(create_pet("white", &full).unwrap_err().contains("12"));
    }

    #[test]
    fn restore_removes_unknown_assets_duplicates_and_invalid_fields() {
        let raw = json!({"pets": [
            {"id": "a", "assetId": "white", "size": 999, "x": "NaN", "y": 0.4},
            {"id": "a", "assetId": "white"},
            {"id": "b", "assetId": "missing"},
        ]});
        let pets = restore_pets(&raw, &["white".into()]);
        assert_eq!(pets.len(), 1);
        assert_eq!(pets[0].size, 192.0);
        assert!(pets[0].x.is_finite());
    }

    #[test]
    fn relationship_is_one_of_the_known_ones_and_the_address_is_kept() {
        let a = create_pet("cat", &[]).unwrap();
        let mut pets = vec![a.clone()];
        update_pet(&mut pets, &a.id, &json!({"relation": "partner", "callMe": " 자기 "})).unwrap();
        assert_eq!(
            (pets[0].relation.as_str(), pets[0].call_me.as_str()),
            ("partner", "자기")
        );
        update_pet(&mut pets, &a.id, &json!({"relation": "overlord"})).unwrap();
        assert_eq!(pets[0].relation, "");
        let restored = restore_pets(
            &json!({"pets": [{"id": "x", "assetId": "cat", "relation": "senior", "callMe": "선배"}]}),
            &["cat".into()],
        );
        assert_eq!(
            (restored[0].relation.as_str(), restored[0].call_me.as_str()),
            ("senior", "선배")
        );
    }

    #[test]
    fn a_persona_remembers_who_wrote_it() {
        let mut pets = vec![create_pet("cat", &[]).unwrap()];
        let id = pets[0].id.clone();
        assert_eq!(pets[0].persona_from, "", "a new friend has the pet file's introduction");
        update_pet(&mut pets, &id, &json!({"persona": "Grumpy."})).unwrap();
        assert_eq!(pets[0].persona_from, "owner");
        update_pet(&mut pets, &id, &json!({"persona": "Soft.", "personaFrom": "chat"})).unwrap();
        assert_eq!(pets[0].persona_from, "chat");
        update_pet(&mut pets, &id, &json!({"personaFrom": "alien"})).unwrap();
        assert_eq!(pets[0].persona_from, "", "an unknown source counts as the pet file's");
        update_pet(&mut pets, &id, &json!({"persona": "Mine."})).unwrap();
        update_pet(&mut pets, &id, &json!({"persona": ""})).unwrap();
        assert_eq!(pets[0].persona_from, "", "cleared, the introduction speaks again");
        let restored = restore_pets(
            &json!({"pets": [{"id": "x", "assetId": "cat", "persona": "Soft.", "personaFrom": "chat"}]}),
            &["cat".to_string()],
        );
        assert_eq!(restored[0].persona_from, "chat", "a saved source is kept as it was");
    }

    #[test]
    fn persona_is_trimmed_capped_and_restored() {
        let a = create_pet("cat", &[]).unwrap();
        assert_eq!(a.persona, "");
        let mut pets = vec![a.clone()];
        update_pet(&mut pets, &a.id, &json!({"persona": "  츤데레지만 칭찬에 약해요.  "})).unwrap();
        assert_eq!(pets[0].persona, "츤데레지만 칭찬에 약해요.");
        update_pet(&mut pets, &a.id, &json!({"persona": "가".repeat(500)})).unwrap();
        assert_eq!(pets[0].persona.chars().count(), 400);
        assert!(update_pet(&mut pets, &a.id, &json!({"persona": 42})).is_err());
        let restored = restore_pets(
            &json!({"pets": [{"id": "x", "assetId": "cat", "persona": "나".repeat(999)}, {"id": "y", "assetId": "cat", "persona": 7}]}),
            &["cat".into()],
        );
        assert_eq!(restored[0].persona.chars().count(), 400);
        assert_eq!(restored[1].persona, "");
    }

    #[test]
    fn a_friend_whose_pet_file_is_missing_is_parked_not_lost() {
        let raw = json!({"pets": [
            {"id": "here", "assetId": "white"},
            {"id": "away", "assetId": "unplugged", "name": "Mochi"},
            {"id": "away", "assetId": "unplugged"},
            {"id": "", "assetId": "white"},
            {"id": "no-file"}
        ]});
        let pets = restore_pets(&raw, &["white".into()]);
        let parked = parked_pets(&raw, &pets);
        assert_eq!(pets.len(), 1);
        assert_eq!(parked.len(), 1);
        assert_eq!(parked[0]["name"], "Mochi");
        // Its pet file cannot leave the shelf while it waits, and the person is told who waits.
        assert_eq!(parked_user(&parked, "unplugged", "Fallback"), Some("Mochi".to_string()));
        let unnamed = vec![json!({"id": "x", "assetId": "white"})];
        assert_eq!(parked_user(&unnamed, "white", "Snow"), Some("Snow".to_string()));
        assert_eq!(parked_user(&parked, "white", "Snow"), None);
    }

    #[test]
    fn a_patch_with_one_wrong_field_changes_nothing() {
        let mut pets = vec![create_pet("cat", &[]).unwrap()];
        let id = pets[0].id.clone();
        assert!(update_pet(&mut pets, &id, &json!({"size": 150, "persona": 5})).is_err());
        assert_eq!(pets[0].size, 112.0);
    }
}
