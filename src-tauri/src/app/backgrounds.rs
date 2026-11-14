// Imported backgrounds: one JSON file each in the data folder's `backgrounds`, so a copy of the
// data folder carries them and deleting it takes them away. The page checks a package when it is
// imported and again when it reads it back; here a file is only named, sized and written whole,
// and its pictures served one at a time (image) as PNGs of the size the page takes.
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

/// The pictures a background may have: one for all year, and one for each season.
const PICTURES: [&str; 5] = ["base", "spring", "summer", "autumn", "winter"];
const PNG_DATA: &str = "data:image/png;base64,";

/// Where the page reads one picture of a background: pet-asset://background/{id}/{key}, which
/// Windows spells http://pet-asset.localhost/background/{id}/{key}.
pub fn image_url(id: &str, key: &str) -> String {
    if cfg!(windows) {
        format!("http://pet-asset.localhost/background/{id}/{key}")
    } else {
        format!("pet-asset://background/{id}/{key}")
    }
}

/// Every background saved, oldest first: `{id, pack}` each, each picture named by its address
/// (image_url) rather than carried. A package holds up to 32 MB of pictures, and the list is read
/// at every start: the page asks for a picture only when it shows that place or its card.
/// A file that cannot be read is left where it is and skipped, as the page skips a package it
/// cannot use. Only the pictures `image` serves are named, and a package whose base picture it
/// would not serve is skipped too: a named picture it then refused painted the fallback land.
pub fn list(dir: &Path) -> Vec<Value> {
    read_all(dir)
        .into_iter()
        .filter(|(_, head)| head.pictures.iter().any(|p| p == "base"))
        .map(|(id, head)| {
            let images: serde_json::Map<String, Value> = PICTURES
                .iter()
                .filter(|key| head.pictures.iter().any(|p| p == *key))
                .map(|key| (key.to_string(), json!(image_url(&id, key))))
                .collect();
            let mut pack = head.fields;
            pack.insert("images".into(), Value::Object(images));
            json!({"id": id, "pack": pack})
        })
        .collect()
}

/// One picture of a saved background, as the PNG it was imported as; nothing for a picture it
/// does not have, or one that is not a 1536 x 1024 PNG (the page refuses any other on import).
pub fn image(dir: &Path, id: &str, key: &str) -> Option<Vec<u8>> {
    #[derive(serde::Deserialize)]
    struct Saved<'a> {
        #[serde(borrow)]
        pack: Pictures<'a>,
    }
    #[derive(serde::Deserialize)]
    struct Pictures<'a> {
        #[serde(borrow, default)]
        images: std::collections::BTreeMap<String, Picture<'a>>,
    }
    if !valid_id(id) || !PICTURES.contains(&key) {
        return None;
    }
    let file = fs::read(dir.join(FOLDER).join(format!("{id}.json"))).ok()?;
    let saved: Saved = serde_json::from_slice(&file).ok()?;
    let Some(Picture::Text(text)) = saved.pack.images.get(key) else {
        return None;
    };
    let bytes = decode(base64_body(text.strip_prefix(PNG_DATA)?)?)?;
    background_png(&bytes).then_some(bytes)
}

/// A 1536 x 1024 PNG, by its first 24 bytes.
fn background_png(bytes: &[u8]) -> bool {
    bytes.starts_with(b"\x89PNG") && crate::pets::catalog::image_size(bytes) == Ok((1536, 1024))
}

/// A picture `image` would serve, told from the whole of its base64 and the PNG header in its
/// first 32 characters: the list is read at every start, and a picture is up to 8 MB.
fn servable(text: &str) -> bool {
    text.strip_prefix(PNG_DATA)
        .and_then(base64_body)
        .and_then(|body| decode(&body[..body.len().min(32)]))
        .is_some_and(|head| background_png(&head))
}

/// A picture as a file holds it: read in place, never copied (the file is most of it).
#[derive(serde::Deserialize)]
#[serde(untagged)]
enum Picture<'a> {
    Text(#[serde(borrow)] std::borrow::Cow<'a, str>),
    Other(serde::de::IgnoredAny),
}

