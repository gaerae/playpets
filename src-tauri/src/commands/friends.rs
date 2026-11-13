// Commands about the friends themselves: joining, leaving, their looks, gifts and the bond.
use super::*;

// Commands with more to them than a line.
/// (x, y, day, event, friend): the friend brings an everyday gift, on a day the two did something
/// together (bond.rs counts it).
pub(super) fn receive_gift(c: &Ctx) -> Result<Value, String> {
    let (x, y) = (c.float(0), c.float(1));
    let (day, from) = (c.text(2), c.text(4));
    let now = now_ms();
    // A day that has not come anywhere yet is a clock set ahead (pets::has_come).
    if !crate::pets::has_come(day, now) {
        return Err(i18n::t("error.bad_request"));
    }
    commit(c.app, &c.state, |d| {
        // A clock set ahead and put right while the app ran left a day still to come.
        let latest = crate::pets::latest_day(now_ms());
        crate::pets::forget_days_after(&mut d.bonds, &mut d.garden, &latest);
        require_pet(d, from)?;
        if !d.bonds.together_on(from, day) {
            return Err(i18n::t("error.bad_request"));
        }
        d.garden.gift(x, y, day, now, c.arg(3).as_str(), from).map(|g| json!(g))
    })
}

/// (book, id, hook, local day): an album find hung on the Christmas tree (garden.rs hang_ornament).
pub(super) fn hang_ornament(c: &Ctx) -> Result<Value, String> {
    let (book, id, day) = (c.text(0), c.text(1), c.text(3));
    let hook = c
        .arg(2)
        .as_u64()
        .and_then(|h| u32::try_from(h).ok())
        .ok_or_else(|| i18n::t("error.bad_request"))?;
    // A day that has not come anywhere yet is a clock set ahead (pets::has_come).
    if !crate::pets::has_come(day, now_ms()) {
        return Err(i18n::t("error.bad_request"));
    }
    commit(c.app, &c.state, |d| {
        crate::pets::forget_days_after(&mut d.bonds, &mut d.garden, &crate::pets::latest_day(now_ms()));
        let AppData { garden, album, .. } = d;
        garden.hang_ornament(album, book, id, hook, day).map(|o| json!(o))
    })
}

/// (book, id, local day): an ornament taken down again, its hook free; the day's count stays
/// (garden.rs take_down_ornament).
pub(super) fn take_down_ornament(c: &Ctx) -> Result<Value, String> {
    let (book, id, day) = (c.text(0), c.text(1), c.text(2));
    if !crate::pets::has_come(day, now_ms()) {
        return Err(i18n::t("error.bad_request"));
    }
    commit(c.app, &c.state, |d| {
        crate::pets::forget_days_after(&mut d.bonds, &mut d.garden, &crate::pets::latest_day(now_ms()));
        d.garden.take_down_ornament(book, id, day).map(|o| json!(o))
    })
}

/// (x, y, local day): a snowman built there, once a day (garden.rs build_snowman).
pub(super) fn build_snowman(c: &Ctx) -> Result<Value, String> {
    let (x, y, day) = (c.float(0), c.float(1), c.text(2));
    let now = now_ms();
    // A day that has not come anywhere yet is a clock set ahead (pets::has_come).
    if !crate::pets::has_come(day, now) {
        return Err(i18n::t("error.bad_request"));
    }
    commit(c.app, &c.state, |d| {
        crate::pets::forget_days_after(&mut d.bonds, &mut d.garden, &crate::pets::latest_day(now));
        d.garden.build_snowman(x, y, day, now).map(|s| json!(s))
    })
}

/// (friend, level, x, y, local day): a friend that grew closer brings a gift for the level it
/// reached, on a day the person did something with it, as an everyday gift comes.
pub(super) fn thanks_gift(c: &Ctx) -> Result<Value, String> {
    let (from, x, y, day) = (c.text(0), c.float(2), c.float(3), c.text(4));
    let level = c.arg(1).as_u64().unwrap_or(0) as u32;
    let now = now_ms();
    if !crate::pets::has_come(day, now) {
        return Err(i18n::t("error.bad_request"));
    }
    commit(c.app, &c.state, |d| {
        require_pet(d, from)?;
        if d.bonds.level_of(from) < level || !d.bonds.together_on(from, day) {
            return Err(i18n::t("error.bad_request"));
        }
        d.garden.thanks(from, level, x, y, now).map(|g| json!(g))
    })
}

