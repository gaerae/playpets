//! Ground snapshots, one-time discoveries and scene-owned trees.
use super::{
    album::{Album, Entry, KINDS_MAX},
    content::{DiscoveryContext, catalog},
    garden::{Garden, SAPLING_MAX, SEED_MAX},
};
use crate::i18n;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

pub const TREE_MAX: usize = 24;
pub const TREE_WORLD_MAX: usize = 6;
pub const TREE_YOUNG_MS: u64 = 2 * 60 * 60 * 1000;
pub const TREE_MATURE_MS: u64 = 12 * 60 * 60 * 1000;
pub const DIG_COOLDOWN_MS: u64 = 8000;
pub const DIG_TTL_MS: u64 = 24 * 60 * 60 * 1000;
pub const DIG_HISTORY: usize = 4096;
pub const DIG_ODDS: [u8; 5] = [30, 25, 20, 22, 3];

#[derive(Deserialize, Clone)]
pub struct GroundProfile {
    pub soil: bool,
    pub bounds: Bounds,
    pub water: Vec<Ellipse>,
    pub obstacles: Vec<Ellipse>,
}
#[derive(Deserialize, Clone)]
pub struct Bounds {
    pub left: f64,
    pub top: f64,
    pub right: f64,
    pub bottom: f64,
}
#[derive(Deserialize, Clone)]
pub struct Ellipse {
    pub x: f64,
    pub y: f64,
    pub rx: f64,
    pub ry: f64,
}
fn coordinate(value: f64) -> bool {
    value.is_finite() && (0.0..=1.0).contains(&value)
}
fn identifier(value: &str) -> bool {
    !value.is_empty() && value.len() <= 256 && !value.chars().any(char::is_control)
}
pub(super) fn kind_id(value: &str) -> bool {
    (1..=24).contains(&value.len()) && value.bytes().all(|b| b.is_ascii_lowercase() || b == b'_')
}
fn bad_request() -> String {
    i18n::t("error.bad_request")
}

