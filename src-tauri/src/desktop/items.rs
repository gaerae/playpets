// What is out on the desktop: each friend, decoration, flower and planted tree says so itself
// (Pet::on_desktop, Decor::on_desktop, Plant::on_desktop, Tree::on_desktop), and stays in the yard
// as well. The overlay draws these; the one switch in the
// menus sends every friend out, or brings everything in.
use super::overlay::Item;
use crate::i18n;
use crate::pets::content::catalog;
use crate::pets::garden::Garden;
use crate::pets::model::Pet;

/// How much bigger a decoration is drawn than its catalogue footprint, as the yard draws it beside a
/// friend (src/yard/props.js giftSize): a friend's sprite is its size in pixels on the desktop.
pub const DECOR_SCALE: f64 = 1.05;

/// A flower's drawing on the desktop (40 × 60 at every stage) at the yard's 1.25 pixels a unit
/// (src/yard/garden.js UNIT).
const PLANT_BOX: (f64, f64) = (50.0, 75.0);

/// Yard pixels a catalogue unit at full size (src/yard/garden.js UNIT).
const UNIT: f64 = 1.25;

/// A flower's planted patch, when it is drawn as one at `now`: in bloom, of a kind that has one, and
/// not set to one bloom (`single`), as src/yard/growth.js plantLook says.
fn patch_now(kind: &str, planted: u64, single: bool, now: u64) -> Option<((f64, f64), f64)> {
    let bloomed = now.saturating_sub(planted) >= catalog().bloom_after_ms();
    if bloomed && !single {
        catalog().patch(kind)
    } else {
        None
    }
}

/// A flower's box on the desktop at `now`: its drawing, taller once a tall kind buds, or its patch
/// once it blooms as one, as the overlay draws it (src/overlay/growing.js). The overlay takes the
/// pointer over the whole box, so it is no bigger than what is drawn; main.rs looks again each
/// minute while a flower is out.
fn plant_box(kind: &str, planted: u64, single: bool, now: u64) -> (f64, f64) {
    if let Some(((w, h), _)) = patch_now(kind, planted, single, now) {
        return ((w * UNIT).round(), (h * UNIT).round());
    }
    let tall = catalog().stature_at(kind, now.saturating_sub(planted));
    ((PLANT_BOX.0 * tall).round(), (PLANT_BOX.1 * tall).round())
}

/// Where a flower's drawing ends on the desktop at `now`, as a share of its box from the top: a cut
/// stem, or a patch's grass, may end above it once it blooms (catalog.json "foot"); before, it
/// stands in its soil at the box's edge, as the overlay draws it (src/overlay/growing.js).
fn plant_foot(kind: &str, planted: u64, single: bool, now: u64) -> f64 {
    if let Some((_, foot)) = patch_now(kind, planted, single, now) {
        foot
    } else if now.saturating_sub(planted) >= catalog().bloom_after_ms() {
        catalog().bloom_foot(kind)
    } else {
        1.0
    }
}

/// Whether the yard hides a decoration kind: one it last reported (`hidden`), or, before it reports
/// (`None`), every kind that comes and goes.
fn left_out(kind: &str, hidden: Option<&[String]>) -> bool {
    match hidden {
        Some(kinds) => kinds.iter().any(|k| k == kind),
        None => catalog().comes_and_goes(kind),
    }
}

/// Whether anything is out on the desktop (what the menus' switch shows). A decoration the yard
/// hides does not count: nothing of it is drawn.
pub fn anything_out(pets: &[Pet], garden: &Garden, hidden: Option<&[String]>) -> bool {
    pets.iter().any(|p| p.on_desktop)
        || garden.decor.iter().any(|d| d.on_desktop && !left_out(&d.kind, hidden))
        || garden.plants.iter().any(|p| p.on_desktop)
        || garden.trees.iter().any(|t| t.on_desktop)
}

