// The app's state: what it knows, how it is loaded and saved, and how every window hears of a
// change. Commands (commands.rs), chat, the agent bridge and the tray all work through here.
use crate::agent;
use crate::chat::{self, http, providers};
use crate::desktop::overlay;
use crate::pets::{album, bond, builtin, catalog, garden, importer, letters, model};
use crate::window;
use crate::{i18n, store};
use serde_json::{Map, Value, json};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant};
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
const KNOWN_KEYS: [&str; 12] = [
    "schema",
    // Written for an older app, which sends every friend out when it is true (desktop::items).
    "desktop",
    "pets",
    "imports",
    "picked",
    "providers",
    "agentPets",
    "secretIds",
    "garden",
    "album",
    "bonds",
    "letters",
];
fn known(key: &str) -> bool {
    KNOWN_KEYS.contains(&key) || Prefs::KEYS.contains(&key)
}

/// Everything the app knows. Saved to state.json: pets (with the parked ones), prefs, imports,
/// providers (with the parked ones), agent_pets, secret_ids, garden, album, bonds, letters and extra. The
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
    /// The year-end letters a friend wrote and the person's answers, one a year.
    pub letters: letters::Letters,
    pub providers: Vec<Value>,
    /// Connections this app could not read (a kind from a newer app, say): never shown, written back
    /// as they were so a later app finds them again.
    pub parked_providers: Vec<Value>,
    /// Top-level keys of state.json this app does not know, written back as they were.
    pub extra: Map<String, Value>,
    /// Providers whose API key is in the keychain.
    pub secret_ids: HashSet<String>,
    /// Each friend's last state from a coding agent or a chat, not saved.
    pub statuses: HashMap<String, Status>,
    /// Each friend's conversation, and the answers on their way (chat/mod.rs).
    pub talks: chat::Talks,
    /// The flags that call off the pet imports under way, not saved.
    pub importing: Vec<std::sync::Arc<std::sync::atomic::AtomicBool>>,
    /// Providers being saved right now.
    pub provider_updates: HashSet<String>,
    /// Years whose letter a friend's AI is writing right now (chat/letter.rs), not saved: a page
    /// reloaded meanwhile is told to wait rather than asking the AI again.
    pub letters_writing: HashSet<u32>,
    /// Whether a letter's key could not be read in this run, not saved: the next time the page's
    /// letter is kept rather than asking the keychain every minute.
    pub letters_key_missed: bool,
    pub detected: Value,
    pub activity: HashMap<String, Vec<chat::prompt::Activity>>,
    /// The gift kinds the yard hides right now, as it last reported (hideDecor); the desktop leaves
    /// them out too. Not saved; `None` until the yard reports.
    pub hidden_decor: Option<Vec<String>>,
    /// The gift kinds the yard shows in their night look right now (decorNight: the Christmas tree
    /// standing grand); the desktop shows them so too. Not saved.
    pub night_decor: Vec<String>,
    /// What the pages hear about folders on disk, looked at once rather than on every change.
    pub folders: Folders,
}

/// What `public_state` says about folders on disk: looked at when the app starts and again only by
/// what changes them, since every change sends the whole state (a stat each, more inside an MSIX
/// package, where the file manager's path is looked up too).
pub struct Folders {
    /// Whether the data folder has kept a background before; another data folder copies the
    /// installed app's old ones only until it has (background-store.js). Set once one is saved.
    pub backgrounds: bool,
    /// The pet folders as the file manager finds them; looked at again when a pet file comes in.
    pub pets: Value,
}

impl Folders {
    pub fn look(data: &std::path::Path, builtin: &std::path::Path, codex: &std::path::Path) -> Folders {
        Folders {
            backgrounds: data.join(backgrounds::FOLDER).is_dir(),
            pets: pet_folders(data, builtin, codex),
        }
    }
    /// A background was saved, so its folder is there.
    pub fn kept_background(&mut self) {
        self.backgrounds = true;
    }
}

