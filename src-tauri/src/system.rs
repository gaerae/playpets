// Handing a folder or a web address to the system: the file manager opens the one, the
// browser the other.
use crate::i18n;
use std::ffi::OsStr;
use std::path::Path;

pub fn open_folder(folder: &Path) -> Result<(), String> {
    open(folder.as_os_str(), true).map_err(|_| i18n::t("error.open_folder"))
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
    // Waited for on a thread of its own, so it does not stay behind as a finished (zombie) process.
    let mut child = cmd.arg(target).spawn().map_err(|_| ())?;
    std::thread::spawn(move || child.wait());
    Ok(())
}