/// Something done together with a friend: its bond grows (bond.rs keeps what it is worth).
pub(super) fn befriend(c: &Ctx) -> Result<Value, String> {
    let now = now_ms();
    let (pet, reason, day) = (c.text(0), c.text(1), c.text(2));
    // Every reason counts toward a day that has come; time together also waits its turn by the clock.
    if !crate::pets::has_come(day, now) {
        return Err(i18n::t("error.bad_request"));
    }
    let mut d = lock(&c.state);
    require_pet(&d, pet)?;
    let before = d.bonds.get(pet).cloned();
    let (points, level, up) = d.bonds.befriend(pet, reason, day, now)?;
    // A pat past the day's cap changes nothing: no save, no redraw of every page.
    if d.bonds.get(pet) != before.as_ref() {
        crate::app::show_and_save(c.app, d)?;
    }
    Ok(json!({"points": points, "level": level, "up": up}))
}

/// (friends, reason, local day): something done with several friends at once, time together
/// above all: each bond grows as `befriend` grows it, and the change is saved and shown once.
/// Returns each friend's {points, level, up}; one gone meanwhile is left out.
pub(super) fn befriend_many(c: &Ctx) -> Result<Value, String> {
    let now = now_ms();
    let ids = c.parse::<Vec<String>>(0)?;
    let (reason, day) = (c.text(1), c.text(2));
    if !crate::pets::has_come(day, now) {
        return Err(i18n::t("error.bad_request"));
    }
    let mut d = lock(&c.state);
    let (answer, changed) = befriend_all(&mut d, &ids, reason, day, now)?;
    if changed {
        crate::app::show_and_save(c.app, d)?;
    }
    Ok(answer)
}

/// The bonds of every friend among `ids` grow (each once), and whether any changed, so the
/// caller saves and shows them once.
fn befriend_all(d: &mut AppData, ids: &[String], reason: &str, day: &str, now: u64) -> Result<(Value, bool), String> {
    let mut answer = serde_json::Map::new();
    let mut changed = false;
    for id in ids {
        if answer.contains_key(id) || require_pet(d, id).is_err() {
            continue;
        }
        let before = d.bonds.get(id).cloned();
        let (points, level, up) = d.bonds.befriend(id, reason, day, now)?;
        changed |= d.bonds.get(id) != before.as_ref();
        answer.insert(id.clone(), json!({"points": points, "level": level, "up": up}));
    }
    Ok((Value::Object(answer), changed))
}

/// A plant the page sees in flower: counted in the album the first time.
pub(super) fn bloomed(c: &Ctx) -> Result<Value, String> {
    let now = now_ms();
    let mut d = lock(&c.state);
    // Asked again for a plant already counted: nothing changes, nothing is saved.
    let Some(kind) = d.garden.bloom(c.text(0), now)? else {
        return Ok(Value::Null);
    };
    let entry = d.album.flowered(&kind, now);
    crate::app::show_and_save(c.app, d)?;
    Ok(json!({"kind": kind, "entry": entry}))
}

/// The realistic look is a choice only for a pet file that has one (catalog::realistic_appearance).
pub(super) fn has_realistic_art(asset: &catalog::Asset) -> bool {
    asset.realistic_sprite_paths.contains_key("default")
}

pub(super) fn add_pet(
    app: &AppHandle,
    state: &State<Shared>,
    asset_id: &str,
    options: &Value,
) -> Result<Value, String> {
    commit(app, state, |d| {
        let Some(asset) = d.assets.iter().find(|a| a.id == asset_id) else {
            return Err(i18n::t("error.pet_missing"));
        };
        let mut pet = model::create_pet_with_options(asset_id, &d.pets, options)?;
        if pet.visual_style == model::VisualStyle::Realistic && !has_realistic_art(asset) {
            return Err(i18n::t("error.bad_settings"));
        }
        // A new friend starts out as its pet file describes it; people edit from there.
        pet.persona = asset.intro.chars().take(crate::pets::model::PERSONA_MAX).collect();
        let out = serde_json::to_value(&pet).unwrap();
        d.pets.push(pet);
        Ok(out)
    })
}

