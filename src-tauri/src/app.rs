// The app's state: what it knows, how it is loaded and saved, and how every window hears of a
// change. Commands (commands.rs), chat, the agent bridge and the tray all work through here.
use crate::agent;
use crate::chat::{self, http, providers};
use crate::desktop::overlay;
use crate::pets::{builtin, catalog, importer, model};
use crate::{i18n, store};
use serde_json::{Map, Value, json};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use tauri::{AppHandle, Manager};

/// The shape of state.json this app writes. Read from a newer app's file, the known fields are
/// used, the unknown ones are carried along unchanged, and a copy of the file is kept first.
pub const SCHEMA: u64 = 1;
/// The top-level keys this app writes to state.json; anything else in the file is `extra`.
const KNOWN_KEYS: [&str; 10] = [
    "schema",
    "pets",
    "desktop",
    "desktopWander",
    "language",
    "imports",
    "providers",
    "agentPets",
    "autoChatter",
    "secretIds",
];

/// Everything the app knows. Saved to state.json: pets, desktop, wander, language, imports,
/// providers (with the parked ones), agent_pets, auto_chatter, secret_ids and extra. The rest
/// lasts until the app quits.
pub struct AppData {
    pub store: store::Store,
    /// Codex's own pet folder, read at every start.
    pub codex_pets: PathBuf,
    pub builtin_pets: PathBuf,
    /// Pet files found on this computer; `pets` are the friends made from them.
    pub assets: Vec<catalog::Asset>,
    pub warnings: Vec<String>,
    pub pets: Vec<model::Pet>,
    pub desktop: bool,
    pub wander: bool,
    /// The language the app speaks to the person in; the pet is asked to answer in it too.
    pub language: i18n::Lang,
    /// Folders of pets brought in by hand, read again at every start.
    pub imports: Vec<String>,
    /// Which friend each coding agent reports to (agent kind → pet id). Unset means the first friend.
    pub agent_pets: HashMap<String, String>,
    /// The friends talk among themselves every so often (the page keeps the timer).
    pub auto_chatter: bool,
    pub providers: Vec<Value>,
    /// Connections this app could not read (a kind from a newer app, say): never shown, written back
    /// as they were so a later app finds them again.
    pub parked_providers: Vec<Value>,
    /// Top-level keys of state.json this app does not know, written back as they were.
    pub extra: Map<String, Value>,
    /// Providers whose API key is in the keychain.
    pub secret_ids: HashSet<String>,
    pub statuses: Map<String, Value>,
    pub histories: HashMap<String, Vec<Value>>,
    /// Entries each history has had since it started, trimming aside (chat CLI sessions go by it).
    pub history_totals: HashMap<String, u64>,
    /// Friends waiting for an answer, and the flag that calls each answer off.
    pub pending: HashSet<String>,
    pub cancels: HashMap<String, Arc<AtomicBool>>,
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

/// The state as the pages see it.
pub fn public_state(app: &AppHandle, d: &AppData) -> Value {
    let layout = app
        .try_state::<OverlayHandle>()
        .map(|o| o.0.layout())
        .unwrap_or_default();
    json!({
        "pets": d.pets,
        "desktop": d.desktop,
        "desktopWander": d.wander,
        "language": d.language.code(),
        "agentPets": d.agent_pets,
        "autoChatter": d.auto_chatter,
        "petLimit": model::LIMIT,
        "limits": {"persona": model::PERSONA_MAX},
        "defaults": {"ollamaEndpoint": http::OLLAMA_DEFAULT},
        "agents": agent::kinds::agents_json(),
        "version": app.package_info().version.to_string(),
        "assets": d.assets.iter().map(|a| { let mut v = serde_json::to_value(a).unwrap(); v["spriteUrl"] = json!(sprite_url(&a.id)); v }).collect::<Vec<_>>(),
        "providers": d.providers.iter().map(|p| { let mut p = p.clone(); p["hasKey"] = json!(d.secret_ids.contains(providers::id_of(&p))); p }).collect::<Vec<_>>(),
        "detected": d.detected,
        "warnings": d.warnings,
        "statuses": Value::Object(d.statuses.clone()),
        "busy": d.pending.iter().collect::<Vec<_>>(),
        "desktopLayout": layout,
        "communities": importer::communities_json(),
        "petFolders": {"builtin": d.builtin_pets, "codex": d.codex_pets, "downloaded": d.store.dir.join("pets")},
    })
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
        o.0.sync(pets_lite(d), d.desktop, d.wander);
    }
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
/// walking): written within 2 s, together, and at exit. Everything else saves at once.
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
        "pets": d.pets, "desktop": d.desktop, "desktopWander": d.wander,
        "language": d.language.code(),
        "imports": d.imports,
        "providers": d.providers.iter().chain(&d.parked_providers).collect::<Vec<_>>(),
        "agentPets": d.agent_pets,
        "autoChatter": d.auto_chatter,
        "secretIds": d.secret_ids.iter().collect::<Vec<_>>(),
    });
    for (key, value) in &d.extra {
        state[key] = value.clone();
    }
    d.store.write("state.json", &state)
}

