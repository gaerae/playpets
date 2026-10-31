// The main window: how it is built, and the commands the page uses to move, size and hide it.
use crate::app::{Shared, hold, lock};
use crate::commands::{arg, text};
use crate::i18n;
use serde_json::{Value, json};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const SIZE_DEFAULT: (f64, f64) = (1180.0, 850.0);
const SIZE_MIN: (f64, f64) = (300.0, 210.0);
/// How far below the window's top edge the middle of its drag strip lies (.window-drag in shell.css).
const DRAG_STRIP: f64 = 13.0;
/// How often `watch_screens` looks.
const SCREEN_LOOK: std::time::Duration = std::time::Duration::from_secs(1);

/// WebKitGTK's DMA-BUF renderer ends the page's web process where it finds no usable GPU (a VM,
/// a remote desktop, some drivers, Xvfb), leaving a blank or frozen window. The shared-memory
/// renderer draws everywhere, and the yard repaints only while something moves, so the copy it
/// costs is small. A value the person set is left as it is.
#[cfg(target_os = "linux")]
pub fn choose_renderer() {
    if let Some((name, value)) = renderer_default(std::env::var_os(DMABUF_SWITCH).as_deref()) {
        // SAFETY: main calls this before the app starts a thread, so nothing reads the environment meanwhile.
        unsafe { std::env::set_var(name, value) };
        RENDERER_SET_HERE.store(true, Ordering::Relaxed);
    }
}

/// The variable `choose_renderer` set, if it did. A program the app opens (a browser, a file manager)
/// starts without it, so the app's choice never turns off another program's GPU drawing.
#[cfg(target_os = "linux")]
pub fn renderer_switch_set_here() -> Option<&'static str> {
    RENDERER_SET_HERE.load(Ordering::Relaxed).then_some(DMABUF_SWITCH)
}

#[cfg(target_os = "linux")]
static RENDERER_SET_HERE: AtomicBool = AtomicBool::new(false);

#[cfg(target_os = "linux")]
const DMABUF_SWITCH: &str = "WEBKIT_DISABLE_DMABUF_RENDERER";

#[cfg(target_os = "linux")]
fn renderer_default(set: Option<&std::ffi::OsStr>) -> Option<(&'static str, &'static str)> {
    set.is_none().then_some((DMABUF_SWITCH, "1"))
}

fn size((width, height): (f64, f64)) -> LogicalSize<f64> {
    LogicalSize::new(width, height)
}

