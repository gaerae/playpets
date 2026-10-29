//! Coding agents and the app: the same binary run as a command (cli: hooks, MCP, status
//! commands; run: a command the friend works on) reaches the running app through a local HTTP bridge (bridge). What agents report
//! is shown on the friend and remembered so the pet can talk about it.
pub mod bridge;
pub mod cli;
pub mod kinds;
mod run;
pub mod snippets;

use crate::app::{AppData, Shared, lock, pet_name, push_event, require_pet, set_status};
use crate::chat::prompt;
use crate::i18n;
use serde_json::{Value, json};
use std::sync::Arc;
use tauri::{AppHandle, Manager};

/// An event from the bridge: a status or a line to say is shown and remembered; a reaction is
/// only shown.
fn on_event(app: &AppHandle, d: &mut AppData, event: bridge::AgentEvent) {
    use bridge::AgentEvent::*;
    let (pet_id, kind, state, message, by) = match &event {
        Status {
            pet_id,
            state,
            message,
            by,
        } => (pet_id.clone(), "status", state.clone(), message.clone(), by.clone()),
        Say { pet_id, message } => (pet_id.clone(), "say", String::new(), message.clone(), String::new()),
        React { pet_id, action } => {
            if require_pet(d, pet_id).is_ok() {
                push_event(app, &json!({"type": "play", "action": action, "petId": pet_id}));
            }
            return;
        }
    };
    if require_pet(d, &pet_id).is_err() {
        return;
    }
    // Hooks report in codes (`@tool Bash`); they are worded here, once, in the app's language,
    // before the activity notes and the status both take the words.
    let message = i18n::agent_message(&message);
    prompt::record_activity(
        d.activity.entry(pet_id.clone()).or_default(),
        prompt::Activity {
            at: crate::app::now_ms(),
            kind: kind.into(),
            state: state.clone(),
            message: message.clone(),
        },
    );
    if kind == "say" {
        push_event(app, &json!({"type": "say", "petId": pet_id, "message": message}));
    } else {
        set_status(app, d, &pet_id, &state, &message, "agent");
        if let Some(status) = d.statuses.get_mut(&pet_id) {
            status["by"] = json!(by);
        }
    }
}

/// Starts the bridge. Its port and token change with every start and are left in bridge.json
/// for hooks, MCP and the CLI to read.
pub fn start(app: &tauri::App) {
    let token = format!("{}{}", uuid::Uuid::new_v4().simple(), uuid::Uuid::new_v4().simple());
    let handle = app.handle().clone();
    let list: Arc<dyn Fn() -> Value + Send + Sync> = Arc::new(move || {
        let state = handle.state::<Shared>();
        let d = lock(&state);
        json!(
            d.pets
                .iter()
                .map(|p| {
                    let status = d.statuses.get(&p.id);
                    let state = status
                        .and_then(|s| s.get("state"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("idle");
                    // "chat" when the state is a chat answer on its way rather than an agent's turn.
                    let source = status
                        .and_then(|s| s.get("source"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    // Who reported it, for an idle notice to tell its own turn (agent/cli.rs).
                    let by = status.and_then(|s| s.get("by")).and_then(|v| v.as_str()).unwrap_or("");
                    json!({"id": p.id, "name": pet_name(&d, p, ""), "state": state, "source": source, "by": by})
                })
                .chain(d.parked_pets.iter().map(|p| json!({"id": p["id"], "parked": true})))
                .collect::<Vec<_>>()
        )
    });
    let handle = app.handle().clone();
    let event: Arc<dyn Fn(bridge::AgentEvent) + Send + Sync> = Arc::new(move |event| {
        let state = handle.state::<Shared>();
        let mut d = lock(&state);
        on_event(&handle, &mut d, event);
    });
    let started = bridge::start(token.clone(), list, event);
    let state = app.state::<Shared>();
    let mut d = lock(&state);
    match started {
        Ok(b) => {
            let _ = d
                .store
                .write_private("bridge.json", &json!({"port": b.port, "token": token}));
        }
        Err(e) => d.warnings.push(i18n::detail("bridge.failed", e)),
    }
}
