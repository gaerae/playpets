// The grass along the floor of the first screen, where friends first come out (overlay.rs
// start_of): a strip the overlay page draws (overlay.css .ground). Its two ends drag to narrow or
// widen it, and friends on that screen walk only over it. Where it reaches is kept as a share of
// the screen's width (Prefs::grass_span), so a new resolution or Dock keeps it in proportion.
use super::roam::{Bounds, clamp};
use serde_json::{Value, json};
use std::time::Duration;

/// The strip's height, sent to the page with its ends (view; overlay.css .ground).
pub const HEIGHT: f64 = 56.0;
/// The narrowest it gets: room for a friend or two and a flower.
pub const MIN_WIDTH: f64 = 420.0;
/// Half the width of the grip at each end, inside the grass, sent to the page whole (view;
/// overlay.css .ground-grip).
const GRIP: f64 = 24.0;
/// How far the blade tips rise past the strip's thick part.
const TIPS: f64 = 8.0;
/// A grass end takes the pointer only after the pointer rested on it this long, so a quick click
/// in a screen's bottom corner still reaches the app beneath.
pub const DWELL: Duration = Duration::from_millis(300);
/// A drag the page stops telling about (its window lost the pointer) ends by itself, so the
/// screen is never left taking every click.
pub const DRAG_STALE: Duration = Duration::from_secs(8);
/// The floor line on the grass's screen while it is out: low, so feet stand in the grass rather
/// than on its tips (overlay.rs FLOOR_GAP is the floor without it).
pub const FLOOR_GAP: f64 = 8.0;

/// Where the grass reaches, as shares of its screen's work area from the left (0 to 1).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Span(pub f64, pub f64);

impl Default for Span {
    /// The whole floor: a person narrows it rather than finding it narrow.
    fn default() -> Self {
        Span(0.0, 1.0)
    }
}

impl Span {
    /// As saved (`[left, right]`); anything else is the whole floor.
    pub fn restore(raw: Option<&Value>) -> Span {
        let share = |i: usize| raw?.as_array()?.get(i)?.as_f64().filter(|v| (0.0..=1.0).contains(v));
        match (share(0), share(1)) {
            (Some(l), Some(r)) if l < r => Span(l, r),
            _ => Span::default(),
        }
    }

    pub fn json(self) -> Value {
        json!([self.0, self.1])
    }

    /// Its ends on `area` in logical pixels, at least MIN_WIDTH apart (as much of it as there is),
    /// widened about its middle and kept on the area.
    pub fn ends(self, area: &Bounds) -> (f64, f64) {
        let (l, r) = (area.x + self.0 * area.w, area.x + self.1 * area.w);
        let min = MIN_WIDTH.min(area.w);
        if r - l >= min {
            return (l, r);
        }
        let mid = clamp((l + r) / 2.0, area.x + min / 2.0, area.x + area.w - min / 2.0);
        (mid - min / 2.0, mid + min / 2.0)
    }

    /// The span whose ends are `left` and `right` (logical pixels) on `area`, kept on it.
    pub fn from_ends(area: &Bounds, left: f64, right: f64) -> Span {
        if area.w <= 0.0 {
            return Span::default();
        }
        let (l, r) = (left.max(area.x), right.min(area.x + area.w));
        let (l, r) = Span((l - area.x) / area.w, (r - area.x) / area.w).ends(area);
        Span((l - area.x) / area.w, (r - area.x) / area.w)
    }
}

/// The grip at each end of the grass, at the bottom of `area`.
pub fn grips(area: &Bounds, (l, r): (f64, f64)) -> [Bounds; 2] {
    let (y, w, h) = (area.y + area.h - HEIGHT, 2.0 * GRIP, HEIGHT);
    [Bounds { x: l, y, w, h }, Bounds { x: r - w, y, w, h }]
}

/// Whether the pointer at `c` is on one of the grass's grips.
pub fn on_grip(area: &Bounds, ends: (f64, f64), c: (f64, f64)) -> bool {
    grips(area, ends).iter().any(|g| g.contains(c))
}

/// Whether the pointer at `c` is over the grass, its blade tips too.
pub fn over(area: &Bounds, (l, r): (f64, f64), c: (f64, f64)) -> bool {
    let floor = area.y + area.h;
    c.0 >= l && c.0 <= r && c.1 >= floor - HEIGHT - TIPS && c.1 <= floor
}

/// The part of `area` (its left and width) a friend walks in: over the grass, its box reaching
/// `margin` past the sprite on each side, so the sprite's middle can come to each end.
pub fn walk_range(area: &Bounds, (l, r): (f64, f64), margin: f64) -> (f64, f64) {
    let (gl, gr) = (
        (l - margin - 20.0).max(area.x),
        (r + margin + 20.0).min(area.x + area.w),
    );
    (gl, (gr - gl).max(0.0))
}

