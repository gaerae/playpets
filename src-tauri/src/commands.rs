// The one command the pages invoke (`call`), and what each of its names does. The bridge script
// below gives every page `window.playPets`, one method per name.
use crate::app::{
    AppData, CliHandle, OverlayHandle, PositionSink, Shared, changed, lock, persist, public_state, push_event,
    register_asset, require_pet,
};
use crate::chat::{self, providers};
use crate::desktop::overlay;
use crate::pets::{catalog, importer, model};
use crate::{agent, i18n, system, tray, window};
use serde_json::{Value, json};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_dialog::DialogExt;

/// Injected into every window before its page runs: `window.playPets`, one method per command
/// (each resolves to {ok, data} or {ok: false, error}), and `__pp`, which the backend calls
/// to hand state changes and events to the page.
const BRIDGE_JS: &str = r#"(()=>{
  const invoke=async(name,args)=>{try{return await window.__TAURI__.core.invoke('call',{name,args});}catch(e){return{ok:false,error:String(e)};}};
  const changes=[],events=[];
  window.__pp=(type,payload)=>{for(const cb of (type==='change'?changes:events)){try{cb(payload)}catch(e){console.error(e)}}};
  const api={};
  for(const n of __COMMANDS__)api[n]=(...a)=>invoke(n,a);
  const listen=(list,cb)=>{list.push(cb);return()=>{const i=list.indexOf(cb);if(i>=0)list.splice(i,1)}};
  api.onChange=cb=>listen(changes,cb);
  api.onEvent=cb=>listen(events,cb);
  window.playPets=Object.freeze(api);
})();"#;

/// Everything the pages may ask for, by name; `dispatch` has an arm for each (tested).
pub const COMMANDS: &[&str] = &[
    "bootstrap",
    "addPet",
    "updatePet",
    "removePet",
    "importFolder",
    "toggleDesktop",
    "toggleDesktopWander",
    "play",
    "saveProvider",
    "removeProvider",
    "chat",
    "chatWith",
    "cancelChat",
    "clearChat",
    "getChat",
    "copyConnection",
    "openChat",
    "dragStart",
    "dragStop",
    "quitApp",
    "listModels",
    "importUrl",
    "openExternal",
    "openFolder",
    "windowDrag",
    "windowMini",
    "windowMinimize",
    "windowMaximize",
    "windowHide",
    "setLanguage",
    "assignAgent",
    "chatter",
    "setAutoChatter",
    "setAutostart",
    "findSeed",
    "plant",
    "pullPlant",
    "receiveGift",
    "moveDecor",
    "putAway",
    "catch",
    "bloomed",
    "checkUpdate",
    "installUpdate",
];

/// The bridge plus the language the page starts in (its own modules read it as they load).
pub fn bridge_js() -> String {
    let list = serde_json::to_string(COMMANDS).unwrap_or_default();
    format!(
        "{}\nwindow.__PP_LANG='{}';",
        BRIDGE_JS.replace("__COMMANDS__", &list),
        i18n::current().code()
    )
}

/// What an overlay window may ask for; everything else is for the main window only.
const OVERLAY_COMMANDS: [&str; 5] = ["bootstrap", "play", "openChat", "dragStart", "dragStop"];
/// Set by the e2e harness: the scenario to run in the page, which reports through `e2eLog`.
pub const E2E_ENV: &str = "PLAYPETS_E2E_EVAL";
/// Whether this run is an e2e run: a build with the `e2e` feature, started with the scenario.
pub fn e2e_mode() -> bool {
    cfg!(feature = "e2e") && std::env::var_os(E2E_ENV).is_some()
}

pub fn arg(args: &[Value], i: usize) -> &Value {
    args.get(i).unwrap_or(&Value::Null)
}
/// A number argument; anything else is not a number, which every place check refuses.
fn float(args: &[Value], i: usize) -> f64 {
    arg(args, i).as_f64().unwrap_or(f64::NAN)
}
pub fn text(args: &[Value], i: usize) -> &str {
    arg(args, i).as_str().unwrap_or("")
}

/// The main window may ask for anything; an overlay only for the few commands it draws with.
fn may_call(label: &str, name: &str) -> bool {
    label == "main" || (label.starts_with("overlay") && OVERLAY_COMMANDS.contains(&name))
}

