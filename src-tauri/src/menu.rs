// What the menus outside the page do: the tray's menu and, on macOS, the menu bar. Tauri hands
// every menu's clicks to one app-wide handler (main.rs), which comes here. Both open the
// yard on the part of the page that answers (the Settings tab, its About section, the update
// check), so the same words lead to the same place from either.
use crate::app::{Shared, lock, push_event, quit};
use crate::window;
use serde_json::json;
use tauri::{AppHandle, Manager};

/// Runs a menu command from the tray or the menu bar. The menu bar's built-in items (copy, hide,
/// minimize…) are handled by macOS and arrive here only to be ignored.
pub fn act(app: &AppHandle, id: &str) {
    let open = |event: serde_json::Value| {
        window::show(app);
        push_event(app, &event);
    };
    match id {
        "open" => window::show(app),
        "settings" => open(json!({"type": "open-panel", "panel": "settings"})),
        "about" => open(json!({"type": "open-panel", "panel": "settings", "section": "about"})),
        // The page shows the update when one was found, and checks on its Settings tab otherwise.
        "update" => open(json!({"type": "check-update"})),
        "desktop" | "wander" => {
            let state = app.state::<Shared>();
            let mut d = lock(&state);
            if let Err(e) = crate::app::toggle_flag(app, &mut d, id == "wander") {
                d.warnings.push(e);
            }
        }
        "quit" => quit(app),
        _ => {}
    }
}

/// The macOS menu bar in the app's language: the app menu (About, Check for Updates, Settings,
/// hiding, Quit), Edit (so text fields keep cut, copy and paste) and Window.
#[cfg(target_os = "macos")]
pub fn app_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use crate::i18n::t;
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem as P, Submenu};
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
    let window_menu = Submenu::with_items(
        app,
        t("menu.window"),
        true,
        &[
            &P::minimize(app, text("menu.minimize").as_deref())?,
            &P::close_window(app, text("menu.close").as_deref())?,
        ],
    )?;
    Menu::with_items(app, &[&app_menu, &edit, &window_menu])
}