pub fn build_main(app: &tauri::App, bridge_js: &str) -> tauri::Result<WebviewWindow> {
    let (saved, always_on_top) = {
        let state = app.state::<Shared>();
        let d = lock(&state);
        (d.prefs.window_rect, d.prefs.always_on_top)
    };
    let builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title(crate::i18n::t("app.title"))
        // Backend isolation alone does not isolate WebView localStorage or IndexedDB.
        .incognito(crate::commands::e2e_mode())
        .inner_size(SIZE_DEFAULT.0, SIZE_DEFAULT.1)
        .min_inner_size(SIZE_MIN.0, SIZE_MIN.1)
        // The page's own background (--paper), so nothing flashes white before it loads.
        .background_color(tauri::window::Color(0xf7, 0xf9, 0xf8, 0xff))
        .on_navigation(own_page)
        .initialization_script(bridge_js)
        .decorations(false)
        .resizable(true)
        .always_on_top(always_on_top);
    let w = builder.build()?;
    watch_fullscreen(&w);
    let default = rect_now(&w).unwrap_or((0.0, 0.0, SIZE_DEFAULT.0, SIZE_DEFAULT.1));
    let (x, y, width, height) = restored_rect(saved, &work_areas(&w), default);
    w.set_size(size((width, height)))?;
    w.set_position(LogicalPosition::new(x, y))?;
    limit_size(&w, size_limit((x, y, width, height), &work_areas(&w)));
    Ok(w)
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
        settle(&w);
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
        "windowFit" => return fit(app),
        "windowFullscreen" => return set_fullscreen(app, arg(args, 0).as_bool().unwrap_or(false)),
        "windowIsFullscreen" => return fullscreen_now(app),
        "windowAlwaysOnTop" => return set_always_on_top(app, arg(args, 0).as_bool().unwrap_or(false)),
        "windowResize" => {
            let direction = resize_direction(text(args, 0)).ok_or_else(|| i18n::t("error.not_allowed"))?;
            let view: &tauri::Webview = w.as_ref();
            view.window()
                .start_resize_dragging(direction)
                .map_err(|_| i18n::t("error.not_allowed"))?;
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
    // The size `set_size` takes: Windows counts a frame in the outer size, so a size read back and
    // set again would grow by that frame each time.
    let size = w.inner_size().map_err(|e| e.to_string())?.to_logical::<f64>(scale);
    Ok(
        json!({"x": pos.x, "y": pos.y, "width": size.width, "height": size.height, "scale": scale, "fullscreen": w.is_fullscreen().map_err(|e| e.to_string())?, "alwaysOnTop": always_on_top_now(&w)?, "resizable": w.is_resizable().map_err(|e| e.to_string())?, "minimum": {"width": SIZE_MIN.0, "height": SIZE_MIN.1}, "maximum": hold(&SIZE_LIMIT).map(|(width, height)| json!({"width": width, "height": height}))}),
    )
}

/// `{x, y, width, height}` with every field a number, else nothing.
pub fn rect_of(v: &Value) -> Option<Rect> {
    let n = |k: &str| v.get(k)?.as_f64();
    Some((n("x")?, n("y")?, n("width")?, n("height")?))
}

/// A window's place and size in logical points: x, y, width, height.
pub type Rect = (f64, f64, f64, f64);

/// Restore normal bounds on a surviving monitor, pulling offscreen edges back into its work area.
fn restored_rect(saved: Option<Rect>, areas: &[Rect], default: Rect) -> Rect {
    let valid = |r: Rect| [r.0, r.1, r.2, r.3].into_iter().all(f64::is_finite) && r.2 > 0.0 && r.3 > 0.0;
    let (x, y, width, height) = saved.filter(|r| valid(*r)).unwrap_or(default);
    let Some(area) = area_of((x, y, width, height), areas) else {
        return (x, y, width.max(SIZE_MIN.0), height.max(SIZE_MIN.1));
    };
    let width = width.max(SIZE_MIN.0).min(area.2);
    let height = height.max(SIZE_MIN.1).min(area.3);
    (
        x.min(area.0 + area.2 - width).max(area.0),
        y.min(area.1 + area.3 - height).max(area.1),
        width,
        height,
    )
}

/// Whether a point lies on a screen.
fn on_area((x, y): (f64, f64), a: &Rect) -> bool {
    x >= a.0 && x <= a.0 + a.2 && y >= a.1 && y <= a.1 + a.3
}

/// The screen the middle of `rect` is on, or else the first one.
fn area_of((x, y, width, height): Rect, areas: &[Rect]) -> Option<&Rect> {
    let middle = (x + width / 2.0, y + height / 2.0);
    areas.iter().find(|a| on_area(middle, a)).or(areas.first())
}

/// Whether a person can still take hold of the window: its drag strip is on a screen that it fits.
/// A window across two screens, or hanging past an edge, is theirs to have put there.
fn reachable((x, y, width, height): Rect, areas: &[Rect]) -> bool {
    let strip = (x + width / 2.0, y + DRAG_STRIP);
    areas
        .iter()
        .any(|a| on_area(strip, a) && width <= a.2 + 0.5 && height <= a.3 + 0.5)
}

/// Where a window a person can no longer take hold of belongs; nothing for one they can.
fn fitted(rect: Rect, areas: &[Rect]) -> Option<Rect> {
    (!areas.is_empty() && !reachable(rect, areas)).then(|| restored_rect(Some(rect), areas, rect))
}

/// The usual size in the middle of the screen the window is on, or filling a smaller screen.
fn usual_rect(rect: Rect, areas: &[Rect]) -> Rect {
    let Some(area) = area_of(rect, areas) else {
        return (rect.0, rect.1, SIZE_DEFAULT.0, SIZE_DEFAULT.1);
    };
    let (width, height) = (SIZE_DEFAULT.0.min(area.2), SIZE_DEFAULT.1.min(area.3));
    (
        area.0 + (area.2 - width) / 2.0,
        area.1 + (area.3 - height) / 2.0,
        width,
        height,
    )
}

/// The most a window can grow on the screen it is on.
fn size_limit(rect: Rect, areas: &[Rect]) -> Option<(f64, f64)> {
    area_of(rect, areas).map(|a| (a.2, a.3))
}

/// The limit as last given to the window.
static SIZE_LIMIT: Mutex<Option<(f64, f64)>> = Mutex::new(None);

fn limit_size(w: &WebviewWindow, limit: Option<(f64, f64)>) {
    if *hold(&SIZE_LIMIT) != limit && w.set_max_size(limit.map(size)).is_ok() {
        *hold(&SIZE_LIMIT) = limit;
    }
}

/// A place and size that hold on `areas`; the limit goes first so that it allows the size.
fn place(w: &WebviewWindow, rect: Rect, areas: &[Rect]) -> tauri::Result<()> {
    limit_size(w, size_limit(rect, areas));
    w.set_size(size((rect.2, rect.3)))?;
    w.set_position(LogicalPosition::new(rect.0, rect.1))
}

/// Brings back a window a person can no longer take hold of.
pub fn settle(w: &WebviewWindow) {
    if !in_normal_bounds(w) {
        return;
    }
    let Some(rect) = rect_now(w) else { return };
    let areas = work_areas(w);
    if let Some(rect) = fitted(rect, &areas) {
        let _ = place(w, rect, &areas);
    }
}

/// Puts the window at its usual size in the middle of its screen, out of fullscreen if it was.
fn fit(app: &AppHandle) -> Result<Value, String> {
    let w = app
        .get_webview_window("main")
        .ok_or_else(|| i18n::t("error.not_allowed"))?;
    let error = |_| i18n::t("error.request_failed");
    if w.is_fullscreen().map_err(error)? {
        set_fullscreen(app, false)?;
    }
    let _ = w.unmaximize();
    let rect = rect_now(&w).ok_or_else(|| i18n::t("error.request_failed"))?;
    let areas = work_areas(&w);
    place(&w, usual_rect(rect, &areas), &areas).map_err(error)?;
    Ok(Value::Null)
}

/// From the tray and the menu bar, where no page asked: the window comes forward with its fit.
pub fn show_fitted(app: &AppHandle) -> Result<Value, String> {
    show(app);
    fit(app)
}

/// Nothing tells the app that a screen went away or that the window crossed to another one, and a
/// system moves a window off a lost screen without making it smaller, so this looks once a second.
/// A screen waking up reports itself in steps: only a list that held for two looks counts.
pub fn watch_screens(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        let (mut last, mut settled) = (Vec::new(), Vec::new());
        loop {
            std::thread::sleep(SCREEN_LOOK);
            let Some(w) = app.get_webview_window("main") else {
                continue;
            };
            if !w.is_visible().unwrap_or(false) || !in_normal_bounds(&w) {
                continue;
            }
            let areas = work_areas(&w);
            let steady = areas == last;
            last = areas.clone();
            if !steady || areas.is_empty() {
                continue;
            }
            if areas != settled {
                settled = areas.clone();
                settle(&w);
            }
            if let Some(rect) = rect_now(&w) {
                limit_size(&w, size_limit(rect, &areas));
            }
        }
    });
}

