// Desktop overlay: one transparent, click-through window per monitor. Rust owns positions,
// drags, hover hit-testing and desktop roaming; the page (src/overlay/overlay.js) only draws.
use super::roam::{self, Bounds};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// Called with a friend's id and where it now stands, once a drag or a stroll ends.
pub type PositionFn = Arc<dyn Fn(&str, i64, i64) + Send + Sync>;

/// How often positions are advanced and windows brought in line.
const TICK: Duration = Duration::from_millis(40);
/// A tick that ran late (a busy machine, a slow wake) moves friends by at most this much time,
/// so nobody teleports.
const MAX_STEP: Duration = Duration::from_millis(120);
/// With nothing on the desktop there is nothing to advance: the loop only looks in now and then.
const IDLE_TICK: Duration = Duration::from_millis(400);
/// Friends on the desktop but still, and the pointer away from them: nothing to follow closely.
const CALM_TICK: Duration = Duration::from_millis(120);
/// How close (logical px) the pointer may come to a friend's box before the loop speeds up, so
/// its window takes the click by the time the pointer is on the friend: a pointer crossing it in
/// less than one calm tick moves faster than 2500 px/s.
const NEAR: f64 = 300.0;
/// Monitors are asked for again this often (a display plugged in or rearranged). Asking goes
/// through the main thread, so it is kept out of every tick and out of any lock.
const MONITOR_REFRESH: Duration = Duration::from_secs(2);
/// A drag nobody ended (the pointer-up never arrived) is ended for them.
const DRAG_TIMEOUT: Duration = Duration::from_secs(15);

#[derive(Clone)]
pub struct PetLite {
    pub id: String,
    pub size: f64,
    pub saved: Option<(f64, f64)>,
}

struct Drag {
    id: String,
    start: (f64, f64),
    origin: (f64, f64),
    at: Instant,
}
struct Roam {
    target: Option<(f64, f64)>,
    next_at: Instant,
}

#[derive(Default)]
struct Inner {
    pets: Vec<PetLite>,
    visible: bool,
    wander: bool,
    positions: HashMap<String, (f64, f64)>,
    drag: Option<Drag>,
    roams: HashMap<String, Roam>,
    ignored: HashMap<String, bool>,
    /// Whether any overlay window is (or is being) open; until all are closed the loop keeps its pace.
    open: bool,
    /// The monitors as last asked for, when, and the primary one's scale.
    mons: Vec<Mon>,
    mons_at: Option<Instant>,
    primary_scale: f64,
}

pub struct Overlay {
    inner: Arc<Mutex<Inner>>,
}

/// The box a friend of this size takes up: the sprite plus room for its speech bubble.
fn dims(size: f64) -> (f64, f64) {
    ((size + 48.0).max(200.0), (size * 208.0 / 192.0 + 88.0).round())
}

fn rand01() -> f64 {
    // A cheap thread-local xorshift: roaming needs variety, not quality.
    use std::cell::Cell;
    thread_local!(static SEED: Cell<u64> = const { Cell::new(0x9E3779B97F4A7C15) });
    SEED.with(|s| {
        let mut x = s.get();
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        s.set(x);
        (x >> 11) as f64 / (1u64 << 53) as f64
    })
}

/// A monitor: its work area in logical pixels, and its full rectangle in physical ones.
#[derive(Clone)]
struct Mon {
    id: String,
    area: Bounds,
    physical: Bounds,
    scale: f64,
}

fn monitors(app: &AppHandle) -> Vec<Mon> {
    app.available_monitors()
        .unwrap_or_default()
        .iter()
        .enumerate()
        .map(|(i, m)| {
            let scale = m.scale_factor();
            let work = m.work_area();
            let (pos, size) = (
                work.position.to_logical::<f64>(scale),
                work.size.to_logical::<f64>(scale),
            );
            let physical = Bounds {
                x: m.position().x as f64,
                y: m.position().y as f64,
                w: m.size().width as f64,
                h: m.size().height as f64,
            };
            Mon {
                id: i.to_string(),
                area: Bounds {
                    x: pos.x,
                    y: pos.y,
                    w: size.width,
                    h: size.height,
                },
                physical,
                scale,
            }
        })
        .collect()
}