/// The paths shown are the ones Explorer finds, as Open folder opens them (system.rs).
fn pet_folders(data: &std::path::Path, builtin: &std::path::Path, codex: &std::path::Path) -> Value {
    json!({"builtin": crate::system::outside_view(builtin), "codex": codex, "downloaded": crate::system::outside_view(&data.join("pets"))})
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

/// What the desktop overlay draws: the friends and decorations out there.
pub fn desktop_items(d: &AppData) -> Vec<overlay::Item> {
    crate::desktop::items::items(&d.pets, &d.garden, d.hidden_decor.as_deref())
}

/// Whether anything is out on the desktop: what the menus' switch shows.
pub fn desktop_on(d: &AppData) -> bool {
    crate::desktop::items::anything_out(&d.pets, &d.garden, d.hidden_decor.as_deref())
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
/// agrees with what the app holds; it is written with the next save, and the error says so, so
/// nobody takes it for a refusal and does it twice.
pub fn commit(
    app: &AppHandle,
    state: &Mutex<AppData>,
    change: impl FnOnce(&mut AppData) -> Result<Value, String>,
) -> Result<Value, String> {
    let mut d = lock(state);
    let answer = change(&mut d)?;
    show_and_save(app, d).map(|()| answer)
}

/// `commit` for a small change that comes often (a scene picked, a decoration moved): shown at
/// once, written with the next few (`show_and_save_soon`).
pub fn commit_soon(
    app: &AppHandle,
    state: &Mutex<AppData>,
    change: impl FnOnce(&mut AppData) -> Result<Value, String>,
) -> Result<Value, String> {
    let mut d = lock(state);
    let answer = change(&mut d)?;
    show_and_save_soon(app, d);
    Ok(answer)
}

/// For small changes that come often (a pat, time together, a scene picked, something moved): every
/// page is shown the change at once, and the disk gets one write within `SOON` for a burst of them,
/// and one at exit (`flush`). A write that fails is tried again at exit; nobody waits for it.
pub fn show_and_save_soon(app: &AppHandle, d: MutexGuard<'_, AppData>) {
    changed(app, &d);
    drop(d);
    save_within(app, SOON);
}

/// Shows a change made in place on every page and saves it: the save is taken and shown under the
/// lock, which is let go before the disk write, so moving the window or a friend never waits for
/// the disk. As in `commit`, a change that could not be saved still stands and is shown; the error
/// is returned after. A save taken earlier but written later is dropped (`Saving::write`).
pub fn show_and_save(app: &AppHandle, d: MutexGuard<'_, AppData>) -> Result<(), String> {
    show_and_save_with(app, d, |_| {})
}

/// `show_and_save`, with one more step (`also`) taken under the lock right after the change is shown.
fn show_and_save_with(app: &AppHandle, d: MutexGuard<'_, AppData>, also: impl FnOnce(&AppData)) -> Result<(), String> {
    unlocked(
        d,
        Unsaved::of,
        |d| {
            changed(app, d);
            also(d);
        },
        Unsaved::write,
    )
}

/// For a caller with more to do under the lock (a chat turn): the change is shown now and its save
/// taken, to be written (`Unsaved::write`) once the lock is let go.
pub fn show_for_save(app: &AppHandle, d: &AppData) -> Unsaved {
    let unsaved = Unsaved::of(d);
    changed(app, d);
    unsaved
}

/// A save taken under the state's lock and not yet written: written after the lock is let go.
#[must_use = "a save taken is written once the lock is let go"]
pub struct Unsaved {
    saving: Saving,
    store: store::Store,
}
impl Unsaved {
    fn of(d: &AppData) -> Unsaved {
        Unsaved {
            saving: Saving::of(d),
            store: store::Store {
                dir: d.store.dir.clone(),
            },
        }
    }
    pub fn write(self) -> Result<(), String> {
        self.saving
            .write(&self.store, &WRITTEN)
            .map_err(|_| i18n::t("store.held"))
    }
}

/// Takes what to write and shows the change while holding the lock, then writes without it.
fn unlocked<T, S>(
    guard: MutexGuard<'_, T>,
    take: impl FnOnce(&T) -> S,
    show: impl FnOnce(&T),
    write: impl FnOnce(S) -> Result<(), String>,
) -> Result<(), String> {
    let taken = take(&guard);
    show(&guard);
    drop(guard);
    write(taken)
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
        "letters": d.letters,
        "defaults": {"ollamaEndpoint": http::OLLAMA_DEFAULT},
        "agents": agent::kinds::agents_json(),
        "version": app.package_info().version.to_string(),
        "updateChannel": if crate::update::store_managed() { "store" } else { "github" },
        "ownsWebviewStorage": load::owns_webview_storage(std::env::var("PLAYPETS_DATA").ok().as_deref(), crate::commands::e2e_mode()),
        "hasBackgroundsFolder": d.folders.backgrounds,
        "project": {"site": env!("CARGO_PKG_HOMEPAGE"), "repository": env!("CARGO_PKG_REPOSITORY")},
        "assets": d.assets.iter().map(sprite::asset_json).collect::<Vec<_>>(),
        "providers": d.providers.iter().map(|p| { let mut p = p.clone(); p["hasKey"] = json!(d.secret_ids.contains(providers::id_of(&p))); p }).collect::<Vec<_>>(),
        "detected": d.detected,
        "warnings": d.warnings,
        "statuses": d.statuses,
        "busy": d.talks.busy_ids().collect::<Vec<_>>(),
        "desktopLayout": layout,
        "desktop": desktop_on(d),
        "nightDecor": d.night_decor,
        "communities": importer::communities_json(),
        "petFolders": d.folders.pets,
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
        o.0.sync(desktop_items(d), desktop_on(d), d.prefs.wander);
    }
    crate::tray::refresh(app, crate::tray::snapshot(d));
    eval_all(app, &format!("window.__pp&&__pp('change',{})", public_state(app, d)));
    // After the pages were told: the layout the overlay sends next comes after this change.
    if let Some(o) = app.try_state::<OverlayHandle>() {
        o.0.wake();
    }
}

/// A save that was put off: asked for many times, written once, and tried again while its writes
/// fail. Taken alone and briefly (`SAVE_LATER`): no other lock is taken while it is held.
struct SaveLater {
    /// A save is wanted.
    wanted: bool,
    /// When the timer that writes it fires, while one is on its way.
    due: Option<Instant>,
    /// How long the next try waits after a failed write; zero while writes go through.
    backoff: Duration,
    /// The person was told the writes fail (`store.held`), since the last one that went through.
    told: bool,
}
impl SaveLater {
    const fn new() -> SaveLater {
        SaveLater {
            wanted: false,
            due: None,
            backoff: Duration::ZERO,
            told: false,
        }
    }
    /// Wants a save within `wait`: true when no timer comes that soon, so the caller starts one. A
    /// change the pages show (250 ms) does not wait for a timer set for one they do not (2 s).
    fn ask(&mut self, now: Instant, wait: Duration) -> bool {
        self.wanted = true;
        let due = now + wait;
        if self.due.is_some_and(|set| set <= due) {
            return false;
        }
        self.due = Some(due);
        true
    }
    /// Whether a save is wanted, clearing it: true once per round of asks. A timer that fires after
    /// another wrote finds nothing to do.
    fn take(&mut self) -> bool {
        self.due = None;
        std::mem::take(&mut self.wanted)
    }
    /// A write failed: the save is wanted again, after a wait that doubles with each failure up to
    /// a minute, so a disk that stays full is not written to every two seconds all day. Gives the
    /// wait, and whether the person is to be told (the first failure only).
    fn failed(&mut self, now: Instant) -> (Duration, bool) {
        self.backoff = if self.backoff.is_zero() {
            LATER
        } else {
            (self.backoff * 2).min(RETRY_MAX)
        };
        self.wanted = true;
        self.due = Some(now + self.backoff);
        (self.backoff, !std::mem::replace(&mut self.told, true))
    }
    /// A write went through: the next failure waits as the first did, and is told again. Gives
    /// whether the person had been told, so the notice goes.
    fn written(&mut self) -> bool {
        self.backoff = Duration::ZERO;
        std::mem::take(&mut self.told)
    }
}
static SAVE_LATER: Mutex<SaveLater> = Mutex::new(SaveLater::new());

/// How soon a small change the pages show is written (`show_and_save_soon`): a burst of pats is one write.
const SOON: Duration = Duration::from_millis(250);
/// How soon a change no page shows is written (`persist_soon`): a drag of the window is one write.
const LATER: Duration = Duration::from_secs(2);
/// The longest wait between tries while the writes fail.
const RETRY_MAX: Duration = Duration::from_secs(60);

/// For changes that come often and matter little until the app quits (where a friend stopped
/// walking, where the window was left): written within 2 s, together, and at exit. A save asked
/// for meanwhile (`show_and_save_soon`) joins the same write.
pub fn persist_soon(app: &AppHandle) {
    save_within(app, LATER);
}

fn save_within(app: &AppHandle, wait: Duration) {
    let start = hold(&SAVE_LATER).ask(Instant::now(), wait);
    if start {
        flush_after(app, wait);
    }
}

fn flush_after(app: &AppHandle, wait: Duration) {
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(wait);
        flush(&app);
    });
}

