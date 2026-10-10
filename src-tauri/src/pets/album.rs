//! The album: every kind of fish caught at the lake, bug caught in the yard and flower grown in
//! the garden, with how many and, for fish, the biggest. (The gifts in it are the garden's own
//! record of what came, garden.rs `received`.) The page decides what was caught (where and when
//! each kind is found: src/yard/catalog.js); this keeps the record and its limits, and refuses what
//! could not be a catch: a kind the catalogue does not have (content.rs), or a fish longer than its
//! kind grows.
//! Design: docs/design/2026-10-09-a-yard-that-grows.md.
use super::content::catalog;
use crate::i18n;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

/// Kinds an album keeps, for each of its books (fish, bugs, flowers); far more than the catalogue has, so it only
/// stops a file that grew out of hand.
pub const KINDS_MAX: usize = 64;
/// The longest fish (cm) the album believes.
pub const SIZE_MAX: f64 = 300.0;

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct Album {
    pub fish: BTreeMap<String, Entry>,
    pub bugs: BTreeMap<String, Entry>,
    #[serde(default)]
    pub flowers: BTreeMap<String, Entry>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Entry {
    pub count: u32,
    /// The biggest caught, in cm (0 for bugs).
    pub best: f64,
    /// When the first was caught, in ms since 1970.
    pub first: u64,
}

/// A kind's name as the catalogue writes it: lowercase letters and underscores.
fn is_kind(text: &str) -> bool {
    (1..=24).contains(&text.len()) && text.bytes().all(|b| b.is_ascii_lowercase() || b == b'_')
}

fn read(raw: Option<&Value>) -> BTreeMap<String, Entry> {
    raw.and_then(Value::as_object)
        .into_iter()
        .flatten()
        .filter(|(k, _)| is_kind(k))
        .filter_map(|(k, v)| {
            let e: Entry = serde_json::from_value(v.clone()).ok()?;
            (e.count > 0 && e.best.is_finite()).then(|| {
                (
                    k.clone(),
                    Entry {
                        best: e.best.clamp(0.0, SIZE_MAX),
                        ..e
                    },
                )
            })
        })
        .take(KINDS_MAX)
        .collect()
}

impl Album {
    /// The album as state.json has it, keeping only what makes sense.
    pub fn restore(raw: Option<&Value>) -> Album {
        Album {
            fish: read(raw.and_then(|r| r.get("fish"))),
            bugs: read(raw.and_then(|r| r.get("bugs"))),
            flowers: read(raw.and_then(|r| r.get("flowers"))),
        }
    }

    /// Records a flower that bloomed in the garden (the garden says which, garden.rs `bloom`).
    pub fn flowered(&mut self, kind: &str, now: u64) -> Entry {
        let entry = self.flowers.entry(kind.to_string()).or_insert(Entry {
            count: 0,
            best: 0.0,
            first: now,
        });
        entry.count = entry.count.saturating_add(1);
        entry.clone()
    }

    /// Records a catch: `kind` is "fish" or "bug", `id` the catalogue's name, `size` in cm (fish).
    /// Returns the entry and whether this is the first of its kind.
    pub fn catch(&mut self, kind: &str, id: &str, size: f64, now: u64) -> Result<(Entry, bool), String> {
        let (book, size) = match kind {
            "fish"
                if catalog()
                    .fish_max(id)
                    .is_some_and(|max| size.is_finite() && size > 0.0 && size <= max) =>
            {
                (&mut self.fish, size)
            }
            "bug" if catalog().is_bug(id) => (&mut self.bugs, 0.0),
            _ => return Err(i18n::t("error.bad_request")),
        };
        let first = !book.contains_key(id);
        if first && book.len() >= KINDS_MAX {
            return Err(i18n::t("error.bad_request"));
        }
        let entry = book.entry(id.to_string()).or_insert(Entry {
            count: 0,
            best: 0.0,
            first: now,
        });
        entry.count = entry.count.saturating_add(1);
        entry.best = entry.best.max(size);
        Ok((entry.clone(), first))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn a_catch_is_counted_the_biggest_fish_kept_and_the_first_of_a_kind_said() {
        let mut a = Album::default();
        let (e, first) = a.catch("fish", "carp", 42.5, 7).unwrap();
        assert!(first);
        assert_eq!((e.count, e.best, e.first), (1, 42.5, 7));
        let (e, first) = a.catch("fish", "carp", 30.0, 9).unwrap();
        assert!(!first, "the second carp is not new");
        assert_eq!(
            (e.count, e.best, e.first),
            (2, 42.5, 7),
            "the biggest and the first stay"
        );
        let (e, first) = a.catch("bug", "red_dragonfly", 99.0, 3).unwrap();
        assert!(first);
        assert_eq!(e.best, 0.0, "bugs have no size");
        assert!(a.catch("fish", "carp", f64::NAN, 1).is_err());
        assert!(a.catch("fish", "carp", 900.0, 1).is_err(), "no fish is that long");
        assert!(a.catch("fish", "Carp!", 10.0, 1).is_err());
        assert!(a.catch("bird", "crow", 10.0, 1).is_err());
        assert_eq!(a.fish["carp"].count, 2, "a refused catch counts nothing");
    }

    #[test]
    fn a_saved_album_is_read_back_keeping_only_what_makes_sense() {
        let a = Album::restore(Some(&json!({
            "fish": {
                "carp": {"count": 3, "best": 51.0, "first": 5},
                "BAD": {"count": 1, "best": 1.0, "first": 1},
                "eel": {"count": 0, "best": 1.0, "first": 1},
                "catfish": {"count": 1, "best": 9999.0, "first": 1}
            },
            "bugs": "nonsense"
        })));
        assert_eq!(a.fish.keys().collect::<Vec<_>>(), ["carp", "catfish"]);
        assert_eq!(a.fish["catfish"].best, SIZE_MAX);
        assert!(a.bugs.is_empty());
        assert_eq!(Album::restore(None), Album::default());
    }
}
