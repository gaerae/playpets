// Imports a Codex-compatible pet from a page address: the registries with an API of their own
// (OpenPets Registry, Petdex, any codex-pet-share site), pet folders on GitHub, and otherwise
// any page a sprite can be found on. Files are only taken from the site the address named (and
// a listed community's own hosts), and whatever the route, the sprite's size has the last word.
// Network access is injected (`Fetch`) so tests replay the recorded site shapes.
use super::catalog;
use crate::i18n;
use serde_json::{Value, json};
use std::fs;
use std::io::Read;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::path::{Path, PathBuf};
use std::time::Duration;
use url::{Host, Url};

mod archive;
mod html;
mod net;
mod sites;

use html::*;
use net::*;
pub use net::{Fetch, http_fetch, unless_cancelled};
use sites::*;
pub use sites::{communities_json, openable};

/// How many sprite candidates a page may offer before the import gives up on it.
const MAX_CANDIDATES: usize = 3;

fn pick_sprite(candidates: &[String], fetch: Fetch) -> Result<(Vec<u8>, u32, &'static str), String> {
    let mut error = i18n::t("import.no_sprite");
    for candidate in candidates.iter().take(MAX_CANDIDATES) {
        let attempt = (|| {
            let (bytes, _) = download(check_url(candidate)?, fetch, SPRITE_LIMIT)?;
            let (w, h) = catalog::image_size(&bytes)?;
            let version = catalog::SHEET_VERSIONS
                .iter()
                .find(|(_, rows)| rows * catalog::ROW_HEIGHT == h)
                .map(|(v, _)| *v);
            let Some(version) = version.filter(|_| w == catalog::SHEET_WIDTH) else {
                return Err(i18n::t("import.sprite_size"));
            };
            let ext = if bytes.starts_with(b"RIFF") { "webp" } else { "png" };
            Ok((bytes, version, ext))
        })();
        match attempt {
            Ok(found) => return Ok(found),
            Err(e) => error = e,
        }
    }
    Err(error)
}

/// Whether a folder holds a usable pet; one that does not is set aside (not deleted: it may be
/// a pet somebody edited by hand) so the import can write a fresh one.
fn valid(folder: &Path) -> bool {
    if catalog::read_pet(folder).is_ok() {
        return true;
    }
    if let (Some(parent), Some(name)) = (folder.parent(), folder.file_name()) {
        let aside = parent.join(format!(".broken-{}-{}", name.to_string_lossy(), uuid::Uuid::new_v4()));
        let _ = fs::rename(folder, aside);
    }
    false
}

pub fn import_from_url(raw: &str, root: &Path, fetch: Fetch) -> Result<PathBuf, String> {
    let url = check_url(raw)?;
    let (site, slug) = identify(&url)?;
    if slug.is_empty() {
        return Err(i18n::t("import.need_detail_page"));
    }
    let folder = root.join(format!("{site}-{slug}"));
    if folder.exists() && valid(&folder) {
        return Ok(folder);
    }
    let mut source = resolve_source(&url, &site, &slug, fetch)?;
    source
        .candidates
        .retain(|c| check_url(c).is_ok_and(|u| on_site(&u, &source.hosts)));
    let (bytes, version, ext) = pick_sprite(&source.candidates, fetch)?;
    fs::create_dir_all(root).map_err(|e| i18n::detail("import.save_detail", &e))?;
    let temp = root.join(format!(".tmp-{}", uuid::Uuid::new_v4()));
    let written = (|| -> Result<(), String> {
        fs::create_dir(&temp).map_err(|e| i18n::detail("import.save_detail", &e))?;
        let file = format!("spritesheet.{ext}");
        fs::write(temp.join(&file), &bytes).map_err(|e| i18n::detail("import.save_detail", &e))?;
        let display = Some(clean(&source.display_name, 60))
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| slug.clone());
        let mut origin = json!({"name": source.name, "url": source.page_url, "creator": clean(&source.creator, 80)});
        if !source.license.is_empty() {
            origin["license"] = json!(source.license);
        }
        let manifest = json!({
            "id": slug, "displayName": display, "description": clean(&source.description, 300),
            "spriteVersionNumber": version, "spritesheetPath": file, "source": origin,
        });
        fs::write(temp.join("pet.json"), serde_json::to_string_pretty(&manifest).unwrap())
            .map_err(|e| i18n::detail("import.save_detail", &e))?;
        if fs::rename(&temp, &folder).is_err() && !valid(&folder) {
            return Err(i18n::t("import.save_failed"));
        }
        Ok(())
    })();
    let _ = fs::remove_dir_all(&temp);
    written?;
    catalog::read_pet(&folder)?;
    Ok(folder)
}

