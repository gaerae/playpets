// The main window: how it is built, and the commands the page uses to move, size and hide it.
use crate::app::{Shared, lock};
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
    let host = url.host_str();
    (url.scheme() == "tauri" && host == Some("localhost"))
        || (matches!(url.scheme(), "http" | "https") && host == Some("tauri.localhost"))
        || url.as_str() == "about:blank"
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
            let saved = app.try_state::<Shared>().and_then(|s| lock(&s).mini_rect);
            set_mini(&w, on, saved);
            crate::tray::retitle(app);
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
pub fn rect_of(v: &Value) -> Option<Rect> {
    let n = |k: &str| v.get(k)?.as_f64();
    Some((n("x")?, n("y")?, n("width")?, n("height")?))
}

/// A window's place and size in logical points: x, y, width, height.
pub type Rect = (f64, f64, f64, f64);

/// Where the mini window goes: where the person last left it (`saved`, kept in the app's data)
/// while that still lies on a monitor, else the bottom-right corner of the monitor the full
/// window is on, the usual place for a small window that stays on top.
fn mini_rect(saved: Option<Rect>, areas: &[Rect], full: Rect) -> Rect {
    let on = |a: &Rect, x: f64, y: f64| x >= a.0 && x <= a.0 + a.2 && y >= a.1 && y <= a.1 + a.3;
    if let Some((x, y, w, h)) = saved {
        let fits = w >= MINI_MIN.0 && h >= MINI_MIN.1;
        if let Some(a) = areas.iter().find(|a| fits && on(a, x + w / 2.0, y + h / 2.0)) {
            let (w, h) = (w.min(a.2), h.min(a.3));
            // Not f64::clamp: a window as big as the area can round its upper bound below the lower.
            let fit = |v: f64, lo: f64, hi: f64| v.min(hi).max(lo);
            return (fit(x, a.0, a.0 + a.2 - w), fit(y, a.1, a.1 + a.3 - h), w, h);
        }
    }
    let (cx, cy) = (full.0 + full.2 / 2.0, full.1 + full.3 / 2.0);
    let (w, h) = MINI_SIZE;
    match areas.iter().find(|a| on(a, cx, cy)).or(areas.first()) {
        Some(a) => (a.0 + a.2 - w - MINI_MARGIN, a.1 + a.3 - h - MINI_MARGIN, w, h),
        None => (full.0, full.1, w, h),
    }
}
/// Room between the mini window and the screen's edges.
const MINI_MARGIN: f64 = 24.0;

/// The work area of every monitor, in logical points.
fn work_areas(w: &WebviewWindow) -> Vec<Rect> {
    w.available_monitors()
        .unwrap_or_default()
        .iter()
        .map(|m| {
            let (scale, area) = (m.scale_factor(), m.work_area());
            let (p, s) = (
                area.position.to_logical::<f64>(scale),
                area.size.to_logical::<f64>(scale),
            );
            (p.x, p.y, s.width, s.height)
        })
        .collect()
}

/// The window's place and size now, in logical points.
fn rect_now(w: &WebviewWindow) -> Option<Rect> {
    let scale = w.scale_factor().ok()?;
    let p = w.outer_position().ok()?.to_logical::<f64>(scale);
    let s = w.inner_size().ok()?.to_logical::<f64>(scale);
    Some((p.x, p.y, s.width, s.height))
}

/// Whether the window is the mini one now: its moves and sizes are then kept (`moved`).
static MINI: AtomicBool = AtomicBool::new(false);

/// Whether the yard is in its mini window (the tray shows it with a check mark).
pub fn is_mini() -> bool {
    MINI.load(Ordering::SeqCst)
}

/// The main window moved or changed size: the mini window's place is kept, saved with the
/// app's state (so it opens there again after a restart too).
pub fn moved(app: &AppHandle) {
    if !MINI.load(Ordering::SeqCst) {
        return;
    }
    let (Some(w), Some(state)) = (app.get_webview_window("main"), app.try_state::<Shared>()) else {
        return;
    };
    let Some(rect) = rect_now(&w) else { return };
    let mut d = lock(&state);
    if d.mini_rect != Some(rect) {
        d.mini_rect = Some(rect);
        crate::app::persist_soon(app);
    }
}

