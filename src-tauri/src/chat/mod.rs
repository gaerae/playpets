//! Conversations: one friend answering its owner, or several friends talking in turn.
//! Histories live in memory only; the lock is never held while an AI is answering.
//! Each friend talks through an AI connection (providers): a subscription CLI (cli) or an
//! HTTP API (http), told who it is by prompt.
pub mod cli;
pub mod http;
pub mod kind;
pub mod prompt;
pub mod providers;

use crate::app::{AppData, Shared, changed, lock, pet_name, push_event, require_pet, set_status};
use crate::commands::{arg, text};
use crate::i18n;
use serde_json::{Value, json};
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, State};

/// How many of the latest messages a friend is handed when it answers, how many the log on screen
/// keeps for the session, and how long one message may be.
const HISTORY_LIMIT: usize = 24;
const LOG_LIMIT: usize = 500;
const MESSAGE_LIMIT: usize = 4000;
const GROUP_MAX: usize = 4;

/// What the chat keeps while the app runs: each friend's conversation, and the answers on their way.
#[derive(Default)]
pub struct Talks {
    /// Each friend's conversation as the log shows it; the AI is handed only its end.
    histories: HashMap<String, Vec<Value>>,
    /// Entries each history has had since it started, trimming aside (chat CLI sessions go by it).
    totals: HashMap<String, u64>,
    /// Friends waiting for an answer, each with the flag that calls it off (one flag for every
    /// friend in a group turn).
    waiting: HashMap<String, Arc<AtomicBool>>,
}

impl Talks {
    /// The latest messages, which the friend answers with.
    pub fn history(&self, id: &str) -> Vec<Value> {
        let log = self.histories.get(id).map(Vec::as_slice).unwrap_or_default();
        log[log.len().saturating_sub(HISTORY_LIMIT)..].to_vec()
    }
    /// The whole conversation of this session, for the chat log.
    pub fn log(&self, id: &str) -> Vec<Value> {
        self.histories.get(id).cloned().unwrap_or_default()
    }
    fn total(&self, id: &str) -> u64 {
        self.totals.get(id).copied().unwrap_or(0)
    }
    fn remember(&mut self, id: &str, entry: Value) {
        *self.totals.entry(id.into()).or_default() += 1;
        let history = self.histories.entry(id.into()).or_default();
        history.push(entry);
        let extra = history.len().saturating_sub(LOG_LIMIT);
        history.drain(..extra);
    }
    fn forget(&mut self, id: &str) {
        self.histories.remove(id);
        self.totals.remove(id);
    }
    /// Whether a friend is waiting for an answer.
    pub fn busy(&self, id: &str) -> bool {
        self.waiting.contains_key(id)
    }
    pub fn busy_ids(&self) -> impl Iterator<Item = &String> {
        self.waiting.keys()
    }
    fn wait(&mut self, id: &str, cancel: &Arc<AtomicBool>) {
        self.waiting.insert(id.into(), cancel.clone());
    }
    /// Stop replies composed in the previous language without removing conversation history.
    pub fn cancel_pending(&self) {
        for flag in self.waiting.values() {
            flag.store(true, Ordering::SeqCst);
        }
    }
    fn done(&mut self, id: &str) {
        self.waiting.remove(id);
    }
}

fn too_long() -> String {
    i18n::tr("chat.too_long", &[("limit", &MESSAGE_LIMIT.to_string())])
}

/// One friend in a conversation: its AI connection and what it needs to answer as itself.
/// `identity` stays the same from turn to turn; `notes` (agent activity) do not.
struct Speaker {
    id: String,
    name: String,
    config: http::Config,
    /// The AI connection as it was when the speaker was made, to tell whether it changed while
    /// the lock was let go.
    provider: Value,
    /// The provider whose API key the keychain holds; read by `unlock`, never under the lock.
    key_id: Option<String>,
    identity: String,
    language: i18n::Lang,
    notes: String,
}

