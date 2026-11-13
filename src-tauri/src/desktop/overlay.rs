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

/// A friend or a decoration out on the desktop (items.rs says which).
#[derive(Clone)]
pub struct Item {
    pub id: String,
    /// A friend's size (its sprite's width in pixels); unused for a decoration.
    pub size: f64,
    pub saved: Option<(f64, f64)>,
    /// A decoration: its kind and the box it is drawn in. It stays where it is put, on the floor.
    pub decor: Option<(String, f64, f64)>,
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
    /// The decoration this walk goes to (its id and kind), told to the pages when the friend gets there.
    visiting: Option<(String, String)>,
}

#[derive(Default)]
struct Inner {
    pets: Vec<Item>,
    visible: bool,
    wander: bool,
    positions: HashMap<String, (f64, f64)>,
    drag: Option<Drag>,
    roams: HashMap<String, Roam>,
    ignored: HashMap<String, bool>,
    /// Each monitor's items as last sent to its window: a window hears only its own, and only
    /// when they moved, so a friend walking on one screen leaves the others' windows asleep.
    sent: HashMap<String, Value>,
    /// The friend the pointer is on, as last told to the pages (they show its name button).
    hover_pet: Option<String>,
    /// Whether any overlay window is (or is being) open; until all are closed the loop keeps its pace.
    open: bool,
    /// The monitors as last asked for, when, and the primary one's scale.
    mons: Vec<Mon>,
    mons_at: Option<Instant>,
    primary_scale: f64,
    /// Things whose box changed size since it was last kept (a tree grew): kept again on the next
    /// step, where the new place is saved.
    resized: Vec<String>,
}

pub struct Overlay {
    inner: Arc<Mutex<Inner>>,
}

/// The box a friend takes up: the sprite, room for its speech bubble above (the top BUBBLE_ROOM)
/// and for its name below (the bottom FOOT, shown while the pointer is on it). A decoration's is
/// its drawing.
fn dims(item: &Item) -> (f64, f64) {
    if let Some((_, w, h)) = item.decor {
        return (w, h);
    }
    let size = item.size;
    ((size + 48.0).max(200.0), (size * 208.0 / 192.0 + 88.0 + FOOT).round())
}
/// A friend's sprite stands this far above the bottom of its box (FOOT in overlay.js).
const SPRITE_FOOT: f64 = FOOT + 4.0;
/// How often a friend setting off on a stroll goes over to a decoration on its screen instead.
const VISIT_CHANCE: f64 = 0.4;
/// The floor line on a screen: a foot this far above its work area's bottom. Friends start in a row
/// on it, and a gift, a flower or a planted tree always rests on it.
const FLOOR_GAP: f64 = 25.0;
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
        let d = crate::app::hold(inner);
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
    let mut d = crate::app::hold(inner);
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
                    let d = crate::app::hold(&inner);
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

    pub fn sync(&self, pets: Vec<Item>, visible: bool, wander: bool) {
        let mut d = crate::app::hold(&self.inner);
        d.visible = visible;
        d.wander = wander;
        if !wander {
            d.roams.clear();
        }
        let ids: Vec<String> = pets.iter().map(|p| p.id.clone()).collect();
        d.positions.retain(|k, _| ids.contains(k));
        let Inner {
            pets: old, positions, ..
        } = &mut *d;
        let grown = keep_feet(old, &pets, positions);
        d.resized.extend(grown);
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
        let mut d = crate::app::hold(&self.inner);
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
        let d = crate::app::hold(&self.inner);
        layout_of(&d, &d.mons)
    }
}

/// Where every friend stands and which monitor's window draws it: the one its centre is on.
fn layout_of(d: &Inner, mons: &[Mon]) -> Vec<Value> {
    d.pets
        .iter()
        .filter_map(|p| {
            let (x, y) = d.positions.get(&p.id)?;
            let (w, h) = dims(p);
            let mon = monitor_of_box(mons, *x, *y, (w, h))?;
            let mut item = json!({"id": p.id, "x": x, "y": y, "width": w, "height": h, "displayId": mon.id,
                "origin": {"x": mon.area.x, "y": mon.area.y, "width": mon.area.w, "height": mon.area.h}});
            if let Some((kind, _, _)) = &p.decor {
                item["decor"] = json!(kind);
            }
            Some(item)
        })
        .collect()
}

