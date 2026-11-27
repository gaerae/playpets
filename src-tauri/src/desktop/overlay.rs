// Desktop overlay: one transparent, click-through window per monitor. Rust owns positions,
// drags, hover hit-testing and desktop roaming; the page (src/overlay/overlay.js) only draws.
use super::grass::{self, Span};
use super::macos::{float_over_fullscreen, restore_window_class};
use super::roam::{self, Bounds};
use super::screens::{Mon, clamp_to, cursor_to_logical, monitor_of_box, monitors};
use crate::pets::catalog::{CELL_WIDTH, ROW_HEIGHT};
use crate::pets::content::catalog;
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
/// Nothing out but a window still open, waiting to close (LINGER): the loop only looks in now and
/// then.
const IDLE_TICK: Duration = Duration::from_millis(400);
/// Nothing out and no window open: the loop waits for `wake`, which every change that sends
/// something out rings, so this is only a safety net.
const REST: Duration = Duration::from_secs(2);
/// A screen's window stays this long, empty and click-through, after the last thing on it left or
/// after the yard asked for it (`warm`): building one and loading its page takes most of a second,
/// and something sent out again soon, or the thing whose menu is open, then shows at once.
const LINGER: Duration = Duration::from_secs(60);
/// Friends on the desktop but still, and the pointer away from them: nothing to follow closely.
const CALM_TICK: Duration = Duration::from_millis(120);
/// How close (logical px) the pointer may come to a friend's box before the loop speeds up, so
/// its window takes the click by the time the pointer is on the friend: a pointer crossing it in
/// less than one calm tick moves faster than POINTER_SPEED.
const NEAR: f64 = 300.0;
/// The pointer speed (logical px/s) the calm loop keeps up with: NEAR in one CALM_TICK. Farther
/// away it looks less often, as late as a pointer this fast could still not have reached a friend.
const POINTER_SPEED: f64 = 2500.0;
/// The longest the calm loop waits: each look asks the main thread where the pointer is, and a
/// friend reached faster than POINTER_SPEED takes the click at most this late.
const CALM_MAX: Duration = Duration::from_millis(500);
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
    /// Where a decoration's drawing ends, as a share of its box's height from the top (catalog.json
    /// "foot"): it stands on the floor there. 1 for a friend.
    pub foot: f64,
    /// A gift that hangs (catalog.json "hangs"): set down near a screen's top, it hangs from it.
    pub hangs: bool,
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
    /// Where each friend is drawn in its sprite's cell, as its page measured it (set_body): shares
    /// [left, top, right, bottom]. Until then its whole sprite takes the pointer.
    bodies: HashMap<String, [f64; 4]>,
    /// Whether any overlay window is (or is being) open; until all are closed the loop keeps its pace.
    open: bool,
    /// The monitors as last asked for, when, and the primary one's scale.
    mons: Vec<Mon>,
    mons_at: Option<Instant>,
    /// The screens' work areas changed since things were placed (keep_on_screens).
    rescreen: bool,
    primary_scale: f64,
    /// Things whose box changed size since it was last kept (a tree grew): kept again on the next
    /// step, where the new place is saved.
    resized: Vec<String>,
    /// A drag ended since the last step (finish_drag): the windows hear on the next step where the
    /// thing was set down, though nothing else moves.
    dropped: bool,
    /// What is out changed since the last `wake` (sync): the loop is woken once the pages were told.
    news: bool,
    /// Every window hears the layout again on the next step: the state the pages were just sent
    /// carries a layout from before the loop placed what came out.
    resend: bool,
    /// Each screen whose window is kept, and until when (LINGER): one with something on it, one
    /// whose last thing left a moment ago, one the yard asked for (`warm`).
    warm: HashMap<String, Instant>,
    /// The thing whose menu the yard just opened: the screen it would land on gets its window.
    warming: Option<Item>,
    /// The grass along the first screen's floor while its switch is on (Prefs::grass), and how far it
    /// reaches (grass.rs).
    grass: Option<Span>,
    /// When the page last said a grass end is being dragged: meanwhile the screen takes the pointer.
    grass_drag: Option<Instant>,
    /// Since when the pointer has rested on a grass end (grass::DWELL).
    grip_since: Option<Instant>,
    /// Whether the pointer is over the bare grass, as last told to the page (it thins meanwhile).
    over_grass: bool,
    /// Whether the pointer shows it pulls a grass end, as last set on the window.
    pull: bool,
    /// Each thing that came out while the app runs, and when (ARRIVE): its page drops a friend in
    /// and pops a gift, a flower or a tree up. What was out at the first sync is just there.
    arrived: HashMap<String, Instant>,
    /// Whether the first sync has come.
    synced: bool,
}

/// How long a thing that came out counts as arriving: long enough for a window opened for it to
/// load and hear so.
const ARRIVE: Duration = Duration::from_secs(6);

/// Whether `id` came out within ARRIVE before `now`.
fn arriving_at(d: &Inner, id: &str, now: Instant) -> bool {
    d.arrived
        .get(id)
        .is_some_and(|at| now.saturating_duration_since(*at) < ARRIVE)
}

pub struct Overlay {
    inner: Arc<Mutex<Inner>>,
    /// The loop's thread, unparked by `wake` and `warm`.
    looper: std::thread::Thread,
}

/// The box a friend takes up: the sprite, room for its speech bubble above (the top BUBBLE_ROOM)
/// and for its name below (the bottom FOOT, shown while the pointer is on it). A decoration's is
/// its drawing.
fn dims(item: &Item) -> (f64, f64) {
    if let Some((_, w, h)) = item.decor {
        return (w, h);
    }
    let size = item.size;
    ((size + 48.0).max(200.0), (sprite_height(size) + 88.0 + FOOT).round())
}
/// How tall a friend `size` wide is drawn: its sprite sheet's cells keep their shape.
fn sprite_height(size: f64) -> f64 {
    size * f64::from(ROW_HEIGHT) / f64::from(CELL_WIDTH)
}
/// A friend's sprite stands this far above the bottom of its box (FOOT in overlay.js).
const SPRITE_FOOT: f64 = FOOT + 4.0;
/// How often a friend setting off on a stroll goes over to a decoration on its screen instead.
const VISIT_CHANCE: f64 = 0.4;
/// The floor line on a screen: this far above its work area's bottom. Friends start in a row with
/// their sprites' feet on it, and the drawing of a gift, a flower or a planted tree always ends on it.
/// Lower on the screen with the grass (grass::FLOOR_GAP).
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
    d.rescreen |= !d.mons.is_empty() && !same_areas(&d.mons, &mons);
    d.mons = mons.clone();
    d.mons_at = Some(Instant::now());
    d.primary_scale = primary;
    (mons, primary)
}

