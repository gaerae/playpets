// The tray icon and its menu, and the words outside the page (window title, tray) that follow
// the app's language. The menu follows the platforms' guidance for such icons: switches carry a
// check mark rather than changing their words, an item that does not apply is left out rather
// than greyed, and the icon says quietly, with a small mark, when a coding agent waits for the
// person or ran into trouble.
use crate::app::{AppData, Shared, lock, pet_name};
use crate::i18n;
use std::sync::Mutex;
use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager};

/// What the tray shows, as the app's state has it.
#[derive(Clone, PartialEq, Default)]
pub struct Snapshot {
    friends: bool,
    desktop: bool,
    wander: bool,
    /// The yard's sounds are on (the macOS View menu shows it).
    sound: bool,
    /// A friend whose coding agent needs the person: its state ("waiting" or "error") and name.
    attention: Option<(String, String)>,
}

/// A finished agent's trouble stops counting after this long, as in the yard (src/core/status.js).
const FADE_MS: u64 = 30 * 60 * 1000;

pub fn snapshot(d: &AppData) -> Snapshot {
    let now = crate::app::now_ms();
    let state_of = |id: &str| {
        let s = d.statuses.get(id)?;
        if s.get("source").and_then(|v| v.as_str()) == Some("chat") {
            return None;
        }
        let state = s.get("state").and_then(|v| v.as_str())?;
        let at = s.get("at").and_then(|v| v.as_u64()).unwrap_or(now);
        (state == "waiting" || (state == "error" && now.saturating_sub(at) < FADE_MS)).then(|| state.to_string())
    };
    // Waiting comes first: it is the one the person can answer.
    let attention = ["waiting", "error"].iter().find_map(|wanted| {
        d.pets
            .iter()
            .find(|p| state_of(&p.id).as_deref() == Some(*wanted))
            .map(|p| (wanted.to_string(), pet_name(d, p, "")))
    });
    Snapshot {
        friends: !d.pets.is_empty(),
        desktop: d.prefs.desktop,
        wander: d.prefs.wander,
        sound: d.prefs.sound.on,
        attention,
    }
}

/// Brings the tray in line with the state. Safe to call holding the state lock: menus are built on
/// the main thread, so this only queues the work there.
pub fn refresh(app: &AppHandle, snap: Snapshot) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || apply(&handle, snap));
}

