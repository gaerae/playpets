//! The year-end letter, written once: by the friend's AI when it has a connection, or else the
//! page's own lines from the string tables. The text is saved (pets/letters.rs), so the AI is asked
//! once a year and the letter reads the same after a restart. Without a connection nothing is sent
//! anywhere: the facts and the person's answer stay on this computer. The lock is let go while the
//! keychain is read and the AI writes (docs/standards/backend-locks.md); the year is held meanwhile,
//! so a page reloaded in the middle is told to wait rather than asking the AI again. What may pass
//! (a connection being saved, a friend sent away or a language changed meanwhile, a key that cannot
//! be read the first time in a run, a CLI that is signed out) writes nothing, and the page asks
//! again the next minute; an AI that fails, or a key that cannot be read again, leaves the page's
//! own letter, so a letter still arrives. A signed-out CLI waits for a sign-in until the new year
//! has begun somewhere on Earth, and then leaves the page's letter too.
use super::kind::Kind;
use super::{Speaker, ask, cli, prompt, same_connection, speaker, unlock};
use crate::app::{AppData, Shared, lock, now_ms, require_pet, show_and_save};
use crate::commands::{arg, text};
use crate::i18n;
use crate::pets::latest_day;
use crate::pets::letters::{Letter, Letters, TEXT_MAX};
use serde_json::{Value, json};
use std::collections::HashSet;
use std::sync::Mutex;
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

/// Whether `year` is over somewhere on Earth at `now`: from then on nothing waits for a sign-in.
fn year_over(year: u32, now: u64) -> bool {
    latest_day(now)
        .get(..4)
        .and_then(|y| y.parse::<u32>().ok())
        .is_some_and(|latest| latest > year)
}

/// The CLI a friend's AI runs through (claude or codex), or `None` for one spoken to over HTTP.
fn cli_of(writer: &Speaker) -> Option<&'static str> {
    match writer.config.kind {
        Kind::Claude => Some("claude"),
        Kind::Codex => Some("codex"),
        _ => None,
    }
}

/// The friend's AI, if it can write now: `None` without a connection (or with one that cannot be
/// used), which takes the page's lines. A connection being saved answers "try again" instead, so a
/// passing save does not settle the year on the lines; so does a CLI the app knows is signed out
/// (`detected`), without starting it, until `year` is over somewhere (`now`).
fn pen(d: &AppData, friend: &str, year: u32, now: u64) -> Result<Option<Speaker>, String> {
    require_pet(d, friend)?;
    let provider = d
        .pets
        .iter()
        .find(|p| p.id == friend)
        .map_or("", |p| p.provider_id.as_str());
    if d.provider_updates.contains(provider) {
        return Err(i18n::t("chat.provider_saving"));
    }
    let Ok(writer) = speaker(d, friend, false) else {
        return Ok(None);
    };
    match cli_of(&writer) {
        Some(kind) if d.detected["signedIn"][kind] == json!(false) => {
            if year_over(year, now) {
                Ok(None)
            } else {
                Err(cli::login_guide(kind))
            }
        }
        _ => Ok(Some(writer)),
    }
}

/// Checked once the key is read and the lock taken back, with the friend's own id (the writer's is
/// its letter session's): the friend is still here, the language and its connection are the same.
fn still_writing(d: &AppData, friend: &str, writer: &Speaker) -> Result<(), String> {
    require_pet(d, friend)?;
    if d.prefs.language != writer.language {
        return Err(i18n::t("chat.cancelled"));
    }
    same_connection(d, friend, &writer.provider)
}

/// How asking went, once the lock is let go.
enum Answer {
    /// What the AI wrote, or its error.
    Came(Result<String, String>),
    /// The key could not be read from the keychain.
    KeyUnread(String),
    /// Something changed while the key was read (the friend, the language, the connection).
    Again(String),
    /// The CLI turned the request away for not being signed in.
    SignedOut(String),
}

