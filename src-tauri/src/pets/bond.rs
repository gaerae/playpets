//! Friendship: how close each friend has grown to the person, from time together in the yard and
//! what they do together (pats, treats, watering, catching, gifts, chats). The page says what
//! happened; what it is worth, how much a day can bring and the levels are kept here, so the page
//! cannot hand out points of its own. What each level opens is the page's
//! (src/yard/bond.js). Design: docs/design/2026-10-09-a-yard-that-grows.md.
use crate::i18n;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

/// Points at which each level begins: 1 a new friend … 5 the closest.
pub const LEVELS: [u32; 5] = [0, 60, 200, 500, 1000];
/// Points a day can bring from things done together (time together is not counted in this).
pub const DAILY: u32 = 40;
/// Points a day can bring from time together: an hour of the yard seen. Leaving it open longer
/// brings no more, so a friend grows closer by what is done with it, not by the window alone.
pub const TIME_DAILY: u32 = 12;
/// Of a day's worth, how much pats can bring, so the rest comes from treats, talk, watering and
/// catching rather than a minute of clicking.
pub const PAT_DAILY: u32 = 10;
/// Time together counts once in this long at most, however often the page says so (every 10
/// minutes, src/yard/bond.js: a little longer, so a timer that fires early still counts).
pub const TIME_EVERY_MS: u64 = 9 * 60 * 1000;