/// Writes a save put off (`persist_soon`, `show_and_save_soon`), if there is one, and returns once
/// no write is under way: at exit, the process must not end in the middle of one that a timer's
/// thread began. The state is taken under its lock and written after: the disk flush can take a
/// while, and nothing else should wait for it. A write that failed (a file held a moment, a full
/// disk) is tried again later and at exit, and the pages say so once, as no command answers it.
pub fn flush(app: &AppHandle) {
    let wanted = hold(&SAVE_LATER).take();
    if wanted && let Some(state) = app.try_state::<Shared>() {
        let unsaved = Unsaved::of(&lock(&state));
        let failed = unsaved.write().is_err();
        let (retry, notice) = {
            let mut later = hold(&SAVE_LATER);
            if failed {
                let (wait, tell) = later.failed(Instant::now());
                (Some(wait), tell)
            } else {
                (None, later.written())
            }
        };
        if let Some(wait) = retry {
            flush_after(app, wait);
        }
        if notice {
            let mut d = lock(&state);
            if held_warning(&mut d.warnings, failed, &i18n::t("store.held")) {
                changed(app, &d);
            }
        }
    }
    wait_for_write(&WRITTEN);
}

/// Puts the notice that saves fail among the warnings the pages show (`on`), or takes it back;
/// true when the warnings changed. Never twice: a failing write is tried again and again.
fn held_warning(warnings: &mut Vec<String>, on: bool, held: &str) -> bool {
    let shown = warnings.iter().any(|w| w == held);
    match (on, shown) {
        (true, false) => warnings.push(held.to_string()),
        (false, true) => warnings.retain(|w| w != held),
        _ => return false,
    }
    true
}