#[tauri::command]
pub async fn call(app: AppHandle, window: tauri::WebviewWindow, name: String, args: Vec<Value>) -> Value {
    let label = window.label().to_string();
    if !may_call(&label, &name) {
        return fail(i18n::t("error.not_allowed"));
    }
    tauri::async_runtime::spawn_blocking(move || dispatch(app, label, name, args))
        .await
        .unwrap_or_else(|_| fail(i18n::t("error.request_failed")))
}

fn ok(data: Value) -> Value {
    json!({"ok": true, "data": data})
}
fn fail(msg: impl Into<String>) -> Value {
    json!({"ok": false, "error": msg.into()})
}

/// Commands run on a blocking thread, so waiting for an AI or a download holds nothing up.
/// Anything slow (network, dialogs, the keychain) is done without holding the state lock.
fn dispatch(app: AppHandle, sender: String, name: String, args: Vec<Value>) -> Value {
    let state: State<Shared> = app.state();
    let cli = app.state::<CliHandle>().0.clone();
    // An overlay window may only act on the friends drawn on its own monitor.
    let overlay_may = |id: &str| !sender.starts_with("overlay") || overlay_owns(&app, &sender, id);
    let result = || -> Result<Value, String> {
        match name.as_str() {
            "bootstrap" => Ok(public_state(&app, &lock(&state))),
            // Friends in the yard.
            "addPet" => add_pet(&app, &state, text(&args, 0)),
            "updatePet" => update_pet(&app, &state, &cli, text(&args, 0), arg(&args, 1)),
            "removePet" => remove_pet(&app, &state, &cli, text(&args, 0)),
            "play" => play(&app, &state, text(&args, 0), arg(&args, 1).as_str(), &overlay_may),
            // Pet files.
            "importFolder" => import_from_folder(&app, &state),
            "importUrl" => {
                let root = lock(&state).store.dir.join("pets");
                let folder = importer::import_from_url(text(&args, 0), &root, &importer::http_fetch)?;
                let asset = catalog::read_pet(&folder)?;
                register_asset(&app, &mut lock(&state), asset)
            }
            "openFolder" => open_folder(&state, text(&args, 0)),
            "openExternal" => open_external(text(&args, 0)),
            // AI connections and chat.
            "saveProvider" => providers::save(&app, &state, &cli, arg(&args, 0)),
            "removeProvider" => providers::remove(&app, &state, &cli, text(&args, 0)),
            "listModels" => providers::list_models(&state, arg(&args, 0)),
            "chat" => chat::chat(&app, &state, &cli, &args),
            "chatWith" => chat::chat_with(&app, &state, &cli, &args),
            "chatter" => chat::chatter(&app, &state, &cli, &args),
            "setAutoChatter" => set_auto_chatter(&app, &state, arg(&args, 0).as_bool().unwrap_or(false)),
            "setAutostart" => set_autostart(&app, &state, arg(&args, 0).as_bool().unwrap_or(false)),
            "findSeed" => garden_change(&app, &state, |g| g.find().map(Value::from)),
            "plant" => {
                let (kind, x, y) = (text(&args, 0), arg(&args, 1).as_f64(), arg(&args, 2).as_f64());
                let (Some(x), Some(y)) = (x, y) else {
                    return Err(i18n::t("error.bad_request"));
                };
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|t| t.as_millis() as u64)
                    .unwrap_or(0);
                garden_change(&app, &state, |g| g.plant(kind, x, y, now).map(|p| json!(p)))
            }
            "pullPlant" => garden_change(&app, &state, |g| g.pull(text(&args, 0)).map(|_| Value::Null)),
            "receiveGift" => {
                let (x, y) = (float(&args, 0), float(&args, 1));
                let turn = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|t| t.as_secs() as usize)
                    .unwrap_or(0);
                garden_change(&app, &state, |g| g.gift(x, y, text(&args, 2), turn).map(|d| json!(d)))
            }
            "moveDecor" => {
                let (x, y) = (float(&args, 1), float(&args, 2));
                garden_change(&app, &state, |g| {
                    g.move_decor(text(&args, 0), x, y).map(|_| Value::Null)
                })
            }
            "putAway" => garden_change(&app, &state, |g| g.put_away(text(&args, 0)).map(|_| Value::Null)),
            // A plant the page sees in flower: counted in the album the first time.
            "bloomed" => {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|t| t.as_millis() as u64)
                    .unwrap_or(0);
                let mut d = lock(&state);
                let Some(kind) = d.garden.bloom(text(&args, 0), now)? else {
                    return Ok(Value::Null);
                };
                let entry = d.album.flowered(&kind, now);
                persist(&d)?;
                changed(&app, &d);
                Ok(json!({"kind": kind, "entry": entry}))
            }
            "catch" => {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|t| t.as_millis() as u64)
                    .unwrap_or(0);
                let (kind, id, size) = (text(&args, 0), text(&args, 1), arg(&args, 2).as_f64().unwrap_or(0.0));
                let mut d = lock(&state);
                let (entry, first) = d.album.catch(kind, id, size, now)?;
                persist(&d)?;
                changed(&app, &d);
                Ok(json!({"entry": entry, "first": first}))
            }
            "getChat" => {
                let d = lock(&state);
                let id = text(&args, 0);
                require_pet(&d, id).map(|_| json!(d.histories.get(id).cloned().unwrap_or_default()))
            }
            "clearChat" => chat::clear(&state, &cli, text(&args, 0)),
            "cancelChat" => {
                let d = lock(&state);
                let id = text(&args, 0);
                require_pet(&d, id).map(|_| {
                    chat::cancel(&d, &cli, id);
                    Value::Null
                })
            }
            // Coding agents.
            "copyConnection" => copy_connection(&app, &state, arg(&args, 0).as_str().unwrap_or("mcp")),
            "assignAgent" => assign_agent(&app, &state, text(&args, 0), text(&args, 1)),
            // The desktop and the windows.
            "toggleDesktop" | "toggleDesktopWander" => {
                let mut d = lock(&state);
                crate::app::toggle_flag(&app, &mut d, name == "toggleDesktopWander").map(Value::Bool)
            }
            "openChat" => {
                let id = text(&args, 0);
                require_pet(&lock(&state), id)?;
                if !overlay_may(id) {
                    return Err(i18n::t("error.bad_request"));
                }
                window::show(&app);
                push_event(&app, &json!({"type": "select", "petId": id}));
                Ok(Value::Null)
            }
            "dragStart" => {
                let id = text(&args, 0);
                if sender.starts_with("overlay") && overlay_owns(&app, &sender, id) {
                    let overlay = &app.state::<OverlayHandle>().0;
                    let cursor = overlay.cursor(&app).unwrap_or((0.0, 0.0));
                    overlay.drag_start(id, cursor);
                }
                Ok(Value::Null)
            }
            "dragStop" => {
                let sink = app.state::<PositionSink>().0.clone();
                overlay::stop_drag_and_save(&app.state::<OverlayHandle>().0, &app, &sink);
                Ok(Value::Null)
            }
            "windowDrag" | "windowMinimize" | "windowMaximize" | "windowHide" | "windowMini" => {
                window::command(&app, name.as_str(), &args)
            }
            // The app itself.
            "setLanguage" => set_language(&app, &state, text(&args, 0)),
            "checkUpdate" => crate::update::check(&app),
            "installUpdate" => crate::update::install(&app),
            "quitApp" => {
                crate::app::quit(&app);
                Ok(Value::Null)
            }
            // The e2e scenario reports through stdout; the command exists in no other run.
            "e2eLog" if e2e_mode() => {
                println!("[e2e] {}", text(&args, 0));
                Ok(Value::Null)
            }
            "e2eWindow" if e2e_mode() => window::e2e_window(&app, &args),
            "e2eTray" if e2e_mode() => Ok(crate::tray::e2e_state()),
            _ => Err(i18n::t("error.not_allowed")),
        }
    };
    match result() {
        Ok(v) => ok(v),
        Err(e) => fail(e),
    }
}