fn resize_direction(direction: &str) -> Option<tauri_runtime::ResizeDirection> {
    use tauri_runtime::ResizeDirection::*;
    Some(match direction {
        "North" => North,
        "NorthEast" => NorthEast,
        "East" => East,
        "SouthEast" => SouthEast,
        "South" => South,
        "SouthWest" => SouthWest,
        "West" => West,
        "NorthWest" => NorthWest,
        _ => return None,
    })
}

// A native fullscreen animation changes bounds before the runtime reports its final state.
static WINDOW_CHANGING: AtomicBool = AtomicBool::new(false);
static NATIVE_FULLSCREEN_CHANGING: AtomicBool = AtomicBool::new(false);
static NORMAL_RECT: Mutex<Option<Rect>> = Mutex::new(None);

struct WindowChange;
impl WindowChange {
    fn begin() -> Result<Self, String> {
        WINDOW_CHANGING
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .map(|_| Self)
            .map_err(|_| i18n::t("error.request_failed"))
    }
}
impl Drop for WindowChange {
    fn drop(&mut self) {
        WINDOW_CHANGING.store(false, Ordering::SeqCst);
    }
}

// Tao queues Cocoa frame and style changes on GCD after its runtime command returns.
#[cfg(target_os = "macos")]
mod native_queue {
    use std::ffi::c_void;
    unsafe extern "C" {
        static _dispatch_main_q: c_void;
        fn dispatch_async_f(queue: *const c_void, context: *mut c_void, work: extern "C" fn(*mut c_void));
        fn dispatch_sync_f(queue: *const c_void, context: *mut c_void, work: extern "C" fn(*mut c_void));
    }
    extern "C" fn finished(_: *mut c_void) {
        super::NATIVE_FULLSCREEN_CHANGING.store(false, super::Ordering::SeqCst);
    }
    extern "C" fn after_delegate(_: *mut c_void) {
        // Notification observers can precede Tao's delegate. A second hop follows any style
        // restoration that delegate enqueues later in the same notification delivery.
        unsafe { dispatch_async_f(&raw const _dispatch_main_q, std::ptr::null_mut(), finished) };
    }
    pub(super) fn finish_transition() {
        unsafe { dispatch_async_f(&raw const _dispatch_main_q, std::ptr::null_mut(), after_delegate) };
    }
    pub(super) fn flush() {
        extern "C" fn barrier(_: *mut c_void) {}
        // Only called by command workers, never from the main thread or under a mutex.
        unsafe { dispatch_sync_f(&raw const _dispatch_main_q, std::ptr::null_mut(), barrier) };
    }
}