/// What the overlay page draws: the screen the grass is on, its ends, the area's, how narrow it may
/// get, how tall it is and how wide each end's grip is, in logical pixels. The page sizes the strip
/// and its grips by these, so what it draws is where the pointer is taken (grips, over).
pub fn view(display: &str, area: &Bounds, ends: (f64, f64)) -> Value {
    json!({
        "displayId": display,
        "left": ends.0,
        "right": ends.1,
        "areaLeft": area.x,
        "areaRight": area.x + area.w,
        "min": MIN_WIDTH.min(area.w),
        "height": HEIGHT,
        "gripWidth": 2.0 * GRIP,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn screen() -> Bounds {
        Bounds {
            x: 0.0,
            y: 25.0,
            w: 1440.0,
            h: 850.0,
        }
    }

    #[test]
    fn the_grass_starts_across_the_whole_floor_and_a_saved_span_comes_back() {
        assert_eq!(Span::restore(None), Span(0.0, 1.0));
        assert_eq!(Span::restore(Some(&json!([0.2, 0.7]))), Span(0.2, 0.7));
        for odd in [
            json!([0.7, 0.2]),
            json!([-0.1, 0.5]),
            json!([0.1, 1.5]),
            json!("wide"),
            json!([0.3]),
        ] {
            assert_eq!(Span::restore(Some(&odd)), Span::default(), "{odd}");
        }
        assert_eq!(Span::restore(Some(&Span(0.25, 0.5).json())), Span(0.25, 0.5));
    }

    #[test]
    fn the_grass_is_never_narrower_than_its_least_width_nor_off_the_screen() {
        let area = screen();
        assert_eq!(Span::default().ends(&area), (0.0, 1440.0));
        let (l, r) = Span(0.5, 0.52).ends(&area);
        assert_eq!(r - l, MIN_WIDTH, "widened about its middle");
        assert!(((l + r) / 2.0 - 0.51 * 1440.0).abs() < 1e-9);
        assert_eq!(
            Span(0.99, 1.0).ends(&area),
            (1440.0 - MIN_WIDTH, 1440.0),
            "kept on the screen"
        );
        let narrow = Bounds { w: 300.0, ..area };
        assert_eq!(
            Span(0.4, 0.5).ends(&narrow),
            (0.0, 300.0),
            "a screen narrower than that is all grass"
        );
    }

    #[test]
    fn ends_dragged_past_the_screen_or_too_close_come_back_to_a_span_that_fits() {
        let area = Bounds { x: 1440.0, ..screen() };
        assert_eq!(Span::from_ends(&area, 1000.0, 4000.0), Span(0.0, 1.0));
        let s = Span::from_ends(&area, 1440.0 + 360.0, 1440.0 + 1080.0);
        assert!((s.0 - 0.25).abs() < 1e-9 && (s.1 - 0.75).abs() < 1e-9);
        let (l, r) = Span::from_ends(&area, 2000.0, 2010.0).ends(&area);
        assert!((r - l - MIN_WIDTH).abs() < 1e-9);
    }

    #[test]
    fn only_the_grip_at_each_end_takes_the_pointer_and_only_low_on_the_screen() {
        let area = screen();
        let ends = (200.0, 1000.0);
        let floor = area.y + area.h;
        assert!(on_grip(&area, ends, (210.0, floor - 10.0)));
        assert!(on_grip(&area, ends, (990.0, floor - 10.0)));
        assert!(
            !on_grip(&area, ends, (600.0, floor - 10.0)),
            "the middle lets clicks through"
        );
        assert!(!on_grip(&area, ends, (210.0, floor - HEIGHT - 20.0)), "above the grass");
        assert!(!on_grip(&area, ends, (150.0, floor - 10.0)), "past its end");
        assert!(over(&area, ends, (600.0, floor - HEIGHT - 4.0)), "the blade tips count");
        assert!(!over(&area, ends, (1100.0, floor - 10.0)));
    }

    #[test]
    fn the_page_sizes_the_strip_and_its_grips_as_they_take_the_pointer() {
        let area = screen();
        let view = view("0", &area, (200.0, 1000.0));
        assert_eq!(view["height"], HEIGHT);
        let [left, right] = grips(&area, (200.0, 1000.0));
        assert_eq!(view["gripWidth"], left.w);
        assert_eq!((left.h, right.w), (HEIGHT, left.w));
    }

    #[test]
    fn a_friend_walks_over_the_grass_with_room_for_its_box() {
        let area = screen();
        assert_eq!(walk_range(&area, (400.0, 900.0), 50.0), (330.0, 640.0));
        assert_eq!(
            walk_range(&area, (0.0, 1440.0), 50.0),
            (0.0, 1440.0),
            "kept on the screen"
        );
    }
}