/// What came back from the friend's `kind` CLI (or `None` for HTTP): a turn it turned away for not
/// being signed in is told apart, so the year waits for a sign-in instead of settling on the lines.
fn answered(kind: Option<&str>, answer: Result<String, String>) -> Answer {
    match (kind, answer) {
        (Some(kind), Err(e)) if e == cli::login_guide(kind) => Answer::SignedOut(e),
        (_, answer) => Answer::Came(answer),
    }
}

/// Keeps what the AI sent back, under the lock taken again. A friend sent away or a language changed
/// meanwhile keeps nothing (the page asks again); an AI that failed leaves the page's own letter, so
/// a letter still arrives. A key that cannot be read waits for the next minute once a run, and then
/// takes the page's letter too, so the keychain is read at most twice, never once a minute. A
/// signed-out CLI keeps nothing until the year is over somewhere, so a sign-in meanwhile still gets
/// the AI's letter.
fn settle(
    d: &mut AppData,
    year: u32,
    friend: &str,
    language: i18n::Lang,
    answer: Answer,
    fallback: &str,
    now: u64,
) -> Result<Letter, String> {
    let answer = match answer {
        Answer::Came(answer) => answer,
        Answer::Again(e) => return Err(e),
        Answer::KeyUnread(e) if !d.letters_key_missed => {
            d.letters_key_missed = true;
            return Err(e);
        }
        Answer::KeyUnread(e) => Err(e),
        Answer::SignedOut(e) if !year_over(year, now) => return Err(e),
        Answer::SignedOut(e) => Err(e),
    };
    require_pet(d, friend)?;
    if d.prefs.language != language {
        return Err(i18n::t("chat.cancelled"));
    }
    d.letters.write(year, friend, &chosen(answer, fallback), now)
}

/// A year held in `letters_writing` while its AI writes. It is let go under the lock that keeps the
/// letter (`release`), or else when dropped, so a writer that panics does not hold the year until
/// the app restarts.
struct Held<'a> {
    state: &'a Mutex<AppData>,
    year: u32,
    released: bool,
}

impl<'a> Held<'a> {
    fn new(state: &'a Mutex<AppData>, year: u32) -> Self {
        Held {
            state,
            year,
            released: false,
        }
    }

    fn release(mut self, d: &mut AppData) {
        d.letters_writing.remove(&self.year);
        self.released = true;
    }
}

impl Drop for Held<'_> {
    fn drop(&mut self) {
        if !self.released {
            lock(self.state).letters_writing.remove(&self.year);
        }
    }
}

