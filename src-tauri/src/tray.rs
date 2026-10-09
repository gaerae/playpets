// The tray icon and its menu, and the words outside the page (window title, tray) that follow
// the app's language.
use crate::i18n;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
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
        // Once a newer version is known, the update item names it.
        let found = crate::update::found_version(app);
        for (key, item) in &items.0 {
            let text = match (*key, &found) {
                ("tray.update", Some(version)) => i18n::tr("tray.update_to", &[("version", &format!("v{version}"))]),
                _ => i18n::t(key),
            };
            let _ = item.set_text(text);
        }
    }
    // The macOS menu bar is built again in the new language.
    #[cfg(target_os = "macos")]
    if let Ok(menu) = crate::menu::app_menu(app) {
        let _ = app.set_menu(menu);
    }
}

pub fn build(app: &tauri::App) -> tauri::Result<()> {
    let item = |id: &str, key: &str| MenuItem::with_id(app, id, i18n::t(key), true, None::<&str>);
    let open = item("open", "tray.open")?;
    let desk = item("desktop", "tray.desktop")?;
    let roam = item("wander", "tray.wander")?;
    let settings = item("settings", "tray.settings")?;
    let update = item("update", "tray.update")?;
    let about = item("about", "tray.about")?;
    let quit_item = item("quit", "tray.quit")?;
    // Three groups: the yard and the desktop; settings, updates and about; quitting.
    let line = || PredefinedMenuItem::separator(app);
    let menu = Menu::with_items(
        app,
        &[
            &open,
            &desk,
            &roam,
            &line()?,
            &settings,
            &update,
            &about,
            &line()?,
            &quit_item,
        ],
    )?;
    app.manage(TrayItems(vec![
        ("tray.open", open.clone()),
        ("tray.desktop", desk.clone()),
        ("tray.wander", roam.clone()),
        ("tray.settings", settings.clone()),
        ("tray.update", update.clone()),
        ("tray.about", about.clone()),
        ("tray.quit", quit_item.clone()),
    ]));
    // Colored app-icon cat on every platform (matches the Dock/taskbar icon).
    let tray_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))?;
    TrayIconBuilder::with_id("tray")
        .tooltip(i18n::t("app.title"))
        .icon(tray_icon)
        .icon_as_template(false)
        .menu(&menu)
        // Its items are handled with the menu bar's, by the app-wide handler (main.rs, menu::act).
        .build(app)?;
    Ok(())
}
