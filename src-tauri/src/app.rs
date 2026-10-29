// The app's state: what it knows, how it is loaded and saved, and how every window hears of a
// change. Commands (commands.rs), chat, the agent bridge and the tray all work through here.
use crate::agent;
use crate::chat::{self, http, providers};
use crate::desktop::overlay;
use crate::pets::{album, bond, builtin, catalog, garden, importer, model};
use crate::window;
use crate::{i18n, store};
use serde_json::{Map, Value, json};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use tauri::{AppHandle, Manager};

// Loading the state at start (load.rs), the person's switches (prefs.rs) and serving sprite
// sheets to the pages (sprite.rs).
pub mod backgrounds;
mod load;
mod prefs;
mod sprite;
pub use load::load_state;
pub use prefs::{Prefs, Sound, scene_choice};
pub use sprite::sprite_response;

/// The shape of state.json this app writes. Read from a newer app's file, the known fields are
/// used, the unknown ones are carried along unchanged, and a copy of the file is kept first.
pub const SCHEMA: u64 = 1;
/// The top-level keys this app writes to state.json besides the switches (Prefs::KEYS); anything
/// else in the file is `extra`.
const KNOWN_KEYS: [&str; 10] = [
    "schema",
    "pets",
    "imports",
    "picked",
    "providers",
    "agentPets",
    "secretIds",
    "garden",
    "album",
    "bonds",
];
fn known(key: &str) -> bool {
    KNOWN_KEYS.contains(&key) || Prefs::KEYS.contains(&key)
}

/// Everything the app knows. Saved to state.json: pets (with the parked ones), prefs, imports,
/// providers (with the parked ones), agent_pets, secret_ids, garden, album, bonds and extra. The
/// rest lasts until the app quits.
pub struct AppData {
    pub store: store::Store,
    /// Codex's own pet folder, read at every start.
    pub codex_pets: PathBuf,
    pub builtin_pets: PathBuf,
    /// Pet files found on this computer; `pets` are the friends made from them.
    pub assets: Vec<catalog::Asset>,
    pub warnings: Vec<String>,
    pub pets: Vec<model::Pet>,
    /// Saved friends whose pet file was not found at this start (model::parked_pets): not shown,
    /// written back as they were, with their bonds, so they come back once the file does.
    pub parked_pets: Vec<Value>,
    /// The person's switches (desktop, roaming, language, chatter, sound, the window's place).
    pub prefs: Prefs,
    /// Folders of pets brought in by hand, read again at every start.
    pub imports: Vec<String>,
    /// Those of them picked by hand from inside the data folder's `pets`, where imported pets
    /// live: the person's own, never deleted with the pet (catalog::place_of).
    pub picked: Vec<String>,
    /// Which friend each coding agent reports to (agent kind → pet id). Unset means the first friend.
    pub agent_pets: HashMap<String, String>,
    /// Whether the app starts at login, as the system last said (not saved: the system keeps it).
    pub autostart: bool,
    /// Seeds friends found, the plants grown from them, and the gifts friends brought.
    pub garden: garden::Garden,
    pub album: album::Album,
    pub bonds: bond::Bonds,
    pub providers: Vec<Value>,
    /// Connections this app could not read (a kind from a newer app, say): never shown, written back
    /// as they were so a later app finds them again.
    pub parked_providers: Vec<Value>,
    /// Top-level keys of state.json this app does not know, written back as they were.
    pub extra: Map<String, Value>,
    /// Providers whose API key is in the keychain.
    pub secret_ids: HashSet<String>,
    pub statuses: Map<String, Value>,
    /// Each friend's conversation, and the answers on their way (chat/mod.rs).
    pub talks: chat::Talks,
    /// Providers being saved right now.
    pub provider_updates: HashSet<String>,
    pub detected: Value,
    pub activity: HashMap<String, Vec<chat::prompt::Activity>>,
}

pub type Shared = Mutex<AppData>;
pub struct CliHandle(pub Arc<chat::cli::CliManager>);
pub struct OverlayHandle(pub Arc<overlay::Overlay>);
pub struct PositionSink(pub overlay::PositionFn);

