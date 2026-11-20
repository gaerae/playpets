//! The garden friends and the person grow together: seeds a friend found, the plants grown from
//! them, and the decorations friends bring as gifts. Digging awards seeds and saplings.
//! A friend brings a gift on a day the two did something together, every few days, and one when it
//! grows closer (a memento of its own at level 4); while the yard is full they wait in a box.
//! The page decides when (it knows who is idle, whether the yard is seen and the local day); every
//! limit, and which gift comes next, is kept here. Growth is not stored: a plant's stage follows
//! from when it was planted (src/yard/garden.js). What can grow and what friends bring are the
//! catalogue's (content.rs).
//! What the album found hangs on the Christmas tree whenever it is out, three a day on its twelve
//! hooks; each Christmas's first hang (from November 15) takes last year's down, so every Christmas
//! starts a fresh tree.
//! Design: docs/design/2026-10-09-a-yard-that-grows.md, docs/design/2026-10-29-gifts-from-friends.md.
use super::album::Album;
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
/// Plants the field holds, twelve as of every kind (docs/decisions/2026-11-20-twelve-of-each.md).
pub const PLANT_MAX: usize = 12;
/// Plants a saved yard keeps: one saved when the field held 24 loses none of them.
pub const PLANT_KEEP: usize = 24;
/// Gifts the yard holds, so friends still have room to play.
pub const DECOR_MAX: usize = 12;
/// Finds (fish, bugs, keepsakes) out of the album the yard holds, apart from the gifts.
/// Design: docs/decisions/2026-11-20-twelve-of-each.md.
pub const FIND_MAX: usize = 12;
/// Gifts a saved box keeps. Waiting has no limit of its own: one of each kind waits, and each
/// friend's memento, so this only stops a hand-edited file growing without end.
const BOX_KEEP: usize = 64;
/// Days from one everyday gift to the next.
pub const GIFT_EVERY_DAYS: i64 = 2;
/// The levels a friend brings a gift for when it reaches them; at MEMENTO_LEVEL it is a memento.
pub const THANKS_LEVELS: std::ops::RangeInclusive<u32> = 2..=5;
pub const MEMENTO_LEVEL: u32 = 4;
/// Hooks on the Christmas tree, the same places on its small and grand drawings (catalog.json).
pub const ORNAMENT_HOOKS: u32 = 12;
/// Ornaments hung in a day.
pub const ORNAMENTS_PER_DAY: u32 = 3;
/// The gift the ornaments hang on, which never hangs on itself.
const ORNAMENT_TREE: &str = "xmas_tree";
/// The gift the person builds from snow in winter; it is built, never brought or set out.
pub const SNOWMAN: &str = "snowman";
/// The books an ornament comes from (src/panel/album.js BOOKS): not fish or bugs.
const ORNAMENT_BOOKS: [&str; 4] = ["flower", "tree", "gift", "treasure"];

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
    /// What hangs on the Christmas tree in the Christmas of `ornament_year` (ornament_season).
    #[serde(default)]
    pub ornaments: Vec<Ornament>,
    /// The page's local day of the last hang and how many were hung on it.
    #[serde(default)]
    pub ornament_day: OrnamentDay,
    /// The decorating season (ornament_season) of the last hang; 0 before the first.
    #[serde(default)]
    pub ornament_year: u32,
    /// The local day a snowman was last built; the page decides when, the backend refuses a
    /// second the same day.
    #[serde(default)]
    pub snowman_day: String,
    /// The local day friends last gathered under the blossom (YYYY-MM-DD, or empty); the page
    /// decides when, so it comes once a day and a restart remembers.
    #[serde(default)]
    pub viewed: String,
    /// The local day a caught petal last brought the special wish line (YYYY-MM-DD, or empty);
    /// the page decides when.
    #[serde(default)]
    pub wished: String,
}

/// A find from the album (`book` and its `id`) hung on hook `hook` of the Christmas tree.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Ornament {
    pub book: String,
    pub id: String,
    pub hook: u32,
}

/// The day ornaments were last hung (YYYY-MM-DD) and how many that day.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
pub struct OrnamentDay {
    pub day: String,
    pub count: u32,
}

/// The Christmas a day decorates for: its year from November 15, when the winter lights start
/// (events.json), the year before until then.
fn ornament_season(day: &str) -> u32 {
    let year = day.get(0..4).and_then(|y| y.parse::<u32>().ok()).unwrap_or(0);
    if day.get(5..10).is_some_and(|md| md >= "11-15") {
        year
    } else {
        year.saturating_sub(1)
    }
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

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
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
    /// When it came (ms); 0 for a gift from before this was kept. The page marks a memento as
    /// new for a while after it.
    #[serde(default, deserialize_with = "super::or_default", skip_serializing_if = "is_zero")]
    pub came_at: u64,
    /// Out on the desktop too, as a friend can be (src-tauri/src/desktop/).
    #[serde(
        rename = "onDesktop",
        default,
        deserialize_with = "super::or_default",
        skip_serializing_if = "std::ops::Not::not"
    )]
    pub on_desktop: bool,
    /// Where it was last left on the desktop, in logical screen pixels.
    #[serde(
        rename = "desktopPosition",
        default,
        deserialize_with = "super::or_default",
        skip_serializing_if = "Option::is_none"
    )]
    pub desktop_position: Option<super::model::Pos>,
    /// What a built snowman wears, by the catalogue's `dress` ids.
    #[serde(
        default,
        deserialize_with = "super::or_default",
        skip_serializing_if = "Vec::is_empty"
    )]
    pub dress: Vec<String>,
    /// The find a find out holds, by its album id (catalog.json findsOut).
    #[serde(
        default,
        deserialize_with = "super::or_default",
        skip_serializing_if = "Vec::is_empty"
    )]
    pub holds: Vec<String>,
}

fn is_zero(n: &u64) -> bool {
    *n == 0
}

/// Which gift comes next is turned by the second a friend brings it (Garden::next_gift).
fn turn_of(now: u64) -> usize {
    (now / 1000) as usize
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
    /// Out on the desktop too, as a gift can be (src-tauri/src/desktop/).
    #[serde(
        rename = "onDesktop",
        default,
        deserialize_with = "super::or_default",
        skip_serializing_if = "std::ops::Not::not"
    )]
    pub on_desktop: bool,
    /// Where it was last left on the desktop, in logical screen pixels.
    #[serde(
        rename = "desktopPosition",
        default,
        deserialize_with = "super::or_default",
        skip_serializing_if = "Option::is_none"
    )]
    pub desktop_position: Option<super::model::Pos>,
}

/// Things kept on the field (plants, decorations) as state.json has them: the ones of a kind there
/// is, at a place that is a number, brought onto the field, and no more than `max`.
fn placed<T: serde::de::DeserializeOwned>(
    raw: Option<&Value>,
    max: usize,
    known: impl Fn(&T) -> bool,
    at: impl Fn(&mut T) -> (&mut f64, &mut f64),
    lowest: f64,
) -> Vec<T> {
    raw.and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|v| serde_json::from_value::<T>(v.clone()).ok())
        .filter(|t| known(t))
        .filter_map(|mut t| {
            let (x, y) = at(&mut t);
            *x = place(*x)?;
            *y = y.is_finite().then(|| y.clamp(0.0, lowest))?;
            Some(t)
        })
        .take(max)
        .collect()
}

/// Whether a decoration is a find out of the album (a fish, bug or keepsake on its own).
fn is_find(d: &Decor) -> bool {
    catalog().book_of(&d.kind).is_some()
}

fn place(v: f64) -> Option<f64> {
    v.is_finite().then(|| v.clamp(0.0, 1.0))
}

/// How far below the friends' field (y over 1) a gift, a flower or a tree may stand: they have no
/// name tag, so the page lets them down to just above the dock, a distance it measures in the
/// friends' field (src/yard/field.js decorFloor). Kept in those units, a thing placed before keeps
/// its place.
pub const DECOR_FLOOR_MAX: f64 = 4.0;

/// A gift's or a flower's place: across like any other, down to DECOR_FLOOR_MAX.
fn decor_place(x: f64, y: f64) -> Option<(f64, f64)> {
    Some((place(x)?, y.is_finite().then(|| y.clamp(0.0, DECOR_FLOOR_MAX))?))
}

/// A decoration as state.json has it: it wears only what its kind can, once each in drawing order.
fn tidy(d: &mut Decor) {
    d.dress = catalog()
        .dress_of(&d.kind)
        .into_iter()
        .filter(|part| d.dress.iter().any(|w| w == part))
        .map(String::from)
        .collect();
    // A find out keeps the first find its book has, and only that; a gift holds nothing.
    let book = catalog().book_of(&d.kind).unwrap_or_default();
    let kept = d.holds.drain(..).find(|id| catalog().holds(book, id));
    d.holds = kept.into_iter().collect();
}

/// Ornaments as state.json has them: a book of the four, an id shaped like a kind (not the tree
/// itself), a hook on the tree, and no hook or find twice.
fn restore_ornaments(raw: Option<&Value>) -> Vec<Ornament> {
    let mut kept: Vec<Ornament> = Vec::new();
    for o in raw.and_then(Value::as_array).into_iter().flatten() {
        let Ok(o) = serde_json::from_value::<Ornament>(o.clone()) else {
            continue;
        };
        let twice = kept
            .iter()
            .any(|k| k.hook == o.hook || (k.book == o.book && k.id == o.id));
        if ORNAMENT_BOOKS.contains(&o.book.as_str())
            && super::discovery::kind_id(&o.id)
            && o.id != ORNAMENT_TREE
            && o.hook < ORNAMENT_HOOKS
            && !twice
        {
            kept.push(o);
        }
    }
    kept
}

