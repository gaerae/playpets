//! What the yard is made of, as src/content/catalog.json has it: the page reads the same file, so a
//! flower, a gift, a fish or a bug is added in one place and both sides know it. Built into the app,
//! so the backend always holds the catalogue the page was shipped with. Here it decides what a seed
//! can grow into, which gift comes next, what the album believes was caught, and when a plant has
//! flowered. How to add to the yard: docs/how-to/add-to-the-yard.md.
use serde::Deserialize;
use std::sync::OnceLock;

#[derive(Deserialize)]
struct Kind {
    id: String,
    /// The seasonal event it comes only during (events.json), if any.
    #[serde(default)]
    event: Option<String>,
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
pub struct Catalog {
    garden: Garden,
    flowers: Vec<Kind>,
    gifts: Vec<Kind>,
    fish: Vec<Fish>,
    bugs: Vec<Kind>,
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
/// Six months on, as the events come south of the equator.
fn later(md: u32) -> u32 {
    ((md / 100 + 5) % 12 + 1) * 100 + md % 100
}

/// The gift a seasonal event brings, if the event is on that day (the page's local date, north or
/// south of the equator, which the page knows and the backend does not).
pub fn event_gift(event: &str, day: &str) -> Option<&'static str> {
    let e = events().events.iter().find(|e| e.id == event)?;
    let (md, from, to) = (month_day(day)?, month_day(&e.from)?, month_day(&e.to)?);
    let on = within(md, from, to) || (!e.fixed && within(md, later(from), later(to)));
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
