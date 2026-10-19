//! What the yard is made of, as src/content/catalog.json has it: the page reads the same file, so a
//! flower, a gift, a fish or a bug is added in one place and both sides know it. Built into the app,
//! so the backend always holds the catalogue the page was shipped with. Here it decides what a seed
//! can grow into, which gift comes next, what the album believes was caught, and when a plant has
//! flowered; and, from src/content/events.json, which seasonal event's gift a day may bring. How to
//! add to the yard: docs/how-to/add-to-the-yard.md.
use serde::Deserialize;
use std::sync::OnceLock;

#[derive(Deserialize)]
struct Kind {
    id: String,
    /// The seasonal event it comes only during (events.json), if any.
    #[serde(default)]
    event: Option<String>,
    #[serde(default = "one")]
    weight: u32,
    #[serde(default)]
    affinity: Affinity,
}
#[derive(Deserialize)]
struct Event {
    id: String,
    /// Its first and last day, month-day north of the equator ("04-01").
    from: String,
    to: String,
    /// Fixed to the calendar (the new year): not six months later south of the equator.
    #[serde(default)]
    fixed: bool,
    /// The gift that comes only during it.
    #[serde(default)]
    gift: Option<String>,
}
#[derive(Deserialize)]
struct Events {
    events: Vec<Event>,
}
#[derive(Deserialize)]
struct Fish {
    id: String,
    /// The shortest and longest it grows, in cm.
    size: [f64; 2],
}
#[derive(Deserialize)]
struct Stage {
    /// When the stage begins, in minutes from planting.
    minutes: u64,
}
#[derive(Deserialize)]
struct Garden {
    stages: Vec<Stage>,
}

#[derive(Deserialize)]
struct Treasure {
    id: String,
    rarity: String,
    #[serde(default = "one")]
    weight: u32,
    #[serde(default)]
    affinity: Affinity,
}
fn one() -> u32 {
    1
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DiscoveryContext {
    pub season: String,
    pub weather: String,
}
impl DiscoveryContext {
    pub fn valid(&self) -> bool {
        matches!(self.season.as_str(), "spring" | "summer" | "autumn" | "winter")
            && matches!(self.weather.as_str(), "clear" | "rain" | "snow")
    }
}

#[derive(Deserialize, Default)]
struct Affinity {
    #[serde(default)]
    seasons: Vec<String>,
    #[serde(default)]
    weather: Vec<String>,
    #[serde(default)]
    places: Vec<String>,
}
impl Affinity {
    fn multiplier(&self, context: Option<&DiscoveryContext>, world: &str) -> u64 {
        let Some(context) = context else { return 1 };
        let season = self.seasons.iter().any(|season| season == &context.season);
        let weather = self.weather.iter().any(|weather| weather == &context.weather);
        let place =
            matches!(world, "woodland" | "courtyard" | "lakeside") && self.places.iter().any(|place| place == world);
        (if season { 2 } else { 1 }) * (if weather { 2 } else { 1 }) * (if place { 2 } else { 1 })
    }
}

fn weighted_id<'a>(pool: impl Iterator<Item = (&'a str, u64)>, roll: u64) -> Option<&'a str> {
    let pool: Vec<_> = pool.collect();
    let total: u64 = pool.iter().map(|(_, weight)| *weight).sum();
    if total == 0 {
        return None;
    }
    let mut choice = roll % total;
    for (id, weight) in pool {
        if choice < weight {
            return Some(id);
        }
        choice -= weight;
    }
    None
}

#[derive(Deserialize)]
pub struct Catalog {
    garden: Garden,
    flowers: Vec<Kind>,
    gifts: Vec<Kind>,
    fish: Vec<Fish>,
    bugs: Vec<Kind>,
    #[serde(default)]
    trees: Vec<Kind>,
    #[serde(default)]
    treasures: Vec<Treasure>,
}

fn events() -> &'static Events {
    static EVENTS: OnceLock<Events> = OnceLock::new();
    EVENTS.get_or_init(|| {
        serde_json::from_str(include_str!("../../../src/content/events.json")).expect("src/content/events.json")
    })
}

