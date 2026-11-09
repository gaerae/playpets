// Commands that bring pet files in from a page address, a folder or a ZIP, and let one go.
use super::*;

/// Brings a pet in from its page. Cancel ends the wait at once; a read still under way ends with
/// its own timeout, and nothing is saved.
pub(super) fn import_from_url(app: &AppHandle, state: &State<Shared>, url: &str) -> Result<Value, String> {
    let cancel = Arc::new(AtomicBool::new(false));
    let root = {
        let mut d = lock(state);
        d.importing.push(cancel.clone());
        d.store.dir.join("pets")
    };
    let (url, flag) = (url.to_string(), cancel.clone());
    let folder = chat::unless_called_off(&cancel, move || {
        let fetch = importer::unless_cancelled(&flag, &importer::http_fetch);
        importer::import_from_url(&url, &root, &fetch)
    });
    lock(state).importing.retain(|flag| !Arc::ptr_eq(flag, &cancel));
    let asset = catalog::read_pet(&folder?)?;
    register_asset(app, &mut lock(state), asset)
}

pub(super) fn import_from_folder(app: &AppHandle, state: &State<Shared>) -> Result<Value, String> {
    let mut dialog = app.dialog().file().set_title(i18n::t("dialog.pick_pet_folder"));
    if let Some(main) = app.get_webview_window("main") {
        dialog = dialog.set_parent(&main);
    }
    let Some(path) = dialog.blocking_pick_folder().and_then(|f| f.into_path().ok()) else {
        return Ok(Value::Null);
    };
    let asset = catalog::read_pet(&path)?;
    let mut d = lock(state);
    // Picked from where imported pets live, it is still the person's own folder.
    let downloads = d.store.dir.join("pets");
    if catalog::picked_by_hand(&downloads, &asset.folder, &d.picked, &d.assets) {
        d.picked.push(asset.folder.to_string_lossy().into_owned());
    }
    register_asset(app, &mut d, asset)
}

/// A pet ZIP picked on this computer is copied into the data folder's pets, so the ZIP can go.
pub(super) fn import_from_zip(app: &AppHandle, state: &State<Shared>) -> Result<Value, String> {
    let mut dialog = app
        .dialog()
        .file()
        .set_title(i18n::t("dialog.pick_pet_zip"))
        .add_filter("ZIP", &["zip"]);
    if let Some(main) = app.get_webview_window("main") {
        dialog = dialog.set_parent(&main);
    }
    let Some(file) = dialog.blocking_pick_file().and_then(|f| f.into_path().ok()) else {
        return Ok(Value::Null);
    };
    add_zip(app, state, &file)
}

/// Copies a pet ZIP into the data folder and puts it on the shelf.
pub(super) fn add_zip(app: &AppHandle, state: &State<Shared>, file: &std::path::Path) -> Result<Value, String> {
    let root = lock(state).store.dir.join("pets");
    let folder = importer::import_from_zip(file, &root)?;
    let asset = catalog::read_pet(&folder)?;
    register_asset(app, &mut lock(state), asset)
}

/// Takes an imported or picked pet off the shelf. An imported one's folder in the data folder goes
/// with it; a folder picked by hand is the person's and stays.
pub(super) fn remove_asset(app: &AppHandle, state: &State<Shared>, id: &str) -> Result<Value, String> {
    let mut taken = None;
    commit(app, state, |d| {
        // A friend parked over the limit comes back with its pet at a later start; the page cannot
        // see it, so the refusal names it.
        let title = d
            .assets
            .iter()
            .find(|a| a.id == id)
            .map(|a| a.display_name.clone())
            .unwrap_or_default();
        if let Some(name) = model::parked_user(&d.parked_pets, id, &title) {
            return Err(i18n::tr("error.pet_kept_for_later", &[("name", &name)]));
        }
        let pets = &d.pets;
        let asset = catalog::take_imported(
            &mut d.assets,
            &mut d.imports,
            |id| pets.iter().any(|p| p.asset_id == id),
            id,
        )?;
        d.picked.retain(|folder| std::path::Path::new(folder) != asset.folder);
        taken = Some((asset, d.store.dir.join("pets")));
        Ok(Value::Null)
    })?;
    // Deleted once the shelf is saved without it: files left by a failed delete are never read
    // again, since only the listed imports are.
    if let Some((asset, downloads)) = taken
        && let Some(folder) = catalog::deletable(&downloads, asset.place, &asset.folder)
    {
        let _ = std::fs::remove_dir_all(folder);
    }
    Ok(Value::Null)
}
