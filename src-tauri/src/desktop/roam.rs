// Desktop strolls in logical pixels.
pub const ROAM_DELAY: (f64, f64) = (10_000.0, 25_000.0);
pub const ROAM_SPEED: f64 = 0.09; // px per ms

pub fn delay(r: f64, range: (f64, f64)) -> f64 {
    range.0 + r * (range.1 - range.0)
}

// Not f64::clamp: a pet wider than its area makes max < min, which f64::clamp panics on.
fn clamp(v: f64, min: f64, max: f64) -> f64 {
    v.max(min).min(max)
}

#[derive(Clone, Copy)]
pub struct Bounds {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
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

pub fn step_toward(px: f64, py: f64, tx: f64, ty: f64, dt_ms: f64) -> (f64, f64, bool) {
    let (dx, dy) = (tx - px, ty - py);
    let dist = (dx * dx + dy * dy).sqrt();
    if dist <= ROAM_SPEED * dt_ms {
        return (tx, ty, true);
    }
    let k = ROAM_SPEED * dt_ms / dist;
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
    fn steps_walk_steadily_and_land_exactly() {
        let (mut x, mut y) = (100.0, 500.0);
        let first = step_toward(x, y, 400.0, 520.0, 40.0);
        let pace = ((first.0 - x).powi(2) + (first.1 - y).powi(2)).sqrt();
        assert!(pace > 1.0 && pace < 10.0);
        for _ in 0..5000 {
            let (nx, ny, done) = step_toward(x, y, 400.0, 520.0, 40.0);
            x = nx;
            y = ny;
            if done {
                break;
            }
        }
        assert_eq!((x, y), (400.0, 520.0));
    }
}