pub(super) fn update_pet(
    app: &AppHandle,
    state: &State<Shared>,
    cli: &chat::cli::CliManager,
    id: &str,
    patch: &Value,
) -> Result<Value, String> {
    let mut d = lock(state);
    require_pet(&d, id)?;
    let provider_of = |d: &AppData| d.pets.iter().find(|p| p.id == id).map(|p| p.provider_id.clone());
    if let Some(wanted) = patch.get("providerId") {
        let wanted = wanted.as_str().unwrap_or("");
        if !wanted.is_empty() && providers::find(&d, wanted).is_none() {
            return Err(i18n::t("provider.missing"));
        }
        if d.talks.busy(id) {
            return Err(i18n::t("provider.busy"));
        }
    }
    // Turning a friend realistic needs that art; one already realistic keeps saving its other
    // settings even if its pet file lost the art since.
    if patch.get("visualStyle").and_then(model::VisualStyle::from_value) == Some(model::VisualStyle::Realistic) {
        let pet = d.pets.iter().find(|p| p.id == id);
        let allowed = pet.is_some_and(|p| {
            p.visual_style == model::VisualStyle::Realistic
                || d.assets.iter().any(|a| a.id == p.asset_id && has_realistic_art(a))
        });
        if !allowed {
            return Err(i18n::t("error.bad_settings"));
        }
    }
    let before = provider_of(&d);
    model::update_pet(&mut d.pets, id, patch)?;
    // A conversation belongs to the AI it was held with.
    if provider_of(&d) != before {
        chat::reset(&mut d, cli, id);
    }
    // A friend that walked somewhere is saved with the next few; anything else at once.
    let only_moved = patch
        .as_object()
        .is_some_and(|o| o.keys().all(|k| k == "x" || k == "y"));
    if only_moved {
        // A friend arrived somewhere: the page already drew it there, so it only hears where,
        // rather than the whole state again (which every window would re-render).
        crate::app::persist_soon(app);
        if let Some(p) = d.pets.iter().find(|p| p.id == id) {
            push_event(app, &json!({"type": "pet-moved", "petId": id, "x": p.x, "y": p.y}));
        }
    } else {
        crate::app::show_and_save(app, d)?;
    }
    Ok(Value::Null)
}

pub(super) fn remove_pet(
    app: &AppHandle,
    state: &State<Shared>,
    cli: &chat::cli::CliManager,
    id: &str,
) -> Result<Value, String> {
    commit(app, state, |d| forget(d, cli, id).map(|()| Value::Null))
}

/// Everything the state keeps about a friend goes with it: its talk, state, notes, bond and thanks.
fn forget(d: &mut AppData, cli: &chat::cli::CliManager, id: &str) -> Result<(), String> {
    require_pet(d, id)?;
    chat::cancel(d, cli, id);
    d.pets.retain(|p| p.id != id);
    chat::reset(d, cli, id);
    d.statuses.remove(id);
    d.activity.remove(id);
    d.bonds.forget(id);
    d.garden.forget_friend(id);
    // An agent that reported to this friend goes back to the first one.
    d.agent_pets.retain(|_, pet| pet != id);
    Ok(())
}