/// What the overlay draws: the friends out, then the decorations out, each with its last place. A
/// decoration the yard hides (`hidden`, the kinds it last reported) is left out, so nothing unseen
/// draws or catches clicks; it keeps its place for when it shows. Before the yard reports (`None`),
/// every kind that comes and goes is left out, so nothing flashes at start.
pub fn items(pets: &[Pet], garden: &Garden, hidden: Option<&[String]>) -> Vec<Item> {
    let friends = pets.iter().filter(|p| p.on_desktop).map(friend);
    let decor = garden
        .decor
        .iter()
        .filter(|d| d.on_desktop && !left_out(&d.kind, hidden))
        .map(decoration);
    // A flower and a tree stay out whatever the yard shows: the desktop is not any one place.
    let now = crate::app::now_ms();
    let plants = garden.plants.iter().filter(|p| p.on_desktop).map(|p| plant(p, now));
    let trees = garden.trees.iter().filter(|t| t.on_desktop).filter_map(tree);
    friends.chain(decor).chain(plants).chain(trees).collect()
}

/// The friend, decoration, flower or planted tree `id` as the overlay would draw it out on the
/// desktop, out or not: the yard asks before sending it out (overlay.rs `warm`).
pub fn one(pets: &[Pet], garden: &Garden, id: &str) -> Option<Item> {
    if let Some(p) = pets.iter().find(|p| p.id == id) {
        return Some(friend(p));
    }
    if let Some(d) = garden.decor.iter().find(|d| d.id == id) {
        return Some(decoration(d));
    }
    if let Some(p) = garden.plants.iter().find(|p| p.id == id) {
        return Some(plant(p, crate::app::now_ms()));
    }
    garden.trees.iter().find(|t| t.id == id).and_then(tree)
}

fn spot(at: Option<crate::pets::model::Pos>) -> Option<(f64, f64)> {
    at.map(|q| (q.x as f64, q.y as f64))
}

fn friend(p: &Pet) -> Item {
    Item {
        id: p.id.clone(),
        size: p.size,
        saved: spot(p.desktop_position),
        decor: None,
        foot: 1.0,
        hangs: false,
    }
}

fn decoration(d: &crate::pets::garden::Decor) -> Item {
    let (w, h) = catalog().gift_size(&d.kind).unwrap_or((64.0, 64.0));
    // A fish out is drawn by its length (content.rs find_scale), as in the yard.
    let scale = DECOR_SCALE * catalog().find_scale(&d.kind, &d.holds);
    Item {
        id: d.id.clone(),
        size: 0.0,
        saved: spot(d.desktop_position),
        decor: Some((d.kind.clone(), (w * scale).round(), (h * scale).round())),
        foot: catalog().gift_foot(&d.kind),
        hangs: catalog().hangs(&d.kind),
    }
}

/// How far the top left of a flower's box at `now` is from that of its one bloom (`plant_box` fully
/// grown and single) standing on the same foot, the middle of where its drawing ends. A flower's
/// spot is kept as its one bloom's: 1.10.0 kept every flower in bloom so, and a box that changes
/// while the app is closed (a bud that blooms, a tall one that buds, a patch that blooms) then
/// still stands where it was left. In whole pixels, so a spot kept and read back is the same spot.
fn from_bloom(p: &crate::pets::garden::Plant, now: u64) -> (i64, i64) {
    let (bw, bh) = plant_box(&p.kind, 0, true, u64::MAX);
    let bloom_foot = catalog().bloom_foot(&p.kind);
    let (w, h) = plant_box(&p.kind, p.planted, p.single, now);
    let foot = plant_foot(&p.kind, p.planted, p.single, now);
    (
        ((bw - w) / 2.0).round() as i64,
        (bh * bloom_foot - h * foot).round() as i64,
    )
}

/// The spot kept for flower `p` left at `x`, `y` (its box's top left at `now`): its one bloom's.
fn kept(p: &crate::pets::garden::Plant, x: i64, y: i64, now: u64) -> crate::pets::model::Pos {
    let (dx, dy) = from_bloom(p, now);
    crate::pets::model::Pos { x: x - dx, y: y - dy }
}

fn plant(p: &crate::pets::garden::Plant, now: u64) -> Item {
    let (w, h) = plant_box(&p.kind, p.planted, p.single, now);
    let (dx, dy) = from_bloom(p, now);
    Item {
        id: p.id.clone(),
        size: 0.0,
        saved: p.desktop_position.map(|q| ((q.x + dx) as f64, (q.y + dy) as f64)),
        decor: Some((p.kind.clone(), w, h)),
        foot: plant_foot(&p.kind, p.planted, p.single, now),
        hangs: false,
    }
}