/// An overlay window may only act on the friends drawn on its own monitor.
fn overlay_owns(app: &AppHandle, label: &str, pet_id: &str) -> bool {
    let Some(display) = label.strip_prefix("overlay") else {
        return false;
    };
    let Some(o) = app.try_state::<OverlayHandle>() else {
        return false;
    };
    o.0.layout()
        .iter()
        .any(|item| item["id"].as_str() == Some(pet_id) && item["displayId"].as_str() == Some(display))
}

fn add_pet(app: &AppHandle, state: &State<Shared>, asset_id: &str) -> Result<Value, String> {
    let mut d = lock(state);
    let Some(intro) = d.assets.iter().find(|a| a.id == asset_id).map(|a| a.intro.clone()) else {
        return Err(i18n::t("error.pet_missing"));
    };
    let mut pet = model::create_pet(asset_id, &d.pets)?;
    // A new friend starts out as its pet file describes it; people edit from there.
    pet.persona = intro.chars().take(crate::pets::model::PERSONA_MAX).collect();
    let out = serde_json::to_value(&pet).unwrap();
    d.pets.push(pet);
    persist(&d)?;
    changed(app, &d);
    Ok(out)
}

fn update_pet(
    app: &AppHandle,
    state: &State<Shared>,
    cli: &chat::cli::CliManager,
    id: &str,
    patch: &Value,
) -> Result<Value, String> {
    let mut d = lock(state);
    require_pet(&d, id)?;
    let provider_of = |d: &AppData| d.pets.iter().find(|p| p.id == id).map(|p| p.provider_id.clone());
    if let Some(wanted) = patch.get("providerId") {
        let wanted = wanted.as_str().unwrap_or("");
        if !wanted.is_empty() && providers::find(&d, wanted).is_none() {
            return Err(i18n::t("provider.missing"));
        }
        if d.pending.contains(id) {
            return Err(i18n::t("provider.busy"));
        }
    }
    let before = provider_of(&d);
    model::update_pet(&mut d.pets, id, patch)?;
    // A conversation belongs to the AI it was held with.
    if provider_of(&d) != before {
        chat::reset(&mut d, cli, id);
    }
    // A friend that walked somewhere is saved with the next few; anything else at once.
    let only_moved = patch
        .as_object()
        .is_some_and(|o| o.keys().all(|k| k == "x" || k == "y"));
    if only_moved {
        // A friend arrived somewhere: the page already drew it there, so it only hears where,
        // rather than the whole state again (which every window would re-render).
        crate::app::persist_soon(app);
        if let Some(p) = d.pets.iter().find(|p| p.id == id) {
            push_event(app, &json!({"type": "pet-moved", "petId": id, "x": p.x, "y": p.y}));
        }
    } else {
        persist(&d)?;
        changed(app, &d);
    }
    Ok(Value::Null)
}