/// A month-day ("04-01" or the end of a date "2026-04-01") as a number, 401.
fn month_day(text: &str) -> Option<u32> {
    let mut parts = text.rsplitn(3, '-');
    let d: u32 = parts.next()?.parse().ok()?;
    let m: u32 = parts.next()?.parse().ok()?;
    ((1..=12).contains(&m) && (1..=31).contains(&d)).then_some(m * 100 + d)
}
fn within(md: u32, from: u32, to: u32) -> bool {
    if from <= to {
        md >= from && md <= to
    } else {
        md >= from || md <= to
    }
}
/// Six months on, as the events come south of the equator, kept inside the month it lands in
/// (August 31 is the last of February: the 28th as a first day, so no year loses it, the 29th as
/// a last). The same rule as src/yard/events.js.
fn later(md: u32, last: bool) -> u32 {
    let month = (md / 100 + 5) % 12 + 1;
    let days = match month {
        2 if last => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    };
    month * 100 + (md % 100).min(days)
}

/// The gift a seasonal event brings, if the event is on that day (the page's local date, north or
/// south of the equator, which the page knows and the backend does not).
pub fn event_gift(event: &str, day: &str) -> Option<&'static str> {
    let e = events().events.iter().find(|e| e.id == event)?;
    let (md, from, to) = (month_day(day)?, month_day(&e.from)?, month_day(&e.to)?);
    let on = within(md, from, to) || (!e.fixed && within(md, later(from, false), later(to, true)));
    on.then_some(e.gift.as_deref()?)
}

/// The catalogue the app was built with.
pub fn catalog() -> &'static Catalog {
    static CATALOG: OnceLock<Catalog> = OnceLock::new();
    CATALOG.get_or_init(|| {
        serde_json::from_str(include_str!("../../../src/content/catalog.json")).expect("src/content/catalog.json")
    })
}

impl Catalog {
    pub fn tree(&self, choice: u64, context: Option<&DiscoveryContext>, world: &str) -> Option<&str> {
        weighted_id(
            self.trees.iter().map(|kind| {
                (
                    kind.id.as_str(),
                    u64::from(kind.weight) * kind.affinity.multiplier(context, world),
                )
            }),
            choice,
        )
    }
    pub fn is_tree(&self, id: &str) -> bool {
        self.trees.iter().any(|kind| kind.id == id)
    }
    pub fn is_uncommon_treasure(&self, id: &str) -> bool {
        self.treasures
            .iter()
            .any(|kind| kind.id == id && kind.rarity == "uncommon")
    }
    pub fn treasure(&self, rarity: &str, roll: u64, context: Option<&DiscoveryContext>, world: &str) -> Option<&str> {
        weighted_id(
            self.treasures.iter().filter(|kind| kind.rarity == rarity).map(|kind| {
                (
                    kind.id.as_str(),
                    u64::from(kind.weight) * kind.affinity.multiplier(context, world),
                )
            }),
            roll,
        )
    }

