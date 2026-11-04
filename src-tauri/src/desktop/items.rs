// What is out on the desktop: each friend and each decoration says so itself (Pet::on_desktop,
// Decor::on_desktop), and stays in the yard as well. The overlay draws these; the one switch in the
// menus sends every friend out, or brings everything in.
use super::overlay::Item;
use crate::i18n;
use crate::pets::content::catalog;
use crate::pets::garden::Garden;
use crate::pets::model::Pet;

/// How much bigger a decoration is drawn than its catalogue footprint, as the yard draws it beside a
/// friend (src/yard/props.js giftSize): a friend's sprite is its size in pixels on the desktop.
pub const DECOR_SCALE: f64 = 1.05;

/// Whether anything is out on the desktop (what the menus' switch shows).
pub fn anything_out(pets: &[Pet], garden: &Garden) -> bool {
    pets.iter().any(|p| p.on_desktop) || garden.decor.iter().any(|d| d.on_desktop)
}

/// What the overlay draws: the friends out, then the decorations out, each with its last place.
pub fn items(pets: &[Pet], garden: &Garden) -> Vec<Item> {
    let friends = pets.iter().filter(|p| p.on_desktop).map(|p| Item {
        id: p.id.clone(),
        size: p.size,
        saved: p.desktop_position.map(|q| (q.x as f64, q.y as f64)),
        decor: None,
    });
    let decor = garden.decor.iter().filter(|d| d.on_desktop).map(|d| {
        let (w, h) = catalog().gift_size(&d.kind).unwrap_or((64.0, 64.0));
        Item {
            id: d.id.clone(),
            size: 0.0,
            saved: d.desktop_position.map(|q| (q.x as f64, q.y as f64)),
            decor: Some((d.kind.clone(), (w * DECOR_SCALE).round(), (h * DECOR_SCALE).round())),
        }
    });
    friends.chain(decor).collect()
}

/// The menus' switch: with anything out, everything comes in; otherwise every friend goes out.
/// Returns whether anything is out now.
pub fn flip(pets: &mut [Pet], garden: &mut Garden) -> bool {
    let out = !anything_out(pets, garden);
    for p in pets.iter_mut() {
        p.on_desktop = out;
    }
    if !out {
        for d in &mut garden.decor {
            d.on_desktop = false;
        }
    }
    out
}

/// Sends one friend or decoration out to the desktop, or brings it in.
pub fn set(pets: &mut [Pet], garden: &mut Garden, id: &str, on: bool) -> Result<(), String> {
    if let Some(p) = pets.iter_mut().find(|p| p.id == id) {
        p.on_desktop = on;
    } else if let Some(d) = garden.decor.iter_mut().find(|d| d.id == id) {
        d.on_desktop = on;
    } else {
        return Err(i18n::t("error.bad_request"));
    }
    Ok(())
}

/// Keeps where a friend or a decoration was left on the desktop.
pub fn place(pets: &mut [Pet], garden: &mut Garden, id: &str, x: i64, y: i64) {
    let at = Some(crate::pets::model::Pos { x, y });
    if let Some(p) = pets.iter_mut().find(|p| p.id == id) {
        p.desktop_position = at;
    } else if let Some(d) = garden.decor.iter_mut().find(|d| d.id == id) {
        d.desktop_position = at;
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
        assert!(!anything_out(&pets, &garden) && items(&pets, &garden).is_empty());
        set(&mut pets, &mut garden, "pip", true).unwrap();
        set(&mut pets, &mut garden, "bench", true).unwrap();
        assert!(set(&mut pets, &mut garden, "nobody", true).is_err());
        let out = items(&pets, &garden);
        assert_eq!(out.iter().map(|i| i.id.as_str()).collect::<Vec<_>>(), ["pip", "bench"]);
        assert!(out[0].decor.is_none());
        // Drawn beside a friend as in the yard: the bench is wider than a friend of the usual size.
        let (kind, w, h) = out[1].decor.clone().unwrap();
        assert_eq!((kind.as_str(), w, h), ("bench", 151.0, 121.0));
        assert!(w > pets[1].size);
        place(&mut pets, &mut garden, "bench", 40, 700);
        assert_eq!(items(&pets, &garden)[1].saved, Some((40.0, 700.0)));
        set(&mut pets, &mut garden, "pip", false).unwrap();
        assert_eq!(items(&pets, &garden).len(), 1);
        assert!(anything_out(&pets, &garden), "the bench is still out");
    }

    #[test]
    fn the_one_switch_sends_every_friend_out_or_brings_everything_in() {
        let (mut pets, mut garden) = yard();
        assert!(flip(&mut pets, &mut garden));
        assert!(pets.iter().all(|p| p.on_desktop) && !garden.decor[0].on_desktop);
        set(&mut pets, &mut garden, "bench", true).unwrap();
        assert!(!flip(&mut pets, &mut garden));
        assert!(!anything_out(&pets, &garden));
        // Only a decoration out still counts as out, so the switch brings it in.
        set(&mut pets, &mut garden, "bench", true).unwrap();
        assert!(!flip(&mut pets, &mut garden) && !garden.decor[0].on_desktop);
    }
}
