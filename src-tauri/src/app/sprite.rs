// Sprite sheets served to the pages from the pet files on this computer.
use super::*;
use std::io::Read;
use std::path::PathBuf;

pub(super) fn asset_json(asset: &catalog::Asset) -> serde_json::Value {
    let mut value = serde_json::to_value(asset).unwrap();
    let base = sprite_url(&asset.id);
    value["spriteUrl"] = json!(base);
    value["seasonalSpriteUrls"] = json!(
        asset
            .seasonal_sprite_paths
            .keys()
            .map(|season| (season, format!("{base}?season={season}")))
            .collect::<std::collections::BTreeMap<_, _>>()
    );
    value["realisticSpriteUrls"] = json!(
        asset
            .realistic_sprite_paths
            .keys()
            .map(|season| {
                let url = if season == "default" {
                    format!("{base}?style=realistic")
                } else {
                    format!("{base}?style=realistic&season={season}")
                };
                (season, url)
            })
            .collect::<std::collections::BTreeMap<_, _>>()
    );
    if asset.portrait_path.is_some() {
        value["portraitUrl"] = json!(format!("{base}?portrait=1"));
    }
    if asset.realistic_portrait_path.is_some() {
        value["realisticPortraitUrl"] = json!(format!("{base}?style=realistic&portrait=1"));
    }
    value
}

/// A picture of this pet, read whole through the same checks the pet passed when it was found.
fn read_file(asset: &catalog::Asset, path: &std::path::Path, portrait: bool) -> Option<(Vec<u8>, PathBuf)> {
    let limit = if portrait {
        catalog::PORTRAIT_LIMIT
    } else {
        catalog::SPRITE_LIMIT
    };
    let (file, path) = catalog::open_image(&asset.folder, path, limit).ok()?;
    let mut bytes = Vec::new();
    // Read no further than the limit, even if the file grew since it was checked.
    file.take(limit as u64 + 1).read_to_end(&mut bytes).ok()?;
    if bytes.len() > limit {
        return None;
    }
    let size = catalog::image_size(&bytes).ok()?;
    let valid = if portrait {
        catalog::portrait_size(size)
    } else {
        catalog::sheet_fits(size, asset.rows)
    };
    valid.then_some((bytes, path))
}

fn read_sheet(asset: &catalog::Asset, query: Option<&str>) -> Option<(Vec<u8>, PathBuf)> {
    let parameter = |key: &str| {
        query.and_then(|query| {
            query
                .split('&')
                .filter_map(|part| part.split_once('='))
                .find_map(|(name, value)| (name == key).then_some(value))
        })
    };
    let season = parameter("season").filter(|season| catalog::SEASONS.contains(season));
    let realistic = parameter("style") == Some("realistic");
    if parameter("portrait") == Some("1") {
        let portrait = if realistic {
            &asset.realistic_portrait_path
        } else {
            &asset.portrait_path
        };
        return portrait.as_ref().and_then(|path| read_file(asset, path, true));
    }
    let read = |path: &PathBuf| read_file(asset, path, false);
    if realistic {
        let selected = season
            .and_then(|season| asset.realistic_sprite_paths.get(season))
            .and_then(read)
            .or_else(|| asset.realistic_sprite_paths.get("default").and_then(read));
        if selected.is_some() {
            return selected;
        }
    }
    season
        .and_then(|s| asset.seasonal_sprite_paths.get(s))
        .and_then(read)
        .or_else(|| read(&asset.sprite_path))
}