fn speaker(d: &AppData, id: &str, in_group: bool) -> Result<Speaker, String> {
    let pet = d
        .pets
        .iter()
        .find(|p| p.id == id)
        .ok_or_else(|| i18n::t("error.friend_missing"))?;
    let provider = providers::find(d, &pet.provider_id).ok_or_else(|| {
        if in_group {
            let name = pet_name(d, pet, &i18n::t("chat.a_friend"));
            i18n::tr("chat.connect_first", &[("name", &name)])
        } else {
            i18n::t("chat.choose_connection")
        }
    })?;
    let provider_id = providers::id_of(provider);
    if d.provider_updates.contains(provider_id) {
        return Err(i18n::t("chat.provider_saving"));
    }
    let config = http::validate_config(provider)?;
    let key_id = d.secret_ids.contains(provider_id).then(|| provider_id.to_string());
    let name = pet_name(d, pet, "friend");
    let intro = d
        .assets
        .iter()
        .find(|a| a.id == pet.asset_id)
        .map(|a| a.intro.as_str())
        .unwrap_or("");
    let activity = d.activity.get(id).map(Vec::as_slice).unwrap_or(&[]);
    let friends: Vec<String> = d
        .pets
        .iter()
        .filter(|p| p.id != id)
        .map(|p| prompt::friend_label(&pet_name(d, p, "friend"), &p.relation))
        .collect();
    let persona = prompt::persona_or_intro(&pet.persona, intro);
    let identity = prompt::identity(
        &name,
        persona,
        prompt::Provenance::of(&pet.persona_from, &pet.persona, intro),
        &prompt::bond(&pet.relation, &pet.call_me),
        &friends,
        d.prefs.language.english_name(),
    );
    Ok(Speaker {
        id: id.into(),
        name,
        config,
        provider: provider.clone(),
        key_id,
        identity,
        language: d.prefs.language,
        notes: prompt::activity_notes(activity, crate::app::now_ms()),
    })
}

/// Reads the speakers' API keys from the keychain. Called with the state lock released: the
/// keychain may ask the person first, and nothing else in the app should wait for that.
/// Friends that share an AI connection share its key, which is read once.
fn unlock(speakers: &mut [Speaker]) -> Result<(), String> {
    let mut keys: HashMap<String, String> = HashMap::new();
    for s in speakers {
        if let Some(id) = &s.key_id {
            if !keys.contains_key(id) {
                let key = providers::read_key(id).ok_or_else(|| i18n::t("chat.key_unreadable"))?;
                keys.insert(id.clone(), key);
            }
            s.config.api_key = keys[id].clone();
        }
    }
    Ok(())
}

/// Checked again once the lock is taken back after `unlock`: the friend is still here, not
/// already answering, and its AI connection was neither changed nor is being saved meanwhile.
fn still_ready(d: &AppData, s: &Speaker) -> Result<(), String> {
    require_pet(d, &s.id)?;
    if d.prefs.language != s.language {
        return Err(i18n::t("chat.cancelled"));
    }
    if d.talks.busy(&s.id) {
        return Err(i18n::t("chat.still_answering"));
    }
    let id = providers::id_of(&s.provider);
    let current = d.pets.iter().find(|p| p.id == s.id).map(|p| p.provider_id.as_str());
    if d.provider_updates.contains(id) || current != Some(id) || providers::find(d, id) != Some(&s.provider) {
        return Err(i18n::t("chat.provider_saving"));
    }
    Ok(())
}

/// `extra` is added to the system prompt for this conversation (the note for chatting together).
/// `turns` are the history and the new message.
fn ask(
    cli: &cli::CliManager,
    speaker: &Speaker,
    extra: &str,
    turns: Vec<Value>,
    at: cli::At,
    cancel: &AtomicBool,
) -> Result<String, String> {
    let identity = if extra.is_empty() {
        speaker.identity.clone()
    } else {
        format!("{}\n{extra}", speaker.identity)
    };
    if speaker.config.kind.is_cli() {
        return cli.chat(
            &speaker.id,
            &speaker.config,
            &identity,
            &speaker.notes,
            &turns,
            at,
            cancel,
        );
    }
    let mut messages = vec![json!({"role": "system", "content": format!("{identity}\n{}", speaker.notes)})];
    messages.extend(turns);
    let config = speaker.config.clone();
    unless_called_off(cancel, move || http::chat(&config, &messages))
}

/// Runs a request that cannot be interrupted (an HTTP call) on its own thread, and stops waiting
/// for it as soon as the conversation is called off: ■ ends the wait at once, and the request's
/// own timeout ends the thread later, its answer dropped.
fn unless_called_off<T: Send + 'static>(
    cancel: &AtomicBool,
    work: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    use std::sync::mpsc::{RecvTimeoutError, channel};
    let (tx, rx) = channel();
    std::thread::spawn(move || {
        let _ = tx.send(work());
    });
    loop {
        match rx.recv_timeout(std::time::Duration::from_millis(100)) {
            Ok(result) => return result,
            Err(RecvTimeoutError::Timeout) if !cancel.load(Ordering::SeqCst) => {}
            Err(RecvTimeoutError::Timeout) => return Err(i18n::t("chat.cancelled")),
            Err(RecvTimeoutError::Disconnected) => return Err(i18n::t("ai.unreachable")),
        }
    }
}