/// The monitor whose work area starts closest to a point.
fn nearest(mons: &[Mon], x: f64, y: f64) -> Option<&Mon> {
    mons.iter()
        .min_by_key(|m| ((x - m.area.x).abs() + (y - m.area.y).abs()) as i64)
}

/// Maps tao's physical cursor into the logical space `monitors` uses (each monitor's
/// physical origin divided by its own scale). macOS: tao already scaled the logical
/// point by the primary monitor's factor. Windows/Linux: the point is raw pixels, so the
/// monitor under the cursor decides the scale — dividing by the primary scale puts the
/// cursor in the wrong place on a secondary monitor with a different scale.
fn cursor_to_logical(p: (f64, f64), mons: &[Mon], primary_scale: f64, macos: bool) -> (f64, f64) {
    if macos {
        return (p.0 / primary_scale, p.1 / primary_scale);
    }
    let under = mons.iter().find(|m| {
        p.0 >= m.physical.x
            && p.0 < m.physical.x + m.physical.w
            && p.1 >= m.physical.y
            && p.1 < m.physical.y + m.physical.h
    });
    let scale = under.map(|m| m.scale).unwrap_or(primary_scale);
    (p.0 / scale, p.1 / scale)
}

/// The monitors, asked for again when the last answer is older than MONITOR_REFRESH.
/// Never called with `inner` locked: asking goes through the main thread.
fn current_monitors(app: &AppHandle, inner: &Mutex<Inner>) -> (Vec<Mon>, f64) {
    {
        let d = inner.lock().unwrap();
        if d.mons_at.is_some_and(|at| at.elapsed() < MONITOR_REFRESH) && !d.mons.is_empty() {
            return (d.mons.clone(), d.primary_scale);
        }
    }
    let mons = monitors(app);
    let primary = app
        .primary_monitor()
        .ok()
        .flatten()
        .map(|m| m.scale_factor())
        .unwrap_or(1.0);
    let mut d = inner.lock().unwrap();
    d.mons = mons.clone();
    d.mons_at = Some(Instant::now());
    d.primary_scale = primary;
    (mons, primary)
}

fn cursor_in(app: &AppHandle, mons: &[Mon], primary_scale: f64) -> Option<(f64, f64)> {
    let p = app.cursor_position().ok()?;
    Some(cursor_to_logical(
        (p.x, p.y),
        mons,
        primary_scale,
        cfg!(target_os = "macos"),
    ))
}

fn clamp_to(area: &Bounds, x: f64, y: f64, w: f64, h: f64) -> (f64, f64) {
    (
        x.max(area.x).min(area.x + area.w - w),
        y.max(area.y).min(area.y + area.h - h),
    )
}

impl Overlay {
    pub fn new(app: AppHandle, on_position: PositionFn) -> Arc<Overlay> {
        let overlay = Arc::new(Overlay {
            inner: Arc::new(Mutex::new(Inner::default())),
        });
        let inner = overlay.inner.clone();
        std::thread::spawn(move || {
            // Friends walk by the time that really passed: sleep overshoots by a different amount
            // on each system, and a fixed step per tick made the same stroll faster on one than another.
            let mut last = Instant::now();
            let mut pace = IDLE_TICK;
            loop {
                let idle = {
                    let d = inner.lock().unwrap();
                    !(d.visible && !d.pets.is_empty()) && !d.open
                };
                std::thread::sleep(if idle { IDLE_TICK } else { pace });
                let dt = last.elapsed().min(MAX_STEP);
                last = Instant::now();
                if !idle {
                    let busy = tick(&app, &inner, &on_position, dt.as_secs_f64() * 1000.0);
                    pace = if busy { TICK } else { CALM_TICK };
                }
            }
        });
        overlay
    }

