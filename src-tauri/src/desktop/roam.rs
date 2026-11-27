// Desktop strolls in logical pixels.
pub const ROAM_DELAY: (f64, f64) = (10_000.0, 25_000.0);
/// How far a friend walks in a millisecond, in its own body lengths (its sprite's width): a Medium
/// friend walks as it did at 0.09 px a ms, and a small one's legs keep the same time.
pub const ROAM_BODIES: f64 = 0.0007;

pub fn delay(r: f64, range: (f64, f64)) -> f64 {
    range.0 + r * (range.1 - range.0)
}

// Not f64::clamp: a pet wider than its area makes max < min, which f64::clamp panics on.
pub(crate) fn clamp(v: f64, min: f64, max: f64) -> f64 {
    v.max(min).min(max)
}

#[derive(Clone, Copy)]
pub struct Bounds {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

impl Bounds {
    /// Whether the point `c` is on the box, its edges included.
    pub fn contains(&self, (cx, cy): (f64, f64)) -> bool {
        cx >= self.x && cx <= self.x + self.w && cy >= self.y && cy <= self.y + self.h
    }

    /// How far the point `c` is from the box: the straight line to its nearest point, 0 on it.
    pub fn gap(&self, (cx, cy): (f64, f64)) -> f64 {
        let dx = (self.x - cx).max(cx - self.x - self.w).max(0.0);
        let dy = (self.y - cy).max(cy - self.y - self.h).max(0.0);
        dx.hypot(dy)
    }
}

pub fn roam_target(b: &Bounds, area: &Bounds, r1: f64, r2: f64, r3: f64) -> (f64, f64) {
    let max_x = area.x + area.w - b.w;
    let max_y = area.y + area.h - b.h;
    let stride = 120.0 + r1 * 300.0;
    let drift = (r2 - 0.5) * 96.0;
    let dir = if r3 < 0.5 { -1.0 } else { 1.0 };
    let mut x = clamp(b.x + dir * stride, area.x, max_x);
    if (x - b.x).abs() < 40.0 {
        x = clamp(b.x - dir * stride, area.x, max_x);
    }
    (x, clamp(b.y + drift, area.y, max_y))
}

/// Where a friend stands to visit a decoration: its sprite (`sprite` wide, its feet `foot` above
/// the bottom of the friend's box `b`) beside the decoration `d`, feet level with its bottom, on the
/// side asked for unless only the other fits the area.
pub fn beside(b: &Bounds, sprite: f64, foot: f64, d: &Bounds, area: &Bounds, right: bool) -> (f64, f64) {
    let gap = sprite * 0.55;
    let (left_x, right_x) = (d.x - gap - b.w / 2.0, d.x + d.w + gap - b.w / 2.0);
    let fits = |x: f64| x + b.w / 2.0 - sprite / 2.0 >= area.x && x + b.w / 2.0 + sprite / 2.0 <= area.x + area.w;
    let x = match (right, fits(right_x), fits(left_x)) {
        (true, true, _) | (false, true, false) => right_x,
        _ => left_x,
    };
    let y = d.y + d.h - (b.h - foot);
    (
        clamp(x, area.x - (b.w - sprite) / 2.0, area.x + area.w - (b.w + sprite) / 2.0),
        clamp(y, area.y, area.y + area.h - b.h),
    )
}

/// Where a friend stands on a seat `d` (a bench, a swing: catalog.json "stand": "on"), as the yard
/// sends one (decor.js walkTo): its feet on the seat's ground line (`foot`, a share of its box from
/// the top) and 3 px in front, at `r` (0 to 1) across the middle 40% of its width. Its drawing
/// (`sprite` wide) stays on the screen, as beside a seat, even on a small seat at the edge.
pub fn onto(b: &Bounds, sprite: f64, foot: f64, d: &Bounds, seat_foot: f64, area: &Bounds, r: f64) -> (f64, f64) {
    let x = d.x + d.w * (0.3 + 0.4 * r) - b.w / 2.0;
    let y = d.y + d.h * seat_foot + 3.0 - (b.h - foot);
    (
        clamp(x, area.x - (b.w - sprite) / 2.0, area.x + area.w - (b.w + sprite) / 2.0),
        clamp(y, area.y, area.y + area.h - b.h),
    )
}

/// One step of `dt_ms` from (px, py) toward (tx, ty) for a friend `size` px wide: its pace in body
/// lengths, slowing over its last body length to a quarter, so it comes to a stop rather than hits
/// one. Returns where it is and whether it got there.
pub fn step_toward(px: f64, py: f64, tx: f64, ty: f64, dt_ms: f64, size: f64) -> (f64, f64, bool) {
    let (dx, dy) = (tx - px, ty - py);
    let dist = (dx * dx + dy * dy).sqrt();
    let size = size.max(1.0);
    let reach = ROAM_BODIES * size * clamp(dist / size, 0.25, 1.0) * dt_ms;
    if dist <= reach {
        return (tx, ty, true);
    }
    let k = reach / dist;
    (px + dx * k, py + dy * k, false)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn rng() -> impl FnMut() -> f64 {
        let mut s = 0.123f64;
        move || {
            s = (s * 9301.0 + 49297.0) % 233280.0;
            s / 233280.0
        }
    }

    #[test]
    fn a_point_is_on_a_box_up_to_its_edges_and_otherwise_as_far_as_its_nearest_point() {
        let b = Bounds {
            x: 100.0,
            y: 600.0,
            w: 200.0,
            h: 216.0,
        };
        for on in [(100.0, 600.0), (300.0, 816.0), (200.0, 700.0)] {
            assert!(b.contains(on), "{on:?}");
            assert_eq!(b.gap(on), 0.0, "{on:?}");
        }
        assert!(!b.contains((99.0, 700.0)));
        assert_eq!(b.gap((200.0, -400.0)), 1000.0, "straight above");
        assert_eq!(b.gap((900.0, -200.0)), 1000.0, "to the corner, not along one side");
    }

    #[test]
    fn targets_stay_on_area_and_stroll_sideways() {
        let area = Bounds {
            x: 0.0,
            y: 25.0,
            w: 1440.0,
            h: 875.0,
        };
        let mut r = rng();
        for (ox, oy) in [(0.0, 600.0), (1280.0, 600.0), (700.0, 25.0), (700.0, 690.0)] {
            for _ in 0..200 {
                let b = Bounds {
                    x: ox,
                    y: oy,
                    w: 160.0,
                    h: 210.0,
                };
                let (x, y) = roam_target(&b, &area, r(), r(), r());
                assert!(x >= area.x && x <= area.x + area.w - 160.0);
                assert!(y >= area.y && y <= area.y + area.h - 210.0);
                assert!((y - oy).abs() <= 60.0, "keeps chosen height");
                assert!((x - ox).abs() >= 40.0, "visible stroll even from an edge");
            }
        }
    }

    #[test]
    fn a_visit_stands_beside_the_decoration_with_its_feet_on_the_same_ground() {
        let area = Bounds {
            x: 0.0,
            y: 25.0,
            w: 1440.0,
            h: 875.0,
        };
        let friend = Bounds {
            x: 600.0,
            y: 500.0,
            w: 200.0,
            h: 241.0,
        };
        let bench = Bounds {
            x: 900.0,
            y: 700.0,
            w: 151.0,
            h: 121.0,
        };
        let (x, y) = beside(&friend, 112.0, 28.0, &bench, &area, true);
        assert_eq!(y + friend.h - 28.0, bench.y + bench.h, "feet level with the bench's");
        assert!(
            x + friend.w / 2.0 - 56.0 >= bench.x + bench.w,
            "beside, not on top of it"
        );
        let (x, _) = beside(&friend, 112.0, 28.0, &bench, &area, false);
        assert!(x + friend.w / 2.0 + 56.0 <= bench.x, "or on its other side");
        // Against the right edge there is only room on the left.
        let corner = Bounds { x: 1330.0, ..bench };
        let (x, _) = beside(&friend, 112.0, 28.0, &corner, &area, true);
        assert!(x + friend.w / 2.0 + 56.0 <= corner.x);
    }

    #[test]
    fn a_visit_to_a_seat_stands_on_its_ground_line_within_its_middle() {
        let area = Bounds {
            x: 0.0,
            y: 25.0,
            w: 1440.0,
            h: 875.0,
        };
        let friend = Bounds {
            x: 600.0,
            y: 500.0,
            w: 200.0,
            h: 241.0,
        };
        let bench = Bounds {
            x: 900.0,
            y: 700.0,
            w: 150.0,
            h: 120.0,
        };
        for r in [0.0, 0.5, 1.0] {
            let (x, y) = onto(&friend, 112.0, 28.0, &bench, 0.94, &area, r);
            let feet = (x + friend.w / 2.0, y + friend.h - 28.0);
            assert_eq!(
                feet.1,
                bench.y + bench.h * 0.94 + 3.0,
                "on its ground line, a little in front"
            );
            assert!(feet.0 >= bench.x + bench.w * 0.3 - 1e-9 && feet.0 <= bench.x + bench.w * 0.7 + 1e-9);
        }
        // Kept on the screen, as any stroll is.
        let low = Bounds { y: 870.0, ..bench };
        let (_, y) = onto(&friend, 112.0, 28.0, &low, 0.94, &area, 0.5);
        assert!(y <= area.y + area.h - friend.h);
        // A small seat at a screen's edge: the friend's whole drawing stays on the screen.
        for (seat_x, r) in [(area.x, 0.0), (area.x + area.w - 44.0, 1.0)] {
            let stump = Bounds {
                x: seat_x,
                w: 44.0,
                ..bench
            };
            let (x, _) = onto(&friend, 112.0, 28.0, &stump, 0.94, &area, r);
            let middle = x + friend.w / 2.0;
            assert!(
                middle - 56.0 >= area.x - 1e-9 && middle + 56.0 <= area.x + area.w + 1e-9,
                "{seat_x}"
            );
        }
    }

    #[test]
    fn steps_walk_steadily_and_land_exactly() {
        let (mut x, mut y) = (100.0, 500.0);
        let first = step_toward(x, y, 400.0, 520.0, 40.0, 128.0);
        let pace = ((first.0 - x).powi(2) + (first.1 - y).powi(2)).sqrt();
        assert!(pace > 1.0 && pace < 10.0);
        for _ in 0..5000 {
            let (nx, ny, done) = step_toward(x, y, 400.0, 520.0, 40.0, 128.0);
            x = nx;
            y = ny;
            if done {
                break;
            }
        }
        assert_eq!((x, y), (400.0, 520.0));
    }

    // In body lengths, as the yard paces: a small friend's legs keep the same time as a large one's.
    #[test]
    fn a_walk_is_paced_in_the_friends_own_body_lengths() {
        let stride = |size: f64| step_toward(0.0, 0.0, 1000.0, 0.0, 40.0, size).0;
        assert!((stride(128.0) - ROAM_BODIES * 128.0 * 40.0).abs() < 1e-9);
        assert!((stride(64.0) * 2.0 - stride(128.0)).abs() < 1e-9);
    }

    // It slows over its last body length, to a quarter of its pace, and still gets there.
    #[test]
    fn a_walk_slows_into_its_stop() {
        let full = ROAM_BODIES * 128.0 * 10.0;
        let half = step_toward(0.0, 0.0, 64.0, 0.0, 10.0, 128.0).0;
        assert!((half - full / 2.0).abs() < 1e-9, "{half}");
        let last = step_toward(0.0, 0.0, 12.0, 0.0, 10.0, 128.0).0;
        assert!((last - full / 4.0).abs() < 1e-9, "{last}");
        assert_eq!(step_toward(0.0, 0.0, 0.1, 0.0, 10.0, 128.0), (0.1, 0.0, true));
    }
}
