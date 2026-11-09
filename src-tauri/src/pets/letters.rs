//! The year-end letters: the closest friend writes one each year in late December, and the person
//! may answer it in a line. Kept in state.json, on this computer only. A letter's text is kept
//! until January 7 (the New Year card reads it) and then cleared, leaving the answer; deleting
//! clears everything but the year, so the year is not written again.
use crate::chat::prompt::one_line;
use crate::i18n;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Years kept; the oldest goes first.
pub const LETTERS_MAX: usize = 10;
/// The most characters of a letter.
pub const TEXT_MAX: usize = 1200;
/// The most characters of an answer.
pub const ANSWER_MAX: usize = 200;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Letter {
    pub year: u32,
    /// The friend who wrote it (an id), kept when that friend leaves.
    #[serde(default, deserialize_with = "super::or_default")]
    pub friend: String,
    #[serde(default, deserialize_with = "super::or_default")]
    pub text: String,
    #[serde(default, deserialize_with = "super::or_default")]
    pub answer: Option<String>,
    #[serde(default, deserialize_with = "super::or_default")]
    pub at: u64,
    /// Whether the New Year card has shown it; older files have none.
    #[serde(default, deserialize_with = "super::or_default")]
    pub back: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(transparent)]
pub struct Letters(pub Vec<Letter>);

/// The first day after which a year's letter text goes: every time zone has passed January 7.
fn expires_after(year: u32) -> String {
    format!("{:04}-01-09", year.saturating_add(1))
}

/// The last day of a year's letter on the page's own calendar: January 7.
fn season_end(year: u32) -> String {
    format!("{:04}-01-07", year.saturating_add(1))
}

fn bad() -> String {
    i18n::t("error.bad_request")
}

impl Letters {
    /// The letters as state.json has them; what does not read as a letter is left out.
    pub fn restore(raw: Option<&Value>, latest: &str) -> Letters {
        let mut all: Vec<Letter> = Vec::new();
        // Only objects: serde would also read an array such as `[2026]` as a letter.
        for entry in raw
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter(|e| e.is_object())
        {
            let Ok(mut l) = serde_json::from_value::<Letter>(entry.clone()) else {
                continue;
            };
            if !(2000..=9999).contains(&l.year) || all.iter().any(|k| k.year == l.year) {
                continue;
            }
            l.text = l.text.chars().take(TEXT_MAX).collect();
            l.answer = l.answer.map(|a| one_line(&a, ANSWER_MAX)).filter(|a| !a.is_empty());
            all.push(l);
        }
        all.sort_by_key(|l| l.year);
        let extra = all.len().saturating_sub(LETTERS_MAX);
        all.drain(..extra);
        let mut letters = Letters(all);
        letters.clear_expired(latest);
        letters
    }

    /// Clears the text of letters past January 7 (`latest` is the latest date anywhere on Earth);
    /// the answer stays. Run at restore; true when one was cleared.
    pub fn clear_expired(&mut self, latest: &str) -> bool {
        self.clear_after(latest, expires_after)
    }

    /// The same once the page's own date (`today`) is past January 7, asked at its minute check
    /// (`clearLetters`); true when one was cleared, so nothing is saved otherwise.
    pub fn clear_ended(&mut self, today: &str) -> bool {
        self.clear_after(today, season_end)
    }

    /// `clearLetters`: the page's date (`today`) is checked against the latest date on Earth, so a
    /// clock set ahead clears nothing; true when a letter was cleared and the change is to be saved.
    pub fn clear_for_page(&mut self, today: &str, latest: &str) -> Result<bool, String> {
        if !super::garden::is_day(today) || today > latest {
            return Err(bad());
        }
        Ok(self.clear_ended(today))
    }

    fn clear_after(&mut self, day: &str, last: fn(u32) -> String) -> bool {
        let mut cleared = false;
        for l in &mut self.0 {
            if !l.text.is_empty() && day > last(l.year).as_str() {
                l.text.clear();
                cleared = true;
            }
        }
        cleared
    }

    pub fn of(&self, year: u32) -> Option<&Letter> {
        self.0.iter().find(|l| l.year == year)
    }

    /// Keeps a new letter for `year`; each year has one, even after it is deleted. A year older
    /// than all of a full list is refused rather than kept and dropped at once.
    pub fn write(&mut self, year: u32, friend: &str, text: &str, at: u64) -> Result<Letter, String> {
        let text: String = text.trim().chars().take(TEXT_MAX).collect();
        let too_old = self.0.len() >= LETTERS_MAX && self.0.iter().all(|l| l.year > year);
        if self.of(year).is_some() || text.is_empty() || too_old {
            return Err(bad());
        }
        let letter = Letter {
            year,
            friend: friend.to_string(),
            text,
            answer: None,
            at,
            back: false,
        };
        self.0.push(letter.clone());
        self.0.sort_by_key(|l| l.year);
        let extra = self.0.len().saturating_sub(LETTERS_MAX);
        self.0.drain(..extra);
        Ok(letter)
    }