/// Serves sprite sheets to the pages: pet-asset://sprite/{asset id}, which Windows spells
/// http://pet-asset.localhost/sprite/{asset id}.
pub fn sprite_response(app: &AppHandle, uri: &tauri::http::Uri) -> tauri::http::Response<Vec<u8>> {
    let path = uri.path().trim_start_matches('/');
    let id = if uri.host() == Some("sprite") {
        path
    } else {
        path.trim_start_matches("sprite/")
    };
    let found = lock(&app.state::<Shared>()).assets.iter().find(|a| a.id == id).cloned();
    // Files can change after catalog scanning; validate again without holding application state.
    match found.and_then(|asset| read_sheet(&asset, uri.query())) {
        Some((bytes, p)) => {
            let mime = if p.extension().is_some_and(|e| e == "webp") {
                "image/webp"
            } else {
                "image/png"
            };
            // The page reads the sheet's pixels (to put bubbles just above the head), which a
            // cross-origin image allows only with this header.
            tauri::http::Response::builder()
                .header("Content-Type", mime)
                .header("Access-Control-Allow-Origin", "*")
                .body(bytes)
                .unwrap()
        }
        None => tauri::http::Response::builder().status(404).body(Vec::new()).unwrap(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn baseline_portrait_urls_serve_only_the_optional_validated_image() {
        let root = std::env::temp_dir().join(format!("playpets-baseline-protocol-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let mut bytes = vec![0; 25];
        bytes[..8].copy_from_slice(b"\x89PNG\r\n\x1a\n");
        bytes[16..20].copy_from_slice(&1536u32.to_be_bytes());
        bytes[20..24].copy_from_slice(&1872u32.to_be_bytes());
        fs::write(root.join("sprite.png"), &bytes).unwrap();
        fs::write(
            root.join("pet.json"),
            r#"{"id":"base","displayName":"Base","spritesheetPath":"sprite.png","portraitPath":"portrait.png"}"#,
        )
        .unwrap();
        let ordinary = catalog::read_pet(&root).unwrap();
        assert!(asset_json(&ordinary).get("portraitUrl").is_none());
        assert!(read_sheet(&ordinary, Some("portrait=1")).is_none());
        bytes[16..20].copy_from_slice(&1024u32.to_be_bytes());
        bytes[20..24].copy_from_slice(&1024u32.to_be_bytes());
        bytes[24] = 9;
        fs::write(root.join("portrait.png"), &bytes).unwrap();
        let asset = catalog::read_pet(&root).unwrap();
        assert_eq!(
            asset_json(&asset)["portraitUrl"],
            format!("{}?portrait=1", sprite_url(&asset.id))
        );
        assert_eq!(read_sheet(&asset, Some("portrait=1")).unwrap().0[24], 9);
        bytes[16..20].copy_from_slice(&4097u32.to_be_bytes());
        fs::write(root.join("portrait.png"), &bytes).unwrap();
        assert!(read_sheet(&asset, Some("portrait=1")).is_none());
        assert!(read_sheet(&asset, None).is_some());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn realistic_requests_choose_validated_style_and_portrait_with_fallbacks() {
        let root = std::env::temp_dir().join(format!("playpets-style-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let mut bytes = vec![0; 25];
        bytes[..8].copy_from_slice(b"\x89PNG\r\n\x1a\n");
        bytes[16..20].copy_from_slice(&1536u32.to_be_bytes());
        bytes[20..24].copy_from_slice(&2288u32.to_be_bytes());
        for (name, marker) in [("base", 0), ("summer", 1), ("real", 2), ("real-summer", 3)] {
            bytes[24] = marker;
            fs::write(root.join(format!("{name}.png")), &bytes).unwrap();
        }
        bytes[16..20].copy_from_slice(&1024u32.to_be_bytes());
        bytes[20..24].copy_from_slice(&1024u32.to_be_bytes());
        bytes[24] = 9;
        fs::write(root.join("portrait.png"), &bytes).unwrap();
        fs::write(root.join("pet.json"), r#"{"id":"adult","displayName":"Adult","spriteVersionNumber":2,"spritesheetPath":"base.png","seasonalSpritesheets":{"summer":"summer.png"},"realisticSpritesheets":{"default":"real.png","summer":"real-summer.png"},"realisticPortraitPath":"portrait.png"}"#).unwrap();
        let asset = catalog::read_pet(&root).unwrap();
        for (query, marker) in [
            ("style=realistic", 2),
            ("style=realistic&season=summer", 3),
            ("style=realistic&season=winter", 2),
            ("style=unknown&season=summer", 1),
            ("style=realistic&portrait=1", 9),
        ] {
            assert_eq!(read_sheet(&asset, Some(query)).unwrap().0[24], marker, "{query}");
        }
        let json = asset_json(&asset);
        assert_eq!(
            json["realisticSpriteUrls"]["default"],
            format!("{}?style=realistic", sprite_url(&asset.id))
        );
        assert_eq!(
            json["realisticSpriteUrls"]["summer"],
            format!("{}?style=realistic&season=summer", sprite_url(&asset.id))
        );
        assert_eq!(
            json["realisticPortraitUrl"],
            format!("{}?style=realistic&portrait=1", sprite_url(&asset.id))
        );
        fs::write(root.join("real-summer.png"), b"broken").unwrap();
        assert_eq!(
            read_sheet(&asset, Some("style=realistic&season=summer")).unwrap().0[24],
            2
        );
        fs::write(root.join("real.png"), b"broken").unwrap();
        assert_eq!(
            read_sheet(&asset, Some("style=realistic&season=summer")).unwrap().0[24],
            1
        );
        fs::write(root.join("portrait.png"), b"broken").unwrap();
        assert!(read_sheet(&asset, Some("style=realistic&portrait=1")).is_none());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn seasonal_requests_fall_back_and_revalidate_changed_files() {
        let root = std::env::temp_dir().join(format!("playpets-sprite-{}", uuid::Uuid::new_v4()));
        let pet = root.join("pet");
        fs::create_dir_all(&pet).unwrap();
        let mut bytes = vec![0; 25];
        bytes[..8].copy_from_slice(b"\x89PNG\r\n\x1a\n");
        bytes[16..20].copy_from_slice(&1536u32.to_be_bytes());
        bytes[20..24].copy_from_slice(&2288u32.to_be_bytes());
        fs::write(pet.join("base.png"), &bytes).unwrap();
        bytes[24] = 42;
        fs::write(pet.join("spring.png"), &bytes).unwrap();
        fs::write(pet.join("pet.json"), r#"{"id":"wardrobe","displayName":"Wardrobe","spriteVersionNumber":2,"spritesheetPath":"base.png","seasonalSpritesheets":{"spring":"spring.png"}}"#).unwrap();
        let asset = catalog::read_pet(&pet).unwrap();
        for query in [
            None,
            Some("season=unknown"),
            Some("season=summer"),
            Some("season=../spring"),
        ] {
            assert_eq!(read_sheet(&asset, query).unwrap().0[24], 0);
        }
        assert_eq!(read_sheet(&asset, Some("season=spring")).unwrap().0[24], 42);
        let json = asset_json(&asset);
        assert_eq!(
            json["seasonalSpriteUrls"]["spring"],
            format!("{}?season=spring", sprite_url(&asset.id))
        );
        fs::OpenOptions::new()
            .write(true)
            .open(pet.join("spring.png"))
            .unwrap()
            .set_len(catalog::SPRITE_LIMIT as u64 + 1)
            .unwrap();
        assert_eq!(read_sheet(&asset, Some("season=spring")).unwrap().0[24], 0);
        fs::write(pet.join("spring.png"), b"broken").unwrap();
        assert_eq!(read_sheet(&asset, Some("season=spring")).unwrap().0[24], 0);
        #[cfg(unix)]
        {
            fs::write(root.join("outside.png"), &bytes).unwrap();
            fs::remove_file(pet.join("spring.png")).unwrap();
            std::os::unix::fs::symlink(root.join("outside.png"), pet.join("spring.png")).unwrap();
            assert_eq!(read_sheet(&asset, Some("season=spring")).unwrap().0[24], 0);
        }
        fs::write(pet.join("base.png"), b"broken").unwrap();
        assert!(read_sheet(&asset, None).is_none());
        fs::remove_dir_all(root).unwrap();
    }
}