fn remove_pet(app: &AppHandle, state: &State<Shared>, cli: &chat::cli::CliManager, id: &str) -> Result<Value, String> {
    let mut d = lock(state);
    require_pet(&d, id)?;
    chat::cancel(&d, cli, id);
    d.pets.retain(|p| p.id != id);
    chat::reset(&mut d, cli, id);
    d.statuses.remove(id);
    d.activity.remove(id);
    // An agent that reported to this friend goes back to the first one.
    d.agent_pets.retain(|_, pet| pet != id);
    persist(&d)?;
    changed(app, &d);
    Ok(Value::Null)
}

/// A press, a treat, a wave or a jump; without a friend named, everyone joins in.
fn play(
    app: &AppHandle,
    state: &State<Shared>,
    action: &str,
    pet_id: Option<&str>,
    overlay_may: &dyn Fn(&str) -> bool,
) -> Result<Value, String> {
    if !["pet", "treat", "wave", "jump"].contains(&action) {
        return Err(i18n::t("error.unknown_play"));
    }
    if let Some(id) = pet_id {
        require_pet(&lock(state), id)?;
        if !overlay_may(id) {
            return Err(i18n::t("error.bad_request"));
        }
    }
    push_event(app, &json!({"type": "play", "action": action, "petId": pet_id}));
    Ok(Value::Null)
}

fn import_from_folder(app: &AppHandle, state: &State<Shared>) -> Result<Value, String> {
    let mut dialog = app.dialog().file().set_title(i18n::t("dialog.pick_pet_folder"));
    if let Some(main) = app.get_webview_window("main") {
        dialog = dialog.set_parent(&main);
    }
    let Some(path) = dialog.blocking_pick_folder().and_then(|f| f.into_path().ok()) else {
        return Ok(Value::Null);
    };
    let asset = catalog::read_pet(&path)?;
    register_asset(app, &mut lock(state), asset)
}

