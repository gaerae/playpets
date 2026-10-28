// Imported backgrounds: one JSON file each in the data folder's `backgrounds`, so a copy of the
// data folder carries them and deleting it takes them away. The page checks a package when it is
// imported and again when it reads it back; here a file is only named, sized and written whole.
use crate::i18n;
use serde_json::{Value, json};
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

pub const FOLDER: &str = "backgrounds";
/// The page's own limit on a package (MAX_BACKGROUND_BYTES), as JSON.
const PACK_LIMIT: usize = 32 * 1024 * 1024;
/// More than anyone keeps; a folder that holds more is read only this far.
const COUNT_LIMIT: usize = 100;

/// `custom-` and a UUID, as the page names an imported background.
pub fn valid_id(id: &str) -> bool {
    id.strip_prefix("custom-")
        .is_some_and(|uuid| uuid.len() == 36 && uuid.chars().all(|c| c.is_ascii_hexdigit() || c == '-'))
}

/// Every background saved, oldest first: `{id, pack}` each. A file that cannot be read is left
/// where it is and skipped, as the page skips a package it cannot use.
pub fn list(dir: &Path) -> Vec<Value> {
    let Ok(entries) = fs::read_dir(dir.join(FOLDER)) else {
        return Vec::new();
    };
    let mut found: Vec<(u64, String, Value)> = entries
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            let id = name.strip_suffix(".json").filter(|id| valid_id(id))?.to_string();
            let saved: Value = serde_json::from_slice(&fs::read(entry.path()).ok()?).ok()?;
            let at = saved.get("at").and_then(Value::as_u64).unwrap_or(0);
            Some((at, id, saved.get("pack")?.clone()))
        })
        .collect();
    found.sort_by(|a, b| (a.0, &a.1).cmp(&(b.0, &b.1)));
    found
        .into_iter()
        .take(COUNT_LIMIT)
        .map(|(_, id, pack)| json!({"id": id, "pack": pack}))
        .collect()
}

/// Writes a background under its id, whole or not at all (a temporary file, then its name).
/// Saving an id again keeps the first file: an import never replaces one already kept.
pub fn save(dir: &Path, id: &str, pack: &Value) -> Result<(), String> {
    if !valid_id(id) || !pack.is_object() {
        return Err(i18n::t("error.bad_request"));
    }
    let folder = dir.join(FOLDER);
    let file = folder.join(format!("{id}.json"));
    if file.is_file() {
        return Ok(());
    }
    let at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_millis() as u64);
    let text = serde_json::to_vec(&json!({"at": at, "pack": pack})).map_err(|_| i18n::t("error.bad_request"))?;
    if text.len() > PACK_LIMIT + 64 {
        return Err(i18n::t("error.bad_request"));
    }
    let failed = |e: std::io::Error| i18n::detail_for("store.write_failed", FOLDER, e);
    fs::create_dir_all(&folder).map_err(failed)?;
    if fs::read_dir(&folder).map_err(failed)?.count() >= COUNT_LIMIT {
        return Err(i18n::t("error.bad_request"));
    }
    let tmp = folder.join(format!(".{id}.tmp"));
    let written = fs::File::create(&tmp)
        .and_then(|mut f| {
            use std::io::Write;
            f.write_all(&text)?;
            f.sync_all()
        })
        .and_then(|()| fs::rename(&tmp, &file));
    if written.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    written.map_err(failed)
}

/// Deletes a background's file; one already gone is already removed.
pub fn remove(dir: &Path, id: &str) -> Result<(), String> {
    if !valid_id(id) {
        return Err(i18n::t("error.bad_request"));
    }
    match fs::remove_file(dir.join(FOLDER).join(format!("{id}.json"))) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(i18n::detail_for("store.write_failed", FOLDER, e)),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const A: &str = "custom-0b6f2c1e-8d4a-4f1b-9c3e-2a7d5e6f8a90";
    const B: &str = "custom-f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5b";

    fn temp() -> std::path::PathBuf {
        std::env::temp_dir().join(format!("playpets-backgrounds-{}", uuid::Uuid::new_v4()))
    }

    #[test]
    fn a_background_is_kept_in_the_data_folder_until_it_is_removed() {
        let dir = temp();
        assert!(list(&dir).is_empty(), "no folder yet");
        save(&dir, A, &json!({"name": "Lake"})).unwrap();
        save(&dir, B, &json!({"name": "Attic"})).unwrap();
        save(&dir, A, &json!({"name": "Replaced"})).unwrap();
        let saved = list(&dir);
        let names: Vec<&str> = saved.iter().map(|b| b["pack"]["name"].as_str().unwrap()).collect();
        assert_eq!(
            names,
            ["Lake", "Attic"],
            "oldest first, and a second save keeps the first"
        );
        assert_eq!(saved[0]["id"], A);
        remove(&dir, A).unwrap();
        remove(&dir, A).unwrap();
        assert_eq!(list(&dir).len(), 1);
        assert!(!dir.join(FOLDER).join(format!("{A}.json")).exists());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn only_a_named_package_of_a_usable_size_is_written_and_read() {
        let dir = temp();
        for id in [
            "custom-x",
            "../custom-0b6f2c1e-8d4a-4f1b-9c3e-2a7d5e6f8a90",
            "woodland",
            "",
        ] {
            assert!(save(&dir, id, &json!({})).is_err(), "{id}");
            assert!(remove(&dir, id).is_err(), "{id}");
        }
        assert!(save(&dir, A, &json!("a string")).is_err());
        let big = json!({"image": "A".repeat(PACK_LIMIT + 100)});
        assert!(save(&dir, A, &big).is_err());
        assert!(!dir.join(FOLDER).exists(), "nothing written");
        // What the folder holds besides the backgrounds is left alone and not shown.
        fs::create_dir_all(dir.join(FOLDER)).unwrap();
        fs::write(dir.join(FOLDER).join("notes.json"), "{}").unwrap();
        fs::write(dir.join(FOLDER).join(format!("{B}.json")), "not json").unwrap();
        assert!(list(&dir).is_empty());
        fs::remove_dir_all(dir).unwrap();
    }
}
