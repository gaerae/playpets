//! The garden friends and the person grow together: seeds a friend found, the plants grown from
//! them, and the decorations friends bring as gifts. Digging awards seeds and saplings.
//! A friend brings a gift on a day the two did something together, every few days, and one when it
//! grows closer (a memento of its own at level 4); while the yard is full they wait in a box.
//! The page decides when (it knows who is idle, whether the yard is seen and the local day); every
//! limit, and which gift comes next, is kept here. Growth is not stored: a plant's stage follows
//! from when it was planted (src/yard/garden.js). What can grow and what friends bring are the
//! catalogue's (content.rs).
//! Design: docs/design/2026-10-09-a-yard-that-grows.md, docs/design/2026-10-29-gifts-from-friends.md.
use super::content::catalog;
use super::discovery::{DigAttempt, Tree};
use crate::i18n;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use uuid::Uuid;

/// Seeds a pocket holds; a full pocket asks for some planting before more are found.
pub const SEED_MAX: u32 = 20;
/// Saplings kept for each species, independently of flower seeds.
pub const SAPLING_MAX: u32 = 20;
/// Plants the field holds, so it stays a field.
pub const PLANT_MAX: usize = 24;
/// Decorations the yard holds, so friends still have room to play.
pub const DECOR_MAX: usize = 12;
/// Gifts the box keeps while the yard is full.
pub const BOX_MAX: usize = 12;
/// Days from one everyday gift to the next.
pub const GIFT_EVERY_DAYS: i64 = 2;
/// The levels a friend brings a gift for when it reaches them; at MEMENTO_LEVEL it is a memento.
pub const THANKS_LEVELS: std::ops::RangeInclusive<u32> = 2..=5;
pub const MEMENTO_LEVEL: u32 = 4;

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Garden {
    pub seeds: u32,
    #[serde(default)]
    pub saplings: BTreeMap<String, u32>,
    #[serde(default)]
    pub trees: Vec<Tree>,
    #[serde(default)]
    pub digs: Vec<DigAttempt>,
    pub plants: Vec<Plant>,
    pub decor: Vec<Decor>,
    /// Every kind of decoration ever given, in the order it came.
    pub received: Vec<String>,
    /// The day the last everyday gift came, as the page's local date (YYYY-MM-DD).
    pub gift_day: String,
    /// Gifts that came while the yard was full, oldest first; each can be set out later.
    #[serde(default)]
    pub boxed: Vec<Decor>,
    /// The highest level each friend has brought a gift for (friend id → level).
    #[serde(default)]
    pub thanked: BTreeMap<String, u32>,
    /// When the next everyday gift may come, so a restart keeps the wait.
    #[serde(default)]
    pub gift_wait: Option<GiftWait>,
}

/// The wait for the next everyday gift: set after the gift of `after` (giftDay), due at `due_at`
/// (ms since 1970). A wait set before another gift came no longer counts.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GiftWait {
    pub after: String,
    pub due_at: u64,
}

/// Where a gift went: down in the yard, or into the box because the yard was full.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct Given {
    #[serde(flatten)]
    pub decor: Decor,
    pub boxed: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Decor {
    pub id: String,
    pub kind: String,
    /// Where it stands on the field, as plants do.
    pub x: f64,
    pub y: f64,
    /// The friend who brought it (friend id); none for a gift from before friends were named.
    #[serde(
        default,
        deserialize_with = "super::or_default",
        skip_serializing_if = "Option::is_none"
    )]
    pub from: Option<String>,
    /// The friend's memento: brought at level 4, and kept in the box when put away.
    #[serde(
        default,
        deserialize_with = "super::or_default",
        skip_serializing_if = "std::ops::Not::not"
    )]
    pub memento: bool,
}

/// A day as the page writes it: YYYY-MM-DD, with a month and a day of the month that can be.
pub fn is_day(text: &str) -> bool {
    let b = text.as_bytes();
    let digits = b.len() == 10
        && b[4] == b'-'
        && b[7] == b'-'
        && b.iter()
            .enumerate()
            .all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit());
    let number = |r: std::ops::Range<usize>| text[r].parse::<u32>().unwrap_or(0);
    digits && (1..=12).contains(&number(5..7)) && (1..=31).contains(&number(8..10))
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Plant {
    pub id: String,
    pub kind: String,
    /// Across the field (0 left, 1 right) and down it (0 the ridge, 1 the front), as friends stand.
    pub x: f64,
    pub y: f64,
    /// When it went into the ground, in ms since 1970.
    pub planted: u64,
    /// Whether its flower has been counted in the album.
    #[serde(default)]
    pub bloomed: bool,
}

