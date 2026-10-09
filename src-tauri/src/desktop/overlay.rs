// Desktop overlay: one transparent, click-through window per monitor. Rust owns positions,
// drags, hover hit-testing and desktop roaming; the page (src/overlay/overlay.js) only draws.
use super::macos::{float_over_fullscreen, restore_window_class};
use super::roam::{self, Bounds};
use super::screens::{Mon, clamp_to, cursor_to_logical, monitor_of_box, monitors};
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
    /// The friend the pointer is on, as last told to the pages (they show its name button).
    hover_pet: Option<String>,
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

/// The box a friend of this size takes up: the sprite, room for its speech bubble above (the
/// top BUBBLE_ROOM) and for its name below (the bottom FOOT, shown while the pointer is on it).
fn dims(size: f64) -> (f64, f64) {
    ((size + 48.0).max(200.0), (size * 208.0 / 192.0 + 88.0 + FOOT).round())
}
/// The top of a friend's box is for its speech bubble, which lets clicks through.
const BUBBLE_ROOM: f64 = 60.0;
/// Under the sprite: the name button (src/overlay/overlay.css, `.friend` bottom).
const FOOT: f64 = 24.0;

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

/// Where every friend stands and which monitor's window draws it: the one its centre is on.
fn layout_of(d: &Inner, mons: &[Mon]) -> Vec<Value> {
    d.pets
        .iter()
        .filter_map(|p| {
            let (x, y) = d.positions.get(&p.id)?;
            let (w, h) = dims(p.size);
            let mon = monitor_of_box(mons, *x, *y, (w, h))?;
            Some(
                json!({"id": p.id, "x": x, "y": y, "width": w, "height": h, "displayId": mon.id,
                    "origin": {"x": mon.area.x, "y": mon.area.y, "width": mon.area.w, "height": mon.area.h}}),
            )
        })
        .collect()
}

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
        let area = &monitor_of_box(mons, start.0, start.1, (w, h)).unwrap_or(primary).area;
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
                let area = monitor_of_box(mons, px, py, (w, h)).map(|m| m.area).unwrap_or(Bounds {
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
/// Also which friend that is.
fn hovered(d: &Inner, layout: &[Value], cursor: Option<(f64, f64)>) -> (HashMap<String, bool>, Option<String>) {
    let mut hover: HashMap<String, bool> = HashMap::new();
    let mut pet_id = None;
    let Some(c) = cursor else { return (hover, pet_id) };
    for item in layout {
        let display = item["displayId"].as_str().unwrap_or("").to_string();
        let (x, y) = (item["x"].as_f64().unwrap_or(0.0), item["y"].as_f64().unwrap_or(0.0));
        let (w, h) = (
            item["width"].as_f64().unwrap_or(0.0),
            item["height"].as_f64().unwrap_or(0.0),
        );
        let pet = d.pets.iter().find(|p| p.id == item["id"].as_str().unwrap_or(""));
        let margin = pet.map(|p| (w - p.size) / 2.0).unwrap_or(0.0);
        let inside = c.0 >= x + margin && c.0 <= x + w - margin && c.1 >= y + BUBBLE_ROOM && c.1 <= y + h;
        if inside && pet_id.is_none() {
            pet_id = item["id"].as_str().map(String::from);
        }
        *hover.entry(display).or_insert(false) |= inside;
    }
    (hover, pet_id)
}

/// Opens, updates or closes each monitor's window. Windows are built and closed on the main thread.
fn sync_windows(app: &AppHandle, inner: &Arc<Mutex<Inner>>, mons: &[Mon], cursor: Option<(f64, f64)>, moved: bool) {
    let (visible, layout, hover, dragging, hover_changed) = {
        let mut d = inner.lock().unwrap();
        let layout = layout_of(&d, mons);
        let (hover, pet_id) = hovered(&d, &layout, cursor);
        let changed = d.hover_pet != pet_id;
        d.hover_pet = pet_id;
        let event = changed.then(|| json!({"type": "hover", "petId": d.hover_pet}));
        (d.visible && !d.pets.is_empty(), layout, hover, d.drag.is_some(), event)
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
                if let Some(payload) = &hover_changed {
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
    let area = monitor_of_box(mons, x, y, (w, h)).map(|m| m.area).unwrap_or(Bounds {
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
