//! The three named companions (assets/pets),
//! carried inside the binary and unpacked into the data folder, so the shelf is never empty on
//! first start and a friend can be invited before any pet is imported.
use std::fs;
use std::path::{Path, PathBuf};

type EmbeddedFile = (&'static str, &'static [u8]);
struct Builtin {
    id: &'static str,
    files: &'static [EmbeddedFile],
}
// Each file keeps its path relative to the manifest, so unpacking needs no special case. An entry
// `from` another folder reuses that folder's accepted artwork under its own manifest.
macro_rules! pet {
    ($id:literal from $source:literal, $manifest:literal $(, $file:literal)*) => {
        Builtin {
            id: $id,
            files: &[
                ("pet.json", include_bytes!(concat!("../../../assets/pets/", $source, "/", $manifest))),
                $(($file, include_bytes!(concat!("../../../assets/pets/", $source, "/", $file))),)*
            ],
        }
    };
    ($id:literal $(, $file:literal)*) => {
        pet!($id from $id, "pet.json" $(, $file)*)
    };
}
/// The official cast, in the shelf's order.
const PETS: &[Builtin] = &[
    pet!("daisy", "spritesheet.png", "seasonal/summer.png", "seasonal/winter.png"),
    pet!(
        "clover",
        "spritesheet.png",
        "seasonal/summer.png",
        "seasonal/winter.png"
    ),
    pet!("pip", "spritesheet.png", "seasonal/summer.png", "seasonal/winter.png"),
];

/// Where a bundled pet's folder sorts on the shelf; anything else comes after them.
pub fn shelf_rank(folder: &Path) -> usize {
    PETS.iter().position(|p| folder.ends_with(p.id)).unwrap_or(usize::MAX)
}

/// Remap retired app-owned appearances before restoration filters unavailable assets. The path
/// hash is the old asset identity, so this never matches an imported copy of the same character.
pub fn migrate_saved_friends(raw: &mut serde_json::Value, assets: &[crate::pets::catalog::Asset]) {
    use crate::pets::catalog::{Place, sha256_hex_short};
    let Some(pets) = raw.get_mut("pets").and_then(serde_json::Value::as_array_mut) else {
        return;
    };
    for (name, replacement) in [
        ("aria", "daisy"),
        ("aria-full", "daisy"),
        ("noah", "pip"),
        ("noah-full", "pip"),
        ("tabby", "clover"),
        ("smoky", "clover"),
        ("mochi", "clover"),
    ] {
        let Some(target) = assets
            .iter()
            .find(|a| a.place == Place::Builtin && a.folder.ends_with(replacement))
        else {
            continue;
        };
        let Some(root) = target.folder.parent() else {
            continue;
        };
        let retired_id = sha256_hex_short(root.join(name).to_string_lossy().as_bytes());
        for pet in pets.iter_mut() {
            let id = pet.get("assetId").and_then(serde_json::Value::as_str);
            if id == Some(retired_id.as_str()) {
                pet["assetId"] = serde_json::json!(target.id);
                pet["visualStyle"] = serde_json::json!("illustrated");
            }
        }
    }
}

/// Which build wrote the unpacked copy (build.rs fingerprints assets/pets).
const STAMP: &str = env!("PLAYPETS_BUILTIN_STAMP");
const STAMP_FILE: &str = ".stamp";

/// Writes the app-owned sample pets under `root`. A copy stamped by this build is only checked for
/// missing or resized files; after an update every file is compared, so a same-size change still
/// lands. A pet that cannot be written is reported; others unpack.
pub fn unpack(root: &Path) -> (PathBuf, Vec<String>) {
    let mut warnings = Vec::new();
    let current = fs::read_to_string(root.join(STAMP_FILE)).is_ok_and(|s| s == STAMP);
    for pet in PETS {
        let dir = root.join(pet.id);
        for &(name, bytes) in pet.files {
            let file = dir.join(name);
            let same = fs::metadata(&file).is_ok_and(|m| m.len() == bytes.len() as u64)
                && (current || fs::read(&file).is_ok_and(|existing| existing == bytes));
            if same {
                continue;
            }
            if let Err(e) = fs::create_dir_all(file.parent().unwrap()).and_then(|_| fs::write(&file, bytes)) {
                warnings.push(format!("{}: {e}", file.display()));
            }
        }
    }
    // Stamped only when whole, so an interrupted unpack compares everything again next time.
    if !current
        && warnings.is_empty()
        && let Err(e) = fs::write(root.join(STAMP_FILE), STAMP)
    {
        warnings.push(format!("{}: {e}", root.join(STAMP_FILE).display()));
    }
    (root.to_path_buf(), warnings)
}

#[cfg(test)]
mod tests {
    use super::unpack;
    use crate::pets::catalog::{Place, scan_pets};
    use crate::pets::model::VisualStyle;
    use std::path::PathBuf;