pub fn require_pet(d: &AppData, id: &str) -> Result<(), String> {
    if d.pets.iter().any(|p| p.id == id) {
        Ok(())
    } else {
        Err(i18n::t("error.friend_missing"))
    }
}

/// The name a friend goes by: its own, or else its pet file's.
pub fn pet_name(d: &AppData, pet: &model::Pet, fallback: &str) -> String {
    if !pet.name.is_empty() {
        return pet.name.clone();
    }
    d.assets
        .iter()
        .find(|a| a.id == pet.asset_id)
        .map(|a| a.display_name.clone())
        .unwrap_or_else(|| fallback.into())
}

fn sprite_url(id: &str) -> String {
    if cfg!(windows) {
        format!("http://pet-asset.localhost/sprite/{id}")
    } else {
        format!("pet-asset://sprite/{id}")
    }
}

pub fn pets_lite(d: &AppData) -> Vec<overlay::PetLite> {
    d.pets
        .iter()
        .map(|p| overlay::PetLite {
            id: p.id.clone(),
            size: p.size,
            saved: p.desktop_position.map(|q| (q.x as f64, q.y as f64)),
        })
        .collect()
}

/// The state lock. A panic while it was held poisons the mutex; the data is still whole (every
/// change is made in place and persisted on its own), so later callers take it as it is rather
/// than failing every request until a restart.
pub fn lock(state: &Mutex<AppData>) -> MutexGuard<'_, AppData> {
    state.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

/// Any other lock of the app's (the overlay, CLI sessions, the tray, an update): taken as it is
/// after a panic elsewhere, as `lock` takes the state, rather than panicking every caller after.
pub fn hold<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

/// A change to the state, saved and shown everywhere: `change` makes it and says what to answer.
/// A change that could not be saved (a full disk, say) still stands and is shown, so every page
/// agrees with what the app holds; it is written with the next save, and the error says so.
pub fn commit(
    app: &AppHandle,
    state: &Mutex<AppData>,
    change: impl FnOnce(&mut AppData) -> Result<Value, String>,
) -> Result<Value, String> {
    let mut d = lock(state);
    let answer = change(&mut d)?;
    save_and_show(app, &d).map(|()| answer)
}

/// Saves a change made in place and shows it on every page, in that order. As in `commit`, a change
/// that could not be saved still stands and is shown; the error is returned after.
pub fn save_and_show(app: &AppHandle, d: &AppData) -> Result<(), String> {
    let saved = persist(d);
    changed(app, d);
    saved
}

/// Milliseconds since 1970 by the system clock (0 if the clock is set before then).
pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|t| t.as_millis() as u64)
        .unwrap_or(0)
}

/// Which friend each coding agent reports to, among the friends here: one parked (its pet file not
/// found this time) stays saved but shows as unset, the first friend, which is where the bridge
/// sends its events until it is back (agent/bridge.rs resolve_pet).
pub fn live_agent_pets(d: &AppData) -> HashMap<String, String> {
    d.agent_pets
        .iter()
        .filter(|(_, pet)| d.pets.iter().any(|p| &p.id == *pet))
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect()
}

/// The state as the pages see it.
pub fn public_state(app: &AppHandle, d: &AppData) -> Value {
    let layout = app
        .try_state::<OverlayHandle>()
        .map(|o| o.0.layout())
        .unwrap_or_default();
    let mut state = json!({
        "pets": d.pets,
        "agentPets": live_agent_pets(d),
        "autostart": d.autostart,
        "limits": crate::pets::limits(),
        "garden": d.garden,
        "album": d.album,
        "bonds": d.bonds,
        "defaults": {"ollamaEndpoint": http::OLLAMA_DEFAULT},
        "agents": agent::kinds::agents_json(),
        "version": app.package_info().version.to_string(),
        "updateChannel": if crate::update::store_managed() { "store" } else { "github" },
        "ownsWebviewStorage": load::owns_webview_storage(std::env::var("PLAYPETS_DATA").ok().as_deref(), crate::commands::e2e_mode()),
        "project": {"site": env!("CARGO_PKG_HOMEPAGE"), "repository": env!("CARGO_PKG_REPOSITORY")},
        "assets": d.assets.iter().map(sprite::asset_json).collect::<Vec<_>>(),
        "providers": d.providers.iter().map(|p| { let mut p = p.clone(); p["hasKey"] = json!(d.secret_ids.contains(providers::id_of(&p))); p }).collect::<Vec<_>>(),
        "detected": d.detected,
        "warnings": d.warnings,
        "statuses": Value::Object(d.statuses.clone()),
        "busy": d.talks.busy_ids().collect::<Vec<_>>(),
        "desktopLayout": layout,
        "communities": importer::communities_json(),
        "petFolders": {"builtin": d.builtin_pets, "codex": d.codex_pets, "downloaded": d.store.dir.join("pets")},
    });
    // The window's place is the backend's alone (window.rs); the pages have no use for it.
    let mut prefs = d.prefs.json();
    prefs.remove("windowRect");
    carry(&mut state, &prefs);
    state
}