/// Things kept on the field (plants, decorations) as state.json has them: the ones of a kind there
/// is, at a place that is a number, brought onto the field, and no more than `max`.
fn placed<T: serde::de::DeserializeOwned>(
    raw: Option<&Value>,
    max: usize,
    known: impl Fn(&T) -> bool,
    at: impl Fn(&mut T) -> (&mut f64, &mut f64),
) -> Vec<T> {
    raw.and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|v| serde_json::from_value::<T>(v.clone()).ok())
        .filter(|t| known(t))
        .filter_map(|mut t| {
            let (x, y) = at(&mut t);
            *x = place(*x)?;
            *y = place(*y)?;
            Some(t)
        })
        .take(max)
        .collect()
}

fn place(v: f64) -> Option<f64> {
    v.is_finite().then(|| v.clamp(0.0, 1.0))
}

impl Garden {
    /// The garden as state.json has it, keeping only what makes sense (a hand-edited or older file).
    pub fn restore(raw: Option<&Value>, now: u64) -> Garden {
        let Some(raw) = raw else { return Garden::default() };
        let seeds = raw
            .get("seeds")
            .and_then(Value::as_u64)
            .unwrap_or(0)
            .min(SEED_MAX as u64) as u32;
        let plants = placed(
            raw.get("plants"),
            PLANT_MAX,
            |p: &Plant| catalog().is_flower(&p.kind),
            |p| (&mut p.x, &mut p.y),
        );
        let decor = placed(
            raw.get("decor"),
            DECOR_MAX,
            |d: &Decor| catalog().is_gift(&d.kind),
            |d| (&mut d.x, &mut d.y),
        );
        let mut received: Vec<String> = Vec::new();
        for kind in raw.get("received").and_then(Value::as_array).into_iter().flatten() {
            if let Some(kind) = kind.as_str()
                && catalog().is_gift(kind)
                && !received.iter().any(|k| k == kind)
            {
                received.push(kind.into());
            }
        }
        let gift_day = raw
            .get("giftDay")
            .and_then(Value::as_str)
            .filter(|d| is_day(d))
            .unwrap_or_default()
            .to_string();
        let boxed = placed(
            raw.get("boxed"),
            BOX_MAX,
            |d: &Decor| catalog().is_gift(&d.kind),
            |d| (&mut d.x, &mut d.y),
        );
        let thanked = raw
            .get("thanked")
            .and_then(Value::as_object)
            .into_iter()
            .flatten()
            .filter_map(|(pet, level)| Some((pet.clone(), level.as_u64()?.min(5) as u32)))
            .take(super::model::LIMIT * 4)
            .collect();
        let gift_wait = raw
            .get("giftWait")
            .and_then(|w| serde_json::from_value::<GiftWait>(w.clone()).ok())
            .filter(|w| w.after == gift_day);
        Garden {
            trees: super::discovery::restore_trees(raw.get("trees")),
            digs: super::discovery::restore_digs(raw.get("digs"), now),
            seeds,
            saplings: raw
                .get("saplings")
                .and_then(Value::as_object)
                .into_iter()
                .flatten()
                .filter(|(kind, _)| super::discovery::kind_id(kind))
                .filter_map(|(kind, count)| {
                    count
                        .as_u64()
                        .map(|count| (kind.clone(), count.min(u64::from(SAPLING_MAX)) as u32))
                })
                .take(super::album::KINDS_MAX)
                .collect(),
            plants,
            decor,
            received,
            gift_day,
            boxed,
            thanked,
            gift_wait,
        }
    }