/// Shows where pets live: "codex" or "downloaded" for those folders, or a pet file's id.
fn open_folder(state: &State<Shared>, which: &str) -> Result<Value, String> {
    let folder = {
        let d = lock(state);
        match which {
            "builtin" => d.builtin_pets.clone(),
            "codex" => d.codex_pets.clone(),
            "downloaded" => d.store.dir.join("pets"),
            id => d
                .assets
                .iter()
                .find(|a| a.id == id)
                .map(|a| a.folder.clone())
                .ok_or_else(|| i18n::t("error.pet_missing"))?,
        }
    };
    if !folder.is_dir() {
        return Err(i18n::t("error.folder_empty"));
    }
    system::open_folder(&folder)?;
    Ok(Value::Null)
}

fn open_external(raw: &str) -> Result<Value, String> {
    let target = importer::openable(raw)
        .or_else(|| project_page(raw))
        .ok_or_else(|| i18n::t("error.url_not_openable"))?;
    system::open_url(target.as_str())?;
    Ok(Value::Null)
}

/// The app's own pages: its site and its repository (Cargo.toml `homepage` and `repository`, which
/// a test keeps equal to package.json), at those addresses or below them, over https.
fn project_page(raw: &str) -> Option<url::Url> {
    let target = url::Url::parse(raw).ok()?;
    let under = |base: &str| {
        let base = base.trim_end_matches('/');
        target
            .as_str()
            .strip_prefix(base)
            .is_some_and(|rest| rest.is_empty() || rest.starts_with(['/', '?', '#']))
    };
    let own = under(env!("CARGO_PKG_HOMEPAGE")) || under(env!("CARGO_PKG_REPOSITORY"));
    (target.scheme() == "https" && own).then_some(target)
}

/// The settings a coding agent needs to reach this app, put on the clipboard.
fn copy_connection(app: &AppHandle, state: &State<Shared>, kind: &str) -> Result<Value, String> {
    let exe = std::env::current_exe().map_err(|_| i18n::t("error.exe_missing"))?;
    let (bridge_file, pet) = {
        let d = lock(state);
        (d.store.dir.join("bridge.json"), d.agent_pets.get(kind).cloned())
    };
    let local = std::env::var("LOCALAPPDATA").ok();
    let command = agent::cli::agent_command(&exe.to_string_lossy(), local.as_deref());
    let snippet = agent::snippets::connection_snippet(kind, &command, &bridge_file.to_string_lossy(), pet.as_deref())?;
    app.clipboard()
        .write_text(snippet.clone())
        .map_err(|e| i18n::detail("clipboard.failed", e))?;
    Ok(json!(snippet))
}

/// Which friend a coding agent reports to. An empty pet id clears the choice (back to the first
/// friend). The copied settings carry it as `--pet`, so they must be pasted again.
fn assign_agent(app: &AppHandle, state: &State<Shared>, kind: &str, pet: &str) -> Result<Value, String> {
    if agent::kinds::by_kind(kind).is_none() {
        return Err(i18n::t("error.unknown_link"));
    }
    let mut d = lock(state);
    if pet.is_empty() {
        d.agent_pets.remove(kind);
    } else {
        require_pet(&d, pet)?;
        d.agent_pets.insert(kind.to_string(), pet.to_string());
    }
    persist(&d)?;
    changed(app, &d);
    Ok(Value::Null)
}

/// Whether the friends chat among themselves now and then without being asked.
fn set_auto_chatter(app: &AppHandle, state: &State<Shared>, on: bool) -> Result<Value, String> {
    let mut d = lock(state);
    d.auto_chatter = on;
    persist(&d)?;
    changed(app, &d);
    Ok(Value::Bool(on))
}

/// A change to the garden (a seed found, planted, a plant pulled), saved and shown everywhere.
fn garden_change(
    app: &AppHandle,
    state: &State<Shared>,
    change: impl FnOnce(&mut crate::pets::garden::Garden) -> Result<Value, String>,
) -> Result<Value, String> {
    let mut d = lock(state);
    let result = change(&mut d.garden)?;
    persist(&d)?;
    changed(app, &d);
    Ok(result)
}

