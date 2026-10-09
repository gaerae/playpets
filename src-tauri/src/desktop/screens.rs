// The monitors as the desktop overlay sees them: work areas in logical pixels, which one a point
// or a friend is on, and the cursor mapped into the same space on every system.
use super::roam::Bounds;
use tauri::AppHandle;

/// A monitor: its work area in logical pixels, and its full rectangle in physical ones.
#[derive(Clone)]
pub(super) struct Mon {
    pub id: String,
    pub area: Bounds,
    pub physical: Bounds,
    pub scale: f64,
}

pub(super) fn monitors(app: &AppHandle) -> Vec<Mon> {
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

/// The monitor a point is on: the work area that holds it, or else the one whose edge is
/// closest (a point dragged past every screen, or onto a menu bar or taskbar).
fn monitor_for(mons: &[Mon], x: f64, y: f64) -> Option<&Mon> {
    let gap = |a: &Bounds| {
        let dx = (a.x - x).max(0.0).max(x - (a.x + a.w));
        let dy = (a.y - y).max(0.0).max(y - (a.y + a.h));
        dx * dx + dy * dy
    };
    mons.iter().min_by(|a, b| gap(&a.area).total_cmp(&gap(&b.area)))
}

/// The monitor a friend's box is on, by the box's centre.
pub(super) fn monitor_of_box(mons: &[Mon], x: f64, y: f64, (w, h): (f64, f64)) -> Option<&Mon> {
    monitor_for(mons, x + w / 2.0, y + h / 2.0)
}

/// Maps tao's physical cursor into the logical space `monitors` uses (each monitor's
/// physical origin divided by its own scale). macOS: tao already scaled the logical
/// point by the primary monitor's factor. Windows/Linux: the point is raw pixels, so the
/// monitor under the cursor decides the scale — dividing by the primary scale puts the
/// cursor in the wrong place on a secondary monitor with a different scale.
pub(super) fn cursor_to_logical(p: (f64, f64), mons: &[Mon], primary_scale: f64, macos: bool) -> (f64, f64) {
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

pub(super) fn clamp_to(area: &Bounds, x: f64, y: f64, w: f64, h: f64) -> (f64, f64) {
    (
        x.max(area.x).min(area.x + area.w - w),
        y.max(area.y).min(area.y + area.h - h),
    )
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
    fn a_friend_belongs_to_the_monitor_it_stands_on() {
        // Two 1920×1080 monitors side by side: a friend set down on the right part of the left
        // one stays there (the old rule measured to each monitor's top-left corner and moved it).
        let twins = [
            mon("0", 0.0, 0.0, 1920.0, 1080.0, 1.0),
            mon("1", 1920.0, 0.0, 1920.0, 1080.0, 1.0),
        ];
        assert_eq!(monitor_for(&twins, 1500.0, 800.0).map(|m| m.id.as_str()), Some("0"));
        assert_eq!(monitor_for(&twins, 2000.0, 100.0).map(|m| m.id.as_str()), Some("1"));
        // A wide monitor beside a small one: near the shared edge, still the wide one
        // (the old layout rule picked the monitor whose centre was closer).
        let mixed = [
            mon("0", 0.0, 0.0, 2560.0, 1440.0, 1.0),
            mon("1", 2560.0, 0.0, 1280.0, 1024.0, 1.0),
        ];
        assert_eq!(monitor_for(&mixed, 2300.0, 700.0).map(|m| m.id.as_str()), Some("0"));
        // Off every monitor (dragged past an edge): the closest one by distance to its edges.
        assert_eq!(monitor_for(&mixed, 3000.0, 1300.0).map(|m| m.id.as_str()), Some("1"));
        assert_eq!(monitor_for(&mixed, -50.0, 700.0).map(|m| m.id.as_str()), Some("0"));
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