    /// Puts a seed in the ground at (x, y). `now` is ms since 1970.
    pub fn plant(&mut self, kind: &str, x: f64, y: f64, now: u64) -> Result<Plant, String> {
        if self.seeds == 0 {
            return Err(i18n::t("error.no_seeds"));
        }
        if self.plants.len() >= PLANT_MAX {
            return Err(i18n::tr("error.garden_full", &[("limit", &PLANT_MAX.to_string())]));
        }
        let (Some(x), Some(y), true) = (place(x), place(y), catalog().is_flower(kind)) else {
            return Err(i18n::t("error.bad_request"));
        };
        let plant = Plant {
            id: Uuid::new_v4().to_string(),
            kind: kind.into(),
            x,
            y,
            planted: now,
            bloomed: false,
        };
        self.seeds -= 1;
        self.plants.push(plant.clone());
        Ok(plant)
    }

    /// Pulls a plant out of the ground.
    pub fn pull(&mut self, id: &str) -> Result<(), String> {
        let before = self.plants.len();
        self.plants.retain(|p| p.id != id);
        if self.plants.len() == before {
            return Err(i18n::t("error.plant_missing"));
        }
        Ok(())
    }

    /// A plant has flowered: returns its kind the first time (for the album), nothing after, and
    /// refuses one that cannot have flowered yet.
    pub fn bloom(&mut self, id: &str, now: u64) -> Result<Option<String>, String> {
        let plant = self
            .plants
            .iter_mut()
            .find(|p| p.id == id)
            .ok_or_else(|| i18n::t("error.plant_missing"))?;
        if now.saturating_sub(plant.planted) < catalog().bloom_after_ms() {
            return Err(i18n::t("error.bad_request"));
        }
        if plant.bloomed {
            return Ok(None);
        }
        plant.bloomed = true;
        Ok(Some(plant.kind.clone()))
    }