/// The menu as last built: the state, whether the window was mini, the update found, the language.
type Shown = (Snapshot, bool, Option<String>, &'static str);
static SHOWN: Mutex<Option<Shown>> = Mutex::new(None);

fn apply(app: &AppHandle, snap: Snapshot) {
    let Some(tray) = app.tray_by_id("tray") else { return };
    let key = (
        snap.clone(),
        crate::window::is_mini(),
        crate::update::found_version(app),
        i18n::current().code(),
    );
    let mut shown = crate::app::hold(&SHOWN);
    if shown.as_ref() == Some(&key) {
        return;
    }
    let attention_changed = shown.as_ref().map(|s| &s.0.attention) != Some(&snap.attention);
    if let Ok(menu) = menu(app, &key) {
        let _ = tray.set_menu(Some(menu));
    }
    let _ = tray.set_tooltip(Some(tooltip(&snap)));
    if attention_changed {
        let state = snap.attention.as_ref().map(|(state, _)| state.as_str());
        let _ = tray.set_icon(Some(icon(state)));
    }
    // The macOS menu bar's View menu has the same switches, so it follows the same state.
    #[cfg(target_os = "macos")]
    if let Ok(bar) = crate::menu::app_menu(app, snap.friends, snap.desktop, key.1, snap.sound) {
        let _ = app.set_menu(bar);
    }
    *shown = Some(key);
}

/// One line of the menu: an item by its id, with its check mark if it is a switch, or a separator.
#[derive(Debug, PartialEq)]
enum Line {
    Item(&'static str, Option<bool>),
    Separator,
}

/// The menu: the yard, then the switches for how friends are shown (only those that apply),
/// then settings, updates and about, then quitting.
fn lines(snap: &Snapshot, mini: bool) -> Vec<Line> {
    use Line::{Item, Separator};
    let mut lines = vec![Item("open", None)];
    if snap.friends {
        lines.extend([Separator, Item("mini", Some(mini)), Item("desktop", Some(snap.desktop))]);
        if snap.desktop {
            lines.push(Item("wander", Some(snap.wander)));
        }
    }
    lines.extend([
        Separator,
        Item("settings", None),
        Item("update", None),
        Item("about", None),
        Separator,
        Item("quit", None),
    ]);
    lines
}

fn menu(app: &AppHandle, (snap, mini, found, _): &Shown) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::new(app)?;
    for line in lines(snap, *mini) {
        let Line::Item(id, check) = line else {
            menu.append(&PredefinedMenuItem::separator(app)?)?;
            continue;
        };
        // Once a newer version is known, the update item names it.
        let text = match (id, found) {
            ("update", Some(version)) => i18n::tr("tray.update_to", &[("version", &format!("v{version}"))]),
            _ => i18n::t(&format!("tray.{id}")),
        };
        match check {
            Some(on) => menu.append(&CheckMenuItem::with_id(app, id, text, true, on, None::<&str>)?)?,
            None => menu.append(&MenuItem::with_id(app, id, text, true, None::<&str>)?)?,
        }
    }
    Ok(menu)
}

/// For the e2e scenario: the menu as last built, as `id` or `id:on` / `id:off`, separators as `-`,
/// and the tooltip.
pub fn e2e_state() -> serde_json::Value {
    let shown = crate::app::hold(&SHOWN);
    let Some((snap, mini, _, _)) = shown.as_ref() else {
        return serde_json::Value::Null;
    };
    let items: Vec<String> = lines(snap, *mini)
        .into_iter()
        .map(|line| match line {
            Line::Item(id, None) => id.to_string(),
            Line::Item(id, Some(on)) => format!("{id}:{}", if on { "on" } else { "off" }),
            Line::Separator => "-".into(),
        })
        .collect();
    serde_json::json!({"items": items, "tooltip": tooltip(snap)})
}

/// The app's name, and on a second line the friend whose agent needs the person.
fn tooltip(snap: &Snapshot) -> String {
    let title = i18n::t("app.title");
    match &snap.attention {
        Some((state, name)) => format!("{title}\n{name} · {}", i18n::t(&format!("tray.state_{state}"))),
        None => title,
    }
}

/// The colored app-icon cat (as on the Dock and taskbar), with a small mark at the bottom right
/// in the yard's colours for the agent's state: blue while it waits, red after trouble.
fn icon(state: Option<&str>) -> Image<'static> {
    let base = Image::from_bytes(include_bytes!("../icons/tray.png")).expect("the tray icon is a PNG");
    let color = match state {
        Some("waiting") => [0x4a, 0x9b, 0xd6],
        Some("error") => [0xd9, 0x53, 0x4f],
        _ => return base.to_owned(),
    };
    let (w, h) = (base.width(), base.height());
    Image::new_owned(with_mark(base.rgba(), w, h, color), w, h)
}

/// The icon's pixels with a dot (and a white ring around it) in the bottom-right corner.
fn with_mark(rgba: &[u8], w: u32, h: u32, color: [u8; 3]) -> Vec<u8> {
    let mut px = rgba.to_vec();
    let size = w.min(h) as f64;
    let (r, ring) = (size * 0.2, size * 0.27);
    let (cx, cy) = (w as f64 - ring, h as f64 - ring);
    for y in 0..h {
        for x in 0..w {
            let d = ((x as f64 + 0.5 - cx).powi(2) + (y as f64 + 0.5 - cy).powi(2)).sqrt();
            let paint = if d <= r {
                [color[0], color[1], color[2]]
            } else if d <= ring {
                [255, 255, 255]
            } else {
                continue;
            };
            let i = ((y * w + x) * 4) as usize;
            px[i..i + 4].copy_from_slice(&[paint[0], paint[1], paint[2], 255]);
        }
    }
    px
}

