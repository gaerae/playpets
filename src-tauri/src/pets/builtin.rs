//! The named companions and original mascot cats (assets/pets),
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
/// In the shelf's order: the distinct companions lead; the mascot cats keep their identities.
/// The two named entries reuse accepted source artwork; neither is an alternate look of the other.
const PETS: &[Builtin] = &[
    pet!("daisy", "spritesheet.png", "seasonal/summer.png", "seasonal/winter.png"),
    pet!(
        "clover",
        "spritesheet.png",
        "seasonal/summer.png",
        "seasonal/winter.png"
    ),
    pet!("pip", "spritesheet.png", "seasonal/summer.png", "seasonal/winter.png"),
    pet!(
        "aria-full" from "aria",
        "builtin-full.json",
        "realistic/spritesheet.png",
        "realistic/summer.png",
        "realistic/winter.png",
        "realistic/portrait.png"
    ),
    pet!(
        "aria" from "aria",
        "builtin-mini.json",
        "spritesheet.png",
        "seasonal/summer.png",
        "seasonal/winter.png"
    ),
    pet!(
        "noah-full" from "noah",
        "builtin-full.json",
        "realistic/spritesheet.png",
        "realistic/summer.png",
        "realistic/winter.png",
        "realistic/portrait.png"
    ),
    pet!(
        "noah" from "noah",
        "builtin-mini.json",
        "spritesheet.png",
        "seasonal/summer.png",
        "seasonal/winter.png"
    ),
    pet!("tabby", "spritesheet.png"),
    pet!("smoky", "spritesheet.png"),
    pet!("mochi", "spritesheet.png"),
];

/// Where a bundled pet's folder sorts on the shelf; anything else comes after them.
pub fn shelf_rank(folder: &Path) -> usize {
    PETS.iter().position(|p| folder.ends_with(p.id)).unwrap_or(usize::MAX)
}

/// The friends an earlier build drew full-size through the Mini asset and a realistic look:
/// (the Mini's folder, the full-size pet's folder, the manifest that build shipped for the Mini).
const LEGACY: [(&str, &str, &str); 2] = [
    ("aria", "aria-full", include_str!("../../../assets/pets/aria/pet.json")),
    ("noah", "noah-full", include_str!("../../../assets/pets/noah/pet.json")),
];

/// Where the bundled pet unpacked into `folder` is in `assets`.
fn builtin_at(assets: &[crate::pets::catalog::Asset], folder: &str) -> Option<usize> {
    use crate::pets::catalog::Place;
    assets
        .iter()
        .position(|a| a.place == Place::Builtin && a.folder.ends_with(folder))
}

/// An interrupted unpack keeps old friends drawable until their new baseline can be loaded: the
/// realistic sheets an earlier build wrote beside the mini sheets are still on disk (an unpack
/// never deletes), and a fresh install has no such friends to keep.
pub fn preserve_legacy_appearances(assets: &mut [crate::pets::catalog::Asset]) {
    for (mini, full, manifest) in LEGACY {
        if builtin_at(assets, full).is_some() {
            continue;
        }
        if let Some(i) = builtin_at(assets, mini) {
            let asset = &mut assets[i];
            let meta = serde_json::from_str(manifest).expect("bundled compatibility manifest");
            (asset.realistic_sprite_paths, asset.realistic_portrait_path) =
                crate::pets::catalog::realistic_appearance(&asset.folder, asset.version, &meta);
        }
    }
}