    /// What the next gift is: each kind once, in order; after that one that is not in the yard or
    /// the box (any kind, once every kind is), turned by `turn` so it is not always the same.
    pub fn next_gift(&self, turn: usize) -> &'static str {
        let kinds = catalog().gifts();
        if let Some(kind) = kinds.iter().find(|k| !self.received.iter().any(|r| r == *k)) {
            return kind;
        }
        let away: Vec<&'static str> = kinds
            .iter()
            .copied()
            .filter(|k| !self.decor.iter().chain(&self.boxed).any(|d| d.kind == *k))
            .collect();
        let from = if away.is_empty() { kinds } else { away };
        from.get(turn % from.len().max(1)).copied().unwrap_or_default()
    }

    /// A friend (`from`) brings an everyday gift and sets it down at (x, y): one every
    /// GIFT_EVERY_DAYS days, on a day the two did something together (the caller checks that).
    /// `day` is the page's local date. During a seasonal event (`event`, which the page says and
    /// the dates check), its own gift comes the first time instead.
    pub fn gift(
        &mut self,
        x: f64,
        y: f64,
        day: &str,
        turn: usize,
        event: Option<&str>,
        from: &str,
    ) -> Result<Given, String> {
        let (Some(x), Some(y), true) = (place(x), place(y), is_day(day)) else {
            return Err(i18n::t("error.bad_request"));
        };
        // Too soon after the last, or the page's clock went back to a day before it.
        if !self.gift_day.is_empty() && super::days_between(&self.gift_day, day).is_none_or(|d| d < GIFT_EVERY_DAYS) {
            return Err(i18n::t("error.gift_today"));
        }
        let kind = event
            .and_then(|e| super::content::event_gift(e, day))
            .filter(|g| !self.received.iter().any(|r| r == g))
            .unwrap_or_else(|| self.next_gift(turn));
        let given = self.give(kind, from, false, x, y)?;
        self.gift_day = day.into();
        self.gift_wait = None;
        Ok(given)
    }

    /// A friend that reached `level` brings a gift for it, once a level: at MEMENTO_LEVEL (or the
    /// first time after it) its memento, otherwise the next everyday one. The caller checks the
    /// friend has reached the level.
    pub fn thanks(&mut self, from: &str, level: u32, x: f64, y: f64, turn: usize) -> Result<Given, String> {
        let (Some(x), Some(y)) = (place(x), place(y)) else {
            return Err(i18n::t("error.bad_request"));
        };
        if !THANKS_LEVELS.contains(&level) || self.thanked.get(from).is_some_and(|&had| had >= level) {
            return Err(i18n::t("error.bad_request"));
        }
        let memento = level >= MEMENTO_LEVEL && !self.has_memento(from);
        let kind = if memento {
            memento_kind(from)
        } else {
            self.next_gift(turn)
        };
        let given = self.give(kind, from, memento, x, y)?;
        self.thanked.insert(from.into(), level);
        Ok(given)
    }

    /// Whether a friend's memento is in the yard or the box.
    pub fn has_memento(&self, from: &str) -> bool {
        self.decor
            .iter()
            .chain(&self.boxed)
            .any(|d| d.memento && d.from.as_deref() == Some(from))
    }

    /// Sets a gift down, or puts it in the box when the yard is full; counted the first time.
    fn give(&mut self, kind: &str, from: &str, memento: bool, x: f64, y: f64) -> Result<Given, String> {
        if kind.is_empty() {
            return Err(i18n::t("error.bad_request"));
        }
        let decor = Decor {
            id: Uuid::new_v4().to_string(),
            kind: kind.into(),
            x,
            y,
            from: Some(from.into()),
            memento,
        };
        let boxed = self.decor.len() >= DECOR_MAX;
        if boxed && self.boxed.len() >= BOX_MAX {
            return Err(i18n::t("error.gifts_full"));
        }
        if !self.received.iter().any(|k| k == kind) {
            self.received.push(kind.into());
        }
        if boxed { &mut self.boxed } else { &mut self.decor }.push(decor.clone());
        Ok(Given { decor, boxed })
    }

    /// Takes a gift out of the box and sets it down at (x, y).
    pub fn set_out(&mut self, id: &str, x: f64, y: f64) -> Result<Decor, String> {
        let (Some(x), Some(y)) = (place(x), place(y)) else {
            return Err(i18n::t("error.bad_request"));
        };
        let at = self
            .boxed
            .iter()
            .position(|d| d.id == id)
            .ok_or_else(|| i18n::t("error.decor_missing"))?;
        if self.decor.len() >= DECOR_MAX {
            return Err(i18n::tr("error.decor_full", &[("limit", &DECOR_MAX.to_string())]));
        }
        let mut decor = self.boxed.remove(at);
        (decor.x, decor.y) = (x, y);
        self.decor.push(decor.clone());
        Ok(decor)
    }

    /// Remembers when the next everyday gift may come; a wait for an earlier gift is not kept.
    pub fn wait_for_gift(&mut self, after: &str, due_at: u64) -> Result<(), String> {
        if after != self.gift_day {
            return Err(i18n::t("error.bad_request"));
        }
        self.gift_wait = Some(GiftWait {
            after: after.into(),
            due_at,
        });
        Ok(())
    }

    /// A friend that left: its levels are forgotten with its bond; what it brought stays.
    pub fn forget_friend(&mut self, pet: &str) {
        self.thanked.remove(pet);
    }

    /// Moves a decoration to (x, y).
    pub fn move_decor(&mut self, id: &str, x: f64, y: f64) -> Result<(), String> {
        let (Some(x), Some(y)) = (place(x), place(y)) else {
            return Err(i18n::t("error.bad_request"));
        };
        let d = self
            .decor
            .iter_mut()
            .find(|d| d.id == id)
            .ok_or_else(|| i18n::t("error.decor_missing"))?;
        (d.x, d.y) = (x, y);
        Ok(())
    }

    /// Puts a decoration away (a friend may bring it again another day). A memento goes into the
    /// box instead, to be set out again; with the box full it goes as any gift does, so a yard of
    /// mementos and a full box can still make room.
    pub fn put_away(&mut self, id: &str) -> Result<(), String> {
        let at = self
            .decor
            .iter()
            .position(|d| d.id == id)
            .ok_or_else(|| i18n::t("error.decor_missing"))?;
        let gone = self.decor.remove(at);
        if gone.memento && self.boxed.len() < BOX_MAX {
            self.boxed.push(gone);
        }
        Ok(())
    }
}

/// How many of the catalogue's first everyday gifts a memento is picked from. Gifts added after
/// them do not change any friend's memento (docs/how-to/add-to-the-yard.md: new gifts go last).
const MEMENTO_KINDS: usize = 16;

