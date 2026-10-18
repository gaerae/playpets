//! Ground snapshots, one-time discoveries and scene-owned trees.
use super::{
    album::{Album, Entry, KINDS_MAX},
    content::catalog,
    garden::{Garden, SEED_MAX},
};
use crate::i18n;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

pub const TREE_MAX: usize = 12;
pub const TREE_WORLD_MAX: usize = 3;
pub const TREE_YOUNG_MS: u64 = 2 * 60 * 60 * 1000;
pub const TREE_MATURE_MS: u64 = 12 * 60 * 60 * 1000;
pub const DIG_COOLDOWN_MS: u64 = 8000;
pub const DIG_TTL_MS: u64 = 24 * 60 * 60 * 1000;
pub const DIG_HISTORY: usize = 32;
pub const DIG_ODDS: [u8; 4] = [40, 25, 30, 5];

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
fn kind_id(value: &str) -> bool {
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
pub fn restore_digs(raw: Option<&Value>) -> Vec<DigAttempt> {
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
                && matches!(d.result.outcome.as_str(), "empty" | "seed" | "full" | "keepsake")
                && (d.result.outcome != "keepsake" || d.result.kind.as_deref().is_some_and(kind_id))
        })
        .take(DIG_HISTORY)
        .collect()
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
) -> Result<DigResult, String> {
    ground.validate(x, y)?;
    if !identifier(pet_id) || !identifier(world) || roll >= 100 {
        return Err(bad_request());
    }
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
    let (outcome, kind) = if roll < DIG_ODDS[0] {
        ("empty", None)
    } else if roll < DIG_ODDS[0] + DIG_ODDS[1] {
        (if garden.seeds >= SEED_MAX { "full" } else { "seed" }, None)
    } else {
        let rarity = if roll < DIG_ODDS[0] + DIG_ODDS[1] + DIG_ODDS[2] {
            "common"
        } else {
            "uncommon"
        };
        (
            "keepsake",
            Some(catalog().treasure(rarity, choice).ok_or_else(bad_request)?.to_owned()),
        )
    };
    if let Some(kind) = &kind {
        if !album.treasures.contains_key(kind) && album.treasures.len() >= KINDS_MAX {
            return Err(bad_request());
        }
        let entry = album.treasures.entry(kind.clone()).or_insert(Entry {
            count: 0,
            best: 0.0,
            first: now,
        });
        entry.count = entry.count.saturating_add(1);
    }
    if outcome == "seed" {
        garden.seeds += 1;
    }
    let result = DigResult {
        attempt_id: Uuid::new_v4().to_string(),
        outcome: outcome.into(),
        kind,
        repeated: false,
    };
    garden.digs.retain(|d| now.saturating_sub(d.at) < DIG_TTL_MS);
    garden.digs.push(DigAttempt {
        result: result.clone(),
        pet_id: pet_id.into(),
        world: world.into(),
        tile_x,
        tile_y,
        at: now,
    });
    if garden.digs.len() > DIG_HISTORY {
        garden.digs.remove(0);
    }
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
            (39, "empty"),
            (40, "seed"),
            (64, "seed"),
            (65, "keepsake"),
            (94, "keepsake"),
            (95, "keepsake"),
            (99, "keepsake"),
        ] {
            let mut g = Garden::default();
            let mut a = Album::default();
            let r = dig(&mut g, &mut a, "friend", "meadow", 0.5, 0.5, &ground(), 10000, roll, 0).unwrap();
            assert_eq!(r.outcome, outcome);
            if roll >= 65 {
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
    fn replay_survives_save_while_cooldown_ttl_and_scene_boundaries_hold() {
        let mut g = Garden::default();
        let mut a = Album::default();
        let first = dig(&mut g, &mut a, "friend", "meadow", 0.5, 0.5, &ground(), 10000, 40, 0).unwrap();
        g = Garden::restore(Some(&serde_json::to_value(g).unwrap()));
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
        assert_eq!(g.digs.len(), DIG_HISTORY);
    }

    #[test]
    fn trees_are_scene_owned_limited_and_grow_once_without_regression() {
        let mut g = Garden::default();
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
            for _ in 0..3 {
                plant_tree(&mut g, &format!("world{i}"), "pine", 0.8, 0.8, &ground(), 1).unwrap();
            }
        }
        assert!(plant_tree(&mut g, "extra", "pine", 0.5, 0.5, &ground(), 1).is_err());
        move_tree(&mut g, &tree.id, 0.2, 0.2, &ground()).unwrap();
        assert_eq!(g.trees[0].x, 0.2);
        remove_tree(&mut g, &tree.id).unwrap();
        assert!(remove_tree(&mut g, &tree.id).is_err());
    }
}