/// Whether two looks at the monitors found the same screens with the same work areas.
fn same_areas(a: &[Mon], b: &[Mon]) -> bool {
    a.len() == b.len()
        && a.iter().zip(b).all(|(m, n)| {
            m.id == n.id && (m.area.x, m.area.y, m.area.w, m.area.h) == (n.area.x, n.area.y, n.area.w, n.area.h)
        })
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
        let inner = Arc::new(Mutex::new(Inner::default()));
        let looping = inner.clone();
        let looper = std::thread::spawn(move || {
            // Friends walk by the time that really passed: sleep overshoots by a different amount
            // on each system, and a fixed step per tick made the same stroll faster on one than another.
            let mut last = Instant::now();
            let mut wait = IDLE_TICK;
            loop {
                // A wake ends the wait at once: what was sent out is placed and drawn now, not at
                // the next look in.
                std::thread::park_timeout(wait);
                let dt = last.elapsed().min(MAX_STEP);
                last = Instant::now();
                let (out, open) = activity(&crate::app::hold(&looping));
                let pace = (out || open).then(|| tick(&app, &looping, &on_position, dt.as_secs_f64() * 1000.0));
                let (out, open) = activity(&crate::app::hold(&looping));
                wait = match (out, open) {
                    (true, _) => pace.unwrap_or(TICK),
                    (false, true) => IDLE_TICK,
                    (false, false) => REST,
                };
            }
        });
        Arc::new(Overlay {
            inner,
            looper: looper.thread().clone(),
        })
    }

    /// Wakes the loop when what is out changed since the last call, so it is placed and drawn now.
    /// Called once every page was sent the change (app::changed): the layout the loop then sends
    /// comes after it, so a page never takes the change's older layout for the last word.
    pub fn wake(&self) {
        let mut d = crate::app::hold(&self.inner);
        if !std::mem::take(&mut d.news) {
            return;
        }
        d.resend = true;
        d.sent.clear();
        drop(d);
        self.looper.unpark();
    }

    /// The yard opened the menu of `item`, which is not out: the screen it would land on gets its
    /// window now, empty and click-through, so choosing Show on desktop shows it at once. Kept for
    /// LINGER if nothing comes out.
    pub fn warm(&self, item: Item) {
        crate::app::hold(&self.inner).warming = Some(item);
        self.looper.unpark();
    }

    /// Everything was brought in with the switch: the windows close now rather than linger.
    pub fn rest(&self) {
        let mut d = crate::app::hold(&self.inner);
        d.warm.clear();
        d.warming = None;
        drop(d);
        self.looper.unpark();
    }

    pub fn sync(&self, pets: Vec<Item>, visible: bool, wander: bool, grass: Option<Span>) {
        let mut d = crate::app::hold(&self.inner);
        let same =
            d.visible == visible && d.pets.len() == pets.len() && d.pets.iter().zip(&pets).all(|(a, b)| a.id == b.id);
        d.news |= !same;
        // An end still held keeps where it is pulled to; the saved span comes back once it is let go.
        let held = d.grass_drag.is_some() && grass.is_some() && d.grass.is_some();
        if !held && d.grass != grass {
            d.grass = grass;
            d.grass_drag = None;
            d.news = true;
        }
        // What comes out now arrives: sent out while things are shown, or all of it as desktop
        // mode comes on; at the first sync, what is out was already there.
        let now = Instant::now();
        d.arrived.retain(|_, at| now.saturating_duration_since(*at) < ARRIVE);
        if d.synced && visible {
            let came: Vec<String> = pets
                .iter()
                .filter(|p| !d.visible || !d.pets.iter().any(|o| o.id == p.id))
                .map(|p| p.id.clone())
                .collect();
            for id in came {
                d.arrived.insert(id, now);
            }
        }
        d.synced = true;
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
        // A calm loop may look in only every CALM_MAX: a thing that grew is placed now.
        d.news |= !grown.is_empty();
        d.resized.extend(grown);
        d.roams.retain(|k, _| ids.contains(k));
        d.bodies.retain(|k, _| ids.contains(k));
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

    /// The grass as the overlay page draws it (`ground_view`), by the monitors as last asked for.
    pub fn ground(&self) -> Value {
        let d = crate::app::hold(&self.inner);
        ground_view(&d, &d.mons)
    }

    /// The page measured where friend `id` is drawn in its sprite's cell (shares [left, top, right,
    /// bottom]), or could not (None): the pointer is taken there from the next look (hovered).
    pub fn set_body(&self, id: &str, body: Option<[f64; 4]>) {
        let mut d = crate::app::hold(&self.inner);
        match body {
            Some(body) => d.bodies.insert(id.to_string(), body),
            None => d.bodies.remove(id),
        };
    }
    /// The page in window `from` pulled a grass end to `left`/`right` (logical pixels): the grass
    /// reaches there now. While `dragging` the screen keeps the pointer; once let go, the span to
    /// save. None while dragging, with no grass out, without both ends, or from a window other
    /// than the one drawing the grass.
    pub fn set_grass(&self, from: &str, left: f64, right: f64, dragging: bool) -> Option<Span> {
        if !(left.is_finite() && right.is_finite()) {
            return None;
        }
        let mut d = crate::app::hold(&self.inner);
        let (mon, _) = ground(&d, &d.mons)?;
        if from.strip_prefix("overlay") != Some(mon.id.as_str()) {
            return None;
        }
        let area = d.mons.first()?.area;
        let span = Span::from_ends(&area, left, right);
        d.grass = Some(span);
        d.grass_drag = dragging.then(Instant::now);
        if !dragging {
            // Every window hears where it ends now, the one that pulled it too.
            d.resend = true;
        }
        drop(d);
        self.looper.unpark();
        (!dragging).then_some(span)
    }
}

/// The grass's screen (the first, where friends first come out) and its ends there, while it is
/// switched on and something is out.
fn ground<'m>(d: &Inner, mons: &'m [Mon]) -> Option<(&'m Mon, (f64, f64))> {
    let (true, Some(span), Some(mon)) = (d.visible, d.grass, mons.first()) else {
        return None;
    };
    Some((mon, span.ends(&mon.area)))
}

/// What the overlay page draws of the grass (grass::view), or null with none out.
fn ground_view(d: &Inner, mons: &[Mon]) -> Value {
    ground(d, mons).map_or(Value::Null, lawn_view)
}

/// What the overlay page draws of the grass out on `mon` with these ends (`ground` gives both).
fn lawn_view((mon, ends): (&Mon, (f64, f64))) -> Value {
    grass::view(&mon.id, &mon.area, ends)
}

/// Whether the grass's screen takes the pointer for the grass (`lawn`, as `ground` gives it) at
/// `now`: anywhere on it while an end is dragged (until the page stops telling,
/// grass::DRAG_STALE), else on an end the pointer has rested on (grass::DWELL).
fn grass_takes(d: &mut Inner, lawn: Option<(&Mon, (f64, f64))>, cursor: Option<(f64, f64)>, now: Instant) -> bool {
    let (Some((mon, ends)), Some(c)) = (lawn, cursor) else {
        d.grip_since = None;
        d.grass_drag = None;
        return false;
    };
    let area = mon.area;
    match d.grass_drag {
        Some(at) if now.saturating_duration_since(at) < grass::DRAG_STALE => return area.contains(c),
        Some(_) => d.grass_drag = None,
        None => {}
    }
    if !grass::on_grip(&area, ends, c) {
        d.grip_since = None;
        return false;
    }
    now.saturating_duration_since(*d.grip_since.get_or_insert(now)) >= grass::DWELL
}

/// Whether anything is out to step, and whether a window is open or asked for: with neither, the
/// loop has nothing to do.
fn activity(d: &Inner) -> (bool, bool) {
    (
        d.visible && !d.pets.is_empty(),
        d.open || d.warming.is_some() || !d.warm.is_empty(),
    )
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
            if hung(p, *y, &mon.area) {
                item["hung"] = json!(true);
            }
            // On its way: how far it still has to go, for the page to bring its legs to a stop.
            if let Some((tx, ty)) = d.roams.get(&p.id).and_then(|r| r.target) {
                item["toGo"] = json!((tx - x).hypot(ty - y));
            }
            // Held: it follows the pointer with no glide, also in a window on another screen, which
            // never had the press (pointer capture stays where the drag began).
            if d.drag.as_ref().is_some_and(|g| g.id == p.id) {
                item["dragging"] = json!(true);
            }
            if arriving_at(d, &p.id, Instant::now()) {
                item["arriving"] = json!(true);
            }
            Some(item)
        })
        .collect()
}

fn bridge_js(display: &str) -> String {
    format!("{}\nwindow.__DISPLAY='{}';", crate::commands::bridge_js(), display)
}

/// A thing out whose box changed size (a tree that grew), or whose drawing now ends elsewhere in it (a
/// flower that bloomed), keeps standing where it stood: the middle of where its drawing ends stays
/// put. Returns the ones moved.
fn keep_feet(old: &[Item], new: &[Item], positions: &mut HashMap<String, (f64, f64)>) -> Vec<String> {
    let mut moved = Vec::new();
    for item in new {
        let (Some(before), Some(at)) = (old.iter().find(|o| o.id == item.id), positions.get_mut(&item.id)) else {
            continue;
        };
        let ((w0, h0), (w1, h1)) = (dims(before), dims(item));
        if (w0, h0, before.foot) != (w1, h1, item.foot) {
            *at = (at.0 + (w0 - w1) / 2.0, at.1 + h0 * before.foot - h1 * item.foot);
            moved.push(item.id.clone());
        }
    }
    moved
}

