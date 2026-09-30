// The tray icon and its menu, and the words outside the page (window title, tray) that follow
// the app's language.
use crate::app::{Shared, lock, quit};
use crate::{i18n, window};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager};

/// The tray's items by the key of their text, kept so a change of language can reword them.
struct TrayItems(Vec<(&'static str, MenuItem<tauri::Wry>)>);

/// Everything outside the page that carries words: the window title, the tray tooltip and menu.
pub fn retitle(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.set_title(&i18n::t("app.title"));
    }
    if let Some(tray) = app.tray_by_id("tray") {
        let _ = tray.set_tooltip(Some(i18n::t("app.title")));
    }
    if let Some(items) = app.try_state::<TrayItems>() {
        for (key, item) in &items.0 {
            let _ = item.set_text(i18n::t(key));
        }
    }
}

pub fn build(app: &tauri::App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", i18n::t("tray.open"), true, None::<&str>)?;
    let desk = MenuItem::with_id(app, "desktop", i18n::t("tray.desktop"), true, None::<&str>)?;
    let roam = MenuItem::with_id(app, "wander", i18n::t("tray.wander"), true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", i18n::t("tray.quit"), true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &desk, &roam, &quit_item])?;
    app.manage(TrayItems(vec![
        ("tray.open", open.clone()),
        ("tray.desktop", desk.clone()),
        ("tray.wander", roam.clone()),
        ("tray.quit", quit_item.clone()),
    ]));
    // Colored app-icon cat on every platform (matches the Dock/taskbar icon).
    let tray_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))?;
    TrayIconBuilder::with_id("tray")
        .tooltip(i18n::t("app.title"))
        .icon(tray_icon)
        .icon_as_template(false)
        .menu(&menu)
        .on_menu_event(|app, e| match e.id().as_ref() {
            "open" => window::show(app),
            "desktop" | "wander" => {
                let state = app.state::<Shared>();
                let mut d = lock(&state);
                if let Err(e) = crate::app::toggle_flag(app, &mut d, e.id().as_ref() == "wander") {
                    d.warnings.push(e);
                }
            }
            "quit" => quit(app),
            _ => {}
        })
        .build(app)?;
    Ok(())
}