/// Returns once no write of the state file is under way (its lock is held for the whole write).
fn wait_for_write(written: &Mutex<u64>) {
    drop(hold(written));
}

/// How many saves have been taken; each takes the next number, under the state's lock.
static TAKEN: AtomicU64 = AtomicU64::new(0);
/// The number of the last save written. Held while writing, so two writes never share the
/// temporary file, and a save taken earlier but written later is dropped.
static WRITTEN: Mutex<u64> = Mutex::new(0);

/// The state as it is to be written, numbered in the order it was taken.
struct Saving {
    order: u64,
    state: Value,
}

impl Saving {
    fn of(d: &AppData) -> Saving {
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
            "letters": d.letters,
            "desktop": desktop_on(d),
        });
        carry(&mut state, &d.prefs.saved());
        carry(&mut state, &d.extra);
        Saving {
            order: TAKEN.fetch_add(1, Ordering::SeqCst) + 1,
            state,
        }
    }

    fn write(&self, store: &store::Store, written: &Mutex<u64>) -> Result<(), String> {
        let mut last = hold(written);
        if self.order <= *last {
            return Ok(());
        }
        store.write("state.json", &self.state)?;
        *last = self.order;
        Ok(())
    }
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

/// The menus' desktop switch: every friend goes out, or everything comes in (desktop::items::flip).
pub fn toggle_desktop(app: &AppHandle, mut d: MutexGuard<'_, AppData>) -> Result<bool, String> {
    let AppData {
        pets,
        garden,
        hidden_decor,
        ..
    } = &mut *d;
    let now = crate::desktop::items::flip(pets, garden, hidden_decor.as_deref());
    // Everything brought in with the switch is put away for good: no window lingers for it. After
    // the overlay has nothing out, so no step keeps a window for it again.
    show_and_save_with(app, d, |_| {
        if !now && let Some(o) = app.try_state::<OverlayHandle>() {
            o.0.rest();
        }
    })
    .map(|()| now)
}