fn bridge_js(display: &str) -> String {
    format!("{}\nwindow.__DISPLAY='{}';", crate::commands::bridge_js(), display)
}

/// A thing out whose box changed size (a tree that grew) keeps standing where it stood: the bottom
/// middle of its box stays put. Returns the ones moved.
fn keep_feet(old: &[Item], new: &[Item], positions: &mut HashMap<String, (f64, f64)>) -> Vec<String> {
    let mut moved = Vec::new();
    for item in new {
        let (Some(before), Some(at)) = (old.iter().find(|o| o.id == item.id), positions.get_mut(&item.id)) else {
            continue;
        };
        let ((w0, h0), (w1, h1)) = (dims(before), dims(item));
        if (w0, h0) != (w1, h1) {
            *at = (at.0 + (w0 - w1) / 2.0, at.1 + h0 - h1);
            moved.push(item.id.clone());
        }
    }
    moved
}

/// One step. Returns whether the next should come soon: something moves, a friend is being
/// dragged, or the pointer is near one.
fn tick(app: &AppHandle, inner: &Arc<Mutex<Inner>>, on_position: &PositionFn, dt_ms: f64) -> bool {
    let (mons, primary) = current_monitors(app, inner);
    let cursor = cursor_in(app, &mons, primary);
    let mut arrivals: Vec<(String, i64, i64)> = Vec::new();
    let mut visits: Vec<(String, String)> = Vec::new();
    let (moved, busy) = {
        let mut d = crate::app::hold(inner);
        let placed = place_newcomers(&mut d, &mons);
        // Saved as a drop is, on the screen it is on now.
        for id in std::mem::take(&mut d.resized) {
            if let Some(&(x, y)) = d.positions.get(&id) {
                arrivals.push((id, x.round() as i64, y.round() as i64));
            }
        }
        let dragged = follow_drag(&mut d, &mons, cursor, &mut arrivals);
        let strolled = stroll(&mut d, &mons, cursor, dt_ms, &mut arrivals, &mut visits);
        let moved = placed || dragged || strolled;
        let walking = d.roams.values().any(|r| r.target.is_some());
        (moved, moved || walking || d.drag.is_some() || pointer_near(&d, cursor))
    };
    // Saving happens outside the lock: it reaches back into the app state.
    for (id, x, y) in &arrivals {
        on_position(id, *x, *y);
    }
    // A friend that walked over to a decoration says something about it (overlay.js).
    for (pet, kind) in &visits {
        crate::app::push_event(app, &json!({"type": "visit", "petId": pet, "kind": kind}));
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
        let (w, h) = dims(p);
        cx >= x - NEAR && cx <= x + w + NEAR && cy >= y - NEAR && cy <= y + h + NEAR
    })
}

/// Friends new to the desktop stand where they were last left, or in a row along the bottom
/// of the primary work area; a gift, a flower or a tree on the floor, at its last x (set_down).
fn place_newcomers(d: &mut Inner, mons: &[Mon]) -> bool {
    let (true, Some(primary)) = (d.visible, mons.first()) else {
        return false;
    };
    let mut placed = false;
    let (mut friends, mut decorations) = (0, 0);
    for p in &d.pets {
        let index = if p.decor.is_some() {
            &mut decorations
        } else {
            &mut friends
        };
        *index += 1;
        let index = *index - 1;
        if d.positions.contains_key(&p.id) {
            continue;
        }
        let (w, h) = dims(p);
        // Friends in a row from the left; decorations from the right, so the two do not stack up.
        let fallback = if p.decor.is_some() {
            (
                primary.area.x + primary.area.w - w - 60.0 - (index % 5) as f64 * 180.0,
                primary.area.y + primary.area.h - h - FLOOR_GAP,
            )
        } else {
            (
                primary.area.x + 35.0 + (index % 6) as f64 * 145.0,
                primary.area.y + primary.area.h - h - FLOOR_GAP - (index / 6) as f64 * 145.0,
            )
        };
        let start = p.saved.unwrap_or(fallback);
        let area = &monitor_of_box(mons, start.0, start.1, (w, h)).unwrap_or(primary).area;
        d.positions.insert(p.id.clone(), set_down(p, area, start));
        placed = true;
    }
    placed
}

