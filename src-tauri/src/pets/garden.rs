//! The garden friends and the person grow together: seeds a friend found, the plants grown from
//! them, and the decorations friends bring as gifts, one a day. The page decides when a friend
//! finds a seed or brings a gift (it knows who is idle, whether the yard is seen and what day it
//! is where the person lives); every limit, and which gift comes next, is kept here. Growth is not
//! stored: a plant's stage follows from when it was planted (src/yard/garden.js).
//! Design: docs/design/2026-10-09-a-yard-that-grows.md.
use crate::i18n;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// Seeds a pocket holds; a full pocket asks for some planting before more are found.
pub const SEED_MAX: u32 = 20;
/// Plants the field holds, so it stays a field.
pub const PLANT_MAX: usize = 24;
/// What can grow: one flower for each season it was planted in.
pub const KINDS: [&str; 4] = ["tulip", "sunflower", "cosmos", "camellia"];
/// Decorations friends bring, in the order the first ones come.
pub const DECOR_KINDS: [&str; 6] = ["bench", "lantern", "birdhouse", "pond", "mailbox", "picnic"];
/// Decorations the yard holds, so friends still have room to play.
pub const DECOR_MAX: usize = 8;

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Garden {
    pub seeds: u32,
    pub plants: Vec<Plant>,
    pub decor: Vec<Decor>,
    /// Every kind of decoration ever given, in the order it came.
    pub received: Vec<String>,
    /// The day the last gift came, as the page's local date (YYYY-MM-DD).
    pub gift_day: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Decor {
    pub id: String,
    pub kind: String,
    /// Where it stands on the field, as plants do.
    pub x: f64,
    pub y: f64,
}

/// A day as the page writes it: YYYY-MM-DD.
fn is_day(text: &str) -> bool {
    let b = text.as_bytes();
    b.len() == 10
        && b[4] == b'-'
        && b[7] == b'-'
        && b.iter()
            .enumerate()
            .all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit())
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

/// How long a seed takes to flower, as the page grows it (src/yard/growth.js STAGES; a test keeps
/// the two the same).
pub const BLOOM_AFTER_MS: u64 = 4 * 60 * 60 * 1000;

fn place(v: f64) -> Option<f64> {
    v.is_finite().then(|| v.clamp(0.0, 1.0))
}

impl Garden {
    /// The garden as state.json has it, keeping only what makes sense (a hand-edited or older file).
    pub fn restore(raw: Option<&Value>) -> Garden {
        let Some(raw) = raw else { return Garden::default() };
        let seeds = raw
            .get("seeds")
            .and_then(Value::as_u64)
            .unwrap_or(0)
            .min(SEED_MAX as u64) as u32;
        let plants = raw
            .get("plants")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter_map(|p| serde_json::from_value::<Plant>(p.clone()).ok())
            .filter(|p| KINDS.contains(&p.kind.as_str()) && p.x.is_finite() && p.y.is_finite())
            .map(|p| Plant {
                x: p.x.clamp(0.0, 1.0),
                y: p.y.clamp(0.0, 1.0),
                ..p
            })
            .take(PLANT_MAX)
            .collect();
        let decor = raw
            .get("decor")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter_map(|d| serde_json::from_value::<Decor>(d.clone()).ok())
            .filter(|d| DECOR_KINDS.contains(&d.kind.as_str()) && d.x.is_finite() && d.y.is_finite())
            .map(|d| Decor {
                x: d.x.clamp(0.0, 1.0),
                y: d.y.clamp(0.0, 1.0),
                ..d
            })
            .take(DECOR_MAX)
            .collect();
        let mut received: Vec<String> = Vec::new();
        for kind in raw.get("received").and_then(Value::as_array).into_iter().flatten() {
            if let Some(kind) = kind.as_str()
                && DECOR_KINDS.contains(&kind)
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
        Garden {
            seeds,
            plants,
            decor,
            received,
            gift_day,
        }
    }

    /// A friend found a seed. Returns the seeds now in the pocket.
    pub fn find(&mut self) -> Result<u32, String> {
        if self.seeds >= SEED_MAX {
            return Err(i18n::t("error.seeds_full"));
        }
        self.seeds += 1;
        Ok(self.seeds)
    }

    /// Puts a seed in the ground at (x, y). `now` is ms since 1970.
    pub fn plant(&mut self, kind: &str, x: f64, y: f64, now: u64) -> Result<Plant, String> {
        if self.seeds == 0 {
            return Err(i18n::t("error.no_seeds"));
        }
        if self.plants.len() >= PLANT_MAX {
            return Err(i18n::tr("error.garden_full", &[("limit", &PLANT_MAX.to_string())]));
        }
        let (Some(x), Some(y), true) = (place(x), place(y), KINDS.contains(&kind)) else {
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
        if now.saturating_sub(plant.planted) < BLOOM_AFTER_MS {
            return Err(i18n::t("error.bad_request"));
        }
        if plant.bloomed {
            return Ok(None);
        }
        plant.bloomed = true;
        Ok(Some(plant.kind.clone()))
    }

    /// What the next gift is: each kind once, in order; after that one that is not in the yard
    /// (any kind, once every kind is), turned by `turn` so it is not always the same.
    pub fn next_gift(&self, turn: usize) -> &'static str {
        if let Some(kind) = DECOR_KINDS.iter().find(|k| !self.received.iter().any(|r| r == *k)) {
            return kind;
        }
        let away: Vec<&'static str> = DECOR_KINDS
            .iter()
            .copied()
            .filter(|k| !self.decor.iter().any(|d| d.kind == *k))
            .collect();
        let from = if away.is_empty() { DECOR_KINDS.to_vec() } else { away };
        from[turn % from.len()]
    }

    /// A friend brings today's gift and sets it down at (x, y). `day` is the page's local date.
    pub fn gift(&mut self, x: f64, y: f64, day: &str, turn: usize) -> Result<Decor, String> {
        let (Some(x), Some(y), true) = (place(x), place(y), is_day(day)) else {
            return Err(i18n::t("error.bad_request"));
        };
        if self.gift_day == day {
            return Err(i18n::t("error.gift_today"));
        }
        if self.decor.len() >= DECOR_MAX {
            return Err(i18n::tr("error.decor_full", &[("limit", &DECOR_MAX.to_string())]));
        }
        let kind = self.next_gift(turn);
        let decor = Decor {
            id: Uuid::new_v4().to_string(),
            kind: kind.into(),
            x,
            y,
        };
        if !self.received.iter().any(|k| k == kind) {
            self.received.push(kind.into());
        }
        self.gift_day = day.into();
        self.decor.push(decor.clone());
        Ok(decor)
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

    /// Puts a decoration away (a friend may bring it again another day).
    pub fn put_away(&mut self, id: &str) -> Result<(), String> {
        let before = self.decor.len();
        self.decor.retain(|d| d.id != id);
        if self.decor.len() == before {
            return Err(i18n::t("error.decor_missing"));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn seeds_are_found_up_to_a_full_pocket_and_planting_spends_one() {
        let mut g = Garden::default();
        assert!(g.plant("tulip", 0.5, 0.5, 1).is_err(), "no seed, nothing to plant");
        for n in 1..=SEED_MAX {
            assert_eq!(g.find(), Ok(n));
        }
        assert!(g.find().is_err(), "a full pocket finds no more");
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
        assert!(g.bloom(&id, 1_000 + BLOOM_AFTER_MS - 1).is_err(), "still a bud");
        assert_eq!(g.bloom(&id, 1_000 + BLOOM_AFTER_MS), Ok(Some("cosmos".into())));
        assert_eq!(g.bloom(&id, 9_999_999_999), Ok(None), "counted already");
        assert!(g.bloom("nope", 1).is_err());
    }

    #[test]
    fn a_gift_comes_once_a_day_each_kind_first_in_order_and_the_yard_holds_so_many() {
        let mut g = Garden::default();
        assert!(g.gift(0.5, 0.5, "today", 0).is_err(), "a day is a date");
        let first = g.gift(0.3, 1.7, "2026-10-09", 0).unwrap();
        assert_eq!((first.kind.as_str(), first.y), ("bench", 1.0));
        assert!(g.gift(0.5, 0.5, "2026-10-09", 0).is_err(), "one gift a day");
        for (i, day) in ["2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14"]
            .iter()
            .enumerate()
        {
            assert_eq!(g.gift(0.5, 0.5, day, 0).unwrap().kind, DECOR_KINDS[i + 1]);
        }
        // Every kind has come: the next is one not in the yard.
        let bench = g.decor[0].id.clone();
        assert_eq!(g.put_away(&bench), Ok(()));
        assert_eq!(g.next_gift(3), "bench", "the only kind not in the yard");
        assert_eq!(g.gift(0.5, 0.5, "2026-10-15", 3).unwrap().kind, "bench");
        g.gift(0.5, 0.5, "2026-10-16", 1).unwrap();
        g.gift(0.5, 0.5, "2026-10-17", 2).unwrap();
        assert_eq!(g.decor.len(), DECOR_MAX);
        assert!(g.gift(0.5, 0.5, "2026-10-18", 0).is_err(), "the yard is full");
        let id = g.decor[1].id.clone();
        assert_eq!(g.move_decor(&id, -1.0, 0.25), Ok(()));
        assert_eq!((g.decor[1].x, g.decor[1].y), (0.0, 0.25));
        assert!(g.move_decor("nope", 0.5, 0.5).is_err());
        assert!(g.put_away("nope").is_err());
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
        let g = Garden::restore(Some(&raw));
        assert_eq!(g.seeds, SEED_MAX);
        assert_eq!(g.plants.iter().map(|p| p.id.as_str()).collect::<Vec<_>>(), ["a", "c"]);
        assert_eq!(g.plants[1].x, 1.0);
        assert_eq!(Garden::restore(None), Garden::default());
        let with_decor = Garden::restore(Some(&json!({
            "decor": [{"id": "a", "kind": "bench", "x": 0.5, "y": 2.0}, {"id": "b", "kind": "castle", "x": 0.5, "y": 0.5}],
            "received": ["bench", "bench", "castle", "lantern"],
            "giftDay": "2026-10-09"
        })));
        assert_eq!(with_decor.decor.len(), 1);
        assert_eq!(with_decor.decor[0].y, 1.0);
        assert_eq!(with_decor.received, ["bench", "lantern"]);
        assert_eq!(with_decor.gift_day, "2026-10-09");
        assert_eq!(Garden::restore(Some(&json!({"giftDay": "soon"}))).gift_day, "");
        assert_eq!(Garden::restore(Some(&json!("nonsense"))), Garden::default());
    }
}
