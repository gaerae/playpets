// What the menus outside the page do: the tray's menu and, on macOS, the menu bar. Tauri hands
// every menu's clicks to one app-wide handler (main.rs), which comes here. Both open the
// yard on the part of the page that answers (the Settings tab, its About section, the update
// check), so the same words lead to the same place from either.
use crate::app::{Shared, lock, push_event, quit};
use crate::window;
use serde_json::{Value, json};
use tauri::{AppHandle, Manager};

/// A switch from the menu that could not be saved: the pages hear why (the change itself was already
/// shown), since no page asked and so none would get the error.
fn warn(app: &AppHandle, d: &mut crate::app::AppData, error: String) {
    d.warnings.push(error);
    crate::app::changed(app, d);
}

/// Runs a menu command from the tray or the menu bar. The menu bar's built-in items (copy, hide,
/// minimize…) are handled by macOS and arrive here only to be ignored.
pub fn act(app: &AppHandle, id: &str) {
    let open = |event: serde_json::Value| {
        window::show(app);
        push_event(app, &event);
    };
    match id {
        "open" => window::show(app),
        "controls" => open(json!({"type": "open-controls"})),
        "settings" => open(json!({"type": "open-panel", "panel": "settings"})),
        "friends" => open(json!({"type": "open-panel", "panel": "pet"})),
        "invite" => open(json!({"type": "open-panel", "panel": "invite"})),
        "about" => open(json!({"type": "open-panel", "panel": "settings", "section": "about"})),
        // The page shows the update when one was found, and checks on its Settings tab otherwise.
        "update" => open(json!({"type": "check-update"})),
        // The switches save to disk, which the main loop (where menu callbacks run) never waits for.
        "desktop" | "wander" | "sound" => {
            let (app, id) = (app.clone(), id.to_string());
            tauri::async_runtime::spawn_blocking(move || {
                let state = app.state::<Shared>();
                let flipped = match id.as_str() {
                    "desktop" => crate::app::toggle_desktop(&app, lock(&state)).map(drop),
                    "wander" => crate::app::toggle_wander(&app, lock(&state)).map(drop),
                    _ => crate::app::commit(&app, &state, |d| {
                        d.prefs.sound.on = !d.prefs.sound.on;
                        Ok(Value::Null)
                    })
                    .map(drop),
                };
                if let Err(e) = flipped {
                    warn(&app, &mut lock(&state), e);
                }
                // A check item ticks itself when clicked: the menu is built again from what is true.
                crate::tray::rebuild(&app);
            });
        }
        "alwaysOnTop" => {
            // Native confirmation needs the main loop to run; menu callbacks run on that loop.
            let app = app.clone();
            tauri::async_runtime::spawn_blocking(move || {
                let state = app.state::<Shared>();
                let on = !lock(&state).prefs.always_on_top;
                if let Err(e) = window::set_always_on_top(&app, on) {
                    warn(&app, &mut lock(&state), e);
                }
                crate::tray::rebuild(&app);
            });
        }
        "fit" => {
            // Leaving fullscreen needs the main loop to run; menu callbacks run on that loop.
            let app = app.clone();
            tauri::async_runtime::spawn_blocking(move || {
                if let Err(e) = window::show_fitted(&app) {
                    warn(&app, &mut lock(&app.state::<Shared>()), e);
                }
            });
        }
        "quit" => quit(app),
        _ => desktop_act(app, id),
    }
}

/// What a right click on the desktop offers, as (menu id, label): talking to a friend, and taking
/// a friend, a decoration, a flower or a planted tree off the desktop (it stays in the yard). None for what is not out there.
pub fn desktop_choices(d: &crate::app::AppData, id: &str) -> Option<Vec<(String, String)>> {
    let name = |p: &crate::pets::model::Pet| crate::app::pet_name(d, p, &crate::i18n::t("chat.a_friend"));
    choices_for(&d.pets, &d.garden, id, name)
}

