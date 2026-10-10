// AI connections: saving, removing and listing models. API keys live in the system keychain,
// never in the state file.
use super::kind::Kind;
use super::{cli, http};
use crate::app::{AppData, Shared, changed, lock, push_event};
use crate::i18n;
use serde_json::{Value, json};
use tauri::{AppHandle, State};

pub const LIMIT: usize = 12;

pub fn id_of(provider: &Value) -> &str {
    provider.get("id").and_then(|v| v.as_str()).unwrap_or("")
}

pub fn find<'a>(d: &'a AppData, id: &str) -> Option<&'a Value> {
    d.providers.iter().find(|p| id_of(p) == id)
}

fn keyring_entry(id: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new("PlayPets", &format!("provider-{id}")).map_err(|_| i18n::t("provider.no_keychain"))
}

pub fn read_key(id: &str) -> Option<String> {
    keyring_entry(id).ok().and_then(|e| e.get_password().ok())
}

fn forget_key(id: &str) {
    if let Ok(entry) = keyring_entry(id) {
        let _ = entry.delete_credential();
    }
}

pub fn display_name(raw: &Value, kind: Kind) -> String {
    let custom = raw.get("name").and_then(|v| v.as_str()).map(str::trim).unwrap_or("");
    if !custom.is_empty() {
        return custom.chars().take(40).collect();
    }
    kind.label()
        .map(str::to_string)
        .unwrap_or_else(|| i18n::t("provider.compatible"))
}

/// A connection as it is kept in the state file and shown to the page: everything but the key.
pub fn entry(id: &str, raw: &Value, config: &http::Config) -> Value {
    json!({"id": id, "name": display_name(raw, config.kind), "type": config.kind.id(), "model": config.model, "endpoint": config.endpoint})
}

pub fn save(app: &AppHandle, state: &State<Shared>, cli: &cli::CliManager, raw: &Value) -> Result<Value, String> {
    if !raw.is_object() {
        return Err(i18n::t("provider.details_missing"));
    }
    let config = http::validate_config(raw)?;
    let id = {
        let mut d = lock(state);
        // An id the app does not know is never taken from the page: a new connection gets a fresh one.
        let known = find(&d, id_of(raw))
            .map(|p| id_of(p).to_string())
            .filter(|id| !id.is_empty());
        let id = known.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        if d.provider_updates.contains(&id) || d.pets.iter().any(|p| p.provider_id == id && d.talks.busy(&p.id)) {
            return Err(i18n::t("provider.busy"));
        }
        if known.is_none() && d.providers.len() >= LIMIT {
            return Err(i18n::tr("provider.limit", &[("limit", &LIMIT.to_string())]));
        }
        d.provider_updates.insert(id.clone());
        id
    };
    // The keychain can be slow (it may ask the person), so it is used without holding the state
    // lock; `provider_updates` keeps chats and other saves off this connection meanwhile.
    let saved = store(app, state, cli, &id, raw, &config);
    lock(state).provider_updates.remove(&id);
    saved
}

fn store(
    app: &AppHandle,
    state: &State<Shared>,
    cli: &cli::CliManager,
    id: &str,
    raw: &Value,
    config: &http::Config,
) -> Result<Value, String> {
    let (old, mut has_key) = {
        let d = lock(state);
        (find(&d, id).cloned(), d.secret_ids.contains(id))
    };
    let was = |field: &str, now: &str| {
        old.as_ref()
            .is_some_and(|o| o.get(field).and_then(|v| v.as_str()) != Some(now))
    };
    // A key belongs to the server it was entered for: it never follows the connection to another one.
    let moved = was("endpoint", &config.endpoint) || was("type", config.kind.id());
    let clear_key = raw.get("clearKey").and_then(|v| v.as_bool()).unwrap_or(false);
    if (moved || clear_key) && has_key {
        forget_key(id);
        has_key = false;
    }
    if !config.api_key.is_empty() {
        keyring_entry(id)?
            .set_password(&config.api_key)
            .map_err(|_| i18n::t("provider.no_keychain"))?;
        has_key = true;
    }
    if config.kind.needs_key() && !has_key {
        return Err(i18n::t("provider.openai_key"));
    }
    let entry = entry(id, raw, config);
    let mut d = lock(state);
    if has_key {
        d.secret_ids.insert(id.to_string());
    } else {
        d.secret_ids.remove(id);
    }
    d.providers.retain(|p| id_of(p) != id);
    d.providers.push(entry.clone());
    // A conversation does not carry over to a different server or model.
    if moved || was("model", &config.model) {
        let ids: Vec<String> = d
            .pets
            .iter()
            .filter(|p| p.provider_id == id)
            .map(|p| p.id.clone())
            .collect();
        for pet_id in &ids {
            super::reset(&mut d, cli, pet_id);
        }
        push_event(app, &json!({"type": "history-reset", "petIds": ids}));
    }
    crate::app::save_and_show(app, &d)?;
    Ok(entry)
}

pub fn remove(app: &AppHandle, state: &State<Shared>, cli: &cli::CliManager, id: &str) -> Result<Value, String> {
    let mut d = lock(state);
    if d.provider_updates.contains(id) {
        return Err(i18n::t("provider.saving_remove"));
    }
    let pet_ids: Vec<String> = d
        .pets
        .iter()
        .filter(|p| p.provider_id == id)
        .map(|p| p.id.clone())
        .collect();
    for pet_id in &pet_ids {
        super::cancel(&d, cli, pet_id);
        super::reset(&mut d, cli, pet_id);
    }
    for p in d.pets.iter_mut() {
        if p.provider_id == id {
            p.provider_id.clear();
        }
    }
    d.providers.retain(|p| id_of(p) != id);
    let had_key = d.secret_ids.remove(id);
    let saved = crate::app::save_and_show(app, &d);
    drop(d);
    // The connection is gone either way, so is its key. The keychain may ask the person; nothing
    // else in the app should wait for that.
    if had_key {
        forget_key(id);
    }
    saved.map(|()| Value::Null)
}

/// Models the dialog can offer. The key typed into the form wins; otherwise the saved one is used.
pub fn list_models(state: &State<Shared>, raw: &Value) -> Result<Value, String> {
    let mut key = raw
        .get("apiKey")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if key.is_empty()
        && let Some(id) = raw.get("id").and_then(|v| v.as_str())
    {
        // The saved key goes only to the server it was saved for: the form may name another
        // endpoint or kind, and then it has to come with a key of its own.
        let saved = {
            let d = lock(state);
            d.secret_ids.contains(id).then(|| find(&d, id).cloned()).flatten()
        };
        if let Some(saved) = saved {
            let same = |field: &str| {
                let a = raw
                    .get(field)
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .trim()
                    .trim_end_matches('/');
                let b = saved
                    .get(field)
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .trim()
                    .trim_end_matches('/');
                a == b
            };
            if !same("endpoint") || !same("type") {
                return Err(i18n::t("ai.key_missing"));
            }
            key = read_key(id).unwrap_or_default();
        }
    }
    http::list_models(raw, &key).map(|list| json!(list))
}

/// Looks for AIs already on this computer, off the startup path: finding none takes the longest.
pub fn detect(app: tauri::AppHandle) {
    use tauri::Manager;
    std::thread::spawn(move || {
        let detected = json!({
            "claude": cli::resolve_bin("claude").is_some(),
            "codex": cli::resolve_bin("codex").is_some(),
            "ollama": http::detect_ollama(http::OLLAMA_DEFAULT),
        });
        let state = app.state::<Shared>();
        let mut d = lock(&state);
        d.detected = detected;
        changed(&app, &d);
    });
}