/// What a state file holds beyond the keys this app knows.
fn extras(raw: &Value) -> Map<String, Value> {
    raw.as_object()
        .map(|o| {
            o.iter()
                .filter(|(k, _)| !KNOWN_KEYS.contains(&k.as_str()))
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect()
        })
        .unwrap_or_default()
}

/// The desktop switches (friends on the desktop; roaming), flipped from the page or the tray.
pub fn toggle_flag(app: &AppHandle, d: &mut AppData, wander: bool) -> Result<bool, String> {
    let flag = if wander { &mut d.wander } else { &mut d.desktop };
    *flag = !*flag;
    let now = *flag;
    persist(d)?;
    changed(app, d);
    Ok(now)
}

/// A friend's state (idle, working, …) and the line that goes with it, as every page shows it.
pub fn set_status(app: &AppHandle, d: &mut AppData, id: &str, state: &str, message: &str, source: &str) {
    if require_pet(d, id).is_err() {
        return;
    }
    // The source stays with the state: the yard marks agent work, not a chat answer.
    let at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|t| t.as_millis() as u64)
        .unwrap_or(0);
    d.statuses.insert(
        id.into(),
        json!({"state": state, "message": message, "source": source, "at": at}),
    );
    push_event(
        app,
        &json!({"type": "status", "petId": id, "state": state, "message": message, "source": source}),
    );
    changed(app, d);
}

/// Puts a pet file on the shelf (once) and remembers its folder for the next start.
pub fn register_asset(app: &AppHandle, d: &mut AppData, asset: catalog::Asset) -> Result<Value, String> {
    let asset = catalog::Asset {
        place: catalog::place_of(&d.store.dir.join("pets"), &asset.folder),
        ..asset
    };
    let id = asset.id.clone();
    if !d.assets.iter().any(|a| a.id == id) {
        d.imports.push(asset.folder.to_string_lossy().into_owned());
        d.assets.push(asset);
        persist(d)?;
        changed(app, d);
    }
    Ok(json!(id))
}

pub fn quit(app: &AppHandle) {
    app.state::<CliHandle>().0.close();
    app.exit(0);
}

/// Serves sprite sheets to the pages: pet-asset://sprite/{asset id}, which Windows spells
/// http://pet-asset.localhost/sprite/{asset id}.
pub fn sprite_response(app: &AppHandle, uri: &tauri::http::Uri) -> tauri::http::Response<Vec<u8>> {
    let path = uri.path().trim_start_matches('/');
    let id = if uri.host() == Some("sprite") {
        path
    } else {
        path.trim_start_matches("sprite/")
    };
    let found = lock(&app.state::<Shared>())
        .assets
        .iter()
        .find(|a| a.id == id)
        .map(|a| a.sprite_path.clone());
    // A sheet can be swapped on disk after it was read in; it is never read past the limit.
    let small_enough =
        |p: &std::path::Path| std::fs::metadata(p).is_ok_and(|m| m.len() <= catalog::SPRITE_LIMIT as u64);
    match found.and_then(|p| {
        small_enough(&p)
            .then(|| std::fs::read(&p).ok())
            .flatten()
            .map(|bytes| (bytes, p))
    }) {
        Some((bytes, p)) => {
            let mime = if p.extension().is_some_and(|e| e == "webp") {
                "image/webp"
            } else {
                "image/png"
            };
            // The page reads the sheet's pixels (to put bubbles just above the head), which a
            // cross-origin image allows only with this header.
            tauri::http::Response::builder()
                .header("Content-Type", mime)
                .header("Access-Control-Allow-Origin", "*")
                .body(bytes)
                .unwrap()
        }
        None => tauri::http::Response::builder().status(404).body(Vec::new()).unwrap(),
    }
}