/// What a thing done together is worth.
fn worth(reason: &str) -> Option<u32> {
    Some(match reason {
        "time" => 2,
        "pat" => 1,
        "treat" => 2,
        "chat" => 2,
        "water" => 3,
        "catch" => 3,
        "gift" => 5,
        _ => return None,
    })
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct Bond {
    pub points: u32,
    /// The local day the counter below is for (YYYY-MM-DD, as the page writes it).
    #[serde(default)]
    pub day: String,
    /// Points brought today by things done together.
    #[serde(default)]
    pub today: u32,
    /// Of those, the points pats brought today.
    #[serde(default, rename = "patToday")]
    pub pat_today: u32,
    /// Points time together brought today.
    #[serde(default, rename = "timeToday")]
    pub time_today: u32,
    /// When time together last counted, in ms since 1970.
    #[serde(default)]
    #[serde(rename = "timeAt", alias = "time_at")]
    pub time_at: u64,
}

/// The level for so many points.
pub fn level(points: u32) -> u32 {
    LEVELS.iter().filter(|&&at| points >= at).count() as u32
}

/// Every friend's bond, by friend id.
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct Bonds(pub BTreeMap<String, Bond>);

impl Bonds {
    /// The bonds as state.json has them, for the friends there are.
    pub fn restore(raw: Option<&Value>, pets: &[String]) -> Bonds {
        let map = raw
            .and_then(Value::as_object)
            .into_iter()
            .flatten()
            .filter(|(id, _)| pets.contains(id))
            .filter_map(|(id, v)| {
                // A file with both spellings (edited by hand) keeps the new one rather than losing the bond.
                let mut v = v.clone();
                if let Some(o) = v.as_object_mut().filter(|o| o.contains_key("timeAt")) {
                    o.remove("time_at");
                }
                Some((id.clone(), serde_json::from_value::<Bond>(v).ok()?))
            })
            .collect();
        Bonds(map)
    }

    /// Something done together: returns the friend's points, its level and whether it rose.
    pub fn befriend(&mut self, pet: &str, reason: &str, day: &str, now: u64) -> Result<(u32, u32, bool), String> {
        let worth = worth(reason).ok_or_else(|| i18n::t("error.bad_request"))?;
        // The day counts what a day can bring: it has to be a date (one that has come, checked where
        // the clock is, commands.rs). Another day starts a new day's worth, so a clock moved back
        // and forth (travel, a fix) never locks the count.
        if !super::garden::is_day(day) {
            return Err(i18n::t("error.bad_request"));
        }
        let bond = self.0.entry(pet.to_string()).or_default();
        let before = level(bond.points);
        if bond.day != day {
            bond.day = day.to_string();
            bond.today = 0;
            bond.pat_today = 0;
            bond.time_today = 0;
        }
        let gained = if reason == "time" {
            if now.saturating_sub(bond.time_at) < TIME_EVERY_MS {
                0
            } else {
                bond.time_at = now;
                let gained = worth.min(TIME_DAILY.saturating_sub(bond.time_today));
                bond.time_today += gained;
                gained
            }
        } else {
            let mut room = DAILY.saturating_sub(bond.today);
            if reason == "pat" {
                room = room.min(PAT_DAILY.saturating_sub(bond.pat_today));
            }
            let gained = worth.min(room);
            bond.today += gained;
            if reason == "pat" {
                bond.pat_today += gained;
            }
            gained
        };
        bond.points = bond.points.saturating_add(gained);
        let after = level(bond.points);
        Ok((bond.points, after, after > before))
    }

    /// Whether the person did something with this friend on `day` (time together aside).
    pub fn together_on(&self, pet: &str, day: &str) -> bool {
        self.0.get(pet).is_some_and(|b| b.day == day && b.today > 0)
    }

    /// A friend's level now (1 for a friend with no bond yet).
    pub fn level_of(&self, pet: &str) -> u32 {
        level(self.0.get(pet).map_or(0, |b| b.points))
    }

    /// A friend that left takes its bond with it.
    pub fn forget(&mut self, pet: &str) {
        self.0.remove(pet);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn levels_begin_at_their_points() {
        assert_eq!(
            (level(0), level(59), level(60), level(999), level(1000), level(9999)),
            (1, 1, 2, 4, 5, 5)
        );
    }

    #[test]
    fn things_done_together_count_up_to_a_day_s_worth_and_time_counts_at_most_so_often() {
        let mut b = Bonds::default();
        assert!(b.befriend("a", "bribe", "2026-10-09", 0).is_err());
        // Not a date: refused.
        assert!(b.befriend("a", "pat", "tomorrow", 0).is_err());
        assert_eq!(b.befriend("a", "gift", "2026-10-09", 0), Ok((5, 1, false)));
        for _ in 0..20 {
            b.befriend("a", "water", "2026-10-09", 0).unwrap();
        }
        assert_eq!(b.0["a"].points, DAILY, "a day brings so much and no more");
        assert_eq!(
            b.befriend("a", "pat", "2026-10-10", 0),
            Ok((DAILY + 1, 1, false)),
            "a new day, a new count"
        );
        assert_eq!(
            b.befriend("a", "time", "2026-10-10", TIME_EVERY_MS).unwrap().0,
            DAILY + 3
        );
        assert_eq!(
            b.befriend("a", "time", "2026-10-10", TIME_EVERY_MS + 1000).unwrap().0,
            DAILY + 3,
            "too soon"
        );
        assert!(
            b.befriend("a", "time", "someday", 0).is_err(),
            "time counts by a date too"
        );
        // Rising a level says so once.
        let mut points = b.0["a"].points;
        let mut rose = 0;
        let mut now = TIME_EVERY_MS;
        while points < LEVELS[1] {
            now += TIME_EVERY_MS;
            let (p, _, up) = b.befriend("a", "water", "2026-10-11", now).unwrap();
            points = p;
            rose += up as u32;
        }
        assert_eq!(rose, 1);
        b.forget("a");
        assert!(b.0.is_empty());
    }

    #[test]
    fn time_together_and_pats_each_bring_only_part_of_a_day() {
        let mut b = Bonds::default();
        // A whole day of the yard seen, a tick every ten minutes: an hour's worth counts.
        for tick in 1..=48 {
            b.befriend("a", "time", "2026-10-09", tick * TIME_EVERY_MS).unwrap();
        }
        assert_eq!(b.0["a"].points, TIME_DAILY);
        assert!(
            !b.together_on("a", "2026-10-09"),
            "the yard seen is not something done together"
        );
        // A minute of pats brings PAT_DAILY; the rest of a day's worth comes from other things.
        for _ in 0..100 {
            b.befriend("a", "pat", "2026-10-09", 0).unwrap();
        }
        assert_eq!(b.0["a"].points, TIME_DAILY + PAT_DAILY);
        for _ in 0..20 {
            b.befriend("a", "treat", "2026-10-09", 0).unwrap();
        }
        assert_eq!(b.0["a"].points, TIME_DAILY + DAILY, "pats count toward the day's worth");
        // The next day both start again.
        let next = 49 * TIME_EVERY_MS;
        assert_eq!(
            b.befriend("a", "time", "2026-10-10", next).unwrap().0,
            TIME_DAILY + DAILY + 2
        );
        assert_eq!(
            b.befriend("a", "pat", "2026-10-10", next).unwrap().0,
            TIME_DAILY + DAILY + 3
        );
    }

    #[test]
    fn saved_bonds_are_kept_for_the_friends_there_are() {
        let raw = json!({"a": {"points": 70, "day": "2026-10-09", "today": 3, "patToday": 2, "timeToday": 4, "time_at": 5}, "gone": {"points": 9}, "b": "nonsense"});
        let b = Bonds::restore(Some(&raw), &["a".into(), "b".into()]);
        assert_eq!(b.0.keys().collect::<Vec<_>>(), ["a"]);
        assert_eq!(b.0["a"].points, 70);
        // Saved as timeAt like the rest of state.json; the older time_at is still read.
        assert_eq!(b.0["a"].time_at, 5);
        assert_eq!(serde_json::to_value(&b.0["a"]).unwrap()["timeAt"], 5);
        // The day's pats and time are kept across a restart, so a restart does not refill them.
        assert_eq!((b.0["a"].pat_today, b.0["a"].time_today), (2, 4));
        let saved = serde_json::to_value(&b.0["a"]).unwrap();
        assert_eq!(
            (saved["patToday"].as_u64(), saved["timeToday"].as_u64()),
            (Some(2), Some(4))
        );
        assert_eq!(Bonds::restore(None, &[]), Bonds::default());
    }
}