/// Runs a script in the main window and in every overlay.
fn eval_all(app: &AppHandle, script: &str) {
    for (label, win) in app.webview_windows() {
        if label == "main" || label.starts_with("overlay") {
            let _ = win.eval(script);
        }
    }
}

/// Tells every page to remember `code` and start over in it (the pages read the language as
/// they load, so a change means a reload).
pub fn relanguage(app: &AppHandle, code: &str) {
    eval_all(
        app,
        &format!("try{{localStorage.setItem('lang','{code}')}}catch{{}}location.reload()"),
    );
}

pub fn push_event(app: &AppHandle, payload: &Value) {
    eval_all(app, &format!("window.__pp&&__pp('event',{payload})"));
}

/// Call after any change to the state: the overlay and every page are brought up to date.
pub fn changed(app: &AppHandle, d: &AppData) {
    if let Some(o) = app.try_state::<OverlayHandle>() {
        o.0.sync(pets_lite(d), d.prefs.desktop, d.prefs.wander);
    }
    crate::tray::refresh(app, crate::tray::snapshot(d));
    eval_all(app, &format!("window.__pp&&__pp('change',{})", public_state(app, d)));
}

/// A save that was put off: asked for many times, written once.
struct SaveLater(AtomicBool);
impl SaveLater {
    /// Marks a save as wanted; true only for the first ask since the last write, whose caller
    /// arranges the write.
    fn ask(&self) -> bool {
        !self.0.swap(true, Ordering::SeqCst)
    }
    /// Whether a save is wanted, clearing it: true once per round of asks.
    fn take(&self) -> bool {
        self.0.swap(false, Ordering::SeqCst)
    }
}
static SAVE_LATER: SaveLater = SaveLater(AtomicBool::new(false));

/// For changes that come often and matter little until the app quits (where a friend stopped
/// walking, where the window was left): written within 2 s, together, and at exit. Everything else saves at once.
pub fn persist_soon(app: &AppHandle) {
    if !SAVE_LATER.ask() {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(2));
        flush(&app);
    });
}

/// Writes a save `persist_soon` put off, if there is one.
pub fn flush(app: &AppHandle) {
    if SAVE_LATER.take()
        && let Some(state) = app.try_state::<Shared>()
    {
        let _ = persist(&lock(&state));
    }
}

pub fn persist(d: &AppData) -> Result<(), String> {
    let mut state = json!({
        "schema": SCHEMA,
        "pets": d.pets.iter().map(|p| json!(p)).chain(d.parked_pets.iter().cloned()).collect::<Vec<_>>(),
        "imports": d.imports,
        "picked": d.picked,
        "providers": d.providers.iter().chain(&d.parked_providers).collect::<Vec<_>>(),
        "agentPets": d.agent_pets,
        "secretIds": d.secret_ids.iter().collect::<Vec<_>>(),
        "garden": d.garden,
        "album": d.album,
        "bonds": d.bonds,
    });
    carry(&mut state, &d.prefs.json());
    carry(&mut state, &d.extra);
    d.store.write("state.json", &state)
}