/// One step. Returns how long until the next (`pace`).
fn tick(app: &AppHandle, inner: &Arc<Mutex<Inner>>, on_position: &PositionFn, dt_ms: f64) -> Duration {
    let (mons, primary) = current_monitors(app, inner);
    let cursor = cursor_in(app, &mons, primary);
    let mut arrivals: Vec<(String, i64, i64)> = Vec::new();
    let mut visits: Vec<(String, String, String)> = Vec::new();
    let (moved, busy) = {
        let mut d = crate::app::hold(inner);
        if let Some(item) = d.warming.take()
            && let Some(mon) = landing(&item, floor_gap(&d, &mons), &mons)
        {
            d.warm.insert(mon.id.clone(), Instant::now() + LINGER);
        }
        let placed = place_newcomers(&mut d, &mons);
        place_resized(&mut d, &mons, &mut arrivals);
        let rescreened = std::mem::take(&mut d.rescreen) && keep_on_screens(&mut d, &mons, &mut arrivals);
        let dragged = follow_drag(&mut d, &mons, cursor, &mut arrivals);
        let strolled = stroll(&mut d, &mons, cursor, dt_ms, &mut arrivals, &mut visits);
        let moved = placed
            || rescreened
            || dragged
            || strolled
            || std::mem::take(&mut d.dropped)
            || std::mem::take(&mut d.resend);
        (moved, pace(&d, &mons, cursor, moved, Instant::now()))
    };
    // Saving happens outside the lock: it reaches back into the app state.
    for (id, x, y) in &arrivals {
        on_position(id, *x, *y);
    }
    // A friend that walked over to a decoration says something about it (overlay.js), naming the
    // find a find out holds, which the page looks up by the decoration's id.
    for (pet, decor, kind) in &visits {
        crate::app::push_event(
            app,
            &json!({"type": "visit", "petId": pet, "decorId": decor, "kind": kind}),
        );
    }
    sync_windows(app, inner, &mons, cursor, moved || !arrivals.is_empty());
    busy
}

/// How long until the next step: TICK while something moves, a friend or a grass end is held, or
/// the pointer is near a friend; otherwise as long as calm_wait allows. The grass's grips count
/// there with the friends, not here: they sit in the screen's bottom corners, where a pointer
/// rests all day (a Start button, a Dock), and a calm look every CALM_TICK still sees it rest on
/// one well within grass::DWELL.
fn pace(d: &Inner, mons: &[Mon], cursor: Option<(f64, f64)>, moved: bool, now: Instant) -> Duration {
    let walking = d.roams.values().any(|r| r.target.is_some());
    if moved || walking || d.drag.is_some() || d.grass_drag.is_some() || pointer_near(d, cursor) {
        return TICK;
    }
    let grips = ground(d, mons).map(|(mon, ends)| grass::grips(&mon.area, ends));
    calm_wait(d, grips.as_ref().map_or(&[], |g| g.as_slice()), cursor, now)
}

/// With nothing moving: how long the loop may wait before it looks again. The pointer cannot reach
/// any friend's box, nor any of `also` (the grass's grips), at POINTER_SPEED before then (the
/// straight line to its nearest point), and a friend's next stroll starts on time. Between
/// CALM_TICK and CALM_MAX.
fn calm_wait(d: &Inner, also: &[Bounds], cursor: Option<(f64, f64)>, now: Instant) -> Duration {
    let reach = cursor.map_or(CALM_MAX, |c| {
        let boxes = d.pets.iter().filter_map(|p| {
            let &(x, y) = d.positions.get(&p.id)?;
            let (w, h) = dims(p);
            Some(Bounds { x, y, w, h })
        });
        let gap = boxes
            .chain(also.iter().copied())
            .map(|b| b.gap(c))
            .fold(f64::INFINITY, f64::min);
        Duration::from_secs_f64((gap / POINTER_SPEED).min(CALM_MAX.as_secs_f64()))
    });
    let stroll = d
        .roams
        .values()
        .filter(|r| d.wander && r.target.is_none())
        .map(|r| r.next_at.saturating_duration_since(now))
        .min()
        .unwrap_or(CALM_MAX);
    reach.min(stroll).clamp(CALM_TICK, CALM_MAX)
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

/// Friends, gifts, flowers and trees new to the desktop stand where they were last left, or in a
/// row along the bottom of the primary work area (start_of), inside the work area (set_down).
fn place_newcomers(d: &mut Inner, mons: &[Mon]) -> bool {
    let (true, Some(primary)) = (d.visible, mons.first()) else {
        return false;
    };
    let floor = floor_gap(d, mons);
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
        let start = start_of(p, index, primary, floor);
        let area = &screen_of(p, start, mons, primary).area;
        d.positions.insert(p.id.clone(), set_down(p, area, start));
        placed = true;
    }
    placed
}

/// Where a newcomer starts (before set_down): where it was last left, else the `index`th place of
/// its row on the primary screen. Friends in a row from the left; decorations from the right, so the
/// two do not stack up, each with its drawn foot on the line friends' feet start on, as it stands on
/// the ground in the yard.
fn start_of(p: &Item, index: usize, primary: &Mon, floor: f64) -> (f64, f64) {
    let (w, h) = dims(p);
    let fallback = if p.decor.is_some() {
        (
            primary.area.x + primary.area.w - w - 60.0 - (index % 5) as f64 * 180.0,
            // A friend's box ends SPRITE_FOOT below its sprite's feet.
            primary.area.y + primary.area.h - floor - SPRITE_FOOT - h * p.foot,
        )
    } else {
        (
            primary.area.x + 35.0 + (index % 6) as f64 * 145.0,
            primary.area.y + primary.area.h - h - floor - (index / 6) as f64 * 145.0,
        )
    };
    p.saved.unwrap_or(fallback)
}

/// The screen a newcomer starting at `start` stands on: the one under it, else the primary.
fn screen_of<'a>(p: &Item, start: (f64, f64), mons: &'a [Mon], primary: &'a Mon) -> &'a Mon {
    monitor_of_box(mons, start.0, start.1, dims(p)).unwrap_or(primary)
}

/// The floor line's height above the primary work area's bottom (FLOOR_GAP). With the grass out
/// the floor is lower, so feet stand in it rather than on its tips.
fn floor_gap(d: &Inner, mons: &[Mon]) -> f64 {
    if ground(d, mons).is_some() {
        grass::FLOOR_GAP
    } else {
        FLOOR_GAP
    }
}

/// The screen `item` lands on when it is sent out, as place_newcomers places it with the floor line
/// `floor` (floor_gap) above the primary work area's bottom.
fn landing<'a>(item: &Item, floor: f64, mons: &'a [Mon]) -> Option<&'a Mon> {
    let primary = mons.first()?;
    Some(screen_of(item, start_of(item, 0, primary, floor), mons, primary))
}

/// How near a work area's top a hanging gift's box is set down to hang from it.
const HANG_REACH: f64 = 32.0;

/// Whether `item` with its box's top at `y` hangs from the top of `area` (or will, let go there).
fn hung(item: &Item, y: f64, area: &Bounds) -> bool {
    item.hangs && y - area.y < HANG_REACH
}

/// Where something set down at `at` on a screen's work area rests: the same spot, kept inside the
/// area. A gift, a flower or a tree stays where it is put, as a friend does, so a person can lay
/// them out anywhere on the screen; a hanging gift near the top goes up to hang from it.
fn set_down(item: &Item, area: &Bounds, at: (f64, f64)) -> (f64, f64) {
    let (w, h) = dims(item);
    let (x, y) = clamp_to(area, at.0, at.1, w, h);
    (x, if hung(item, y, area) { area.y } else { y })
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

/// A decoration a stroll may go to: its id and kind, the box it stands in, where its drawing ends
/// (`Item::foot`) and the screen it is on.
struct Reach<'m> {
    id: String,
    kind: String,
    at: Bounds,
    foot: f64,
    monitor: Option<&'m str>,
}

/// The decorations out that a friend can walk to. One hung from a screen's top is out of reach.
fn reachable<'m>(pets: &[Item], positions: &HashMap<String, (f64, f64)>, mons: &'m [Mon]) -> Vec<Reach<'m>> {
    pets.iter()
        .filter_map(|item| {
            let (kind, w, h) = item.decor.clone()?;
            let &(x, y) = positions.get(&item.id)?;
            let mon = monitor_of_box(mons, x, y, (w, h));
            if mon.is_some_and(|m| hung(item, y, &m.area)) {
                return None;
            }
            Some(Reach {
                id: item.id.clone(),
                kind,
                at: Bounds { x, y, w, h },
                foot: item.foot,
                monitor: mon.map(|m| m.id.as_str()),
            })
        })
        .collect()
}