impl GroundProfile {
    pub fn validate(&self, x: f64, y: f64) -> Result<(), String> {
        let b = &self.bounds;
        let exclusions = self.water.iter().chain(&self.obstacles);
        let valid = self.soil
            && coordinate(x)
            && coordinate(y)
            && [b.left, b.top, b.right, b.bottom].into_iter().all(coordinate)
            && b.left < b.right
            && b.top < b.bottom
            && x >= b.left
            && x <= b.right
            && y >= b.top
            && y <= b.bottom
            && self.water.len() + self.obstacles.len() <= 64
            && exclusions.clone().all(|e| {
                [e.x, e.y]
                    .into_iter()
                    .all(|v| v.is_finite() && (-4.0..=4.0).contains(&v))
                    && [e.rx, e.ry].into_iter().all(|v| v.is_finite() && v > 0.0 && v <= 4.0)
            })
            && exclusions
                .clone()
                .all(|e| ((x - e.x) / e.rx).powi(2) + ((y - e.y) / e.ry).powi(2) > 1.0);
        if valid {
            Ok(())
        } else {
            Err(i18n::t("error.discovery_ground"))
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Tree {
    pub id: String,
    pub world: String,
    pub kind: String,
    pub x: f64,
    pub y: f64,
    pub planted: u64,
    pub stage: u8,
    #[serde(default)]
    pub matured: bool,
}
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DigResult {
    pub attempt_id: String,
    pub outcome: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub repeated: bool,
}
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DigAttempt {
    #[serde(flatten)]
    pub result: DigResult,
    pub pet_id: String,
    pub world: String,
    pub tile_x: u8,
    pub tile_y: u8,
    pub at: u64,
}

pub fn restore_trees(raw: Option<&Value>) -> Vec<Tree> {
    raw.and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|v| serde_json::from_value::<Tree>(v.clone()).ok())
        .filter(|t| {
            identifier(&t.id)
                && identifier(&t.world)
                && kind_id(&t.kind)
                && coordinate(t.x)
                && coordinate(t.y)
                && t.stage <= 2
        })
        .take(TREE_MAX)
        .collect()
}
pub fn restore_digs(raw: Option<&Value>, now: u64) -> Vec<DigAttempt> {
    raw.and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|v| serde_json::from_value::<DigAttempt>(v.clone()).ok())
        .filter(|d| {
            identifier(&d.result.attempt_id)
                && identifier(&d.pet_id)
                && identifier(&d.world)
                && d.tile_x <= 8
                && d.tile_y <= 8
                && now.saturating_sub(d.at) < DIG_TTL_MS
                && matches!(
                    d.result.outcome.as_str(),
                    "empty" | "seed" | "sapling" | "full" | "keepsake"
                )
                && (!matches!(d.result.outcome.as_str(), "keepsake" | "sapling")
                    || d.result.kind.as_deref().is_some_and(kind_id))
        })
        .map(|mut d| {
            d.at = d.at.min(now);
            d
        })
        .take(DIG_HISTORY)
        .collect()
}

// A corrected clock keeps the patch's reward memory without a future-dated break; old digs go.
fn forget_old_digs(garden: &mut Garden, now: u64) {
    for attempt in &mut garden.digs {
        attempt.at = attempt.at.min(now);
    }
    garden.digs.retain(|d| now.saturating_sub(d.at) < DIG_TTL_MS);
}

// What a dig turns up for `roll` (0 to 99, in the bands of DIG_ODDS): nothing, a seed, a sapling
// or a keepsake, "full" when there is no room for a seed or that sapling. An uncommon keepsake
// comes only while none is among the remembered digs.
fn roll_outcome(
    garden: &Garden,
    roll: u8,
    choice: u64,
    context: Option<&DiscoveryContext>,
    world: &str,
) -> Result<(&'static str, Option<String>), String> {
    if roll < DIG_ODDS[0] {
        return Ok(("empty", None));
    }
    if roll < DIG_ODDS[0] + DIG_ODDS[1] {
        return Ok((if garden.seeds >= SEED_MAX { "full" } else { "seed" }, None));
    }
    if roll < DIG_ODDS[0] + DIG_ODDS[1] + DIG_ODDS[2] {
        let kind = catalog()
            .tree(choice, context, world)
            .ok_or_else(bad_request)?
            .to_owned();
        let full = garden.saplings.get(&kind).copied().unwrap_or(0) >= SAPLING_MAX;
        if !garden.saplings.contains_key(&kind) && garden.saplings.len() >= KINDS_MAX {
            return Err(bad_request());
        }
        return Ok((if full { "full" } else { "sapling" }, Some(kind)));
    }
    let uncommon_found = garden.digs.iter().any(|attempt| {
        attempt.result.outcome == "keepsake"
            && attempt
                .result
                .kind
                .as_deref()
                .is_some_and(|kind| catalog().is_uncommon_treasure(kind))
    });
    let rarity = if roll < DIG_ODDS[0] + DIG_ODDS[1] + DIG_ODDS[2] + DIG_ODDS[3] || uncommon_found {
        "common"
    } else {
        "uncommon"
    };
    let kind = catalog()
        .treasure(rarity, choice, context, world)
        .ok_or_else(bad_request)?
        .to_owned();
    Ok(("keepsake", Some(kind)))
}

// Puts what was found away: a keepsake in the album, a seed or a sapling in the garden.
fn keep_reward(
    garden: &mut Garden,
    album: &mut Album,
    outcome: &str,
    kind: Option<&str>,
    now: u64,
) -> Result<(), String> {
    match outcome {
        "keepsake" => {
            let kind = kind.ok_or_else(bad_request)?;
            if !album.treasures.contains_key(kind) && album.treasures.len() >= KINDS_MAX {
                return Err(bad_request());
            }
            let entry = album.treasures.entry(kind.to_owned()).or_insert(Entry {
                count: 0,
                best: 0.0,
                first: now,
            });
            entry.count = entry.count.saturating_add(1);
        }
        "seed" => garden.seeds += 1,
        "sapling" => {
            *garden
                .saplings
                .entry(kind.ok_or_else(bad_request)?.to_owned())
                .or_default() += 1
        }
        _ => {}
    }
    Ok(())
}

/// The caller validates the friend under the same state lock before committing this result.
#[allow(clippy::too_many_arguments)]
pub fn dig(
    garden: &mut Garden,
    album: &mut Album,
    pet_id: &str,
    world: &str,
    x: f64,
    y: f64,
    ground: &GroundProfile,
    now: u64,
    roll: u8,
    choice: u64,
    context: Option<&DiscoveryContext>,
) -> Result<DigResult, String> {
    if context.is_some_and(|context| !context.valid()) {
        return Err(bad_request());
    }
    ground.validate(x, y)?;
    if !identifier(pet_id) || !identifier(world) || roll >= 100 {
        return Err(bad_request());
    }
    forget_old_digs(garden, now);
    let (tile_x, tile_y) = ((x * 8.0).floor() as u8, (y * 8.0).floor() as u8);
    if let Some(attempt) = garden
        .digs
        .iter()
        .find(|d| d.world == world && d.tile_x == tile_x && d.tile_y == tile_y && now.saturating_sub(d.at) < DIG_TTL_MS)
    {
        return Ok(DigResult {
            repeated: true,
            ..attempt.result.clone()
        });
    }
    if garden
        .digs
        .iter()
        .any(|d| d.pet_id == pet_id && (now < d.at || now - d.at < DIG_COOLDOWN_MS))
    {
        return Err(i18n::t("error.discovery_cooldown"));
    }
    if garden.digs.len() >= DIG_HISTORY {
        return Err(i18n::t("error.discovery_daily_limit"));
    }
    let (outcome, kind) = roll_outcome(garden, roll, choice, context, world)?;
    keep_reward(garden, album, outcome, kind.as_deref(), now)?;
    let result = DigResult {
        attempt_id: Uuid::new_v4().to_string(),
        outcome: outcome.into(),
        kind,
        repeated: false,
    };
    garden.digs.push(DigAttempt {
        result: result.clone(),
        pet_id: pet_id.into(),
        world: world.into(),
        tile_x,
        tile_y,
        at: now,
    });
    Ok(result)
}

pub fn plant_tree(
    garden: &mut Garden,
    world: &str,
    kind: &str,
    x: f64,
    y: f64,
    ground: &GroundProfile,
    now: u64,
) -> Result<Tree, String> {
    ground.validate(x, y)?;
    if !identifier(world) || !catalog().is_tree(kind) {
        return Err(bad_request());
    }
    if garden.trees.len() >= TREE_MAX || garden.trees.iter().filter(|t| t.world == world).count() >= TREE_WORLD_MAX {
        return Err(i18n::t("error.tree_full"));
    }
    let stock = garden
        .saplings
        .get_mut(kind)
        .filter(|count| **count > 0)
        .ok_or_else(|| i18n::t("error.no_saplings"))?;
    *stock -= 1;
    let tree = Tree {
        id: Uuid::new_v4().to_string(),
        world: world.into(),
        kind: kind.into(),
        x,
        y,
        planted: now,
        stage: 0,
        matured: false,
    };
    garden.trees.push(tree.clone());
    Ok(tree)
}
pub fn move_tree(garden: &mut Garden, id: &str, x: f64, y: f64, ground: &GroundProfile) -> Result<(), String> {
    ground.validate(x, y)?;
    let tree = garden
        .trees
        .iter_mut()
        .find(|t| t.id == id)
        .ok_or_else(|| i18n::t("error.tree_missing"))?;
    (tree.x, tree.y) = (x, y);
    Ok(())
}
pub fn remove_tree(garden: &mut Garden, id: &str) -> Result<(), String> {
    let index = garden
        .trees
        .iter()
        .position(|t| t.id == id)
        .ok_or_else(|| i18n::t("error.tree_missing"))?;
    garden.trees.remove(index);
    Ok(())
}
pub fn grow_trees(garden: &mut Garden, album: &mut Album, now: u64) -> bool {
    let mut changed = false;
    for tree in &mut garden.trees {
        let age = now.saturating_sub(tree.planted);
        let stage = if age >= TREE_MATURE_MS {
            2
        } else if age >= TREE_YOUNG_MS {
            1
        } else {
            0
        };
        if stage > tree.stage {
            tree.stage = stage;
            changed = true;
        }
        if tree.stage == 2 && !tree.matured {
            // An unknown future species keeps its progress but does not create a new album kind.
            if catalog().is_tree(&tree.kind) && (album.trees.contains_key(&tree.kind) || album.trees.len() < KINDS_MAX)
            {
                album.trees.entry(tree.kind.clone()).or_insert(Entry {
                    count: 1,
                    best: 0.0,
                    first: now,
                });
                tree.matured = true;
                changed = true;
            }
        }
    }
    changed
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn ground() -> GroundProfile {
        serde_json::from_value(
            json!({"soil":true,"bounds":{"left":0.0,"top":0.0,"right":1.0,"bottom":1.0},"water":[],"obstacles":[]}),
        )
        .unwrap()
    }

    #[allow(clippy::too_many_arguments)]
    fn dig(
        garden: &mut Garden,
        album: &mut Album,
        pet_id: &str,
        world: &str,
        x: f64,
        y: f64,
        ground: &GroundProfile,
        now: u64,
        roll: u8,
        choice: u64,
    ) -> Result<DigResult, String> {
        super::dig(garden, album, pet_id, world, x, y, ground, now, roll, choice, None)
    }

    #[test]
    fn a_full_album_or_sapling_shelf_refuses_a_new_kind_and_keeps_nothing() {
        let keepsake = DIG_ODDS[0] + DIG_ODDS[1] + DIG_ODDS[2];
        let mut garden = Garden::default();
        let mut album = Album::default();
        for i in 0..KINDS_MAX {
            album.treasures.insert(
                format!("old{i}"),
                Entry {
                    count: 1,
                    best: 0.0,
                    first: 0,
                },
            );
        }
        let before = album.clone();
        assert!(
            dig(
                &mut garden,
                &mut album,
                "friend",
                "woodland",
                0.5,
                0.5,
                &ground(),
                10_000,
                keepsake,
                0
            )
            .is_err()
        );
        assert_eq!(album, before);
        assert!(garden.digs.is_empty());

        let sapling = DIG_ODDS[0] + DIG_ODDS[1];
        let mut garden = Garden::default();
        let mut album = Album::default();
        for i in 0..KINDS_MAX {
            garden.saplings.insert(format!("old{i}"), 1);
        }
        assert!(
            dig(
                &mut garden,
                &mut album,
                "friend",
                "woodland",
                0.5,
                0.5,
                &ground(),
                10_000,
                sapling,
                0
            )
            .is_err()
        );
        assert_eq!(garden.saplings.len(), KINDS_MAX);
        assert!(garden.digs.is_empty());
        assert!(album.treasures.is_empty());
    }

    #[test]
    fn environmental_context_changes_never_reroll_saved_or_future_repaired_patches() {
        let first_context = super::super::content::DiscoveryContext {
            season: "spring".into(),
            weather: "clear".into(),
        };
        let changed_context = super::super::content::DiscoveryContext {
            season: "winter".into(),
            weather: "snow".into(),
        };
        let mut garden = Garden::default();
        let mut album = Album::default();
        let now = 10000;
        let first = super::dig(
            &mut garden,
            &mut album,
            "friend",
            "woodland",
            0.5,
            0.5,
            &ground(),
            now + 14 * DIG_TTL_MS,
            97,
            0,
            Some(&first_context),
        )
        .unwrap();
        let before = album.clone();
        garden = Garden::restore(Some(&serde_json::to_value(&garden).unwrap()), now);
        let repeat = super::dig(
            &mut garden,
            &mut album,
            "other",
            "woodland",
            0.51,
            0.51,
            &ground(),
            now,
            75,
            999,
            Some(&changed_context),
        )
        .unwrap();
        assert!(repeat.repeated);
        assert_eq!(repeat.attempt_id, first.attempt_id);
        assert_eq!(repeat.kind, first.kind);
        assert_eq!(album, before);
        let next = super::dig(
            &mut garden,
            &mut album,
            "third",
            "courtyard",
            0.5,
            0.5,
            &ground(),
            now + 1,
            99,
            0,
            Some(&changed_context),
        )
        .unwrap();
        assert_eq!(rarity_of(next.kind.as_deref().unwrap()), "common");
    }

    #[test]
    fn environmental_invalid_context_leaves_rewards_and_future_history_untouched() {
        for (season, weather) in [("monsoon", "clear"), ("spring", "storm"), ("", "clear")] {
            let mut garden = Garden {
                digs: vec![recorded_patch(0, 99999)],
                ..Default::default()
            };
            let mut album = Album::default();
            let before = garden.clone();
            let before_album = album.clone();
            let context = super::super::content::DiscoveryContext {
                season: season.into(),
                weather: weather.into(),
            };
            assert!(
                super::dig(
                    &mut garden,
                    &mut album,
                    "friend",
                    "woodland",
                    0.5,
                    0.5,
                    &ground(),
                    10000,
                    97,
                    0,
                    Some(&context)
                )
                .is_err()
            );
            assert_eq!(garden, before);
            assert_eq!(album, before_album);
        }
    }

    fn rarity_of(kind: &str) -> String {
        let raw: Value = serde_json::from_str(include_str!("../../../src/content/catalog.json")).unwrap();
        raw["treasures"]
            .as_array()
            .unwrap()
            .iter()
            .find(|item| item["id"] == kind)
            .unwrap()["rarity"]
            .as_str()
            .unwrap()
            .into()
    }

    #[test]
    fn environmental_rarity_boundary_begins_at_97() {
        for (roll, rarity) in [
            (75, "common"),
            (94, "common"),
            (95, "common"),
            (96, "common"),
            (97, "uncommon"),
            (99, "uncommon"),
        ] {
            let result = dig(
                &mut Garden::default(),
                &mut Album::default(),
                "friend",
                "woodland",
                0.5,
                0.5,
                &ground(),
                10000,
                roll,
                0,
            )
            .unwrap();
            assert_eq!(rarity_of(result.kind.as_deref().unwrap()), rarity, "roll {roll}");
        }
    }

    #[test]
    fn environmental_uncommon_window_is_profile_wide_and_expires_at_exact_24_hours() {
        let mut garden = Garden::default();
        let mut album = Album::default();
        let first = dig(
            &mut garden,
            &mut album,
            "first",
            "woodland",
            0.5,
            0.5,
            &ground(),
            10000,
            97,
            0,
        )
        .unwrap();
        assert_eq!(rarity_of(first.kind.as_deref().unwrap()), "uncommon");
        garden = Garden::restore(Some(&serde_json::to_value(&garden).unwrap()), 10000);
        for (pet, world, now, expected) in [
            ("second", "courtyard", 10001, "common"),
            ("third", "lakeside", 10000 + DIG_TTL_MS - 1, "common"),
            ("fourth", "custom", 10000 + DIG_TTL_MS, "uncommon"),
        ] {
            let result = dig(&mut garden, &mut album, pet, world, 0.5, 0.5, &ground(), now, 99, 0).unwrap();
            assert_eq!(rarity_of(result.kind.as_deref().unwrap()), expected);
        }
    }

    #[test]
    fn exclusions_crossing_the_field_boundary_are_valid_geometry() {
        let mut g = ground();
        g.water.push(Ellipse {
            x: 0.5,
            y: -0.1,
            rx: 0.3,
            ry: 0.2,
        });
        assert!(g.validate(0.8, 0.8).is_ok());
        assert!(g.validate(0.5, 0.0).is_err());
        g.water[0].y = -4.1;
        assert!(g.validate(0.8, 0.8).is_err());
    }

    #[test]
    fn ground_refuses_water_props_indoor_and_malformed_geometry() {
        let mut g = ground();
        assert!(g.validate(0.5, 0.5).is_ok());
        for p in [(f64::NAN, 0.5), (-0.1, 0.5), (0.5, 1.1)] {
            assert!(g.validate(p.0, p.1).is_err());
        }
        g.water.push(Ellipse {
            x: 0.5,
            y: 0.5,
            rx: 0.1,
            ry: 0.2,
        });
        assert!(g.validate(0.5, 0.5).is_err());
        assert!(g.validate(0.8, 0.5).is_ok());
        g.water[0].rx = 0.0;
        assert!(g.validate(0.8, 0.5).is_err());
        g = ground();
        g.soil = false;
        assert!(g.validate(0.5, 0.5).is_err());
        g = ground();
        g.obstacles = vec![
            Ellipse {
                x: 0.5,
                y: 0.5,
                rx: 0.1,
                ry: 0.1
            };
            65
        ];
        assert!(g.validate(0.8, 0.8).is_err());
    }

    #[test]
    fn dig_roll_boundaries_and_full_pocket_keep_the_chosen_outcome() {
        for (roll, outcome) in [
            (0, "empty"),
            (29, "empty"),
            (30, "seed"),
            (54, "seed"),
            (55, "sapling"),
            (74, "sapling"),
            (75, "keepsake"),
            (94, "keepsake"),
            (95, "keepsake"),
            (99, "keepsake"),
        ] {
            let mut g = Garden::default();
            let mut a = Album::default();
            let r = dig(&mut g, &mut a, "friend", "meadow", 0.5, 0.5, &ground(), 10000, roll, 0).unwrap();
            assert_eq!(r.outcome, outcome);
            if roll >= 75 {
                assert!(r.kind.is_some());
                assert_eq!(a.treasures.values().next().unwrap().count, 1);
            }
        }
        let mut g = Garden {
            seeds: SEED_MAX,
            ..Default::default()
        };
        let mut a = Album::default();
        assert_eq!(
            dig(&mut g, &mut a, "friend", "meadow", 0.5, 0.5, &ground(), 10000, 40, 0)
                .unwrap()
                .outcome,
            "full"
        );
        assert_eq!(g.seeds, SEED_MAX);
    }

    #[test]
    fn sapling_rewards_persist_and_full_stock_keeps_the_species() {
        let mut g = Garden::default();
        let mut a = Album::default();
        let first = dig(&mut g, &mut a, "friend", "meadow", 0.5, 0.5, &ground(), 10000, 55, 0).unwrap();
        assert_eq!(first.outcome, "sapling");
        let kind = first.kind.clone().unwrap();
        assert!(catalog().is_tree(&kind));
        assert!(a.treasures.is_empty());
        let saved = serde_json::to_value(&g).unwrap();
        assert_eq!(saved["saplings"][&kind], 1);
        g = Garden::restore(Some(&saved), 0);
        let repeat = dig(&mut g, &mut a, "other", "meadow", 0.5, 0.5, &ground(), 10001, 99, 2).unwrap();
        assert!(repeat.repeated);
        assert_eq!(repeat.kind, first.kind);
        assert_eq!(serde_json::to_value(&g).unwrap()["saplings"][&kind], 1);
        g = Garden::restore(Some(&json!({"saplings": {kind.clone(): 20}})), 0);
        let full = dig(&mut g, &mut a, "friend", "meadow", 0.5, 0.5, &ground(), 10000, 55, 0).unwrap();
        assert_eq!(full.outcome, "full");
        assert_eq!(full.kind.as_deref(), Some(kind.as_str()));
        assert!(a.treasures.is_empty());
        assert_eq!(serde_json::to_value(&g).unwrap()["saplings"][&kind], 20);
    }

    #[test]
    fn sapling_choices_cover_the_actual_tree_catalog() {
        let catalog_data: Value = serde_json::from_str(include_str!("../../../src/content/catalog.json")).unwrap();
        let kinds = catalog_data["trees"].as_array().unwrap();
        for (choice, kind) in kinds.iter().enumerate() {
            let mut g = Garden::default();
            let result = dig(
                &mut g,
                &mut Album::default(),
                "friend",
                "meadow",
                0.5,
                0.5,
                &ground(),
                10000,
                55,
                choice as u64,
            )
            .unwrap();
            assert_eq!(result.kind.as_deref(), kind["id"].as_str());
            assert_eq!(result.outcome, "sapling");
        }
    }

    #[test]
    fn tree_planting_requires_stock_and_failed_requests_spend_nothing() {
        let mut g = Garden::default();
        assert!(plant_tree(&mut g, "meadow", "cherry", 0.5, 0.5, &ground(), 1).is_err());
        g = Garden::restore(Some(&json!({"saplings": {"cherry": 2}})), 0);
        for (kind, x) in [("missing", 0.5), ("cherry", f64::NAN)] {
            assert!(plant_tree(&mut g, "meadow", kind, x, 0.5, &ground(), 1).is_err());
        }
        assert_eq!(serde_json::to_value(&g).unwrap()["saplings"]["cherry"], 2);
        let t = plant_tree(&mut g, "meadow", "cherry", 0.5, 0.5, &ground(), 1).unwrap();
        assert_eq!(serde_json::to_value(&g).unwrap()["saplings"]["cherry"], 1);
        remove_tree(&mut g, &t.id).unwrap();
        assert_eq!(serde_json::to_value(&g).unwrap()["saplings"]["cherry"], 1);
    }

    #[test]
    fn replay_survives_save_while_cooldown_ttl_and_scene_boundaries_hold() {
        let mut g = Garden::default();
        let mut a = Album::default();
        let first = dig(&mut g, &mut a, "friend", "meadow", 0.5, 0.5, &ground(), 10000, 40, 0).unwrap();
        g = Garden::restore(Some(&serde_json::to_value(g).unwrap()), 10000);
        let repeated = dig(&mut g, &mut a, "other", "meadow", 0.51, 0.51, &ground(), 10001, 99, 0).unwrap();
        assert!(repeated.repeated);
        assert_eq!(first.attempt_id, repeated.attempt_id);
        assert_eq!(g.seeds, 1);
        assert!(dig(&mut g, &mut a, "friend", "beach", 0.5, 0.5, &ground(), 10001, 0, 0).is_err());
        assert!(dig(&mut g, &mut a, "friend", "beach", 0.5, 0.5, &ground(), 9999, 0, 0).is_err());
        assert!(dig(&mut g, &mut a, "friend", "beach", 0.5, 0.5, &ground(), 18000, 0, 0).is_ok());
        assert!(
            !dig(
                &mut g,
                &mut a,
                "friend",
                "meadow",
                0.5,
                0.5,
                &ground(),
                10000 + DIG_TTL_MS,
                40,
                0
            )
            .unwrap()
            .repeated
        );
        for i in 0..40 {
            dig(
                &mut g,
                &mut a,
                "friend",
                &format!("world{i}"),
                0.5,
                0.5,
                &ground(),
                10000 + DIG_TTL_MS + (i + 1) * 8000,
                0,
                0,
            )
            .unwrap();
        }
        assert_eq!(g.digs.len(), 41);
    }

    fn recorded_patch(index: usize, at: u64) -> DigAttempt {
        DigAttempt {
            result: DigResult {
                attempt_id: format!("attempt-{index}"),
                outcome: "empty".into(),
                kind: None,
                repeated: false,
            },
            pet_id: format!("friend-{index}"),
            world: format!("world-{index}"),
            tile_x: 4,
            tile_y: 4,
            at,
        }
    }

    #[test]
    fn the_first_patch_still_replays_after_more_than_32_fresh_digs() {
        let mut garden = Garden::default();
        let mut album = Album::default();
        let mut first = None;
        for i in 0..36 {
            let result = dig(
                &mut garden,
                &mut album,
                "explorer",
                "meadow",
                ((i % 8) as f64 + 0.5) / 8.0,
                ((i / 8) as f64 + 0.5) / 8.0,
                &ground(),
                10000 + i * DIG_COOLDOWN_MS,
                75,
                0,
            )
            .unwrap();
            first.get_or_insert(result);
        }
        let first = first.unwrap();
        let before = album.clone();
        let repeated = dig(
            &mut garden,
            &mut album,
            "other",
            "meadow",
            0.0625,
            0.0625,
            &ground(),
            10000 + 36 * DIG_COOLDOWN_MS,
            75,
            0,
        )
        .unwrap();
        assert!(repeated.repeated);
        assert_eq!(repeated.attempt_id, first.attempt_id);
        assert_eq!(album, before);
        assert_eq!(garden.digs.len(), 36);
    }

    #[test]
    fn restored_history_prunes_expired_entries_before_the_bound() {
        let now = DIG_TTL_MS + 10000;
        let mut records: Vec<_> = (0..DIG_HISTORY).map(|i| recorded_patch(i, 1)).collect();
        records.extend((DIG_HISTORY..DIG_HISTORY + 40).map(|i| recorded_patch(i, now - 1000)));
        let raw = serde_json::to_value(records).unwrap();
        let restored = restore_digs(Some(&raw), now);
        assert_eq!(restored.len(), 40);
        assert!(restored.iter().all(|attempt| attempt.at == now - 1000));
    }

    #[test]
    fn future_history_restores_at_now_without_losing_patch_identity() {
        let now = DIG_TTL_MS + 10000;
        let future = recorded_patch(0, now + 14 * DIG_TTL_MS);
        let recent = recorded_patch(1, now - 1000);
        let raw = serde_json::to_value([future.clone(), recent.clone(), recorded_patch(2, 1)]).unwrap();
        let restored = restore_digs(Some(&raw), now);
        assert_eq!(restored.len(), 2);
        assert_eq!(restored[0].at, now);
        assert_eq!(restored[0].result, future.result);
        assert_eq!(restored[0].pet_id, future.pet_id);
        assert_eq!(restored[0].world, future.world);
        assert_eq!((restored[0].tile_x, restored[0].tile_y), (future.tile_x, future.tile_y));
        assert_eq!(restored[1], recent);
    }

    #[test]
    fn rollback_replays_a_future_patch_without_awarding_it_again() {
        let now = 10000;
        let mut garden = Garden::default();
        let mut album = Album::default();
        let first = dig(
            &mut garden,
            &mut album,
            "friend",
            "meadow",
            0.5,
            0.5,
            &ground(),
            now + 14 * DIG_TTL_MS,
            75,
            0,
        )
        .unwrap();
        let before = album.clone();
        let repeated = dig(
            &mut garden,
            &mut album,
            "friend",
            "meadow",
            0.51,
            0.51,
            &ground(),
            now,
            99,
            1,
        )
        .unwrap();
        assert!(repeated.repeated);
        assert_eq!(repeated.attempt_id, first.attempt_id);
        assert_eq!(repeated.kind, first.kind);
        assert_eq!(album, before);
        assert_eq!(garden.digs.len(), 1);
        assert_eq!(garden.digs[0].at, now);
        let saved = serde_json::to_value(&garden).unwrap();
        let restored = Garden::restore(Some(&saved), now + DIG_TTL_MS - 1);
        assert_eq!(restored.digs.len(), 1);
        assert_eq!(restored.digs[0].result.attempt_id, first.attempt_id);
    }

    #[test]
    fn rollback_on_new_ground_waits_only_the_normal_cooldown() {
        let now = 10000;
        let mut garden = Garden::default();
        let mut album = Album::default();
        dig(
            &mut garden,
            &mut album,
            "friend",
            "meadow",
            0.5,
            0.5,
            &ground(),
            now + 14 * DIG_TTL_MS,
            0,
            0,
        )
        .unwrap();
        for at in [now, now + DIG_COOLDOWN_MS - 1] {
            assert!(
                dig(
                    &mut garden,
                    &mut album,
                    "friend",
                    "beach",
                    0.5,
                    0.5,
                    &ground(),
                    at,
                    40,
                    0
                )
                .is_err()
            );
            assert_eq!(garden.digs.len(), 1);
            assert_eq!(garden.seeds, 0);
        }
        let result = dig(
            &mut garden,
            &mut album,
            "friend",
            "beach",
            0.5,
            0.5,
            &ground(),
            now + DIG_COOLDOWN_MS,
            40,
            0,
        )
        .unwrap();
        assert!(!result.repeated);
        assert_eq!(result.outcome, "seed");
        assert_eq!(garden.seeds, 1);
        assert_eq!(garden.digs.len(), 2);
    }

    #[test]
    fn a_full_ledger_rejects_new_ground_without_mutating_rewards_or_history() {
        let now = 10000;
        let mut garden = Garden {
            digs: (0..DIG_HISTORY).map(|i| recorded_patch(i, now)).collect(),
            ..Default::default()
        };
        let mut album = Album::default();
        let before = garden.clone();
        assert!(
            dig(
                &mut garden,
                &mut album,
                "new",
                "unseen-world",
                0.5,
                0.5,
                &ground(),
                now + 1,
                75,
                0
            )
            .is_err()
        );
        assert_eq!(garden, before);
        assert_eq!(album, Album::default());
        let repeated = dig(
            &mut garden,
            &mut album,
            "new",
            "world-0",
            0.5,
            0.5,
            &ground(),
            now + 1,
            75,
            0,
        )
        .unwrap();
        assert!(repeated.repeated);
        assert_eq!(repeated.attempt_id, "attempt-0");
        assert_eq!(garden, before);
    }

    #[test]
    fn expired_history_frees_capacity_before_a_new_reward() {
        let mut garden = Garden {
            digs: (0..DIG_HISTORY).map(|i| recorded_patch(i, 1)).collect(),
            ..Default::default()
        };
        let result = dig(
            &mut garden,
            &mut Album::default(),
            "new",
            "world-0",
            0.5,
            0.5,
            &ground(),
            DIG_TTL_MS + 1,
            40,
            0,
        )
        .unwrap();
        assert!(!result.repeated);
        assert_eq!(garden.seeds, 1);
        assert_eq!(garden.digs.len(), 1);
    }

    #[test]
    fn trees_are_scene_owned_limited_and_grow_once_without_regression() {
        let mut g = Garden::restore(Some(&json!({"saplings": {"cherry":20,"pine":20,"maple":20}})), 0);
        let mut a = Album::default();
        let tree = plant_tree(&mut g, "meadow", "cherry", 0.5, 0.5, &ground(), 10000).unwrap();
        assert_eq!(tree.stage, 0);
        assert_eq!(tree.world, "meadow");
        assert!(!grow_trees(&mut g, &mut a, 10000 + TREE_YOUNG_MS - 1));
        assert!(grow_trees(&mut g, &mut a, 10000 + TREE_YOUNG_MS));
        assert_eq!(g.trees[0].stage, 1);
        assert!(!grow_trees(&mut g, &mut a, 0));
        assert_eq!(g.trees[0].stage, 1);
        assert!(grow_trees(&mut g, &mut a, 10000 + TREE_MATURE_MS));
        assert_eq!(a.trees["cherry"].count, 1);
        assert!(!grow_trees(&mut g, &mut a, u64::MAX));
        for _ in 1..TREE_WORLD_MAX {
            plant_tree(&mut g, "meadow", "pine", 0.8, 0.8, &ground(), 1).unwrap();
        }
        assert!(plant_tree(&mut g, "meadow", "maple", 0.5, 0.5, &ground(), 1).is_err());
        for i in 1..4 {
            g = Garden::restore(
                Some(&{
                    let mut saved = serde_json::to_value(&g).unwrap();
                    saved["saplings"]["pine"] = json!(20);
                    saved
                }),
                0,
            );
            for _ in 0..TREE_WORLD_MAX {
                plant_tree(&mut g, &format!("world{i}"), "pine", 0.8, 0.8, &ground(), 1).unwrap();
            }
        }
        assert_eq!(g.trees.len(), 24);
        assert!(plant_tree(&mut g, "extra", "pine", 0.5, 0.5, &ground(), 1).is_err());
        move_tree(&mut g, &tree.id, 0.2, 0.2, &ground()).unwrap();
        assert_eq!(g.trees[0].x, 0.2);
        remove_tree(&mut g, &tree.id).unwrap();
        assert!(remove_tree(&mut g, &tree.id).is_err());
    }
}