/// Whether the app starts when the person logs in. The system keeps the answer (a login item on
/// macOS, the Run key on Windows, an autostart entry on Linux); a test run only pretends.
fn set_autostart(app: &AppHandle, state: &State<Shared>, on: bool) -> Result<Value, String> {
    let now = if e2e_mode() {
        on
    } else {
        use tauri_plugin_autostart::ManagerExt;
        let launcher = app.autolaunch();
        if on { launcher.enable() } else { launcher.disable() }.map_err(|_| i18n::t("error.autostart"))?;
        launcher.is_enabled().unwrap_or(on)
    };
    let mut d = lock(state);
    d.autostart = now;
    changed(app, &d);
    Ok(Value::Bool(now))
}

/// The language the person chose; the page reloads itself in it, the tray and title follow here.
fn set_language(app: &AppHandle, state: &State<Shared>, code: &str) -> Result<Value, String> {
    let lang = i18n::Lang::parse(code).ok_or_else(|| i18n::t("error.language"))?;
    i18n::set(lang);
    {
        let mut d = lock(state);
        d.language = lang;
        persist(&d)?;
        changed(app, &d);
    }
    // Rewording the tray waits on the main thread, which may itself be waiting for the state.
    tray::retitle(app);
    // Every page (the yard, each desktop window) starts over in the new language at once.
    crate::app::relanguage(app, lang.code());
    Ok(json!(lang.code()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_apps_own_pages_open_and_nothing_next_to_them() {
        for ok in [
            "https://gaerae.github.io/playpets/",
            "https://gaerae.github.io/playpets/ko/releases/0.2.0",
            "https://github.com/gaerae/playpets",
            "https://github.com/gaerae/playpets/issues/new/choose",
        ] {
            assert!(project_page(ok).is_some(), "{ok}");
        }
        for no in [
            "http://gaerae.github.io/playpets/",
            "https://gaerae.github.io/other/",
            "https://github.com/gaerae/playpets-evil",
            "https://github.com/gaerae",
            "https://example.com/",
            "javascript:alert(1)",
        ] {
            assert!(project_page(no).is_none(), "{no}");
        }
    }

    #[test]
    fn every_pet_folder_the_page_lists_can_be_opened() {
        // The Invite tab shows an Open folder button for each place in `petFolders`.
        let app = include_str!("app.rs");
        let start = app.find("\"petFolders\": {").unwrap();
        let folders = &app[start..start + app[start..].find('}').unwrap()];
        let source = include_str!("commands.rs");
        let open = &source[source.find("fn open_folder(").unwrap()..];
        let open = &open[..open.find("\n}\n").unwrap()];
        let parts: Vec<&str> = folders.split('"').skip(3).collect();
        let keys = parts.windows(2).filter(|w| w[1].starts_with(':')).map(|w| w[0]);
        for key in keys {
            assert!(
                open.contains(&format!("\"{key}\" =>")),
                "open_folder has no arm for {key}"
            );
        }
    }

    #[test]
    fn every_listed_command_has_a_dispatch_arm_and_the_overlay_gets_only_its_own() {
        let source = include_str!("commands.rs");
        let start = source.find("fn dispatch(").unwrap();
        let dispatch = &source[start..start + source[start..].find("\n}\n").unwrap()];
        let window_arms = include_str!("window.rs");
        for name in COMMANDS {
            let quoted = format!("\"{name}\"");
            assert!(
                dispatch.contains(&quoted) || window_arms.contains(&quoted),
                "{name} is listed for the page but nothing handles it"
            );
        }
        // And the other way: every arm that handles a page's command is listed, or the page has
        // no method to call it with (test-only commands are named only in e2e mode).
        for line in dispatch.lines() {
            let arm = line.trim_start();
            let Some(rest) = arm.strip_prefix('"') else { continue };
            let Some((name, after)) = rest.split_once('"') else {
                continue;
            };
            if after.trim_start().starts_with("=>") && !name.starts_with("e2e") {
                assert!(
                    COMMANDS.contains(&name),
                    "{name} is handled but not listed for the page"
                );
            }
        }
        let mut seen = std::collections::HashSet::new();
        assert!(COMMANDS.iter().all(|n| seen.insert(n)), "a command is listed twice");
        assert!(bridge_js().contains("\"bootstrap\",\"addPet\""));
        for name in OVERLAY_COMMANDS {
            assert!(COMMANDS.contains(&name) && may_call("overlay0", name));
        }
        assert!(may_call("main", "quitApp"));
        assert!(!may_call("overlay1", "quitApp"));
        assert!(!may_call("other", "bootstrap"));
    }
}
