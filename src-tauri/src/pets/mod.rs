//! Pets: the files on this computer (catalog), bringing new ones in from a page (importer), the
//! friends made from them in the yard (model), the garden they grow (garden), the album (album),
//! friendship (bond), and what the yard is made of (content, from src/content/catalog.json and
//! the seasonal events in src/content/events.json).
pub mod album;
pub mod bond;
pub mod builtin;
pub mod catalog;
pub mod content;
pub mod discovery;
pub mod garden;
pub mod importer;
pub mod model;

/// The latest date it is anywhere on Earth at `now_ms` (UTC+14), as YYYY-MM-DD. A day the page
/// names (its own local date) is never after it; one that is comes from a clock set ahead, and is
/// refused rather than kept, which would hold back the days after (bond.rs, garden.rs).
pub fn latest_day(now_ms: u64) -> String {
    // Days since 1970 to a civil date (H. Hinnant's algorithm).
    let z = ((now_ms / 1000 + 14 * 3600) / 86_400) as i64 + 719_468;
    let (era, doe) = (z.div_euclid(146_097), z.rem_euclid(146_097));
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let (d, m) = (doy - (153 * mp + 2) / 5 + 1, if mp < 10 { mp + 3 } else { mp - 9 });
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!("{y:04}-{m:02}-{d:02}")
}

/// Whether `day` is a date (garden::is_day) that has come somewhere by `now_ms`.
pub fn has_come(day: &str, now_ms: u64) -> bool {
    garden::is_day(day) && day <= latest_day(now_ms).as_str()
}

/// A day saved from a clock that was set ahead (or not a date at all) would hold back every day
/// until it comes: the bonds' days and the last gift's day after `latest` are forgotten at start.
pub fn forget_days_after(bonds: &mut bond::Bonds, garden: &mut garden::Garden, latest: &str) {
    for b in bonds.0.values_mut() {
        if !garden::is_day(&b.day) || b.day.as_str() > latest {
            b.day.clear();
            b.today = 0;
        }
    }
    if garden.gift_day.as_str() > latest {
        garden.gift_day.clear();
    }
}

/// The limits the page shows and keeps to, in one place (public_state's `limits`).
pub fn limits() -> serde_json::Value {
    serde_json::json!({
        "pets": model::LIMIT,
        "persona": model::PERSONA_MAX,
        "seeds": garden::SEED_MAX,
        "saplings": garden::SAPLING_MAX,
        "decor": garden::DECOR_MAX,
        "trees": discovery::TREE_MAX,
        "treesPerWorld": discovery::TREE_WORLD_MAX,
        "treeYoungMs": discovery::TREE_YOUNG_MS,
        "treeMatureMs": discovery::TREE_MATURE_MS,
        "digCooldownMs": discovery::DIG_COOLDOWN_MS,
        "digTtlMs": discovery::DIG_TTL_MS,
        "digHistory": discovery::DIG_HISTORY,
        "digOdds": {"empty": discovery::DIG_ODDS[0], "seed": discovery::DIG_ODDS[1], "sapling": discovery::DIG_ODDS[2], "common": discovery::DIG_ODDS[3], "uncommon": discovery::DIG_ODDS[4]},
        "bondLevels": bond::LEVELS,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_latest_day_on_earth_is_a_little_ahead_of_utc() {
        // 2026-10-10 00:00 UTC is already the 10th in UTC+14; 10:00 UTC makes it the 11th there.
        assert_eq!(latest_day(1_791_590_400_000), "2026-10-10");
        assert_eq!(latest_day(1_791_590_400_000 + 10 * 3_600_000), "2026-10-11");
        assert_eq!(latest_day(951_782_400_000), "2000-02-29", "a leap day");
        assert!(has_come("2026-10-11", 1_791_590_400_000 + 10 * 3_600_000));
        assert!(!has_come("2026-10-12", 1_791_590_400_000 + 10 * 3_600_000));
        assert!(!has_come("2026-13-01", u64::MAX / 4), "not a month");
    }

    #[test]
    fn days_saved_from_a_clock_set_ahead_are_forgotten_at_start() {
        let mut bonds = bond::Bonds::restore(
            Some(
                &serde_json::json!({"a": {"points": 9, "day": "2027-10-10", "today": 40}, "b": {"points": 1, "day": "z", "today": 40}, "c": {"points": 1, "day": "2026-10-09", "today": 7}}),
            ),
            &["a".into(), "b".into(), "c".into()],
        );
        let mut garden = garden::Garden::restore(Some(&serde_json::json!({"giftDay": "2027-01-01"})), 0);
        forget_days_after(&mut bonds, &mut garden, "2026-10-10");
        assert_eq!((bonds.0["a"].day.as_str(), bonds.0["a"].today), ("", 0));
        assert_eq!((bonds.0["b"].day.as_str(), bonds.0["b"].today), ("", 0));
        assert_eq!((bonds.0["c"].day.as_str(), bonds.0["c"].today), ("2026-10-09", 7));
        assert_eq!(garden.gift_day, "");
    }
}