/// A friend's memento: one of the everyday gifts, always the same for the same friend.
pub fn memento_kind(from: &str) -> &'static str {
    let mut kinds = catalog().gifts();
    kinds.truncate(MEMENTO_KINDS);
    // FNV-1a: stable across runs and builds, unlike the standard hasher.
    let hash = from.bytes().fold(0xcbf2_9ce4_8422_2325_u64, |h, b| {
        (h ^ u64::from(b)).wrapping_mul(0x100_0000_01b3)
    });
    kinds
        .get((hash % kinds.len().max(1) as u64) as usize)
        .copied()
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn discovery_state_defaults_and_future_kinds_survive_restore() {
        let old = serde_json::to_value(Garden::restore(None, 0)).unwrap();
        assert_eq!(old["trees"], json!([]));
        assert_eq!(old["digs"], json!([]));
        let g = Garden::restore(
            Some(
                &json!({"trees":[{"id":"future", "world":"removed-scene", "kind":"future_tree", "x":0.5,"y":0.5,"planted":1,"stage":2,"matured":true}]}),
            ),
            0,
        );
        assert_eq!(serde_json::to_value(g).unwrap()["trees"][0]["kind"], "future_tree");
    }

    #[test]
    fn a_gift_with_a_bad_giver_or_memento_mark_is_kept() {
        let g = Garden::restore(
            Some(&json!({
                "decor": [{"id": "a", "kind": "bench", "x": 0.5, "y": 0.5, "from": 7, "memento": "yes"}],
                "boxed": [{"id": "b", "kind": "tent", "x": 0.5, "y": 0.5, "from": "miso", "memento": 1}]
            })),
            0,
        );
        assert_eq!((g.decor.len(), g.boxed.len()), (1, 1));
        assert_eq!((g.decor[0].from.as_deref(), g.decor[0].memento), (None, false));
        assert_eq!((g.boxed[0].from.as_deref(), g.boxed[0].memento), (Some("miso"), false));
    }

    #[test]
    fn sapling_restore_caps_counts_and_preserves_safe_future_species() {
        let g = Garden::restore(
            Some(&json!({"seeds": 8, "saplings": {
                "cherry": 100, "future_tree": 4, "pine": -1, "maple": "2", "bad key": 2
            }})),
            0,
        );
        let saved = serde_json::to_value(g).unwrap();
        assert_eq!(saved["seeds"], 8);
        assert_eq!(saved["saplings"], json!({"cherry":20,"future_tree":4}));
        assert_eq!(serde_json::to_value(Garden::default()).unwrap()["saplings"], json!({}));
    }

    #[test]
    fn planting_spends_one_existing_seed() {
        let mut g = Garden::default();
        assert!(g.plant("tulip", 0.5, 0.5, 1).is_err(), "no seed, nothing to plant");
        g.seeds = SEED_MAX;
        let p = g.plant("cosmos", 1.4, -0.2, 7).unwrap();
        assert_eq!(
            (p.x, p.y, p.planted, g.seeds),
            (1.0, 0.0, 7, SEED_MAX - 1),
            "kept on the field"
        );
        assert!(g.plant("cactus", 0.5, 0.5, 1).is_err(), "only the season flowers grow");
        assert!(g.plant("tulip", f64::NAN, 0.5, 1).is_err());
        assert_eq!(g.seeds, SEED_MAX - 1, "a refused planting costs no seed");
    }

    #[test]
    fn the_field_holds_so_many_plants_and_a_plant_can_be_pulled() {
        let mut g = Garden {
            seeds: SEED_MAX,
            ..Default::default()
        };
        for _ in 0..PLANT_MAX {
            if g.seeds == 0 {
                g.seeds = SEED_MAX;
            }
            g.plant("tulip", 0.5, 0.5, 1).unwrap();
        }
        g.seeds = 1;
        assert!(g.plant("tulip", 0.5, 0.5, 1).is_err(), "the field is full");
        let id = g.plants[0].id.clone();
        assert_eq!(g.pull(&id), Ok(()));
        assert!(g.pull(&id).is_err(), "pulled already");
        assert_eq!(g.plants.len(), PLANT_MAX - 1);
    }

    #[test]
    fn a_flower_is_counted_once_and_only_once_it_has_flowered() {
        let mut g = Garden {
            seeds: 1,
            ..Default::default()
        };
        let id = g.plant("cosmos", 0.5, 0.5, 1_000).unwrap().id;
        assert!(
            g.bloom(&id, 1_000 + catalog().bloom_after_ms() - 1).is_err(),
            "still a bud"
        );
        assert_eq!(
            g.bloom(&id, 1_000 + catalog().bloom_after_ms()),
            Ok(Some("cosmos".into()))
        );
        assert_eq!(g.bloom(&id, 9_999_999_999), Ok(None), "counted already");
        assert!(g.bloom("nope", 1).is_err());
    }

    /// The `n`th day a gift may come, GIFT_EVERY_DAYS apart from 2026-11-01.
    fn gift_day(n: usize) -> String {
        let start = 1_793_491_200_000_u64; // 2026-11-01, noon UTC
        super::super::latest_day(start + (n as u64) * GIFT_EVERY_DAYS as u64 * 86_400_000)
    }

    #[test]
    fn an_everyday_gift_comes_every_other_day_each_kind_first_in_order() {
        let mut g = Garden::default();
        assert!(g.gift(0.5, 0.5, "today", 0, None, "miso").is_err(), "a day is a date");
        let first = g.gift(0.3, 1.7, &gift_day(0), 0, None, "miso").unwrap();
        assert_eq!(
            (first.decor.kind.as_str(), first.decor.y, first.boxed),
            ("bench", 1.0, false)
        );
        assert_eq!(first.decor.from.as_deref(), Some("miso"));
        let next_day = super::super::latest_day(1_793_491_200_000 + 86_400_000);
        assert!(
            g.gift(0.5, 0.5, &gift_day(0), 0, None, "miso").is_err(),
            "not twice a day"
        );
        assert!(
            g.gift(0.5, 0.5, &next_day, 0, None, "miso").is_err(),
            "not the next day"
        );
        let kinds = catalog().gifts();
        // The first gifts come in the catalogue's order, until the yard is full.
        for (i, kind) in kinds.iter().enumerate().skip(1).take(DECOR_MAX - 1) {
            assert_eq!(
                g.gift(0.5, 0.5, &gift_day(i), 0, None, "pip").unwrap().decor.kind,
                *kind
            );
        }
        assert_eq!(g.decor.len(), DECOR_MAX);
        // A full yard keeps the next gifts in the box, in order, until the box is full too.
        for (n, kind) in kinds.iter().enumerate().skip(DECOR_MAX).take(BOX_MAX) {
            let given = g.gift(0.5, 0.5, &gift_day(n), 0, None, "pip").unwrap();
            assert!(given.boxed);
            assert_eq!(given.decor.kind, *kind);
        }
        assert_eq!(g.boxed.len(), (kinds.len() - DECOR_MAX).min(BOX_MAX));
        // Every kind has come: the next is one not in the yard.
        let id = g.decor[0].id.clone();
        assert_eq!(g.put_away(&id), Ok(()));
        let next = g.next_gift(3);
        assert!(!g.decor.iter().any(|d| d.kind == next), "{next} is not in the yard");
        // During a seasonal event its own gift comes the first time, then the everyday ones again.
        let mut e = Garden::default();
        assert_eq!(
            e.gift(0.5, 0.5, "2026-12-20", 0, Some("lights"), "miso")
                .unwrap()
                .decor
                .kind,
            "snowman"
        );
        assert_eq!(
            e.gift(0.5, 0.5, "2026-12-22", 0, Some("lights"), "miso")
                .unwrap()
                .decor
                .kind,
            "bench"
        );
        assert!(
            e.gift(0.5, 0.5, "2026-12-01", 0, None, "miso").is_err(),
            "not on a day before the last"
        );
        assert_eq!(
            e.gift(0.5, 0.5, "2027-06-01", 0, Some("blossom"), "miso")
                .unwrap()
                .decor
                .kind,
            "lantern",
            "not its days"
        );
        let id = g.decor[1].id.clone();
        assert_eq!(g.move_decor(&id, -1.0, 0.25), Ok(()));
        assert_eq!((g.decor[1].x, g.decor[1].y), (0.0, 0.25));
        assert!(g.move_decor("nope", 0.5, 0.5).is_err());
        assert!(g.put_away("nope").is_err());
    }

    #[test]
    fn the_box_keeps_gifts_until_there_is_room_and_then_they_are_set_out() {
        let mut g = Garden::default();
        for n in 0..=DECOR_MAX {
            g.gift(0.5, 0.5, &gift_day(n), 0, None, "miso").unwrap();
        }
        let waiting = g.boxed[0].id.clone();
        assert!(g.set_out(&waiting, 0.5, 0.5).is_err(), "the yard is still full");
        let id = g.decor[0].id.clone();
        g.put_away(&id).unwrap();
        let out = g.set_out(&waiting, 0.2, 0.8).unwrap();
        assert_eq!((out.x, out.y), (0.2, 0.8));
        assert!(g.boxed.is_empty());
        assert_eq!(g.decor.len(), DECOR_MAX);
        assert!(g.set_out("nope", 0.5, 0.5).is_err());
    }

    #[test]
    fn a_full_yard_and_box_take_no_gift_and_can_always_make_room() {
        let mut g = Garden::default();
        let gift = |kind: &str, memento| Decor {
            id: Uuid::new_v4().to_string(),
            kind: kind.into(),
            x: 0.5,
            y: 0.5,
            from: Some("miso".into()),
            memento,
        };
        // Every kind has come before; the yard holds a few of them, all mementos.
        g.received = catalog().gifts().iter().map(|k| k.to_string()).collect();
        g.decor = (0..DECOR_MAX).map(|_| gift("bench", true)).collect();
        g.boxed = vec![gift("lantern", false), gift("pond", false)];
        // The box is not filled with what is already in it.
        for turn in 0..catalog().gifts().len() {
            let next = g.next_gift(turn);
            assert!(
                !["bench", "lantern", "pond"].contains(&next),
                "{next} is in the yard or the box"
            );
        }
        // A memento or thanks gift that finds the yard full waits in the box too.
        let thanks = g.thanks("pip", 4, 0.5, 0.5, 0).unwrap();
        assert!(thanks.boxed && thanks.decor.memento);
        while g.boxed.len() < BOX_MAX {
            g.boxed.push(gift("swing", false));
        }
        assert_eq!(
            g.thanks("pip", 5, 0.5, 0.5, 0).unwrap_err(),
            i18n::t("error.gifts_full")
        );
        assert_eq!(
            g.gift(0.5, 0.5, &gift_day(0), 0, None, "pip").unwrap_err(),
            i18n::t("error.gifts_full")
        );
        assert_eq!(g.thanked.get("pip"), Some(&4), "a refused gift is not counted");
        // With the box full, a memento put away goes as any gift does, so the yard has room again.
        let id = g.decor[0].id.clone();
        g.put_away(&id).unwrap();
        assert_eq!((g.decor.len(), g.boxed.len()), (DECOR_MAX - 1, BOX_MAX));
        let waiting = g.boxed[0].id.clone();
        assert!(g.set_out(&waiting, 0.5, 0.8).is_ok());
    }

    #[test]
    fn a_friend_brings_one_gift_a_level_and_its_own_memento_at_level_four() {
        let mut g = Garden::default();
        assert!(
            g.thanks("miso", 1, 0.5, 0.5, 0).is_err(),
            "level 1 is where friends start"
        );
        assert!(g.thanks("miso", 6, 0.5, 0.5, 0).is_err());
        let two = g.thanks("miso", 2, 0.5, 0.5, 0).unwrap();
        assert!(!two.decor.memento);
        assert!(g.thanks("miso", 2, 0.5, 0.5, 0).is_err(), "once a level");
        let four = g.thanks("miso", 4, 0.5, 0.5, 0).unwrap();
        assert!(four.decor.memento);
        assert_eq!(four.decor.kind, memento_kind("miso"));
        assert!(
            g.thanks("miso", 3, 0.5, 0.5, 0).is_err(),
            "a level passed is not given again"
        );
        assert!(
            !g.thanks("miso", 5, 0.5, 0.5, 0).unwrap().decor.memento,
            "one memento a friend"
        );
        // A friend already past level 4 when mementos began still brings one at its next level.
        assert!(g.thanks("pip", 5, 0.5, 0.5, 0).unwrap().decor.memento);
        // The same friend has the same memento on every run; friends differ between them.
        assert_eq!(memento_kind("miso"), memento_kind("miso"));
        assert_ne!(memento_kind("miso"), memento_kind("pip"));
        assert!(catalog().gifts().contains(&memento_kind("miso")));
        // A friend's memento stays the same when gifts are added: these come from the first 16.
        assert_eq!(
            ["miso", "pip", "clover", "daisy"].map(memento_kind),
            ["windchime", "pinwheel", "swing", "flowerpot"],
            "a new gift goes last in the catalogue"
        );
        // Thanks gifts leave the everyday gift's day alone.
        assert_eq!(g.gift_day, "");
        // A memento put away waits in the box; another gift is simply gone.
        let memento = g.decor.iter().find(|d| d.memento).unwrap().id.clone();
        g.put_away(&memento).unwrap();
        assert!(g.boxed.iter().any(|d| d.id == memento));
        assert!(g.has_memento("miso"));
        g.forget_friend("miso");
        assert!(!g.thanked.contains_key("miso"));
    }

    #[test]
    fn the_wait_for_the_next_gift_is_kept_only_for_the_last_gift() {
        let mut g = Garden::default();
        assert!(
            g.wait_for_gift("2026-11-01", 5).is_err(),
            "not after a gift that did not come"
        );
        g.wait_for_gift("", 5).unwrap();
        assert_eq!(
            g.gift_wait,
            Some(GiftWait {
                after: String::new(),
                due_at: 5
            })
        );
        g.gift(0.5, 0.5, &gift_day(0), 0, None, "miso").unwrap();
        assert_eq!(g.gift_wait, None, "a gift ends the wait for it");
    }

    #[test]
    fn a_saved_garden_is_read_back_keeping_only_what_makes_sense() {
        let raw = json!({
            "seeds": 999,
            "plants": [
                {"id": "a", "kind": "tulip", "x": 0.2, "y": 0.4, "planted": 5},
                {"id": "b", "kind": "weed", "x": 0.2, "y": 0.4, "planted": 5},
                {"id": "c", "kind": "cosmos", "x": 3.0, "y": 0.4, "planted": 5},
                {"id": "d", "kind": "cosmos"}
            ]
        });
        let g = Garden::restore(Some(&raw), 0);
        assert_eq!(g.seeds, SEED_MAX);
        assert_eq!(g.plants.iter().map(|p| p.id.as_str()).collect::<Vec<_>>(), ["a", "c"]);
        assert_eq!(g.plants[1].x, 1.0);
        assert_eq!(Garden::restore(None, 0), Garden::default());
        let with_decor = Garden::restore(
            Some(&json!({
                "decor": [{"id": "a", "kind": "bench", "x": 0.5, "y": 2.0}, {"id": "b", "kind": "castle", "x": 0.5, "y": 0.5}],
                "received": ["bench", "bench", "castle", "lantern"],
                "giftDay": "2026-10-09"
            })),
            0,
        );
        assert_eq!(with_decor.decor.len(), 1);
        assert_eq!(with_decor.decor[0].y, 1.0);
        assert_eq!(with_decor.received, ["bench", "lantern"]);
        assert_eq!(with_decor.gift_day, "2026-10-09");
        assert_eq!(Garden::restore(Some(&json!({"giftDay": "soon"})), 0).gift_day, "");
        let boxed = Garden::restore(
            Some(&json!({
                "giftDay": "2026-10-09",
                "boxed": [{"id": "k", "kind": "swing", "x": 0.5, "y": 0.5, "from": "miso", "memento": true}, {"id": "z", "kind": "castle", "x": 0.5, "y": 0.5}],
                "thanked": {"miso": 4, "pip": 99, "odd": "high"},
                "giftWait": {"after": "2026-10-09", "dueAt": 77}
            })),
            0,
        );
        assert_eq!(boxed.boxed.len(), 1);
        assert!(boxed.has_memento("miso"));
        assert_eq!(boxed.thanked.get("miso"), Some(&4));
        assert_eq!(boxed.thanked.get("pip"), Some(&5));
        assert!(!boxed.thanked.contains_key("odd"));
        assert_eq!(boxed.gift_wait.as_ref().map(|w| w.due_at), Some(77));
        let stale = Garden::restore(
            Some(&json!({"giftDay": "2026-10-11", "giftWait": {"after": "2026-10-09", "dueAt": 77}})),
            0,
        );
        assert_eq!(stale.gift_wait, None, "a wait for an older gift is dropped");
        assert_eq!(Garden::restore(Some(&json!("nonsense")), 0), Garden::default());
    }
}