/// Reads the saved state and the pets on this computer. Whatever cannot be used (a pet whose
/// file is gone, a connection that no longer validates) is left out rather than failing the start.
/// The pets on this computer: the samples that ship with the app (first, in their order), Codex's
/// own pet folder, and the folders brought in by address or picked by hand.
struct FoundPets {
    assets: Vec<catalog::Asset>,
    codex_root: PathBuf,
    builtin_root: PathBuf,
    warnings: Vec<String>,
}
fn load_assets(app: &tauri::App, store: &store::Store, imports: &[String]) -> FoundPets {
    let mut warnings = Vec::new();
    // Codex keeps its pets in ~/.codex/pets; they are offered without being imported.
    let codex_root = std::env::var("CODEX_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| app.path().home_dir().map(|h| h.join(".codex")).unwrap_or_default())
        .join("pets");
    // The sample pets come first so a fresh install has something to invite.
    let (builtin_root, unpack_warnings) = builtin::unpack(&store.dir.join("builtin"));
    warnings.extend(unpack_warnings);
    let (mut assets, builtin_warnings) = catalog::scan_pets(&builtin_root, catalog::Place::Builtin);
    assets.sort_by_key(|a| {
        builtin::ORDER
            .iter()
            .position(|id| a.folder.ends_with(id))
            .unwrap_or(usize::MAX)
    });
    warnings.extend(builtin_warnings);
    let (codex_assets, scan_warnings) = catalog::scan_pets(&codex_root, catalog::Place::Codex);
    assets.extend(codex_assets);
    warnings.extend(scan_warnings);
    for folder in imports {
        match catalog::read_pet(std::path::Path::new(folder)) {
            Ok(a) => {
                if !assets.iter().any(|x| x.id == a.id) {
                    assets.push(catalog::Asset {
                        place: catalog::place_of(&store.dir.join("pets"), &a.folder),
                        ..a
                    });
                }
            }
            Err(e) => warnings.push(e),
        }
    }
    FoundPets {
        assets,
        codex_root,
        builtin_root,
        warnings,
    }
}

/// The saved AI connections this app can use, and the ones it cannot (a kind it does not know),
/// which are kept as they were.
fn load_providers(raw: &Value) -> (Vec<Value>, Vec<Value>) {
    let mut providers: Vec<Value> = Vec::new();
    let mut parked: Vec<Value> = Vec::new();
    for p in raw
        .get("providers")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .take(providers::LIMIT)
    {
        let Some(id) = p.get("id").and_then(|v| v.as_str()) else {
            continue;
        };
        if providers.iter().chain(&parked).any(|q| providers::id_of(q) == id) {
            continue;
        }
        match http::validate_config(&p) {
            Ok(config) => providers.push(providers::entry(id, &p, &config)),
            Err(_) => parked.push(p),
        }
    }
    (providers, parked)
}

pub fn load_state(app: &tauri::App) -> tauri::Result<AppData> {
    let data_dir = match std::env::var("PLAYPETS_DATA") {
        Ok(dir) if !dir.is_empty() => PathBuf::from(dir),
        _ => app.path().app_data_dir()?,
    };
    let store = store::Store { dir: data_dir };
    let mut warnings = Vec::new();
    let raw = store.read("state.json", json!({})).unwrap_or_else(|e| {
        warnings.push(e);
        json!({})
    });
    // A file from a newer app: its known fields are read, the rest travels along (`extra`,
    // parked providers), and a copy is kept before this app writes its own shape over it.
    let schema = raw.get("schema").and_then(|v| v.as_u64()).unwrap_or(0);
    if schema > SCHEMA {
        store.keep_copy("state.json", &format!("newer-{schema}"));
        warnings.push(i18n::tr("store.newer", &[("name", "state.json")]));
    }
    let language = i18n::pick_language(
        raw.get("language").and_then(|v| v.as_str()),
        i18n::forced().as_deref(),
        sys_locale::get_locale().as_deref(),
    );
    i18n::set(language);
    let strings = |key: &str| -> Vec<String> {
        raw.get(key)
            .and_then(|v| v.as_array())
            .map(|a| a.iter().filter_map(|v| v.as_str().map(str::to_string)).collect())
            .unwrap_or_default()
    };

    let imports: Vec<String> = strings("imports").into_iter().take(200).collect();
    let agent_pets: HashMap<String, String> = raw
        .get("agentPets")
        .and_then(|v| v.as_object())
        .map(|o| {
            o.iter()
                .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                .collect()
        })
        .unwrap_or_default();
    let found = load_assets(app, &store, &imports);
    let (assets, root, builtin_root) = (found.assets, found.codex_root, found.builtin_root);
    warnings.extend(found.warnings);

    let asset_ids: Vec<String> = assets.iter().map(|a| a.id.clone()).collect();
    let (mut pets, desktop, wander) = model::restore_state(&raw, &asset_ids);
    let (providers, parked) = load_providers(&raw);
    for p in pets.iter_mut() {
        if !providers.iter().any(|c| providers::id_of(c) == p.provider_id) {
            p.provider_id.clear();
        }
    }

    Ok(AppData {
        store,
        codex_pets: root,
        builtin_pets: builtin_root,
        assets,
        warnings,
        pets,
        desktop,
        wander,
        language,
        imports,
        agent_pets,
        auto_chatter: raw.get("autoChatter").and_then(|v| v.as_bool()).unwrap_or(false),
        providers,
        parked_providers: parked,
        extra: extras(&raw),
        secret_ids: strings("secretIds").into_iter().collect(),
        statuses: Map::new(),
        histories: HashMap::new(),
        history_totals: HashMap::new(),
        pending: HashSet::new(),
        cancels: HashMap::new(),
        provider_updates: HashSet::new(),
        detected: json!({"claude": false, "codex": false, "ollama": []}),
        activity: HashMap::new(),
    })
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
        assert!(KNOWN_KEYS.contains(&"secretIds"));
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