/// A saved local day under `key`, or empty when it is missing or not a day.
fn day_at(raw: &Value, key: &str) -> String {
    raw.get(key)
        .and_then(Value::as_str)
        .filter(|d| is_day(d))
        .unwrap_or_default()
        .to_string()
}

/// The last hang's day as state.json has it: a date, and no more than a day's hangs.
fn restore_ornament_day(raw: Option<&Value>) -> OrnamentDay {
    let day = raw
        .and_then(|d| d.get("day"))
        .and_then(Value::as_str)
        .filter(|d| is_day(d));
    let count = raw.and_then(|d| d.get("count")).and_then(Value::as_u64);
    match (day, count) {
        (Some(day), Some(count)) => OrnamentDay {
            day: day.into(),
            count: count.min(u64::from(ORNAMENTS_PER_DAY)) as u32,
        },
        _ => OrnamentDay::default(),
    }
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
            PLANT_KEEP,
            |p: &Plant| catalog().is_flower(&p.kind),
            |p| (&mut p.x, &mut p.y),
            DECOR_FLOOR_MAX,
        );
        let mut decor = placed(
            raw.get("decor"),
            DECOR_MAX + FIND_MAX,
            |d: &Decor| catalog().is_decor(&d.kind),
            |d| (&mut d.x, &mut d.y),
            DECOR_FLOOR_MAX,
        );
        decor.iter_mut().for_each(tidy);
        // A find out holding nothing has nothing to show; gifts and finds each keep their own room.
        decor.retain(|d| !is_find(d) || !d.holds.is_empty());
        let (mut gifts, mut finds) = (0, 0);
        decor.retain(|d| {
            let seen = if is_find(d) { &mut finds } else { &mut gifts };
            *seen += 1;
            *seen <= if is_find(d) { FIND_MAX } else { DECOR_MAX }
        });
        let mut received: Vec<String> = Vec::new();
        for kind in raw.get("received").and_then(Value::as_array).into_iter().flatten() {
            if let Some(kind) = kind.as_str()
                && catalog().is_gift(kind)
                && !received.iter().any(|k| k == kind)
            {
                received.push(kind.into());
            }
        }
        let gift_day = day_at(raw, "giftDay");
        let mut boxed = placed(
            raw.get("boxed"),
            BOX_KEEP,
            |d: &Decor| catalog().is_gift(&d.kind),
            |d| (&mut d.x, &mut d.y),
            DECOR_FLOOR_MAX,
        );
        boxed.iter_mut().for_each(tidy);
        let snowman_day = day_at(raw, "snowmanDay");
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
        // A season that is not a year drops what hung in it. Ornaments are kept by shape only: an
        // id the catalogue no longer has stays saved but is not drawn, and its hook stays taken.
        let ornament_year = raw
            .get("ornamentYear")
            .and_then(Value::as_u64)
            .filter(|y| (2000..=9999).contains(y))
            .unwrap_or(0) as u32;
        let (ornaments, ornament_day) = if ornament_year == 0 {
            (Vec::new(), OrnamentDay::default())
        } else {
            (
                restore_ornaments(raw.get("ornaments")),
                restore_ornament_day(raw.get("ornamentDay")),
            )
        };
        // A Christmas once started on December 1, so a hang from November 15 to 30 was saved as the
        // year before's. It moves to the Christmas its day belongs to now, so nothing that was up
        // goes on the update.
        let ornament_year = match ornament_day.day.get(5..10) {
            Some(md)
                if ("11-15"..="11-30").contains(&md) && ornament_season(&ornament_day.day) == ornament_year + 1 =>
            {
                ornament_year + 1
            }
            _ => ornament_year,
        };
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
            ornaments,
            ornament_day,
            ornament_year,
            snowman_day,
            viewed: day_at(raw, "viewed"),
            wished: day_at(raw, "wished"),
        }
    }

    /// The decorating season of `day` if the tree can be decorated then: a date, with the tree out
    /// in the yard, not before the last hang (a clock set back) nor in an earlier Christmas than it.
    /// No window of dates: the tree shows from November 15 and in any winter yard the page picks, and
    /// whatever shows can be decorated.
    fn decorating(&self, day: &str) -> Result<u32, String> {
        let season = ornament_season(day);
        let set_back = day < self.ornament_day.day.as_str() || season < self.ornament_year;
        if !is_day(day) || set_back || !self.decor.iter().any(|d| d.kind == ORNAMENT_TREE) {
            return Err(i18n::t("error.bad_request"));
        }
        Ok(season)
    }

    /// Hangs a find from the album on hook `hook` of the Christmas tree, on the page's local `day`:
    /// one of the four books' finds (a gift that came), once a season, on a free hook, three a day.
    /// Everything is checked before anything changes; the first hang of a Christmas takes last
    /// year's ornaments down.
    pub fn hang_ornament(
        &mut self,
        album: &Album,
        book: &str,
        id: &str,
        hook: u32,
        day: &str,
    ) -> Result<Ornament, String> {
        let season = self.decorating(day)?;
        let found = match book {
            "flower" => album.flowers.contains_key(id),
            "tree" => album.trees.contains_key(id),
            "treasure" => album.treasures.contains_key(id),
            "gift" => self.received.iter().any(|k| k == id),
            _ => false,
        };
        let this_season = season == self.ornament_year;
        let hanging: &[Ornament] = if this_season { &self.ornaments } else { &[] };
        let taken = hanging.iter().any(|o| o.hook == hook || (o.book == book && o.id == id));
        if !found || id == ORNAMENT_TREE || hook >= ORNAMENT_HOOKS || taken {
            return Err(i18n::t("error.bad_request"));
        }
        if this_season && self.ornament_day.day == day && self.ornament_day.count >= ORNAMENTS_PER_DAY {
            return Err(i18n::t("error.ornaments_today"));
        }
        if !this_season {
            self.ornaments.clear();
            self.ornament_day = OrnamentDay::default();
            self.ornament_year = season;
        }
        if self.ornament_day.day != day {
            self.ornament_day = OrnamentDay {
                day: day.into(),
                count: 0,
            };
        }
        let ornament = Ornament {
            book: book.into(),
            id: id.into(),
            hook,
        };
        self.ornaments.push(ornament.clone());
        self.ornament_day.count += 1;
        Ok(ornament)
    }

    /// Takes an ornament of this Christmas down on the page's local `day`, freeing its hook. The
    /// day's count stays: a hang taken down is not given back.
    pub fn take_down_ornament(&mut self, book: &str, id: &str, day: &str) -> Result<Ornament, String> {
        let season = self.decorating(day)?;
        let at = self
            .ornaments
            .iter()
            .position(|o| o.book == book && o.id == id)
            .filter(|_| season == self.ornament_year)
            .ok_or_else(|| i18n::t("error.bad_request"))?;
        Ok(self.ornaments.remove(at))
    }

    /// Puts a seed in the ground at (x, y). `now` is ms since 1970.
    pub fn plant(&mut self, kind: &str, x: f64, y: f64, now: u64) -> Result<Plant, String> {
        if self.seeds == 0 {
            return Err(i18n::t("error.no_seeds"));
        }
        if self.plants.len() >= PLANT_MAX {
            return Err(i18n::tr("error.garden_full", &[("limit", &PLANT_MAX.to_string())]));
        }
        let (Some((x, y)), true) = (decor_place(x, y), catalog().is_flower(kind)) else {
            return Err(i18n::t("error.bad_request"));
        };
        let plant = Plant {
            id: Uuid::new_v4().to_string(),
            kind: kind.into(),
            x,
            y,
            planted: now,
            bloomed: false,
            on_desktop: false,
            desktop_position: None,
        };
        self.seeds -= 1;
        self.plants.push(plant.clone());
        Ok(plant)
    }

    /// The copies of an album kind out in the yard, by id in the order they came: a flower of the
    /// kind in bloom, a tree of it grown, a find out holding it, a gift of it (`book`: flower, tree,
    /// fish, bug, treasure or gift). A seedling or a young tree is still growing and is not one.
    /// Design: docs/design/2026-11-20-album-in-and-out.md.
    pub fn out_of_album(&self, book: &str, item: &str) -> Vec<String> {
        let ids = |it: &mut dyn Iterator<Item = &str>| it.map(String::from).collect();
        match book {
            "flower" => ids(&mut self
                .plants
                .iter()
                .filter(|p| p.kind == item && p.bloomed)
                .map(|p| p.id.as_str())),
            "tree" => ids(&mut self
                .trees
                .iter()
                .filter(|t| t.kind == item && t.matured)
                .map(|t| t.id.as_str())),
            "gift" => ids(&mut self.decor.iter().filter(|d| d.kind == item).map(|d| d.id.as_str())),
            _ => {
                let Some(kind) = catalog().find_out_for(book) else {
                    return Vec::new();
                };
                ids(&mut self
                    .decor
                    .iter()
                    .filter(|d| d.kind == kind && d.holds.first().is_some_and(|h| h == item))
                    .map(|d| d.id.as_str()))
            }
        }
    }

    /// Refuses one more copy of an album kind once as many are out as the album found.
    pub fn album_has_more(&self, album: &Album, book: &str, item: &str) -> Result<(), String> {
        let found = album.count(book, item);
        if self.out_of_album(book, item).len() >= found as usize {
            return Err(i18n::tr("error.album_all_out", &[("count", &found.to_string())]));
        }
        Ok(())
    }

    /// Sets a flower of a kind the album has into the field at (x, y), in bloom and free: its
    /// planting is put back by the bloom time, and it counts as flowered already, so the album gains
    /// nothing from it. As many of a kind in bloom as the album found, as long as the field has room.
    /// Design: docs/design/2026-11-19-album-take-out.md.
    pub fn take_out_flower(&mut self, album: &Album, kind: &str, x: f64, y: f64, now: u64) -> Result<Plant, String> {
        if !album.flowers.contains_key(kind) {
            return Err(i18n::t("error.bad_request"));
        }
        if self.plants.len() >= PLANT_MAX {
            return Err(i18n::tr("error.garden_full", &[("limit", &PLANT_MAX.to_string())]));
        }
        let (Some((x, y)), true) = (decor_place(x, y), catalog().is_flower(kind)) else {
            return Err(i18n::t("error.bad_request"));
        };
        self.album_has_more(album, "flower", kind)?;
        let plant = Plant {
            id: Uuid::new_v4().to_string(),
            kind: kind.into(),
            x,
            y,
            planted: now.saturating_sub(catalog().bloom_after_ms()),
            bloomed: true,
            on_desktop: false,
            desktop_position: None,
        };
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

    /// Moves a plant to another spot on the field; it keeps growing as it was.
    pub fn move_plant(&mut self, id: &str, x: f64, y: f64) -> Result<(), String> {
        let Some((x, y)) = decor_place(x, y) else {
            return Err(i18n::t("error.bad_request"));
        };
        let plant = self
            .plants
            .iter_mut()
            .find(|p| p.id == id)
            .ok_or_else(|| i18n::t("error.plant_missing"))?;
        (plant.x, plant.y) = (x, y);
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
    /// the dates check), its own gifts come first, in order, one each time. `now` (ms) is when it came.
    pub fn gift(
        &mut self,
        x: f64,
        y: f64,
        day: &str,
        now: u64,
        event: Option<&str>,
        from: &str,
    ) -> Result<Given, String> {
        let (Some((x, y)), true) = (decor_place(x, y), is_day(day)) else {
            return Err(i18n::t("error.bad_request"));
        };
        // Too soon after the last, or the page's clock went back to a day before it.
        if !self.gift_day.is_empty() && super::days_between(&self.gift_day, day).is_none_or(|d| d < GIFT_EVERY_DAYS) {
            return Err(i18n::t("error.gift_today"));
        }
        let kind = event
            .map(|e| super::content::event_gifts(e, day))
            .and_then(|gifts| gifts.into_iter().find(|g| !self.received.iter().any(|r| r == g)))
            .unwrap_or_else(|| self.next_gift(turn_of(now)));
        let given = self.give(kind, from, false, x, y, now)?;
        self.gift_day = day.into();
        self.gift_wait = None;
        Ok(given)
    }

    /// A friend that reached `level` brings a gift for it, once a level: at MEMENTO_LEVEL (or the
    /// first time after it) its memento, otherwise the next everyday one. The caller checks the
    /// friend has reached the level. `now` (ms) is when it came.
    pub fn thanks(&mut self, from: &str, level: u32, x: f64, y: f64, now: u64) -> Result<Given, String> {
        let Some((x, y)) = decor_place(x, y) else {
            return Err(i18n::t("error.bad_request"));
        };
        if !THANKS_LEVELS.contains(&level) || self.thanked.get(from).is_some_and(|&had| had >= level) {
            return Err(i18n::t("error.bad_request"));
        }
        let memento = level >= MEMENTO_LEVEL && !self.has_memento(from);
        let kind = if memento {
            memento_kind(from)
        } else {
            self.next_gift(turn_of(now))
        };
        let given = self.give(kind, from, memento, x, y, now)?;
        self.thanked.insert(from.into(), level);
        Ok(given)
    }

    /// Gifts out in the yard: decorations that are not finds out of the album.
    pub fn gifts_out(&self) -> usize {
        self.decor.iter().filter(|d| !is_find(d)).count()
    }
    /// Finds (fish, bugs, keepsakes) out of the album in the yard.
    pub fn finds_out(&self) -> usize {
        self.decor.iter().filter(|d| is_find(d)).count()
    }

    /// Whether a friend's memento is in the yard or the box.
    pub fn has_memento(&self, from: &str) -> bool {
        self.decor
            .iter()
            .chain(&self.boxed)
            .any(|d| d.memento && d.from.as_deref() == Some(from))
    }

    /// Sets a gift down, or puts it in the box when the yard is full; counted the first time.
    fn give(&mut self, kind: &str, from: &str, memento: bool, x: f64, y: f64, now: u64) -> Result<Given, String> {
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
            came_at: now,
            ..Decor::default()
        };
        let boxed = self.gifts_out() >= DECOR_MAX;
        // Waiting has no limit of its own: one of each kind waits, and each friend's memento. With
        // every kind out or waiting, none is brought twice.
        if boxed && !memento && self.decor.iter().chain(&self.boxed).any(|d| d.kind == kind) {
            return Err(i18n::t("error.gifts_full"));
        }
        if !self.received.iter().any(|k| k == kind) {
            self.received.push(kind.into());
        }
        if boxed { &mut self.boxed } else { &mut self.decor }.push(decor.clone());
        Ok(Given { decor, boxed })
    }

    /// Keeps the day friends gathered under the blossom; anything that is not a day is refused.
    pub fn mark_viewed(&mut self, day: &str) -> Result<(), String> {
        if !is_day(day) {
            return Err(i18n::t("error.bad_request"));
        }
        self.viewed = day.into();
        Ok(())
    }

    /// Keeps the day of the special wish; anything that is not a day is refused.
    pub fn mark_wished(&mut self, day: &str) -> Result<(), String> {
        if !is_day(day) {
            return Err(i18n::t("error.bad_request"));
        }
        self.wished = day.into();
        Ok(())
    }

    /// Builds a snowman at (x, y) on the page's local `day`: once a day, and it replaces the one in
    /// the yard (or the box), so a full yard that has one still has room. The first one is counted
    /// as received. `now` (ms) is when it was built.
    pub fn build_snowman(&mut self, x: f64, y: f64, day: &str, now: u64) -> Result<Decor, String> {
        let (Some((x, y)), true) = (decor_place(x, y), is_day(day)) else {
            return Err(i18n::t("error.bad_request"));
        };
        // The same day, or an earlier one (a clock set back), is no new day.
        if day <= self.snowman_day.as_str() {
            return Err(i18n::t("error.snowman_today"));
        }
        if !self.decor.iter().any(|d| d.kind == SNOWMAN) && self.gifts_out() >= DECOR_MAX {
            return Err(i18n::tr("error.decor_full", &[("limit", &DECOR_MAX.to_string())]));
        }
        self.decor.retain(|d| d.kind != SNOWMAN);
        self.boxed.retain(|d| d.kind != SNOWMAN);
        let snowman = Decor {
            id: Uuid::new_v4().to_string(),
            kind: SNOWMAN.into(),
            x,
            y,
            came_at: now,
            ..Decor::default()
        };
        if !self.received.iter().any(|k| k == SNOWMAN) {
            self.received.push(SNOWMAN.into());
        }
        self.snowman_day = day.into();
        self.decor.push(snowman.clone());
        Ok(snowman)
    }

    /// Sets what a decoration wears: only parts of its own kind, kept once each in the
    /// catalogue's drawing order.
    pub fn dress(&mut self, id: &str, wanted: &[String]) -> Result<(), String> {
        let d = self
            .decor
            .iter_mut()
            .find(|d| d.id == id)
            .ok_or_else(|| i18n::t("error.decor_missing"))?;
        let parts = catalog().dress_of(&d.kind);
        if wanted.iter().any(|w| !parts.contains(&w.as_str())) {
            return Err(i18n::t("error.bad_request"));
        }
        d.dress = parts
            .into_iter()
            .filter(|p| wanted.iter().any(|w| w == p))
            .map(String::from)
            .collect();
        Ok(())
    }

    /// Takes a gift out of the box and sets it down at (x, y).
    pub fn set_out(&mut self, id: &str, x: f64, y: f64) -> Result<Decor, String> {
        let Some((x, y)) = decor_place(x, y) else {
            return Err(i18n::t("error.bad_request"));
        };
        let at = self
            .boxed
            .iter()
            .position(|d| d.id == id)
            .ok_or_else(|| i18n::t("error.decor_missing"))?;
        if self.gifts_out() >= DECOR_MAX {
            return Err(i18n::tr("error.decor_full", &[("limit", &DECOR_MAX.to_string())]));
        }
        let mut decor = self.boxed.remove(at);
        (decor.x, decor.y) = (x, y);
        self.decor.push(decor.clone());
        Ok(decor)
    }

    /// Sets down again, at (x, y), a kind of gift that came before: what the album keeps can always
    /// come back out. One waiting in the box is that gift, set out with its giver and its heart; one
    /// in the yard already is not taken out twice.
    /// Design: docs/design/2026-11-20-album-in-and-out.md.
    pub fn take_out(&mut self, kind: &str, x: f64, y: f64, now: u64) -> Result<Decor, String> {
        if let Some(waiting) = self.boxed.iter().find(|d| d.kind == kind) {
            let id = waiting.id.clone();
            return self.set_out(&id, x, y);
        }
        let Some((x, y)) = decor_place(x, y) else {
            return Err(i18n::t("error.bad_request"));
        };
        if !self.received.iter().any(|k| k == kind) || !catalog().is_gift(kind) {
            return Err(i18n::t("error.decor_missing"));
        }
        // A built kind is built again, never set out; its put-away is a melt.
        if catalog().is_built(kind) || self.decor.iter().any(|d| d.kind == kind) {
            return Err(i18n::t("error.bad_request"));
        }
        if self.gifts_out() >= DECOR_MAX {
            return Err(i18n::tr("error.decor_full", &[("limit", &DECOR_MAX.to_string())]));
        }
        let decor = Decor {
            id: Uuid::new_v4().to_string(),
            kind: kind.into(),
            x,
            y,
            came_at: now,
            ..Decor::default()
        };
        self.decor.push(decor.clone());
        Ok(decor)
    }

    /// Sets a find from the album (`book`: fish, bug or treasure; `item`, one the album has) out on
    /// its own at (x, y), one more each time up to the album's count. It is one of the yard's gifts
    /// and nothing is spent.
    /// Design: docs/design/2026-11-19-album-finds-out.md.
    pub fn take_out_find(
        &mut self,
        album: &Album,
        book: &str,
        item: &str,
        x: f64,
        y: f64,
        now: u64,
    ) -> Result<Decor, String> {
        // Found, and a kind this catalogue still draws: the album keeps kinds from a newer build.
        let found = catalog().holds(book, item)
            && match book {
                "fish" => album.fish.contains_key(item),
                "bug" => album.bugs.contains_key(item),
                "treasure" => album.treasures.contains_key(item),
                _ => false,
            };
        let (Some(kind), Some((x, y)), true) = (catalog().find_out_for(book), decor_place(x, y), found) else {
            return Err(i18n::t("error.bad_request"));
        };
        self.album_has_more(album, book, item)?;
        if self.finds_out() >= FIND_MAX {
            return Err(i18n::tr("error.finds_full", &[("limit", &FIND_MAX.to_string())]));
        }
        let decor = Decor {
            id: Uuid::new_v4().to_string(),
            kind: kind.into(),
            x,
            y,
            came_at: now,
            holds: vec![item.into()],
            ..Decor::default()
        };
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

    /// Moves a decoration to (x, y), held to its place on the field (decor_place);
    /// a place that is not a number is a bad request.
    pub fn move_decor(&mut self, id: &str, x: f64, y: f64) -> Result<(), String> {
        let Some((x, y)) = decor_place(x, y) else {
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

    /// Puts a decoration away (a friend may bring it again another day). A memento or a gift shown
    /// only at a time of year waits in the box instead, its giver and heart kept, for its album card
    /// to set it out again.
    pub fn put_away(&mut self, id: &str) -> Result<(), String> {
        let at = self
            .decor
            .iter()
            .position(|d| d.id == id)
            .ok_or_else(|| i18n::t("error.decor_missing"))?;
        let mut gone = self.decor.remove(at);
        gone.on_desktop = false;
        if gone.memento || catalog().kept_in_box(&gone.kind) {
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
    fn a_snowman_is_built_once_a_day_and_counts_as_received() {
        let mut g = Garden::default();
        let s = g.build_snowman(0.7, 0.72, "2026-12-15", 5).unwrap();
        assert_eq!((s.kind.as_str(), s.came_at, s.dress.len()), (SNOWMAN, 5, 0));
        assert_eq!(g.received, [SNOWMAN]);
        assert_eq!(g.snowman_day, "2026-12-15");
        assert_eq!(
            g.build_snowman(0.3, 0.72, "2026-12-15", 6).unwrap_err(),
            i18n::t("error.snowman_today")
        );
        let standing = g.decor[0].id.clone();
        assert!(g.build_snowman(0.3, 0.72, "2026-12-15", 6).is_err());
        assert_eq!(
            (g.decor[0].id.as_str(), g.snowman_day.as_str()),
            (standing.as_str(), "2026-12-15")
        );
        assert!(g.build_snowman(0.3, 0.72, "2026-12-14", 6).is_err(), "a clock set back");
        assert_eq!(
            (g.decor[0].id.as_str(), g.snowman_day.as_str()),
            (standing.as_str(), "2026-12-15")
        );
        assert!(g.build_snowman(0.3, 0.72, "2026-12-16", 7).is_ok());
        assert_eq!(
            g.decor.iter().filter(|d| d.kind == SNOWMAN).count(),
            1,
            "the old one melted"
        );
        assert!(g.build_snowman(f64::NAN, 0.5, "2026-12-17", 8).is_err());
        assert!(g.build_snowman(0.5, 0.5, "12/17", 8).is_err());
    }

    #[test]
    fn a_new_snowman_replaces_the_old_even_in_a_full_yard() {
        let mut g = Garden::default();
        let old = g.build_snowman(0.2, 0.7, "2026-12-15", 1).unwrap();
        g.dress(&old.id, &["hat".into()]).unwrap();
        while g.decor.len() < DECOR_MAX {
            g.decor.push(Decor {
                id: g.decor.len().to_string(),
                kind: "bench".into(),
                ..Decor::default()
            });
        }
        g.boxed.push(Decor {
            id: "b".into(),
            kind: SNOWMAN.into(),
            ..Decor::default()
        });
        let new = g.build_snowman(0.7, 0.7, "2026-12-16", 2).unwrap();
        assert_eq!(g.decor.len(), DECOR_MAX);
        assert!(g.decor.iter().all(|d| d.kind != SNOWMAN || d.id == new.id) && g.boxed.is_empty());
        assert!(new.dress.is_empty(), "a new snowman starts bare");
    }

    #[test]
    fn a_full_yard_without_a_snowman_has_no_room_to_build() {
        let mut g = Garden {
            decor: (0..DECOR_MAX)
                .map(|i| Decor {
                    id: i.to_string(),
                    kind: "xmas_tree".into(),
                    ..Decor::default()
                })
                .collect(),
            ..Garden::default()
        };
        let err = g.build_snowman(0.5, 0.7, "2026-07-01", 1).unwrap_err();
        assert_eq!(err, i18n::tr("error.decor_full", &[("limit", &DECOR_MAX.to_string())]));
        assert!(g.snowman_day.is_empty() && g.received.is_empty(), "nothing spent");
    }

    #[test]
    fn a_snowman_wears_only_its_own_things_in_catalogue_order() {
        let mut g = Garden::default();
        let s = g.build_snowman(0.5, 0.7, "2026-12-15", 1).unwrap();
        g.dress(&s.id, &["hat".into(), "scarf".into(), "hat".into()]).unwrap();
        assert_eq!(g.decor[0].dress, ["scarf", "hat"]);
        g.dress(&s.id, &[]).unwrap();
        assert!(g.decor[0].dress.is_empty());
        assert!(g.dress(&s.id, &["crown".into()]).is_err());
        g.received.push("bench".into());
        let bench = g.take_out("bench", 0.5, 0.5, 2).unwrap();
        assert!(g.dress(&bench.id, &["hat".into()]).is_err(), "a bench wears nothing");
        assert!(g.dress("gone", &[]).is_err());
    }

    #[test]
    fn a_built_kind_is_not_taken_out_of_the_album() {
        let mut g = Garden::default();
        let s = g.build_snowman(0.5, 0.7, "2026-12-15", 1).unwrap();
        g.put_away(&s.id).unwrap();
        assert!(g.boxed.is_empty(), "a snowman put away melts");
        assert!(g.take_out(SNOWMAN, 0.5, 0.7, 2).is_err());
    }

    #[test]
    fn a_viewing_day_and_a_wish_day_are_kept_and_odd_ones_are_refused() {
        let mut g = Garden::default();
        assert_eq!((g.viewed.as_str(), g.wished.as_str()), ("", ""));
        g.mark_viewed("2027-04-05").unwrap();
        g.mark_wished("2027-04-06").unwrap();
        assert_eq!((g.viewed.as_str(), g.wished.as_str()), ("2027-04-05", "2027-04-06"));
        assert!(g.mark_viewed("today").is_err() && g.mark_wished("2027-13-01").is_err());
        assert_eq!(g.viewed, "2027-04-05", "a refused day changes nothing");
    }

    #[test]
    fn the_snowman_and_its_day_come_back_as_saved() {
        let raw = json!({"decor": [{"id": "s", "kind": "snowman", "x": 0.5, "y": 0.7, "onDesktop": true, "dress": ["nose", "crown", "hat", "nose"]},
                                   {"id": "b", "kind": "bench", "x": 0.2, "y": 0.7, "dress": ["hat"]}],
                         "snowmanDay": "2026-12-15", "plants": [], "received": [], "giftDay": "", "seeds": 0});
        let g = Garden::restore(Some(&raw), 0);
        assert_eq!(g.decor[0].dress, ["nose", "hat"]);
        assert!(g.decor[0].on_desktop, "a snowman out on the desktop stays out");
        assert!(g.decor[1].dress.is_empty());
        assert_eq!(g.snowman_day, "2026-12-15");
        assert_eq!(serde_json::to_value(&g).unwrap()["snowmanDay"], "2026-12-15");
        assert!(
            serde_json::to_value(&g.decor[1]).unwrap().get("dress").is_none(),
            "nothing worn, nothing written"
        );
        let old = Garden::restore(Some(&json!({"decor": [], "plants": [], "snowmanDay": "soon"})), 0);
        assert!(old.snowman_day.is_empty());
    }

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
    fn a_gift_and_a_plant_may_stand_below_the_friends_field() {
        let mut g = Garden::restore(
            Some(&json!({
                "decor": [{"id": "a", "kind": "bench", "x": 0.5, "y": 1.5}],
                "plants": [{"id": "p", "kind": "tulip", "x": 0.5, "y": 1.5, "planted": 1}, {"id": "q", "kind": "tulip", "x": 0.5, "y": 9.0, "planted": 1}]
            })),
            0,
        );
        assert_eq!(g.decor[0].y, 1.5);
        assert_eq!(g.plants[0].y, 1.5);
        assert_eq!(g.plants[1].y, DECOR_FLOOR_MAX);
        g.move_decor("a", 0.5, 9.0).unwrap();
        assert_eq!(g.decor[0].y, DECOR_FLOOR_MAX);
        assert!(g.move_decor("a", 0.5, f64::NAN).is_err());
    }

    #[test]
    fn a_gift_that_came_once_comes_back_out_of_the_album_once_put_away() {
        let mut g = Garden::default();
        let given = g.give("bench", "miso", false, 0.5, 0.5, 1).unwrap();
        assert!(g.take_out("bench", 0.4, 0.8, 2).is_err(), "it is in the yard already");
        g.put_away(&given.decor.id).unwrap();
        let out = g.take_out("bench", 0.4, 0.8, 2).unwrap();
        assert_eq!(
            (out.kind.as_str(), out.x, out.y, out.memento, out.from.as_deref()),
            ("bench", 0.4, 0.8, false, None)
        );
        assert_eq!(g.decor, vec![out.clone()]);
        assert!(g.take_out("tent", 0.4, 0.8, 2).is_err(), "a gift that never came");
        g.put_away(&out.id).unwrap();
        assert!(g.take_out("bench", f64::NAN, 0.8, 2).is_err());
        g.decor = (0..DECOR_MAX)
            .map(|i| Decor {
                id: i.to_string(),
                kind: "lantern".into(),
                ..Decor::default()
            })
            .collect();
        assert!(g.take_out("bench", 0.4, 0.8, 2).is_err(), "a full yard");
        g.decor.clear();
        // One waiting in the box is that same gift: its card sets it out, giver and heart kept.
        g.boxed.push(Decor {
            id: "boxed".into(),
            kind: "bench".into(),
            from: Some("miso".into()),
            memento: true,
            came_at: 1,
            ..Decor::default()
        });
        let waited = g.take_out("bench", 0.4, 0.8, 2).unwrap();
        assert_eq!(
            (
                waited.id.as_str(),
                waited.from.as_deref(),
                waited.memento,
                waited.came_at,
                waited.x,
                waited.y
            ),
            ("boxed", Some("miso"), true, 1, 0.4, 0.8)
        );
        assert!(g.boxed.is_empty() && g.decor.len() == 1);
        assert!(g.take_out("bench", 0.4, 0.8, 2).is_err(), "out already");
        // Not while the yard is full: it waits on.
        g.put_away("boxed").unwrap();
        g.decor = (0..DECOR_MAX)
            .map(|i| Decor {
                id: i.to_string(),
                kind: "lantern".into(),
                ..Decor::default()
            })
            .collect();
        assert!(g.take_out("bench", 0.4, 0.8, 2).is_err());
        assert_eq!(g.boxed.len(), 1);
    }

    #[test]
    fn a_decoration_keeps_its_desktop_place_and_leaves_the_desktop_when_put_away() {
        let mut g = Garden::restore(
            Some(&json!({
                "decor": [
                    {"id": "a", "kind": "bench", "x": 0.5, "y": 0.5, "onDesktop": true, "desktopPosition": {"x": 40, "y": 700}},
                    {"id": "b", "kind": "tent", "x": 0.5, "y": 0.5, "memento": true, "from": "miso", "onDesktop": true},
                    {"id": "c", "kind": "pond", "x": 0.5, "y": 0.5, "onDesktop": "yes", "desktopPosition": "here"}
                ]
            })),
            0,
        );
        let saved = serde_json::to_value(&g).unwrap();
        assert_eq!(saved["decor"][0]["onDesktop"], true);
        assert_eq!(saved["decor"][0]["desktopPosition"], json!({"x": 40, "y": 700}));
        assert!(saved["decor"][2].get("onDesktop").is_none() && saved["decor"][2].get("desktopPosition").is_none());
        g.put_away("b").unwrap();
        assert_eq!((g.boxed[0].id.as_str(), g.boxed[0].on_desktop), ("b", false));
    }

    #[test]
    fn a_december_gift_goes_back_into_the_box_when_put_away() {
        let mut g = Garden::default();
        let tree = g.give("xmas_tree", "miso", false, 0.5, 0.5, 1).unwrap();
        g.put_away(&tree.decor.id).unwrap();
        assert_eq!(
            g.boxed.iter().map(|d| d.kind.as_str()).collect::<Vec<_>>(),
            ["xmas_tree"]
        );
        let bench = g.give("bench", "miso", false, 0.5, 0.5, 1).unwrap();
        g.put_away(&bench.decor.id).unwrap();
        assert_eq!(g.boxed.len(), 1, "an everyday gift is not kept");
        // However many wait, it waits too, and its card sets it out again.
        let out = g.set_out(&g.boxed[0].id.clone(), 0.5, 0.5).unwrap();
        g.boxed = (0..20)
            .map(|i| Decor {
                id: i.to_string(),
                kind: "tent".into(),
                ..Decor::default()
            })
            .collect();
        g.put_away(&out.id).unwrap();
        assert!(g.decor.is_empty() && g.boxed.len() == 21);
        assert!(g.take_out("xmas_tree", 0.5, 0.5, 2).is_ok());
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
        // As low as a gift goes, below the friends' field.
        assert_eq!(g.plant("cosmos", 0.5, 1.3, 7).unwrap().y, 1.3);
        assert!(g.plant("cactus", 0.5, 0.5, 1).is_err(), "only the season flowers grow");
        assert!(g.plant("tulip", f64::NAN, 0.5, 1).is_err());
        assert_eq!(g.seeds, SEED_MAX - 2, "a refused planting costs no seed");
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
    fn a_yard_saved_with_more_flowers_than_the_field_now_holds_keeps_them_all() {
        // The field held 24 before every kind came to twelve; nothing planted then is lost.
        let raw = json!({"plants": (0..30).map(|i| json!({"id": format!("p{i}"), "kind": "tulip", "x": 0.5, "y": 0.5, "planted": 1})).collect::<Vec<_>>()});
        let mut g = Garden::restore(Some(&raw), 0);
        assert_eq!(g.plants.len(), PLANT_KEEP);
        // More are planted only once fewer than the field holds are left.
        g.seeds = 1;
        assert!(g.plant("tulip", 0.5, 0.5, 1).is_err());
        g.plants.truncate(PLANT_MAX - 1);
        assert!(g.plant("tulip", 0.5, 0.5, 1).is_ok());
    }

    #[test]
    fn a_plant_moves_to_another_spot_on_the_field_and_keeps_its_growth() {
        let mut g = Garden {
            seeds: 1,
            ..Default::default()
        };
        let id = g.plant("tulip", 0.5, 0.5, 7).unwrap().id;
        assert_eq!(g.move_plant(&id, 0.2, 0.9), Ok(()));
        let p = &g.plants[0];
        assert_eq!((p.x, p.y, p.planted), (0.2, 0.9, 7));
        // Down to where a gift may stand, and no farther, as planting is.
        assert_eq!(g.move_plant(&id, 0.2, 1.4), Ok(()));
        assert_eq!(g.plants[0].y, 1.4);
        assert_eq!(g.move_plant(&id, -1.0, 9.0), Ok(()));
        assert_eq!((g.plants[0].x, g.plants[0].y), (0.0, DECOR_FLOOR_MAX));
        assert!(g.move_plant(&id, f64::NAN, 0.5).is_err());
        assert!(g.move_plant("gone", 0.5, 0.5).is_err());
    }

    #[test]
    fn a_plant_out_on_the_desktop_stays_out_across_a_restart() {
        let mut g = Garden {
            seeds: 1,
            ..Default::default()
        };
        g.plant("tulip", 0.5, 0.5, 1).unwrap();
        g.plants[0].on_desktop = true;
        g.plants[0].desktop_position = Some(super::super::model::Pos { x: 40, y: 700 });
        let saved = serde_json::to_value(&g).unwrap();
        assert_eq!(saved["plants"][0]["onDesktop"], true);
        assert_eq!(saved["plants"][0]["desktopPosition"]["x"], 40);
        let back = Garden::restore(Some(&saved), 0);
        assert!(back.plants[0].on_desktop);
        assert_eq!(back.plants[0].desktop_position, g.plants[0].desktop_position);
        // One that never went out writes neither.
        g.plants[0].on_desktop = false;
        g.plants[0].desktop_position = None;
        let plain = serde_json::to_value(&g).unwrap();
        assert!(plain["plants"][0].get("onDesktop").is_none() && plain["plants"][0].get("desktopPosition").is_none());
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

    #[test]
    fn a_flower_the_album_has_comes_out_in_bloom_free_and_as_often_as_the_field_has_room() {
        let mut g = Garden::default();
        let mut album = Album::default();
        let now = 5_000_000_000;
        assert!(
            g.take_out_flower(&album, "cosmos", 0.5, 0.8, now).is_err(),
            "not found yet"
        );
        album.flowered("cosmos", 1);
        // A seedling of the kind is still growing: it is not one of the album's out.
        g.plants.push(Plant {
            id: "young".into(),
            kind: "cosmos".into(),
            x: 0.2,
            y: 0.8,
            planted: now,
            bloomed: false,
            on_desktop: false,
            desktop_position: None,
        });
        let p = g.take_out_flower(&album, "cosmos", 0.5, 0.8, now).unwrap();
        assert_eq!((p.kind.as_str(), p.x, p.y), ("cosmos", 0.5, 0.8));
        assert!(p.bloomed, "already counted, so it adds nothing to the album");
        assert_eq!(p.planted, now - catalog().bloom_after_ms(), "grown from the start");
        assert_eq!(g.bloom(&p.id, now), Ok(None));
        assert_eq!(g.seeds, 0, "no seed spent");
        assert_eq!(g.out_of_album("flower", "cosmos"), std::slice::from_ref(&p.id));
        // As many as the album found: one grown, one out.
        assert_eq!(
            g.take_out_flower(&album, "cosmos", 0.4, 0.8, now),
            Err(i18n::tr("error.album_all_out", &[("count", "1")]))
        );
        // Grown more often, more come out, up to the field's limit.
        for _ in 0..PLANT_MAX {
            album.flowered("cosmos", 1);
        }
        for _ in 2..PLANT_MAX {
            g.take_out_flower(&album, "cosmos", 0.4, 0.8, now).unwrap();
        }
        assert!(
            g.take_out_flower(&album, "cosmos", 0.4, 0.8, now).is_err(),
            "the field is full"
        );
        assert_eq!(g.plants.len(), PLANT_MAX);
        g.plants.clear();
        assert!(g.take_out_flower(&album, "cosmos", f64::NAN, 0.8, now).is_err());
        // A clock before the bloom time still gives a grown flower.
        assert_eq!(g.take_out_flower(&album, "cosmos", 0.5, 0.8, 3).unwrap().planted, 0);
    }

    #[test]
    fn gifts_and_finds_from_the_album_each_have_twelve_places() {
        let mut g = Garden::default();
        let mut album = Album::default();
        for _ in 0..=FIND_MAX {
            album.catch("fish", "crucian", 20.0, 1).unwrap();
        }
        // A yard full of gifts leaves the finds their own room.
        g.received = vec!["bench".into()];
        g.decor = (0..DECOR_MAX)
            .map(|i| Decor {
                id: format!("g{i}"),
                kind: "lantern".into(),
                ..Decor::default()
            })
            .collect();
        for _ in 0..FIND_MAX {
            g.take_out_find(&album, "fish", "crucian", 0.5, 0.8, 1).unwrap();
        }
        assert_eq!(
            g.take_out_find(&album, "fish", "crucian", 0.5, 0.8, 1),
            Err(i18n::tr("error.finds_full", &[("limit", &FIND_MAX.to_string())]))
        );
        assert!(g.take_out("bench", 0.5, 0.8, 1).is_err(), "and the gifts theirs");
        // Twelve finds out leave the gifts theirs: one comes out and a new one is set down, not boxed.
        g.decor.retain(|d| d.kind != "lantern");
        assert!(g.take_out("bench", 0.5, 0.8, 1).is_ok());
        assert!(!g.give("pond", "miso", false, 0.5, 0.5, 1).unwrap().boxed);
        // A saved yard keeps both.
        let back = Garden::restore(Some(&serde_json::to_value(&g).unwrap()), 1);
        assert_eq!(back.decor.len(), FIND_MAX + 2);
    }

    #[test]
    fn a_find_from_the_album_comes_out_on_its_own_one_more_each_time() {
        let mut g = Garden::default();
        let mut album = Album::default();
        let now = 5_000_000_000;
        assert!(
            g.take_out_find(&album, "fish", "crucian", 0.5, 0.8, now).is_err(),
            "not caught yet"
        );
        album.catch("fish", "crucian", 20.0, 1).unwrap();
        let fish = g.take_out_find(&album, "fish", "crucian", 0.5, 0.8, now).unwrap();
        assert!(
            g.take_out_find(&album, "fish", "crucian", 0.4, 0.8, now).is_err(),
            "caught once, out once"
        );
        album.catch("fish", "crucian", 20.0, 1).unwrap();
        assert_eq!(
            (fish.kind.as_str(), fish.holds.clone()),
            ("fish_out", vec!["crucian".to_string()])
        );
        assert_eq!(fish.came_at, now);
        assert!(g.received.is_empty(), "a find out is not a gift that came");
        // Caught twice, two are out, each on its own.
        let again = g.take_out_find(&album, "fish", "crucian", 0.4, 0.8, now).unwrap();
        assert_ne!(again.id, fish.id);
        assert_eq!(g.out_of_album("fish", "crucian"), [fish.id.clone(), again.id.clone()]);
        assert!(g.out_of_album("bug", "crucian").is_empty(), "a fish out is not a bug's");
        assert!(g.take_out_find(&album, "nothing", "crucian", 0.5, 0.8, now).is_err());
        assert!(g.take_out_find(&album, "fish", "crucian", f64::NAN, 0.8, now).is_err());
        // A find the album keeps but this catalogue no longer has would take a place with nothing to draw.
        let newer = Album::restore(Some(
            &json!({"treasures": {"future_stone": {"count": 1, "best": 0.0, "first": 7}}}),
        ));
        assert!(
            g.take_out_find(&newer, "treasure", "future_stone", 0.5, 0.8, now)
                .is_err()
        );
        // A treasure and a bug come out on their own too, one each time.
        album.treasures.insert(
            "quartz".to_string(),
            super::super::album::Entry {
                count: 2,
                best: 0.0,
                first: 1,
            },
        );
        album.catch("bug", "firefly", 0.0, 1).unwrap();
        for _ in 0..2 {
            assert_eq!(
                g.take_out_find(&album, "treasure", "quartz", 0.5, 0.8, now)
                    .unwrap()
                    .holds,
                ["quartz"]
            );
        }
        assert_eq!(
            g.take_out_find(&album, "bug", "firefly", 0.5, 0.8, now).unwrap().kind,
            "bug_out"
        );
        assert_eq!(g.decor.iter().filter(|d| d.kind == "treasure_out").count(), 2);
        // A flower comes out of its own card, never through here.
        album.flowered("tulip", 1);
        assert!(g.take_out_find(&album, "flower", "tulip", 0.5, 0.8, now).is_err());
        // One of the yard's gifts, not kept in the box when put away.
        album.fish.get_mut("crucian").unwrap().count = 99;
        while g.decor.len() < DECOR_MAX {
            g.take_out_find(&album, "fish", "crucian", 0.5, 0.8, now).unwrap();
        }
        assert!(
            g.take_out_find(&album, "fish", "crucian", 0.5, 0.8, now).is_err(),
            "the yard is full"
        );
        let out = g.decor.iter().find(|d| d.kind == "fish_out").unwrap().id.clone();
        g.put_away(&out).unwrap();
        assert!(g.boxed.is_empty());
        // Never set out as a gift.
        g.received.push("fish_out".into());
        assert!(g.take_out("fish_out", 0.5, 0.8, now).is_err());
    }

    #[test]
    fn a_saved_find_out_keeps_only_one_its_book_has_and_one_holding_nothing_goes() {
        let raw = json!({
            "decor": [
                { "id": "a", "kind": "treasure_out", "x": 0.5, "y": 0.8, "holds": ["quartz", "amber"] },
                { "id": "b", "kind": "fish_out", "x": 0.5, "y": 0.8, "holds": ["no_such", "crucian"] },
                { "id": "c", "kind": "bug_out", "x": 0.5, "y": 0.8, "holds": ["crucian"] },
                { "id": "d", "kind": "bench", "x": 0.5, "y": 0.8, "holds": ["quartz"] },
                { "id": "e", "kind": "fishbowl", "x": 0.5, "y": 0.8, "holds": ["crucian"] },
            ]
        });
        let g = Garden::restore(Some(&raw), 1);
        let holds = |id: &str| g.decor.iter().find(|d| d.id == id).map(|d| d.holds.clone());
        assert_eq!(holds("a").unwrap(), ["quartz"], "one at most");
        assert_eq!(holds("b").unwrap(), ["crucian"], "no unknown ids");
        assert_eq!(holds("c"), None, "a bug out holding no bug goes");
        assert_eq!(holds("d").unwrap(), Vec::<String>::new(), "a gift holds nothing");
        assert_eq!(holds("e"), None, "a kind that no longer is goes");
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
        // A gift's place may go below the friends' field, down to DECOR_FLOOR_MAX.
        let first = g.gift(0.3, 5.0, &gift_day(0), 0, None, "miso").unwrap();
        assert_eq!(
            (first.decor.kind.as_str(), first.decor.y, first.boxed),
            ("bench", DECOR_FLOOR_MAX, false)
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
        // A full yard keeps every next gift waiting, in order, one of each kind.
        for (n, kind) in kinds.iter().enumerate().skip(DECOR_MAX) {
            let given = g.gift(0.5, 0.5, &gift_day(n), 0, None, "pip").unwrap();
            assert!(given.boxed);
            assert_eq!(given.decor.kind, *kind);
        }
        assert_eq!(g.boxed.len(), kinds.len() - DECOR_MAX);
        // With every kind out or waiting, none is brought twice.
        assert_eq!(
            g.gift(0.5, 0.5, &gift_day(kinds.len()), 0, None, "pip").unwrap_err(),
            i18n::t("error.gifts_full")
        );
        // Every kind has come: the next is one not in the yard.
        let id = g.decor[0].id.clone();
        assert_eq!(g.put_away(&id), Ok(()));
        let next = g.next_gift(3);
        assert!(!g.decor.iter().any(|d| d.kind == next), "{next} is not in the yard");
        // During a seasonal event its own gifts come first, in order, one each time; once all three came, the everyday ones again.
        let mut e = Garden::default();
        assert_eq!(
            e.gift(0.5, 0.5, "2026-12-20", 0, Some("lights"), "miso")
                .unwrap()
                .decor
                .kind,
            "xmas_tree"
        );
        assert_eq!(
            e.gift(0.5, 0.5, "2026-12-22", 0, Some("lights"), "miso")
                .unwrap()
                .decor
                .kind,
            "baby_reindeer"
        );
        assert_eq!(
            e.gift(0.5, 0.5, "2026-12-24", 0, Some("lights"), "miso")
                .unwrap()
                .decor
                .kind,
            "santa"
        );
        assert_eq!(
            e.gift(0.5, 0.5, "2026-12-26", 0, Some("lights"), "miso")
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
            ..Decor::default()
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
        // Every everyday kind out or waiting: none comes twice.
        for kind in catalog().gifts() {
            if !g.decor.iter().chain(&g.boxed).any(|d| d.kind == kind) {
                g.boxed.push(gift(kind, false));
            }
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
        // A memento put away always waits in the box, so the yard has room again.
        let id = g.decor[0].id.clone();
        let waited = g.boxed.len();
        g.put_away(&id).unwrap();
        assert_eq!((g.decor.len(), g.boxed.len()), (DECOR_MAX - 1, waited + 1));
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
    fn a_gift_keeps_when_it_came_through_the_box_and_a_save() {
        let now = 1_793_491_200_000;
        let mut g = Garden::default();
        let memento = g.thanks("miso", 4, 0.5, 0.5, now).unwrap().decor;
        assert_eq!(memento.came_at, now);
        g.put_away(&memento.id).unwrap();
        assert_eq!(g.set_out(&memento.id, 0.4, 0.6).unwrap().came_at, now);
        let gift = g.gift(0.5, 0.5, &gift_day(0), now + 1, None, "miso").unwrap();
        assert_eq!(gift.decor.came_at, now + 1);
        // A gift from before this was kept came at no known time, and its save stays as it was.
        let old: Decor = serde_json::from_value(json!({"id": "a", "kind": "bench", "x": 0.5, "y": 0.5})).unwrap();
        assert_eq!(old.came_at, 0);
        assert!(serde_json::to_value(&old).unwrap().get("came_at").is_none());
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
                "decor": [{"id": "a", "kind": "bench", "x": 0.5, "y": 9.0}, {"id": "b", "kind": "castle", "x": 0.5, "y": 0.5}],
                "received": ["bench", "bench", "castle", "lantern"],
                "giftDay": "2026-10-09"
            })),
            0,
        );
        assert_eq!(with_decor.decor.len(), 1);
        assert_eq!(with_decor.decor[0].y, DECOR_FLOOR_MAX);
        assert_eq!(with_decor.received, ["bench", "lantern"]);
        assert_eq!(with_decor.gift_day, "2026-10-09");
        assert_eq!(Garden::restore(Some(&json!({"giftDay": "soon"})), 0).gift_day, "");
        assert_eq!((with_decor.viewed.as_str(), with_decor.wished.as_str()), ("", ""));
        let days = Garden::restore(Some(&json!({"viewed": "2027-04-05", "wished": "2027-04-05"})), 0);
        assert_eq!(
            (days.viewed.as_str(), days.wished.as_str()),
            ("2027-04-05", "2027-04-05")
        );
        let odd = Garden::restore(Some(&json!({"viewed": "soon", "wished": 7})), 0);
        assert_eq!((odd.viewed.as_str(), odd.wished.as_str()), ("", ""));
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

    /// A garden with the Christmas tree out in the yard, and a bench and the tree received.
    fn tree_out() -> Garden {
        Garden {
            decor: vec![Decor {
                id: "t".into(),
                kind: "xmas_tree".into(),
                x: 0.5,
                y: 0.5,
                ..Decor::default()
            }],
            received: vec!["bench".into(), "xmas_tree".into()],
            ..Garden::default()
        }
    }

    /// An album with one find in each book (and a fish and a bug, which never hang).
    fn found() -> Album {
        let one = json!({"count": 1, "best": 0.0, "first": 1});
        Album::restore(Some(&json!({
            "fish": {"carp": one}, "bugs": {"red_dragonfly": one},
            "flowers": {"camellia": one}, "trees": {"pine": one}, "treasures": {"pinecone": one}
        })))
    }

    fn ornament(book: &str, id: &str, hook: u32) -> Ornament {
        Ornament {
            book: book.into(),
            id: id.into(),
            hook,
        }
    }

    #[test]
    fn ornaments_hang_three_a_day_on_free_hooks_from_what_was_found() {
        let (mut g, album) = (tree_out(), found());
        let day = "2026-12-20";
        for (book, id, hook) in [("flower", "camellia", 0), ("tree", "pine", 5), ("gift", "bench", 11)] {
            assert_eq!(
                g.hang_ornament(&album, book, id, hook, day),
                Ok(ornament(book, id, hook))
            );
        }
        assert_eq!(
            g.hang_ornament(&album, "treasure", "pinecone", 3, day),
            Err(i18n::t("error.ornaments_today"))
        );
        assert_eq!(
            g.ornament_day,
            OrnamentDay {
                day: day.into(),
                count: 3
            }
        );
        assert_eq!(
            g.hang_ornament(&album, "treasure", "pinecone", 3, "2026-12-21"),
            Ok(ornament("treasure", "pinecone", 3))
        );
        assert_eq!((g.ornament_day.count, g.ornament_year, g.ornaments.len()), (1, 2026, 4));
    }

    #[test]
    fn an_ornament_needs_a_found_item_a_free_hook_and_the_tree_out() {
        let (mut g, album) = (tree_out(), found());
        g.hang_ornament(&album, "flower", "camellia", 0, "2026-12-20").unwrap();
        let bad = Err(i18n::t("error.bad_request"));
        for (book, id, hook, day) in [
            ("fish", "carp", 1, "2026-12-20"),
            ("bug", "red_dragonfly", 1, "2026-12-20"),
            ("flower", "tulip", 1, "2026-12-20"),
            ("gift", "santa", 1, "2026-12-20"),
            ("gift", "xmas_tree", 1, "2026-12-20"),
            ("flower", "camellia", 2, "2026-12-20"),
            ("tree", "pine", 0, "2026-12-20"),
            ("tree", "pine", ORNAMENT_HOOKS, "2026-12-20"),
            ("tree", "pine", 1, "2026-11-30"),
            ("tree", "pine", 1, "soon"),
        ] {
            assert_eq!(
                g.hang_ornament(&album, book, id, hook, day),
                bad,
                "{book} {id} {hook} {day}"
            );
        }
        g.decor.clear();
        assert_eq!(
            g.hang_ornament(&album, "tree", "pine", 1, "2026-12-20"),
            bad,
            "the tree put away"
        );
        assert_eq!(g.ornaments, [ornament("flower", "camellia", 0)]);
    }

    #[test]
    fn the_next_december_takes_last_years_ornaments_down() {
        let (mut g, album) = (tree_out(), found());
        g.hang_ornament(&album, "flower", "camellia", 0, "2026-12-20").unwrap();
        g.hang_ornament(&album, "tree", "pine", 1, "2026-12-20").unwrap();
        g.hang_ornament(&album, "gift", "bench", 2, "2027-01-05").unwrap();
        assert_eq!(
            (g.ornaments.len(), g.ornament_year),
            (3, 2026),
            "January is still last December"
        );
        let again = g.hang_ornament(&album, "flower", "camellia", 0, "2027-12-01").unwrap();
        assert_eq!(g.ornaments, [again]);
        assert_eq!((g.ornament_year, g.ornament_day.count), (2027, 1));
        assert_eq!(g.ornament_day.day, "2027-12-01");
    }

    #[test]
    fn a_tree_out_in_a_winter_yard_is_decorated_on_any_day_until_the_next_christmas() {
        let (mut g, album) = (tree_out(), found());
        g.hang_ornament(&album, "flower", "camellia", 0, "2027-07-15").unwrap();
        assert_eq!(
            (g.ornament_year, g.ornament_day.count),
            (2026, 1),
            "July belongs to the Christmas before"
        );
        g.hang_ornament(&album, "tree", "pine", 1, "2027-11-14").unwrap();
        g.take_down_ornament("tree", "pine", "2027-11-14").unwrap();
        assert_eq!(g.ornaments, [ornament("flower", "camellia", 0)]);
        let again = g.hang_ornament(&album, "tree", "pine", 1, "2027-11-15").unwrap();
        assert_eq!(
            g.ornaments,
            [again],
            "November 15 starts a bare tree, as the tree comes"
        );
        assert_eq!(g.ornament_year, 2027);
    }

    #[test]
    fn ornaments_hung_in_late_november_stay_up_in_december() {
        let (mut g, album) = (tree_out(), found());
        let first = g.hang_ornament(&album, "flower", "camellia", 0, "2026-11-20").unwrap();
        let second = g.hang_ornament(&album, "tree", "pine", 1, "2026-12-01").unwrap();
        assert_eq!(g.ornaments, [first, second]);
        assert_eq!(g.ornament_year, 2026);
    }

    #[test]
    fn a_refused_hang_changes_nothing() {
        let (mut g, album) = (tree_out(), found());
        for (book, id, hook) in [("flower", "camellia", 0), ("tree", "pine", 1), ("gift", "bench", 2)] {
            g.hang_ornament(&album, book, id, hook, "2026-12-20").unwrap();
        }
        let before = g.clone();
        assert!(
            g.hang_ornament(&album, "treasure", "pinecone", 3, "2026-12-20")
                .is_err()
        );
        assert_eq!(g, before, "the fourth of a day");
        g.hang_ornament(&album, "treasure", "pinecone", 3, "2026-12-21")
            .unwrap();
        g.received.push("lantern".into());
        let before = g.clone();
        assert_eq!(
            g.hang_ornament(&album, "gift", "lantern", 4, "2026-12-20"),
            Err(i18n::t("error.bad_request")),
            "a clock set back is not a fourth hang"
        );
        assert_eq!(g, before, "a clock set back");
        assert!(g.hang_ornament(&album, "gift", "lantern", 3, "2026-12-21").is_err());
        assert_eq!(g, before, "a taken hook");
        assert!(g.hang_ornament(&album, "gift", "lantern", 2, "2025-12-31").is_err());
        assert_eq!(g, before, "an earlier December");
        assert!(
            g.hang_ornament(&album, "gift", "lantern", ORNAMENT_HOOKS, "2027-12-01")
                .is_err()
        );
        assert_eq!(g, before, "a new season's hang with a bad hook");
    }

    #[test]
    fn an_ornament_taken_down_frees_its_hook_and_keeps_the_days_count() {
        let (mut g, album) = (tree_out(), found());
        g.hang_ornament(&album, "flower", "camellia", 0, "2026-12-20").unwrap();
        g.hang_ornament(&album, "tree", "pine", 1, "2026-12-20").unwrap();
        let bad = Err(i18n::t("error.bad_request"));
        let before = g.clone();
        for (book, id, day) in [
            ("flower", "tulip", "2026-12-20"),
            ("tree", "camellia", "2026-12-20"),
            ("flower", "camellia", "2026-12-19"),
            ("flower", "camellia", "2027-12-01"),
            ("flower", "camellia", "soon"),
        ] {
            assert_eq!(g.take_down_ornament(book, id, day), bad, "{book} {id} {day}");
            assert_eq!(g, before, "{book} {id} {day}");
        }
        assert_eq!(
            g.take_down_ornament("flower", "camellia", "2026-12-21"),
            Ok(ornament("flower", "camellia", 0))
        );
        assert_eq!(g.ornaments, [ornament("tree", "pine", 1)]);
        assert_eq!(
            g.ornament_day,
            OrnamentDay {
                day: "2026-12-20".into(),
                count: 2
            },
            "taking one down gives no hang back"
        );
        assert_eq!(
            g.take_down_ornament("flower", "camellia", "2026-12-21"),
            bad,
            "down already"
        );
        assert_eq!(
            g.hang_ornament(&album, "treasure", "pinecone", 0, "2026-12-21"),
            Ok(ornament("treasure", "pinecone", 0)),
            "its hook is free again"
        );
        g.decor.clear();
        let before = g.clone();
        assert_eq!(
            g.take_down_ornament("tree", "pine", "2026-12-21"),
            bad,
            "the tree put away"
        );
        assert_eq!(g, before);
    }

    #[test]
    fn a_new_december_starts_its_days_count_fresh() {
        // A hand-edited save: last year's season, with a full count on a day of the next December.
        let mut g = Garden::restore(
            Some(&json!({
                "decor": [{"id": "t", "kind": "xmas_tree", "x": 0.5, "y": 0.5}],
                "received": ["bench", "xmas_tree"],
                "ornaments": [{"book": "gift", "id": "bench", "hook": 0}],
                "ornamentDay": {"day": "2027-12-02", "count": 3},
                "ornamentYear": 2026
            })),
            0,
        );
        assert_eq!(
            g.hang_ornament(&found(), "flower", "camellia", 0, "2027-12-02"),
            Ok(ornament("flower", "camellia", 0))
        );
        assert_eq!((g.ornament_year, g.ornament_day.count), (2027, 1));
        assert_eq!(g.ornaments, [ornament("flower", "camellia", 0)]);
    }

    #[test]
    fn the_ornament_season_starts_with_the_winter_lights() {
        let events: Value = serde_json::from_str(include_str!("../../../src/content/events.json")).unwrap();
        let from = events["events"]
            .as_array()
            .unwrap()
            .iter()
            .find(|e| e["id"] == "lights")
            .and_then(|e| e["from"].as_str())
            .unwrap();
        assert_eq!(ornament_season(&format!("2026-{from}")), 2026);
        let (month, day) = from.split_once('-').unwrap();
        let before = format!("2026-{month}-{:02}", day.parse::<u32>().unwrap() - 1);
        assert_eq!(ornament_season(&before), 2025, "{before}");
    }

    #[test]
    fn a_hang_saved_when_christmas_started_on_december_1_moves_to_its_christmas_now() {
        // Hung on November 18 under the old rule, it was saved as the year before's Christmas;
        // what the person saw stays up instead of going on the update.
        let saved = |day: &str| {
            json!({
                "decor": [{"id": "t", "kind": "xmas_tree", "x": 0.5, "y": 0.5}],
                "ornaments": [{"book": "flower", "id": "camellia", "hook": 0}],
                "ornamentDay": {"day": day, "count": 1},
                "ornamentYear": 2025
            })
        };
        let g = Garden::restore(Some(&saved("2026-11-18")), 0);
        assert_eq!((g.ornament_year, g.ornaments.len(), g.ornament_day.count), (2026, 1, 1));
        let mut g = g;
        g.hang_ornament(&found(), "tree", "pine", 1, "2026-12-01").unwrap();
        assert_eq!(g.ornaments.len(), 2, "still up in December");
        // A day the old rule saved the same way as the new one is left alone.
        for day in ["2026-11-14", "2026-01-05"] {
            assert_eq!(Garden::restore(Some(&saved(day)), 0).ornament_year, 2025, "{day}");
        }
    }

    #[test]
    fn hung_ornaments_come_back_the_same_from_a_save() {
        let (mut g, album) = (tree_out(), found());
        g.hang_ornament(&album, "flower", "camellia", 4, "2026-12-20").unwrap();
        g.hang_ornament(&album, "gift", "bench", 7, "2026-12-20").unwrap();
        let saved = serde_json::to_value(&g).unwrap();
        assert_eq!(Garden::restore(Some(&saved), 0), g);
    }

    #[test]
    fn ornaments_are_read_back_keeping_only_what_makes_sense() {
        let g = Garden::restore(
            Some(&json!({
                "ornaments": [
                    {"book": "flower", "id": "camellia", "hook": 0},
                    {"book": "fish", "id": "carp", "hook": 1},
                    {"book": "tree", "id": "pine", "hook": 0},
                    {"book": "gift", "id": "bench", "hook": 12},
                    {"book": "flower", "id": "camellia", "hook": 2},
                    {"book": "treasure", "id": "pinecone", "hook": 3},
                    {"book": "tree", "id": "Bad!", "hook": 4},
                    {"book": "gift", "id": "xmas_tree", "hook": 5}
                ],
                "ornamentDay": {"day": "2026-12-20", "count": 9},
                "ornamentYear": 2026
            })),
            0,
        );
        assert_eq!(
            g.ornaments,
            [ornament("flower", "camellia", 0), ornament("treasure", "pinecone", 3)]
        );
        assert_eq!(
            (g.ornament_day.day.as_str(), g.ornament_day.count, g.ornament_year),
            ("2026-12-20", 3, 2026)
        );
        for raw in [
            json!({"ornamentDay": {"day": "soon", "count": 1}, "ornamentYear": -4, "ornaments": "x"}),
            json!({"ornaments": [{"book": "flower", "id": "camellia", "hook": 0}], "ornamentYear": 12}),
            json!({"giftDay": "2026-10-09"}),
        ] {
            let g = Garden::restore(Some(&raw), 0);
            assert_eq!(
                (g.ornaments.len(), g.ornament_day.clone(), g.ornament_year),
                (0, OrnamentDay::default(), 0),
                "{raw}"
            );
        }
        let saved = serde_json::to_value(&g).unwrap();
        for key in ["ornaments", "ornamentDay", "ornamentYear"] {
            assert!(saved.get(key).is_some(), "{key}");
        }
    }
}