/// Forgets a friend's conversation, and the CLI session that held it.
pub fn reset(d: &mut AppData, cli: &cli::CliManager, id: &str) {
    d.talks.forget(id);
    cli.reset(id);
}

/// Calls off the answer a friend is waiting for, whichever kind of AI is writing it: its turn's flag
/// (the one place a cancel is kept, which the CLI turn also watches) and an idle CLI session.
pub fn cancel(d: &AppData, cli: &cli::CliManager, id: &str) {
    if let Some(flag) = d.talks.waiting.get(id) {
        flag.store(true, Ordering::SeqCst);
    }
    cli.cancel(id);
}

/// Empties a conversation; not while an answer is on its way.
pub fn clear(state: &State<Shared>, cli: &cli::CliManager, id: &str) -> Result<Value, String> {
    let mut d = lock(state);
    require_pet(&d, id)?;
    if d.talks.busy(id) {
        return Err(i18n::t("error.cancel_before_clear"));
    }
    reset(&mut d, cli, id);
    Ok(Value::Null)
}

fn preview(text: &str) -> String {
    text.chars().take(100).collect()
}

/// A friend was asked, in conversation, to be someone a little different from now on.
fn save_persona(app: &AppHandle, d: &mut AppData, id: &str, persona: String) {
    let Some(pet) = d.pets.iter_mut().find(|p| p.id == id) else {
        return;
    };
    pet.persona = persona;
    pet.persona_from = "chat".into();
    // Shown either way (the friend settings read it); the notice only once it is saved.
    if crate::app::save_and_show(app, d).is_ok() {
        push_event(app, &json!({"type": "persona-saved", "petId": id}));
    }
}

pub fn chat(app: &AppHandle, state: &State<Shared>, cli: &cli::CliManager, args: &[Value]) -> Result<Value, String> {
    let id = text(args, 0).to_string();
    let text = text(args, 1).to_string();

    if text.trim().is_empty() || text.chars().count() > MESSAGE_LIMIT {
        return Err(too_long());
    }
    let mut speaker = {
        let d = lock(state);
        require_pet(&d, &id)?;
        if d.talks.busy(&id) {
            return Err(i18n::t("chat.still_answering"));
        }
        speaker(&d, &id, false)?
    };
    unlock(std::slice::from_mut(&mut speaker))?;
    let (messages, at, cancel) = {
        let mut d = lock(state);
        still_ready(&d, &speaker)?;
        let mut messages = d.talks.history(&id);
        let at = cli::At {
            total: d.talks.total(&id),
            in_history: messages.len(),
            adds: 2,
        };
        messages.push(json!({"role": "user", "content": text.trim()}));
        let cancel = Arc::new(AtomicBool::new(false));
        d.talks.wait(&id, &cancel);
        chat_status(app, &mut d, &id, "working", &i18n::t("chat.thinking"));
        (messages, at, cancel)
    };

    let answer = ask(cli, &speaker, "", messages, at, &cancel);

    let mut d = lock(state);
    d.talks.done(&id);
    let cancelled = cancel.load(Ordering::SeqCst);
    match answer {
        Ok(answer) if !cancelled => {
            let (answer, persona) = prompt::take_persona(&answer);
            if let Some(persona) = persona {
                save_persona(app, &mut d, &id, persona);
            }
            // The friend may have been sent away while it was thinking.
            if d.pets.iter().any(|p| p.id == id) {
                d.talks.remember(&id, json!({"role": "user", "content": text.trim()}));
                d.talks.remember(&id, json!({"role": "assistant", "content": answer}));
                chat_status(app, &mut d, &id, "done", &preview(&answer));
            } else {
                changed(app, &d);
            }
            Ok(json!(answer))
        }
        other => {
            // An answer that came back just as it was called off is dropped: so is its session.
            cli.reset(&id);
            let message = match other {
                Err(e) if !cancelled => e,
                _ => i18n::t("chat.cancelled"),
            };
            let status = if cancelled { "idle" } else { "error" };
            chat_status(app, &mut d, &id, status, &message);
            Err(message)
        }
    }
}