fn choices_for(
    pets: &[crate::pets::model::Pet],
    garden: &crate::pets::garden::Garden,
    id: &str,
    name: impl Fn(&crate::pets::model::Pet) -> String,
) -> Option<Vec<(String, String)>> {
    use crate::i18n::{t, tr};
    let take_in = (format!("desktop-in:{id}"), t("desktop.take_in"));
    if let Some(p) = pets.iter().find(|p| p.id == id && p.on_desktop) {
        return Some(vec![
            (format!("desktop-talk:{id}"), tr("desktop.talk", &[("name", &name(p))])),
            take_in,
        ]);
    }
    let out = garden.decor.iter().any(|g| g.id == id && g.on_desktop)
        || garden.plants.iter().any(|p| p.id == id && p.on_desktop)
        || garden.trees.iter().any(|t| t.id == id && t.on_desktop);
    out.then(|| vec![take_in])
}

/// Shows `choices` where the pointer is, over the overlay window `label`.
pub fn pop_desktop_menu(app: &AppHandle, label: &str, choices: &[(String, String)]) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem};
    let Some(win) = app.get_webview_window(label) else {
        return Ok(());
    };
    let menu = Menu::new(app)?;
    for (id, text) in choices {
        menu.append(&MenuItem::with_id(app, id, text, true, None::<&str>)?)?;
    }
    win.popup_menu(&menu)
}

/// A choice from the desktop's right-click menu (desktop_choices).
fn desktop_act(app: &AppHandle, id: &str) {
    if let Some(pet) = id.strip_prefix("desktop-talk:") {
        window::show(app);
        push_event(app, &json!({"type": "select", "petId": pet}));
    } else if let Some(item) = id.strip_prefix("desktop-in:") {
        // Saved off the main loop, as the switches are (`act`).
        let (app, item) = (app.clone(), item.to_string());
        tauri::async_runtime::spawn_blocking(move || {
            let state = app.state::<Shared>();
            if let Err(e) = crate::app::put_on_desktop(&app, lock(&state), &item, false) {
                warn(&app, &mut lock(&state), e);
            }
        });
    }
}

