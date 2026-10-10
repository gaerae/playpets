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
/// Time together counts once in this long at most, however often the page says so.
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
    /// When time together last counted, in ms since 1970.
    #[serde(default)]
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
            .filter_map(|(id, v)| Some((id.clone(), serde_json::from_value::<Bond>(v.clone()).ok()?)))
            .collect();
        Bonds(map)
    }

    /// Something done together: returns the friend's points, its level and whether it rose.
    pub fn befriend(&mut self, pet: &str, reason: &str, day: &str, now: u64) -> Result<(u32, u32, bool), String> {
        let worth = worth(reason).ok_or_else(|| i18n::t("error.bad_request"))?;
        let bond = self.0.entry(pet.to_string()).or_default();
        let before = level(bond.points);
        let gained = if reason == "time" {
            if now.saturating_sub(bond.time_at) < TIME_EVERY_MS {
                0
            } else {
                bond.time_at = now;
                worth
            }
        } else {
            if bond.day != day {
                bond.day = day.to_string();
                bond.today = 0;
            }
            let room = DAILY.saturating_sub(bond.today);
            let gained = worth.min(room);
            bond.today += gained;
            gained
        };
        bond.points = bond.points.saturating_add(gained);
        let after = level(bond.points);
        Ok((bond.points, after, after > before))
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
        // Rising a level says so once.
        let mut points = b.0["a"].points;
        let mut rose = 0;
        let mut now = TIME_EVERY_MS;
        while points < LEVELS[1] {
            now += TIME_EVERY_MS;
            let (p, _, up) = b.befriend("a", "time", "2026-10-10", now).unwrap();
            points = p;
            rose += up as u32;
        }
        assert_eq!(rose, 1);
        b.forget("a");
        assert!(b.0.is_empty());
    }

    #[test]
    fn saved_bonds_are_kept_for_the_friends_there_are() {
        let raw = json!({"a": {"points": 70, "day": "2026-10-09", "today": 3, "time_at": 5}, "gone": {"points": 9}, "b": "nonsense"});
        let b = Bonds::restore(Some(&raw), &["a".into(), "b".into()]);
        assert_eq!(b.0.keys().collect::<Vec<_>>(), ["a"]);
        assert_eq!(b.0["a"].points, 70);
        assert_eq!(Bonds::restore(None, &[]), Bonds::default());
    }
}