fn flush_native_window(w: &WebviewWindow) -> Result<(), String> {
    // This runtime getter follows the setters, ensuring Tao has queued their native work.
    w.inner_size().map_err(|_| i18n::t("error.request_failed"))?;
    #[cfg(target_os = "macos")]
    native_queue::flush();
    Ok(())
}

fn same_rect(a: Rect, b: Rect) -> bool {
    [a.0 - b.0, a.1 - b.1, a.2 - b.2, a.3 - b.3]
        .into_iter()
        .all(|difference| difference.abs() < 0.5)
}

#[cfg(target_os = "macos")]
fn watch_fullscreen(w: &WebviewWindow) {
    use objc2::runtime::{AnyClass, AnyObject, ClassBuilder, Sel};
    use objc2::{msg_send, sel};
    use std::sync::OnceLock;
    extern "C" fn starting(_: &AnyObject, _: Sel, _: *mut AnyObject) {
        NATIVE_FULLSCREEN_CHANGING.store(true, Ordering::SeqCst);
    }
    extern "C" fn finished(_: &AnyObject, _: Sel, _: *mut AnyObject) {
        native_queue::finish_transition();
    }
    static OBSERVER: OnceLock<&'static AnyClass> = OnceLock::new();
    let class = OBSERVER.get_or_init(|| {
        let mut class = ClassBuilder::new(c"PlayPetsFullscreenObserver", AnyClass::get(c"NSObject").unwrap()).unwrap();
        unsafe {
            class.add_method(sel!(starting:), starting as extern "C" fn(_, _, _));
            class.add_method(sel!(finished:), finished as extern "C" fn(_, _, _));
        }
        class.register()
    });
    let Ok(ptr) = w.ns_window() else { return };
    // The observer lives for the app's lifetime, just like its single main window.
    unsafe {
        let observer: *mut AnyObject = msg_send![*class, new];
        let center: *mut AnyObject = msg_send![AnyClass::get(c"NSNotificationCenter").unwrap(), defaultCenter];
        for (name, selector) in [
            (c"NSWindowWillEnterFullScreenNotification", sel!(starting:)),
            (c"NSWindowWillExitFullScreenNotification", sel!(starting:)),
            (c"NSWindowDidEnterFullScreenNotification", sel!(finished:)),
            (c"NSWindowDidExitFullScreenNotification", sel!(finished:)),
        ] {
            let name: *mut AnyObject =
                msg_send![AnyClass::get(c"NSString").unwrap(), stringWithUTF8String: name.as_ptr()];
            let _: () =
                msg_send![center, addObserver: observer, selector: selector, name: name, object: ptr as *mut AnyObject];
        }
    }
}
#[cfg(not(target_os = "macos"))]
fn watch_fullscreen(_: &WebviewWindow) {}

fn confirm_fullscreen(
    wanted: bool,
    mut get: impl FnMut() -> Result<(bool, bool), String>,
    mut retry: impl FnMut() -> bool,
) -> Result<bool, String> {
    loop {
        let (actual, changing) = get()?;
        if actual == wanted && !changing {
            return Ok(actual);
        }
        if !retry() {
            return Err(i18n::t("error.request_failed"));
        }
    }
}