/// A saved package as the list needs it: everything but its pictures, and which pictures it has.
struct Head {
    fields: serde_json::Map<String, Value>,
    pictures: Vec<String>,
}
impl<'de> serde::Deserialize<'de> for Head {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct Fields;
        impl<'de> serde::de::Visitor<'de> for Fields {
            type Value = Head;
            fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
                f.write_str("a background package")
            }
            fn visit_map<A: serde::de::MapAccess<'de>>(self, mut map: A) -> Result<Head, A::Error> {
                let mut head = Head {
                    fields: serde_json::Map::new(),
                    pictures: Vec::new(),
                };
                while let Some(key) = map.next_key::<String>()? {
                    if key == "images" {
                        let images: Option<std::collections::BTreeMap<String, Picture<'de>>> = map.next_value()?;
                        head.pictures = images
                            .into_iter()
                            .flatten()
                            .filter(|(_, p)| matches!(p, Picture::Text(text) if servable(text)))
                            .map(|(k, _)| k)
                            .collect();
                    } else {
                        head.fields.insert(key, map.next_value()?);
                    }
                }
                Ok(head)
            }
        }
        d.deserialize_map(Fields)
    }
}

/// Standard base64 as a data URL holds it, with or without its `=` padding, as the importer and
/// the webview take it: the characters before any padding, or nothing for anything else.
fn base64_body(text: &str) -> Option<&[u8]> {
    let text = text.as_bytes();
    let body = text
        .strip_suffix(b"==")
        .or_else(|| text.strip_suffix(b"="))
        .unwrap_or(text);
    let padded = body.len() != text.len();
    if body.len() % 4 == 1 || (padded && !text.len().is_multiple_of(4)) {
        return None;
    }
    body.iter().all(|&c| sextet(c).is_some()).then_some(body)
}

fn sextet(c: u8) -> Option<u8> {
    match c {
        b'A'..=b'Z' => Some(c - b'A'),
        b'a'..=b'z' => Some(c - b'a' + 26),
        b'0'..=b'9' => Some(c - b'0' + 52),
        b'+' => Some(62),
        b'/' => Some(63),
        _ => None,
    }
}

/// The bytes of base64 characters with no padding (base64_body); a last group of two or three
/// characters holds one or two bytes.
fn decode(body: &[u8]) -> Option<Vec<u8>> {
    if body.len() % 4 == 1 {
        return None;
    }
    let mut out = Vec::with_capacity(body.len() / 4 * 3 + 2);
    for group in body.chunks(4) {
        let mut n = 0u32;
        for &c in group {
            n = n << 6 | sextet(c)? as u32;
        }
        n <<= 6 * (4 - group.len()) as u32;
        out.extend_from_slice(&n.to_be_bytes()[1..group.len()]);
    }
    Some(out)
}

#[cfg(test)]
fn decode_base64(text: &str) -> Option<Vec<u8>> {
    decode(base64_body(text)?)
}

/// Every background saved, oldest first, as `(id, pack)`.
fn read_all(dir: &Path) -> Vec<(String, Head)> {
    #[derive(serde::Deserialize)]
    struct Saved {
        #[serde(default)]
        at: Value,
        pack: Head,
    }
    let Ok(entries) = fs::read_dir(dir.join(FOLDER)) else {
        return Vec::new();
    };
    let mut found: Vec<(u64, String, Head)> = entries
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            let id = name.strip_suffix(".json").filter(|id| valid_id(id))?.to_string();
            let saved: Saved = serde_json::from_slice(&fs::read(entry.path()).ok()?).ok()?;
            Some((saved.at.as_u64().unwrap_or(0), id, saved.pack))
        })
        .collect();
    found.sort_by(|a, b| (a.0, &a.1).cmp(&(b.0, &b.1)));
    found
        .into_iter()
        .take(COUNT_LIMIT)
        .map(|(_, id, pack)| (id, pack))
        .collect()
}