/// Adds keys to a state object, never over one already there: the switches, then the keys a newer
/// app wrote, so a key left out of KNOWN_KEYS by mistake still saves its new value, not the old one
/// from the file.
fn carry(state: &mut Value, extra: &Map<String, Value>) {
    if let Some(object) = state.as_object_mut() {
        for (key, value) in extra {
            object.entry(key.clone()).or_insert_with(|| value.clone());
        }
    }
}

/// What a state file holds beyond the keys this app knows.
fn extras(raw: &Value) -> Map<String, Value> {
    raw.as_object()
        .map(|o| {
            o.iter()
                .filter(|(k, _)| !known(k))
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect()
        })
        .unwrap_or_default()
}

/// The desktop switches (friends on the desktop; roaming), flipped from the page or the tray.
pub fn toggle_flag(app: &AppHandle, d: &mut AppData, wander: bool) -> Result<bool, String> {
    let flag = if wander {
        &mut d.prefs.wander
    } else {
        &mut d.prefs.desktop
    };
    *flag = !*flag;
    let now = *flag;
    save_and_show(app, d).map(|()| now)
}

/// A friend's state (idle, working, …) and the line that goes with it, as every page shows it.
pub fn set_status(app: &AppHandle, d: &mut AppData, id: &str, state: &str, message: &str, source: &str) {
    if require_pet(d, id).is_err() {
        return;
    }
    // The source stays with the state: the yard marks agent work, not a chat answer.
    let at = now_ms();
    d.statuses.insert(
        id.into(),
        json!({"state": state, "message": message, "source": source, "at": at}),
    );
    push_event(
        app,
        &json!({"type": "status", "petId": id, "state": state, "message": message, "source": source}),
    );
    changed(app, d);
    if state == "error" && source != "chat" {
        crate::tray::fade_later(app);
    }
}

/// Puts a pet file on the shelf (once) and remembers its folder for the next start.
pub fn register_asset(app: &AppHandle, d: &mut AppData, asset: catalog::Asset) -> Result<Value, String> {
    let asset = catalog::Asset {
        place: catalog::place_of(&d.store.dir.join("pets"), &asset.folder, &d.picked),
        ..asset
    };
    let id = asset.id.clone();
    if !d.assets.iter().any(|a| a.id == id) {
        d.imports.push(asset.folder.to_string_lossy().into_owned());
        d.assets.push(asset);
        save_and_show(app, d)?;
    }
    Ok(json!(id))
}

pub fn quit(app: &AppHandle) {
    app.state::<CliHandle>().0.close();
    app.exit(0);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_top_level_keys_are_carried_and_known_ones_are_not() {
        let raw = json!({"schema": 7, "pets": [], "mood": "sunny", "futureList": [1, 2]});
        let extra = extras(&raw);
        assert_eq!(
            extra.keys().collect::<Vec<_>>(),
            ["mood", "futureList"],
            "in the file's own order"
        );
        assert!(extras(&json!("not an object")).is_empty());
        assert!(known("secretIds") && known("miniRect"));
    }

    #[test]
    fn carried_keys_never_replace_the_ones_this_app_writes() {
        let mut state = json!({"sound": {"on": false, "volume": 10}});
        let extra = extras(&json!({"sound": {"on": true, "volume": 99}, "mood": "sunny"}));
        // "sound" is known, so it is not an extra at all; were it forgotten, it would still not win.
        let mut forgotten = extra.clone();
        forgotten.insert("sound".into(), json!({"on": true, "volume": 99}));
        carry(&mut state, &forgotten);
        assert_eq!(state["sound"], json!({"on": false, "volume": 10}));
        assert_eq!(state["mood"], "sunny");
        assert!(!extra.contains_key("sound"));
    }

    #[test]
    fn many_asks_make_one_write_and_exit_writes_what_is_left() {
        let later = SaveLater(AtomicBool::new(false));
        assert!(later.ask(), "the first ask arranges the write");
        assert!(!later.ask() && !later.ask(), "asks before the write join it");
        assert!(later.take(), "the write happens once");
        assert!(!later.take(), "exit finds nothing left to write");
        assert!(later.ask(), "a later ask arranges a new write");
        assert!(later.take(), "and exit writes it if the timer has not");
    }
}