/// Reads the key and asks the AI once, without the lock.
fn ask_once(
    state: &Mutex<AppData>,
    cli: &cli::CliManager,
    friend: &str,
    mut writer: Speaker,
    request: String,
) -> Answer {
    if let Err(e) = unlock(std::slice::from_mut(&mut writer)) {
        return Answer::KeyUnread(e);
    }
    if let Err(e) = still_writing(&lock(state), friend, &writer) {
        return Answer::Again(e);
    }
    let turns = vec![json!({"role": "user", "content": request})];
    let at = cli::At {
        total: 0,
        in_history: 0,
        adds: 1,
    };
    let answer = ask(cli, &writer, "", turns, at, &AtomicBool::new(false));
    cli.reset(&writer.id);
    answered(cli_of(&writer), answer)
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
        let pen = pen(&d, &friend, year, now);
        let plan = plan(&d.letters, year, matches!(pen, Ok(Some(_))));
        if let Plan::Written(letter) = plan {
            return Ok(json!(letter));
        }
        take_turn(&mut d.letters_writing, year, &plan)?;
        match pen? {
            None => {
                let letter = d.letters.write(year, &friend, &fallback, now)?;
                return show_and_save(app, d).map(|()| json!(letter));
            }
            Some(writer) => {
                let request = prompt::letter_request(&facts, d.letters.answer_before(year));
                (writer, request)
            }
        }
    };
    let held = Held::new(state.inner(), year);
    let language = writer.language;
    // A session of its own, so the friend's chat is left as it was.
    writer.id = format!("letter-{friend}");
    writer.notes.clear();
    let answer = ask_once(state.inner(), cli, &friend, writer, request);

    let mut d = lock(state);
    held.release(&mut d);
    if let Some(letter) = d.letters.of(year) {
        return Ok(json!(letter));
    }
    let letter = settle(&mut d, year, &friend, language, answer, &fallback, now)?;
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

    fn pet(id: &str, provider: &str) -> Value {
        json!({"id": id, "assetId": "x", "name": id, "size": 96, "x": 0.5, "y": 0.5, "providerId": provider})
    }

    /// Friend `a` with a CLI connection `p` (no key to read), friend `b` with none.
    fn yard() -> AppData {
        let mut d = crate::app::tests::yard(json!([pet("a", "p"), pet("b", "")]));
        d.providers
            .push(json!({"id": "p", "name": "Claude", "type": "claude", "model": ""}));
        d
    }

    fn other(lang: i18n::Lang) -> i18n::Lang {
        i18n::Lang::all().find(|l| *l != lang).unwrap()
    }

    #[test]
    fn a_connection_being_saved_waits_and_none_at_all_takes_the_lines() {
        let mut d = yard();
        assert!(pen(&d, "a", 2026, DEC_27).unwrap().is_some());
        assert!(
            pen(&d, "b", 2026, DEC_27).unwrap().is_none(),
            "no connection: the page's lines, nothing sent"
        );
        assert!(
            pen(&d, "gone", 2026, DEC_27).is_err(),
            "a friend sent away writes nothing"
        );
        d.provider_updates.insert("p".into());
        assert!(
            pen(&d, "a", 2026, DEC_27).is_err(),
            "being saved: try again next minute, not the lines for good"
        );
    }

    #[test]
    fn the_ai_writes_only_if_nothing_changed_while_the_key_was_read() {
        let mut d = yard();
        let writer = pen(&d, "a", 2026, DEC_27).unwrap().unwrap();
        assert!(still_writing(&d, "a", &writer).is_ok());
        d.prefs.language = other(d.prefs.language);
        assert!(still_writing(&d, "a", &writer).is_err(), "another language");
        d.prefs.language = writer.language;
        d.providers[0]["model"] = json!("opus");
        assert!(still_writing(&d, "a", &writer).is_err(), "the connection changed");
        d.providers[0]["model"] = json!("");
        d.pets.retain(|p| p.id != "a");
        assert!(still_writing(&d, "a", &writer).is_err(), "the friend was sent away");
    }

    #[test]
    fn what_came_back_is_kept_unless_the_friend_or_the_language_changed() {
        let mut d = yard();
        let lang = d.prefs.language;
        let got = settle(
            &mut d,
            2026,
            "a",
            lang,
            Answer::Came(Ok("Dear you.".into())),
            "lines",
            5,
        )
        .unwrap();
        assert_eq!((got.text.as_str(), got.at), ("Dear you.", 5));
        let got = settle(&mut d, 2025, "a", lang, Answer::Came(Err("down".into())), "lines", 5).unwrap();
        assert_eq!(got.text, "lines", "an AI that fails still leaves a letter");
        assert!(
            settle(
                &mut d,
                2024,
                "a",
                other(lang),
                Answer::Came(Ok("Hi".into())),
                "lines",
                5
            )
            .is_err()
        );
        assert!(d.letters.of(2024).is_none(), "another language: the page asks again");
        d.pets.retain(|p| p.id != "a");
        assert!(settle(&mut d, 2023, "a", lang, Answer::Came(Err("down".into())), "lines", 5).is_err());
        assert!(
            d.letters.of(2023).is_none(),
            "no letter from a friend who left meanwhile"
        );
    }

    #[test]
    fn an_unreadable_key_waits_once_a_run_and_then_the_page_s_letter_is_kept() {
        let mut d = yard();
        let lang = d.prefs.language;
        let unread = || Answer::KeyUnread("locked".into());
        assert!(settle(&mut d, 2026, "a", lang, unread(), "lines", 5).is_err());
        assert!(d.letters.of(2026).is_none(), "the first time: try again next minute");
        assert!(d.letters_key_missed, "remembered for this run");
        let got = settle(&mut d, 2026, "a", lang, unread(), "lines", 5).unwrap();
        assert_eq!(got.text, "lines", "the second time: the keychain is not asked again");
        assert!(settle(&mut d, 2025, "a", lang, Answer::Again("changed".into()), "lines", 5).is_err());
        assert!(
            d.letters.of(2025).is_none(),
            "something changed meanwhile: nothing kept"
        );
        let mut d = yard();
        d.letters_key_missed = true;
        d.pets.retain(|p| p.id != "a");
        assert!(settle(&mut d, 2026, "a", lang, unread(), "lines", 5).is_err());
        assert!(d.letters.of(2026).is_none(), "no fallback from a friend who left");
    }

    // December 27, and December 31 at noon UTC, when the new year has begun somewhere.
    const DEC_27: u64 = 1_798_329_600_000;
    const NEW_YEAR_SOMEWHERE: u64 = 1_798_718_400_000;

    #[test]
    fn a_signed_out_cli_writes_nothing_until_the_year_is_over_somewhere() {
        let mut d = yard();
        let lang = d.prefs.language;
        let out = || Answer::SignedOut(cli::login_guide("claude"));
        assert!(settle(&mut d, 2026, "a", lang, out(), "lines", DEC_27).is_err());
        assert!(
            d.letters.of(2026).is_none(),
            "signed out: nothing kept, the page asks again after a sign-in"
        );
        let got = settle(&mut d, 2026, "a", lang, out(), "lines", NEW_YEAR_SOMEWHERE).unwrap();
        assert_eq!(got.text, "lines", "the year ending: the page's own letter still comes");
        assert!(matches!(
            answered(Some("claude"), Err(cli::login_guide("claude"))),
            Answer::SignedOut(_)
        ));
        assert!(matches!(
            answered(Some("claude"), Err("down".into())),
            Answer::Came(Err(_))
        ));
        assert!(matches!(
            answered(Some("claude"), Ok("Dear".into())),
            Answer::Came(Ok(_))
        ));
    }

    #[test]
    fn a_cli_known_to_be_signed_out_is_not_asked_and_waits_for_a_sign_in() {
        let mut d = yard();
        d.detected["signedIn"] = json!({"claude": false, "codex": null});
        assert!(
            pen(&d, "a", 2026, DEC_27).is_err(),
            "signed out: no CLI started, nothing kept"
        );
        assert!(
            pen(&d, "a", 2026, NEW_YEAR_SOMEWHERE).unwrap().is_none(),
            "the year ending: the page's lines"
        );
        assert!(
            pen(&d, "b", 2026, DEC_27).unwrap().is_none(),
            "no connection: still the lines"
        );
        d.detected["signedIn"]["claude"] = json!(null);
        assert!(
            pen(&d, "a", 2026, DEC_27).unwrap().is_some(),
            "nobody knows: the AI is asked"
        );
    }

    #[test]
    fn the_year_is_let_go_even_if_the_writer_falls_over() {
        use std::sync::Mutex;
        let state = Mutex::new(yard());
        lock(&state).letters_writing.insert(2026);
        let held = Held::new(&state, 2026);
        let fell = std::panic::catch_unwind(std::panic::AssertUnwindSafe(move || {
            let _held = held;
            panic!("the AI's reply could not be read");
        }));
        assert!(fell.is_err());
        assert!(
            lock(&state).letters_writing.is_empty(),
            "a panic does not hold the year"
        );
        lock(&state).letters_writing.insert(2026);
        let held = Held::new(&state, 2026);
        let mut d = lock(&state);
        held.release(&mut d);
        assert!(d.letters_writing.is_empty(), "let go under the lock already held");
    }
}
