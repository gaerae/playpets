// Updates of the app itself: the latest release's latest.json (GitHub) is checked, and a newer
// version is downloaded, its signature checked against the public key in tauri.conf.json,
// installed, and the app started again. This signature is the updater's own (a free key pair),
// apart from macOS or Windows code signing.
use crate::app::push_event;
use crate::i18n;
use serde_json::{Value, json};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

/// The update found by the last check, kept until it is installed.
#[derive(Default)]
pub struct Found(Mutex<Option<Update>>);

/// Asks for the latest release. Returns {version, notes} when it is newer than this app, or null.
pub fn check(app: &AppHandle) -> Result<Value, String> {
    let updater = app.updater().map_err(|_| i18n::t("update.check_failed"))?;
    let update = tauri::async_runtime::block_on(updater.check()).map_err(|_| i18n::t("update.check_failed"))?;
    let found = update.as_ref().map(|u| json!({"version": u.version, "notes": u.body}));
    *app.state::<Found>().0.lock().unwrap() = update;
    Ok(found.unwrap_or(Value::Null))
}

/// Downloads and installs the update found by `check`, then starts the new version.
pub fn install(app: &AppHandle) -> Result<Value, String> {
    let update = app
        .state::<Found>()
        .0
        .lock()
        .unwrap()
        .take()
        .ok_or_else(|| i18n::t("update.none"))?;
    tauri::async_runtime::block_on(update.download_and_install(|_, _| {}, || {}))
        .map_err(|_| i18n::t("update.install_failed"))?;
    crate::app::flush(app);
    app.restart();
}

/// A quiet look for a newer version a while after start; the page is told only when there is one.
/// Not in development builds or e2e runs, which have nothing to update to.
pub fn check_later(app: &AppHandle) {
    if cfg!(debug_assertions) || crate::commands::e2e_mode() {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(20));
        if let Ok(found) = check(&app)
            && !found.is_null()
        {
            push_event(&app, &json!({"type": "update", "update": found}));
        }
    });
}
