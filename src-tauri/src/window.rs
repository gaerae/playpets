// The main window: how it is built, and the commands the page uses to move, size and hide it.
use crate::commands::{arg, text};
use crate::i18n;
use serde_json::{Value, json};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const FULL_SIZE_DEFAULT: (f64, f64) = (1180.0, 850.0);
const FULL_MIN: (f64, f64) = (840.0, 660.0);
const MINI_SIZE: (f64, f64) = (460.0, 320.0);
const MINI_MIN: (f64, f64) = (300.0, 210.0);

fn size((width, height): (f64, f64)) -> LogicalSize<f64> {
    LogicalSize::new(width, height)
}

pub fn build_main(app: &tauri::App, bridge_js: &str) -> tauri::Result<WebviewWindow> {
    let builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title(crate::i18n::t("app.title"))
        .inner_size(FULL_SIZE_DEFAULT.0, FULL_SIZE_DEFAULT.1)
        .min_inner_size(FULL_MIN.0, FULL_MIN.1)
        // The page's own background (--paper), so nothing flashes white before it loads.
        .background_color(tauri::window::Color(0xf7, 0xf9, 0xf8, 0xff))
        .on_navigation(own_page)
        .initialization_script(bridge_js);
    // macOS: the page runs under the title bar, so the bar takes the page's own colour.
    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true)
        .traffic_light_position(tauri::LogicalPosition::new(18.0, 26.0));
    // Elsewhere the system title bar is dropped and the page draws one in the same colours.
    #[cfg(not(target_os = "macos"))]
    let builder = builder.decorations(false);
    builder.build()
}

/// Only the app's own pages load in its windows (tauri://localhost, or http://tauri.localhost
/// where the system serves it so); a link to anywhere else is not followed.
pub fn own_page(url: &tauri::Url) -> bool {
    url.scheme() == "tauri" || url.host_str() == Some("tauri.localhost") || url.scheme() == "about"
}

/// Whether the yard can be seen, as last told to the page.
static SHOWN: AtomicBool = AtomicBool::new(true);

/// Tells the page whether its window can be seen, so it stops drawing while it cannot. macOS
/// tells the page itself (document.hidden); WebView2 may not for a hidden or minimized window.
pub fn shown(app: &AppHandle, visible: bool) {
    if SHOWN.swap(visible, Ordering::SeqCst) != visible {
        crate::app::push_event(app, &json!({"type": "window", "shown": visible}));
    }
}

/// Closing the yard leaves the app in the tray: on macOS the Dock icon goes with the window,
/// so nothing sits in the Dock that does not answer a click.
pub fn hide(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
    shown(app, false);
    #[cfg(target_os = "macos")]
    let _ = app.set_dock_visibility(false);
}

/// Opening the yard brings the Dock icon back with it.
pub fn show(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    let _ = app.set_dock_visibility(true);
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
    shown(app, true);
}

pub fn command(app: &AppHandle, name: &str, args: &[Value]) -> Result<Value, String> {
    let Some(w) = app.get_webview_window("main") else {
        return Ok(Value::Null);
    };
    match name {
        "windowDrag" => {
            let _ = w.start_dragging();
        }
        // Windows and Linux draw their own title bar in the page, so its buttons come through here.
        "windowMinimize" => {
            let _ = w.minimize();
            shown(app, false);
        }
        "windowMaximize" => {
            let _ = if w.is_maximized().unwrap_or(false) {
                w.unmaximize()
            } else {
                w.maximize()
            };
        }
        "windowHide" => hide(app),
        "windowMini" => {
            let on = arg(args, 0).as_bool().unwrap_or(false);
            set_mini(&w, on);
            return Ok(Value::Bool(on));
        }
        _ => return Err(i18n::t("error.not_allowed")),
    }
    Ok(Value::Null)
}

/// For the screenshot script (only with the e2e variable set): the window's frame in logical
/// points, after moving and resizing it when a rect is given. `main`, or `overlay` for the
/// first desktop window.
pub fn e2e_window(app: &AppHandle, args: &[Value]) -> Result<Value, String> {
    let wanted = text(args, 0);
    let w = app
        .webview_windows()
        .into_iter()
        .find(|(label, _)| label == wanted || (wanted == "overlay" && label.starts_with("overlay")))
        .map(|(_, w)| w)
        .ok_or_else(|| format!("no window {wanted}"))?;
    if let Some((x, y, width, height)) = rect_of(arg(args, 1)) {
        w.set_position(LogicalPosition::new(x, y)).map_err(|e| e.to_string())?;
        w.set_size(LogicalSize::new(width, height)).map_err(|e| e.to_string())?;
        std::thread::sleep(std::time::Duration::from_millis(150));
    }
    let scale = w.scale_factor().map_err(|e| e.to_string())?;
    let pos = w.outer_position().map_err(|e| e.to_string())?.to_logical::<f64>(scale);
    let size = w.outer_size().map_err(|e| e.to_string())?.to_logical::<f64>(scale);
    Ok(json!({"x": pos.x, "y": pos.y, "width": size.width, "height": size.height, "scale": scale}))
}

/// `{x, y, width, height}` with every field a number, else nothing.
fn rect_of(v: &Value) -> Option<(f64, f64, f64, f64)> {
    let n = |k: &str| v.get(k)?.as_f64();
    Some((n("x")?, n("y")?, n("width")?, n("height")?))
}

/// Mini: a small always-on-top window showing only the yard. Leaving it restores the size
/// the window had before.
fn set_mini(w: &WebviewWindow, on: bool) {
    static FULL_SIZE: Mutex<Option<LogicalSize<f64>>> = Mutex::new(None);
    let mut full = FULL_SIZE.lock().unwrap();
    if on {
        if full.is_none() {
            let scale = w.scale_factor().unwrap_or(1.0);
            *full = w.inner_size().ok().map(|s| s.to_logical::<f64>(scale));
        }
        // The smaller minimum first, or the window refuses to shrink below the full one.
        let _ = w.set_min_size(Some(size(MINI_MIN)));
        let _ = w.set_size(size(MINI_SIZE));
    } else {
        let _ = w.set_size(full.take().unwrap_or(size(FULL_SIZE_DEFAULT)));
        let _ = w.set_min_size(Some(size(FULL_MIN)));
    }
    let _ = w.set_always_on_top(on);
    // macOS: the mini yard is all picture, so the window buttons step aside too.
    #[cfg(target_os = "macos")]
    {
        let target = w.clone();
        let _ = w.run_on_main_thread(move || {
            use objc2::msg_send;
            use objc2::runtime::AnyObject;
            let Ok(ptr) = target.ns_window() else { return };
            let window = ptr as *mut AnyObject;
            // NSWindowButton 0, 1, 2: close, miniaturize, zoom.
            for kind in 0..3usize {
                unsafe {
                    let button: *mut AnyObject = msg_send![window, standardWindowButton: kind];
                    if !button.is_null() {
                        let _: () = msg_send![button, setHidden: on];
                    }
                }
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::rect_of;
    use serde_json::json;

    #[test]
    fn a_rect_needs_all_four_numbers() {
        assert_eq!(
            rect_of(&json!({"x": 1, "y": 2.5, "width": 300, "height": 200})),
            Some((1.0, 2.5, 300.0, 200.0))
        );
        assert_eq!(rect_of(&json!({"x": 1, "y": 2, "width": "wide", "height": 200})), None);
        assert_eq!(rect_of(&json!(null)), None);
    }
}
