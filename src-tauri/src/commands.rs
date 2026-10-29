// The one command the pages invoke (`call`), and what each of its names does. The bridge script
// below gives every page `window.playPets`, one method per name.
use crate::app::{
    AppData, CliHandle, OverlayHandle, PositionSink, Shared, changed, commit, lock, now_ms, public_state, push_event,
    register_asset, require_pet,
};
use crate::chat::{self, providers};
use crate::desktop::overlay;
use crate::pets::{catalog, discovery, importer, model};
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

/// What a command is handed: the app, its state, the CLI sessions, which window asked, and the
/// arguments as the page passed them.
pub struct Ctx<'a> {
    pub app: &'a AppHandle,
    pub state: State<'a, Shared>,
    pub cli: std::sync::Arc<chat::cli::CliManager>,
    pub sender: &'a str,
    pub name: &'a str,
    pub args: &'a [Value],
}
impl Ctx<'_> {
    fn arg(&self, i: usize) -> &Value {
        arg(self.args, i)
    }
    fn text(&self, i: usize) -> &str {
        text(self.args, i)
    }
    fn float(&self, i: usize) -> f64 {
        float(self.args, i)
    }
    /// An overlay window may only act on the friends drawn on its own monitor.
    fn may_touch(&self, id: &str) -> bool {
        !self.sender.starts_with("overlay") || overlay_owns(self.app, self.sender, id)
    }
}

/// Which windows may ask for a command: the yard window only, the desktop overlays too, or the
/// e2e scenario (in an e2e run only, and never offered to the page).
#[derive(Clone, Copy, PartialEq, Debug)]
enum Who {
    Main,
    Overlay,
    Test,
}
/// A command the pages may ask for: its name (the page's method), who may, and what it does.
struct Command {
    name: &'static str,
    who: Who,
    run: fn(&Ctx) -> Result<Value, String>,
}
const fn main(name: &'static str, run: fn(&Ctx) -> Result<Value, String>) -> Command {
    Command {
        name,
        who: Who::Main,
        run,
    }
}
const fn overlay(name: &'static str, run: fn(&Ctx) -> Result<Value, String>) -> Command {
    Command {
        name,
        who: Who::Overlay,
        run,
    }
}
const fn test_only(name: &'static str, run: fn(&Ctx) -> Result<Value, String>) -> Command {
    Command {
        name,
        who: Who::Test,
        run,
    }
}

