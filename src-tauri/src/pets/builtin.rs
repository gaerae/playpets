//! Three sample pets drawn from the mascot (assets/pets, made by scripts/make-mascot-pet.mjs),
//! carried inside the binary and unpacked into the data folder, so the shelf is never empty on
//! first start and a friend can be invited before any pet is imported.
use std::fs;
use std::path::{Path, PathBuf};

/// The order the shelf shows them in: the mascot first.
pub const ORDER: [&str; 3] = ["tabby", "smoky", "mochi"];

const PETS: [(&str, &[u8], &[u8]); 3] = [
    (
        "tabby",
        include_bytes!("../../../assets/pets/tabby/pet.json"),
        include_bytes!("../../../assets/pets/tabby/spritesheet.png"),
    ),
    (
        "smoky",
        include_bytes!("../../../assets/pets/smoky/pet.json"),
        include_bytes!("../../../assets/pets/smoky/spritesheet.png"),
    ),
    (
        "mochi",
        include_bytes!("../../../assets/pets/mochi/pet.json"),
        include_bytes!("../../../assets/pets/mochi/spritesheet.png"),
    ),
];

/// Writes the sample pets under `root`, one folder each, unless a file is already there with the
/// same size (a new build with a redrawn sheet replaces it). A pet that cannot be written is
/// reported and the others still unpack.
pub fn unpack(root: &Path) -> (PathBuf, Vec<String>) {
    let mut warnings = Vec::new();
    for (id, json, sheet) in PETS {
        let dir = root.join(id);
        for (name, bytes) in [("pet.json", json), ("spritesheet.png", sheet)] {
            let file = dir.join(name);
            let same = fs::metadata(&file)
                .map(|m| m.len() == bytes.len() as u64)
                .unwrap_or(false);
            if same {
                continue;
            }
            if let Err(e) = fs::create_dir_all(&dir).and_then(|_| fs::write(&file, bytes)) {
                warnings.push(format!("{}: {e}", file.display()));
            }
        }
    }
    (root.to_path_buf(), warnings)
}

#[cfg(test)]
mod tests {
    use super::unpack;
    use crate::pets::catalog::{Place, scan_pets};

    #[test]
    fn the_three_pets_unpack_once_and_read_back_as_valid_sheets() {
        let root = std::env::temp_dir().join(format!("playpets-builtin-{}", uuid::Uuid::new_v4()));
        let (dir, warnings) = unpack(&root);
        assert!(warnings.is_empty(), "{warnings:?}");
        let (assets, scan_warnings) = scan_pets(&dir, Place::Builtin);
        assert!(scan_warnings.is_empty(), "{scan_warnings:?}");
        let mut names: Vec<_> = assets.iter().map(|a| a.display_name.as_str()).collect();
        names.sort();
        assert_eq!(names, ["Mochi", "Smoky", "Tabby"]);
        assert!(assets.iter().all(|a| a.version == 2 && a.place == Place::Builtin));
        // A second run finds the files in place and writes nothing.
        let before = std::fs::metadata(dir.join("tabby/spritesheet.png"))
            .unwrap()
            .modified()
            .unwrap();
        unpack(&root);
        assert_eq!(
            std::fs::metadata(dir.join("tabby/spritesheet.png"))
                .unwrap()
                .modified()
                .unwrap(),
            before
        );
        let _ = std::fs::remove_dir_all(&root);
    }
}