    pub fn sync(&self, pets: Vec<PetLite>, visible: bool, wander: bool) {
        let mut d = self.inner.lock().unwrap();
        d.visible = visible;
        d.wander = wander;
        if !wander {
            d.roams.clear();
        }
        let ids: Vec<String> = pets.iter().map(|p| p.id.clone()).collect();
        d.positions.retain(|k, _| ids.contains(k));
        d.roams.retain(|k, _| ids.contains(k));
        if d.drag.as_ref().map(|g| !ids.contains(&g.id)).unwrap_or(false) {
            d.drag = None;
        }
        d.pets = pets;
    }

    /// The pointer, where the overlay's monitors put it (for a drag that starts now).
    pub fn cursor(&self, app: &AppHandle) -> Option<(f64, f64)> {
        let (mons, primary) = current_monitors(app, &self.inner);
        cursor_in(app, &mons, primary)
    }

    pub fn drag_start(&self, id: &str, cursor: (f64, f64)) {
        let mut d = self.inner.lock().unwrap();
        let Some(origin) = d.positions.get(id).copied() else {
            return;
        };
        d.drag = Some(Drag {
            id: id.into(),
            start: cursor,
            origin,
            at: Instant::now(),
        });
    }

    /// Where every friend stands, by the monitors as last asked for. Asks nothing of the main
    /// thread, so it is safe to call while holding the app's state lock.
    pub fn layout(&self) -> Vec<Value> {
        let d = self.inner.lock().unwrap();
        layout_of(&d, &d.mons)
    }
}

/// Where every friend stands and which monitor's window draws it: the one its centre is nearest to.
fn layout_of(d: &Inner, mons: &[Mon]) -> Vec<Value> {
    d.pets
        .iter()
        .filter_map(|p| {
            let (x, y) = d.positions.get(&p.id)?;
            let (w, h) = dims(p.size);
            let (cx, cy) = (x + w / 2.0, y + h / 2.0);
            let mon = mons.iter().min_by_key(|m| {
                let dx = (cx - (m.area.x + m.area.w / 2.0)).abs();
                let dy = (cy - (m.area.y + m.area.h / 2.0)).abs();
                (dx + dy) as i64
            })?;
            Some(
                json!({"id": p.id, "x": x, "y": y, "width": w, "height": h, "displayId": mon.id,
                    "origin": {"x": mon.area.x, "y": mon.area.y, "width": mon.area.w, "height": mon.area.h}}),
            )
        })
        .collect()
}