/// Every command, in one table: a new one is one row (and its page call). The bridge, who may call
/// what, and the dispatch all come from here.
static COMMANDS: &[Command] = &[
    overlay("bootstrap", |c| Ok(public_state(c.app, &lock(&c.state)))),
    // Friends in the yard.
    main("addPet", |c| add_pet(c.app, &c.state, c.text(0), c.arg(1))),
    main("updatePet", |c| {
        update_pet(c.app, &c.state, &c.cli, c.text(0), c.arg(1))
    }),
    main("removePet", |c| remove_pet(c.app, &c.state, &c.cli, c.text(0))),
    overlay("play", |c| {
        play(c.app, &c.state, c.text(0), c.arg(1).as_str(), &|id| c.may_touch(id))
    }),
    // Pet files.
    main("importFolder", |c| import_from_folder(c.app, &c.state)),
    main("importZip", |c| import_from_zip(c.app, &c.state)),
    main("removeAsset", |c| remove_asset(c.app, &c.state, c.text(0))),
    main("importUrl", |c| {
        let root = lock(&c.state).store.dir.join("pets");
        let folder = importer::import_from_url(c.text(0), &root, &importer::http_fetch)?;
        let asset = catalog::read_pet(&folder)?;
        register_asset(c.app, &mut lock(&c.state), asset)
    }),
    main("openFolder", |c| open_folder(&c.state, c.text(0))),
    main("openExternal", |c| open_external(c.text(0))),
    // AI connections and chat.
    main("saveProvider", |c| providers::save(c.app, &c.state, &c.cli, c.arg(0))),
    main("removeProvider", |c| {
        providers::remove(c.app, &c.state, &c.cli, c.text(0))
    }),
    main("listModels", |c| providers::list_models(&c.state, c.arg(0))),
    main("chat", |c| chat::chat(c.app, &c.state, &c.cli, c.args)),
    main("chatWith", |c| chat::chat_with(c.app, &c.state, &c.cli, c.args)),
    main("chatter", |c| chat::chatter(c.app, &c.state, &c.cli, c.args)),
    main("getChat", |c| {
        let d = lock(&c.state);
        let id = c.text(0);
        require_pet(&d, id).map(|_| json!(d.talks.log(id)))
    }),
    main("clearChat", |c| chat::clear(&c.state, &c.cli, c.text(0))),
    main("cancelChat", |c| {
        let d = lock(&c.state);
        let id = c.text(0);
        require_pet(&d, id).map(|_| {
            chat::cancel(&d, &c.cli, id);
            Value::Null
        })
    }),
    // Settings.
    main("setAutoChatter", |c| {
        set_auto_chatter(c.app, &c.state, c.arg(0).as_bool().unwrap_or(false))
    }),
    main("setAutoPlay", |c| {
        set_auto_play(c.app, &c.state, c.arg(0).as_bool().unwrap_or(false))
    }),
    // (on, volume): either may be null to keep it as it is.
    main("setSound", |c| {
        commit(c.app, &c.state, |d| {
            let on = c.arg(0).as_bool().unwrap_or(d.prefs.sound.on);
            let volume = c.arg(1).as_u64().map_or(d.prefs.sound.volume, |v| v.min(100) as u8);
            d.prefs.sound = crate::app::Sound { on, volume };
            Ok(json!(d.prefs.sound))
        })
    }),
    // (key, value): the place, season, time of day or weather picked for the yard.
    main("setScene", |c| {
        let choice = crate::app::scene_choice(c.text(0), c.text(1)).ok_or_else(|| i18n::t("error.bad_request"))?;
        commit(c.app, &c.state, |d| {
            d.prefs.scene.insert(c.text(0).to_string(), choice);
            Ok(Value::Null)
        })
    }),
    // Imported backgrounds, a file each in the data folder; read and written outside the lock.
    main("listBackgrounds", |c| {
        let dir = lock(&c.state).store.dir.clone();
        Ok(json!(crate::app::backgrounds::list(&dir)))
    }),
    // (id, package)
    main("saveBackground", |c| {
        let dir = lock(&c.state).store.dir.clone();
        crate::app::backgrounds::save(&dir, c.text(0), c.arg(1)).map(|()| Value::Null)
    }),
    main("removeBackground", |c| {
        let dir = lock(&c.state).store.dir.clone();
        crate::app::backgrounds::remove(&dir, c.text(0)).map(|()| Value::Null)
    }),
    main("setAutostart", |c| {
        set_autostart(c.app, &c.state, c.arg(0).as_bool().unwrap_or(false))
    }),
    main("readAutostart", |c| read_autostart(c.app, &c.state)),
    main("setLanguage", |c| set_language(c.app, &c.state, c.text(0))),
    // The garden, gifts, the album and closeness.
    main("dig", |c| {
        let ground: discovery::GroundProfile =
            serde_json::from_value(c.arg(4).clone()).map_err(|_| i18n::t("error.bad_request"))?;
        let context: Option<crate::pets::content::DiscoveryContext> =
            serde_json::from_value(c.arg(5).clone()).map_err(|_| i18n::t("error.bad_request"))?;
        if context.as_ref().is_some_and(|context| !context.valid()) {
            return Err(i18n::t("error.bad_request"));
        }
        let entropy = uuid::Uuid::new_v4();
        let bytes = entropy.as_bytes();
        // The first four UUID bytes contain no fixed version or variant bits.
        let roll = (u32::from_le_bytes(bytes[..4].try_into().unwrap()) % 100) as u8;
        let choice = u32::from_le_bytes(bytes[12..].try_into().unwrap()) as u64;
        let now = now_ms();
        commit(c.app, &c.state, |d| {
            require_pet(d, c.text(0))?;
            let result = discovery::dig(
                &mut d.garden,
                &mut d.album,
                c.text(0),
                c.text(1),
                c.float(2),
                c.float(3),
                &ground,
                now,
                roll,
                choice,
                context.as_ref(),
            )?;
            Ok(json!(result))
        })
    }),
    main("plantTree", |c| {
        let ground: discovery::GroundProfile =
            serde_json::from_value(c.arg(5).clone()).map_err(|_| i18n::t("error.bad_request"))?;
        let now = now_ms();
        commit(c.app, &c.state, |d| {
            require_pet(d, c.text(0))?;
            let tree = discovery::plant_tree(
                &mut d.garden,
                c.text(1),
                c.text(2),
                c.float(3),
                c.float(4),
                &ground,
                now,
            )?;
            Ok(json!(tree))
        })
    }),
    main("moveTree", |c| {
        let ground: discovery::GroundProfile =
            serde_json::from_value(c.arg(3).clone()).map_err(|_| i18n::t("error.bad_request"))?;
        commit(c.app, &c.state, |d| {
            discovery::move_tree(&mut d.garden, c.text(0), c.float(1), c.float(2), &ground)?;
            Ok(Value::Null)
        })
    }),
    main("removeTree", |c| {
        commit(c.app, &c.state, |d| {
            discovery::remove_tree(&mut d.garden, c.text(0))?;
            Ok(Value::Null)
        })
    }),
    main("growTrees", |c| {
        let now = now_ms();
        let mut d = lock(&c.state);
        let AppData { garden, album, .. } = &mut *d;
        if discovery::grow_trees(garden, album, now) {
            crate::app::save_and_show(c.app, &d)?;
        }
        Ok(Value::Null)
    }),
    main("plant", |c| {
        let (Some(x), Some(y)) = (c.arg(1).as_f64(), c.arg(2).as_f64()) else {
            return Err(i18n::t("error.bad_request"));
        };
        let now = now_ms();
        commit(c.app, &c.state, |d| {
            d.garden.plant(c.text(0), x, y, now).map(|p| json!(p))
        })
    }),
    main("pullPlant", |c| {
        commit(c.app, &c.state, |d| d.garden.pull(c.text(0)).map(|_| Value::Null))
    }),
    main("receiveGift", receive_gift),
    main("thanksGift", thanks_gift),
    // (id, x, y): a gift out of the box, set down in the yard.
    main("setOut", |c| {
        let (x, y) = (c.float(1), c.float(2));
        commit(c.app, &c.state, |d| d.garden.set_out(c.text(0), x, y).map(|d| json!(d)))
    }),
    // (giftDay it follows, due at in ms): the wait for the next everyday gift, kept across restarts.
    main("waitForGift", |c| {
        let due = c.arg(1).as_u64().ok_or_else(|| i18n::t("error.bad_request"))?;
        commit(c.app, &c.state, |d| {
            d.garden.wait_for_gift(c.text(0), due).map(|_| Value::Null)
        })
    }),
    main("moveDecor", |c| {
        let (x, y) = (c.float(1), c.float(2));
        commit(c.app, &c.state, |d| {
            d.garden.move_decor(c.text(0), x, y).map(|_| Value::Null)
        })
    }),
    main("putAway", |c| {
        commit(c.app, &c.state, |d| d.garden.put_away(c.text(0)).map(|_| Value::Null))
    }),
    main("catch", |c| {
        let now = now_ms();
        let size = c.arg(2).as_f64().unwrap_or(0.0);
        commit(c.app, &c.state, |d| {
            let (entry, first) = d.album.catch(c.text(0), c.text(1), size, now)?;
            Ok(json!({"entry": entry, "first": first}))
        })
    }),
    main("bloomed", bloomed),
    main("befriend", befriend),
    // Coding agents.
    main("copyConnection", |c| {
        copy_connection(c.app, &c.state, c.arg(0).as_str().unwrap_or("mcp"))
    }),
    main("assignAgent", |c| assign_agent(c.app, &c.state, c.text(0), c.text(1))),
    // The desktop and the windows.
    main("toggleDesktop", |c| {
        crate::app::toggle_flag(c.app, &mut lock(&c.state), false).map(Value::Bool)
    }),
    main("toggleDesktopWander", |c| {
        crate::app::toggle_flag(c.app, &mut lock(&c.state), true).map(Value::Bool)
    }),
    overlay("openChat", |c| {
        let id = c.text(0);
        require_pet(&lock(&c.state), id)?;
        if !c.may_touch(id) {
            return Err(i18n::t("error.bad_request"));
        }
        window::show(c.app);
        push_event(c.app, &json!({"type": "select", "petId": id}));
        Ok(Value::Null)
    }),
    overlay("dragStart", |c| {
        let id = c.text(0);
        if c.sender.starts_with("overlay") && overlay_owns(c.app, c.sender, id) {
            let overlay = &c.app.state::<OverlayHandle>().0;
            let cursor = overlay.cursor(c.app).unwrap_or((0.0, 0.0));
            overlay.drag_start(id, cursor);
        }
        Ok(Value::Null)
    }),
    overlay("dragStop", |c| {
        let sink = c.app.state::<PositionSink>().0.clone();
        overlay::stop_drag_and_save(&c.app.state::<OverlayHandle>().0, c.app, &sink);
        Ok(Value::Null)
    }),
    main("windowDrag", |c| window::command(c.app, c.name, c.args)),
    main("windowAlwaysOnTop", |c| window::command(c.app, c.name, c.args)),
    main("windowFullscreen", |c| window::command(c.app, c.name, c.args)),
    main("windowIsFullscreen", |c| window::command(c.app, c.name, c.args)),
    main("windowResize", |c| window::command(c.app, c.name, c.args)),
    main("windowMinimize", |c| window::command(c.app, c.name, c.args)),
    main("windowMaximize", |c| window::command(c.app, c.name, c.args)),
    main("windowHide", |c| window::command(c.app, c.name, c.args)),
    // The app itself.
    main("checkUpdate", |c| crate::update::check(c.app)),
    main("installUpdate", |c| crate::update::install(c.app)),
    main("quitApp", |c| {
        crate::app::quit(c.app);
        Ok(Value::Null)
    }),
    // The e2e scenario reports through stdout; these exist in no other run.
    test_only("e2eLog", |c| {
        println!("[e2e] {}", c.text(0));
        Ok(Value::Null)
    }),
    test_only("e2eWindow", |c| window::e2e_window(c.app, c.args)),
    test_only("e2eTray", |_| Ok(crate::tray::e2e_state())),
    // The ZIP import after its file dialog, which a test cannot answer.
    test_only("e2eImportZip", |c| {
        add_zip(c.app, &c.state, std::path::Path::new(c.text(0)))
    }),
    // A garden with no gifts yet, so the gift checks do not depend on whether the page's own first
    // gift (a few minutes in) came before them.
    test_only("e2eFreshGifts", |c| {
        commit(c.app, &c.state, |d| {
            d.garden.gift_day.clear();
            d.garden.decor.clear();
            d.garden.received.clear();
            d.garden.boxed.clear();
            d.garden.thanked.clear();
            d.garden.gift_wait = None;
            Ok(Value::Null)
        })
    }),
];