/// Friends out on the desktop roam it, or stay where they are put.
pub fn toggle_wander(app: &AppHandle, mut d: MutexGuard<'_, AppData>) -> Result<bool, String> {
    d.prefs.wander = !d.prefs.wander;
    let now = d.prefs.wander;
    show_and_save(app, d).map(|()| now)
}

/// Sends one friend or decoration out to the desktop, or brings it in: shown first, written after
/// the state is let go, so it shows without waiting for the disk.
pub fn put_on_desktop(app: &AppHandle, mut d: MutexGuard<'_, AppData>, id: &str, on: bool) -> Result<(), String> {
    let AppData { pets, garden, .. } = &mut *d;
    crate::desktop::items::set(pets, garden, id, on)?;
    show_and_save(app, d)
}

/// A friend's state as every page shows it (src/core/status.js reads the same fields).
#[derive(serde::Serialize, Clone, Debug, PartialEq)]
pub struct Status {
    /// idle, working, waiting, done or error (agent::bridge::STATES).
    pub state: String,
    pub message: String,
    /// The yard marks agent work, not a chat answer.
    pub source: Source,
    pub at: u64,
    /// Who reported it (`claude:<session>`), so an idle notice can tell its own turn; empty for
    /// a chat, MCP and `playpets status`.
    #[serde(skip_serializing_if = "String::is_empty")]
    pub by: String,
}

#[derive(serde::Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Source {
    Agent,
    Chat,
}

/// A friend's state (idle, working, …) and the line that goes with it, as every page shows it.
pub fn set_status(app: &AppHandle, d: &mut AppData, id: &str, state: &str, message: &str, source: Source, by: &str) {
    if require_pet(d, id).is_err() {
        return;
    }
    let at = now_ms();
    d.statuses.insert(
        id.into(),
        Status {
            state: state.into(),
            message: message.into(),
            source,
            at,
            by: by.into(),
        },
    );
    // Only this friend's status travels, and each page keeps it (core/status.js applyStatus): an
    // agent's hook fires on every tool it uses, too often to rebuild and send the whole state.
    push_event(
        app,
        &json!({"type": "status", "petId": id, "state": state, "message": message, "source": source, "at": at}),
    );
    crate::tray::refresh(app, crate::tray::snapshot(d));
    if state == "error" && source == Source::Agent {
        crate::tray::fade_later(app);
    }
}

/// Puts a pet file on the shelf (once) and remembers its folder for the next start.
pub fn register_asset(app: &AppHandle, mut d: MutexGuard<'_, AppData>, asset: catalog::Asset) -> Result<Value, String> {
    let asset = catalog::Asset {
        place: catalog::place_of(&d.store.dir.join("pets"), &asset.folder, &d.picked),
        ..asset
    };
    let id = asset.id.clone();
    if !d.assets.iter().any(|a| a.id == id) {
        d.imports.push(asset.folder.to_string_lossy().into_owned());
        d.assets.push(asset);
        // The first pet file brought in may have made the downloaded pets' folder.
        d.folders.pets = pet_folders(&d.store.dir, &d.builtin_pets, &d.codex_pets);
        show_and_save(app, d)?;
    }
    Ok(json!(id))
}