/// Friends chatting together: ids[0] is the friend the owner is talking to, the rest join in.
/// Each friend answers in turn with its own AI and persona, sees the others' lines as
/// [name]-tagged messages, and everyone remembers the exchange. An empty text is a
/// "ping-pong" round: the friends keep talking without a new message from the owner.
pub fn chat_with(
    app: &AppHandle,
    state: &State<Shared>,
    cli: &cli::CliManager,
    args: &[Value],
) -> Result<Value, String> {
    let ids: Vec<String> = arg(args, 0)
        .as_array()
        .map(|a| a.iter().filter_map(|v| v.as_str().map(str::to_string)).collect())
        .unwrap_or_default();
    let text = text(args, 1).trim().to_string();
    // Friends answer when spoken to; a round without a message is the yard's chatter (its own
    // command, with an opener), not this one.
    if text.is_empty() {
        return Err(i18n::t("chat.speak_first"));
    }
    if text.chars().count() > MESSAGE_LIMIT {
        return Err(too_long());
    }
    group_round(app, state, cli, ids, text, None)
}

/// The friends talk among themselves without being asked (the yard's "chatter" button, or the
/// timer): the ones with an AI, up to three, opened with a line about the moment.
pub fn chatter(app: &AppHandle, state: &State<Shared>, cli: &cli::CliManager, args: &[Value]) -> Result<Value, String> {
    let (ids, bonds) = {
        let d = lock(state);
        let ids = chatty(
            d.pets.iter().map(|p| (p.id.as_str(), !p.provider_id.is_empty())),
            |id| d.talks.busy(id),
        );
        let bonds = d.pets.iter().any(|p| ids.contains(&p.id) && !p.relation.is_empty());
        (ids, bonds)
    };
    if ids.len() < 2 {
        return Err(i18n::t("chat.need_two"));
    }
    group_round(
        app,
        state,
        cli,
        ids,
        String::new(),
        Some(opener(text(args, 0), text(args, 1), bonds)),
    )
}

/// Up to three friends who have an AI and are not already answering, in yard order.
fn chatty<'a>(pets: impl Iterator<Item = (&'a str, bool)>, busy: impl Fn(&str) -> bool) -> Vec<String> {
    pets.filter(|(id, has_ai)| *has_ai && !busy(id))
        .map(|(id, _)| id.to_string())
        .take(3)
        .collect()
}

/// What gets a chatter round going. The model sees it; the person does not. With a relationship
/// among the speakers, each keeps its voice to the owner among friends too.
fn opener(period: &str, weather: &str, bonds: bool) -> String {
    let base = format!(
        "(Start a short conversation with your friends. It is {period} and the weather is {weather}; you may bring that up, or anything from your day. One or two sentences each, in your own voice."
    );
    if bonds {
        format!(
            "{base} Speak as who you are to your owner: a partner, a senior or a younger sibling keeps that voice among friends too.)"
        )
    } else {
        format!("{base})")
    }
}

fn group_round(
    app: &AppHandle,
    state: &State<Shared>,
    cli: &cli::CliManager,
    ids: Vec<String>,
    text: String,
    opener: Option<String>,
) -> Result<Value, String> {
    // Each friend once: the same one twice would answer twice and keep the question twice.
    let unique: std::collections::HashSet<&String> = ids.iter().collect();
    if ids.len() < 2 || ids.len() > GROUP_MAX || unique.len() != ids.len() {
        return Err(i18n::t("chat.group_size"));
    }
    let host = &ids[0];
    let cancel = Arc::new(AtomicBool::new(false));
    let mut speakers: Vec<Speaker> = {
        let d = lock(state);
        let mut speakers = Vec::new();
        for id in &ids {
            require_pet(&d, id)?;
            if d.talks.busy(id) {
                return Err(i18n::t("chat.still_answering"));
            }
            speakers.push(speaker(&d, id, true)?);
        }
        speakers
    };
    unlock(&mut speakers)?;
    let speakers = speakers;
    {
        let mut d = lock(state);
        // The lock was let go while the keys were read.
        for s in &speakers {
            still_ready(&d, s)?;
        }
        for s in &speakers {
            d.talks.wait(&s.id, &cancel);
            if !text.is_empty() {
                d.talks.remember(&s.id, json!({"role": "user", "content": text}));
            }
        }
        chat_status(app, &mut d, host, "working", &i18n::t("chat.group_talking"));
    }

    let mut replies: Vec<Value> = Vec::new();
    let mut outcome: Result<(), String> = Ok(());
    for (turn, speaker) in speakers.iter().enumerate() {
        if cancel.load(Ordering::SeqCst) {
            break;
        }
        let nudge = if turn == 0 { opener.as_deref() } else { None };
        match one_turn(app, state, cli, &speakers, speaker, nudge, &cancel) {
            Ok(Some(reply)) => replies.push(reply),
            Ok(None) => break,
            Err(e) => {
                outcome = Err(i18n::tr("chat.from_friend", &[("name", &speaker.name), ("detail", &e)]));
                break;
            }
        }
    }

    let mut d = lock(state);
    let cancelled = cancel.load(Ordering::SeqCst);
    for s in &speakers {
        d.talks.done(&s.id);
    }
    match (outcome, cancelled) {
        (_, true) => {
            chat_status(app, &mut d, host, "idle", &i18n::t("chat.cancelled"));
            Err(i18n::t("chat.cancelled"))
        }
        (Err(e), _) => {
            chat_status(app, &mut d, host, "error", &e);
            Err(e)
        }
        (Ok(()), _) => {
            let last = replies.last().and_then(|r| r["message"].as_str()).unwrap_or("");
            chat_status(app, &mut d, host, "done", &preview(last));
            Ok(json!(replies))
        }
    }
}

