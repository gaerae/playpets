// Handing a folder or a web address to the system: the file manager opens the one, the
// browser the other.
use crate::i18n;
use std::ffi::OsStr;
use std::path::{Path, PathBuf};

pub fn open_folder(folder: &Path) -> Result<(), String> {
    open(outside_view(folder).as_os_str(), true).map_err(|_| i18n::t("error.open_folder"))
}

/// Where the file manager finds a folder the app sees. Installed from an MSIX package (the
/// Store), the folders the app makes under AppData are kept in the package's own LocalCache and
/// only look like AppData from inside it: Explorer, outside the package, would find nothing there.
pub fn outside_view(folder: &Path) -> PathBuf {
    #[cfg(windows)]
    if let (Some(family), Some(roaming), Some(local)) = (
        package_family(),
        std::env::var_os("APPDATA"),
        std::env::var_os("LOCALAPPDATA"),
    ) && let Some(cache) = redirected(
        &folder.to_string_lossy(),
        &roaming.to_string_lossy(),
        &local.to_string_lossy(),
        family,
    )
    .map(PathBuf::from)
    .filter(|p| p.is_dir())
    {
        return cache;
    }
    folder.to_path_buf()
}

/// The package family name (`Name_publisherhash`), or None for an app that is not packaged.
#[cfg(windows)]
fn package_family() -> Option<&'static str> {
    use windows_sys::Win32::Foundation::ERROR_SUCCESS;
    use windows_sys::Win32::Storage::Packaging::Appx::GetCurrentPackageFamilyName;
    static FAMILY: std::sync::OnceLock<Option<String>> = std::sync::OnceLock::new();
    FAMILY
        .get_or_init(|| {
            let mut length = 0u32;
            unsafe { GetCurrentPackageFamilyName(&mut length, std::ptr::null_mut()) };
            if length == 0 {
                return None;
            }
            let mut name = vec![0u16; length as usize];
            if unsafe { GetCurrentPackageFamilyName(&mut length, name.as_mut_ptr()) } != ERROR_SUCCESS {
                return None;
            }
            name.truncate(length.saturating_sub(1) as usize);
            Some(String::from_utf16_lossy(&name))
        })
        .as_deref()
}

/// A folder under Roaming or Local AppData, as `<Local>\Packages\<family>\LocalCache\<Roaming|Local>\…`.
/// Windows compares paths without case.
#[cfg_attr(not(windows), allow(dead_code))]
fn redirected(folder: &str, roaming: &str, local: &str, family: &str) -> Option<String> {
    let under = |base: &str| {
        let base = base.trim_end_matches('\\');
        let head = folder.get(..base.len())?;
        let rest = &folder[base.len()..];
        (!base.is_empty() && head.eq_ignore_ascii_case(base) && (rest.is_empty() || rest.starts_with('\\')))
            .then_some(rest)
    };
    let cache = format!(r"{}\Packages\{family}\LocalCache", local.trim_end_matches('\\'));
    if under(&cache).is_some() {
        return None;
    }
    under(roaming)
        .map(|rest| format!(r"{cache}\Roaming{rest}"))
        .or_else(|| under(local).map(|rest| format!(r"{cache}\Local{rest}")))
}

pub fn open_url(url: &str) -> Result<(), String> {
    open(OsStr::new(url), false).map_err(|_| i18n::t("error.open_browser"))
}

/// The shell's own "open", as a double-click in Explorer does it: it takes a folder path in
/// either slash spelling and a URL alike, and unlike an `explorer`/`rundll32` child it reports
/// failure. Anything above 32 is success.
#[cfg(target_os = "windows")]
fn open(target: &OsStr, _folder: bool) -> Result<(), ()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
    let wide = |s: &OsStr| s.encode_wide().chain(std::iter::once(0)).collect::<Vec<u16>>();
    let verb = wide(OsStr::new("open"));
    let file = wide(target);
    let handle = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            verb.as_ptr(),
            file.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            SW_SHOWNORMAL,
        )
    };
    if handle as isize > 32 { Ok(()) } else { Err(()) }
}

#[cfg(not(target_os = "windows"))]
fn open(target: &OsStr, folder: bool) -> Result<(), ()> {
    let program = if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
    let mut cmd = std::process::Command::new(program);
    // On macOS `open` runs a folder that is a package (Something.app, .prefPane, .pkg, .workflow…)
    // instead of showing it, and a pet folder can be called anything: a folder is always revealed
    // in Finder, selected in the folder that holds it.
    if cfg!(target_os = "macos") && folder {
        cmd.arg("-R");
    }
    #[cfg(target_os = "linux")]
    if let Some(name) = crate::window::renderer_switch_set_here() {
        cmd.env_remove(name);
    }
    // Waited for on a thread of its own, so it does not stay behind as a finished (zombie) process.
    let mut child = cmd.arg(target).spawn().map_err(|_| ())?;
    std::thread::spawn(move || child.wait());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const ROAMING: &str = r"C:\Users\me\AppData\Roaming";
    const LOCAL: &str = r"C:\Users\me\AppData\Local";
    const FAMILY: &str = "gaerae.PlayPets_abc123";

    #[test]
    fn a_packaged_apps_new_appdata_folder_is_opened_where_windows_keeps_it() {
        let cache = r"C:\Users\me\AppData\Local\Packages\gaerae.PlayPets_abc123\LocalCache";
        assert_eq!(
            redirected(r"C:\Users\me\AppData\Roaming\app.playpets\pets", ROAMING, LOCAL, FAMILY),
            Some(format!(r"{cache}\Roaming\app.playpets\pets"))
        );
        // Windows paths ignore case, and a trailing separator on the base changes nothing.
        assert_eq!(
            redirected(
                r"c:\users\me\appdata\roaming\app.playpets",
                r"C:\Users\me\AppData\Roaming\",
                LOCAL,
                FAMILY
            ),
            Some(format!(r"{cache}\Roaming\app.playpets"))
        );
        assert_eq!(
            redirected(r"C:\Users\me\AppData\Local\app.playpets", ROAMING, LOCAL, FAMILY),
            Some(format!(r"{cache}\Local\app.playpets"))
        );
    }

    #[test]
    fn folders_outside_appdata_or_already_in_the_package_are_left_alone() {
        for folder in [
            r"C:\Users\me\.codex\pets",
            r"C:\Program Files\WindowsApps\gaerae.PlayPets_1.4.0.0_x64__abc123\pets",
            r"C:\Users\me\AppData\RoamingElse\pets",
            r"C:\Users\me\AppData\Local\Packages\gaerae.PlayPets_abc123\LocalCache\Roaming\app.playpets",
        ] {
            assert_eq!(redirected(folder, ROAMING, LOCAL, FAMILY), None, "{folder}");
        }
    }
}
