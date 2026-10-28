// Starting with the person's sign-in. The autostart plugin keeps the answer where each system
// looks (a login item on macOS, the Run key on Windows, an autostart entry on Linux). A Microsoft
// Store package gets its own private copy of the registry that Windows never reads at sign-in, so
// there the package's startup task (AppxManifest.xml, TaskId "PlayPets") is the switch instead.
use crate::i18n;
use tauri::AppHandle;

/// The argument the autostart plugin starts the app with at login.
pub const AUTOSTART_ARG: &str = "--autostart";

/// Whether this launch came from the person's sign-in: the plugin's argument, or the package's
/// startup task, which passes none.
pub fn at_login(args: &[String]) -> bool {
    args.iter().any(|a| a == AUTOSTART_ARG) || (crate::update::store_managed() && task::started_us())
}

/// Whether the app now starts at sign-in.
pub fn is_enabled(app: &AppHandle) -> bool {
    if crate::update::store_managed() {
        return task::state().is_some_and(|state| switch(state).is_ok_and(|on| on));
    }
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().unwrap_or(false)
}

/// Turns starting at sign-in on or off, and says where it stands afterwards.
pub fn set(app: &AppHandle, on: bool) -> Result<bool, String> {
    if crate::update::store_managed() {
        return task::set(on).map_or_else(|| Err(i18n::t("error.autostart")), |state| answer(on, state));
    }
    use tauri_plugin_autostart::ManagerExt;
    let launcher = app.autolaunch();
    if on { launcher.enable() } else { launcher.disable() }.map_err(|_| i18n::t("error.autostart"))?;
    Ok(launcher.is_enabled().unwrap_or(on))
}

/// A startup task's state (Windows.ApplicationModel.StartupTaskState) as the switch shows it.
/// Err: the person or their organization turned it off in Windows, where only Windows can turn it back on.
fn switch(state: i32) -> Result<bool, &'static str> {
    match state {
        2 | 4 => Ok(true),
        1 => Err("error.autostart_in_settings"),
        3 => Err("error.autostart"),
        _ => Ok(false),
    }
}

/// What the person hears after asking: the new state, or why asking could not turn it on.
fn answer(asked: bool, state: i32) -> Result<bool, String> {
    match switch(state) {
        Ok(on) => Ok(on),
        Err(key) if asked => Err(i18n::t(key)),
        Err(_) => Ok(false),
    }
}

#[cfg(windows)]
mod task {
    use windows::ApplicationModel::Activation::ActivationKind;
    use windows::ApplicationModel::{AppInstance, StartupTask};
    use windows::core::{HSTRING, Result};

    const ID: &str = "PlayPets";

    // Run on a thread of its own: a command is answered on the window's thread, which must not
    // wait on a Windows operation that may need that same thread to finish.
    fn apart<T: Send + 'static>(work: impl FnOnce() -> Result<T> + Send + 'static) -> Option<T> {
        std::thread::spawn(work).join().ok()?.ok()
    }

    fn get() -> Result<StartupTask> {
        StartupTask::GetAsync(&HSTRING::from(ID))?.join()
    }

    pub fn state() -> Option<i32> {
        apart(|| Ok(get()?.State()?.0))
    }

    pub fn set(on: bool) -> Option<i32> {
        apart(move || {
            let task = get()?;
            if on {
                return Ok(task.RequestEnableAsync()?.join()?.0);
            }
            task.Disable()?;
            Ok(task.State()?.0)
        })
    }

    pub fn started_us() -> bool {
        AppInstance::GetActivatedEventArgs()
            .and_then(|args| args.Kind())
            .is_ok_and(|kind| kind == ActivationKind::StartupTask)
    }
}

#[cfg(not(windows))]
mod task {
    pub fn state() -> Option<i32> {
        None
    }
    pub fn set(_on: bool) -> Option<i32> {
        None
    }
    pub fn started_us() -> bool {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_store_switch_follows_the_startup_task() {
        // Disabled, Enabled, EnabledByPolicy.
        assert_eq!(switch(0), Ok(false));
        assert_eq!(switch(2), Ok(true));
        assert_eq!(switch(4), Ok(true));
        assert_eq!(answer(true, 2), Ok(true));
        assert_eq!(answer(false, 0), Ok(false));
        // Turned off in Windows Settings: only there can it come back on, and the person is told where.
        assert_eq!(answer(true, 1), Err(i18n::t("error.autostart_in_settings")));
        assert_eq!(answer(true, 3), Err(i18n::t("error.autostart")));
        // Turning it off when Windows already keeps it off is simply off.
        assert_eq!(answer(false, 1), Ok(false));
        assert_eq!(answer(false, 3), Ok(false));
    }

    #[test]
    fn a_sign_in_launch_is_known_by_its_argument() {
        assert!(at_login(&["playpets".into(), AUTOSTART_ARG.into()]));
        assert!(!at_login(&["playpets".into()]));
    }
}