fn wait_fullscreen(w: &WebviewWindow, wanted: bool) -> Result<bool, String> {
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(8);
    confirm_fullscreen(
        wanted,
        || {
            let actual = w.is_fullscreen().map_err(|_| i18n::t("error.request_failed"))?;
            Ok((actual, NATIVE_FULLSCREEN_CHANGING.load(Ordering::SeqCst)))
        },
        || {
            if std::time::Instant::now() >= deadline {
                return false;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
            true
        },
    )
}

fn confirm_normal_rect(
    wanted: Rect,
    mut get: impl FnMut() -> Option<Rect>,
    mut retry: impl FnMut() -> bool,
) -> Result<(), String> {
    loop {
        if get().is_some_and(|actual| same_rect(actual, wanted)) {
            return Ok(());
        }
        if !retry() {
            return Err(i18n::t("error.request_failed"));
        }
    }
}

fn restore_normal(app: &AppHandle, w: &WebviewWindow) -> Result<(), String> {
    let rect = *hold(&NORMAL_RECT);
    if let Some(rect) = rect {
        // The screen it came from may have gone while it was fullscreen.
        let (x, y, width, height) = fitted(rect, &work_areas(w)).unwrap_or(rect);
        w.set_size(size((width, height)))
            .map_err(|_| i18n::t("error.request_failed"))?;
        w.set_position(LogicalPosition::new(x, y))
            .map_err(|_| i18n::t("error.request_failed"))?;
        flush_native_window(w)?;
        // GTK applies frame changes on later configure events, after the setter returns.
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(2);
        confirm_normal_rect(
            (x, y, width, height),
            || rect_now(w),
            || {
                if std::time::Instant::now() >= deadline {
                    return false;
                }
                std::thread::sleep(std::time::Duration::from_millis(10));
                true
            },
        )?;
        let pin = lock(&app.state::<Shared>()).prefs.always_on_top;
        apply_always_on_top(w, pin)?;
        *hold(&NORMAL_RECT) = None;
    }
    Ok(())
}

fn set_fullscreen(app: &AppHandle, on: bool) -> Result<Value, String> {
    let _change = WindowChange::begin()?;
    let w = app
        .get_webview_window("main")
        .ok_or_else(|| i18n::t("error.not_allowed"))?;
    let actual = w.is_fullscreen().map_err(|_| i18n::t("error.request_failed"))?;
    if on && !actual {
        // Read the actual frame, including any move that has not reached the event handler yet.
        let rect = rect_now(&w).ok_or_else(|| i18n::t("error.request_failed"))?;
        *hold(&NORMAL_RECT) = Some(rect);
        {
            let state = app.state::<Shared>();
            let mut d = lock(&state);
            d.prefs.window_rect = Some(rect);
        }
        crate::app::persist_soon(app);
        apply_always_on_top(&w, false)?;
        // Fullscreen fills the whole screen, past the work area; `watch_screens` sets it again after.
        limit_size(&w, None);
    }
    if actual != on {
        #[cfg(target_os = "macos")]
        NATIVE_FULLSCREEN_CHANGING.store(true, Ordering::SeqCst);
        if w.set_fullscreen(on).is_err() {
            NATIVE_FULLSCREEN_CHANGING.store(false, Ordering::SeqCst);
            if !actual {
                restore_normal(app, &w)?;
            }
            return Err(i18n::t("error.request_failed"));
        }
    }
    let actual = match wait_fullscreen(&w, on) {
        Ok(actual) => actual,
        Err(error) => {
            // A refused entry has no normal window event to repair its temporary level.
            if !NATIVE_FULLSCREEN_CHANGING.load(Ordering::SeqCst) && !w.is_fullscreen().unwrap_or(true) {
                restore_normal(app, &w)?;
            }
            return Err(error);
        }
    };
    if !actual {
        restore_normal(app, &w)?;
    }
    Ok(json!(actual))
}

fn fullscreen_now(app: &AppHandle) -> Result<Value, String> {
    let w = app
        .get_webview_window("main")
        .ok_or_else(|| i18n::t("error.not_allowed"))?;
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(8);
    // A resize can arrive halfway through native Escape or the page's own command. Wait off
    // the main thread so the returned state also includes normal-frame and pin restoration.
    let _change = loop {
        if !NATIVE_FULLSCREEN_CHANGING.load(Ordering::SeqCst)
            && let Ok(change) = WindowChange::begin()
        {
            break change;
        }
        if std::time::Instant::now() >= deadline {
            return Err(i18n::t("error.request_failed"));
        }
        std::thread::sleep(std::time::Duration::from_millis(10));
    };
    let actual = w.is_fullscreen().map_err(|_| i18n::t("error.request_failed"))?;
    if !actual {
        restore_normal(app, &w)?;
    }
    Ok(json!(actual))
}

/// macOS queues the level change after its setter returns. The caller waits off the main
/// thread, before taking the state lock, so neither the old level nor an unconfirmed one is saved.
fn confirm_always_on_top(
    on: bool,
    set: impl FnOnce(bool) -> Result<(), String>,
    mut get: impl FnMut() -> Result<bool, String>,
    mut retry: impl FnMut() -> bool,
) -> Result<bool, String> {
    set(on)?;
    loop {
        let actual = get()?;
        if actual == on {
            return Ok(actual);
        }
        if !retry() {
            return Err(i18n::t("error.request_failed"));
        }
    }
}

/// Native success is recorded and published so the page, tray and menu agree.
pub fn set_always_on_top(app: &AppHandle, on: bool) -> Result<Value, String> {
    let w = app
        .get_webview_window("main")
        .ok_or_else(|| i18n::t("error.not_allowed"))?;
    let _change = WindowChange::begin()?;
    // Fullscreen uses the normal native level; the preference still records the desired level.
    let actual = if w.is_fullscreen().map_err(|_| i18n::t("error.request_failed"))? {
        on
    } else {
        apply_always_on_top(&w, on)?
    };
    crate::app::commit(app, &app.state::<Shared>(), |d| {
        d.prefs.always_on_top = actual;
        Ok(json!(actual))
    })
}

// GTK/Tao can retain the old ABOVE state after X11 has accepted the change.
// Read the window manager's property directly; never save the requested value as confirmation.
#[cfg(target_os = "linux")]
fn always_on_top_now(w: &WebviewWindow) -> Result<bool, String> {
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};
    use x11rb::protocol::xproto::{AtomEnum, ConnectionExt};
    let error = || i18n::t("error.request_failed");
    let handle = w.window_handle().map_err(|_| error())?;
    let id = match handle.as_raw() {
        RawWindowHandle::Xlib(handle) => u32::try_from(handle.window).map_err(|_| error())?,
        RawWindowHandle::Xcb(handle) => handle.window.get(),
        _ => return w.is_always_on_top().map_err(|_| error()),
    };
    let (connection, _) = x11rb::connect(None).map_err(|_| error())?;
    let atom = |name: &[u8]| -> Result<u32, String> {
        Ok(connection
            .intern_atom(false, name)
            .map_err(|_| error())?
            .reply()
            .map_err(|_| error())?
            .atom)
    };
    let state = atom(b"_NET_WM_STATE")?;
    let above = atom(b"_NET_WM_STATE_ABOVE")?;
    let reply = connection
        .get_property(false, id, state, AtomEnum::ATOM, 0, 64)
        .map_err(|_| error())?
        .reply()
        .map_err(|_| error())?;
    Ok(reply.value32().is_some_and(|mut atoms| atoms.any(|atom| atom == above)))
}