/// The menu built again even if nothing seems to have changed (after a check item ticked itself).
pub fn rebuild(app: &AppHandle) {
    *crate::app::hold(&SHOWN) = None;
    retitle(app);
}

/// Everything outside the page that carries words: the window title, the tray and (with it) the
/// macOS menu bar.
/// Never called holding the state lock (it reads the state).
pub fn retitle(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.set_title(&i18n::t("app.title"));
    }
    if let Some(state) = app.try_state::<Shared>() {
        let snap = snapshot(&lock(&state));
        refresh(app, snap);
    }
}

pub fn build(app: &tauri::App) -> tauri::Result<()> {
    let snap = snapshot(&lock(&app.state::<Shared>()));
    let builder = TrayIconBuilder::with_id("tray")
        .tooltip(tooltip(&snap))
        .icon(icon(None))
        .icon_as_template(false)
        // Its items are handled with the menu bar's, by the app-wide handler (main.rs, menu::act).
        .menu(&Menu::new(app)?);
    // Windows: a left click opens the yard and the menu is on the right button, as the system's
    // own icons do. macOS and Linux show the menu on a click.
    #[cfg(windows)]
    let builder = builder
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                crate::window::show(tray.app_handle());
            }
        });
    builder.build(app)?;
    apply(app.handle(), snap);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{Line, Snapshot, i18n, lines, with_mark};

    fn ids(snap: &Snapshot, mini: bool) -> Vec<String> {
        lines(snap, mini)
            .into_iter()
            .map(|l| match l {
                Line::Item(id, None) => id.into(),
                Line::Item(id, Some(on)) => format!("{id}:{on}"),
                Line::Separator => "-".into(),
            })
            .collect()
    }

    #[test]
    fn switches_show_their_state_and_only_when_they_apply() {
        let none = Snapshot::default();
        assert_eq!(
            ids(&none, false),
            ["open", "-", "settings", "update", "about", "-", "quit"],
            "no friend: nothing to show"
        );
        let friends = Snapshot {
            friends: true,
            ..Default::default()
        };
        assert_eq!(
            ids(&friends, true),
            [
                "open",
                "-",
                "mini:true",
                "desktop:false",
                "-",
                "settings",
                "update",
                "about",
                "-",
                "quit"
            ],
            "strolling waits for desktop mode"
        );
        let desk = Snapshot {
            friends: true,
            desktop: true,
            wander: true,
            ..Default::default()
        };
        assert!(ids(&desk, false).contains(&"wander:true".to_string()));
        // Every item's words come from tray.{id} (built at run time, so the key test cannot see them).
        for line in lines(&desk, false).iter().chain(&lines(&none, true)) {
            if let Line::Item(id, _) = line {
                assert_ne!(i18n::t(&format!("tray.{id}")), format!("tray.{id}"), "tray.{id}");
            }
        }
        for state in ["waiting", "error"] {
            assert_ne!(i18n::t(&format!("tray.state_{state}")), format!("tray.state_{state}"));
        }
    }

    #[test]
    fn the_mark_sits_in_the_bottom_right_corner_with_a_white_ring() {
        let (w, h) = (32u32, 32u32);
        let clear = vec![0u8; (w * h * 4) as usize];
        let marked = with_mark(&clear, w, h, [1, 2, 3]);
        let at = |x: u32, y: u32| &marked[((y * w + x) * 4) as usize..((y * w + x) * 4 + 4) as usize];
        // The centre of the dot is 0.27 of the size in from the corner.
        assert_eq!(at(23, 23), &[1, 2, 3, 255]);
        assert_eq!(at(0, 0), &[0, 0, 0, 0], "the rest of the icon is untouched");
        assert_eq!(at(16, 16), &[0, 0, 0, 0]);
        // Just outside the dot, inside the ring: white.
        assert_eq!(at(23, 30), &[255, 255, 255, 255]);
    }
}