/// Writes a background under its id, whole or not at all (a temporary file, then its name).
/// Saving an id again keeps the first file, while it can be read: an import never replaces one
/// already kept, and a damaged one gives way to the copy being moved over.
pub fn save(dir: &Path, id: &str, pack: &Value) -> Result<(), String> {
    if !valid_id(id) || !pack.is_object() {
        return Err(i18n::t("error.bad_request"));
    }
    let folder = dir.join(FOLDER);
    let file = folder.join(format!("{id}.json"));
    let readable = || {
        fs::read(&file)
            .ok()
            .and_then(|text| serde_json::from_slice::<Value>(&text).ok())
            .is_some_and(|saved| saved.get("pack").is_some())
    };
    if file.is_file() && readable() {
        return Ok(());
    }
    let at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_millis() as u64);
    let text = serde_json::to_vec(&json!({"at": at, "pack": pack})).map_err(|_| i18n::t("error.bad_request"))?;
    if text.len() > PACK_LIMIT + 64 {
        return Err(i18n::t("error.bad_request"));
    }
    let failed = |e: std::io::Error| i18n::detail_for("store.write_failed", FOLDER, &e);
    fs::create_dir_all(&folder).map_err(failed)?;
    // Only backgrounds count, not the leftovers of a write that was stopped.
    let kept = fs::read_dir(&folder)
        .map_err(failed)?
        .flatten()
        .filter(|entry| entry.file_name().to_string_lossy().ends_with(".json"))
        .count();
    if !file.is_file() && kept >= COUNT_LIMIT {
        return Err(i18n::tr("backgrounds.full", &[("limit", &COUNT_LIMIT.to_string())]));
    }
    let tmp = folder.join(format!(".{id}.tmp"));
    let written = crate::store::write_synced(&tmp, &text, false).and_then(|()| fs::rename(&tmp, &file));
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
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(i18n::detail_for("store.write_failed", FOLDER, &e)),
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

    /// A package with a base picture, as the list names only those.
    fn named(name: &str) -> Value {
        json!({"name": name, "images": {"base": data_url(&png(1536, name.as_bytes()))}})
    }

    #[test]
    fn a_background_is_kept_in_the_data_folder_until_it_is_removed() {
        let dir = temp();
        assert!(list(&dir).is_empty(), "no folder yet");
        save(&dir, A, &named("Lake")).unwrap();
        save(&dir, B, &named("Attic")).unwrap();
        save(&dir, A, &named("Replaced")).unwrap();
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
    fn a_damaged_file_is_replaced_and_a_full_folder_says_so() {
        let dir = temp();
        fs::create_dir_all(dir.join(FOLDER)).unwrap();
        fs::write(dir.join(FOLDER).join(format!("{A}.json")), "not json").unwrap();
        save(&dir, A, &named("Lake")).unwrap();
        assert_eq!(
            list(&dir)[0]["pack"]["name"],
            "Lake",
            "a file that cannot be read is not kept over a good copy"
        );
        // Leftovers of a stopped write do not count against the limit.
        for n in 0..5 {
            fs::write(dir.join(FOLDER).join(format!(".{n}.tmp")), "").unwrap();
        }
        for n in 1..COUNT_LIMIT {
            let id = format!("custom-{}", uuid::Uuid::from_u128(n as u128));
            save(&dir, &id, &json!({})).unwrap();
        }
        let full = save(&dir, B, &json!({})).unwrap_err();
        assert_eq!(
            full,
            i18n::tr("backgrounds.full", &[("limit", &COUNT_LIMIT.to_string())])
        );
        fs::remove_dir_all(dir).unwrap();
    }

    /// A PNG's first bytes as a 1536 x 1024 picture, and the rest of it.
    fn png(width: u32, tail: &[u8]) -> Vec<u8> {
        let mut bytes = b"\x89PNG\r\n\x1a\n\0\0\0\x0dIHDR".to_vec();
        bytes.extend(width.to_be_bytes());
        bytes.extend(1024u32.to_be_bytes());
        bytes.extend(tail);
        bytes
    }
    fn data_url(bytes: &[u8]) -> String {
        const ABC: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut out = String::from("data:image/png;base64,");
        for chunk in bytes.chunks(3) {
            let n = chunk
                .iter()
                .enumerate()
                .fold(0u32, |n, (i, b)| n | (*b as u32) << (16 - 8 * i));
            for i in 0..4 {
                out.push(if i <= chunk.len() {
                    ABC[(n >> (18 - 6 * i) & 63) as usize] as char
                } else {
                    '='
                });
            }
        }
        out
    }

    #[test]
    fn the_list_names_each_picture_by_its_address_and_the_address_serves_it() {
        let dir = temp();
        let (base, winter) = (png(1536, b"base"), png(1536, b"winter!"));
        let pack = json!({"name": "Lake", "floor": 0.6, "images": {"base": data_url(&base), "winter": data_url(&winter), "odd": data_url(&base), "spring": 7}});
        save(&dir, A, &pack).unwrap();
        let listed = list(&dir);
        let images = &listed[0]["pack"]["images"];
        assert_eq!(listed[0]["pack"]["name"], "Lake", "everything else is as saved");
        assert_eq!(listed[0]["pack"]["floor"], 0.6);
        assert_eq!(images["base"], image_url(A, "base"));
        assert_eq!(images["winter"], image_url(A, "winter"));
        assert!(
            images.get("odd").is_none() && images.get("spring").is_none(),
            "{images}"
        );
        assert!(
            !listed[0].to_string().contains("base64"),
            "no picture travels with the list"
        );
        assert_eq!(image(&dir, A, "base").unwrap(), base);
        assert_eq!(image(&dir, A, "winter").unwrap(), winter);
        for (id, key) in [(A, "spring"), (A, "odd"), (B, "base"), ("../x", "base"), (A, "../base")] {
            assert!(image(&dir, id, key).is_none(), "{id} {key}");
        }
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn a_picture_that_is_not_a_background_png_is_not_served() {
        let dir = temp();
        let images = json!({
            "base": data_url(&png(1024, b"square")),
            "spring": "data:image/svg+xml;base64,PHN2Zz4=",
            "summer": "data:image/png;base64,***",
            "autumn": data_url(b"GIF89a not a png at all"),
        });
        save(&dir, A, &json!({"name": "Odd", "images": images})).unwrap();
        for key in ["base", "spring", "summer", "autumn", "winter"] {
            assert!(image(&dir, A, key).is_none(), "{key}");
        }
        fs::remove_dir_all(dir).unwrap();
    }

    /// A data URL as some tools write it: no `=` at the end.
    fn unpadded(bytes: &[u8]) -> String {
        data_url(bytes).trim_end_matches('=').to_string()
    }

    // The importer takes base64 without its padding (and the webview reads it), so a picture
    // imported that way was shown in its first session and missing after a restart.
    #[test]
    fn a_picture_without_base64_padding_is_served_as_it_was_imported() {
        let dir = temp();
        // 1, 2 and 3 bytes left over after the whole groups: two, one and no `=`.
        let pictures = [png(1536, b"x"), png(1536, b"xy"), png(1536, b"xyz")];
        let images = json!({
            "base": unpadded(&pictures[0]),
            "spring": unpadded(&pictures[1]),
            "summer": unpadded(&pictures[2]),
        });
        assert!(
            !images["base"].as_str().unwrap()[PNG_DATA.len()..]
                .len()
                .is_multiple_of(4),
            "{images}"
        );
        save(&dir, A, &json!({"name": "Lake", "images": images})).unwrap();
        assert_eq!(image(&dir, A, "base").unwrap(), pictures[0]);
        assert_eq!(image(&dir, A, "spring").unwrap(), pictures[1]);
        assert_eq!(image(&dir, A, "summer").unwrap(), pictures[2]);
        assert_eq!(decode_base64("QUJD"), Some(b"ABC".to_vec()));
        assert_eq!(decode_base64("QUI="), Some(b"AB".to_vec()));
        for broken in ["QUJDR", "QUJDRA=", "QUI==", "QU===", "QUJD===", "QU=J"] {
            assert_eq!(decode_base64(broken), None, "{broken}");
        }
        fs::remove_dir_all(dir).unwrap();
    }

    // A listed picture the backend then refuses painted the fallback land, kept an unseen lake
    // and showed an empty card; a package without its base was skipped by the page before.
    #[test]
    fn the_list_names_only_pictures_it_can_serve_and_skips_a_package_without_its_base() {
        let dir = temp();
        let good = data_url(&png(1536, b"good"));
        let images = json!({
            "base": good,
            "spring": data_url(&png(1024, b"square")),
            "summer": "data:image/png;base64,***",
            "autumn": format!("{}A", good),
            "winter": good,
        });
        save(&dir, A, &json!({"name": "Lake", "images": images})).unwrap();
        save(
            &dir,
            B,
            &json!({"name": "Broken", "images": {"base": data_url(b"GIF89a not a png"), "winter": good}}),
        )
        .unwrap();
        let listed = list(&dir);
        assert_eq!(listed.len(), 1, "the package whose base cannot be served is not listed");
        let names: Vec<&String> = listed[0]["pack"]["images"].as_object().unwrap().keys().collect();
        assert_eq!(names, ["base", "winter"]);
        for (key, served) in [
            ("base", true),
            ("spring", false),
            ("summer", false),
            ("autumn", false),
            ("winter", true),
        ] {
            assert_eq!(image(&dir, A, key).is_some(), served, "{key}");
        }
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