/// One friend's turn in a group round: it answers with everyone's lines so far in its history,
/// the answer goes into every history (tagged with the speaker for the others) and to the page.
/// None when the round was cancelled meanwhile.
fn one_turn(
    app: &AppHandle,
    state: &State<Shared>,
    cli: &cli::CliManager,
    speakers: &[Speaker],
    speaker: &Speaker,
    nudge: Option<&str>,
    cancel: &Arc<AtomicBool>,
) -> Result<Option<Value>, String> {
    let friends: Vec<String> = speakers
        .iter()
        .filter(|s| s.id != speaker.id)
        .map(|s| s.name.clone())
        .collect();
    let (mut messages, total) = {
        let d = lock(state);
        (d.talks.history(&speaker.id), d.talks.total(&speaker.id))
    };
    // The question and the others' lines are already in the history; this turn adds the answer.
    let at = cli::At {
        total,
        in_history: messages.len(),
        adds: 1,
    };
    // A chatter round has no message from the owner: it opens with a line about the moment.
    if let Some(nudge) = nudge {
        messages.push(json!({"role": "user", "content": nudge}));
    }
    let answer = ask(
        cli,
        speaker,
        &prompt::group_note(&speaker.name, &friends),
        messages,
        at,
        cancel,
    );
    if cancel.load(Ordering::SeqCst) {
        // The answer is dropped, so the CLI session that wrote it no longer matches the history.
        cli.reset(&speaker.id);
        return Ok(None);
    }
    // Among friends a <persona> line is dropped, not saved: only the owner, in a conversation of
    // their own, can change who a friend is.
    let (answer, _) = prompt::take_persona(&answer?);
    let mut d = lock(state);
    // A language change can occur after the provider returns but before this lock.
    if cancel.load(Ordering::SeqCst) {
        drop(d);
        cli.reset(&speaker.id);
        return Ok(None);
    }
    for s in speakers {
        let entry = if s.id == speaker.id {
            json!({"role": "assistant", "content": answer})
        } else {
            prompt::peer_entry(&speaker.id, &speaker.name, &answer)
        };
        d.talks.remember(&s.id, entry);
    }
    push_event(
        app,
        &json!({"type": "chat-message", "petId": speaker.id, "name": speaker.name, "message": answer}),
    );
    Ok(Some(
        json!({"petId": speaker.id, "name": speaker.name, "message": answer}),
    ))
}

/// A chat answer's state, unless a coding agent is in the middle of work on this friend: its word
/// stands until it reports again, so the yard keeps showing the work.
fn chat_status(app: &AppHandle, d: &mut AppData, id: &str, state: &str, message: &str) {
    if agent_busy(d.statuses.get(id)) {
        // The page still hears that the chat started or ended (who is waiting is part of the state).
        changed(app, d);
        return;
    }
    set_status(app, d, id, state, message, "chat");
}
fn agent_busy(status: Option<&Value>) -> bool {
    status.is_some_and(|s| s["source"] == "agent" && matches!(s["state"].as_str(), Some("working" | "waiting")))
}

