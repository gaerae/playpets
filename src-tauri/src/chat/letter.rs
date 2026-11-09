//! The year-end letter, written once: by the friend's AI when it has a connection, or else the
//! page's own lines from the string tables. The text is saved (pets/letters.rs), so the AI is asked
//! once a year and the letter reads the same after a restart. Without a connection nothing is sent
//! anywhere: the facts and the person's answer stay on this computer. The lock is let go while the
//! keychain is read and the AI writes (docs/standards/backend-locks.md); the year is held meanwhile,
//! so a page reloaded in the middle is told to wait rather than asking the AI again.
use super::{Speaker, ask, cli, prompt, providers, speaker, unlock};
use crate::app::{AppData, Shared, lock, now_ms, require_pet, show_and_save};
use crate::commands::{arg, text};
use crate::i18n;
use crate::pets::latest_day;
use crate::pets::letters::{Letter, Letters, TEXT_MAX};
use serde_json::{Value, json};
use std::collections::HashSet;
use std::sync::atomic::AtomicBool;
use tauri::{AppHandle, State};

enum Plan {
    /// The year has its letter (or had one, deleted since): it is never written again.
    Written(Letter),
    /// No AI connection: the page's own lines.
    Lines,
    Ai,
}

fn plan(letters: &Letters, year: u32, has_ai: bool) -> Plan {
    match letters.of(year) {
        Some(l) => Plan::Written(l.clone()),
        None if has_ai => Plan::Ai,
        None => Plan::Lines,
    }
}

/// Holds the year while its AI writes; a second write meanwhile waits for the first.
fn take_turn(writing: &mut HashSet<u32>, year: u32, plan: &Plan) -> Result<(), String> {
    match plan {
        Plan::Written(_) => Ok(()),
        _ if writing.contains(&year) => Err(i18n::t("chat.still_answering")),
        Plan::Ai => {
            writing.insert(year);
            Ok(())
        }
        Plan::Lines => Ok(()),
    }
}

/// What the AI wrote, as plain text; a failed or empty answer leaves the page's letter.
fn chosen(answer: Result<String, String>, fallback: &str) -> String {
    let text = answer.map(|a| prompt::take_persona(&a).0).unwrap_or_default();
    let text: String = text.trim().chars().take(TEXT_MAX).collect();
    if text.is_empty() { fallback.to_string() } else { text }
}

struct Asked {
    year: u32,
    friend: String,
    facts: Vec<String>,
    fallback: String,
}

/// The page's arguments: a year that is this year or the last somewhere on Earth (`latest` is
/// the latest date anywhere), a friend, at most `FACTS_MAX` facts and its own letter.
fn checked(args: &[Value], latest: &str) -> Result<Asked, String> {
    let bad = || i18n::t("error.bad_request");
    let year: u32 = serde_json::from_value(arg(args, 0).clone()).map_err(|_| bad())?;
    let now: u32 = latest.get(..4).and_then(|y| y.parse().ok()).ok_or_else(bad)?;
    if year != now && year.checked_add(1) != Some(now) {
        return Err(bad());
    }
    let facts = arg(args, 2).as_array().ok_or_else(bad)?;
    if facts.len() > prompt::FACTS_MAX {
        return Err(bad());
    }
    let facts = facts
        .iter()
        .map(|f| f.as_str().map(str::to_string).ok_or_else(bad))
        .collect::<Result<Vec<_>, _>>()?;
    let fallback = text(args, 3);
    if fallback.trim().is_empty() {
        return Err(bad());
    }
    Ok(Asked {
        year,
        friend: text(args, 1).to_string(),
        facts,
        fallback: fallback.to_string(),
    })
}

/// Checked once the key is read and the lock taken back, with the friend's own id (the writer's is
/// its letter session's): the friend is still here and its connection neither changed nor is being
/// saved. Either way the year is let go and the page asks again later.
fn still_writing(d: &AppData, friend: &str, writer: &Speaker) -> Result<(), String> {
    require_pet(d, friend)?;
    let id = providers::id_of(&writer.provider);
    let current = d.pets.iter().find(|p| p.id == friend).map(|p| p.provider_id.as_str());
    if d.provider_updates.contains(id) || current != Some(id) || providers::find(d, id) != Some(&writer.provider) {
        return Err(i18n::t("chat.provider_saving"));
    }
    Ok(())
}

/// Asks the AI once, without the lock. The outer error gives the year up; the inner one is the AI's
/// (or an unreadable key's), which leaves the page's letter.
fn ask_once(
    state: &State<Shared>,
    cli: &cli::CliManager,
    friend: &str,
    mut writer: Speaker,
    request: String,
) -> Result<Result<String, String>, String> {
    if let Err(e) = unlock(std::slice::from_mut(&mut writer)) {
        return Ok(Err(e));
    }
    still_writing(&lock(state), friend, &writer)?;
    let turns = vec![json!({"role": "user", "content": request})];
    let at = cli::At {
        total: 0,
        in_history: 0,
        adds: 1,
    };
    let answer = ask(cli, &writer, "", turns, at, &AtomicBool::new(false));
    cli.reset(&writer.id);
    Ok(answer)
}