/// Since macOS 10.14 a regular app's NSWindow cannot float over another app's
/// fullscreen Space; a non-activating NSPanel can. tao only builds NSWindows, so the
/// overlay is re-classed as an NSPanel subclass. That is memory-safe because NSPanel
/// adds no instance variables (same instance size as NSWindow) and the subclass
/// re-declares tao's single `focusable` ivar at the same position.
/// tao's own class is remembered so the window can be handed back before it closes.
#[cfg(target_os = "macos")]
static TAO_WINDOW_CLASS: std::sync::OnceLock<usize> = std::sync::OnceLock::new();
#[cfg(target_os = "macos")]
const NONACTIVATING_PANEL: usize = 1 << 7;
#[cfg(target_os = "macos")]
fn float_over_fullscreen(win: &tauri::WebviewWindow) {
    use objc2::runtime::{AnyClass, AnyObject, Bool, ClassBuilder, Sel};
    use objc2::{msg_send, sel};
    use std::sync::OnceLock;
    const CAN_JOIN_ALL_SPACES: usize = 1 << 0;
    const STATIONARY: usize = 1 << 4;
    const IGNORES_CYCLE: usize = 1 << 6;
    const FULL_SCREEN_AUXILIARY: usize = 1 << 8;
    const STATUS_WINDOW_LEVEL: isize = 25;
    extern "C" fn never(_: &AnyObject, _: Sel) -> Bool {
        Bool::NO
    }
    static PANEL: OnceLock<Option<&'static AnyClass>> = OnceLock::new();
    let panel = PANEL.get_or_init(|| {
        let superclass = AnyClass::get(c"NSPanel")?;
        let mut builder = ClassBuilder::new(c"PlayPetsOverlayPanel", superclass)?;
        builder.add_ivar::<Bool>(c"focusable");
        unsafe {
            builder.add_method(sel!(canBecomeKeyWindow), never as extern "C" fn(_, _) -> _);
            builder.add_method(sel!(canBecomeMainWindow), never as extern "C" fn(_, _) -> _);
        }
        Some(builder.register())
    });
    let Ok(ptr) = win.ns_window() else { return };
    let window = ptr as *mut AnyObject;
    unsafe {
        let size_matches = AnyClass::get(c"NSPanel")
            .zip(AnyClass::get(c"NSWindow"))
            .is_some_and(|(p, w)| p.instance_size() == w.instance_size());
        if let (Some(panel), true) = (panel, size_matches) {
            let original = objc2::ffi::object_setClass(window, *panel as *const AnyClass);
            TAO_WINDOW_CLASS.get_or_init(|| original as usize);
            let mask: usize = msg_send![window, styleMask];
            let _: () = msg_send![window, setStyleMask: mask | NONACTIVATING_PANEL];
            let _: () = msg_send![window, setHidesOnDeactivate: false];
            let _: () = msg_send![window, setFloatingPanel: true];
        }
        let behavior: usize = msg_send![window, collectionBehavior];
        let _: () = msg_send![window, setCollectionBehavior: behavior | CAN_JOIN_ALL_SPACES | STATIONARY | IGNORES_CYCLE | FULL_SCREEN_AUXILIARY];
        let _: () = msg_send![window, setLevel: STATUS_WINDOW_LEVEL];
    }
}
#[cfg(not(target_os = "macos"))]
fn float_over_fullscreen(_win: &tauri::WebviewWindow) {}

/// Closing a re-classed window makes tao's teardown raise an Objective-C exception, which
/// aborts the whole app. The overlay becomes a plain tao window again before it closes.
#[cfg(target_os = "macos")]
fn restore_window_class(win: &tauri::WebviewWindow) {
    use objc2::msg_send;
    use objc2::runtime::{AnyClass, AnyObject};
    let (Some(&original), Ok(ptr)) = (TAO_WINDOW_CLASS.get(), win.ns_window()) else {
        return;
    };
    let window = ptr as *mut AnyObject;
    unsafe {
        let mask: usize = msg_send![window, styleMask];
        let _: () = msg_send![window, setStyleMask: mask & !NONACTIVATING_PANEL];
        objc2::ffi::object_setClass(window, original as *const AnyClass);
    }
}
#[cfg(not(target_os = "macos"))]
fn restore_window_class(_win: &tauri::WebviewWindow) {}

fn bridge_js(display: &str) -> String {
    format!("{}\nwindow.__DISPLAY='{}';", crate::commands::bridge_js(), display)
}

/// One step. Returns whether the next should come soon: something moves, a friend is being
/// dragged, or the pointer is near one.
fn tick(app: &AppHandle, inner: &Arc<Mutex<Inner>>, on_position: &PositionFn, dt_ms: f64) -> bool {
    let (mons, primary) = current_monitors(app, inner);
    let cursor = cursor_in(app, &mons, primary);
    let mut arrivals: Vec<(String, i64, i64)> = Vec::new();
    let (moved, busy) = {
        let mut d = inner.lock().unwrap();
        let placed = place_newcomers(&mut d, &mons);
        let dragged = follow_drag(&mut d, &mons, cursor, &mut arrivals);
        let strolled = stroll(&mut d, &mons, cursor, dt_ms, &mut arrivals);
        let moved = placed || dragged || strolled;
        let walking = d.roams.values().any(|r| r.target.is_some());
        (moved, moved || walking || d.drag.is_some() || pointer_near(&d, cursor))
    };
    // Saving happens outside the lock: it reaches back into the app state.
    for (id, x, y) in &arrivals {
        on_position(id, *x, *y);
    }
    sync_windows(app, inner, &mons, cursor, moved || !arrivals.is_empty());
    busy
}