fn command(name: &str) -> Option<&'static Command> {
    COMMANDS.iter().find(|c| c.name == name)
}

/// The bridge plus the language the page starts in (its own modules read it as they load).
pub fn bridge_js() -> String {
    let names: Vec<&str> = COMMANDS.iter().filter(|c| c.who != Who::Test).map(|c| c.name).collect();
    let list = serde_json::to_string(&names).unwrap_or_default();
    format!(
        "{}\nwindow.__PP_LANG='{}';",
        BRIDGE_JS.replace("__COMMANDS__", &list),
        i18n::current().code()
    )
}

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

/// The main window may ask for anything but the e2e scenario's own commands (only in an e2e run);
/// an overlay only for the few commands it draws with.
fn may_call(label: &str, name: &str) -> bool {
    match command(name).map(|c| c.who) {
        Some(Who::Main) => label == "main",
        Some(Who::Overlay) => label == "main" || label.starts_with("overlay"),
        Some(Who::Test) => label == "main" && e2e_mode(),
        None => false,
    }
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
    let Some(command) = command(&name) else {
        return fail(i18n::t("error.not_allowed"));
    };
    let ctx = Ctx {
        app: &app,
        state: app.state(),
        cli: app.state::<CliHandle>().0.clone(),
        sender: &sender,
        name: &name,
        args: &args,
    };
    match (command.run)(&ctx) {
        Ok(v) => ok(v),
        Err(e) => fail(e),
    }
}

