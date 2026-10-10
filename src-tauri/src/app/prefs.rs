// The person's switches: saved as top-level keys of state.json and shown to every page under the
// same names. A new switch is a field here, a line in `restore` and one in `json`, and the command
// that changes it (commands.rs).
use super::*;

/// The yard's sounds: on or off, and how loud (0 to 100). On by default, and quiet.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq)]
pub struct Sound {
    pub on: bool,
    pub volume: u8,
}
impl Default for Sound {
    fn default() -> Self {
        Sound { on: true, volume: 40 }
    }
}
impl Sound {
    fn restore(raw: Option<&Value>) -> Sound {
        raw.and_then(|v| serde_json::from_value::<Sound>(v.clone()).ok())
            .map(|s| Sound {
                volume: s.volume.min(100),
                ..s
            })
            .unwrap_or_default()
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct Prefs {
    /// Friends are out on the desktop, and (`wander`) roam it.
    pub desktop: bool,
    pub wander: bool,
    /// The language the app speaks to the person in; the pet is asked to answer in it too.
    pub language: i18n::Lang,
    /// The friends talk among themselves every so often (the page keeps the timer).
    pub auto_chatter: bool,
    /// The yard's sounds (the page plays them; src/yard/sound.js).
    pub sound: Sound,
    /// Where the mini window was last left (window.rs), so it opens there again.
    pub mini_rect: Option<window::Rect>,
}

impl Prefs {
    /// The keys of state.json these are saved under.
    pub const KEYS: [&str; 6] = [
        "desktop",
        "desktopWander",
        "language",
        "autoChatter",
        "sound",
        "miniRect",
    ];

    /// Read back from a saved state; a key missing or of the wrong kind takes its default.
    /// The language is picked before (it decides the strings the rest of the start uses).
    pub fn restore(raw: &Value, language: i18n::Lang) -> Prefs {
        let flag = |key: &str| raw.get(key).and_then(|v| v.as_bool()).unwrap_or(false);
        Prefs {
            desktop: flag("desktop"),
            wander: flag("desktopWander"),
            language,
            auto_chatter: flag("autoChatter"),
            sound: Sound::restore(raw.get("sound")),
            mini_rect: raw.get("miniRect").and_then(window::rect_of),
        }
    }

    /// As saved and as the pages see them (no `miniRect` until the mini window has been moved).
    pub fn json(&self) -> Map<String, Value> {
        let mut m = Map::new();
        m.insert("desktop".into(), json!(self.desktop));
        m.insert("desktopWander".into(), json!(self.wander));
        m.insert("language".into(), json!(self.language.code()));
        m.insert("autoChatter".into(), json!(self.auto_chatter));
        m.insert("sound".into(), json!(self.sound));
        if let Some((x, y, width, height)) = self.mini_rect {
            m.insert(
                "miniRect".into(),
                json!({"x": x, "y": y, "width": width, "height": height}),
            );
        }
        m
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_yard_sounds_start_on_and_quiet_and_a_saved_volume_is_held_to_100() {
        assert_eq!(Sound::restore(None), Sound { on: true, volume: 40 });
        assert_eq!(
            Sound::restore(Some(&json!({"on": false, "volume": 250}))),
            Sound { on: false, volume: 100 }
        );
        assert_eq!(Sound::restore(Some(&json!("loud"))), Sound::default());
    }

    #[test]
    fn switches_come_back_as_they_were_saved_and_bad_ones_take_their_default() {
        let lang = i18n::Lang::parse("en").unwrap();
        let prefs = Prefs {
            desktop: true,
            wander: true,
            language: lang,
            auto_chatter: true,
            sound: Sound { on: false, volume: 7 },
            mini_rect: Some((1.0, 2.0, 300.0, 200.0)),
        };
        let saved = Value::Object(prefs.json());
        assert_eq!(Prefs::restore(&saved, lang), prefs);
        let mut keys: Vec<_> = prefs.json().keys().cloned().collect();
        keys.sort();
        let mut expected = Prefs::KEYS.map(String::from).to_vec();
        expected.sort();
        assert_eq!(keys, expected, "every switch is saved under a key listed in KEYS");

        let odd = json!({"desktop": "yes", "autoChatter": 1, "miniRect": {"x": 1}});
        let back = Prefs::restore(&odd, lang);
        assert!(!back.desktop && !back.auto_chatter && back.mini_rect.is_none());
        assert!(!Prefs::restore(&odd, lang).json().contains_key("miniRect"));
    }
}