pub fn quit(app: &AppHandle) {
    app.state::<CliHandle>().0.close();
    app.exit(0);
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    /// An empty yard in a fresh folder with these friends, for what a command does to the state
    /// (commands/friends.rs, chat/letter.rs).
    pub(crate) fn yard(pets: Value) -> AppData {
        let dir = std::env::temp_dir().join(format!("playpets-data-{}", uuid::Uuid::new_v4()));
        let assets: Vec<String> = pets
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|p| p["assetId"].as_str().map(str::to_string))
            .collect();
        AppData {
            store: crate::store::Store { dir: dir.clone() },
            codex_pets: dir.join("codex"),
            builtin_pets: dir.join("builtin"),
            assets: Vec::new(),
            warnings: Vec::new(),
            pets: crate::pets::model::restore_pets(&json!({ "pets": pets }), &assets),
            parked_pets: Vec::new(),
            prefs: Prefs::restore(&json!({}), crate::i18n::Lang::default()),
            imports: Vec::new(),
            picked: Vec::new(),
            agent_pets: HashMap::new(),
            autostart: false,
            garden: crate::pets::garden::Garden::restore(None, 0),
            album: crate::pets::album::Album::restore(None),
            bonds: crate::pets::bond::Bonds::restore(None, &[]),
            letters: Default::default(),
            providers: Vec::new(),
            parked_providers: Vec::new(),
            extra: serde_json::Map::new(),
            secret_ids: HashSet::new(),
            statuses: HashMap::new(),
            talks: chat::Talks::default(),
            importing: Vec::new(),
            provider_updates: HashSet::new(),
            letters_writing: HashSet::new(),
            letters_key_missed: false,
            detected: json!({}),
            activity: HashMap::new(),
            hidden_decor: None,
            night_decor: Vec::new(),
            folders: Folders::look(&dir, &dir.join("builtin"), &dir.join("codex")),
        }
    }

    #[test]
    fn a_change_is_shown_under_the_lock_and_written_after_it_is_let_go() {
        let state = Mutex::new(7);
        let steps = std::cell::RefCell::new(Vec::new());
        let mut shown = 0;
        let saved = unlocked(
            hold(&state),
            |n| {
                steps.borrow_mut().push("take");
                *n
            },
            |n| {
                steps.borrow_mut().push("show");
                shown = *n;
            },
            |taken| {
                steps.borrow_mut().push("write");
                let mut now = state.try_lock().expect("nothing waits for the disk");
                // Another change lands while this one is written: it has its own save.
                *now = 8;
                assert_eq!(taken, 7, "what is written is what was shown");
                Err("disk full".to_string())
            },
        );
        assert_eq!(*steps.borrow(), ["take", "show", "write"]);
        assert_eq!(shown, 7, "shown before the write");
        assert_eq!(saved.unwrap_err(), "disk full");
        // Every save made with a change goes this way: none writes while it holds the state, so
        // a menu switch, a chat's persona or a new pet file never keeps a page waiting on the disk.
        let old = concat!("save_and", "_show(");
        for (file, source) in [
            ("app.rs", include_str!("app.rs")),
            ("menu.rs", include_str!("menu.rs")),
            ("chat/mod.rs", include_str!("chat/mod.rs")),
            ("commands.rs", include_str!("commands.rs")),
            ("commands/imports.rs", include_str!("commands/imports.rs")),
        ] {
            assert!(!source.contains(old), "{file} writes under the lock");
        }
    }

    #[test]
    fn the_folders_the_pages_hear_of_are_looked_at_once_and_again_only_when_they_change() {
        let dir = std::env::temp_dir().join(format!("playpets-folders-{}", uuid::Uuid::new_v4()));
        let mut folders = Folders::look(&dir, &dir.join("builtin"), &dir.join("codex"));
        assert!(!folders.backgrounds);
        assert_eq!(folders.pets["downloaded"], json!(dir.join("pets")));
        assert_eq!(folders.pets["codex"], json!(dir.join("codex")));
        folders.kept_background();
        assert!(folders.backgrounds, "a background kept makes the folder");
        std::fs::create_dir_all(dir.join(backgrounds::FOLDER)).unwrap();
        assert!(
            Folders::look(&dir, &dir.join("builtin"), &dir.join("codex")).backgrounds,
            "the next start finds it"
        );
        let _ = std::fs::remove_dir_all(&dir);
        // Every change sends the whole state to every page: it never asks the disk.
        let source = include_str!("app.rs");
        let public = &source[source.find("pub fn public_state(").unwrap()..];
        let public = &public[..public.find("\n}\n").unwrap()];
        for stat in ["is_dir", "outside_view", "exists("] {
            assert!(!public.contains(stat), "public_state looks at the disk ({stat})");
        }
    }

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
        let now = std::time::Instant::now();
        let mut later = SaveLater::new();
        assert!(later.ask(now, SOON), "the first ask arranges the write");
        assert!(
            !later.ask(now, SOON) && !later.ask(now, SOON),
            "asks before the write join it"
        );
        assert!(later.take(), "the write happens once");
        assert!(
            !later.take(),
            "exit, or a timer after the write, finds nothing left to write"
        );
        assert!(later.ask(now, SOON), "a later ask arranges a new write");
        assert!(later.take(), "and exit writes it if the timer has not");
    }

    #[test]
    fn an_older_save_never_replaces_a_newer_one() {
        let dir = std::env::temp_dir().join(format!("playpets-saves-{}", uuid::Uuid::new_v4()));
        let store = store::Store { dir: dir.clone() };
        let written = Mutex::new(0);
        let (older, newer) = (
            Saving {
                order: 1,
                state: json!({"n": 1}),
            },
            Saving {
                order: 2,
                state: json!({"n": 2}),
            },
        );
        newer.write(&store, &written).unwrap();
        older.write(&store, &written).unwrap();
        assert_eq!(
            store.read("state.json", json!({})).unwrap()["n"],
            2,
            "a save taken later wins"
        );
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_status_reads_on_the_page_as_it_always_did() {
        let agent = Status {
            state: "working".into(),
            message: "m".into(),
            source: Source::Agent,
            at: 5,
            by: "claude:a1".into(),
        };
        assert_eq!(
            json!(agent),
            json!({"state": "working", "message": "m", "source": "agent", "at": 5, "by": "claude:a1"})
        );
        let chat = Status {
            source: Source::Chat,
            by: String::new(),
            ..agent
        };
        assert_eq!(
            json!(chat),
            json!({"state": "working", "message": "m", "source": "chat", "at": 5}),
            "no empty `by`"
        );
    }

    /// What a command waits for before it answers, and how many writes a bond tick makes, with 12
    /// friends: `cargo test --release bond_tick_cost -- --ignored --nocapture`. Pushing the change
    /// to the pages (`changed`) needs a running app and is left out; it went from 12 to 1 a tick.
    #[test]
    #[ignore = "a measurement, not a check"]
    fn bond_tick_cost() {
        use std::time::Instant;
        let pets: Vec<Value> = (0..12)
            .map(|i| json!({"id": format!("p{i}"), "assetId": "a", "name": "n", "size": 96, "x": 0.5, "y": 0.5}))
            .collect();
        let ids: Vec<String> = (0..12).map(|i| format!("p{i}")).collect();
        let mut d = yard(json!(pets));
        let mut later = SaveLater::new();
        let median = |mut v: Vec<f64>| {
            v.sort_by(f64::total_cmp);
            v[v.len() / 2]
        };
        let (mut pat_before, mut pat_after, mut tick_before, mut tick_after, mut write) =
            (Vec::new(), Vec::new(), Vec::new(), Vec::new(), Vec::new());
        for run in 0..30u64 {
            let day = format!("2026-10-{:02}", run % 28 + 1);
            // Before: each friend's bond changed and was written before its command answered.
            let t = Instant::now();
            for id in &ids {
                d.bonds.befriend(id, "pat", &day, run).unwrap();
                Unsaved::of(&d).write().unwrap();
            }
            tick_before.push(t.elapsed().as_secs_f64() * 1000.0);
            let t = Instant::now();
            d.bonds.befriend(&ids[0], "treat", &day, run).unwrap();
            Unsaved::of(&d).write().unwrap();
            pat_before.push(t.elapsed().as_secs_f64() * 1000.0);
            // After: the whole tick changes the bonds and asks for one write, put off.
            let t = Instant::now();
            for id in &ids {
                d.bonds.befriend(id, "gift", &day, run).unwrap();
            }
            later.ask(Instant::now(), SOON);
            tick_after.push(t.elapsed().as_secs_f64() * 1000.0);
            let t = Instant::now();
            d.bonds.befriend(&ids[0], "chat", &day, run).unwrap();
            later.ask(Instant::now(), SOON);
            pat_after.push(t.elapsed().as_secs_f64() * 1000.0);
            // The write itself, on its own thread a moment later.
            let t = Instant::now();
            if later.take() {
                Unsaved::of(&d).write().unwrap();
            }
            write.push(t.elapsed().as_secs_f64() * 1000.0);
        }
        println!(
            "pat until the answer: {:.3} ms -> {:.3} ms",
            median(pat_before),
            median(pat_after)
        );
        println!(
            "bond tick (12 friends) until the answers: {:.3} ms, 12 writes -> {:.3} ms, 0 writes (1 put off, {:.3} ms off the reply)",
            median(tick_before),
            median(tick_after),
            median(write)
        );
        let _ = std::fs::remove_dir_all(&d.store.dir);
    }

    #[test]
    fn a_change_the_pages_show_does_not_wait_for_a_save_put_off_longer() {
        let now = std::time::Instant::now();
        let mut later = SaveLater::new();
        assert!(later.ask(now, LATER));
        assert!(later.ask(now, SOON), "250 ms does not wait for the 2 s timer");
        assert!(!later.ask(now, LATER), "the 250 ms timer writes the 2 s change too");
    }

    #[test]
    fn a_failed_put_off_write_is_tried_again_less_often_and_told_once() {
        let now = std::time::Instant::now();
        let mut later = SaveLater::new();
        later.ask(now, SOON);
        assert!(later.take());
        assert_eq!(later.failed(now), (LATER, true), "tried again, and the person is told");
        assert!(later.take(), "exit or the next write tries it again");
        let waits: Vec<_> = (0..6).map(|_| later.failed(now)).collect();
        assert!(waits.iter().all(|(_, tell)| !tell), "told once, not on every try");
        let secs: Vec<_> = waits.iter().map(|(wait, _)| wait.as_secs()).collect();
        assert_eq!(secs, [4, 8, 16, 32, 60, 60], "the wait doubles, up to a minute");
        assert!(later.written(), "a write that goes through takes the notice back");
        assert!(!later.written());
        assert_eq!(
            later.failed(now),
            (LATER, true),
            "a later failure starts over and is told again"
        );
    }

    #[test]
    fn the_save_notice_is_shown_once_and_taken_back() {
        let mut warnings = vec!["other".to_string()];
        assert!(held_warning(&mut warnings, true, "held"));
        assert!(!held_warning(&mut warnings, true, "held"), "not twice");
        assert_eq!(warnings, ["other", "held"]);
        assert!(held_warning(&mut warnings, false, "held"));
        assert!(!held_warning(&mut warnings, false, "held"));
        assert_eq!(warnings, ["other"]);
    }

    #[test]
    fn a_flush_waits_for_a_write_already_under_way() {
        use std::sync::{atomic::AtomicBool, mpsc};
        let written = Arc::new(Mutex::new(0u64));
        let done = Arc::new(AtomicBool::new(false));
        let (started, writing) = mpsc::channel();
        let writer = {
            let (written, done) = (written.clone(), done.clone());
            std::thread::spawn(move || {
                let _held = hold(&written);
                started.send(()).unwrap();
                std::thread::sleep(Duration::from_millis(50));
                done.store(true, Ordering::SeqCst);
            })
        };
        writing.recv().unwrap();
        wait_for_write(&written);
        assert!(done.load(Ordering::SeqCst), "the write in flight finished first");
        writer.join().unwrap();
    }
}
