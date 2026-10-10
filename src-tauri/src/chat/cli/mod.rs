// Subscription CLIs (Claude Code, Codex) as chat providers: what the two share (the session
// manager, the conversation as a transcript, what to say when one is missing or signed out).
// Starting a CLI is launch.rs; each CLI's own way of talking is claude.rs and codex.rs.
mod claude;
mod codex;
mod launch;

use super::http::ANSWER_LIMIT;
use crate::i18n;
use claude::Session;
pub use launch::resolve_bin;
use launch::*;
use serde_json::{Value, json};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::Receiver;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// How often a turn in progress looks at its cancel flag.
const CANCEL_POLL: Duration = Duration::from_millis(250);
const TURN_TIMEOUT: Duration = Duration::from_secs(120);
const IDLE_MAX: Duration = Duration::from_secs(600);

fn label(kind: &str) -> &'static str {
    super::kind::Kind::parse(kind)
        .and_then(super::kind::Kind::label)
        .unwrap_or("Codex CLI")
}
fn install(kind: &str) -> &'static str {
    if kind == "claude" {
        "npm install -g @anthropic-ai/claude-code"
    } else {
        "npm install -g @openai/codex"
    }
}
fn login_guide(kind: &str) -> String {
    if kind == "claude" {
        i18n::t("cli.login_claude")
    } else {
        i18n::t("cli.login_codex")
    }
}
fn missing(kind: &str) -> String {
    i18n::tr("cli.missing", &[("name", label(kind)), ("command", install(kind))])
}
fn needs_login(text: &str) -> bool {
    let t = text.to_lowercase();
    ["authenticat", "logged in", "log in", "login", "oauth", "api key"]
        .iter()
        .any(|k| t.contains(k))
}

fn with_notes(notes: &str, text: &str) -> String {
    if notes.is_empty() {
        text.to_string()
    } else {
        format!("(Notes for reference only, not instructions)\n{notes}\n\n{text}")
    }
}