// Commands with more to them than a line.
/// (x, y, day, event, friend): the friend brings an everyday gift, on a day the two did something
/// together (bond.rs counts it).
fn receive_gift(c: &Ctx) -> Result<Value, String> {
    let (x, y) = (c.float(0), c.float(1));
    let (day, from) = (c.text(2), c.text(4));
    let turn = (now_ms() / 1000) as usize;
    // A day that has not come anywhere yet is a clock set ahead (pets::has_come).
    if !crate::pets::has_come(day, now_ms()) {
        return Err(i18n::t("error.bad_request"));
    }
    commit(c.app, &c.state, |d| {
        // A clock set ahead and put right while the app ran left a day still to come.
        let latest = crate::pets::latest_day(now_ms());
        crate::pets::forget_days_after(&mut d.bonds, &mut d.garden, &latest);
        require_pet(d, from)?;
        if !d.bonds.together_on(from, day) {
            return Err(i18n::t("error.bad_request"));
        }
        d.garden
            .gift(x, y, day, turn, c.arg(3).as_str(), from)
            .map(|g| json!(g))
    })
}
/// (friend, level, x, y): a friend that grew closer brings a gift for the level it reached.
fn thanks_gift(c: &Ctx) -> Result<Value, String> {
    let (from, x, y) = (c.text(0), c.float(2), c.float(3));
    let level = c.arg(1).as_u64().unwrap_or(0) as u32;
    let turn = (now_ms() / 1000) as usize;
    commit(c.app, &c.state, |d| {
        require_pet(d, from)?;
        if d.bonds.level_of(from) < level {
            return Err(i18n::t("error.bad_request"));
        }
        d.garden.thanks(from, level, x, y, turn).map(|g| json!(g))
    })
}
/// Something done together with a friend: its bond grows (bond.rs keeps what it is worth).
fn befriend(c: &Ctx) -> Result<Value, String> {
    let now = now_ms();
    let (pet, reason, day) = (c.text(0), c.text(1), c.text(2));
    // Every reason counts toward a day that has come; time together also waits its turn by the clock.
    if !crate::pets::has_come(day, now) {
        return Err(i18n::t("error.bad_request"));
    }
    commit(c.app, &c.state, |d| {
        require_pet(d, pet)?;
        let (points, level, up) = d.bonds.befriend(pet, reason, day, now)?;
        Ok(json!({"points": points, "level": level, "up": up}))
    })
}
/// A plant the page sees in flower: counted in the album the first time.
fn bloomed(c: &Ctx) -> Result<Value, String> {
    let now = now_ms();
    let mut d = lock(&c.state);
    // Asked again for a plant already counted: nothing changes, nothing is saved.
    let Some(kind) = d.garden.bloom(c.text(0), now)? else {
        return Ok(Value::Null);
    };
    let entry = d.album.flowered(&kind, now);
    crate::app::save_and_show(c.app, &d)?;
    Ok(json!({"kind": kind, "entry": entry}))
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

/// The realistic look is a choice only for a pet file that has one (catalog::realistic_appearance).
fn has_realistic_art(asset: &catalog::Asset) -> bool {
    asset.realistic_sprite_paths.contains_key("default")
}

fn add_pet(app: &AppHandle, state: &State<Shared>, asset_id: &str, options: &Value) -> Result<Value, String> {
    commit(app, state, |d| {
        let Some(asset) = d.assets.iter().find(|a| a.id == asset_id) else {
            return Err(i18n::t("error.pet_missing"));
        };
        let mut pet = model::create_pet_with_options(asset_id, &d.pets, options)?;
        if pet.visual_style == model::VisualStyle::Realistic && !has_realistic_art(asset) {
            return Err(i18n::t("error.bad_settings"));
        }
        // A new friend starts out as its pet file describes it; people edit from there.
        pet.persona = asset.intro.chars().take(crate::pets::model::PERSONA_MAX).collect();
        let out = serde_json::to_value(&pet).unwrap();
        d.pets.push(pet);
        Ok(out)
    })
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
        if d.talks.busy(id) {
            return Err(i18n::t("provider.busy"));
        }
    }
    // Turning a friend realistic needs that art; one already realistic keeps saving its other
    // settings even if its pet file lost the art since.
    if patch.get("visualStyle").and_then(model::VisualStyle::from_value) == Some(model::VisualStyle::Realistic) {
        let pet = d.pets.iter().find(|p| p.id == id);
        let allowed = pet.is_some_and(|p| {
            p.visual_style == model::VisualStyle::Realistic
                || d.assets.iter().any(|a| a.id == p.asset_id && has_realistic_art(a))
        });
        if !allowed {
            return Err(i18n::t("error.bad_settings"));
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
        crate::app::save_and_show(app, &d)?;
    }
    Ok(Value::Null)
}

fn remove_pet(app: &AppHandle, state: &State<Shared>, cli: &chat::cli::CliManager, id: &str) -> Result<Value, String> {
    commit(app, state, |d| {
        require_pet(d, id)?;
        chat::cancel(d, cli, id);
        d.pets.retain(|p| p.id != id);
        chat::reset(d, cli, id);
        d.statuses.remove(id);
        d.activity.remove(id);
        d.bonds.forget(id);
        d.garden.forget_friend(id);
        // An agent that reported to this friend goes back to the first one.
        d.agent_pets.retain(|_, pet| pet != id);
        Ok(Value::Null)
    })
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
    let mut d = lock(state);
    // Picked from where imported pets live, it is still the person's own folder.
    let downloads = d.store.dir.join("pets");
    if catalog::picked_by_hand(&downloads, &asset.folder, &d.picked, &d.assets) {
        d.picked.push(asset.folder.to_string_lossy().into_owned());
    }
    register_asset(app, &mut d, asset)
}

/// A pet ZIP picked on this computer is copied into the data folder's pets, so the ZIP can go.
fn import_from_zip(app: &AppHandle, state: &State<Shared>) -> Result<Value, String> {
    let mut dialog = app
        .dialog()
        .file()
        .set_title(i18n::t("dialog.pick_pet_zip"))
        .add_filter("ZIP", &["zip"]);
    if let Some(main) = app.get_webview_window("main") {
        dialog = dialog.set_parent(&main);
    }
    let Some(file) = dialog.blocking_pick_file().and_then(|f| f.into_path().ok()) else {
        return Ok(Value::Null);
    };
    add_zip(app, state, &file)
}

/// Copies a pet ZIP into the data folder and puts it on the shelf.
fn add_zip(app: &AppHandle, state: &State<Shared>, file: &std::path::Path) -> Result<Value, String> {
    let root = lock(state).store.dir.join("pets");
    let folder = importer::import_from_zip(file, &root)?;
    let asset = catalog::read_pet(&folder)?;
    register_asset(app, &mut lock(state), asset)
}

/// Takes an imported or picked pet off the shelf. An imported one's folder in the data folder goes
/// with it; a folder picked by hand is the person's and stays.
fn remove_asset(app: &AppHandle, state: &State<Shared>, id: &str) -> Result<Value, String> {
    let mut taken = None;
    commit(app, state, |d| {
        // A friend parked over the limit comes back with its pet at a later start; the page cannot
        // see it, so the refusal names it.
        let title = d
            .assets
            .iter()
            .find(|a| a.id == id)
            .map(|a| a.display_name.clone())
            .unwrap_or_default();
        if let Some(name) = model::parked_user(&d.parked_pets, id, &title) {
            return Err(i18n::tr("error.pet_kept_for_later", &[("name", &name)]));
        }
        let pets = &d.pets;
        let asset = catalog::take_imported(
            &mut d.assets,
            &mut d.imports,
            |id| pets.iter().any(|p| p.asset_id == id),
            id,
        )?;
        d.picked.retain(|folder| std::path::Path::new(folder) != asset.folder);
        taken = Some((asset, d.store.dir.join("pets")));
        Ok(Value::Null)
    })?;
    // Deleted once the shelf is saved without it: files left by a failed delete are never read
    // again, since only the listed imports are.
    if let Some((asset, downloads)) = taken
        && let Some(folder) = catalog::deletable(&downloads, asset.place, &asset.folder)
    {
        let _ = std::fs::remove_dir_all(folder);
    }
    Ok(Value::Null)
}

/// Shows where pets live: "codex", "downloaded" or "builtin" for those folders, or a pet file's id.
fn open_folder(state: &State<Shared>, which: &str) -> Result<Value, String> {
    let folder = {
        let d = lock(state);
        match which {
            "builtin" => d.builtin_pets.clone(),
            "codex" => d.codex_pets.clone(),
            "downloaded" => d.store.dir.join("pets"),
            // the app's own data: friends, settings and the backups beside them (About)
            "data" => d.store.dir.clone(),
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
        (
            d.store.dir.join("bridge.json"),
            // The real choice, a parked friend too: the bridge sends its events to the first friend
            // until it is back (agent/bridge.rs resolve_pet), and to it after.
            d.agent_pets.get(kind).cloned(),
        )
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
    commit(app, state, |d| {
        if pet.is_empty() {
            d.agent_pets.remove(kind);
        } else {
            require_pet(d, pet)?;
            d.agent_pets.insert(kind.to_string(), pet.to_string());
        }
        Ok(Value::Null)
    })
}

/// Whether the friends chat among themselves now and then without being asked.
fn set_auto_chatter(app: &AppHandle, state: &State<Shared>, on: bool) -> Result<Value, String> {
    commit(app, state, |d| {
        d.prefs.auto_chatter = on;
        Ok(Value::Bool(on))
    })
}

/// Whether idle friends now and then dig on their own without being asked.
fn set_auto_play(app: &AppHandle, state: &State<Shared>, on: bool) -> Result<Value, String> {
    commit(app, state, |d| {
        d.prefs.auto_play = on;
        Ok(Value::Bool(on))
    })
}

/// Whether the app starts when the person logs in. The system keeps the answer (startup.rs); a
/// test run only pretends.
fn set_autostart(app: &AppHandle, state: &State<Shared>, on: bool) -> Result<Value, String> {
    let now = if e2e_mode() { on } else { crate::startup::set(app, on)? };
    let mut d = lock(state);
    d.autostart = now;
    changed(app, &d);
    Ok(Value::Bool(now))
}

/// Whether the app starts at login, asked again: the person may have changed it in the system's
/// own settings while the app ran. The system is asked before the lock is taken.
fn read_autostart(app: &AppHandle, state: &State<Shared>) -> Result<Value, String> {
    let now = if e2e_mode() {
        lock(state).autostart
    } else {
        crate::startup::is_enabled(app)
    };
    let mut d = lock(state);
    if d.autostart != now {
        d.autostart = now;
        changed(app, &d);
    }
    Ok(Value::Bool(now))
}

/// The language the person chose; the page reloads itself in it, the tray and title follow here.
fn set_language(app: &AppHandle, state: &State<Shared>, code: &str) -> Result<Value, String> {
    let lang = i18n::Lang::parse(code).ok_or_else(|| i18n::t("error.language"))?;
    // The language stands even when it could not be saved (commit), so the pages follow it either way.
    let saved = commit(app, state, |d| {
        if d.prefs.language != lang {
            d.talks.cancel_pending();
        }
        i18n::set(lang);
        d.prefs.language = lang;
        // Picked by the person, it is theirs to keep even in a run that forced another.
        d.prefs.kept_language = None;
        Ok(Value::Null)
    });
    // Rewording the tray waits on the main thread, which may itself be waiting for the state.
    tray::retitle(app);
    // Every page (the yard, each desktop window) starts over in the new language at once.
    crate::app::relanguage(app, lang.code());
    saved.map(|_| json!(lang.code()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_apps_own_pages_open_and_nothing_next_to_them() {
        for ok in [
            "https://playpets.gaerae.com/",
            "https://playpets.gaerae.com/ko/releases/0.2.0",
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
    fn each_command_is_named_once_and_each_window_may_ask_only_for_its_own() {
        let mut seen = std::collections::HashSet::new();
        assert!(
            COMMANDS.iter().all(|c| seen.insert(c.name)),
            "a command is listed twice"
        );
        let bridge = bridge_js();
        assert!(bridge.contains("\"bootstrap\",\"addPet\""));
        assert!(
            !bridge.contains("e2e"),
            "the e2e scenario's commands are never offered to the page"
        );
        let overlay: Vec<&str> = COMMANDS
            .iter()
            .filter(|c| c.who == Who::Overlay)
            .map(|c| c.name)
            .collect();
        assert_eq!(overlay, ["bootstrap", "play", "openChat", "dragStart", "dragStop"]);
        for name in &overlay {
            assert!(may_call("overlay0", name) && may_call("main", name));
        }
        for name in ["dig", "plantTree", "moveTree", "removeTree", "growTrees"] {
            assert!(may_call("main", name));
            assert!(!may_call("overlay0", name));
        }
        assert!(may_call("main", "quitApp"));
        assert!(!may_call("overlay1", "quitApp"));
        assert!(!may_call("other", "bootstrap"));
        assert!(!may_call("main", "nonsense"));
        assert!(command("findSeed").is_none(), "flowers only come from digging");
        assert!(!may_call("main", "e2eLog"), "not outside an e2e run");
        // Every window command the table sends to window.rs is one window.rs handles.
        let window_rs = include_str!("window.rs");
        for name in [
            "windowDrag",
            "windowAlwaysOnTop",
            "windowFullscreen",
            "windowIsFullscreen",
            "windowResize",
            "windowMinimize",
            "windowMaximize",
            "windowHide",
        ] {
            assert!(command(name).is_some() && window_rs.contains(&format!("\"{name}\" =>")));
        }
    }
}
