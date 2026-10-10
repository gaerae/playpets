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
    /// The gifts, in the order the first ones come.
    pub fn gifts(&self) -> Vec<&str> {
        self.gifts.iter().map(|k| k.id.as_str()).collect()
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
