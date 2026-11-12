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
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_dialog::DialogExt;

mod agents;
mod friends;
mod imports;
mod prefs;
use agents::*;
use friends::*;
use imports::*;
use prefs::*;

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
    /// An argument read as `T`; one the page could not have sent is a bad request.
    fn parse<T: serde::de::DeserializeOwned>(&self, i: usize) -> Result<T, String> {
        serde_json::from_value(self.arg(i).clone()).map_err(|_| i18n::t("error.bad_request"))
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
    main("importUrl", |c| import_from_url(c.app, &c.state, c.text(0))),
    main("cancelImport", |c| {
        for flag in &lock(&c.state).importing {
            flag.store(true, Ordering::SeqCst);
        }
        Ok(Value::Null)
    }),
    main("openFolder", |c| open_folder(&c.state, c.text(0))),
    main("openExternal", |c| open_external(c.text(0))),
    // AI connections and chat.
    main("saveProvider", |c| providers::save(c.app, &c.state, &c.cli, c.arg(0))),
    main("removeProvider", |c| {
        providers::remove(c.app, &c.state, &c.cli, c.text(0))
    }),
    main("listModels", |c| providers::list_models(&c.state, c.arg(0))),
    // Looks again for the AIs on this computer and whether each CLI is signed in.
    main("detectAi", |c| {
        providers::detect(c.app.clone());
        Ok(Value::Null)
    }),
    // (kind): signs Claude Code or Codex in through the browser; ends with a cliLogin event.
    main("cliLogin", |c| {
        let app = c.app.clone();
        c.cli
            .logins
            .start(c.text(0), move |kind, ok| providers::signed_in_now(&app, kind, ok))?;
        Ok(Value::Null)
    }),
    // (code): the code Claude's sign-in page showed, for the sign-in waiting for it.
    main("cliLoginCode", |c| {
        c.cli.logins.send_code(c.text(0)).map(|()| Value::Null)
    }),
    main("cancelCliLogin", |c| {
        c.cli.logins.cancel();
        Ok(Value::Null)
    }),
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
    // (year, previous|null): the answer to December's question; with a season, winter is shown now.
    main("answerWinter", |c| {
        let year = u32::try_from(c.arg(0).as_u64().ok_or_else(|| i18n::t("error.bad_request"))?)
            .map_err(|_| i18n::t("error.bad_request"))?;
        let previous = match c.arg(1) {
            Value::Null => None,
            Value::String(season) => Some(season.as_str()),
            _ => return Err(i18n::t("error.bad_request")),
        };
        commit(c.app, &c.state, |d| {
            d.prefs.answer_winter(year, previous)?;
            Ok(Value::Null)
        })
    }),
    // (): winter shown on request ends; the season before comes back once. Returns the season now.
    main("endWinter", |c| commit(c.app, &c.state, |d| Ok(d.prefs.end_winter()))),
    // (year, friend, facts, fallback): this year's letter, written once: the friend's AI from the
    // labelled facts, or the page's own lines.
    main("writeLetter", |c| chat::letter::write(c.app, &c.state, &c.cli, c.args)),
    // (year, answer): the person's answer to that year's letter, one line, kept on this computer only.
    main("answerLetter", |c| {
        let year = c.parse::<u32>(0)?;
        commit(c.app, &c.state, |d| {
            d.letters.answer(year, c.text(1)).map(|()| Value::Null)
        })
    }),
    // (year): clears that year's letter and answer; the year stays so it is not written again.
    main("deleteLetter", |c| {
        let year = c.parse::<u32>(0)?;
        commit(c.app, &c.state, |d| d.letters.delete(year).map(|()| Value::Null))
    }),
    // (year): the New Year card showed that year's answer; it is not brought back again.
    main("letterBack", |c| {
        let year = c.parse::<u32>(0)?;
        commit(c.app, &c.state, |d| d.letters.bring_back(year).map(|()| Value::Null))
    }),
    // (today): the page's date; letters whose season ended by it lose their text, the answer stays.
    // Saved and shown only when one did. Returns the letters.
    main("clearLetters", |c| {
        let latest = crate::pets::latest_day(now_ms());
        let mut d = lock(&c.state);
        let cleared = d.letters.clear_for_page(c.text(0), &latest)?;
        let letters = json!(d.letters);
        if cleared {
            crate::app::show_and_save(c.app, d)?;
        }
        Ok(letters)
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
        let ground: discovery::GroundProfile = c.parse(4)?;
        let context: Option<crate::pets::content::DiscoveryContext> = c.parse(5)?;
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
        let ground: discovery::GroundProfile = c.parse(5)?;
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
        let ground: discovery::GroundProfile = c.parse(3)?;
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
            crate::app::show_and_save(c.app, d)?;
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
    // (id, x, y): a plant moved to another spot on the field.
    main("movePlant", |c| {
        let (x, y) = (c.float(1), c.float(2));
        commit(c.app, &c.state, |d| {
            d.garden.move_plant(c.text(0), x, y).map(|_| Value::Null)
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
    // (day): the local day friends gathered under the blossom, so it comes once a day (viewing.js).
    main("markViewed", |c| {
        commit(c.app, &c.state, |d| {
            d.garden.mark_viewed(c.text(0)).map(|_| Value::Null)
        })
    }),
    // (day): the local day a caught petal brought the special wish line (petals.js).
    main("markWished", |c| {
        commit(c.app, &c.state, |d| {
            d.garden.mark_wished(c.text(0)).map(|_| Value::Null)
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
    main("foundSecret", |c| {
        let now = now_ms();
        let mut d = lock(&c.state);
        let (entry, first) = d.album.found(c.text(0), now)?;
        let answer = json!({"entry": entry, "first": first, "found": d.album.secrets.len()});
        // Found again, only a count no page shows changes: it goes with the next save.
        if !first {
            crate::app::persist_soon(c.app);
            return Ok(answer);
        }
        crate::app::show_and_save(c.app, d).map(|()| answer)
    }),
    // (id): a friend followed this animal's prints to its end; counted in the footprint book.
    main("followTracks", |c| {
        let now = now_ms();
        commit(c.app, &c.state, |d| {
            let (entry, first) = d.album.followed(c.text(0), now)?;
            Ok(json!({"entry": entry, "first": first}))
        })
    }),
    // (id): a spring shoot a friend dug up (shoots.js); returns {entry, first}.
    main("gatherShoot", |c| {
        let now = now_ms();
        commit(c.app, &c.state, |d| {
            let (entry, first) = d.album.gathered(c.text(0), now)?;
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
    main("agentLinks", |c| agent_links(c.app, &c.state)),
    main("connectAgent", |c| link_agent(c.app, &c.state, c.text(0), true)),
    main("disconnectAgent", |c| link_agent(c.app, &c.state, c.text(0), false)),
    // The desktop and the windows.
    main("toggleDesktop", |c| {
        crate::app::toggle_desktop(c.app, &mut lock(&c.state)).map(Value::Bool)
    }),
    main("toggleDesktopWander", |c| {
        crate::app::toggle_wander(c.app, &mut lock(&c.state)).map(Value::Bool)
    }),
    main("setOnDesktop", |c| {
        let on = c.arg(1).as_bool().ok_or_else(|| i18n::t("error.bad_request"))?;
        crate::app::put_on_desktop(c.app, &mut lock(&c.state), c.text(0), on).map(|()| Value::Null)
    }),
    // (kinds): the gift kinds the yard hides now, so the desktop leaves them out too (not saved).
    main("hideDecor", |c| {
        let kinds = gift_kinds(c.arg(0))?;
        let mut d = lock(&c.state);
        if d.hidden_decor.as_ref() == Some(&kinds) {
            return Ok(Value::Null);
        }
        d.hidden_decor = Some(kinds);
        crate::app::changed(c.app, &d);
        Ok(Value::Null)
    }),
    // (kinds): the gift kinds the yard shows in their night look now (the Christmas tree standing
    // grand, yard/christmas-night.js), so the desktop shows them so too (not saved).
    main("decorNight", |c| {
        let kinds = gift_kinds(c.arg(0))?;
        let mut d = lock(&c.state);
        if d.night_decor == kinds {
            return Ok(Value::Null);
        }
        d.night_decor = kinds;
        crate::app::changed(c.app, &d);
        Ok(Value::Null)
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
    // (id): the right-click menu for a friend or a decoration on the desktop, at the pointer.
    overlay("desktopMenu", |c| {
        let id = c.text(0);
        if !c.may_touch(id) {
            return Err(i18n::t("error.bad_request"));
        }
        // Worked out under the lock, shown after it: the menu waits on the main thread.
        let choices = crate::menu::desktop_choices(&lock(&c.state), id).ok_or_else(|| i18n::t("error.bad_request"))?;
        // A menu that cannot be shown leaves nothing to tell: the press simply did nothing.
        let _ = crate::menu::pop_desktop_menu(c.app, c.sender, &choices);
        Ok(Value::Null)
    }),
    // (kind, x, y): a gift that came before, out of the album and down in the yard again.
    main("takeOut", |c| {
        let (x, y, now) = (c.float(1), c.float(2), now_ms());
        commit(c.app, &c.state, |d| {
            d.garden.take_out(c.text(0), x, y, now).map(|d| json!(d))
        })
    }),
    // (book, id, hook, local day): an ornament on the Christmas tree, three a day.
    main("hangOrnament", hang_ornament),
    // (book, id, local day): an ornament taken down, its hook free for another.
    main("takeDownOrnament", take_down_ornament),
    // (x, y, local day): friends and the person built a snowman there; it replaces the one in the
    // yard, once a day.
    main("buildSnowman", build_snowman),
    // (id, parts): what a snowman wears.
    main("dressDecor", |c| {
        let wanted = c.parse::<Vec<String>>(1)?;
        commit(c.app, &c.state, |d| {
            d.garden.dress(c.text(0), &wanted).map(|()| Value::Null)
        })
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
    main("windowFit", |c| window::command(c.app, c.name, c.args)),
    // The app itself.
    main("checkUpdate", |c| crate::update::check(c.app)),
    main("installUpdate", |c| crate::update::install(c.app)),
    main("cancelUpdate", |c| {
        crate::update::cancel(c.app);
        Ok(Value::Null)
    }),
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
    test_only("e2eFront", |c| window::e2e_front(c.app)),
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
            d.garden.ornaments.clear();
            d.garden.ornament_day = Default::default();
            d.garden.ornament_year = 0;
            d.garden.snowman_day.clear();
            Ok(Value::Null)
        })
    }),
];

/// A list of gift kinds the page sent (hideDecor, decorNight), each one the catalogue has.
fn gift_kinds(arg: &Value) -> Result<Vec<String>, String> {
    let kinds = arg
        .as_array()
        .and_then(|list| {
            list.iter()
                .map(|k| k.as_str().map(str::to_string))
                .collect::<Option<Vec<_>>>()
        })
        .ok_or_else(|| i18n::t("error.bad_request"))?;
    if !kinds.iter().all(|k| crate::pets::content::catalog().is_gift(k)) {
        return Err(i18n::t("error.bad_request"));
    }
    Ok(kinds)
}

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

/// Set by the e2e harness: the path of the scenario script to run in the page, which reports
/// through `e2eLog`. A file, not the script itself: Linux caps one environment variable at
/// 128 KiB, and the scenario outgrew it.
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
        let source = include_str!("commands/prefs.rs");
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
        assert_eq!(
            overlay,
            ["bootstrap", "play", "openChat", "desktopMenu", "dragStart", "dragStop"]
        );
        for name in &overlay {
            assert!(may_call("overlay0", name) && may_call("main", name));
        }
        // What goes out on the desktop is chosen in the yard; the desktop only brings things back in.
        for name in [
            "dig",
            "plantTree",
            "moveTree",
            "removeTree",
            "movePlant",
            "growTrees",
            "setOnDesktop",
            "hideDecor",
            "decorNight",
            "takeOut",
            "hangOrnament",
            "takeDownOrnament",
            "buildSnowman",
            "dressDecor",
        ] {
            assert!(may_call("main", name));
            assert!(!may_call("overlay0", name));
        }
        assert!(may_call("main", "followTracks") && !may_call("overlay0", "followTracks"));
        assert!(may_call("main", "gatherShoot") && !may_call("overlay0", "gatherShoot"));
        assert!(may_call("main", "answerLetter") && may_call("main", "deleteLetter"));
        assert!(!may_call("overlay0", "answerLetter"));
        assert!(may_call("main", "writeLetter") && !may_call("overlay0", "writeLetter"));
        assert!(may_call("main", "clearLetters") && !may_call("overlay0", "clearLetters"));
        assert!(may_call("main", "letterBack") && !may_call("overlay0", "letterBack"));
        assert!(may_call("main", "markViewed") && !may_call("overlay0", "markViewed"));
        assert!(may_call("main", "markWished") && !may_call("overlay0", "markWished"));
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