#[cfg(test)]
mod tests {
    use super::{agent_busy, chatty, opener};
    use serde_json::json;

    #[test]
    fn a_call_off_ends_the_wait_without_waiting_for_the_server() {
        use std::sync::atomic::{AtomicBool, Ordering};
        use std::time::{Duration, Instant};
        let answered = super::unless_called_off(&AtomicBool::new(false), || Ok("hi".to_string()));
        assert_eq!(answered.unwrap(), "hi");
        let failed = super::unless_called_off(&AtomicBool::new(false), || Err::<String, _>("down".into()));
        assert_eq!(failed.unwrap_err(), "down");
        let cancel = std::sync::Arc::new(AtomicBool::new(false));
        let flag = cancel.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(50));
            flag.store(true, Ordering::SeqCst);
        });
        let started = Instant::now();
        let slow = super::unless_called_off(&cancel, || {
            std::thread::sleep(Duration::from_secs(5));
            Ok("too late".to_string())
        });
        assert!(slow.is_err());
        assert!(started.elapsed() < Duration::from_secs(2), "{:?}", started.elapsed());
    }

    #[test]
    fn language_change_cancels_pending_replies_without_rewriting_history() {
        let mut talks = super::Talks::default();
        let single = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let group = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let prior = json!({"role": "assistant", "content": "An earlier reply"});
        talks.remember("one", prior.clone());
        talks.wait("one", &single);
        talks.wait("two", &group);
        talks.wait("three", &group);
        talks.cancel_pending();
        assert!(single.load(std::sync::atomic::Ordering::SeqCst));
        assert!(group.load(std::sync::atomic::Ordering::SeqCst));
        assert_eq!(talks.history("one"), vec![prior]);
        assert_eq!(talks.total("one"), 1);
        assert!(talks.busy("one"));
        // The cancelled request keeps its slot until its normal completion path runs.
        for id in ["one", "two", "three"] {
            talks.done(id);
            assert!(!talks.busy(id));
        }
        assert_eq!(talks.history("one").len(), 1);
    }

    #[test]
    fn the_log_keeps_the_session_while_the_ai_is_handed_the_latest_messages() {
        let mut talks = super::Talks::default();
        let entry = |n: usize| json!({"role": "user", "content": format!("message {n}")});
        for n in 0..30 {
            talks.remember("one", entry(n));
        }
        assert_eq!(talks.log("one").len(), 30, "the log on screen loses nothing");
        assert_eq!(talks.log("one")[0], entry(0));
        let recalled = talks.history("one");
        assert_eq!(recalled.len(), super::HISTORY_LIMIT);
        assert_eq!(recalled[0], entry(30 - super::HISTORY_LIMIT));
        assert_eq!(recalled.last(), Some(&entry(29)));
        for n in 30..super::LOG_LIMIT + 5 {
            talks.remember("one", entry(n));
        }
        assert_eq!(
            talks.log("one").len(),
            super::LOG_LIMIT,
            "a very long session drops its start"
        );
        assert_eq!(talks.log("one")[0], entry(5));
        assert_eq!(talks.total("one"), (super::LOG_LIMIT + 5) as u64);
        assert!(talks.log("two").is_empty());
        talks.forget("one");
        assert!(talks.log("one").is_empty() && talks.history("one").is_empty());
    }

    #[test]
    fn a_chat_answer_does_not_overwrite_an_agent_at_work() {
        assert!(agent_busy(Some(&json!({"state": "working", "source": "agent"}))));
        assert!(agent_busy(Some(&json!({"state": "waiting", "source": "agent"}))));
        assert!(!agent_busy(Some(&json!({"state": "done", "source": "agent"}))));
        assert!(!agent_busy(Some(&json!({"state": "working", "source": "chat"}))));
        assert!(!agent_busy(None));
    }

    #[test]
    fn chatter_picks_up_to_three_friends_with_an_ai_who_are_free() {
        let pets = [
            ("a", true),
            ("b", true),
            ("c", false),
            ("d", true),
            ("e", true),
            ("f", true),
        ];
        assert_eq!(chatty(pets.iter().copied(), |id| id == "b"), ["a", "d", "e"]);
        assert!(chatty([("x", false)].into_iter(), |_| false).is_empty());
        let line = opener("evening", "rain", false);
        assert!(!line.contains("partner"));
        assert!(opener("day", "clear", true).contains("partner"));
        assert!(line.contains("evening") && line.contains("rain"));
    }
}