#[cfg(not(target_os = "linux"))]
fn always_on_top_now(w: &WebviewWindow) -> Result<bool, String> {
    w.is_always_on_top().map_err(|_| i18n::t("error.request_failed"))
}

fn apply_always_on_top(w: &WebviewWindow, on: bool) -> Result<bool, String> {
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(2);
    confirm_always_on_top(
        on,
        |on| w.set_always_on_top(on).map_err(|_| i18n::t("error.request_failed")),
        || always_on_top_now(w),
        || {
            if std::time::Instant::now() >= deadline {
                return false;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
            true
        },
    )
}

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

/// Whether the window has its normal bounds now, not maximized, minimized, fullscreen or on the way.
fn in_normal_bounds(w: &WebviewWindow) -> bool {
    !(WINDOW_CHANGING.load(Ordering::SeqCst)
        || NATIVE_FULLSCREEN_CHANGING.load(Ordering::SeqCst)
        || hold(&NORMAL_RECT).is_some()
        || w.is_maximized().unwrap_or(false)
        || w.is_minimized().unwrap_or(false)
        || w.is_fullscreen().unwrap_or(false))
}

/// Keep only normal bounds; maximizing, minimizing or fullscreen never replace them.
pub fn moved(app: &AppHandle) {
    let (Some(w), Some(state)) = (app.get_webview_window("main"), app.try_state::<Shared>()) else {
        return;
    };
    if !in_normal_bounds(&w) {
        return;
    }
    let Some(rect) = rect_now(&w) else { return };
    let mut d = lock(&state);
    if d.prefs.window_rect != Some(rect) {
        d.prefs.window_rect = Some(rect);
        crate::app::persist_soon(app);
    }
}

#[cfg(test)]
mod tests {
    use super::{
        confirm_always_on_top, fitted, own_page, reachable, rect_of, resize_direction, restored_rect, size_limit,
        usual_rect,
    };
    use serde_json::json;

    const DESK: [(f64, f64, f64, f64); 2] = [(0.0, 25.0, 1440.0, 875.0), (1440.0, 0.0, 1920.0, 1080.0)];
    const LAPTOP: [(f64, f64, f64, f64); 1] = [(0.0, 25.0, 1440.0, 875.0)];

    #[test]
    fn a_window_a_person_can_still_take_hold_of_is_left_where_it_is() {
        // Across two screens, and hanging past the bottom: its drag strip is on a screen.
        assert!(reachable((1000.0, 100.0, 1180.0, 850.0), &DESK));
        assert!(reachable((100.0, 500.0, 1000.0, 700.0), &DESK));
        assert_eq!(fitted((1000.0, 100.0, 1180.0, 850.0), &DESK), None);
    }

    #[test]
    fn a_window_left_bigger_than_the_remaining_screen_comes_back_inside_it() {
        // Made on the wide monitor, which was then unplugged.
        let big = (0.0, 25.0, 1900.0, 1050.0);
        assert!(!reachable(big, &LAPTOP));
        assert_eq!(fitted(big, &LAPTOP), Some((0.0, 25.0, 1440.0, 875.0)));
    }

    #[test]
    fn a_window_whose_drag_strip_is_off_every_screen_comes_back() {
        let above = (200.0, -300.0, 800.0, 600.0);
        assert!(!reachable(above, &DESK));
        assert_eq!(fitted(above, &DESK), Some((200.0, 25.0, 800.0, 600.0)));
        let gone = (2000.0, 300.0, 800.0, 600.0);
        assert_eq!(fitted(gone, &LAPTOP), Some((640.0, 300.0, 800.0, 600.0)));
    }

    #[test]
    fn with_no_screen_known_a_window_is_left_alone() {
        assert_eq!(fitted((0.0, 0.0, 5000.0, 5000.0), &[]), None);
    }

    #[test]
    fn the_usual_size_goes_to_the_middle_of_the_screen_the_window_is_on() {
        assert_eq!(
            usual_rect((1500.0, 100.0, 300.0, 210.0), &DESK),
            (1810.0, 115.0, 1180.0, 850.0)
        );
        // A screen smaller than the usual size is filled instead.
        let small = [(0.0, 25.0, 1024.0, 743.0)];
        assert_eq!(
            usual_rect((10.0, 40.0, 300.0, 210.0), &small),
            (0.0, 25.0, 1024.0, 743.0)
        );
    }

    #[test]
    fn a_window_can_grow_as_far_as_the_screen_it_is_on() {
        assert_eq!(size_limit((1500.0, 100.0, 800.0, 600.0), &DESK), Some((1920.0, 1080.0)));
        assert_eq!(size_limit((100.0, 100.0, 800.0, 600.0), &DESK), Some((1440.0, 875.0)));
        assert_eq!(size_limit((100.0, 100.0, 800.0, 600.0), &[]), None);
    }

    #[test]
    fn saved_bounds_fit_available_monitors_and_keep_the_minimum() {
        let areas = [(0.0, 25.0, 1440.0, 875.0), (1440.0, 0.0, 1920.0, 1080.0)];
        let default = (100.0, 50.0, 1180.0, 850.0);
        assert_eq!(restored_rect(None, &areas, default), default);
        assert_eq!(
            restored_rect(Some((2000.0, 300.0, 520.0, 360.0)), &areas, default),
            (2000.0, 300.0, 520.0, 360.0)
        );
        assert_eq!(
            restored_rect(Some((1200.0, 650.0, 400.0, 300.0)), &areas, default),
            (1040.0, 600.0, 400.0, 300.0)
        );
        assert_eq!(
            restored_rect(Some((5000.0, 300.0, 460.0, 320.0)), &areas, default),
            (980.0, 300.0, 460.0, 320.0)
        );
        assert_eq!(
            restored_rect(Some((10.0, 30.0, 40.0, 30.0)), &areas, default),
            (10.0, 30.0, 300.0, 210.0)
        );
        let odd = [(-3194.4, 0.0, 1092.8, 840.0)];
        let (x, _, w, _) = restored_rect(Some((-3194.4, 10.0, 1092.8, 500.0)), &odd, default);
        assert!(x >= odd[0].0 - 0.001 && w <= odd[0].2);
        assert_eq!(
            restored_rect(Some((f64::NAN, 0.0, 500.0, 400.0)), &areas, default),
            default
        );
    }

    #[test]
    fn pin_confirmation_waits_for_the_native_setter_and_never_publishes_the_old_value() {
        use std::cell::RefCell;
        let steps = RefCell::new(Vec::new());
        let mut reads = [false, false, true].into_iter();
        let actual = confirm_always_on_top(
            true,
            |on| {
                assert!(on);
                steps.borrow_mut().push("set");
                Ok(())
            },
            || {
                steps.borrow_mut().push("get");
                Ok(reads.next().unwrap())
            },
            || {
                steps.borrow_mut().push("wait");
                true
            },
        )
        .unwrap();
        assert!(actual);
        assert_eq!(*steps.borrow(), ["set", "get", "wait", "get", "wait", "get"]);
        assert!(confirm_always_on_top(false, |_| Ok(()), || Ok(true), || false).is_err());
        assert_eq!(
            confirm_always_on_top(true, |_| Err("setter".into()), || panic!("setter failed"), || false),
            Err("setter".into())
        );
        assert_eq!(
            confirm_always_on_top(true, |_| Ok(()), || Err("getter".into()), || false),
            Err("getter".into())
        );
    }

    #[test]
    fn overlapping_window_changes_are_rejected_and_released_on_error() {
        let change = super::WindowChange::begin().unwrap();
        assert!(super::WindowChange::begin().is_err());
        drop(change);
        assert!(super::WindowChange::begin().is_ok());
    }

    #[test]
    fn normal_frame_confirmation_waits_for_linux_configure_events() {
        let wanted = (100.0, 80.0, 460.0, 320.0);
        let mut frames = [(0.0, 0.0, 1920.0, 1080.0), wanted].into_iter();
        assert!(super::confirm_normal_rect(wanted, || frames.next(), || true).is_ok());
        assert!(super::confirm_normal_rect(wanted, || Some((0.0, 0.0, 460.0, 320.0)), || false).is_err());
        assert!(super::confirm_normal_rect(wanted, || None, || false).is_err());
    }

    #[test]
    fn fullscreen_restore_checks_position_and_size_after_native_chrome_changes() {
        let wanted = (230.0, 160.0, 720.0, 510.0);
        assert!(super::same_rect(wanted, wanted));
        assert!(!super::same_rect(wanted, (230.0, 192.0, 720.0, 510.0)));
        assert!(!super::same_rect(wanted, (230.0, 160.0, 720.0, 542.0)));
    }

    #[test]
    fn fullscreen_confirmation_waits_until_the_native_transition_finishes() {
        let mut states = [(true, true), (true, true), (true, false)].into_iter();
        let mut waits = 0;
        assert_eq!(
            super::confirm_fullscreen(
                true,
                || Ok(states.next().unwrap()),
                || {
                    waits += 1;
                    true
                }
            ),
            Ok(true)
        );
        assert_eq!(waits, 2);
        assert!(super::confirm_fullscreen(false, || Ok((false, true)), || false).is_err());
        assert!(super::confirm_fullscreen(true, || Ok((false, false)), || false).is_err());
        assert_eq!(
            super::confirm_fullscreen(true, || Err("native".into()), || false),
            Err("native".into())
        );
    }

    #[test]
    fn resize_directions_accept_only_the_eight_native_edges() {
        for direction in [
            "North",
            "NorthEast",
            "East",
            "SouthEast",
            "South",
            "SouthWest",
            "West",
            "NorthWest",
        ] {
            assert!(resize_direction(direction).is_some());
        }
        assert!(resize_direction("sideways").is_none());
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

    #[cfg(target_os = "linux")]
    #[test]
    fn the_renderer_switch_is_set_only_when_the_person_left_it_unset() {
        use super::renderer_default;
        assert_eq!(renderer_default(None), Some(("WEBKIT_DISABLE_DMABUF_RENDERER", "1")));
        assert_eq!(renderer_default(Some(std::ffi::OsStr::new("0"))), None);
        assert_eq!(renderer_default(Some(std::ffi::OsStr::new(""))), None);
    }
}
