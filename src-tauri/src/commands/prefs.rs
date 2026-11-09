// Commands for the app's own switches, folders and the pages it may open.
use super::*;

/// Shows where pets live: "codex", "downloaded" or "builtin" for those folders, or a pet file's id.
pub(super) fn open_folder(state: &State<Shared>, which: &str) -> Result<Value, String> {
    let folder = {
        let d = lock(state);
        match which {
            "builtin" => d.builtin_pets.clone(),
            "codex" => d.codex_pets.clone(),
            "downloaded" => d.store.dir.join("pets"),
            // the app's own data: friends, settings and the backups beside them (About)
            "data" => d.store.dir.clone(),
            id => d
                .assets
                .iter()
                .find(|a| a.id == id)
                .map(|a| a.folder.clone())
                .ok_or_else(|| i18n::t("error.pet_missing"))?,
        }
    };
    if !folder.is_dir() {
        return Err(i18n::t("error.folder_empty"));
    }
    system::open_folder(&folder)?;
    Ok(Value::Null)
}

pub(super) fn open_external(raw: &str) -> Result<Value, String> {
    let target = importer::openable(raw)
        .or_else(|| project_page(raw))
        .ok_or_else(|| i18n::t("error.url_not_openable"))?;
    system::open_url(target.as_str())?;
    Ok(Value::Null)
}

/// The app's own pages: its site and its repository (Cargo.toml `homepage` and `repository`, which
/// a test keeps equal to package.json), at those addresses or below them, over https.
pub(super) fn project_page(raw: &str) -> Option<url::Url> {
    let target = url::Url::parse(raw).ok()?;
    let under = |base: &str| {
        let base = base.trim_end_matches('/');
        target
            .as_str()
            .strip_prefix(base)
            .is_some_and(|rest| rest.is_empty() || rest.starts_with(['/', '?', '#']))
    };
    let own = under(env!("CARGO_PKG_HOMEPAGE")) || under(env!("CARGO_PKG_REPOSITORY"));
    (target.scheme() == "https" && own).then_some(target)
}

/// Whether the friends chat among themselves now and then without being asked.
pub(super) fn set_auto_chatter(app: &AppHandle, state: &State<Shared>, on: bool) -> Result<Value, String> {
    commit(app, state, |d| {
        d.prefs.auto_chatter = on;
        Ok(Value::Bool(on))
    })
}

/// Whether idle friends now and then dig on their own without being asked.
pub(super) fn set_auto_play(app: &AppHandle, state: &State<Shared>, on: bool) -> Result<Value, String> {
    commit(app, state, |d| {
        d.prefs.auto_play = on;
        Ok(Value::Bool(on))
    })
}

/// Whether the app starts when the person logs in. The system keeps the answer (startup.rs); a
/// test run only pretends.
pub(super) fn set_autostart(app: &AppHandle, state: &State<Shared>, on: bool) -> Result<Value, String> {
    let now = if e2e_mode() { on } else { crate::startup::set(app, on)? };
    let mut d = lock(state);
    d.autostart = now;
    changed(app, &d);
    Ok(Value::Bool(now))
}

/// Whether the app starts at login, asked again: the person may have changed it in the system's
/// own settings while the app ran. The system is asked before the lock is taken.
pub(super) fn read_autostart(app: &AppHandle, state: &State<Shared>) -> Result<Value, String> {
    let now = if e2e_mode() {
        lock(state).autostart
    } else {
        crate::startup::is_enabled(app)
    };
    let mut d = lock(state);
    if d.autostart != now {
        d.autostart = now;
        changed(app, &d);
    }
    Ok(Value::Bool(now))
}

/// The language the person chose; the page reloads itself in it, the tray and title follow here.
pub(super) fn set_language(app: &AppHandle, state: &State<Shared>, code: &str) -> Result<Value, String> {
    let lang = i18n::Lang::parse(code).ok_or_else(|| i18n::t("error.language"))?;
    // The language stands even when it could not be saved (commit), so the pages follow it either way.
    let saved = commit(app, state, |d| {
        if d.prefs.language != lang {
            d.talks.cancel_pending();
        }
        i18n::set(lang);
        d.prefs.choose_language(lang);
        Ok(Value::Null)
    });
    // Rewording the tray waits on the main thread, which may itself be waiting for the state.
    tray::retitle(app);
    // Every page (the yard, each desktop window) starts over in the new language at once.
    crate::app::relanguage(app, lang.code());
    saved.map(|_| json!(lang.code()))
}