/// Only the old built-in asset/style pair changes. Friend IDs keep conversations and bonds attached.
pub fn migrate_friends(pets: &mut [crate::pets::model::Pet], assets: &[crate::pets::catalog::Asset]) {
    use crate::pets::model::VisualStyle;
    for (mini, full, _) in LEGACY {
        let (Some(old), Some(new)) = (builtin_at(assets, mini), builtin_at(assets, full)) else {
            continue;
        };
        for pet in pets
            .iter_mut()
            .filter(|p| p.asset_id == assets[old].id && p.visual_style == VisualStyle::Realistic)
        {
            pet.asset_id.clone_from(&assets[new].id);
            pet.visual_style = VisualStyle::Illustrated;
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
    use super::{migrate_friends, preserve_legacy_appearances, unpack};
    use crate::pets::catalog::{Place, scan_pets};
    use crate::pets::model::VisualStyle;
    use std::path::{Path, PathBuf};

    /// A whole unpacked set in its own folder, which the test removes when it is done.
    fn unpacked(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("playpets-{name}-{}", uuid::Uuid::new_v4()));
        let (_, warnings) = unpack(&root);
        assert!(warnings.is_empty(), "{warnings:?}");
        root
    }

    #[test]
    fn legacy_appearance_migration_preserves_friends_and_skips_missing_targets() {
        let root = unpacked("migration");
        let dir = root.clone();
        // An earlier build wrote the realistic sheets beside the mini ones.
        std::fs::create_dir_all(dir.join("aria/realistic")).unwrap();
        for name in ["spritesheet.png", "summer.png", "winter.png", "portrait.png"] {
            std::fs::copy(
                dir.join("aria-full/realistic").join(name),
                dir.join("aria/realistic").join(name),
            )
            .unwrap();
        }
        let (assets, _) = scan_pets(&dir, Place::Builtin);
        let mini = assets.iter().find(|a| a.folder.ends_with("aria")).unwrap();
        let full = assets.iter().find(|a| a.folder.ends_with("aria-full")).unwrap();
        let raw = serde_json::json!({"pets":[
            {"id":"mini", "assetId":mini.id,"name":"My Mini","relation":"sibling"},
            {"id":"full", "assetId":mini.id,"name":"Custom Mini","visualStyle":"realistic","relation":"partner","persona":"My story","callMe":"Dear","providerId":"saved-provider"}
        ], "bonds":{"full":{"points":230,"day":"2026-10-10","today":4}}, "agentPets":{"codex":"full"}});
        let ids = assets.iter().map(|a| a.id.clone()).collect::<Vec<_>>();
        let mut pets = crate::pets::model::restore_pets(&raw, &ids);
        let original = serde_json::to_value(&pets).unwrap();
        let mut partial = assets.iter().filter(|a| a.id != full.id).cloned().collect::<Vec<_>>();
        preserve_legacy_appearances(&mut partial);
        let fallback = partial.iter().find(|a| a.id == mini.id).unwrap();
        assert_eq!(
            std::fs::read(fallback.realistic_sprite_paths.get("default").unwrap()).unwrap(),
            std::fs::read(&full.sprite_path).unwrap()
        );
        assert!(fallback.realistic_portrait_path.is_some());
        assert!(fallback.portrait_path.is_none());
        migrate_friends(&mut pets, &partial);
        assert_eq!(serde_json::to_value(&pets).unwrap(), original);
        migrate_friends(&mut pets, &assets);
        assert_eq!(pets[0].asset_id, mini.id);
        assert_eq!(pets[1].asset_id, full.id);
        assert_eq!(pets[1].visual_style, VisualStyle::Illustrated);
        assert_eq!(pets[1].provider_id, "saved-provider");
        let friend_ids = pets.iter().map(|p| p.id.clone()).collect::<Vec<_>>();
        let bonds = crate::pets::bond::Bonds::restore(raw.get("bonds"), &friend_ids);
        assert_eq!(bonds.0.get("full").unwrap().points, 230);
        assert!(
            pets.iter()
                .any(|p| Some(p.id.as_str()) == raw["agentPets"]["codex"].as_str())
        );
        assert_eq!(
            (
                &*pets[1].id,
                &*pets[1].name,
                &*pets[1].relation,
                &*pets[1].persona,
                &*pets[1].call_me
            ),
            ("full", "Custom Mini", "partner", "My story", "Dear")
        );
        let migrated = serde_json::to_value(&pets).unwrap();
        migrate_friends(&mut pets, &assets);
        assert_eq!(serde_json::to_value(&pets).unwrap(), migrated);
        let restored = crate::pets::model::restore_pets(&serde_json::json!({"pets":migrated}), &ids);
        assert_eq!(serde_json::to_value(restored).unwrap(), migrated);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn imported_legacy_appearances_are_not_catalog_migrations() {
        let root = unpacked("import-migration");
        let (mut assets, _) = scan_pets(&root, Place::Builtin);
        let mut external = assets.iter().find(|a| a.folder.ends_with("aria")).unwrap().clone();
        external.id = "external-aria".into();
        external.place = Place::Folder;
        assets.push(external);
        let raw = serde_json::json!({"pets":[{"id":"external", "assetId":"external-aria", "visualStyle":"realistic"}]});
        let mut pets = crate::pets::model::restore_pets(&raw, &["external-aria".into()]);
        let original = serde_json::to_value(&pets).unwrap();
        migrate_friends(&mut pets, &assets);
        assert_eq!(serde_json::to_value(pets).unwrap(), original);
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
    fn the_companions_and_original_cats_unpack_once_as_valid_sheets() {
        // unpacked() checks that nothing failed to write.
        let root = unpacked("builtin");
        let dir = root.as_path();
        let (assets, scan_warnings) = scan_pets(dir, Place::Builtin);
        assert!(scan_warnings.is_empty(), "{scan_warnings:?}");
        let mut names: Vec<_> = assets.iter().map(|a| a.display_name.as_str()).collect();
        names.sort();
        assert_eq!(
            names,
            [
                "Aria",
                "Aria Mini",
                "Clover",
                "Daisy",
                "Mochi",
                "Noah",
                "Noah Mini",
                "Pip",
                "Smoky",
                "Tabby"
            ]
        );
        assert!(assets.iter().all(|a| a.version == 2 && a.place == Place::Builtin));
        let wardrobes: Vec<_> = assets.iter().filter(|a| !a.seasonal_sprite_paths.is_empty()).collect();
        assert_eq!(wardrobes.len(), 7);
        assert!(
            wardrobes.iter().all(
                |a| a.seasonal_sprite_paths.keys().map(String::as_str).collect::<Vec<_>>() == ["summer", "winter"]
            )
        );
        let mut shelf = assets.clone();
        shelf.sort_by_key(|a| super::shelf_rank(&a.folder));
        assert_eq!(
            shelf.iter().map(|a| a.display_name.as_str()).collect::<Vec<_>>(),
            [
                "Daisy",
                "Clover",
                "Pip",
                "Aria",
                "Aria Mini",
                "Noah",
                "Noah Mini",
                "Tabby",
                "Smoky",
                "Mochi"
            ]
        );
        let realistic: Vec<_> = assets.iter().filter(|a| !a.realistic_sprite_paths.is_empty()).collect();
        assert_eq!(realistic.len(), 0);
        for who in ["aria", "noah"] {
            let mini = assets.iter().find(|a| a.folder.ends_with(who)).unwrap();
            let full = assets
                .iter()
                .find(|a| a.folder.ends_with(format!("{who}-full")))
                .unwrap();
            assert_ne!(mini.id, full.id);
            assert!(mini.portrait_path.is_none());
            assert_eq!(full.portrait_path, Some(full.folder.join("realistic/portrait.png")));
            assert_eq!(mini.sprite_path, mini.folder.join("spritesheet.png"));
            assert_eq!(full.sprite_path, full.folder.join("realistic/spritesheet.png"));
            assert_eq!(
                std::fs::read(&full.sprite_path).unwrap(),
                std::fs::read(
                    Path::new(env!("CARGO_MANIFEST_DIR"))
                        .join(format!("../assets/pets/{who}/realistic/spritesheet.png"))
                )
                .unwrap()
            );
        }

        // A second run finds the files in place and writes nothing.
        let before = std::fs::metadata(dir.join("tabby/spritesheet.png"))
            .unwrap()
            .modified()
            .unwrap();
        assert!(unpack(dir).1.is_empty());
        assert_eq!(
            std::fs::metadata(dir.join("tabby/spritesheet.png"))
                .unwrap()
                .modified()
                .unwrap(),
            before
        );
        std::fs::remove_dir_all(&root).unwrap();
    }
}