    /// Whether a seed can grow into this flower.
    pub fn is_flower(&self, id: &str) -> bool {
        self.flowers.iter().any(|k| k.id == id)
    }
    /// The gifts that come on any day, in the order the first ones come (not an event's own).
    pub fn gifts(&self) -> Vec<&str> {
        self.gifts
            .iter()
            .filter(|k| k.event.is_none())
            .map(|k| k.id.as_str())
            .collect()
    }
    /// Whether friends can bring this as a gift.
    pub fn is_gift(&self, id: &str) -> bool {
        self.gifts.iter().any(|k| k.id == id)
    }
    /// The longest a fish of this kind grows (cm), or None for a fish there is not.
    pub fn fish_max(&self, id: &str) -> Option<f64> {
        self.fish.iter().find(|f| f.id == id).map(|f| f.size[1])
    }
    /// Whether this bug flies over the yard.
    pub fn is_bug(&self, id: &str) -> bool {
        self.bugs.iter().any(|k| k.id == id)
    }
    /// How long a seed takes to flower: when the last stage begins.
    pub fn bloom_after_ms(&self) -> u64 {
        self.garden.stages.last().map_or(0, |s| s.minutes * 60 * 1000)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn environmental_weights_cover_each_season_weather_and_place_without_mixing_rarities() {
        let affinity = serde_json::json!({"seasons":["spring"],"weather":["rain"],"places":["woodland","custom"]});
        let c: Catalog = serde_json::from_value(serde_json::json!({
            "garden":{"stages":[]},"flowers":[],"gifts":[],"fish":[],"bugs":[],
            "trees":[{"id":"favoured","affinity":affinity},{"id":"neutral"}],
            "treasures":[{"id":"favoured","rarity":"common","weight":1,"affinity":affinity},{"id":"neutral","rarity":"common","weight":1},
                         {"id":"favoured","rarity":"uncommon","weight":1,"affinity":affinity},{"id":"neutral","rarity":"uncommon","weight":1}]
        })).unwrap();
        for season in ["spring", "summer", "autumn", "winter"] {
            for weather in ["clear", "rain", "snow"] {
                for world in ["woodland", "courtyard", "lakeside", "custom"] {
                    let context = DiscoveryContext {
                        season: season.into(),
                        weather: weather.into(),
                    };
                    let expected = (if season == "spring" { 2 } else { 1 })
                        * (if weather == "rain" { 2 } else { 1 })
                        * (if world == "woodland" { 2 } else { 1 });
                    let total = expected + 1;
                    assert_eq!(
                        (0..total)
                            .filter(|roll| c.tree(*roll, Some(&context), world) == Some("favoured"))
                            .count() as u64,
                        expected
                    );
                    for rarity in ["common", "uncommon"] {
                        assert_eq!(
                            (0..total)
                                .filter(|roll| c.treasure(rarity, *roll, Some(&context), world) == Some("favoured"))
                                .count() as u64,
                            expected
                        );
                    }
                }
            }
        }
        assert_eq!(c.tree(0, None, "woodland"), Some("favoured"));
        assert_eq!(c.tree(1, None, "woodland"), Some("neutral"));
        assert_eq!(c.treasure("common", 1, None, "woodland"), Some("neutral"));
        assert_eq!(c.treasure("uncommon", 1, None, "woodland"), Some("neutral"));
        assert!(c.is_uncommon_treasure("favoured"));
        assert!(!c.is_uncommon_treasure("absent"));
    }

    #[test]
    fn the_catalogue_the_page_reads_is_built_in() {
        let c = catalog();
        assert!(c.is_flower("tulip") && !c.is_flower("weed"));
        assert_eq!(
            c.gifts().first(),
            Some(&"bench"),
            "the first gift is the catalogue's first"
        );
        assert_eq!(c.fish_max("carp"), Some(80.0));
        assert!(c.is_bug("firefly") && !c.is_bug("carp"));
        assert_eq!(c.bloom_after_ms(), 4 * 60 * 60 * 1000);
        // An event's gift comes only on its days, six months later in the south, and is not one of
        // the everyday gifts; the new year is the same everywhere.
        assert_eq!(event_gift("blossom", "2026-04-05"), Some("cherry_sapling"));
        assert_eq!(
            event_gift("blossom", "2026-10-05"),
            Some("cherry_sapling"),
            "spring in the south"
        );
        assert_eq!(event_gift("blossom", "2026-06-05"), None);
        assert_eq!(event_gift("lights", "2026-12-31"), Some("snowman"));
        assert_eq!(event_gift("newyear", "2027-01-02"), None, "an event without a gift");
        assert_eq!(event_gift("bogus", "2026-04-05"), None);
        // The dates the page is checked against too (tests/fixtures/event-dates.json): on every day
        // the page sees an event with a gift, north or south, the backend gives that gift.
        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("../../../tests/fixtures/event-dates.json")).unwrap();
        for case in fixture["cases"].as_array().unwrap() {
            let (day, event) = (case["day"].as_str().unwrap(), case["event"].as_str());
            if let Some(e) = event.and_then(|id| events().events.iter().find(|e| e.id == id)) {
                assert_eq!(event_gift(&e.id, day), e.gift.as_deref(), "{day}: {}", e.id);
            }
        }
        // Six months on stays inside the month: August 31 starts on February 28 and ends on the 29th.
        assert_eq!(
            (later(831, false), later(831, true), later(1231, true)),
            (228, 229, 630)
        );
        assert!(c.is_gift("snowman") && !c.gifts().contains(&"snowman"));
        // Every event names a gift that is in the catalogue as that event's.
        for e in &events().events {
            if let Some(g) = &e.gift {
                assert!(
                    c.gifts
                        .iter()
                        .any(|k| &k.id == g && k.event.as_deref() == Some(e.id.as_str())),
                    "{g}"
                );
            }
        }
        // Every id is a name the album and state.json keep as they are.
        for id in c
            .flowers
            .iter()
            .chain(&c.gifts)
            .chain(&c.bugs)
            .map(|k| &k.id)
            .chain(c.fish.iter().map(|f| &f.id))
        {
            assert!(id.bytes().all(|b| b.is_ascii_lowercase() || b == b'_'), "{id}");
        }
    }
}
