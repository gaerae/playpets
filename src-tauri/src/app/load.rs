// The state at start: the pets found on this computer, the saved state read back (what makes no
// sense left out, a newer app's keys carried along), and the language to speak.
use super::*;

/// The pets on this computer: the samples that ship with the app (first, in their order), Codex's
/// own pet folder, and the folders brought in by address or picked by hand.
struct FoundPets {
    assets: Vec<catalog::Asset>,
    codex_root: PathBuf,
    builtin_root: PathBuf,
    warnings: Vec<String>,
}
fn load_assets(app: &tauri::App, store: &store::Store, imports: &[String]) -> FoundPets {
    let mut warnings = Vec::new();
    // Codex keeps its pets in ~/.codex/pets; they are offered without being imported.
    let codex_root = std::env::var("CODEX_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| app.path().home_dir().map(|h| h.join(".codex")).unwrap_or_default())
        .join("pets");
    // The sample pets come first so a fresh install has something to invite.
    let (builtin_root, unpack_warnings) = builtin::unpack(&store.dir.join("builtin"));
    warnings.extend(unpack_warnings);
    let (mut assets, builtin_warnings) = catalog::scan_pets(&builtin_root, catalog::Place::Builtin);
    assets.sort_by_key(|a| {
        builtin::ORDER
            .iter()
            .position(|id| a.folder.ends_with(id))
            .unwrap_or(usize::MAX)
    });
    warnings.extend(builtin_warnings);
    let (codex_assets, scan_warnings) = catalog::scan_pets(&codex_root, catalog::Place::Codex);
    assets.extend(codex_assets);
    warnings.extend(scan_warnings);
    for folder in imports {
        match catalog::read_pet(std::path::Path::new(folder)) {
            Ok(a) => {
                if !assets.iter().any(|x| x.id == a.id) {
                    assets.push(catalog::Asset {
                        place: catalog::place_of(&store.dir.join("pets"), &a.folder),
                        ..a
                    });
                }
            }
            Err(e) => warnings.push(e),
        }
    }
    FoundPets {
        assets,
        codex_root,
        builtin_root,
        warnings,
    }
}

/// The saved AI connections this app can use, and the ones it cannot (a kind it does not know),
/// which are kept as they were.
fn load_providers(raw: &Value) -> (Vec<Value>, Vec<Value>) {
    let mut providers: Vec<Value> = Vec::new();
    let mut parked: Vec<Value> = Vec::new();
    for p in raw
        .get("providers")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .take(providers::LIMIT)
    {
        let Some(id) = p.get("id").and_then(|v| v.as_str()) else {
            continue;
        };
        if providers.iter().chain(&parked).any(|q| providers::id_of(q) == id) {
            continue;
        }
        match http::validate_config(&p) {
            Ok(config) => providers.push(providers::entry(id, &p, &config)),
            Err(_) => parked.push(p),
        }
    }
    (providers, parked)
}

/// Reads the saved state and the pets on this computer. Whatever cannot be used (a pet whose
/// file is gone, a connection that no longer validates) is left out rather than failing the start.
pub fn load_state(app: &tauri::App) -> tauri::Result<AppData> {
    let data_dir = match std::env::var("PLAYPETS_DATA") {
        Ok(dir) if !dir.is_empty() => PathBuf::from(dir),
        _ => app.path().app_data_dir()?,
    };
    let store = store::Store { dir: data_dir };
    let mut warnings = Vec::new();
    let raw = store.read("state.json", json!({})).unwrap_or_else(|e| {
        warnings.push(e);
        json!({})
    });
    // A file from a newer app: its known fields are read, the rest travels along (`extra`,
    // parked providers), and a copy is kept before this app writes its own shape over it.
    let schema = raw.get("schema").and_then(|v| v.as_u64()).unwrap_or(0);
    if schema > SCHEMA {
        store.keep_copy("state.json", &format!("newer-{schema}"));
        warnings.push(i18n::tr("store.newer", &[("name", "state.json")]));
    }
    let language = i18n::pick_language(
        raw.get("language").and_then(|v| v.as_str()),
        i18n::forced().as_deref(),
        sys_locale::get_locale().as_deref(),
    );
    i18n::set(language);
    let strings = |key: &str| -> Vec<String> {
        raw.get(key)
            .and_then(|v| v.as_array())
            .map(|a| a.iter().filter_map(|v| v.as_str().map(str::to_string)).collect())
            .unwrap_or_default()
    };

    let imports: Vec<String> = strings("imports").into_iter().take(200).collect();
    let agent_pets: HashMap<String, String> = raw
        .get("agentPets")
        .and_then(|v| v.as_object())
        .map(|o| {
            o.iter()
                .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                .collect()
        })
        .unwrap_or_default();
    let found = load_assets(app, &store, &imports);
    let (assets, root, builtin_root) = (found.assets, found.codex_root, found.builtin_root);
    warnings.extend(found.warnings);

    let asset_ids: Vec<String> = assets.iter().map(|a| a.id.clone()).collect();
    let mut pets = model::restore_pets(&raw, &asset_ids);
    let parked_pets = model::parked_pets(&raw, &pets);
    if !parked_pets.is_empty() {
        warnings.push(i18n::tr("pets.parked", &[("count", &parked_pets.len().to_string())]));
    }
    let (providers, parked) = load_providers(&raw);
    for p in pets.iter_mut() {
        if !providers.iter().any(|c| providers::id_of(c) == p.provider_id) {
            p.provider_id.clear();
        }
    }

    // A friend that is no longer there takes its bond with it; a parked one keeps it.
    let ids: Vec<String> = pets
        .iter()
        .map(|p| p.id.clone())
        .chain(parked_pets.iter().filter_map(|p| p["id"].as_str().map(str::to_string)))
        .collect();
    let mut bonds = bond::Bonds::restore(raw.get("bonds"), &ids);
    let mut garden = garden::Garden::restore(raw.get("garden"));
    crate::pets::forget_days_after(&mut bonds, &mut garden, &crate::pets::latest_day(now_ms()));
    Ok(AppData {
        store,
        codex_pets: root,
        builtin_pets: builtin_root,
        assets,
        warnings,
        pets,
        prefs: Prefs::restore(&raw, language),
        imports,
        agent_pets,
        autostart: false,
        garden,
        album: album::Album::restore(raw.get("album")),
        bonds,
        providers,
        parked_providers: parked,
        parked_pets,
        extra: extras(&raw),
        secret_ids: strings("secretIds").into_iter().collect(),
        statuses: Map::new(),
        talks: chat::Talks::default(),
        provider_updates: HashSet::new(),
        detected: json!({"claude": false, "codex": false, "ollama": []}),
        activity: HashMap::new(),
    })
}