/// The macOS menu bar in the app's language: the app menu (About, Check for Updates, Settings,
/// hiding, Quit), Edit (so text fields keep cut, copy and paste) and Window.
#[cfg(target_os = "macos")]
pub fn app_menu(
    app: &AppHandle,
    friends: bool,
    desktop: bool,
    always_on_top: bool,
    sound: bool,
) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use crate::i18n::t;
    use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem as P, Submenu};
    let item = |id: &str, key: &str, accel: Option<&str>| MenuItem::with_id(app, id, t(key), true, accel);
    let line = || P::separator(app);
    let text = |key: &str| Some(t(key));
    let app_menu = Submenu::with_items(
        app,
        "PlayPets",
        true,
        &[
            &item("about", "menu.about", None)?,
            &line()?,
            &item("update", "menu.update", None)?,
            &item("settings", "menu.settings", Some("CmdOrCtrl+,"))?,
            &line()?,
            &P::hide(app, text("menu.hide").as_deref())?,
            &P::hide_others(app, text("menu.hide_others").as_deref())?,
            &P::show_all(app, text("menu.show_all").as_deref())?,
            &line()?,
            &item("quit", "menu.quit", Some("CmdOrCtrl+Q"))?,
        ],
    )?;
    let edit = Submenu::with_items(
        app,
        t("menu.edit"),
        true,
        &[
            &P::undo(app, text("menu.undo").as_deref())?,
            &P::redo(app, text("menu.redo").as_deref())?,
            &line()?,
            &P::cut(app, text("menu.cut").as_deref())?,
            &P::copy(app, text("menu.copy").as_deref())?,
            &P::paste(app, text("menu.paste").as_deref())?,
            &P::select_all(app, text("menu.select_all").as_deref())?,
        ],
    )?;
    // View: the panels, the two ways of showing friends and the yard's sounds, with the keys a Mac user expects.
    // The switches have nothing to show without a friend, so they are greyed then, as menu bar
    // items are (the tray leaves them out instead).
    let switch =
        |id: &str, key: &str, accel: &str, on: bool| CheckMenuItem::with_id(app, id, t(key), friends, on, Some(accel));
    let view = Submenu::with_items(
        app,
        t("menu.view"),
        true,
        &[
            &item("controls", "menu.controls", Some("CmdOrCtrl+Shift+P"))?,
            &line()?,
            &item("friends", "menu.friends", Some("CmdOrCtrl+1"))?,
            &item("invite", "menu.invite", Some("CmdOrCtrl+2"))?,
            &line()?,
            &CheckMenuItem::with_id(
                app,
                "alwaysOnTop",
                t("tray.alwaysOnTop"),
                true,
                always_on_top,
                Some("CmdOrCtrl+Shift+M"),
            )?,
            &switch("desktop", "tray.desktop", "CmdOrCtrl+Shift+D", desktop)?,
            &line()?,
            // The yard's sounds play with or without friends, so this one is never greyed.
            &CheckMenuItem::with_id(app, "sound", t("menu.sound"), true, sound, Some("CmdOrCtrl+Shift+S"))?,
        ],
    )?;
    let window_menu = Submenu::with_items(
        app,
        t("menu.window"),
        true,
        &[
            &item("fit", "tray.fit", Some("CmdOrCtrl+0"))?,
            &P::minimize(app, text("menu.minimize").as_deref())?,
            &P::close_window(app, text("menu.close").as_deref())?,
        ],
    )?;
    Menu::with_items(app, &[&app_menu, &edit, &view, &window_menu])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pets::garden::{Decor, Garden};
    use crate::pets::model::create_pet;

    #[test]
    fn a_right_click_on_the_desktop_talks_to_a_friend_or_takes_a_thing_off_it() {
        let mut miso = create_pet("white", &[]).unwrap();
        miso.id = "miso".into();
        miso.on_desktop = true;
        let mut garden = Garden::default();
        for (id, out) in [("bench", true), ("tent", false)] {
            garden.decor.push(Decor {
                id: id.into(),
                kind: id.into(),
                on_desktop: out,
                ..Decor::default()
            });
        }
        let pets = vec![miso];
        let ids = |id: &str| {
            choices_for(&pets, &garden, id, |_| "Miso".into())
                .map(|c| c.into_iter().map(|(id, _)| id).collect::<Vec<_>>())
        };
        assert_eq!(ids("miso").unwrap(), ["desktop-talk:miso", "desktop-in:miso"]);
        assert!(
            choices_for(&pets, &garden, "miso", |_| "Miso".into()).unwrap()[0]
                .1
                .contains("Miso")
        );
        assert_eq!(ids("bench").unwrap(), ["desktop-in:bench"]);
        assert_eq!(ids("tent"), None, "only what is out there");
        assert_eq!(ids("nobody"), None);
        // A flower or a planted tree out there is taken in as a gift is.
        let taken_in = |garden: &Garden, id: &str| {
            choices_for(&pets, garden, id, |_| "Miso".into())
                .map(|c| c.into_iter().map(|(id, _)| id).collect::<Vec<_>>())
        };
        garden.seeds = 1;
        garden.plant("tulip", 0.5, 0.5, 1).unwrap();
        garden.plants[0].id = "tulip".into();
        assert_eq!(taken_in(&garden, "tulip"), None, "only once it is out");
        garden.plants[0].on_desktop = true;
        garden.trees.push(crate::pets::discovery::Tree {
            id: "cherry".into(),
            world: "meadow".into(),
            kind: "cherry".into(),
            x: 0.5,
            y: 0.5,
            planted: 1,
            stage: 2,
            matured: true,
            on_desktop: true,
            desktop_position: None,
        });
        assert_eq!(taken_in(&garden, "tulip").unwrap(), ["desktop-in:tulip"]);
        assert_eq!(taken_in(&garden, "cherry").unwrap(), ["desktop-in:cherry"]);
    }
}
