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
    // No network says so; a reachable address without update information (no release yet, or one
    // published without the signing secrets) is told apart, so nobody checks a working connection.
    let update = tauri::async_runtime::block_on(updater.check()).map_err(|e| match e {
        tauri_plugin_updater::Error::ReleaseNotFound => i18n::t("update.no_release"),
        _ => i18n::t("update.check_failed"),
    })?;
    let found = update.as_ref().map(|u| json!({"version": u.version, "notes": u.body}));
    *crate::app::hold(&app.state::<Found>().0) = update;
    // The tray's update item names the version once there is one.
    crate::tray::retitle(app);
    Ok(found.unwrap_or(Value::Null))
}

/// The version the last check found, while it waits to be installed.
pub fn found_version(app: &AppHandle) -> Option<String> {
    let found = app.try_state::<Found>()?;
    let update = crate::app::hold(&found.0);
    update.as_ref().map(|u| u.version.clone())
}

/// Downloads and installs the update found by `check`, then starts the new version.
pub fn install(app: &AppHandle) -> Result<Value, String> {
    let update = crate::app::hold(&app.state::<Found>().0)
        .take()
        .ok_or_else(|| i18n::t("update.none"))?;
    // The page shows how much has come down, a step at a time rather than for every chunk.
    let (mut received, mut shown) = (0u64, 0u64);
    let progress = |chunk: usize, total: Option<u64>| {
        received += chunk as u64;
        if let Some(total) = total.filter(|t| *t > 0) {
            let percent = (received * 100 / total).min(100);
            if percent >= shown + 5 || percent == 100 {
                shown = percent;
                push_event(app, &json!({"type": "update-progress", "percent": percent}));
            }
        }
    };
    // Taken while it installs (a second press finds nothing to start); a failed download or
    // signature check puts it back, so the person can try again.
    if tauri::async_runtime::block_on(update.download_and_install(progress, || {})).is_err() {
        *crate::app::hold(&app.state::<Found>().0) = Some(update);
        // The tray names the update again (it may have been rebuilt while this one was taken).
        crate::tray::rebuild(app);
        return Err(i18n::t("update.install_failed"));
    }
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