    /// The person's one-line answer to that year's letter.
    pub fn answer(&mut self, year: u32, answer: &str) -> Result<(), String> {
        let line = one_line(answer, usize::MAX);
        let n = line.chars().count();
        let letter = self.0.iter_mut().find(|l| l.year == year && !l.text.is_empty());
        match letter {
            Some(l) if (1..=ANSWER_MAX).contains(&n) => {
                l.answer = Some(line);
                Ok(())
            }
            _ => Err(bad()),
        }
    }

    /// Clears the letter and its answer; the year and time stay.
    pub fn delete(&mut self, year: u32) -> Result<(), String> {
        let l = self.0.iter_mut().find(|l| l.year == year).ok_or_else(bad)?;
        l.friend.clear();
        l.text.clear();
        l.answer = None;
        Ok(())
    }

    /// Last year's answer, to look back on.
    pub fn answer_before(&self, year: u32) -> Option<&str> {
        self.of(year.checked_sub(1)?)?.answer.as_deref()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn raw(year: Value, friend: &str, text: &str, answer: Value, at: u64) -> Value {
        json!({"year": year, "friend": friend, "text": text, "answer": answer, "at": at})
    }

    #[test]
    fn letters_come_back_and_odd_ones_are_left_out() {
        assert!(Letters::restore(None, "2026-12-27").0.is_empty());
        assert!(Letters::restore(Some(&json!("x")), "2026-12-27").0.is_empty());
        let list = json!([
            raw(json!(2026), "a", "hi", Value::Null, 1),
            raw(json!(2026), "a", "second", Value::Null, 1),
            raw(json!(1999), "a", "old", Value::Null, 1),
            raw(json!("2025"), "a", "str", Value::Null, 1),
            raw(json!(2025), "b", "t", json!("  one\ntwo "), 2),
        ]);
        let got = Letters::restore(Some(&list), "2026-12-27");
        assert_eq!(got.0.iter().map(|l| l.year).collect::<Vec<_>>(), [2025, 2026]);
        assert_eq!(got.of(2026).unwrap().text, "hi");
        assert_eq!(got.of(2025).unwrap().answer.as_deref(), Some("one two"));
        let many: Vec<Value> = (2010..2022).map(|y| raw(json!(y), "a", "t", Value::Null, 1)).collect();
        let got = Letters::restore(Some(&json!(many)), "2026-12-27");
        assert_eq!(got.0.len(), LETTERS_MAX);
        assert_eq!(got.0[0].year, 2012);
    }

    #[test]
    fn older_files_read_back_as_not_brought_back() {
        let got = Letters::restore(
            Some(&json!([raw(json!(2026), "a", "hi", Value::Null, 1)])),
            "2026-12-27",
        );
        assert!(!got.of(2026).unwrap().back);
        let mut with_back = raw(json!(2026), "a", "hi", Value::Null, 1);
        with_back["back"] = json!(true);
        assert!(
            Letters::restore(Some(&json!([with_back])), "2026-12-27")
                .of(2026)
                .unwrap()
                .back
        );
    }

    #[test]
    fn after_january_7_only_the_answer_is_kept() {
        let list = json!([raw(json!(2026), "a", "hi", json!("hike"), 1)]);
        let kept = Letters::restore(Some(&list), "2027-01-09");
        assert_eq!(kept.of(2026).unwrap().text, "hi");
        let late = Letters::restore(Some(&list), "2027-01-10");
        let l = late.of(2026).unwrap();
        assert_eq!(
            (l.text.as_str(), l.answer.as_deref(), l.friend.as_str()),
            ("", Some("hike"), "a")
        );
    }

    #[test]
    fn clear_expired_can_run_again_later() {
        let mut l = Letters::default();
        l.write(2026, "a", "hi", 1).unwrap();
        l.clear_expired("2027-01-09");
        assert_eq!(l.of(2026).unwrap().text, "hi");
        l.clear_expired("2027-01-10");
        assert_eq!(l.of(2026).unwrap().text, "");
        assert!(l.answer(2026, "x").is_err());
    }

    #[test]
    fn the_page_clears_a_letter_after_january_7_by_its_own_date() {
        let mut l = Letters::default();
        l.write(2026, "a", "hi", 1).unwrap();
        l.answer(2026, "hike").unwrap();
        assert!(!l.clear_ended("2027-01-07"));
        assert_eq!(l.of(2026).unwrap().text, "hi");
        assert!(l.clear_ended("2027-01-08"));
        let kept = l.of(2026).unwrap();
        assert_eq!((kept.text.as_str(), kept.answer.as_deref()), ("", Some("hike")));
        assert!(!l.clear_ended("2027-01-09"), "nothing left to clear: no save");
    }

    #[test]
    fn the_page_date_must_be_a_day_not_past_the_latest_on_earth_and_saves_only_on_a_change() {
        let mut l = Letters::default();
        l.write(2026, "a", "hi", 1).unwrap();
        assert!(l.clear_for_page("2027-1-8", "2027-01-08").is_err(), "not a day");
        assert!(
            l.clear_for_page("2027-01-09", "2027-01-08").is_err(),
            "a clock set ahead"
        );
        assert_eq!(l.of(2026).unwrap().text, "hi", "refused: nothing cleared");
        assert_eq!(
            l.clear_for_page("2027-01-07", "2027-01-08"),
            Ok(false),
            "still its season"
        );
        assert_eq!(l.clear_for_page("2027-01-08", "2027-01-08"), Ok(true));
        assert_eq!(
            l.clear_for_page("2027-01-08", "2027-01-08"),
            Ok(false),
            "nothing left: no save"
        );
    }

    #[test]
    fn a_letter_is_written_once_a_year() {
        let mut l = Letters::default();
        assert_eq!(l.write(2026, "a", " Dear you ", 5).unwrap().text, "Dear you");
        assert!(l.write(2026, "a", "again", 6).is_err());
        assert!(l.write(2027, "a", "   ", 6).is_err());
        let long = l.write(2028, "a", &"x".repeat(2000), 7).unwrap();
        assert_eq!(long.text.chars().count(), TEXT_MAX);
    }

    #[test]
    fn the_oldest_goes_past_ten() {
        let mut l = Letters::default();
        for y in 2020..2031 {
            l.write(y, "a", "t", 1).unwrap();
        }
        assert_eq!(l.0.len(), LETTERS_MAX);
        assert!(l.of(2020).is_none() && l.of(2030).is_some());
    }

    #[test]
    fn an_answer_is_one_line_of_at_most_200_characters() {
        let mut l = Letters::default();
        l.write(2026, "a", "hi", 1).unwrap();
        l.answer(2026, "line\none \"<b>\" 🎄").unwrap();
        assert_eq!(l.of(2026).unwrap().answer.as_deref(), Some("line one \"<b>\" 🎄"));
        assert!(l.answer(2026, &"가".repeat(200)).is_ok());
        assert!(l.answer(2026, &"가".repeat(201)).is_err());
        assert!(l.answer(2026, "   ").is_err());
        assert!(l.answer(2025, "x").is_err());
    }

    #[test]
    fn a_deleted_letter_keeps_only_its_year() {
        let mut l = Letters::default();
        l.write(2026, "a", "hi", 9).unwrap();
        l.answer(2026, "hike").unwrap();
        l.delete(2026).unwrap();
        let want = Letter {
            year: 2026,
            friend: String::new(),
            text: String::new(),
            answer: None,
            at: 9,
            back: false,
        };
        assert_eq!(l.of(2026), Some(&want));
        assert!(l.write(2026, "a", "again", 10).is_err());
        assert!(l.answer(2026, "x").is_err());
        assert_eq!(l.answer_before(2027), None);
    }

    #[test]
    fn last_year_s_answer_is_there_to_look_back_on() {
        let mut l = Letters::default();
        l.write(2025, "a", "hi", 1).unwrap();
        l.answer(2025, "hike").unwrap();
        assert_eq!(l.answer_before(2026), Some("hike"));
        assert_eq!(l.answer_before(2025), None);
    }

    #[test]
    fn a_year_older_than_the_ten_kept_is_refused_not_dropped() {
        let mut l = Letters::default();
        for y in 2020..2030 {
            l.write(y, "a", "t", 1).unwrap();
        }
        let before = l.clone();
        assert!(l.write(2019, "a", "t", 1).is_err());
        assert_eq!(l, before, "the ten kept stay");
        assert!(l.write(2030, "a", "t", 1).is_ok(), "a newer year pushes the oldest out");
        assert!(l.of(2020).is_none());
    }

    #[test]
    fn restore_cuts_long_text_and_skips_what_is_not_a_letter() {
        let list = json!([
            "a letter?",
            7,
            [2026],
            raw(json!(2026), "a", &"x".repeat(TEXT_MAX + 50), Value::Null, 1),
        ]);
        let got = Letters::restore(Some(&list), "2026-12-27");
        assert_eq!(got.0.len(), 1);
        assert_eq!(got.of(2026).unwrap().text.chars().count(), TEXT_MAX);
    }

    #[test]
    fn the_last_year_there_is_does_not_overflow() {
        assert_eq!(expires_after(u32::MAX), format!("{}-01-09", u32::MAX));
    }
}
