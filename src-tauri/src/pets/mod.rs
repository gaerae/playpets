//! Pets: the files on this computer (catalog), bringing new ones in from a page (importer), the
//! friends made from them in the yard (model), the garden they grow (garden), the album (album),
//! friendship (bond), and what the yard is made of (content, from src/content/catalog.json).
pub mod album;
pub mod bond;
pub mod builtin;
pub mod catalog;
pub mod content;
pub mod garden;
pub mod importer;
pub mod model;

/// The limits the page shows and keeps to, in one place (public_state's `limits`).
pub fn limits() -> serde_json::Value {
    serde_json::json!({
        "persona": model::PERSONA_MAX,
        "seeds": garden::SEED_MAX,
        "plants": garden::PLANT_MAX,
        "decor": garden::DECOR_MAX,
        "bondLevels": bond::LEVELS,
    })
}