    /// A whole unpacked set in its own folder, which the test removes when it is done.
    fn unpacked(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("playpets-{name}-{}", uuid::Uuid::new_v4()));
        let (_, warnings) = unpack(&root);
        assert!(warnings.is_empty(), "{warnings:?}");
        root
    }

    #[test]
    fn retired_builtin_friends_keep_their_identity_and_imports_are_unchanged() {
        let root = unpacked("migration");
        let (assets, _) = scan_pets(&root, Place::Builtin);
        let target = assets.iter().find(|a| a.folder.ends_with("daisy")).unwrap();
        let old_id = crate::pets::catalog::sha256_hex_short(
            target
                .folder
                .parent()
                .unwrap()
                .join("aria-full")
                .to_string_lossy()
                .as_bytes(),
        );
        let mut raw = serde_json::json!({"pets":[
            {"id":"full", "assetId":old_id,"name":"My friend","relation":"partner","persona":"My story"},
            {"id":"external", "assetId":"external-aria","visualStyle":"realistic"}
        ], "chat":[{"petId":"full","text":"Remember me"}]});
        let chat = raw["chat"].clone();
        super::migrate_saved_friends(&mut raw, &assets);
        let pets = crate::pets::model::restore_pets(&raw, &[target.id.clone(), "external-aria".into()]);
        assert_eq!(pets.len(), 2);
        assert_eq!(pets[0].asset_id, target.id);
        assert_eq!(
            (&*pets[0].id, &*pets[0].name, &*pets[0].relation, &*pets[0].persona),
            ("full", "My friend", "partner", "My story")
        );
        assert_eq!(pets[0].visual_style, VisualStyle::Illustrated);
        assert_eq!(pets[1].visual_style, VisualStyle::Realistic);
        assert_eq!(raw["chat"], chat);
        let once = raw.clone();
        super::migrate_saved_friends(&mut raw, &assets);
        assert_eq!(raw, once);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn retired_cached_builtins_are_hidden_but_imported_copies_remain() {
        let root = unpacked("retired");
        std::fs::create_dir(root.join("aria")).unwrap();
        for file in ["pet.json", "spritesheet.png"] {
            std::fs::copy(root.join("daisy").join(file), root.join("aria").join(file)).unwrap();
        }
        assert_eq!(scan_pets(&root, Place::Builtin).0.len(), 3);
        assert_eq!(scan_pets(&root, Place::Codex).0.len(), 4);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn an_update_replaces_same_size_contents_and_a_current_copy_restores_missing_files() {
        let root = std::env::temp_dir().join(format!("playpets-builtin-update-{}", uuid::Uuid::new_v4()));
        unpack(&root);
        for name in ["pet.json", "spritesheet.png", "seasonal/summer.png"] {
            let file = root.join("daisy").join(name);
            let original = std::fs::read(&file).unwrap();
            let mut changed = original.clone();
            changed[0] ^= 1;
            std::fs::write(&file, &changed).unwrap();
            // The copy an older build left behind.
            std::fs::write(root.join(super::STAMP_FILE), "older build").unwrap();
            let (_, warnings) = unpack(&root);
            assert!(warnings.is_empty());
            assert!(
                std::fs::read(&file).unwrap() == original,
                "same-size {name} must refresh"
            );
        }
        let gone = root.join("pip/seasonal/winter.png");
        std::fs::remove_file(&gone).unwrap();
        unpack(&root);
        assert!(gone.is_file());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn the_three_companions_unpack_once_as_valid_sheets() {
        // unpacked() checks that nothing failed to write.
        let root = unpacked("builtin");
        let dir = root.as_path();
        let (assets, scan_warnings) = scan_pets(dir, Place::Builtin);
        assert!(scan_warnings.is_empty(), "{scan_warnings:?}");
        let mut names: Vec<_> = assets.iter().map(|a| a.display_name.as_str()).collect();
        names.sort();
        assert_eq!(names, ["Clover", "Daisy", "Pip"]);
        assert!(assets.iter().all(|a| a.version == 2 && a.place == Place::Builtin));
        let wardrobes: Vec<_> = assets.iter().filter(|a| !a.seasonal_sprite_paths.is_empty()).collect();
        assert_eq!(wardrobes.len(), 3);
        assert!(
            wardrobes.iter().all(
                |a| a.seasonal_sprite_paths.keys().map(String::as_str).collect::<Vec<_>>() == ["summer", "winter"]
            )
        );
        let mut shelf = assets.clone();
        shelf.sort_by_key(|a| super::shelf_rank(&a.folder));
        assert_eq!(
            shelf.iter().map(|a| a.display_name.as_str()).collect::<Vec<_>>(),
            ["Daisy", "Clover", "Pip"]
        );
        let realistic: Vec<_> = assets.iter().filter(|a| !a.realistic_sprite_paths.is_empty()).collect();
        assert_eq!(realistic.len(), 0);
        // A second run finds the files in place and writes nothing.
        let before = std::fs::metadata(dir.join("daisy/spritesheet.png"))
            .unwrap()
            .modified()
            .unwrap();
        assert!(unpack(dir).1.is_empty());
        assert_eq!(
            std::fs::metadata(dir.join("daisy/spritesheet.png"))
                .unwrap()
                .modified()
                .unwrap(),
            before
        );
        std::fs::remove_dir_all(&root).unwrap();
    }
}