/// A press, a treat, a wave or a jump; without a friend named, everyone joins in.
pub(super) fn play(
    app: &AppHandle,
    state: &State<Shared>,
    action: &str,
    pet_id: Option<&str>,
    overlay_may: &dyn Fn(&str) -> bool,
) -> Result<Value, String> {
    if !["pet", "treat", "wave", "jump"].contains(&action) {
        return Err(i18n::t("error.unknown_play"));
    }
    if let Some(id) = pet_id {
        require_pet(&lock(state), id)?;
        if !overlay_may(id) {
            return Err(i18n::t("error.bad_request"));
        }
    }
    push_event(app, &json!({"type": "play", "action": action, "petId": pet_id}));
    Ok(Value::Null)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app::tests::yard;
    use crate::app::{Source, Status};

    #[test]
    fn a_friend_who_leaves_leaves_no_trace_behind() {
        let pet = |id: &str| json!({"id": id, "assetId": "a", "name": id, "size": 96, "x": 0.5, "y": 0.5});
        let mut d = yard(json!([pet("gone"), pet("stays")]));
        let status = Status {
            state: "working".into(),
            message: String::new(),
            source: Source::Agent,
            at: 1,
            by: String::new(),
        };
        for id in ["gone", "stays"] {
            d.statuses.insert(id.into(), status.clone());
            d.activity.insert(id.into(), Vec::new());
            d.bonds.befriend(id, "gift", "2026-10-09", 0).unwrap();
        }
        d.agent_pets.insert("claude".into(), "gone".into());
        d.agent_pets.insert("codex".into(), "stays".into());
        forget(&mut d, &chat::cli::CliManager::default(), "gone").unwrap();
        assert_eq!(d.pets.iter().map(|p| p.id.as_str()).collect::<Vec<_>>(), ["stays"]);
        assert!(!d.statuses.contains_key("gone") && !d.activity.contains_key("gone"));
        assert!(d.bonds.get("gone").is_none() && d.bonds.get("stays").is_some());
        assert_eq!(d.agent_pets.get("codex").map(String::as_str), Some("stays"));
        assert!(
            !d.agent_pets.contains_key("claude"),
            "its agent goes back to the first friend"
        );
        assert!(forget(&mut d, &chat::cli::CliManager::default(), "gone").is_err());
    }

    #[test]
    fn time_together_for_everyone_is_one_change_with_each_friends_own_points() {
        use crate::pets::bond::TIME_EVERY_MS;
        let pet = |id: &str| json!({"id": id, "assetId": "a", "name": id, "size": 96, "x": 0.5, "y": 0.5});
        let pets = json!([pet("a"), pet("b"), pet("c")]);
        let (mut one_by_one, mut together) = (yard(pets.clone()), yard(pets));
        for d in [&mut one_by_one, &mut together] {
            // One friend is closer already, and was with the person a moment ago.
            d.bonds.befriend("b", "gift", "2026-10-10", 0).unwrap();
            d.bonds.befriend("b", "time", "2026-10-10", TIME_EVERY_MS).unwrap();
        }
        let now = TIME_EVERY_MS + 1000;
        let singles: Vec<_> = ["a", "b", "c"]
            .iter()
            .map(|id| one_by_one.bonds.befriend(id, "time", "2026-10-10", now).unwrap())
            .collect();
        let ids = ["a", "b", "c", "gone", "a"].map(String::from);
        let (answer, changed) = befriend_all(&mut together, &ids, "time", "2026-10-10", now).unwrap();
        assert!(changed, "one save and one push for the whole tick");
        for (id, (points, level, up)) in ["a", "b", "c"].iter().zip(singles) {
            assert_eq!(
                answer[id],
                json!({"points": points, "level": level, "up": up}),
                "{id} gains what it would alone"
            );
            assert_eq!(together.bonds.get(id), one_by_one.bonds.get(id));
        }
        assert!(answer.get("gone").is_none(), "a friend gone meanwhile is left out");
        let (_, again) = befriend_all(&mut together, &ids, "time", "2026-10-10", now + 1).unwrap();
        assert!(!again, "a tick that counts nothing saves nothing");
        assert!(befriend_all(&mut together, &ids, "nonsense", "2026-10-10", now).is_err());
        assert!(befriend_all(&mut together, &ids, "time", "someday", now).is_err());
    }

    #[test]
    fn a_friend_who_leaves_keeps_the_letters_it_wrote() {
        let pet = |id: &str| json!({"id": id, "assetId": "a", "name": id, "size": 96, "x": 0.5, "y": 0.5});
        let mut d = yard(json!([pet("gone"), pet("stays")]));
        d.letters.write(2026, "gone", "hi", 1).unwrap();
        forget(&mut d, &chat::cli::CliManager::default(), "gone").unwrap();
        assert_eq!(d.letters.of(2026).unwrap().friend, "gone");
    }
}