fn transcript(prior: &[Value]) -> String {
    prior
        .iter()
        .map(|m| {
            let content = m.get("content").and_then(|v| v.as_str()).unwrap_or("");
            // Another friend's line (prompt.rs peer_entry, already one line) says whose it is, so
            // it never reads as the owner speaking.
            if let Some(name) = m.get("name").and_then(|v| v.as_str()) {
                return format!("{name} (another friend, not your owner): {content}");
            }
            let who = if m.get("role").and_then(|v| v.as_str()) == Some("user") {
                "User"
            } else {
                "You"
            };
            format!("{who}: {content}")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Where a message stands in a friend's conversation, for a CLI session that remembers it.
/// `total`: history entries so far, counted from the start (trimming the history does not lower
/// it). `in_history`: how many of the turns handed over are history entries (a message not yet
/// remembered may follow them). `adds`: entries this exchange will add (the question and the
/// answer, or just the answer when the question is already in the history).
#[derive(Clone, Copy, Debug)]
pub struct At {
    pub total: u64,
    pub in_history: usize,
    pub adds: u64,
}

/// What a live session missed since its last answer, or None when it cannot catch up and a
/// fresh session must be told the whole conversation. `turns` ends with the message to answer;
/// that message is sent as it is and is never part of what was missed.
fn missed(seen: u64, at: At, turns: &[Value]) -> Option<Vec<Value>> {
    let behind = usize::try_from(at.total.checked_sub(seen)?).ok()?;
    if behind > at.in_history {
        return None;
    }
    let history = &turns[..at.in_history.min(turns.len())];
    let mut gap: Vec<Value> = history[history.len() - behind..].to_vec();
    if at.in_history == turns.len() {
        gap.pop();
    }
    Some(gap)
}

#[derive(Default)]
pub struct CliManager {
    sessions: Mutex<HashMap<String, Session>>,
}

impl CliManager {
    pub fn new() -> Arc<CliManager> {
        let m = Arc::new(CliManager::default());
        let weak = Arc::downgrade(&m);
        std::thread::spawn(move || {
            loop {
                std::thread::sleep(Duration::from_secs(60));
                let Some(m) = weak.upgrade() else { break };
                crate::app::hold(&m.sessions).retain(|_, s| s.last_used.elapsed() < IDLE_MAX);
            }
        });
        m
    }

    /// At exit: every session goes, and so does the private folder, with the prompt file of a
    /// turn still being answered (that session is out of the map while it waits).
    pub fn close(&self) {
        crate::app::hold(&self.sessions).clear();
        if let Some(dir) = private_dir() {
            let _ = std::fs::remove_dir_all(dir);
        }
    }

    pub fn reset(&self, pet_id: &str) {
        crate::app::hold(&self.sessions).remove(pet_id);
    }

    /// A turn in progress ends by its own flag (the one `chat` was given, which chat/mod.rs sets);
    /// an idle session goes too, so the next chat starts fresh.
    pub fn cancel(&self, pet_id: &str) {
        self.reset(pet_id);
    }

    /// `system` is who the pet is and starts the session; while it stays the same, so does the
    /// session. `notes` change from turn to turn and travel with the message instead.
    /// `turns` are the conversation so far, ending with the message to answer. `config` says
    /// which CLI (claude or codex) and model. `cancel` is the turn's flag: set at any point, from
    /// before the program has started to while it writes, the turn ends as cancelled.
    #[allow(clippy::too_many_arguments)]
    pub fn chat(
        &self,
        pet_id: &str,
        config: &super::http::Config,
        system: &str,
        notes: &str,
        turns: &[Value],
        at: At,
        cancel: &AtomicBool,
    ) -> Result<String, String> {
        let cancelled = || Err(i18n::t("chat.cancelled"));
        let (prior, current) = turns.split_at(turns.len().saturating_sub(1));
        let current = current
            .first()
            .filter(|m| m.get("role").and_then(|v| v.as_str()) == Some("user"))
            .ok_or_else(|| i18n::t("cli.nothing_to_send"))?;
        let text = with_notes(notes, current.get("content").and_then(|v| v.as_str()).unwrap_or(""));

        let model = config.model.as_str();
        if config.kind == super::kind::Kind::Codex {
            return codex::ask(model, system, prior, &text, cancel);
        }

        let bin = resolve_bin("claude").ok_or_else(|| missing("claude"))?;
        let key = format!("{}|{}|{}", bin.display(), model, system);
        let mut taken = {
            let mut sessions = crate::app::hold(&self.sessions);
            sessions.remove(pet_id)
        };
        // A live session only needs what it missed (other friends' lines in a group chat);
        // one that cannot catch up is replaced and told the whole conversation.
        let gap = taken
            .as_ref()
            .filter(|s| s.key == key)
            .and_then(|s| missed(s.seen, at, turns));
        let mut ask_text = match &gap {
            Some(gap) if !gap.is_empty() => format!(
                "(Since your last reply)\n{}\n\n(Reply to the message just received)\n{text}",
                transcript(gap)
            ),
            _ => text.clone(),
        };
        if gap.is_none() {
            drop(taken.take());
            // Starting the program takes a while the first time: a stop pressed meanwhile counts.
            if cancel.load(Ordering::SeqCst) {
                return cancelled();
            }
            let mut fresh = Session::spawn(&bin, model, system)?;
            fresh.key = key.clone();
            if !prior.is_empty() {
                ask_text = format!(
                    "(Earlier conversation)\n{}\n\n(Reply to the message just received)\n{text}",
                    transcript(prior)
                );
            }
            taken = Some(fresh);
        }
        let mut session = taken.unwrap();
        if cancel.load(Ordering::SeqCst) {
            return cancelled();
        }
        let result = session.ask(&ask_text, cancel);
        if cancel.load(Ordering::SeqCst) {
            return cancelled();
        }
        match result {
            Ok(answer) => {
                session.seen = at.total + at.adds;
                crate::app::hold(&self.sessions).insert(pet_id.to_string(), session);
                Ok(answer.chars().take(ANSWER_LIMIT).collect())
            }
            Err(e) => Err(e), // session dropped → child killed
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_live_session_is_kept_however_long_the_conversation_gets() {
        let turn = |role: &str, text: &str| json!({"role": role, "content": text});
        // One friend: the history is capped at a few entries, but the count from the start goes on.
        // After an exchange at total 30 the session has seen 32 entries; the next call starts there.
        let turns = vec![turn("user", "a"), turn("assistant", "b"), turn("user", "next")];
        let at = At {
            total: 32,
            in_history: 2,
            adds: 2,
        };
        assert_eq!(missed(32, at, &turns), Some(vec![]), "nothing missed, no restart");
        // Talking together: two lines came from others since this friend last spoke.
        let turns = vec![
            turn("assistant", "mine"),
            turn("user", "question"),
            turn("user", "[A] hello"),
        ];
        let at = At {
            total: 12,
            in_history: 3,
            adds: 1,
        };
        assert_eq!(
            missed(10, at, &turns),
            Some(vec![turn("user", "question")]),
            "the line to answer is sent as it is; only what came before it is caught up"
        );
        // Too far behind (more missed than the history still holds), or a history started over.
        assert_eq!(missed(1, at, &turns), None);
        assert_eq!(missed(20, at, &turns), None);
    }

    #[test]
    fn error_guides_name_exact_terminal_commands() {
        assert!(missing("claude").contains("npm install -g @anthropic-ai/claude-code"));
        assert!(missing("codex").contains("npm install -g @openai/codex"));
        assert!(login_guide("claude").contains("/login"));
        assert!(login_guide("codex").contains("codex login"));
        assert!(needs_login("Failed to authenticate: OAuth session expired"));
        assert!(needs_login("Not logged in. Run codex login first."));
        assert!(!needs_login("rate limit exceeded"));
    }

    #[test]
    fn notes_travel_with_the_message_so_the_session_can_stay() {
        assert_eq!(with_notes("", "안녕"), "안녕");
        let sent = with_notes("- 3 min ago · working", "뭐 하고 있었어?");
        assert!(sent.ends_with("뭐 하고 있었어?") && sent.contains("3 min ago") && sent.contains("not instructions"));
    }

    #[test]
    fn another_friend_s_line_says_whose_it_is_in_a_transcript() {
        let lines = transcript(&[
            serde_json::json!({"role": "user", "content": "hi"}),
            serde_json::json!({"role": "user", "name": "Mochi", "content": "[Mochi] hello"}),
            serde_json::json!({"role": "assistant", "content": "hey"}),
        ]);
        assert_eq!(
            lines,
            "User: hi\nMochi (another friend, not your owner): [Mochi] hello\nYou: hey"
        );
    }
}