/// Whether the pointer is on or near any friend's box.
fn pointer_near(d: &Inner, cursor: Option<(f64, f64)>) -> bool {
    let Some((cx, cy)) = cursor else { return false };
    d.pets.iter().any(|p| {
        let Some(&(x, y)) = d.positions.get(&p.id) else {
            return false;
        };
        let (w, h) = dims(p.size);
        cx >= x - NEAR && cx <= x + w + NEAR && cy >= y - NEAR && cy <= y + h + NEAR
    })
}

/// Friends new to the desktop stand where they were last left, or in a row along the bottom
/// of the primary work area.
fn place_newcomers(d: &mut Inner, mons: &[Mon]) -> bool {
    let (true, Some(primary)) = (d.visible, mons.first()) else {
        return false;
    };
    let mut placed = false;
    for (index, p) in d.pets.iter().enumerate() {
        if d.positions.contains_key(&p.id) {
            continue;
        }
        let (w, h) = dims(p.size);
        let fallback = (
            primary.area.x + 35.0 + (index % 6) as f64 * 145.0,
            primary.area.y + primary.area.h - h - 25.0 - (index / 6) as f64 * 145.0,
        );
        let start = p.saved.unwrap_or(fallback);
        let area = &nearest(mons, start.0, start.1).unwrap_or(primary).area;
        d.positions.insert(p.id.clone(), clamp_to(area, start.0, start.1, w, h));
        placed = true;
    }
    placed
}

/// A dragged friend follows the cursor.
fn follow_drag(
    d: &mut Inner,
    mons: &[Mon],
    cursor: Option<(f64, f64)>,
    arrivals: &mut Vec<(String, i64, i64)>,
) -> bool {
    let (Some(cursor), Some(drag)) = (cursor, d.drag.as_ref()) else {
        return false;
    };
    let (id, timed_out) = (drag.id.clone(), drag.at.elapsed() > DRAG_TIMEOUT);
    let next = (
        drag.origin.0 + cursor.0 - drag.start.0,
        drag.origin.1 + cursor.1 - drag.start.1,
    );
    let mut moved = d.positions.get(&id) != Some(&next);
    if moved {
        d.positions.insert(id, next);
    }
    if timed_out {
        finish_drag(d, mons, arrivals);
        moved = true;
    }
    moved
}

/// Friends left alone stroll now and then; one under the cursor stays put to be petted.
fn stroll(
    d: &mut Inner,
    mons: &[Mon],
    cursor: Option<(f64, f64)>,
    dt_ms: f64,
    arrivals: &mut Vec<(String, i64, i64)>,
) -> bool {
    if !d.wander || !d.visible || d.drag.is_some() {
        return false;
    }
    let now = Instant::now();
    let rest = || now + Duration::from_millis(roam::delay(rand01(), roam::ROAM_DELAY) as u64);
    let mut moved = false;
    for p in &d.pets {
        let Some(&(px, py)) = d.positions.get(&p.id) else {
            continue;
        };
        let (w, h) = dims(p.size);
        if cursor.is_some_and(|c| c.0 >= px - 30.0 && c.0 <= px + w + 30.0 && c.1 >= py - 30.0 && c.1 <= py + h + 30.0)
        {
            if let Some(r) = d.roams.get_mut(&p.id) {
                r.target = None;
            }
            continue;
        }
        let roaming = d.roams.entry(p.id.clone()).or_insert_with(|| Roam {
            target: None,
            next_at: rest(),
        });
        match roaming.target {
            None if now >= roaming.next_at => {
                let area = nearest(mons, px, py).map(|m| m.area).unwrap_or(Bounds {
                    x: 0.0,
                    y: 0.0,
                    w: 1440.0,
                    h: 900.0,
                });
                roaming.target = Some(roam::roam_target(
                    &Bounds { x: px, y: py, w, h },
                    &area,
                    rand01(),
                    rand01(),
                    rand01(),
                ));
            }
            None => {}
            Some((tx, ty)) => {
                let (nx, ny, done) = roam::step_toward(px, py, tx, ty, dt_ms);
                d.positions.insert(p.id.clone(), (nx, ny));
                moved = true;
                if done {
                    roaming.target = None;
                    roaming.next_at = rest();
                    arrivals.push((p.id.clone(), nx.round() as i64, ny.round() as i64));
                }
            }
        }
    }
    moved
}