/// A tree's box is its stage's, as the backend last grew it (discovery.rs grow_trees).
fn tree(t: &crate::pets::discovery::Tree) -> Option<Item> {
    let (w, h) = catalog().tree_size(&t.kind, usize::from(t.stage.min(2)))?;
    Some(Item {
        id: t.id.clone(),
        size: 0.0,
        saved: spot(t.desktop_position),
        decor: Some((t.kind.clone(), w, h)),
        foot: 1.0,
        hangs: false,
    })
}

/// The menus' switch: with anything out, everything comes in; otherwise every friend goes out.
/// A decoration the yard hides stays as it is, so it is back on the desktop when it shows again.
/// Returns whether anything is out now.
pub fn flip(pets: &mut [Pet], garden: &mut Garden, hidden: Option<&[String]>) -> bool {
    let out = !anything_out(pets, garden, hidden);
    for p in pets.iter_mut() {
        p.on_desktop = out;
    }
    if !out {
        for d in garden.decor.iter_mut().filter(|d| !left_out(&d.kind, hidden)) {
            d.on_desktop = false;
        }
        for p in garden.plants.iter_mut() {
            p.on_desktop = false;
        }
        for t in garden.trees.iter_mut() {
            t.on_desktop = false;
        }
    }
    out
}

/// Sends one friend, decoration, flower or planted tree out to the desktop, or brings it in.
pub fn set(pets: &mut [Pet], garden: &mut Garden, id: &str, on: bool) -> Result<(), String> {
    if let Some(p) = pets.iter_mut().find(|p| p.id == id) {
        p.on_desktop = on;
    } else if let Some(d) = garden.decor.iter_mut().find(|d| d.id == id) {
        d.on_desktop = on;
    } else if let Some(p) = garden.plants.iter_mut().find(|p| p.id == id) {
        p.on_desktop = on;
    } else if let Some(t) = garden.trees.iter_mut().find(|t| t.id == id) {
        t.on_desktop = on;
    } else {
        return Err(i18n::t("error.bad_request"));
    }
    Ok(())
}

