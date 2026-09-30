//! `playpets://import?url=<pet page>`: the link a pet gallery can put behind an "Open in
//! PlayPets" button. Nothing is downloaded on the link alone: the yard comes forward and the
//! page asks the person first, then imports exactly as a pasted address would be.
use crate::app;
use crate::window;
use serde_json::json;
use tauri::AppHandle;
use url::Url;

/// The pet page address inside an import link, or nothing for any other link.
pub fn pet_url(link: &str) -> Option<String> {
    let url = Url::parse(link).ok()?;
    if url.scheme() != "playpets" || url.host_str() != Some("import") {
        return None;
    }
    url.query_pairs()
        .find(|(key, _)| key == "url")
        .map(|(_, value)| value.into_owned())
        .filter(|value| !value.is_empty())
}

/// Handles one link the system handed to the app. Unknown links are ignored; an import link
/// becomes a request the page confirms (any web page can open such links once the browser
/// remembers the choice, so none of them may act on its own).
pub fn open(app: &AppHandle, link: &str) {
    let Some(target) = pet_url(link) else {
        return;
    };
    window::show(app);
    app::push_event(app, &json!({"type": "import-request", "url": target}));
}

#[cfg(test)]
mod tests {
    use super::pet_url;

    #[test]
    fn only_an_import_link_with_an_address_counts() {
        assert_eq!(
            pet_url("playpets://import?url=https%3A%2F%2Fpetdex.dev%2Fpets%2Fwhite"),
            Some("https://petdex.dev/pets/white".into())
        );
        assert_eq!(pet_url("playpets://import?url="), None);
        assert_eq!(pet_url("playpets://open"), None);
        assert_eq!(pet_url("https://example.com/import?url=x"), None);
        assert_eq!(pet_url("not a link"), None);
    }
}