/// Per monitor: is the cursor over a friend drawn there? Only then does that window take clicks.
fn hovered(d: &Inner, layout: &[Value], cursor: Option<(f64, f64)>) -> HashMap<String, bool> {
    let mut hover: HashMap<String, bool> = HashMap::new();
    let Some(c) = cursor else { return hover };
    for item in layout {
        let display = item["displayId"].as_str().unwrap_or("").to_string();
        let (x, y) = (item["x"].as_f64().unwrap_or(0.0), item["y"].as_f64().unwrap_or(0.0));
        let (w, h) = (
            item["width"].as_f64().unwrap_or(0.0),
            item["height"].as_f64().unwrap_or(0.0),
        );
        let pet = d.pets.iter().find(|p| p.id == item["id"].as_str().unwrap_or(""));
        let margin = pet.map(|p| (w - p.size) / 2.0).unwrap_or(0.0);
        // The top 60px of the box belong to the speech bubble, which lets clicks through.
        let inside = c.0 >= x + margin && c.0 <= x + w - margin && c.1 >= y + 60.0 && c.1 <= y + h;
        *hover.entry(display).or_insert(false) |= inside;
    }
    hover
}

/// Opens, updates or closes each monitor's window. Windows are built and closed on the main thread.
fn sync_windows(app: &AppHandle, inner: &Arc<Mutex<Inner>>, mons: &[Mon], cursor: Option<(f64, f64)>, moved: bool) {
    let (visible, layout, hover, dragging) = {
        let d = inner.lock().unwrap();
        let layout = layout_of(&d, mons);
        let hover = hovered(&d, &layout, cursor);
        (d.visible && !d.pets.is_empty(), layout, hover, d.drag.is_some())
    };
    let mut open = visible;
    for mon in mons {
        let label = format!("overlay{}", mon.id);
        let existing = app.get_webview_window(&label);
        open |= existing.is_some();
        match (visible, existing) {
            (true, None) => {
                let app2 = app.clone();
                let mon_id = mon.id.clone();
                let area = mon.area;
                let _ = app.run_on_main_thread(move || {
                    if app2.get_webview_window(&label).is_some() {
                        return;
                    }
                    if let Ok(win) = WebviewWindowBuilder::new(&app2, &label, WebviewUrl::App("overlay.html".into()))
                        .title("PlayPets overlay")
                        .on_navigation(crate::window::own_page)
                        .transparent(true)
                        .decorations(false)
                        .shadow(false)
                        .always_on_top(true)
                        .skip_taskbar(true)
                        .focused(false)
                        .visible_on_all_workspaces(true)
                        .position(area.x, area.y)
                        .inner_size(area.w, area.h)
                        .initialization_script(bridge_js(&mon_id))
                        .build()
                    {
                        let _ = win.set_ignore_cursor_events(true);
                        float_over_fullscreen(&win);
                    }
                });
            }
            (true, Some(win)) => {
                let ignore = !(hover.get(&mon.id).copied().unwrap_or(false) || dragging);
                let before = inner.lock().unwrap().ignored.insert(mon.id.clone(), ignore);
                if before != Some(ignore) {
                    let _ = win.set_ignore_cursor_events(ignore);
                }
                if moved {
                    let payload = json!({"type": "layout", "layout": layout});
                    let _ = win.eval(format!("window.__pp&&__pp('event',{payload})"));
                }
            }
            (false, Some(win)) => {
                let _ = app.run_on_main_thread(move || {
                    restore_window_class(&win);
                    let _ = win.close();
                });
            }
            (false, None) => {}
        }
    }
    inner.lock().unwrap().open = open;
}

