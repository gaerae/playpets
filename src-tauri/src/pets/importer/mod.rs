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

mod html;
mod net;
mod sites;

use html::*;
use net::*;
pub use net::{Fetch, http_fetch};
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
    fs::create_dir_all(root).map_err(|e| i18n::detail("import.save_detail", e))?;
    let temp = root.join(format!(".tmp-{}", uuid::Uuid::new_v4()));
    let written = (|| -> Result<(), String> {
        fs::create_dir(&temp).map_err(|e| i18n::detail("import.save_detail", e))?;
        let file = format!("spritesheet.{ext}");
        fs::write(temp.join(&file), &bytes).map_err(|e| i18n::detail("import.save_detail", e))?;
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
            .map_err(|e| i18n::detail("import.save_detail", e))?;
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
    fn temp_root() -> PathBuf {
        std::env::temp_dir().join(format!("playpets-import-{}", uuid::Uuid::new_v4()))
    }
    fn manifest(folder: &Path) -> Value {
        serde_json::from_str(&fs::read_to_string(folder.join("pet.json")).unwrap()).unwrap()
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
    fn only_the_listed_community_sites_open_and_a_shared_host_only_at_its_listed_address() {
        let site = COMMUNITIES.iter().find(|c| !c.url.contains("github")).unwrap();
        assert!(openable(site.url).is_some());
        assert!(openable(&site.url.replace("https://", "http://")).is_none());
        assert!(openable("https://example.com/").is_none());
        assert!(openable("javascript:alert(1)").is_none());
        if let Some(repo) = COMMUNITIES.iter().find(|c| c.url.contains("github.com")) {
            assert!(openable(repo.url).is_some());
            assert!(openable(&format!("{}/tree/main/pets", repo.url)).is_some());
            assert!(openable(&format!("{}-evil", repo.url)).is_none());
            assert!(openable("https://github.com/someone/else").is_none());
        }
    }

    #[test]
    fn community_list_is_the_curated_set_largest_first() {
        let names: Vec<&str> = COMMUNITIES.iter().map(|c| c.name).collect();
        assert_eq!(
            names,
            [
                "OpenPets Registry",
                "Petdex",
                "Codex PokéPets",
                "Awesome Codex Pet",
                "Codex Pets"
            ]
        );
        assert!(
            COMMUNITIES
                .iter()
                .all(|c| c.importable && c.url.starts_with("https://"))
        );
        // Every listed site is reachable by its host or, for a repository, through GitHub.
        for c in &COMMUNITIES {
            let url = Url::parse(c.url).unwrap();
            assert!(
                c.hosts.contains(&bare_host(&url))
                    || github_folder(&url).is_ok_and(|g| g.is_some())
                    || c.url.contains("github.com"),
                "{} has no route",
                c.name
            );
            assert!(
                c.hosts.iter().all(|h| !h.starts_with("www.")),
                "{} hosts are bare",
                c.name
            );
        }
        assert!(communities_json()[2]["hint"].as_str().unwrap().contains("GitHub"));
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