/// Mini: a small always-on-top window showing only the yard, where it was last left (see
/// mini_rect). Leaving it puts the window back where it was, at the size it had.
fn set_mini(w: &WebviewWindow, on: bool, saved: Option<Rect>) {
    static FULL: Mutex<Option<Rect>> = Mutex::new(None);
    let mut full = crate::app::hold(&FULL);
    // Moves made from here on are the mini window's own only once it stands in its place.
    MINI.store(false, Ordering::SeqCst);
    if on {
        if full.is_none() {
            *full = rect_now(w);
        }
        let before = full.unwrap_or((0.0, 0.0, FULL_SIZE_DEFAULT.0, FULL_SIZE_DEFAULT.1));
        let (x, y, width, height) = mini_rect(saved, &work_areas(w), before);
        // The smaller minimum first, or the window refuses to shrink below the full one.
        let _ = w.set_min_size(Some(size(MINI_MIN)));
        let _ = w.set_size(size((width, height)));
        let _ = w.set_position(LogicalPosition::new(x, y));
        MINI.store(true, Ordering::SeqCst);
    } else {
        match full.take() {
            Some((x, y, width, height)) => {
                let _ = w.set_size(size((width, height)));
                let _ = w.set_position(LogicalPosition::new(x, y));
            }
            None => {
                let _ = w.set_size(size(FULL_SIZE_DEFAULT));
            }
        }
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
    use super::{MINI_MARGIN, MINI_SIZE, mini_rect, own_page, rect_of};
    use serde_json::json;

    #[test]
    fn the_mini_window_returns_where_it_was_left_or_takes_the_corner() {
        let areas = [(0.0, 25.0, 1440.0, 875.0), (1440.0, 0.0, 1920.0, 1080.0)];
        let full = (100.0, 100.0, 1180.0, 780.0);
        // Never moved: the bottom-right corner of the monitor the full window is on.
        let (w, h) = MINI_SIZE;
        assert_eq!(
            mini_rect(None, &areas, full),
            (1440.0 - w - MINI_MARGIN, 900.0 - h - MINI_MARGIN, w, h)
        );
        // Left on the second monitor at a size of its own: back there.
        let left = (2000.0, 300.0, 520.0, 360.0);
        assert_eq!(mini_rect(Some(left), &areas, full), left);
        // Half off the edge: pulled back in.
        assert_eq!(
            mini_rect(Some((1200.0, 650.0, 400.0, 300.0)), &areas, full),
            (1040.0, 600.0, 400.0, 300.0)
        );
        // On a monitor that is gone, or too small to use: the corner again.
        assert_eq!(
            mini_rect(Some((5000.0, 300.0, 460.0, 320.0)), &areas, full).0,
            1440.0 - w - MINI_MARGIN
        );
        assert_eq!(
            mini_rect(Some((300.0, 300.0, 40.0, 30.0)), &areas, full).0,
            1440.0 - w - MINI_MARGIN
        );
        // As big as an area whose edges do not add up exactly (a scaled monitor): no panic, inside it.
        let odd = [(-3194.4, 0.0, 1092.8, 840.0)];
        let (x, _, w, _) = mini_rect(Some((-3194.4, 10.0, 1092.8, 500.0)), &odd, full);
        assert!(x >= odd[0].0 - 0.001 && w <= odd[0].2);
    }

    #[test]
    fn only_the_apps_own_pages_load_in_its_windows() {
        let page = |u: &str| own_page(&tauri::Url::parse(u).unwrap());
        assert!(page("tauri://localhost/index.html"));
        assert!(page("http://tauri.localhost/overlay.html"));
        assert!(page("https://tauri.localhost/"));
        assert!(page("about:blank"));
        for no in [
            "tauri://elsewhere/",
            "ftp://tauri.localhost/",
            "about:srcdoc",
            "https://example.com/",
            "file:///etc/passwd",
        ] {
            assert!(!page(no), "{no}");
        }
    }

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
