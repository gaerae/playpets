// Sprite sheets served to the pages from the pet files on this computer.
use super::*;

/// Serves sprite sheets to the pages: pet-asset://sprite/{asset id}, which Windows spells
/// http://pet-asset.localhost/sprite/{asset id}.
pub fn sprite_response(app: &AppHandle, uri: &tauri::http::Uri) -> tauri::http::Response<Vec<u8>> {
    let path = uri.path().trim_start_matches('/');
    let id = if uri.host() == Some("sprite") {
        path
    } else {
        path.trim_start_matches("sprite/")
    };
    let found = lock(&app.state::<Shared>())
        .assets
        .iter()
        .find(|a| a.id == id)
        .map(|a| a.sprite_path.clone());
    // A sheet can be swapped on disk after it was read in; it is never read past the limit.
    let small_enough =
        |p: &std::path::Path| std::fs::metadata(p).is_ok_and(|m| m.len() <= catalog::SPRITE_LIMIT as u64);
    match found.and_then(|p| {
        small_enough(&p)
            .then(|| std::fs::read(&p).ok())
            .flatten()
            .map(|bytes| (bytes, p))
    }) {
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
