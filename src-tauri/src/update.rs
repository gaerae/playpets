// Updates of the app itself: the latest release's latest.json (GitHub) is checked, and a newer
// version is downloaded, its signature checked against the public key in tauri.conf.json,
// installed, and the app started again. This signature is the updater's own (a free key pair),
// apart from macOS or Windows code signing. A Microsoft Store installation asks the Store instead,
// and has the Store download and install it, with the same stages shown; its Store page opens
// where the Store cannot do that from the app.
use crate::app::push_event;
use crate::i18n;
use serde_json::{Value, json};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Condvar, Mutex};
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

/// The update found by the last check, kept until it is installed.
#[derive(Default)]
pub struct Found {
    state: Mutex<UpdateState>,
    checked: Condvar,
    /// Set by the person's Cancel while a download runs.
    cancel: AtomicBool,
}

#[derive(Default)]
struct UpdateState {
    update: Option<Update>,
    checking: bool,
    installing: bool,
    result: Option<Result<Value, String>>,
    /// The version waiting in Microsoft Store, for a Store installation.
    store: Option<String>,
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
        return check_store(app);
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

/// Asks Microsoft Store whether it has a newer package of this app. The answer comes from the
/// Store's own catalogue, so a GitHub release still in certification is not announced too early.
fn check_store(app: &AppHandle) -> Result<Value, String> {
    // An e2e run makes no network request; its test package is not in the Store's catalogue anyway.
    let version = if crate::commands::e2e_mode() {
        None
    } else {
        store::waiting_version(app).map_err(|()| i18n::t("update.check_failed"))?
    };
    crate::app::hold(&app.state::<Found>().state).store = version.clone();
    crate::tray::retitle(app);
    Ok(match version {
        Some(version) => json!({"channel": "store", "version": version}),
        None => json!({"channel": "store"}),
    })
}

/// The version the last check found, while it waits to be installed.
pub fn found_version(app: &AppHandle) -> Option<String> {
    let found = app.try_state::<Found>()?;
    let state = crate::app::hold(&found.state);
    state
        .update
        .as_ref()
        .map(|u| u.version.clone())
        .or_else(|| state.store.clone())
}

const DOWNLOAD_LIMIT: std::time::Duration = std::time::Duration::from_secs(20 * 60);

/// Calls off the download under way; once its bytes are being installed it is too late.
pub fn cancel(app: &AppHandle) {
    let found = app.state::<Found>();
    if crate::app::hold(&found.state).installing {
        found.cancel.store(true, Ordering::SeqCst);
    }
}

/// Waits for a task, ending it as soon as `cancel` is set. None when it did not finish.
fn unless_called_off<T: Send + 'static>(task: JoinHandle<T>, cancel: &AtomicBool) -> Option<T> {
    while !task.inner().is_finished() {
        if cancel.load(Ordering::SeqCst) {
            task.abort();
            return None;
        }
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
    tauri::async_runtime::block_on(task).ok()
}

/// The page's progress (`update-status`), each phase once and a percent only every 5 points (and
/// at 100), so the page is not repainted for every network chunk.
#[derive(Default)]
struct Steps {
    phase: &'static str,
    percent: Option<u64>,
}

impl Steps {
    fn next(&mut self, phase: &'static str, percent: Option<u64>) -> Option<Value> {
        if phase == self.phase {
            let new = percent?;
            if self
                .percent
                .is_some_and(|shown| new <= shown || (new < shown + 5 && new < 100))
            {
                return None;
            }
        }
        self.phase = phase;
        self.percent = percent;
        Some(match percent {
            Some(percent) => json!({"type": "update-status", "phase": phase, "percent": percent}),
            None => json!({"type": "update-status", "phase": phase}),
        })
    }
}

/// Where a Store update has got to, as the page's phases. The Store counts its download as the first
/// 80% of the progress and the install as the rest.
fn store_stage(progress: f64) -> (&'static str, Option<u64>) {
    const DOWNLOADED: f64 = 0.8;
    // A NaN counts as nothing downloaded yet.
    let progress = if progress.is_nan() { 0.0 } else { progress };
    if progress < DOWNLOADED {
        ("downloading", Some((progress.max(0.0) / DOWNLOADED * 100.0) as u64))
    } else {
        ("installing", None)
    }
}

/// How a Store update the app asked for ended, when this copy is still running to hear it.
/// Only Windows has a Store to make one.
#[cfg_attr(not(windows), allow(dead_code))]
pub enum StoreEnd {
    /// Installed without closing this copy: the new version is there once it is opened again.
    Installed,
    /// The person declined Windows' question, or pressed Cancel while it downloaded.
    Cancelled,
    /// The Store would not do it from here (Wi-Fi only, low battery, an error).
    Declined,
}

/// Has Microsoft Store download and install the version it has. Windows closes the app to install it
/// and opens it again (reopen_after_store_update). Where the Store will not do it from here, its
/// page opens, where the person can.
fn install_from_store(app: &AppHandle) -> Result<Value, String> {
    let found = app.state::<Found>();
    {
        let mut state = crate::app::hold(&found.state);
        if state.store.is_none() || state.installing {
            return Err(i18n::t("update.none"));
        }
        state.installing = true;
        found.cancel.store(false, Ordering::SeqCst);
    }
    let mut steps = Steps::default();
    if let Some(event) = steps.next("downloading", None) {
        push_event(app, &event);
    }
    let status = app.clone();
    let end = store::download_and_install(app, move |progress| {
        let (phase, percent) = store_stage(progress);
        if let Some(event) = steps.next(phase, percent) {
            push_event(&status, &event);
        }
    });
    crate::app::hold(&found.state).installing = false;
    crate::tray::rebuild(app);
    match end {
        Ok(StoreEnd::Installed) => {
            crate::app::hold(&found.state).store = None;
            crate::tray::retitle(app);
            Ok(json!({"installed": true}))
        }
        Ok(StoreEnd::Cancelled) => Ok(json!({"cancelled": true})),
        Ok(StoreEnd::Declined) | Err(()) => {
            crate::system::open_url(&store::page()?)?;
            Ok(json!({"store": "page"}))
        }
    }
}

/// Downloads and installs the update found by `check`, then starts the new version.
pub fn install(app: &AppHandle) -> Result<Value, String> {
    if store_managed() {
        return install_from_store(app);
    }
    // Opened straight from the disk image, the app sits where nothing can be replaced, and the
    // download would only end in a failure that trying again cannot fix.
    #[cfg(target_os = "macos")]
    if let Ok(exe) = std::env::current_exe()
        && app_bundle(&exe).is_some_and(read_only)
    {
        return Err(i18n::t("update.move_to_applications"));
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
        found.cancel.store(false, Ordering::SeqCst);
        // The found update does not carry the check's timeout, and a stalled download would keep
        // the page on "downloading" with no way to try again. The limit is for the whole download,
        // so it is long enough for a slow connection.
        update.timeout = Some(DOWNLOAD_LIMIT);
        update
    };
    let mut steps = Steps::default();
    if let Some(event) = steps.next("downloading", None) {
        push_event(app, &event);
    }
    let mut received = 0u64;
    let (status, verifying) = (app.clone(), app.clone());
    let progress = move |chunk: usize, total: Option<u64>| {
        received += chunk as u64;
        if let Some(total) = total.filter(|t| *t > 0) {
            let percent = (received.saturating_mul(100) / total).min(100);
            if let Some(event) = steps.next("downloading", Some(percent)) {
                push_event(&status, &event);
            }
        }
    };
    let download = update.clone();
    // `download` checks the signature before returning. Its finish callback fires before that check.
    let downloading = tauri::async_runtime::spawn(async move {
        download
            .download(progress, move || {
                push_event(&verifying, &json!({"type": "update-status", "phase": "verifying"}));
            })
            .await
    });
    let bytes = unless_called_off(downloading, &found.cancel);
    let cancelled = found.cancel.load(Ordering::SeqCst);
    let installed = bytes.is_some_and(|bytes| {
        bytes
            .and_then(|bytes| {
                push_event(app, &json!({"type": "update-status", "phase": "installing"}));
                // On Windows the installer can exit this process, so save before handing control to it.
                crate::app::flush(app);
                update.install(bytes)
            })
            .is_ok()
    });
    // Keep the selected release stable while downloading, so periodic checks cannot replace it.
    if !installed {
        crate::app::hold(&found.state).installing = false;
        // The tray names the update again (it may have been rebuilt while this one was taken).
        crate::tray::rebuild(app);
        return if cancelled {
            Ok(json!({"cancelled": true}))
        } else {
            Err(i18n::t("update.install_failed"))
        };
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
/// Not in development builds or e2e runs, which have nothing to update to. A Store installation
/// asks the Store on the same schedule, because the Store says nothing in the app on its own.
pub fn check_later(app: &AppHandle) {
    if cfg!(debug_assertions) || crate::commands::e2e_mode() {
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

/// Microsoft Store closes a running app to install its update, and starts it again only if the app
/// asked for that. Asked for that alone: not after a crash, a hang or a restart for Windows Update.
pub fn reopen_after_store_update() {
    #[cfg(windows)]
    if store_managed() && !crate::commands::e2e_mode() {
        use windows_sys::Win32::System::Recovery::{
            RESTART_NO_CRASH, RESTART_NO_HANG, RESTART_NO_REBOOT, RegisterApplicationRestart,
        };
        // No arguments: it comes back as an ordinary start, with the yard showing the update.
        unsafe {
            RegisterApplicationRestart(std::ptr::null(), RESTART_NO_CRASH | RESTART_NO_HANG | RESTART_NO_REBOOT);
        }
    }
}

/// The .app bundle an executable belongs to.
#[cfg(target_os = "macos")]
fn app_bundle(exe: &std::path::Path) -> Option<&std::path::Path> {
    exe.ancestors()
        .find(|path| path.extension().is_some_and(|ext| ext == "app"))
}

/// Whether the volume holding a path cannot be written: an opened disk image, or the read-only
/// copy macOS runs an app from when it was never moved out of its download (App Translocation).
#[cfg(target_os = "macos")]
fn read_only(path: &std::path::Path) -> bool {
    use std::os::unix::ffi::OsStrExt;
    let Ok(path) = std::ffi::CString::new(path.as_os_str().as_bytes()) else {
        return false;
    };
    // SAFETY: statvfs only writes into the zeroed struct it is given.
    let mut volume: libc::statvfs = unsafe { std::mem::zeroed() };
    unsafe { libc::statvfs(path.as_ptr(), &mut volume) == 0 && volume.f_flag & libc::ST_RDONLY != 0 }
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

/// What Microsoft Store has for this package.
#[cfg(windows)]
mod store {
    use crate::i18n;
    use std::sync::atomic::{AtomicBool, Ordering};
    use tauri::{AppHandle, Manager};
    use windows::ApplicationModel::Package;
    use windows::Services::Store::{StoreContext, StorePackageUpdateState, StorePackageUpdateStatus};
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::Shell::IInitializeWithWindow;
    use windows::core::Interface;
    use windows_future::{AsyncOperationProgressHandler, AsyncStatus};

    /// The Store answers over the network, and a stalled answer must not hold a check forever.
    const ANSWER_LIMIT: std::time::Duration = std::time::Duration::from_secs(30);

    /// The newer version of this app the Store has, as 1.2.3 (the package's fourth part is
    /// always 0), or None when there is none.
    pub fn waiting_version(app: &AppHandle) -> Result<Option<String>, ()> {
        let owner = owner(app);
        let (sent, answer) = std::sync::mpsc::channel();
        // On a thread of its own: Windows may need the calling thread to finish the operation.
        std::thread::spawn(move || {
            let _ = sent.send(ask(owner));
        });
        answer.recv_timeout(ANSWER_LIMIT).map_err(|_| ())?.map_err(|_| ())
    }

    /// The main window's handle, as a value: a handle is not Send, and the Store is asked on a
    /// thread of its own.
    fn owner(app: &AppHandle) -> Option<isize> {
        app.get_webview_window("main")
            .and_then(|window| window.hwnd().ok())
            .map(|hwnd| hwnd.0 as isize)
    }

    fn context(owner: Option<isize>) -> windows::core::Result<StoreContext> {
        let context = StoreContext::GetDefault()?;
        // A desktop app's StoreContext needs an owner window, or Microsoft says it may answer
        // with wrong data or errors, even for a call that shows no dialog. Windows' question
        // before an install is shown over it.
        if let Some(owner) = owner {
            unsafe {
                context
                    .cast::<IInitializeWithWindow>()?
                    .Initialize(HWND(owner as *mut _))?
            };
        }
        Ok(context)
    }

    fn ask(owner: Option<isize>) -> windows::core::Result<Option<String>> {
        let context = context(owner)?;
        let updates = context.GetAppAndOptionalStorePackageUpdatesAsync()?.join()?;
        // The list can also hold optional packages; only this app's own package counts.
        let own = Package::Current()?.Id()?.FamilyName()?;
        for index in 0..updates.Size()? {
            let id = updates.GetAt(index)?.Package()?.Id()?;
            if id.FamilyName()? == own {
                let v = id.Version()?;
                return Ok(Some(format!("{}.{}.{}", v.Major, v.Minor, v.Build)));
            }
        }
        Ok(None)
    }

    /// Asks the Store to download and install this app's waiting version, telling `progress` how
    /// far it has got (0 to 1, the Store's own measure). Windows asks the person first. Err when the
    /// Store could not be asked at all.
    pub fn download_and_install(
        app: &AppHandle,
        progress: impl FnMut(f64) + Send + 'static,
    ) -> Result<super::StoreEnd, ()> {
        let (owner, app) = (owner(app), app.clone());
        let (sent, answer) = std::sync::mpsc::channel();
        // On a thread of its own, as `waiting_version`. No time limit: a slow download takes what it
        // takes, and Cancel ends it.
        std::thread::spawn(move || {
            let cancel = &app.state::<super::Found>().cancel;
            let _ = sent.send(request(owner, progress, cancel));
        });
        answer.recv().map_err(|_| ())?.map_err(|_| ())
    }

    fn request(
        owner: Option<isize>,
        progress: impl FnMut(f64) + Send + 'static,
        cancel: &AtomicBool,
    ) -> windows::core::Result<super::StoreEnd> {
        use super::StoreEnd;
        let context = context(owner)?;
        let updates = context.GetAppAndOptionalStorePackageUpdatesAsync()?.join()?;
        if updates.Size()? == 0 {
            return Ok(StoreEnd::Declined);
        }
        let own = Package::Current()?.Id()?.FamilyName()?;
        let progress = std::sync::Mutex::new(progress);
        let operation = context.RequestDownloadAndInstallStorePackageUpdatesAsync(&updates)?;
        operation.SetProgress(&AsyncOperationProgressHandler::new(move |_, status| {
            let status: &StorePackageUpdateStatus = &status;
            if status.PackageFamilyName == own {
                (crate::app::hold(&progress))(status.PackageDownloadProgress);
            }
            Ok(())
        }))?;
        let mut called_off = false;
        loop {
            match operation.Status()? {
                AsyncStatus::Started => {
                    if !called_off && cancel.load(Ordering::SeqCst) {
                        called_off = true;
                        operation.Cancel()?;
                    }
                    std::thread::sleep(std::time::Duration::from_millis(50));
                }
                AsyncStatus::Completed => break,
                AsyncStatus::Canceled => return Ok(StoreEnd::Cancelled),
                _ => return Ok(StoreEnd::Declined),
            }
        }
        let state = operation.GetResults()?.OverallState()?;
        Ok(if state == StorePackageUpdateState::Completed {
            StoreEnd::Installed
        } else if state == StorePackageUpdateState::Canceled {
            StoreEnd::Cancelled
        } else {
            StoreEnd::Declined
        })
    }

    /// This app's page in the Store app, found by the package family name rather than a product
    /// ID kept in code.
    pub fn page() -> Result<String, String> {
        let family = Package::Current()
            .and_then(|package| package.Id()?.FamilyName())
            .map_err(|_| i18n::t("error.open_browser"))?;
        Ok(format!("ms-windows-store://pdp/?PFN={family}"))
    }
}

/// Only a Windows package has a Store.
#[cfg(not(windows))]
mod store {
    pub fn waiting_version(_: &tauri::AppHandle) -> Result<Option<String>, ()> {
        Ok(None)
    }
    pub fn page() -> Result<String, String> {
        Err(crate::i18n::t("error.open_browser"))
    }
    pub fn download_and_install(
        _: &tauri::AppHandle,
        _: impl FnMut(f64) + Send + 'static,
    ) -> Result<super::StoreEnd, ()> {
        Err(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn calling_off_ends_a_task_that_would_never_finish() {
        let cancel = std::sync::Arc::new(AtomicBool::new(false));
        let flag = cancel.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(50));
            flag.store(true, Ordering::SeqCst);
        });
        let stuck = tauri::async_runtime::spawn(std::future::pending::<u8>());
        assert_eq!(unless_called_off(stuck, &cancel), None);
        let done = tauri::async_runtime::spawn(async { 7u8 });
        assert_eq!(unless_called_off(done, &AtomicBool::new(false)), Some(7));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn the_app_bundle_is_found_above_its_executable() {
        use std::path::Path;
        let exe = Path::new("/Volumes/PlayPets/PlayPets.app/Contents/MacOS/playpets");
        assert_eq!(app_bundle(exe), Some(Path::new("/Volumes/PlayPets/PlayPets.app")));
        assert_eq!(app_bundle(Path::new("/usr/bin/playpets")), None);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn a_writable_folder_is_not_read_only() {
        assert!(!read_only(&std::env::temp_dir()));
    }

    #[test]
    fn progress_shows_each_phase_once_and_a_percent_every_five_points() {
        let mut steps = Steps::default();
        let shown = |steps: &mut Steps, phase, percent| steps.next(phase, percent).map(|e| e["percent"].clone());
        assert_eq!(shown(&mut steps, "downloading", None), Some(Value::Null));
        assert_eq!(
            shown(&mut steps, "downloading", None),
            None,
            "the same phase again says nothing"
        );
        assert_eq!(shown(&mut steps, "downloading", Some(0)), Some(json!(0)));
        assert_eq!(shown(&mut steps, "downloading", Some(4)), None);
        assert_eq!(shown(&mut steps, "downloading", Some(5)), Some(json!(5)));
        assert_eq!(shown(&mut steps, "downloading", Some(3)), None, "it never goes back");
        assert_eq!(shown(&mut steps, "downloading", Some(99)), Some(json!(99)));
        assert_eq!(shown(&mut steps, "downloading", Some(100)), Some(json!(100)));
        assert_eq!(shown(&mut steps, "downloading", Some(100)), None);
        assert_eq!(shown(&mut steps, "installing", None), Some(Value::Null));
        assert_eq!(shown(&mut steps, "installing", None), None);
    }

    #[test]
    fn the_stores_progress_is_downloading_to_eighty_percent_then_installing() {
        assert_eq!(store_stage(0.0), ("downloading", Some(0)));
        assert_eq!(store_stage(0.4), ("downloading", Some(50)));
        assert_eq!(store_stage(0.79), ("downloading", Some(98)));
        assert_eq!(store_stage(0.8), ("installing", None));
        assert_eq!(store_stage(1.0), ("installing", None));
        assert_eq!(store_stage(f64::NAN), ("downloading", Some(0)));
        assert_eq!(store_stage(-1.0), ("downloading", Some(0)));
    }

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
