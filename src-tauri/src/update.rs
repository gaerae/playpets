// Updates of the app itself: the latest release's latest.json (GitHub) is checked, and a newer
// version is downloaded, its signature checked against the public key in tauri.conf.json,
// installed, and the app started again. This signature is the updater's own (a free key pair),
// apart from macOS or Windows code signing.
use crate::app::push_event;
use crate::i18n;
use serde_json::{Value, json};
use std::sync::{Condvar, Mutex};
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

/// The update found by the last check, kept until it is installed.
#[derive(Default)]
pub struct Found {
    state: Mutex<UpdateState>,
    checked: Condvar,
}

#[derive(Default)]
struct UpdateState {
    update: Option<Update>,
    checking: bool,
    installing: bool,
    result: Option<Result<Value, String>>,
}

impl UpdateState {
    fn available(&self) -> Value {
        self.update
            .as_ref()
            .map(|u| json!({"version": u.version, "notes": u.body}))
            .unwrap_or(Value::Null)
    }
}

/// Asks for the latest release. Returns {version, notes} when it is newer than this app, or null.
pub fn check(app: &AppHandle) -> Result<Value, String> {
    if store_managed() {
        return Ok(json!({"channel": "store"}));
    }
    let found = app.state::<Found>();
    {
        let mut state = crate::app::hold(&found.state);
        if state.installing {
            return Ok(state.available());
        }
        if state.checking {
            while state.checking {
                state = found.checked.wait(state).unwrap_or_else(|error| error.into_inner());
            }
            return state.result.clone().unwrap_or_else(|| Ok(state.available()));
        }
        state.checking = true;
    }
    // Concurrent manual and scheduled checks share one response. No state lock crosses network IO.
    // Bound a stalled feed request so waiting actions recover and the scheduler can retry.
    let result = (|| {
        let updater = app
            .updater_builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|_| i18n::t("update.check_failed"))?;
        tauri::async_runtime::block_on(updater.check()).map_err(|error| match error {
            tauri_plugin_updater::Error::ReleaseNotFound => i18n::t("update.no_release"),
            _ => i18n::t("update.check_failed"),
        })
    })();
    let response;
    {
        let mut state = crate::app::hold(&found.state);
        response = match result {
            Ok(update) => {
                state.update = update;
                Ok(state.available())
            }
            Err(error) => Err(error),
        };
        state.result = Some(response.clone());
        state.checking = false;
        found.checked.notify_all();
    }
    crate::tray::retitle(app);
    response
}

/// The version the last check found, while it waits to be installed.
pub fn found_version(app: &AppHandle) -> Option<String> {
    let found = app.try_state::<Found>()?;
    let state = crate::app::hold(&found.state);
    state.update.as_ref().map(|u| u.version.clone())
}

const DOWNLOAD_LIMIT: std::time::Duration = std::time::Duration::from_secs(20 * 60);

/// Downloads and installs the update found by `check`, then starts the new version.
pub fn install(app: &AppHandle) -> Result<Value, String> {
    if store_managed() {
        return Err(i18n::t("update.store_managed"));
    }
    let found = app.state::<Found>();
    let update = {
        let mut state = crate::app::hold(&found.state);
        while state.checking {
            state = found.checked.wait(state).unwrap_or_else(|error| error.into_inner());
        }
        if state.installing {
            return Err(i18n::t("update.none"));
        }
        let mut update = state.update.clone().ok_or_else(|| i18n::t("update.none"))?;
        state.installing = true;
        // The found update does not carry the check's timeout, and a stalled download would keep
        // the page on "downloading" with no way to try again. The limit is for the whole download,
        // so it is long enough for a slow connection.
        update.timeout = Some(DOWNLOAD_LIMIT);
        update
    };
    push_event(app, &json!({"type": "update-status", "phase": "downloading"}));
    // The page shows meaningful steps rather than repainting for every network chunk.
    let (mut received, mut shown) = (0u64, 0u64);
    let progress = |chunk: usize, total: Option<u64>| {
        received += chunk as u64;
        if let Some(total) = total.filter(|t| *t > 0) {
            let percent = (received.saturating_mul(100) / total).min(100);
            if percent >= shown + 5 || percent == 100 {
                shown = percent;
                push_event(
                    app,
                    &json!({"type": "update-status", "phase": "downloading", "percent": percent}),
                );
            }
        }
    };
    // `download` checks the signature before returning. Its finish callback fires before that check.
    let bytes = tauri::async_runtime::block_on(update.download(progress, || {
        push_event(app, &json!({"type": "update-status", "phase": "verifying"}));
    }));
    let result = bytes.and_then(|bytes| {
        push_event(app, &json!({"type": "update-status", "phase": "installing"}));
        // On Windows the installer can exit this process, so save before handing control to it.
        crate::app::flush(app);
        update.install(bytes)
    });
    // Keep the selected release stable while downloading, so periodic checks cannot replace it.
    if result.is_err() {
        crate::app::hold(&found.state).installing = false;
        // The tray names the update again (it may have been rebuilt while this one was taken).
        crate::tray::rebuild(app);
        return Err(i18n::t("update.install_failed"));
    }
    app.restart();
}

fn next_check_delay(failures: u32) -> std::time::Duration {
    std::time::Duration::from_secs(match failures {
        1 => 5 * 60,
        2 => 15 * 60,
        3 => 60 * 60,
        _ => 6 * 60 * 60,
    })
}

/// A quiet look for a newer version a while after start; the page is told only when there is one.
/// Not in development builds or e2e runs, which have nothing to update to.
pub fn check_later(app: &AppHandle) {
    if store_managed() || cfg!(debug_assertions) || crate::commands::e2e_mode() {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(20));
        let mut failures = 0u32;
        let mut announced = None;
        loop {
            match check(&app) {
                Ok(found) => {
                    failures = 0;
                    let version = found.get("version").and_then(Value::as_str);
                    if version.is_some() && version != announced.as_deref() {
                        announced = version.map(str::to_owned);
                        push_event(&app, &json!({"type": "update", "update": found}));
                    }
                }
                Err(_) => failures = failures.saturating_add(1),
            }
            std::thread::sleep(next_check_delay(failures));
        }
    });
}

/// MSIX updates belong to the package manager, even when installed for local testing.
/// An unexpected identity API error also keeps an EXE installer out of a packaged app.
pub fn store_managed() -> bool {
    #[cfg(windows)]
    {
        use windows_sys::Win32::Storage::Packaging::Appx::GetCurrentPackageFullName;
        let mut length = 0;
        // A null buffer asks only for identity size; it does not touch package state.
        let result = unsafe { GetCurrentPackageFullName(&mut length, std::ptr::null_mut()) };
        result != windows_sys::Win32::Foundation::APPMODEL_ERROR_NO_PACKAGE
    }
    #[cfg(not(windows))]
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checks_repeat_with_bounded_failure_backoff() {
        assert_eq!(next_check_delay(0).as_secs(), 6 * 60 * 60);
        assert_eq!(next_check_delay(1).as_secs(), 5 * 60);
        assert_eq!(next_check_delay(2).as_secs(), 15 * 60);
        assert_eq!(next_check_delay(3).as_secs(), 60 * 60);
        assert_eq!(next_check_delay(4).as_secs(), 6 * 60 * 60);
        assert_eq!(next_check_delay(u32::MAX).as_secs(), 6 * 60 * 60);
    }
}