/// Ends a drag: the friend is set down inside the nearest work area, and that place is saved.
fn finish_drag(d: &mut Inner, mons: &[Mon], arrivals: &mut Vec<(String, i64, i64)>) {
    let Some(drag) = d.drag.take() else { return };
    let Some(pet) = d.pets.iter().find(|p| p.id == drag.id) else {
        return;
    };
    let Some(&(x, y)) = d.positions.get(&drag.id) else {
        return;
    };
    let (w, h) = dims(pet.size);
    let area = nearest(mons, x, y).map(|m| m.area).unwrap_or(Bounds {
        x: 0.0,
        y: 0.0,
        w: 10_000.0,
        h: 10_000.0,
    });
    let (cx, cy) = clamp_to(&area, x, y, w, h);
    d.positions.insert(drag.id.clone(), (cx, cy));
    arrivals.push((drag.id, cx.round() as i64, cy.round() as i64));
}

pub fn stop_drag_and_save(overlay: &Overlay, app: &AppHandle, on_position: &PositionFn) {
    let (mons, _) = current_monitors(app, &overlay.inner);
    let mut arrivals = Vec::new();
    finish_drag(&mut overlay.inner.lock().unwrap(), &mons, &mut arrivals);
    for (id, x, y) in arrivals {
        on_position(&id, x, y);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mon(id: &str, px: f64, py: f64, pw: f64, ph: f64, scale: f64) -> Mon {
        let b = |x: f64, y: f64, w: f64, h: f64| Bounds { x, y, w, h };
        Mon {
            id: id.into(),
            area: b(px / scale, py / scale, pw / scale, ph / scale),
            physical: b(px, py, pw, ph),
            scale,
        }
    }

    #[test]
    fn mixed_dpi_cursor_lands_on_the_monitor_under_it() {
        // Windows: 4K primary at 150%, 1080p secondary at 100% to its right.
        let mons = [
            mon("0", 0.0, 0.0, 3840.0, 2160.0, 1.5),
            mon("1", 3840.0, 0.0, 1920.0, 1080.0, 1.0),
        ];
        let on_secondary = cursor_to_logical((4000.0, 100.0), &mons, 1.5, false);
        assert_eq!(on_secondary, (4000.0, 100.0));
        let area = &mons[1].area;
        assert!(
            on_secondary.0 >= area.x && on_secondary.0 <= area.x + area.w,
            "old primary-scale math gave x=2666, outside every monitor"
        );
        assert_eq!(cursor_to_logical((300.0, 150.0), &mons, 1.5, false), (200.0, 100.0));
        // Off every monitor (mid-transition): fall back to the primary scale.
        assert_eq!(cursor_to_logical((-30.0, 0.0), &mons, 1.5, false), (-20.0, 0.0));
    }

    #[test]
    fn macos_cursor_uses_the_primary_scale_tao_applied() {
        // Retina primary (2x) + 1x external: tao returns logical × primary scale everywhere.
        let mons = [
            mon("0", 0.0, 0.0, 3456.0, 2234.0, 2.0),
            mon("1", 1728.0, 0.0, 1920.0, 1080.0, 1.0),
        ];
        assert_eq!(cursor_to_logical((3600.0, 200.0), &mons, 2.0, true), (1800.0, 100.0));
    }
}