/// Where something set down at `at` on a screen's work area rests: inside the area; and a gift, a
/// flower or a planted tree with its foot on the floor line at the same x, as it stands on the
/// ground in the yard, so none is left hanging mid-screen. A friend keeps the spot: it strolls up
/// and down the screen as well as across (roam.rs).
fn set_down(item: &Item, area: &Bounds, at: (f64, f64)) -> (f64, f64) {
    let (w, h) = dims(item);
    let y = if item.decor.is_some() {
        area.y + area.h - h - FLOOR_GAP
    } else {
        at.1
    };
    clamp_to(area, at.0, y, w, h)
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
    visits: &mut Vec<(String, String)>,
) -> bool {
    if !d.wander || !d.visible || d.drag.is_some() {
        return false;
    }
    let now = Instant::now();
    let rest = || now + Duration::from_millis(roam::delay(rand01(), roam::ROAM_DELAY) as u64);
    let mut moved = false;
    // The decorations out, where they stand: a stroll may go to one.
    let decorations: Vec<(String, String, Bounds)> = d
        .pets
        .iter()
        .filter_map(|item| {
            let (kind, w, h) = item.decor.clone()?;
            let &(x, y) = d.positions.get(&item.id)?;
            Some((item.id.clone(), kind, Bounds { x, y, w, h }))
        })
        .collect();
    for p in d.pets.iter().filter(|p| p.decor.is_none()) {
        let Some(&(px, py)) = d.positions.get(&p.id) else {
            continue;
        };
        let (w, h) = dims(p);
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
            visiting: None,
        });
        match roaming.target {
            None if now >= roaming.next_at => {
                let mon = monitor_of_box(mons, px, py, (w, h));
                let area = mon.map(|m| m.area).unwrap_or(Bounds {
                    x: 0.0,
                    y: 0.0,
                    w: 1440.0,
                    h: 900.0,
                });
                let here = Bounds { x: px, y: py, w, h };
                // Only one on the same screen: a walk never crosses from one monitor to another.
                let near: Vec<_> = decorations
                    .iter()
                    .filter(|(_, _, b)| monitor_of_box(mons, b.x, b.y, (b.w, b.h)).map(|m| &m.id) == mon.map(|m| &m.id))
                    .collect();
                roaming.visiting = None;
                roaming.target = Some(if !near.is_empty() && rand01() < VISIT_CHANCE {
                    let (id, kind, b) = near[((rand01() * near.len() as f64) as usize).min(near.len() - 1)];
                    roaming.visiting = Some((id.clone(), kind.clone()));
                    roam::beside(&here, p.size, SPRITE_FOOT, b, &area, rand01() < 0.5)
                } else {
                    roam::roam_target(&here, &area, rand01(), rand01(), rand01())
                });
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
                    if let Some((_, kind)) = roaming.visiting.take() {
                        visits.push((p.id.clone(), kind));
                    }
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
        // A friend takes clicks on its sprite and name, not on the room for its bubble; a decoration on all of it.
        let (margin, top) = match pet {
            Some(p) if p.decor.is_none() => ((w - p.size) / 2.0, BUBBLE_ROOM),
            _ => (0.0, 0.0),
        };
        let inside = c.0 >= x + margin && c.0 <= x + w - margin && c.1 >= y + top && c.1 <= y + h;
        if inside && pet_id.is_none() {
            pet_id = item["id"].as_str().map(String::from);
        }
        *hover.entry(display).or_insert(false) |= inside;
    }
    (hover, pet_id)
}

/// Whether a monitor's window is wanted: only where something stands, so an empty screen keeps no
/// page and no loop of its own. While a friend is being carried every screen has one, ready for it
/// to arrive.
fn needs_window(visible: bool, dragging: bool, layout: &[Value], mon_id: &str) -> bool {
    visible && (dragging || layout.iter().any(|item| item["displayId"] == mon_id))
}