/// `(year, friend, facts, fallback)`: that year's letter, written once. Returns the letter.
pub fn write(app: &AppHandle, state: &State<Shared>, cli: &cli::CliManager, args: &[Value]) -> Result<Value, String> {
    let now = now_ms();
    let Asked {
        year,
        friend,
        facts,
        fallback,
    } = checked(args, &latest_day(now))?;
    let (mut writer, request) = {
        let mut d = lock(state);
        require_pet(&d, &friend)?;
        // No connection, or one being saved right now: the page's lines.
        let writer = speaker(&d, &friend, false).ok();
        let plan = plan(&d.letters, year, writer.is_some());
        take_turn(&mut d.letters_writing, year, &plan)?;
        match (plan, writer) {
            (Plan::Written(letter), _) => return Ok(json!(letter)),
            (Plan::Ai, Some(writer)) => {
                let request = prompt::letter_request(&facts, d.letters.answer_before(year));
                (writer, request)
            }
            _ => {
                let letter = d.letters.write(year, &friend, &fallback, now)?;
                return show_and_save(app, d).map(|()| json!(letter));
            }
        }
    };
    // A session of its own, so the friend's chat is left as it was.
    writer.id = format!("letter-{friend}");
    writer.notes.clear();
    let answer = ask_once(state, cli, &friend, writer, request);

    let mut d = lock(state);
    d.letters_writing.remove(&year);
    let answer = answer?;
    if let Some(letter) = d.letters.of(year) {
        return Ok(json!(letter));
    }
    let letter = d.letters.write(year, &friend, &chosen(answer, &fallback), now)?;
    show_and_save(app, d).map(|()| json!(letter))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_letter_is_asked_for_once_and_kept_as_it_came() {
        let mut l = Letters::default();
        assert!(
            matches!(plan(&l, 2026, false), Plan::Lines),
            "no AI: the page's lines, nothing sent"
        );
        assert!(matches!(plan(&l, 2026, true), Plan::Ai));
        l.write(2026, "a", "hi", 1).unwrap();
        assert!(
            matches!(plan(&l, 2026, true), Plan::Written(w) if w.text == "hi"),
            "written: never asked again"
        );
        l.delete(2026).unwrap();
        assert!(
            matches!(plan(&l, 2026, true), Plan::Written(_)),
            "deleted: not written again"
        );
        assert_eq!(
            chosen(Ok("  Dear you.\n<persona>sly</persona> ".into()), "lines"),
            "Dear you."
        );
        assert_eq!(chosen(Ok("   ".into()), "lines"), "lines");
        assert_eq!(
            chosen(Err("down".into()), "lines"),
            "lines",
            "an AI that fails leaves the page's letter"
        );
        assert_eq!(chosen(Ok("a".repeat(5000)), "lines").chars().count(), TEXT_MAX);
    }

    #[test]
    fn a_second_write_while_the_ai_is_writing_that_year_answers_busy() {
        let mut writing = HashSet::new();
        assert!(take_turn(&mut writing, 2026, &Plan::Ai).is_ok());
        assert!(writing.contains(&2026), "the year is held while the AI writes");
        assert!(
            take_turn(&mut writing, 2026, &Plan::Ai).is_err(),
            "a reload mid-write asks nothing"
        );
        assert!(
            take_turn(&mut writing, 2026, &Plan::Lines).is_err(),
            "nor writes the lines over it"
        );
        assert!(
            take_turn(&mut writing, 2025, &Plan::Ai).is_ok(),
            "another year is its own"
        );
        writing.remove(&2026);
        assert!(take_turn(&mut writing, 2026, &Plan::Lines).is_ok());
        assert!(!writing.contains(&2026), "lines are written at once and hold nothing");
    }

    #[test]
    fn a_letter_is_written_for_this_year_or_the_last_from_at_most_six_facts() {
        let ok = |args: Value| checked(args.as_array().unwrap(), "2027-01-01").map(|a| a.year);
        assert_eq!(ok(json!([2027, "a", [], "hi"])), Ok(2027));
        assert_eq!(
            ok(json!([2026, "a", ["f"], "hi"])),
            Ok(2026),
            "December's letter past midnight UTC+14"
        );
        assert!(ok(json!([2025, "a", [], "hi"])).is_err());
        assert!(ok(json!([2028, "a", [], "hi"])).is_err(), "a clock set ahead");
        assert!(ok(json!(["2027", "a", [], "hi"])).is_err());
        assert!(ok(json!([2027, "a", ["1", "2", "3", "4", "5", "6", "7"], "hi"])).is_err());
        assert!(ok(json!([2027, "a", [1], "hi"])).is_err());
        assert!(ok(json!([2027, "a", "facts", "hi"])).is_err());
        assert!(
            ok(json!([2027, "a", [], "  "])).is_err(),
            "the page always has its own letter"
        );
        let asked = checked(json!([2027, "b", ["x"], "Dear"]).as_array().unwrap(), "2027-01-01").unwrap();
        assert_eq!(
            (asked.friend.as_str(), asked.facts, asked.fallback.as_str()),
            ("b", vec!["x".to_string()], "Dear")
        );
    }
}