/// Imports a pet ZIP (the creator kit's, or a compressed pet folder) into its own folder in `root`,
/// so the ZIP itself can go. The same ZIP twice is the same folder; a changed one is a new pet.
pub fn import_from_zip(file: &Path, root: &Path) -> Result<PathBuf, String> {
    // Only a plain file, and never more of it than the limit: a pipe or a device has no size.
    let meta = fs::metadata(file).map_err(|e| i18n::detail("pet.unreadable", &e))?;
    if !meta.is_file() {
        return Err(i18n::t("import.zip_unreadable"));
    }
    if meta.len() > archive::ARCHIVE_LIMIT {
        return Err(i18n::t("import.zip_too_big"));
    }
    let mut bytes = Vec::new();
    fs::File::open(file)
        .and_then(|f| f.take(archive::ARCHIVE_LIMIT + 1).read_to_end(&mut bytes))
        .map_err(|e| i18n::detail("pet.unreadable", &e))?;
    if bytes.len() as u64 > archive::ARCHIVE_LIMIT {
        return Err(i18n::t("import.zip_too_big"));
    }
    let files = archive::pet_files(archive::read_entries(&bytes)?)?;
    let manifest: Value = files
        .iter()
        .find(|(name, _)| name == "pet.json")
        .and_then(|(_, b)| serde_json::from_slice(b).ok())
        .ok_or_else(|| i18n::t("pet.manifest_fields"))?;
    // The pet's own id names the folder, as far as it is safe in a path.
    let id: String = catalog::tidy(manifest.get("id").and_then(|v| v.as_str()).unwrap_or(""), 40)
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect();
    let id = id.trim_matches('-');
    let folder = root.join(format!(
        "zip-{}-{}",
        if id.is_empty() { "pet" } else { id },
        &catalog::sha256_hex_short(&bytes)[..8]
    ));
    if folder.exists() && valid(&folder) {
        return Ok(folder);
    }
    fs::create_dir_all(root).map_err(|e| i18n::detail("import.save_detail", &e))?;
    let temp = root.join(format!(".tmp-{}", uuid::Uuid::new_v4()));
    let written = (|| -> Result<(), String> {
        for (name, data) in &files {
            let path = temp.join(name);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|e| i18n::detail("import.save_detail", &e))?;
            }
            fs::write(&path, data).map_err(|e| i18n::detail("import.save_detail", &e))?;
        }
        // What the files say is checked before the pet joins the others.
        catalog::read_pet(&temp)?;
        if fs::rename(&temp, &folder).is_err() && !valid(&folder) {
            return Err(i18n::t("import.save_failed"));
        }
        Ok(())
    })();
    let _ = fs::remove_dir_all(&temp);
    written?;
    catalog::read_pet(&folder)?;
    Ok(folder)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::collections::HashMap;

    fn webp(w: u32, h: u32) -> Vec<u8> {
        let mut b = vec![0u8; 30];
        b[0..4].copy_from_slice(b"RIFF");
        b[4..8].copy_from_slice(&22u32.to_le_bytes());
        b[8..12].copy_from_slice(b"WEBP");
        b[12..16].copy_from_slice(b"VP8X");
        b[16..20].copy_from_slice(&10u32.to_le_bytes());
        b[24..27].copy_from_slice(&(w - 1).to_le_bytes()[..3]);
        b[27..30].copy_from_slice(&(h - 1).to_le_bytes()[..3]);
        b
    }
    fn png(w: u32, h: u32) -> Vec<u8> {
        let mut b = vec![0u8; 33];
        b[..8].copy_from_slice(&[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        b[16..20].copy_from_slice(&w.to_be_bytes());
        b[20..24].copy_from_slice(&h.to_be_bytes());
        b
    }
    enum Hit {
        Body(Vec<u8>),
        Redirect(&'static str),
    }
    struct Site {
        routes: HashMap<String, Hit>,
        calls: RefCell<Vec<String>>,
    }
    impl Site {
        fn new(routes: Vec<(&str, Hit)>) -> Self {
            Site {
                routes: routes.into_iter().map(|(k, v)| (k.to_string(), v)).collect(),
                calls: RefCell::new(Vec::new()),
            }
        }
        fn fetch(&self, url: &str, limit: usize) -> Result<Fetched, String> {
            self.calls.borrow_mut().push(url.to_string());
            Ok(match self.routes.get(url) {
                None => Fetched {
                    status: 404,
                    location: None,
                    body: Vec::new(),
                    too_big: false,
                },
                Some(Hit::Redirect(to)) => Fetched {
                    status: 308,
                    location: Some(to.to_string()),
                    body: Vec::new(),
                    too_big: false,
                },
                Some(Hit::Body(b)) => Fetched {
                    status: 200,
                    location: None,
                    too_big: b.len() > limit,
                    body: b.clone(),
                },
            })
        }
    }
    fn json_hit(v: Value) -> Hit {
        Hit::Body(v.to_string().into_bytes())
    }
    fn html_hit(s: &str) -> Hit {
        Hit::Body(s.as_bytes().to_vec())
    }
    /// A ZIP as tools write it: each entry stored or deflated, then the directory and its end.
    pub fn zip(files: &[(&str, &[u8], bool)]) -> Vec<u8> {
        use flate2::{Compression, write::DeflateEncoder};
        use std::io::Write;
        let mut out = Vec::new();
        let mut directory = Vec::new();
        for (name, data, deflate) in files {
            let packed = if *deflate {
                let mut e = DeflateEncoder::new(Vec::new(), Compression::default());
                e.write_all(data).unwrap();
                e.finish().unwrap()
            } else {
                data.to_vec()
            };
            let mut crc = flate2::Crc::new();
            crc.update(data);
            let method: u16 = if *deflate { 8 } else { 0 };
            let offset = out.len() as u32;
            let common = |b: &mut Vec<u8>| {
                b.extend(20u16.to_le_bytes());
                b.extend(0u16.to_le_bytes());
                b.extend(method.to_le_bytes());
                b.extend([0; 4]);
                b.extend(crc.sum().to_le_bytes());
                b.extend((packed.len() as u32).to_le_bytes());
                b.extend((data.len() as u32).to_le_bytes());
                b.extend((name.len() as u16).to_le_bytes());
                b.extend(0u16.to_le_bytes());
            };
            out.extend(archive::LOCAL_SIGNATURE.to_le_bytes());
            common(&mut out);
            out.extend(name.as_bytes());
            out.extend(&packed);
            directory.extend(archive::CENTRAL_SIGNATURE.to_le_bytes());
            directory.extend(20u16.to_le_bytes());
            common(&mut directory);
            // Comment length, disk, internal and external attributes.
            directory.extend([0; 10]);
            directory.extend(offset.to_le_bytes());
            directory.extend(name.as_bytes());
        }
        let at = out.len() as u32;
        out.extend(&directory);
        out.extend(archive::END_SIGNATURE.to_le_bytes());
        out.extend([0; 4]);
        out.extend((files.len() as u16).to_le_bytes());
        out.extend((files.len() as u16).to_le_bytes());
        out.extend((directory.len() as u32).to_le_bytes());
        out.extend(at.to_le_bytes());
        out.extend(0u16.to_le_bytes());
        out
    }

    fn temp_root() -> PathBuf {
        std::env::temp_dir().join(format!("playpets-import-{}", uuid::Uuid::new_v4()))
    }
    fn manifest(folder: &Path) -> Value {
        serde_json::from_str(&fs::read_to_string(folder.join("pet.json")).unwrap()).unwrap()
    }

    #[test]
    fn an_import_called_off_saves_nothing() {
        use std::sync::atomic::{AtomicBool, Ordering};
        let root = temp_root();
        let sprite = "https://assets.petdex.dev/curated/boba/sprite-v2.webp";
        let site = Site::new(vec![
            (
                "https://petdex.dev/api/install-pet/boba",
                json_hit(json!({"ok": true, "pet": {"slug": "boba", "displayName": "Boba", "spritesheetUrl": sprite}})),
            ),
            (sprite, Hit::Body(webp(1536, 2288))),
        ]);
        let cancel = AtomicBool::new(false);
        let read = |u: &str, l: usize| {
            cancel.store(u == sprite, Ordering::SeqCst);
            site.fetch(u, l)
        };
        let fetch = unless_cancelled(&cancel, &read);
        assert!(import_from_url("https://petdex.dev/pets/boba", &root, &fetch).is_err());
        assert!(
            site.calls.borrow().iter().any(|u| u == sprite),
            "it got as far as the last read"
        );
        assert!(!root.exists() || fs::read_dir(&root).unwrap().next().is_none());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn a_pet_zip_becomes_its_own_folder_and_the_same_zip_twice_is_the_same_pet() {
        let root = temp_root();
        let sheet = png(catalog::SHEET_WIDTH, 9 * catalog::ROW_HEIGHT);
        let pet = br#"{"id": "Moss Cat!", "displayName": "Moss", "spriteVersionNumber": 1, "spritesheetPath": "spritesheet.png"}"#;
        let file = root.join("moss.zip");
        fs::create_dir_all(&root).unwrap();
        fs::write(
            &file,
            zip(&[("moss/pet.json", pet, true), ("moss/spritesheet.png", &sheet, false)]),
        )
        .unwrap();
        let pets = root.join("pets");
        let folder = import_from_zip(&file, &pets).unwrap();
        let name = folder.file_name().unwrap().to_string_lossy().into_owned();
        assert!(name.starts_with("zip-moss-cat-"), "{name}");
        assert_eq!(catalog::read_pet(&folder).unwrap().display_name, "Moss");
        fs::remove_file(&file).unwrap();
        assert!(
            folder.join("spritesheet.png").is_file(),
            "the pet no longer needs the ZIP"
        );
        let again = root.join("again.zip");
        fs::write(
            &again,
            zip(&[("moss/pet.json", pet, true), ("moss/spritesheet.png", &sheet, false)]),
        )
        .unwrap();
        assert_eq!(import_from_zip(&again, &pets).unwrap(), folder);
        let only: Vec<_> = fs::read_dir(&pets).unwrap().flatten().collect();
        assert_eq!(only.len(), 1, "no second copy and no temporary folder left");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn a_zip_that_is_not_a_usable_pet_leaves_nothing_behind() {
        let root = temp_root();
        fs::create_dir_all(&root).unwrap();
        let pets = root.join("pets");
        let pet =
            br#"{"id": "moss", "displayName": "Moss", "spriteVersionNumber": 1, "spritesheetPath": "spritesheet.png"}"#;
        for (name, archive) in [
            (
                "wrong-size.zip",
                zip(&[("pet.json", pet, false), ("spritesheet.png", &png(10, 10), false)]),
            ),
            ("no-sheet.zip", zip(&[("pet.json", pet, false)])),
            ("no-pet.zip", zip(&[("readme.txt", b"hi", false)])),
            ("not-a-zip.zip", b"PK nothing".to_vec()),
        ] {
            let file = root.join(name);
            fs::write(&file, archive).unwrap();
            assert!(import_from_zip(&file, &pets).is_err(), "{name}");
        }
        let folder = root.join("folder.zip");
        fs::create_dir_all(&folder).unwrap();
        assert!(import_from_zip(&folder, &pets).is_err(), "only a plain file is read");
        assert!(
            fs::read_dir(&pets).map(|d| d.count()).unwrap_or(0) == 0,
            "nothing written"
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn only_public_https_urls_are_accepted() {
        for bad in [
            "http://petdex.dev/pets/boba",
            "https://localhost/pets/x",
            "https://localhost./x",
            "https://[::ffff:127.0.0.1]/x",
            "https://[::ffff:10.0.0.1]/x",
            "https://[::ffff:169.254.169.254]/x",
            "https://[64:ff9b::a00:1]/x",
            "https://pets.localhost/x",
            "https://127.0.0.1/x",
            "https://10.1.2.3/x",
            "https://192.168.0.2/x",
            "https://172.16.0.1/x",
            "https://169.254.1.1/x",
            "https://[::1]/x",
            "https://[fc00::1]/x",
            "file:///etc/passwd",
            "not a url",
            "",
        ] {
            assert!(check_url(bad).is_err(), "{bad}");
        }
        assert_eq!(
            check_url(" https://petdex.dev/pets/boba ").unwrap().host_str(),
            Some("petdex.dev")
        );
    }

    #[test]
    fn petdex_old_domain_install_api_v2_and_credit() {
        let root = temp_root();
        let site = Site::new(vec![
            (
                "https://petdex.dev/api/install-pet/boba",
                json_hit(
                    json!({"ok": true, "pet": {"slug": "boba", "displayName": "Boba", "petJsonUrl": "https://assets.petdex.dev/curated/boba/petjson-v2.json", "spritesheetUrl": "https://assets.petdex.dev/curated/boba/sprite-v2.webp"}}),
                ),
            ),
            (
                "https://assets.petdex.dev/curated/boba/petjson-v2.json",
                json_hit(json!({"description": "A tiny otter sipping bubble tea."})),
            ),
            (
                "https://assets.petdex.dev/curated/boba/sprite-v2.webp",
                Hit::Body(webp(1536, 2288)),
            ),
        ]);
        let fetch = |u: &str, l: usize| site.fetch(u, l);
        let folder = import_from_url("https://petdex.crafter.run/pets/boba", &root, &fetch).unwrap();
        assert_eq!(folder.file_name().unwrap(), "petdex-boba");
        let asset = catalog::read_pet(&folder).unwrap();
        assert_eq!(
            (asset.display_name.as_str(), asset.version, asset.description.as_str()),
            ("Boba", 2, "A tiny otter sipping bubble tea.")
        );
        assert_eq!(
            manifest(&folder)["source"],
            json!({"name": "Petdex", "url": "https://petdex.dev/pets/boba", "creator": ""})
        );
        assert!(!site.calls.borrow().iter().any(|u| u.contains("crafter.run")));
        let before = site.calls.borrow().len();
        assert_eq!(
            import_from_url("https://petdex.dev/pets/boba", &root, &fetch).unwrap(),
            folder
        );
        assert_eq!(site.calls.borrow().len(), before);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn codex_pets_share_and_hash_urls() {
        let root = temp_root();
        let site = Site::new(vec![
            (
                "https://codex-pets.net/api/pets/ameath",
                json_hit(
                    json!({"pet": {"id": "ameath", "displayName": "爱弥斯 / Ameath", "description": "A compact chibi pet.", "spritesheetUrl": "https://codex-pets.net/assets/pets/v/1/ameath/spritesheet.webp", "ownerName": "firmant"}}),
                ),
            ),
            (
                "https://codex-pets.net/assets/pets/v/1/ameath/spritesheet.webp",
                Hit::Body(webp(1536, 1872)),
            ),
        ]);
        let fetch = |u: &str, l: usize| site.fetch(u, l);
        let folder = import_from_url("https://codex-pets.net/#/pets/ameath", &root, &fetch).unwrap();
        assert_eq!(folder.file_name().unwrap(), "codex-pets-ameath");
        let m = manifest(&folder);
        assert_eq!(
            (m["displayName"].as_str(), m["source"]["creator"].as_str()),
            (Some("爱弥斯 / Ameath"), Some("firmant"))
        );
        assert_eq!(
            import_from_url("https://codex-pets.net/share/ameath", &root, &fetch).unwrap(),
            folder
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn spriteyard_json_ld_after_redirect() {
        let root = temp_root();
        let page = r#"<html><head><title>Baron | SpriteYard</title><script type="application/ld+json">{"@context":"https://schema.org","@type":"CreativeWork","name":"Baron","creator":{"@type":"Person","name":"TheBootLoop"},"description":"A tiny stern Baron &amp; friends.","image":"https://assets.spriteyard.com/pets/baron/spritesheet.webp"}</script></head></html>"#;
        let site = Site::new(vec![
            ("https://spriteyard.com/pets/baron", Hit::Redirect("/pets/baron/")),
            ("https://spriteyard.com/pets/baron/", html_hit(page)),
            (
                "https://assets.spriteyard.com/pets/baron/spritesheet.webp",
                Hit::Body(webp(1536, 1872)),
            ),
        ]);
        let fetch = |u: &str, l: usize| site.fetch(u, l);
        let folder = import_from_url("https://spriteyard.com/pets/baron", &root, &fetch).unwrap();
        assert_eq!(folder.file_name().unwrap(), "spriteyard-baron");
        let m = manifest(&folder);
        assert_eq!(
            (
                m["displayName"].as_str(),
                m["description"].as_str(),
                m["source"]["creator"].as_str()
            ),
            (
                Some("Baron"),
                Some("A tiny stern Baron & friends."),
                Some("TheBootLoop")
            )
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn codex_pet_shop_skips_the_screenshot_and_takes_the_sprite() {
        let root = temp_root();
        let page = r#"<html><head><meta property="og:title" content="Ruckus · Codex Pet Shop" /><script type="application/ld+json">{"@type":"CreativeWork","name":"Ruckus","description":"A cute grizzly bear.","image":"https://www.codexpetshop.com/screenshots/ruckusbear"}</script></head><body><img src="/sprites/ruckusbear.webp"><a href="/p/ruckusbear/bundle.zip">zip</a></body></html>"#;
        let site = Site::new(vec![
            ("https://www.codexpetshop.com/p/ruckusbear", html_hit(page)),
            (
                "https://www.codexpetshop.com/screenshots/ruckusbear",
                Hit::Body(png(1200, 630)),
            ),
            (
                "https://www.codexpetshop.com/sprites/ruckusbear.webp",
                Hit::Body(webp(1536, 1872)),
            ),
        ]);
        let fetch = |u: &str, l: usize| site.fetch(u, l);
        let folder = import_from_url("https://www.codexpetshop.com/p/ruckusbear", &root, &fetch).unwrap();
        assert_eq!(folder.file_name().unwrap(), "codexpetshop-ruckusbear");
        assert_eq!(catalog::read_pet(&folder).unwrap().display_name, "Ruckus");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn failures_are_clear_and_leave_nothing_behind() {
        let root = temp_root();
        let site = Site::new(vec![
            (
                "https://example.org/pets/plain",
                html_hit(r#"<html><title>Plain</title><img src="/avatar.webp"><img src="/sprites/plain.webp"></html>"#),
            ),
            ("https://example.org/sprites/plain.webp", Hit::Body(webp(512, 512))),
            (
                "https://example.org/pets/none",
                html_hit("<html><title>None</title></html>"),
            ),
            (
                "https://example.org/pets/sneaky",
                Hit::Redirect("https://127.0.0.1/admin"),
            ),
            (
                "https://petdex.dev/api/install-pet/huge",
                json_hit(json!({"pet": {"spritesheetUrl": "https://assets.petdex.dev/huge.webp"}})),
            ),
            (
                "https://assets.petdex.dev/huge.webp",
                Hit::Body(vec![0u8; SPRITE_LIMIT + 1]),
            ),
        ]);
        let fetch = |u: &str, l: usize| site.fetch(u, l);
        assert!(
            import_from_url("https://example.org/pets/plain", &root, &fetch)
                .unwrap_err()
                .contains("1536")
        );
        assert!(
            import_from_url("https://example.org/pets/none", &root, &fetch)
                .unwrap_err()
                .contains("pet image")
        );
        assert!(
            import_from_url("https://example.org/pets/sneaky", &root, &fetch)
                .unwrap_err()
                .to_lowercase()
                .contains("address")
        );
        assert!(
            import_from_url("https://petdex.dev/pets/huge", &root, &fetch)
                .unwrap_err()
                .contains("32 MB")
        );
        assert!(!root.exists() || fs::read_dir(&root).unwrap().next().is_none());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn slugs_are_short_ascii_and_hosts_lose_one_www() {
        assert_eq!(slugify(&format!("{}-b", "a".repeat(47))), "a".repeat(47));
        assert_eq!(slugify("my%20pet"), "my-20pet");
        let url = Url::parse("https://www.www.spriteyard.com/pets/x").unwrap();
        assert_eq!(identify(&url).unwrap().0, "www-spriteyard");
        let url = Url::parse("https://pets.example.org/share/nori").unwrap();
        assert_eq!(
            identify(&url).unwrap(),
            ("pets-example".to_string(), "nori".to_string())
        );
    }

    #[test]
    fn files_come_only_from_the_named_site_or_a_listed_community_host() {
        let root = temp_root();
        let page = r#"<html><head><script type="application/ld+json">{"name":"Far","image":"https://cdn.elsewhere.net/far/spritesheet.webp"}</script></head><body><img src="https://assets.example.org/far/sprite.webp"></body></html>"#;
        let site = Site::new(vec![
            ("https://example.org/pets/far", html_hit(page)),
            (
                "https://cdn.elsewhere.net/far/spritesheet.webp",
                Hit::Body(webp(1536, 1872)),
            ),
            (
                "https://assets.example.org/far/sprite.webp",
                Hit::Body(webp(1536, 1872)),
            ),
        ]);
        let fetch = |u: &str, l: usize| site.fetch(u, l);
        let folder = import_from_url("https://example.org/pets/far", &root, &fetch).unwrap();
        assert_eq!(folder.file_name().unwrap(), "example-far");
        let calls = site.calls.borrow();
        assert!(
            !calls.iter().any(|c| c.contains("elsewhere")),
            "a sprite on another site is never fetched: {calls:?}"
        );
        assert!(calls.iter().any(|c| c.contains("assets.example.org")), "{calls:?}");
        drop(calls);
        let hosts = vec!["petdex.dev".to_string(), "petdex.crafter.run".to_string()];
        let ok = |u: &str| on_site(&Url::parse(u).unwrap(), &hosts);
        assert!(ok("https://assets.petdex.dev/x.webp"));
        assert!(ok("https://www.petdex.dev/x.webp"));
        assert!(!ok("https://petdex.dev.evil.com/x.webp"));
        assert!(!ok("https://notpetdex.dev/x.webp"));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn discovery_visibility_and_order_do_not_change_trusted_import_routes() {
        let entries = parse_discovery(
            r#"[
          {"id":"petdex","name":"Petdex","url":"https://petdex.dev/","visible":false},
          {"id":"codex-pets","name":"Codex Pets","url":"https://codex-pets.net/","visible":true},
          {"id":"openpets","name":"OpenPets","url":"https://openpets.sh/","visible":true}
        ]"#,
        )
        .unwrap();
        let shown = discovery_json(&entries);
        assert_eq!(shown[0]["id"], "codex-pets");
        assert_eq!(shown[1]["id"], "openpets");
        assert_eq!(shown.as_array().unwrap().len(), 2);
        assert!(openable_in("https://petdex.dev/", &entries).is_none());
        let url = Url::parse("https://petdex.dev/pets/boba").unwrap();
        assert_eq!(community_for(&url).unwrap().id, "petdex");
        assert_eq!(identify(&url).unwrap(), ("petdex".into(), "boba".into()));
    }

    #[test]
    fn new_discovery_entries_are_browse_only_and_do_not_grant_import_hosts() {
        let entries =
            parse_discovery(r#"[{"id":"sample","name":"Sample","url":"https://example.com/pets/","visible":true}]"#)
                .unwrap();
        let shown = discovery_json(&entries);
        assert_eq!(shown[0]["importable"], false);
        assert_eq!(shown[0]["hint"], "");
        assert!(openable_in("https://example.com/pets/", &entries).is_some());
        assert!(openable_in("https://example.com.evil.com/pets/", &entries).is_none());
        assert!(community_for(&Url::parse("https://example.com/pets/cat").unwrap()).is_none());
        assert!(!on_site(
            &Url::parse("https://example.com/sprite.png").unwrap(),
            &["petdex.dev".into()]
        ));
    }

    #[test]
    fn known_discovery_ids_only_advertise_their_trusted_site() {
        for (id, url) in [
            ("petdex", "https://example.com/"),
            ("petdex", "https://petdex.dev.evil.com/"),
            ("github", "https://github.com/other/repo"),
            ("github", "https://github.com/dnnyngyen/codex-pokepets-evil"),
        ] {
            let entries =
                parse_discovery(&json!([{"id":id,"name":"Gallery","url":url,"visible":true}]).to_string()).unwrap();
            let shown = discovery_json(&entries);
            assert_eq!(shown[0]["importable"], false, "{url}");
            assert_eq!(shown[0]["hint"], "", "{url}");
        }
        let entries = parse_discovery(r#"[{"id":"github","name":"Gallery","url":"https://github.com/dnnyngyen/codex-pokepets/tree/main/pets","visible":true}]"#).unwrap();
        assert_eq!(discovery_json(&entries)[0]["importable"], true);
    }

    #[test]
    fn discovery_registry_rejects_invalid_configuration_and_external_boundaries() {
        for url in [
            "http://example.com",
            "https://user:secret@example.com",
            "https://example.com:444",
            "https://127.0.0.1",
            "https://localhost/",
        ] {
            assert!(
                parse_discovery(&json!([{"id":"sample","name":"Sample","url":url,"visible":true}]).to_string())
                    .is_err(),
                "{url}"
            );
        }
        let entry = json!({"id":"sample","name":"Sample","url":"https://example.com","visible":true});
        assert!(parse_discovery(&json!([entry.clone(), entry]).to_string()).is_err());
        for id in ["", "Bad-ID", "two words", "../site"] {
            assert!(
                parse_discovery(
                    &json!([{"id":id,"name":"Sample","url":"https://example.com","visible":true}]).to_string()
                )
                .is_err()
            );
        }
        assert!(parse_discovery("[]").unwrap().is_empty());
        assert!(
            parse_discovery(
                r#"[{"id":"sample","name":"Sample","url":"https://example.com","visible":true,"route":"Petdex"}]"#
            )
            .is_err()
        );
        let entries =
            parse_discovery(r#"[{"id":"repo","name":"Repo","url":"https://github.com/team/pets","visible":true}]"#)
                .unwrap();
        assert!(openable_in("https://github.com/team/pets/tree/main", &entries).is_some());
        for url in [
            "https://github.com/team/pets-evil",
            "https://github.com/other/repo",
            "https://user@github.com/team/pets",
            "https://github.com:444/team/pets",
            "https://github.com/team/pets/../other",
        ] {
            assert!(openable_in(url, &entries).is_none(), "{url}");
        }
    }

    #[test]
    fn only_visible_configured_discovery_sites_open() {
        for entry in communities_json().as_array().unwrap() {
            let url = entry["url"].as_str().unwrap();
            assert!(openable(url).is_some());
            assert!(openable(&url.replace("https://", "http://")).is_none());
        }
        assert!(openable("javascript:alert(1)").is_none());
    }

    #[test]
    fn every_bundled_discovery_site_can_be_imported_from() {
        let entries = parse_discovery(include_str!("../../../../src/content/communities.json")).unwrap();
        let listed = discovery_json(&entries);
        assert_eq!(listed.as_array().unwrap().len(), entries.len());
        for site in listed.as_array().unwrap() {
            assert_eq!(site["importable"], true, "{site}");
            assert!(!site["hint"].as_str().unwrap().is_empty(), "{site}");
        }
        for adapter in &COMMUNITIES {
            assert!(adapter.hosts.iter().all(|h| !h.starts_with("www.")));
        }
    }

    #[test]
    fn openpets_registry_resolves_relative_sprite_urls_and_credits_the_uploader() {
        let root = temp_root();
        let site = Site::new(vec![
            (
                "https://openpets.sh/api/pets/round-eyes",
                json_hit(
                    json!({"pet": {"id": "round-eyes", "displayName": "三月", "description": "A cow cat.", "ownerName": "hongtao", "spritesheetUrl": "/api/pets/round-eyes/spritesheet", "source": {"name": "Codex Pet Share"}}}),
                ),
            ),
            (
                "https://openpets.sh/api/pets/round-eyes/spritesheet",
                Hit::Body(webp(1536, 2288)),
            ),
        ]);
        let fetch = |u: &str, l: usize| site.fetch(u, l);
        let folder = import_from_url("https://openpets.sh/pets/round-eyes", &root, &fetch).unwrap();
        assert_eq!(folder.file_name().unwrap(), "openpets-round-eyes");
        let m = manifest(&folder);
        assert_eq!(
            (
                m["displayName"].as_str(),
                m["spriteVersionNumber"].as_u64(),
                m["source"]["creator"].as_str(),
                m["source"]["url"].as_str()
            ),
            (
                Some("三月"),
                Some(2),
                Some("hongtao"),
                Some("https://openpets.sh/pets/round-eyes")
            )
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn github_folders_and_awesome_codex_pet_pages_read_raw_files() {
        let root = temp_root();
        let site = Site::new(vec![
            (
                "https://raw.githubusercontent.com/dnnyngyen/codex-pokepets/main/pets/pikachu/pet.json",
                json_hit(
                    json!({"id": "pikachu", "displayName": "Pikachu", "description": "Electric mouse.", "spritesheetPath": "spritesheet.webp"}),
                ),
            ),
            (
                "https://raw.githubusercontent.com/dnnyngyen/codex-pokepets/main/pets/pikachu/spritesheet.webp",
                Hit::Body(webp(1536, 1872)),
            ),
            (
                "https://raw.githubusercontent.com/legeling/awesome-codex-pet/main/pets/firefly--lingxiaotian/pet.json",
                json_hit(
                    json!({"id": "firefly--lingxiaotian", "displayName": "流萤", "description": "Firefly fan art.", "spritesheetPath": "spritesheet.webp"}),
                ),
            ),
            (
                "https://raw.githubusercontent.com/legeling/awesome-codex-pet/main/pets/firefly--lingxiaotian/spritesheet.webp",
                Hit::Body(webp(1536, 1872)),
            ),
        ]);
        let fetch = |u: &str, l: usize| site.fetch(u, l);
        let poke = import_from_url(
            "https://github.com/dnnyngyen/codex-pokepets/tree/main/pets/pikachu",
            &root,
            &fetch,
        )
        .unwrap();
        assert_eq!(poke.file_name().unwrap(), "github-dnnyngyen-codex-pokepets-pikachu");
        let m = manifest(&poke);
        assert_eq!(
            (
                m["displayName"].as_str(),
                m["source"]["name"].as_str(),
                m["source"]["creator"].as_str()
            ),
            (Some("Pikachu"), Some("GitHub"), Some("dnnyngyen"))
        );
        assert_eq!(
            m["source"]["url"],
            "https://github.com/dnnyngyen/codex-pokepets/tree/main/pets/pikachu"
        );
        assert_eq!(
            import_from_url(
                "https://raw.githubusercontent.com/dnnyngyen/codex-pokepets/main/pets/pikachu/pet.json",
                &root,
                &fetch
            )
            .unwrap(),
            poke,
            "a raw pet.json link lands in the same folder"
        );
        let top = import_from_url("https://codexpet.top/pets/firefly--lingxiaotian", &root, &fetch).unwrap();
        assert_eq!(top.file_name().unwrap(), "codexpet-firefly-lingxiaotian");
        let m = manifest(&top);
        assert_eq!(
            (
                m["displayName"].as_str(),
                m["source"]["name"].as_str(),
                m["source"]["creator"].as_str(),
                m["source"]["license"].as_str()
            ),
            (
                Some("流萤"),
                Some("Awesome Codex Pet"),
                Some("lingxiaotian"),
                Some("CC BY-NC 4.0")
            )
        );
        assert!(
            import_from_url("https://github.com/dnnyngyen/codex-pokepets", &root, &fetch)
                .unwrap_err()
                .contains("folder")
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn any_codex_pet_share_instance_is_read_through_its_own_api() {
        let root = temp_root();
        let site = Site::new(vec![
            (
                "https://pets.example.org/api/pets/nori",
                json_hit(
                    json!({"pet": {"id": "nori", "displayName": "Nori", "description": "", "spritesheetUrl": "https://pets.example.org/assets/nori/spritesheet.webp", "ownerHandle": "kim"}}),
                ),
            ),
            (
                "https://pets.example.org/assets/nori/spritesheet.webp",
                Hit::Body(webp(1536, 1872)),
            ),
        ]);
        let fetch = |u: &str, l: usize| site.fetch(u, l);
        let folder = import_from_url("https://pets.example.org/share/nori", &root, &fetch).unwrap();
        assert_eq!(folder.file_name().unwrap(), "pets-example-nori");
        assert_eq!(manifest(&folder)["source"]["creator"], "kim");
        assert_eq!(
            import_from_url("https://pets.example.org/#/pets/nori", &root, &fetch).unwrap(),
            folder
        );
        let _ = fs::remove_dir_all(&root);
    }

    /// Live check against the real sites: cargo test live_import -- --ignored --nocapture
    #[test]
    #[ignore]
    fn live_import() {
        let root = temp_root();
        for u in [
            "https://openpets.sh/pets/round-eyes",
            "https://petdex.crafter.run/pets/boba",
            "https://github.com/dnnyngyen/codex-pokepets/tree/main/pets/pikachu",
            "https://codexpet.top/pets/firefly--lingxiaotian",
            "https://codex-pets.net/#/pets/ameath",
            "https://spriteyard.com/pets/baron/",
            "https://www.codexpetshop.com/p/ruckusbear",
        ] {
            let folder = import_from_url(u, &root, &http_fetch).unwrap_or_else(|e| panic!("{u}: {e}"));
            let asset = catalog::read_pet(&folder).unwrap();
            println!(
                "OK {u} → {} v{} {}",
                folder.file_name().unwrap().to_string_lossy(),
                asset.version,
                asset.display_name
            );
        }
        let _ = fs::remove_dir_all(&root);
    }
}