/// Friends left alone stroll now and then; one under the cursor stays put to be petted.
fn stroll(
    d: &mut Inner,
    mons: &[Mon],
    cursor: Option<(f64, f64)>,
    dt_ms: f64,
    arrivals: &mut Vec<(String, i64, i64)>,
    visits: &mut Vec<(String, String, String)>,
) -> bool {
    if !d.wander || !d.visible || d.drag.is_some() {
        return false;
    }
    let now = Instant::now();
    let rest = || now + Duration::from_millis(roam::delay(rand01(), roam::ROAM_DELAY) as u64);
    let mut moved = false;
    // Looked up only when a friend picks where to go, not on every step of a walk.
    let mut decorations: Option<Vec<Reach>> = None;
    // On the grass's screen a friend walks over the grass.
    let lawn = ground(d, mons);
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
                let area = match (lawn, mon) {
                    (Some((grass_mon, ends)), Some(m)) if grass_mon.id == m.id => {
                        let (gx, gw) = grass::walk_range(&area, ends, (w - p.size) / 2.0);
                        Bounds {
                            x: gx,
                            w: gw.max(w),
                            ..area
                        }
                    }
                    _ => area,
                };
                let here = Bounds { x: px, y: py, w, h };
                // Only one on the same screen: a walk never crosses from one monitor to another.
                let screen = mon.map(|m| m.id.as_str());
                let near: Vec<_> = decorations
                    .get_or_insert_with(|| reachable(&d.pets, &d.positions, mons))
                    .iter()
                    .filter(|r| r.monitor == screen)
                    .collect();
                roaming.visiting = None;
                roaming.target = Some(if !near.is_empty() && rand01() < VISIT_CHANCE {
                    let to = near[((rand01() * near.len() as f64) as usize).min(near.len() - 1)];
                    roaming.visiting = Some((to.id.clone(), to.kind.clone()));
                    // Onto a bench or a swing, as in the yard; beside anything else.
                    if catalog().stood_on(&to.kind) {
                        roam::onto(&here, p.size, SPRITE_FOOT, &to.at, to.foot, &area, rand01())
                    } else {
                        roam::beside(&here, p.size, SPRITE_FOOT, &to.at, &area, rand01() < 0.5)
                    }
                } else {
                    roam::roam_target(&here, &area, rand01(), rand01(), rand01())
                });
            }
            None => {}
            Some((tx, ty)) => {
                let (nx, ny, done) = roam::step_toward(px, py, tx, ty, dt_ms, p.size);
                d.positions.insert(p.id.clone(), (nx, ny));
                moved = true;
                if done {
                    roaming.target = None;
                    roaming.next_at = rest();
                    arrivals.push((p.id.clone(), nx.round() as i64, ny.round() as i64));
                    if let Some((decor, kind)) = roaming.visiting.take() {
                        visits.push((p.id.clone(), decor, kind));
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
        let within = |left: f64, top: f64, right: f64, bottom: f64| {
            Bounds {
                x: left,
                y: top,
                w: right - left,
                h: bottom - top,
            }
            .contains(c)
        };
        // A friend takes clicks on its drawing, and on its name under it once it has the pointer; not
        // on the empty rest of its cell nor the room for its bubble. A decoration takes them on all of
        // it. A friend not measured yet takes them on its whole sprite and name.
        let inside = match pet {
            Some(p) if p.decor.is_none() => {
                let (sw, sh) = (p.size, sprite_height(p.size));
                let (sx, sy) = (x + (w - sw) / 2.0, y + h - SPRITE_FOOT - sh);
                match d.bodies.get(&p.id) {
                    Some([l, t, r, b]) => {
                        within(sx + l * sw, sy + t * sh, sx + r * sw, sy + b * sh)
                            || d.hover_pet.as_deref() == Some(p.id.as_str())
                                && within(sx, y + h - SPRITE_FOOT, sx + sw, y + h)
                    }
                    None => within(sx, y + BUBBLE_ROOM, sx + sw, y + h),
                }
            }
            _ => within(x, y, x + w, y + h),
        };
        if inside && pet_id.is_none() {
            pet_id = item["id"].as_str().map(String::from);
        }
        *hover.entry(display).or_insert(false) |= inside;
    }
    (hover, pet_id)
}

/// Whether a monitor's window is wanted: where something stands, and for LINGER after (`warm`, as
/// keep_warm keeps it), so an empty screen keeps no page for long. While a friend is being carried
/// every screen has one, ready for it to arrive.
fn needs_window(visible: bool, dragging: bool, layout: &[Value], mon_id: &str, warm: bool) -> bool {
    warm || visible && (dragging || layout.iter().any(|item| item["displayId"] == mon_id))
}

/// Each screen with something on it is kept LINGER past `now`; one whose time is up, or that is
/// gone, is let go.
fn keep_warm(warm: &mut HashMap<String, Instant>, visible: bool, layout: &[Value], mons: &[Mon], now: Instant) {
    warm.retain(|id, until| *until > now && mons.iter().any(|m| &m.id == id));
    if !visible {
        return;
    }
    for item in layout {
        if let Some(id) = item["displayId"].as_str() {
            warm.insert(id.to_string(), now + LINGER);
        }
    }
}

/// What sync_windows reads and settles under the overlay's lock, to act on once it is let go.
struct Look<'m> {
    /// Whether anything is out to show.
    visible: bool,
    layout: Vec<Value>,
    /// Per monitor, whether the pointer is on something drawn there (hovered).
    hover: HashMap<String, bool>,
    dragging: bool,
    /// The friend under the pointer changed: the pages show its name button.
    hover_event: Option<Value>,
    /// The pointer came onto the bare grass or left it: its page thins it.
    grass_event: Option<Value>,
    /// The screens whose window is kept (keep_warm).
    warm: Vec<String>,
    /// The grass's screen and its ends (`ground`).
    lawn: Option<(&'m Mon, (f64, f64))>,
    /// The pull the pointer shows, only when it changed.
    pull: Option<bool>,
    /// Whether the grass's screen takes the pointer for the grass (grass_takes).
    takes: bool,
}

/// Opens, updates or closes each monitor's window. Windows are built and closed on the main thread.
fn sync_windows(app: &AppHandle, inner: &Arc<Mutex<Inner>>, mons: &[Mon], cursor: Option<(f64, f64)>, moved: bool) {
    let Look {
        visible,
        layout,
        mut hover,
        dragging,
        hover_event,
        grass_event,
        warm,
        lawn,
        pull,
        takes,
    } = {
        let mut d = crate::app::hold(inner);
        let layout = layout_of(&d, mons);
        let visible = d.visible && !d.pets.is_empty();
        keep_warm(&mut d.warm, visible, &layout, mons, Instant::now());
        let warm: Vec<String> = d.warm.keys().cloned().collect();
        let (hover, pet_id) = hovered(&d, &layout, cursor);
        let changed = d.hover_pet != pet_id;
        d.hover_pet = pet_id;
        let hover_event = changed.then(|| json!({"type": "hover", "petId": d.hover_pet}));
        // The grass's screen: the page draws it there, an end takes the pointer, and the bare grass
        // under the pointer thins so what is behind it shows. Its place borrows `mons`, not `d`.
        let lawn = ground(&d, mons);
        let takes = grass_takes(&mut d, lawn, cursor, Instant::now());
        let over = d.hover_pet.is_none()
            && d.grass_drag.is_none()
            && cursor.is_some_and(|c| lawn.is_some_and(|(m, ends)| grass::over(&m.area, ends, c)));
        let grass_event =
            (std::mem::replace(&mut d.over_grass, over) != over).then(|| json!({"type": "grass", "over": over}));
        let pull = (std::mem::replace(&mut d.pull, takes) != takes).then_some(takes);
        Look {
            visible,
            layout,
            hover,
            dragging: d.drag.is_some(),
            hover_event,
            grass_event,
            warm,
            lawn,
            pull,
            takes,
        }
    };
    let lawn_id = lawn.map(|(m, _)| m.id.as_str());
    // What the grass's window draws of it, built once for a step that moved anything.
    let ground = lawn.filter(|_| moved).map(lawn_view);
    if takes && let Some(id) = lawn_id {
        hover.insert(id.to_string(), true);
    }
    let mut open = visible;
    for mon in mons {
        let label = format!("overlay{}", mon.id);
        let existing = app.get_webview_window(&label);
        open |= existing.is_some();
        match (
            needs_window(
                visible,
                dragging,
                &layout,
                &mon.id,
                warm.contains(&mon.id) || lawn_id == Some(mon.id.as_str()),
            ),
            existing,
        ) {
            (true, None) => {
                // A new window starts from its part of the state; the next move is sent to it in full.
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
                let draws_grass = lawn_id == Some(mon.id.as_str());
                // A window that does not show the page's own cursor (an inactive one) shows the pull
                // the backend sets while a grass end is ready or held.
                if let (Some(on), true) = (pull, draws_grass) {
                    let _ = win.set_cursor_icon(if on {
                        tauri::CursorIcon::EwResize
                    } else {
                        tauri::CursorIcon::Default
                    });
                }
                if moved {
                    let own: Vec<&Value> = layout
                        .iter()
                        .filter(|item| item["displayId"] == mon.id.as_str())
                        .collect();
                    let ground = ground.as_ref().filter(|_| draws_grass);
                    let payload = json!({"type": "layout", "layout": own, "ground": ground});
                    let fresh = crate::app::hold(inner).sent.get(&mon.id) != Some(&payload);
                    if fresh {
                        let _ = win.eval(format!("window.__pp&&__pp('event',{payload})"));
                        crate::app::hold(inner).sent.insert(mon.id.clone(), payload);
                    }
                }
                // Only the window drawing the grass thins it; every other one hides its strip.
                let grass_event = grass_event.as_ref().filter(|_| draws_grass);
                for payload in hover_event.iter().chain(grass_event) {
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
    if let Some((_, at)) = set_down_here(d, mons, &drag.id) {
        d.dropped = true;
        arrivals.push(arrival(drag.id, at));
    }
}

/// Things that grew (keep_feet) are set down again, so one put near a screen's edge does not
/// spread past it, and saved as a drop is, on the screen they are on now.
fn place_resized(d: &mut Inner, mons: &[Mon], arrivals: &mut Vec<(String, i64, i64)>) {
    for id in std::mem::take(&mut d.resized) {
        if let Some((_, at)) = set_down_here(d, mons, &id) {
            arrivals.push(arrival(id, at));
        }
    }
}

/// The screens changed (one unplugged, a resolution or the Dock changed): everything out but the
/// one held is set down again, so none is left past every work area. What moved is saved. Every
/// friend's walk is called off, its target being on the old screens (past an edge or under a Dock
/// that grew); the next stroll picks one on the new. Whether anything moved.
fn keep_on_screens(d: &mut Inner, mons: &[Mon], arrivals: &mut Vec<(String, i64, i64)>) -> bool {
    for roam in d.roams.values_mut() {
        roam.target = None;
        roam.visiting = None;
    }
    let held = d.drag.as_ref().map(|g| g.id.clone());
    let ids: Vec<String> = d
        .pets
        .iter()
        .map(|p| p.id.clone())
        .filter(|id| Some(id) != held.as_ref())
        .collect();
    let mut moved = false;
    for id in ids {
        let Some((from, at)) = set_down_here(d, mons, &id) else {
            continue;
        };
        if from == at {
            continue;
        }
        arrivals.push(arrival(id, at));
        moved = true;
    }
    moved
}

/// Sets `id` down where it is, on the work area nearest its box (set_down). Where it was and where
/// it is now; None when it is not out.
fn set_down_here(d: &mut Inner, mons: &[Mon], id: &str) -> Option<((f64, f64), (f64, f64))> {
    let (item, &from) = (d.pets.iter().find(|p| p.id == id)?, d.positions.get(id)?);
    let area = monitor_of_box(mons, from.0, from.1, dims(item))
        .map(|m| m.area)
        .unwrap_or(Bounds {
            x: 0.0,
            y: 0.0,
            w: 10_000.0,
            h: 10_000.0,
        });
    let at = set_down(item, &area, from);
    d.positions.insert(id.to_string(), at);
    Some((from, at))
}

/// A place to save, in whole pixels.
fn arrival(id: String, (x, y): (f64, f64)) -> (String, i64, i64) {
    (id, x.round() as i64, y.round() as i64)
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
    fn only_a_screen_with_something_on_it_or_kept_warm_keeps_a_window() {
        let layout = vec![json!({"id": "pip", "displayId": "1"})];
        assert!(needs_window(true, false, &layout, "1", false));
        assert!(
            !needs_window(true, false, &layout, "2", false),
            "an empty screen has no window"
        );
        assert!(
            needs_window(true, true, &layout, "2", false),
            "a friend carried over is drawn as it arrives"
        );
        assert!(
            !needs_window(false, true, &layout, "1", false),
            "a hidden desktop has none"
        );
        assert!(
            needs_window(false, false, &[], "2", true),
            "a screen kept warm keeps its window, empty"
        );
    }

    #[test]
    fn a_screen_keeps_its_window_a_while_after_the_last_thing_on_it_left() {
        let mons = vec![
            screen()[0].clone(),
            Mon {
                id: "1".into(),
                ..screen()[0].clone()
            },
        ];
        let (t0, mut warm) = (Instant::now(), HashMap::new());
        keep_warm(&mut warm, true, &[json!({"id": "pip", "displayId": "0"})], &mons, t0);
        assert_eq!(warm.keys().collect::<Vec<_>>(), ["0"]);
        // Brought in: still there a moment later, gone once LINGER has passed.
        keep_warm(&mut warm, false, &[], &mons, t0 + LINGER / 2);
        assert!(warm.contains_key("0"));
        keep_warm(&mut warm, false, &[], &mons, t0 + LINGER);
        assert!(warm.is_empty());
        // A screen unplugged lets its window go.
        warm.insert("9".into(), t0 + LINGER);
        keep_warm(&mut warm, false, &[], &mons, t0);
        assert!(warm.is_empty());
    }

    #[test]
    fn the_screen_warmed_for_a_thing_is_the_one_it_lands_on() {
        let second = Mon {
            id: "1".into(),
            area: Bounds {
                x: 1440.0,
                y: 0.0,
                w: 1920.0,
                h: 1080.0,
            },
            ..screen()[0].clone()
        };
        let mons = vec![screen()[0].clone(), second];
        assert_eq!(
            landing(&out("pip", None, None), FLOOR_GAP, &mons).unwrap().id,
            "0",
            "a first time out: the primary"
        );
        assert_eq!(
            landing(&out("pip", Some((2000.0, 500.0)), None), FLOOR_GAP, &mons)
                .unwrap()
                .id,
            "1"
        );
        assert_eq!(
            landing(
                &out("bench", Some((2000.0, 500.0)), Some((151.0, 121.0))),
                FLOOR_GAP,
                &mons
            )
            .unwrap()
            .id,
            "1",
            "a gift where it was left"
        );
        assert!(landing(&out("pip", None, None), FLOOR_GAP, &[]).is_none());
    }

    // The loop is woken once the pages were sent the change, and only for a change to what is out;
    // every window then hears the layout again.
    #[test]
    fn something_sent_out_wakes_the_loop_once_the_pages_were_told() {
        let (tell, woken) = std::sync::mpsc::channel();
        let looper = std::thread::spawn(move || {
            let start = Instant::now();
            std::thread::park_timeout(Duration::from_secs(30));
            let _ = tell.send(start.elapsed());
        });
        let overlay = Overlay {
            inner: Arc::default(),
            looper: looper.thread().clone(),
        };
        overlay.sync(vec![out("pip", None, None)], true, false, None);
        // A step between the sync and the change's eval sent the newcomer; the change then came
        // with a layout from before it.
        crate::app::hold(&overlay.inner)
            .sent
            .insert("0".into(), json!([{"id": "pip"}]));
        overlay.wake();
        let waited = woken.recv_timeout(Duration::from_secs(20)).expect("woken");
        assert!(waited < Duration::from_secs(20));
        let mut d = crate::app::hold(&overlay.inner);
        assert!(
            std::mem::take(&mut d.resend) && d.sent.is_empty(),
            "every window hears the layout again"
        );
        drop(d);
        // The same things again (a status, a chat): nothing new, no wake.
        overlay.sync(vec![out("pip", None, None)], true, false, None);
        overlay.wake();
        assert!(!crate::app::hold(&overlay.inner).resend);
        overlay.sync(vec![], false, false, None);
        overlay.wake();
        assert!(crate::app::hold(&overlay.inner).resend, "brought in is news too");
    }

    // What comes out while the app runs arrives (the page drops a friend in, pops a gift up);
    // what was already out when the app started is just there.
    #[test]
    fn what_comes_out_while_the_app_runs_is_marked_as_arriving() {
        let overlay = Overlay {
            inner: Arc::default(),
            looper: std::thread::current(),
        };
        let now = Instant::now();
        let arriving = |o: &Overlay, id: &str| arriving_at(&crate::app::hold(&o.inner), id, now);
        overlay.sync(vec![out("pip", None, None)], true, false, None);
        assert!(!arriving(&overlay, "pip"), "out when the app started");
        overlay.sync(
            vec![out("pip", None, None), out("bench", None, Some((90.0, 60.0)))],
            true,
            false,
            None,
        );
        assert!(arriving(&overlay, "bench"), "sent out now");
        assert!(!arriving(&overlay, "pip"), "still out");
        // Desktop mode off and on again: everything comes back out.
        overlay.sync(vec![out("pip", None, None)], false, false, None);
        overlay.sync(vec![out("pip", None, None)], true, false, None);
        assert!(arriving(&overlay, "pip"));
        let d = crate::app::hold(&overlay.inner);
        assert!(!arriving_at(&d, "pip", Instant::now() + ARRIVE), "only for a moment");
        // The page hears it in the layout.
        let mut d = Inner {
            pets: d.pets.clone(),
            arrived: d.arrived.clone(),
            ..Inner::default()
        };
        d.positions.insert("pip".into(), (100.0, 600.0));
        assert_eq!(layout_of(&d, &screen())[0]["arriving"], json!(true));
    }

    // With nothing moving, the loop looks at the pointer again only as soon as it could reach a
    // friend at POINTER_SPEED, and in time for the next stroll.
    #[test]
    fn a_calm_loop_looks_again_as_soon_as_the_pointer_could_reach_a_friend() {
        let now = Instant::now();
        let mut d = Inner {
            pets: vec![out("pip", None, None)],
            ..Inner::default()
        };
        // Its box: 200 x 216 at (100, 600).
        d.positions.insert("pip".into(), (100.0, 600.0));
        let ms = |d: &Inner, cursor| calm_wait(d, &[], cursor, now).as_millis();
        // At NEAR, as before: the calm tick.
        assert_eq!(ms(&d, Some((200.0, 300.0))), CALM_TICK.as_millis());
        // 1000px above it: 2500 px/s takes 400ms to come that far.
        assert_eq!(ms(&d, Some((200.0, -400.0))), 400);
        // Across the screen: never longer than CALM_MAX.
        assert_eq!(ms(&d, Some((3000.0, -400.0))), CALM_MAX.as_millis());
        // The distance to the box's nearest point, not to its corner on one axis.
        assert_eq!(ms(&d, Some((300.0 + 600.0, 600.0 - 800.0))), 400);
        assert_eq!(ms(&d, None), CALM_MAX.as_millis(), "a pointer that cannot be read");
        // A stroll due in 200ms starts on time, though the pointer is far; with wandering off, none does.
        d.roams.insert(
            "pip".into(),
            Roam {
                target: None,
                next_at: now + Duration::from_millis(200),
                visiting: None,
            },
        );
        assert_eq!(ms(&d, Some((3000.0, -400.0))), CALM_MAX.as_millis());
        d.wander = true;
        assert_eq!(ms(&d, Some((3000.0, -400.0))), 200);
        d.roams.get_mut("pip").unwrap().next_at = now;
        assert_eq!(
            ms(&d, Some((3000.0, -400.0))),
            CALM_TICK.as_millis(),
            "never sooner than the calm tick"
        );
    }

    // A friend takes the pointer on its drawing (the page measures it, setBody) and, once it has the
    // pointer, on its name under it; the empty rest of its sprite's cell lets clicks through.
    #[test]
    fn a_friend_takes_the_pointer_on_its_drawing_not_on_the_empty_rest_of_its_cell() {
        let mut d = Inner {
            pets: vec![out("pip", None, None)],
            ..Inner::default()
        };
        // Its box: 200 x 216 at (100, 600); its 96 x 104 sprite from (152, 684), the name's row under it.
        let layout =
            vec![json!({"id": "pip", "x": 100.0, "y": 600.0, "width": 200.0, "height": 216.0, "displayId": "1"})];
        let on = |d: &Inner, c| hovered(d, &layout, Some(c)).1;
        assert_eq!(
            on(&d, (156.0, 700.0)).as_deref(),
            Some("pip"),
            "unmeasured: the whole sprite"
        );
        // Drawn over the middle half of its cell, from 40% down.
        d.bodies.insert("pip".into(), [0.25, 0.4, 0.75, 1.0]);
        assert_eq!(on(&d, (156.0, 760.0)), None, "beside the drawing");
        assert_eq!(on(&d, (200.0, 700.0)), None, "above its head");
        assert_eq!(on(&d, (200.0, 760.0)).as_deref(), Some("pip"));
        assert_eq!(
            on(&d, (156.0, 800.0)),
            None,
            "the name's row, before it has the pointer"
        );
        d.hover_pet = Some("pip".into());
        assert_eq!(
            on(&d, (156.0, 800.0)).as_deref(),
            Some("pip"),
            "moving down onto its name"
        );
        assert_eq!(on(&d, (156.0, 760.0)), None, "still not beside it");
    }

    #[test]
    fn a_tree_that_grows_on_the_desktop_keeps_its_foot_where_it_stood() {
        let tree = |w, h| Item {
            id: "cherry".into(),
            size: 0.0,
            saved: None,
            decor: Some(("cherry".into(), w, h)),
            foot: 1.0,
            hangs: false,
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
        // A flower that blooms keeps its box, but its stem now ends 90% down it: it comes down so
        // the stem ends where the soil did (the box's bottom, 640).
        let bloom = Item {
            foot: 0.9,
            ..tree(71.0, 95.0)
        };
        assert_eq!(keep_feet(&[tree(71.0, 95.0)], &[bloom], &mut positions), ["cherry"]);
        assert!((positions["cherry"].1 + 95.0 * 0.9 - 640.0).abs() < 1e-9);
    }

    // Put near a screen's top left corner, a sapling that grows into a tree spreads past its edges
    // (keep_feet keeps its foot); it stays on the screen, and that place is saved.
    #[test]
    fn a_tree_that_grows_near_the_screen_edge_stays_on_it() {
        let mut d = Inner {
            pets: vec![out("cherry", None, Some((160.0, 170.0)))],
            ..Inner::default()
        };
        d.positions.insert("cherry".into(), (-57.5, -100.0));
        d.resized.push("cherry".into());
        let mut arrivals = Vec::new();
        place_resized(&mut d, &screen(), &mut arrivals);
        assert_eq!(d.positions["cherry"], (0.0, 25.0));
        assert_eq!(arrivals, [("cherry".to_string(), 0, 25)]);
        assert!(d.resized.is_empty());
    }

    // A second screen unplugged, or the Dock grown, while things are out: what is now past every
    // work area comes back onto the nearest one, a walk there is called off, and what still fits
    // stays (and is not saved again).
    #[test]
    fn things_left_off_the_screens_come_back_when_the_screens_change() {
        let mut d = Inner {
            pets: vec![
                out("pip", None, None),
                out("cherry", None, Some((160.0, 170.0))),
                out("tulip", None, Some((50.0, 75.0))),
            ],
            ..Inner::default()
        };
        d.positions.insert("pip".into(), (2000.0, 300.0));
        d.positions.insert("cherry".into(), (100.0, 900.0));
        d.positions.insert("tulip".into(), (500.0, 300.0));
        d.positions.insert("miso".into(), (700.0, 300.0));
        d.pets.push(out("miso", None, None));
        // pip walks on past the old right edge; miso, still on the screen, under the grown Dock.
        for (id, target) in [("pip", (2200.0, 300.0)), ("miso", (700.0, 860.0))] {
            d.roams.insert(
                id.into(),
                Roam {
                    target: Some(target),
                    next_at: Instant::now(),
                    visiting: None,
                },
            );
        }
        let mut arrivals = Vec::new();
        keep_on_screens(&mut d, &screen(), &mut arrivals);
        let (pip_w, _) = dims(&d.pets[0]);
        assert_eq!(d.positions["pip"], (1440.0 - pip_w, 300.0));
        assert_eq!(d.positions["cherry"], (100.0, 825.0 - 170.0));
        assert_eq!(d.positions["tulip"], (500.0, 300.0));
        assert_eq!(d.positions["miso"], (700.0, 300.0));
        assert!(
            d.roams.values().all(|r| r.target.is_none()),
            "every walk, aimed at the old screens, is called off"
        );
        let mut saved: Vec<_> = arrivals.iter().map(|a| a.0.as_str()).collect();
        saved.sort();
        assert_eq!(saved, ["cherry", "pip"]);
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
            foot: 1.0,
            hangs: false,
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

    // Where friends' feet stand in their first row, and what stands on the floor stands: the floor
    // line 25px above the work area's bottom (825), less the room under a friend's sprite.
    const FEET: f64 = 772.0;

    #[test]
    fn a_tree_a_flower_or_a_gift_let_go_mid_screen_stays_where_it_is_put() {
        let mut d = Inner {
            pets: vec![
                out("cherry", None, Some((160.0, 170.0))),
                out("tulip", None, Some((50.0, 75.0))),
                out("bench", None, Some((151.0, 121.0))),
            ],
            ..Inner::default()
        };
        for (id, h) in [("cherry", 170.0), ("tulip", 75.0), ("bench", 121.0)] {
            // Let go high up the screen: it stays there, as a friend does.
            assert_eq!(dropped(&mut d, id, (600.0, 200.0)), [(id.to_string(), 600, 200)]);
            assert_eq!(d.positions[id], (600.0, 200.0));
            assert!(std::mem::take(&mut d.dropped), "the windows hear where it was put");
            // Let go past the screen's side and bottom: kept inside the work area (it ends at 825).
            dropped(&mut d, id, (1500.0, 790.0));
            let (w, _) = dims(d.pets.iter().find(|p| p.id == id).unwrap());
            assert_eq!(d.positions[id], (1440.0 - w, 825.0 - h));
        }
    }

    // A chime let go near a screen's top hangs from that edge, and the layout says so; let go lower,
    // it stands on its hook. A gift that does not hang stays where it is put, and a friend visits
    // nothing hung.
    #[test]
    fn a_hanging_gift_let_go_near_the_top_hangs_from_the_edge() {
        let chime = Item {
            hangs: true,
            ..out("windchime", None, Some((38.0, 76.0)))
        };
        let mut d = Inner {
            pets: vec![chime, out("bench", None, Some((151.0, 121.0)))],
            ..Inner::default()
        };
        d.mons = screen();
        // The work area's top is at 25: let go 25 px below it, the chime goes up to it.
        assert_eq!(
            dropped(&mut d, "windchime", (600.0, 50.0)),
            [("windchime".to_string(), 600, 25)]
        );
        let row = |d: &Inner, id: &str| layout_of(d, &d.mons).into_iter().find(|r| r["id"] == id).unwrap();
        assert_eq!(row(&d, "windchime")["hung"], true);
        assert!(
            reachable(&d.pets, &d.positions, &d.mons)
                .iter()
                .all(|r| r.id != "windchime")
        );
        // Let go further down, it stands where it is put.
        dropped(&mut d, "windchime", (600.0, 80.0));
        assert_eq!(d.positions["windchime"], (600.0, 80.0));
        assert!(row(&d, "windchime").get("hung").is_none());
        assert!(
            reachable(&d.pets, &d.positions, &d.mons)
                .iter()
                .any(|r| r.id == "windchime")
        );
        // Held within reach, it already looks hung.
        d.positions.insert("windchime".into(), (600.0, 40.0));
        assert_eq!(row(&d, "windchime")["hung"], true);
        dropped(&mut d, "bench", (600.0, 50.0));
        assert_eq!(d.positions["bench"], (600.0, 50.0));
        assert!(row(&d, "bench").get("hung").is_none());
    }

    // The page eases a walk's legs to a stop from how far it still has to go (overlay.js).
    #[test]
    fn a_walking_friend_tells_its_window_how_far_it_has_to_go() {
        let mut d = Inner {
            pets: vec![out("daisy", None, None)],
            ..Inner::default()
        };
        d.mons = screen();
        d.positions.insert("daisy".into(), (300.0, 600.0));
        let row = |d: &Inner| layout_of(d, &d.mons).into_iter().find(|r| r["id"] == "daisy").unwrap();
        assert!(row(&d).get("toGo").is_none(), "standing");
        d.roams.insert(
            "daisy".into(),
            Roam {
                target: Some((330.0, 640.0)),
                next_at: Instant::now(),
                visiting: None,
            },
        );
        assert_eq!(row(&d)["toGo"], 50.0);
        d.roams.get_mut("daisy").unwrap().target = None;
        assert!(row(&d).get("toGo").is_none(), "cut short");
    }

    // Each decoration carries the screen it stands on, so a friend walks only to one on its own.
    #[test]
    fn a_stroll_goes_only_to_something_on_the_friends_own_screen() {
        let b = |x, y, w, h| Bounds { x, y, w, h };
        let second = Mon {
            id: "1".into(),
            area: b(1440.0, 25.0, 1440.0, 800.0),
            physical: b(1440.0, 0.0, 1440.0, 900.0),
            scale: 1.0,
        };
        let mons = vec![screen()[0].clone(), second];
        let far = Item {
            id: "far".into(),
            ..out("bench", None, Some((151.0, 121.0)))
        };
        let mut d = Inner {
            visible: true,
            wander: true,
            pets: vec![out("pip", None, None), out("bench", None, Some((151.0, 121.0))), far],
            ..Inner::default()
        };
        d.positions.insert("bench".into(), (700.0, 680.0));
        d.positions.insert("far".into(), (2000.0, 680.0));
        let screens: Vec<_> = reachable(&d.pets, &d.positions, &mons)
            .into_iter()
            .map(|r| (r.id, r.monitor))
            .collect();
        assert_eq!(
            screens,
            [("bench".to_string(), Some("0")), ("far".to_string(), Some("1"))]
        );
        let mut visited = Vec::new();
        for _ in 0..200 {
            d.positions.insert("pip".into(), (300.0, 600.0));
            d.roams.insert(
                "pip".into(),
                Roam {
                    target: None,
                    next_at: Instant::now(),
                    visiting: None,
                },
            );
            stroll(&mut d, &mons, None, 40.0, &mut Vec::new(), &mut Vec::new());
            assert!(d.roams["pip"].target.is_some(), "it picks where to go");
            visited.extend(d.roams["pip"].visiting.clone().map(|(id, _)| id));
        }
        assert!(!visited.is_empty(), "a friend visits now and then");
        assert!(visited.iter().all(|id| id == "bench"), "never one on another screen");
    }

    // Pointer capture stays in the window the drag began in; a window on another screen draws the
    // friend from the layout alone, so the row says it is held.
    #[test]
    fn a_held_thing_is_marked_held_in_the_layout_every_window_hears() {
        let mut d = Inner {
            pets: vec![out("pip", None, None), out("miso", None, None)],
            ..Inner::default()
        };
        d.positions.insert("pip".into(), (600.0, 200.0));
        d.positions.insert("miso".into(), (900.0, 200.0));
        d.drag = Some(Drag {
            id: "pip".into(),
            start: (0.0, 0.0),
            origin: (600.0, 200.0),
            at: Instant::now(),
        });
        let layout = layout_of(&d, &screen());
        let row = |id: &str| layout.iter().find(|r| r["id"] == id).unwrap().clone();
        assert_eq!(row("pip")["dragging"], true);
        assert!(row("miso").get("dragging").is_none(), "one strolling is not held");
    }

    // A signpost's drawing ends 82% down its box; friends' feet stand SPRITE_FOOT above their box's
    // bottom. On the floor, the two meet on one line.
    #[test]
    fn a_thing_on_the_floor_stands_where_the_friends_feet_do() {
        let sign = Item {
            foot: 0.82,
            ..out("sign", None, Some((42.0, 71.0)))
        };
        let mut d = Inner {
            visible: true,
            pets: vec![out("pip", None, None), sign],
            ..Inner::default()
        };
        assert!(place_newcomers(&mut d, &screen()));
        let (_, h) = dims(&d.pets[0]);
        let feet = d.positions["pip"].1 + h - SPRITE_FOOT;
        assert!(
            (feet - FEET).abs() < 1e-9,
            "friends start in a row on the line ({feet})"
        );
        let drawn = |d: &Inner| d.positions["sign"].1 + 71.0 * 0.82;
        assert!(
            (drawn(&d) - FEET).abs() < 1e-9,
            "its drawing ends on it ({})",
            drawn(&d)
        );
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
    fn a_thing_back_on_the_desktop_stands_where_it_was_left() {
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
        // Saved high up the screen: back where it was left.
        assert_eq!(d.positions["cherry"], (300.0, 120.0));
        // A first time out: on the floor from the right.
        assert_eq!(d.positions["tulip"], (1440.0 - 50.0 - 60.0 - 180.0, FEET - 75.0));
        // A friend keeps its saved spot.
        assert_eq!(d.positions["pip"], (300.0, 120.0));
    }

    // The grass along the first screen's floor (grass.rs): friends come out standing in it and
    // walk only over it; an end takes the pointer only once the pointer rests there.
    #[test]
    fn with_the_grass_out_newcomers_stand_in_it() {
        let mut d = Inner {
            visible: true,
            grass: Some(Span::default()),
            pets: vec![out("pip", None, None)],
            ..Inner::default()
        };
        assert!(place_newcomers(&mut d, &screen()));
        let (_, h) = dims(&d.pets[0]);
        assert_eq!(
            d.positions["pip"].1 + h,
            825.0 - grass::FLOOR_GAP,
            "its box ends on the lower floor"
        );
    }

    #[test]
    fn a_friend_on_the_grass_screen_strolls_only_over_the_grass() {
        let mut d = Inner {
            visible: true,
            wander: true,
            grass: Some(Span(0.25, 0.75)),
            pets: vec![out("pip", None, None)],
            ..Inner::default()
        };
        let (w, _) = dims(&d.pets[0]);
        let margin = (w - 96.0) / 2.0;
        for _ in 0..200 {
            d.positions.insert("pip".into(), (450.0, 600.0));
            d.roams.insert(
                "pip".into(),
                Roam {
                    target: None,
                    next_at: Instant::now(),
                    visiting: None,
                },
            );
            stroll(&mut d, &screen(), None, 40.0, &mut Vec::new(), &mut Vec::new());
            let (x, _) = d.roams["pip"].target.expect("it picks where to go");
            assert!(x >= 360.0 - margin - 20.0 && x + w <= 1080.0 + margin + 20.0, "{x}");
        }
    }

    // The grips sit in the screen's bottom corners, where a pointer rests all day: near one the loop
    // keeps its calm pace, which still sees a rest of grass::DWELL; only a held end keeps it quick.
    #[test]
    fn a_pointer_by_a_grass_end_keeps_the_calm_pace_and_a_held_end_the_quick_one() {
        let (mons, now) = (screen(), Instant::now());
        let mut d = Inner {
            visible: true,
            grass: Some(Span(0.25, 0.75)),
            pets: vec![out("pip", None, None)],
            ..Inner::default()
        };
        // Far from both grips (360 to 408 and 1032 to 1080 across, from 769 down to the floor).
        d.positions.insert("pip".into(), (1200.0, 100.0));
        let ms = |d: &Inner, cursor| pace(d, &mons, Some(cursor), false, now).as_millis();
        assert_eq!(ms(&d, (370.0, 815.0)), CALM_TICK.as_millis(), "resting on one");
        assert!(CALM_TICK * 2 < grass::DWELL, "a rest is seen before it ends");
        // 500px above a grip: 2500 px/s takes 200ms to come that far.
        assert_eq!(ms(&d, (384.0, 269.0)), 200, "the grips count as a friend's box does");
        assert_eq!(
            pace(&d, &mons, Some((370.0, 815.0)), true, now),
            TICK,
            "something moved"
        );
        d.grass_drag = Some(now);
        assert_eq!(ms(&d, (900.0, 300.0)), TICK.as_millis(), "an end held");
        d.grass_drag = None;
        d.grass = None;
        assert!(ms(&d, (370.0, 815.0)) > CALM_TICK.as_millis(), "no grass, no grips");
    }

    #[test]
    fn a_grass_end_takes_the_pointer_once_the_pointer_rests_on_it_and_while_it_is_dragged() {
        let mons = screen();
        let mut d = Inner {
            visible: true,
            grass: Some(Span(0.25, 0.75)),
            pets: vec![out("pip", None, None)],
            ..Inner::default()
        };
        let takes = |d: &mut Inner, cursor, now| {
            let lawn = ground(d, &mons);
            grass_takes(d, lawn, cursor, now)
        };
        let t0 = Instant::now();
        let grip = Some((370.0, 815.0));
        assert!(!takes(&mut d, grip, t0), "a quick pass lets clicks through");
        assert!(takes(&mut d, grip, t0 + grass::DWELL), "a rest takes it");
        assert!(
            !takes(&mut d, Some((600.0, 815.0)), t0 + grass::DWELL),
            "the middle does not"
        );
        assert!(
            !takes(&mut d, grip, t0 + grass::DWELL * 2),
            "moving off starts the rest over"
        );
        d.grass_drag = Some(t0);
        assert!(takes(&mut d, Some((900.0, 300.0)), t0), "a drag takes the whole screen");
        assert!(
            !takes(&mut d, Some((900.0, 300.0)), t0 + grass::DRAG_STALE),
            "a drag unheard of ends by itself"
        );
        assert!(d.grass_drag.is_none());
        d.grass = None;
        assert!(!takes(&mut d, grip, t0 + grass::DWELL * 9), "no grass, nothing to take");
    }

    #[test]
    fn the_grass_is_drawn_on_the_first_screen_only_while_something_is_out() {
        let mons = screen();
        let mut d = Inner {
            visible: true,
            grass: Some(Span(0.25, 0.75)),
            ..Inner::default()
        };
        let view = ground_view(&d, &mons);
        assert_eq!(view["displayId"], "0");
        assert_eq!(
            (view["left"].as_f64(), view["right"].as_f64()),
            (Some(360.0), Some(1080.0))
        );
        d.visible = false;
        assert!(ground_view(&d, &mons).is_null());
        d.visible = true;
        d.grass = None;
        assert!(ground_view(&d, &mons).is_null(), "switched off");
    }

    #[test]
    fn a_grass_end_let_go_is_kept_and_one_still_held_is_not_undone_by_a_change() {
        let overlay = Overlay {
            inner: Arc::default(),
            looper: std::thread::current(),
        };
        crate::app::hold(&overlay.inner).mons = screen();
        overlay.sync(vec![out("pip", None, None)], true, false, Some(Span::default()));
        assert_eq!(
            overlay.set_grass("overlay0", 360.0, 1080.0, true),
            None,
            "nothing to save mid-drag"
        );
        overlay.sync(vec![out("pip", None, None)], true, false, Some(Span::default()));
        assert_eq!(crate::app::hold(&overlay.inner).grass, Some(Span(0.25, 0.75)));
        assert_eq!(
            overlay.set_grass("overlay0", 360.0, 1440.0, false),
            Some(Span(0.25, 1.0))
        );
        assert!(crate::app::hold(&overlay.inner).grass_drag.is_none());
        overlay.sync(vec![out("pip", None, None)], true, false, None);
        assert_eq!(
            overlay.set_grass("overlay0", 0.0, 100.0, false),
            None,
            "switched off: nothing moves"
        );
    }

    // Only the window drawing the grass moves it: another screen's overlay, or any other page, cannot.
    #[test]
    fn only_the_grass_screens_window_moves_the_grass() {
        let overlay = Overlay {
            inner: Arc::default(),
            looper: std::thread::current(),
        };
        crate::app::hold(&overlay.inner).mons = screen();
        overlay.sync(vec![out("pip", None, None)], true, false, Some(Span(0.25, 0.75)));
        for other in ["overlay1", "main", "overlay"] {
            assert_eq!(overlay.set_grass(other, 0.0, 1440.0, false), None, "{other}");
            assert_eq!(
                crate::app::hold(&overlay.inner).grass,
                Some(Span(0.25, 0.75)),
                "{other}"
            );
        }
        assert_eq!(overlay.set_grass("overlay0", 0.0, 1440.0, false), Some(Span(0.0, 1.0)));
    }

    // What a page measured of a friend goes with it when it is brought in.
    #[test]
    fn a_friend_brought_in_leaves_no_measured_body_behind() {
        let overlay = Overlay {
            inner: Arc::default(),
            looper: std::thread::current(),
        };
        overlay.sync(vec![out("pip", None, None), out("miso", None, None)], true, false, None);
        overlay.set_body("pip", Some([0.2, 0.3, 0.8, 1.0]));
        overlay.set_body("miso", Some([0.2, 0.3, 0.8, 1.0]));
        overlay.sync(vec![out("miso", None, None)], true, false, None);
        let d = crate::app::hold(&overlay.inner);
        assert_eq!(d.bodies.keys().collect::<Vec<_>>(), ["miso"]);
    }

    // A call without both ends (the page's numbers lost on the way) moves nothing and saves nothing,
    // rather than reading as the whole floor.
    #[test]
    fn a_grass_end_with_no_number_moves_nothing() {
        let overlay = Overlay {
            inner: Arc::default(),
            looper: std::thread::current(),
        };
        crate::app::hold(&overlay.inner).mons = screen();
        overlay.sync(vec![out("pip", None, None)], true, false, Some(Span(0.25, 0.75)));
        for (left, right) in [
            (f64::NAN, 1080.0),
            (360.0, f64::NAN),
            (f64::NEG_INFINITY, f64::INFINITY),
        ] {
            assert_eq!(
                overlay.set_grass("overlay0", left, right, false),
                None,
                "{left} {right}"
            );
            assert_eq!(crate::app::hold(&overlay.inner).grass, Some(Span(0.25, 0.75)));
        }
    }
}