/// Keeps where a friend, decoration, flower or planted tree was left on the desktop (`x`, `y`: its
/// box's top left); a flower's as its one bloom's (from_bloom).
pub fn place(pets: &mut [Pet], garden: &mut Garden, id: &str, x: i64, y: i64) {
    let at = Some(crate::pets::model::Pos { x, y });
    if let Some(p) = pets.iter_mut().find(|p| p.id == id) {
        p.desktop_position = at;
    } else if let Some(d) = garden.decor.iter_mut().find(|d| d.id == id) {
        d.desktop_position = at;
    } else if let Some(p) = garden.plants.iter_mut().find(|p| p.id == id) {
        p.desktop_position = Some(kept(p, x, y, crate::app::now_ms()));
    } else if let Some(t) = garden.trees.iter_mut().find(|t| t.id == id) {
        t.desktop_position = at;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pets::garden::Decor;
    use crate::pets::model::create_pet;

    fn yard() -> (Vec<Pet>, Garden) {
        let mut pets = Vec::new();
        for id in ["miso", "pip"] {
            let mut p = create_pet("white", &pets).unwrap();
            p.id = id.into();
            pets.push(p);
        }
        let mut garden = Garden::default();
        garden.decor.push(Decor {
            id: "bench".into(),
            kind: "bench".into(),
            ..Decor::default()
        });
        (pets, garden)
    }

    #[test]
    fn each_friend_and_decoration_goes_out_on_its_own() {
        let (mut pets, mut garden) = yard();
        assert!(!anything_out(&pets, &garden, Some(&[])) && items(&pets, &garden, Some(&[])).is_empty());
        set(&mut pets, &mut garden, "pip", true).unwrap();
        set(&mut pets, &mut garden, "bench", true).unwrap();
        assert!(set(&mut pets, &mut garden, "nobody", true).is_err());
        let out = items(&pets, &garden, Some(&[]));
        assert_eq!(out.iter().map(|i| i.id.as_str()).collect::<Vec<_>>(), ["pip", "bench"]);
        assert!(out[0].decor.is_none());
        // Drawn beside a friend as in the yard: the bench is wider than a friend of the usual size.
        let (kind, w, h) = out[1].decor.clone().unwrap();
        assert_eq!((kind.as_str(), w, h), ("bench", 151.0, 121.0));
        assert!(w > pets[1].size);
        place(&mut pets, &mut garden, "bench", 40, 700);
        assert_eq!(items(&pets, &garden, Some(&[]))[1].saved, Some((40.0, 700.0)));
        set(&mut pets, &mut garden, "pip", false).unwrap();
        assert_eq!(items(&pets, &garden, Some(&[])).len(), 1);
        assert!(anything_out(&pets, &garden, Some(&[])), "the bench is still out");
    }

    // Everything the yard shows can go out, the snowman too: the overlay draws what it wears.
    #[test]
    fn a_snowman_goes_out_on_the_desktop_as_any_gift_does() {
        let (mut pets, mut garden) = yard();
        garden.decor.push(Decor {
            id: "snow".into(),
            kind: "snowman".into(),
            dress: vec!["hat".into()],
            ..Decor::default()
        });
        set(&mut pets, &mut garden, "snow", true).unwrap();
        assert!(garden.decor[1].on_desktop);
        let out = items(&pets, &garden, Some(&[]));
        assert_eq!(out[0].decor.as_ref().map(|d| d.0.as_str()), Some("snowman"));
        set(&mut pets, &mut garden, "snow", false).unwrap();
        assert!(!garden.decor[1].on_desktop);
    }

    // A flower's box is its drawing as it is now, so no empty room above a young tall flower takes
    // the desktop's clicks; it grows when the flower buds (catalog.json garden.stages, at 120 minutes).
    #[test]
    fn a_tall_flower_takes_its_room_on_the_desktop_only_once_it_buds() {
        let bud = 120 * 60 * 1000;
        assert_eq!(plant_box("sunflower", 1000, false, 1000), (50.0, 75.0));
        assert_eq!(plant_box("sunflower", 1000, false, 1000 + bud - 1), (50.0, 75.0));
        assert_eq!(plant_box("sunflower", 1000, false, 1000 + bud), (70.0, 105.0));
        assert_eq!(plant_box("tulip", 0, true, 10 * bud), (50.0, 75.0));
        // A clock set back reads as just planted.
        assert_eq!(plant_box("sunflower", 5000, false, 1000), (50.0, 75.0));
    }

    // In bloom a flower with a patch (catalog.json "patch") is drawn as it, at its size at the yard's
    // 1.25 pixels a unit (src/overlay/growing.js), unless set to one bloom; one with none is as before.
    #[test]
    fn a_flower_in_bloom_takes_its_patch_s_room_unless_set_to_one_bloom() {
        let bloom = catalog().bloom_after_ms();
        assert_eq!(plant_box("tulip", 0, false, bloom), (95.0, 93.0));
        assert_eq!(plant_box("sunflower", 0, false, bloom), (83.0, 128.0));
        assert_eq!(plant_box("sunflower", 0, true, bloom), (70.0, 105.0));
        assert_eq!(plant_box("daffodil", 0, false, bloom), (50.0, 75.0));
        assert_eq!(plant_foot("tulip", 0, false, bloom), 0.96);
        assert_eq!(plant_foot("tulip", 0, true, bloom), 0.932);
        assert_eq!(plant_foot("tulip", 0, false, bloom - 1), 1.0);
    }

    // Where a flower out on the desktop stands: the middle of where its drawing ends.
    fn foot_of(item: &Item) -> (f64, f64) {
        let ((_, w, h), (x, y)) = (item.decor.clone().unwrap(), item.saved.unwrap());
        (x + w / 2.0, y + h * item.foot)
    }

    // A flower's box changes as it grows, and as it blooms into a patch, also while the app is
    // closed; the overlay keeps its foot put only between two looks in one run. Where it was left
    // is kept so that its foot stays where it stood whatever it has grown into since.
    #[test]
    fn a_flower_left_on_the_desktop_stands_where_it_was_left_whatever_it_grew_into() {
        let bloom = catalog().bloom_after_ms();
        let (_, mut garden) = garden_with_growing();
        let close = |a: (f64, f64), b: (f64, f64)| (a.0 - b.0).abs() <= 0.5 && (a.1 - b.1).abs() <= 0.5;
        // Kept by 1.10.0 while in bloom: the top left of its one bloom (50 x 75, its stem ending
        // 93.2% down). It comes back a patch, 95 x 93, on the same spot.
        let tulip = &mut garden.plants[0];
        tulip.kind = "tulip".into();
        tulip.desktop_position = Some(crate::pets::model::Pos { x: 500, y: 700 });
        let patch = plant(tulip, tulip.planted + bloom);
        assert_eq!(patch.decor.as_ref().map(|d| (d.1, d.2)), Some((95.0, 93.0)));
        let stood = (525.0, 700.0 + 75.0 * 0.932);
        assert!(close(foot_of(&patch), stood), "{:?}", foot_of(&patch));
        // Set to one bloom: the same spot again.
        tulip.single = true;
        assert!(close(foot_of(&plant(tulip, tulip.planted + bloom)), stood));
        // Left as a sprout, it blooms while the app is closed; a sunflower buds taller first.
        for (kind, single) in [("tulip", false), ("sunflower", false), ("sunflower", true)] {
            let p = &mut garden.plants[0];
            (p.kind, p.single) = (kind.into(), single);
            let young = p.planted + 1;
            let sprout = plant(p, young);
            p.desktop_position = Some(kept(p, 300, 400, young));
            let left = foot_of(&Item {
                saved: Some((300.0, 400.0)),
                ..sprout
            });
            for later in [young, p.planted + 120 * 60 * 1000, p.planted + bloom] {
                let grown = plant(p, later);
                assert!(
                    close(foot_of(&grown), left),
                    "{kind} {single} at {later}: {:?}",
                    foot_of(&grown)
                );
            }
            // Saved again where it stands, it comes back to the very same spot: nothing creeps.
            let grown = plant(p, p.planted + bloom);
            let (x, y) = grown.saved.unwrap();
            p.desktop_position = Some(kept(p, x as i64, y as i64, p.planted + bloom));
            assert_eq!(plant(p, p.planted + bloom).saved, grown.saved);
        }
    }

    // A drawing may end above its box's edge (catalog.json "foot"); the overlay stands it there.
    #[test]
    fn what_goes_out_says_where_its_drawing_ends() {
        let (mut pets, mut garden) = yard();
        garden.decor.push(Decor {
            id: "sign".into(),
            kind: "signpost".into(),
            ..Decor::default()
        });
        set(&mut pets, &mut garden, "bench", true).unwrap();
        set(&mut pets, &mut garden, "sign", true).unwrap();
        set(&mut pets, &mut garden, "pip", true).unwrap();
        let out = items(&pets, &garden, Some(&[]));
        let foot = |id: &str| out.iter().find(|i| i.id == id).unwrap().foot;
        assert_eq!((foot("bench"), foot("sign")), (0.94, 0.82));
        assert_eq!(foot("pip"), 1.0, "a friend's box is its own");
        // A flower's stem ends above its drawing once it blooms; before, it stands in its soil.
        let bloom = catalog().bloom_after_ms();
        assert_eq!(plant_foot("tulip", 1000, true, 1000 + bloom - 1), 1.0);
        assert_eq!(plant_foot("tulip", 1000, true, 1000 + bloom), 0.932);
        assert_eq!(plant_foot("no-such-flower", 0, false, bloom), 1.0);
    }

    #[test]
    fn a_chime_goes_out_able_to_hang_and_a_bench_does_not() {
        let (mut pets, mut garden) = yard();
        garden.decor.push(Decor {
            id: "chime".into(),
            kind: "windchime".into(),
            ..Decor::default()
        });
        set(&mut pets, &mut garden, "chime", true).unwrap();
        set(&mut pets, &mut garden, "bench", true).unwrap();
        let out = items(&pets, &garden, Some(&[]));
        let hangs = |id: &str| out.iter().find(|i| i.id == id).unwrap().hangs;
        assert!(hangs("chime") && !hangs("bench"));
    }

    // A sturgeon out takes more of the desktop than a killifish: its box follows the fish's length.
    #[test]
    fn a_big_fish_goes_out_bigger_than_a_small_one() {
        let (mut pets, mut garden) = yard();
        for (id, fish) in [("big", "sturgeon"), ("small", "killifish")] {
            garden.decor.push(Decor {
                id: id.into(),
                kind: "fish_out".into(),
                holds: vec![fish.into()],
                ..Decor::default()
            });
            set(&mut pets, &mut garden, id, true).unwrap();
        }
        let out = items(&pets, &garden, Some(&[]));
        let size = |id: &str| {
            let (_, w, h) = out.iter().find(|i| i.id == id).unwrap().decor.clone().unwrap();
            (w, h)
        };
        let (bw, bh) = size("big");
        let (sw, sh) = size("small");
        assert!(bw > 2.0 * sw && bh > 2.0 * sh, "{bw}x{bh} against {sw}x{sh}");
    }

    fn garden_with_growing() -> (Vec<Pet>, Garden) {
        let (pets, mut garden) = yard();
        garden.seeds = 1;
        garden.plant("sunflower", 0.5, 0.5, 1).unwrap();
        garden.plants[0].id = "sun".into();
        garden.trees.push(crate::pets::discovery::Tree {
            id: "cherry".into(),
            world: "meadow".into(),
            kind: "cherry".into(),
            x: 0.5,
            y: 0.5,
            planted: 1,
            stage: 0,
            matured: false,
            on_desktop: false,
            desktop_position: None,
        });
        (pets, garden)
    }

    // Everything the yard shows can go out: a flower and a planted tree too, drawn at the yard's size.
    #[test]
    fn a_flower_and_a_planted_tree_go_out_and_come_back_in() {
        let (mut pets, mut garden) = garden_with_growing();
        set(&mut pets, &mut garden, "sun", true).unwrap();
        set(&mut pets, &mut garden, "cherry", true).unwrap();
        assert!(garden.plants[0].on_desktop && garden.trees[0].on_desktop);
        assert!(anything_out(&pets, &garden, Some(&[])));
        let out = items(&pets, &garden, Some(&[]));
        assert_eq!(out.iter().map(|i| i.id.as_str()).collect::<Vec<_>>(), ["sun", "cherry"]);
        // A flower's box is its grown drawing's: its patch's, or one bloom's, taller for a tall kind; a
        // tree's is its stage's.
        assert_eq!(out[0].decor, Some(("sunflower".into(), 83.0, 128.0)));
        garden.plants[0].single = true;
        assert_eq!(
            items(&pets, &garden, Some(&[]))[0].decor,
            Some(("sunflower".into(), 70.0, 105.0))
        );
        assert_eq!(out[1].decor, Some(("cherry".into(), 35.0, 40.0)));
        garden.trees[0].stage = 2;
        assert_eq!(
            items(&pets, &garden, Some(&[]))[1].decor,
            Some(("cherry".into(), 160.0, 170.0))
        );
        // A tree of another place stays out: the desktop is not any one place.
        assert_eq!(items(&pets, &garden, None).len(), 2);
        place(&mut pets, &mut garden, "sun", 40, 700);
        place(&mut pets, &mut garden, "cherry", 300, 500);
        let out = items(&pets, &garden, Some(&[]));
        assert_eq!(
            (out[0].saved, out[1].saved),
            (Some((40.0, 700.0)), Some((300.0, 500.0)))
        );
        set(&mut pets, &mut garden, "sun", false).unwrap();
        assert_eq!(items(&pets, &garden, Some(&[])).len(), 1);
        // The switch brings everything in, the tree too, and keeps where each was left.
        assert!(!flip(&mut pets, &mut garden, Some(&[])));
        assert!(!garden.trees[0].on_desktop && garden.trees[0].desktop_position.is_some());
        assert!(!anything_out(&pets, &garden, Some(&[])));
    }

    #[test]
    fn a_hidden_kind_is_not_out_on_the_desktop_and_keeps_its_place() {
        let mut garden = Garden::default();
        for kind in ["bench", "xmas_tree"] {
            garden.decor.push(Decor {
                id: kind.into(),
                kind: kind.into(),
                on_desktop: true,
                desktop_position: Some(crate::pets::model::Pos { x: 10, y: 20 }),
                ..Decor::default()
            });
        }
        let kinds = |out: &[Item]| {
            out.iter()
                .filter_map(|i| i.decor.as_ref())
                .map(|d| d.0.clone())
                .collect::<Vec<_>>()
        };
        assert_eq!(items(&[], &garden, Some(&[])).len(), 2);
        let out = items(&[], &garden, Some(&["xmas_tree".to_string()]));
        assert_eq!(kinds(&out), ["bench"]);
        assert!(
            garden
                .decor
                .iter()
                .all(|d| d.on_desktop && d.desktop_position.is_some())
        );
        // Before the yard says, every kind that comes and goes stays in.
        assert_eq!(kinds(&items(&[], &garden, None)), ["bench"]);
    }

    #[test]
    fn the_switch_leaves_a_hidden_decoration_where_it_is() {
        let (mut pets, mut garden) = yard();
        garden.decor.push(Decor {
            id: "tree".into(),
            kind: "xmas_tree".into(),
            on_desktop: true,
            ..Decor::default()
        });
        let hidden = ["xmas_tree".to_string()];
        let tree_out = |garden: &Garden| garden.decor.iter().any(|d| d.id == "tree" && d.on_desktop);
        // Only the hidden tree is out: the menus show nothing out, before the yard says too.
        assert!(!anything_out(&pets, &garden, Some(&hidden)));
        assert!(!anything_out(&pets, &garden, None));
        assert!(anything_out(&pets, &garden, Some(&[])));
        // The switch sends the friends out, then brings them in, and the tree keeps its place for
        // when the yard shows it again.
        assert!(flip(&mut pets, &mut garden, Some(&hidden)));
        assert!(pets.iter().all(|p| p.on_desktop) && tree_out(&garden));
        assert!(!flip(&mut pets, &mut garden, Some(&hidden)));
        assert!(pets.iter().all(|p| !p.on_desktop) && tree_out(&garden));
        // Shown again, it counts as out, and the switch brings it in.
        assert!(anything_out(&pets, &garden, Some(&[])));
        assert!(!flip(&mut pets, &mut garden, Some(&[])) && !tree_out(&garden));
    }

    // The yard opens a thing's menu before it goes out: the overlay readies the screen it will land on,
    // so the thing is told as the overlay will draw it, where it was last left.
    #[test]
    fn a_thing_not_out_yet_is_told_as_it_will_go_out() {
        let (mut pets, mut garden) = garden_with_growing();
        place(&mut pets, &mut garden, "cherry", 300, 500);
        for id in ["pip", "bench", "sun", "cherry"] {
            set(&mut pets, &mut garden, id, true).unwrap();
            let out = items(&pets, &garden, Some(&[]));
            set(&mut pets, &mut garden, id, false).unwrap();
            let one = one(&pets, &garden, id).unwrap();
            let same = out.iter().find(|i| i.id == id).unwrap();
            assert_eq!(
                (&one.decor, one.saved, one.size, one.foot),
                (&same.decor, same.saved, same.size, same.foot)
            );
        }
        assert_eq!(one(&pets, &garden, "cherry").unwrap().saved, Some((300.0, 500.0)));
        assert!(one(&pets, &garden, "nobody").is_none());
    }

    #[test]
    fn the_one_switch_sends_every_friend_out_or_brings_everything_in() {
        let (mut pets, mut garden) = yard();
        assert!(flip(&mut pets, &mut garden, Some(&[])));
        assert!(pets.iter().all(|p| p.on_desktop) && !garden.decor[0].on_desktop);
        set(&mut pets, &mut garden, "bench", true).unwrap();
        assert!(!flip(&mut pets, &mut garden, Some(&[])));
        assert!(!anything_out(&pets, &garden, Some(&[])));
        // Only a decoration out still counts as out, so the switch brings it in.
        set(&mut pets, &mut garden, "bench", true).unwrap();
        assert!(!flip(&mut pets, &mut garden, Some(&[])) && !garden.decor[0].on_desktop);
    }
}