/// Opens, updates or closes each monitor's window. Windows are built and closed on the main thread.
fn sync_windows(app: &AppHandle, inner: &Arc<Mutex<Inner>>, mons: &[Mon], cursor: Option<(f64, f64)>, moved: bool) {
    let (visible, layout, hover, dragging, hover_changed) = {
        let mut d = crate::app::hold(inner);
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
        match (needs_window(visible, dragging, &layout, &mon.id), existing) {
            (true, None) => {
                // A new window starts from the whole state; the next move is sent to it in full.
                crate::app::hold(inner).sent.remove(&mon.id);
                let app2 = app.clone();
                let mon_id = mon.id.clone();
                let area = mon.area;
                let _ = app.run_on_main_thread(move || {
                    if app2.get_webview_window(&label).is_some() {
                        return;
                    }
                    if let Ok(win) = WebviewWindowBuilder::new(&app2, &label, WebviewUrl::App("overlay.html".into()))
                        .title("PlayPets overlay")
                        .incognito(crate::commands::e2e_mode())
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
                let before = crate::app::hold(inner).ignored.insert(mon.id.clone(), ignore);
                if before != Some(ignore) {
                    let _ = win.set_ignore_cursor_events(ignore);
                }
                if moved {
                    let own: Vec<&Value> = layout
                        .iter()
                        .filter(|item| item["displayId"] == mon.id.as_str())
                        .collect();
                    let own = json!(own);
                    let fresh = crate::app::hold(inner).sent.get(&mon.id) != Some(&own);
                    if fresh {
                        let payload = json!({"type": "layout", "layout": own});
                        let _ = win.eval(format!("window.__pp&&__pp('event',{payload})"));
                        crate::app::hold(inner).sent.insert(mon.id.clone(), own);
                    }
                }
                if let Some(payload) = &hover_changed {
                    let _ = win.eval(format!("window.__pp&&__pp('event',{payload})"));
                }
            }
            (false, Some(win)) => {
                // A window opened again later is built ignoring the pointer and hears everything anew.
                let mut d = crate::app::hold(inner);
                d.sent.remove(&mon.id);
                d.ignored.remove(&mon.id);
                drop(d);
                let _ = app.run_on_main_thread(move || {
                    restore_window_class(&win);
                    let _ = win.close();
                });
            }
            (false, None) => {}
        }
    }
    crate::app::hold(inner).open = open;
}

/// Ends a drag: the thing carried is set down on the nearest work area (set_down), and that place
/// is saved.
fn finish_drag(d: &mut Inner, mons: &[Mon], arrivals: &mut Vec<(String, i64, i64)>) {
    let Some(drag) = d.drag.take() else { return };
    let Some(pet) = d.pets.iter().find(|p| p.id == drag.id) else {
        return;
    };
    let Some(&(x, y)) = d.positions.get(&drag.id) else {
        return;
    };
    let (w, h) = dims(pet);
    let area = monitor_of_box(mons, x, y, (w, h)).map(|m| m.area).unwrap_or(Bounds {
        x: 0.0,
        y: 0.0,
        w: 10_000.0,
        h: 10_000.0,
    });
    let (cx, cy) = set_down(pet, &area, (x, y));
    d.positions.insert(drag.id.clone(), (cx, cy));
    arrivals.push((drag.id, cx.round() as i64, cy.round() as i64));
}

pub fn stop_drag_and_save(overlay: &Overlay, app: &AppHandle, on_position: &PositionFn) {
    let (mons, _) = current_monitors(app, &overlay.inner);
    let mut arrivals = Vec::new();
    finish_drag(&mut crate::app::hold(&overlay.inner), &mons, &mut arrivals);
    for (id, x, y) in arrivals {
        on_position(&id, x, y);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_a_screen_with_something_on_it_keeps_a_window() {
        let layout = vec![json!({"id": "pip", "displayId": "1"})];
        assert!(needs_window(true, false, &layout, "1"));
        assert!(
            !needs_window(true, false, &layout, "2"),
            "an empty screen has no window"
        );
        assert!(
            needs_window(true, true, &layout, "2"),
            "a friend carried over is drawn as it arrives"
        );
        assert!(!needs_window(false, true, &layout, "1"), "a hidden desktop has none");
    }

    #[test]
    fn a_tree_that_grows_on_the_desktop_keeps_its_foot_where_it_stood() {
        let tree = |w, h| Item {
            id: "cherry".into(),
            size: 0.0,
            saved: None,
            decor: Some(("cherry".into(), w, h)),
        };
        let mut positions = HashMap::from([("cherry".to_string(), (500.0, 600.0))]);
        assert!(keep_feet(&[tree(35.0, 40.0)], &[tree(35.0, 40.0)], &mut positions).is_empty());
        assert_eq!(
            keep_feet(&[tree(35.0, 40.0)], &[tree(71.0, 95.0)], &mut positions),
            ["cherry"]
        );
        // The bottom middle stays at (517.5, 640).
        assert_eq!(positions["cherry"], (482.0, 545.0));
        // Something new has no size before: it is placed as a newcomer is.
        assert!(keep_feet(&[], &[tree(160.0, 170.0)], &mut positions).is_empty());
    }

    fn screen() -> Vec<Mon> {
        let b = |x, y, w, h| Bounds { x, y, w, h };
        // A 1440×900 screen whose work area ends above a 75px dock.
        vec![Mon {
            id: "0".into(),
            area: b(0.0, 25.0, 1440.0, 800.0),
            physical: b(0.0, 0.0, 1440.0, 900.0),
            scale: 1.0,
        }]
    }
    fn out(id: &str, saved: Option<(f64, f64)>, decor: Option<(f64, f64)>) -> Item {
        Item {
            id: id.into(),
            size: 96.0,
            saved,
            decor: decor.map(|(w, h)| (id.to_string(), w, h)),
        }
    }
    fn dropped(d: &mut Inner, id: &str, at: (f64, f64)) -> Vec<(String, i64, i64)> {
        d.positions.insert(id.into(), at);
        d.drag = Some(Drag {
            id: id.into(),
            start: (0.0, 0.0),
            origin: at,
            at: Instant::now(),
        });
        let mut arrivals = Vec::new();
        finish_drag(d, &screen(), &mut arrivals);
        arrivals
    }

    // The work area's floor line: a foot 25px above its bottom (825).
    const FLOOR: f64 = 800.0;

    #[test]
    fn a_tree_a_flower_or_a_gift_let_go_mid_screen_comes_down_to_the_floor() {
        let mut d = Inner {
            pets: vec![
                out("cherry", None, Some((160.0, 170.0))),
                out("tulip", None, Some((50.0, 75.0))),
                out("bench", None, Some((151.0, 121.0))),
            ],
            ..Inner::default()
        };
        for (id, h) in [("cherry", 170.0), ("tulip", 75.0), ("bench", 121.0)] {
            // Let go high up the screen: it keeps its x, and its foot rests on the floor line.
            assert_eq!(
                dropped(&mut d, id, (600.0, 200.0)),
                [(id.to_string(), 600, (FLOOR - h) as i64)]
            );
            assert_eq!(d.positions[id], (600.0, FLOOR - h));
            // Let go below the floor, or past the screen's side: on the floor, inside the screen.
            dropped(&mut d, id, (1500.0, 790.0));
            let (w, _) = dims(d.pets.iter().find(|p| p.id == id).unwrap());
            assert_eq!(d.positions[id], (1440.0 - w, FLOOR - h));
        }
    }

    #[test]
    fn a_friend_let_go_stays_where_it_is_put() {
        let mut d = Inner {
            pets: vec![out("pip", None, None)],
            ..Inner::default()
        };
        assert_eq!(dropped(&mut d, "pip", (600.0, 200.0)), [("pip".to_string(), 600, 200)]);
    }

    #[test]
    fn a_thing_back_on_the_desktop_stands_on_the_floor_at_its_saved_x() {
        let mut d = Inner {
            visible: true,
            pets: vec![
                out("cherry", Some((300.0, 120.0)), Some((160.0, 170.0))),
                out("tulip", None, Some((50.0, 75.0))),
                out("pip", Some((300.0, 120.0)), None),
            ],
            ..Inner::default()
        };
        assert!(place_newcomers(&mut d, &screen()));
        // Saved high up the screen: back on the floor, where it was across.
        assert_eq!(d.positions["cherry"], (300.0, FLOOR - 170.0));
        // A first time out: on the floor from the right.
        assert_eq!(d.positions["tulip"], (1440.0 - 50.0 - 60.0 - 180.0, FLOOR - 75.0));
        // A friend keeps its saved spot.
        assert_eq!(d.positions["pip"], (300.0, 120.0));
    }
}
