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

/// What the person picked for the yard: the place (a built-in id or an imported background's),
/// the season, the time of day and the weather. The page checks each against what it has.
const SCENE_KEYS: [&str; 4] = ["world", "season", "period", "weather"];

/// A scene choice as saved, or None for a key or value the page never sends.
pub fn scene_choice(key: &str, value: &str) -> Option<Value> {
    let fits = (1..=64).contains(&value.len())
        && value
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    (SCENE_KEYS.contains(&key) && fits).then(|| json!(value))
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
    /// Idle friends now and then dig on their own (the page keeps the timer).
    pub auto_play: bool,
    /// The yard's sounds (the page plays them; src/yard/sound.js).
    pub sound: Sound,
    /// The normal window bounds, restored across launches.
    pub window_rect: Option<window::Rect>,
    pub always_on_top: bool,
    /// The place and the weather picked for the yard (`scene_choice`).
    pub scene: Map<String, Value>,
}

impl Prefs {
    /// The keys of state.json these are saved under.
    pub const KEYS: [&str; 10] = [
        "desktop",
        "desktopWander",
        "language",
        "autoChatter",
        "autoPlay",
        "sound",
        "windowRect",
        "alwaysOnTop",
        "miniRect",
        "scene",
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
            auto_play: flag("autoPlay"),
            sound: Sound::restore(raw.get("sound")),
            window_rect: raw
                .get("windowRect")
                .or_else(|| raw.get("miniRect"))
                .and_then(window::rect_of),
            always_on_top: flag("alwaysOnTop"),
            scene: raw
                .get("scene")
                .and_then(Value::as_object)
                .map(|saved| {
                    saved
                        .iter()
                        .filter_map(|(key, value)| Some((key.clone(), scene_choice(key, value.as_str()?)?)))
                        .collect()
                })
                .unwrap_or_default(),
        }
    }

    /// As saved; the pages get the switches without the window bounds.
    pub fn json(&self) -> Map<String, Value> {
        let mut m = Map::new();
        m.insert("desktop".into(), json!(self.desktop));
        m.insert("desktopWander".into(), json!(self.wander));
        m.insert("language".into(), json!(self.language.code()));
        m.insert("autoChatter".into(), json!(self.auto_chatter));
        m.insert("autoPlay".into(), json!(self.auto_play));
        m.insert("sound".into(), json!(self.sound));
        if let Some((x, y, width, height)) = self.window_rect {
            m.insert(
                "windowRect".into(),
                json!({"x": x, "y": y, "width": width, "height": height}),
            );
        }
        m.insert("alwaysOnTop".into(), json!(self.always_on_top));
        m.insert("scene".into(), Value::Object(self.scene.clone()));
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
    fn window_preferences_migrate_old_bounds_and_save_the_single_window() {
        let lang = i18n::Lang::parse("en").unwrap();
        let old = json!({"miniRect": {"x": 12, "y": 24, "width": 460, "height": 320}});
        let prefs = Prefs::restore(&old, lang);
        let saved = prefs.json();
        assert_eq!(window::rect_of(&saved["windowRect"]), window::rect_of(&old["miniRect"]));
        assert_eq!(saved.get("alwaysOnTop"), Some(&json!(false)));
        assert!(!saved.contains_key("miniRect"));
        let both = json!({"windowRect": {"x": 50, "y": 60, "width": 800, "height": 600}, "miniRect": old["miniRect"], "alwaysOnTop": true});
        let saved = Prefs::restore(&both, lang).json();
        assert_eq!(
            window::rect_of(&saved["windowRect"]),
            window::rect_of(&both["windowRect"])
        );
        assert_eq!(saved.get("alwaysOnTop"), Some(&json!(true)));
    }

    #[test]
    fn switches_come_back_as_they_were_saved_and_bad_ones_take_their_default() {
        let lang = i18n::Lang::parse("en").unwrap();
        let prefs = Prefs {
            desktop: true,
            wander: true,
            language: lang,
            auto_chatter: true,
            auto_play: true,
            sound: Sound { on: false, volume: 7 },
            window_rect: Some((1.0, 2.0, 300.0, 210.0)),
            always_on_top: true,
            scene: json!({"world": "custom-0b6f2c1e-8d4a-4f1b-9c3e-2a7d5e6f8a90", "season": "winter"})
                .as_object()
                .cloned()
                .unwrap(),
        };
        let saved = Value::Object(prefs.json());
        assert_eq!(Prefs::restore(&saved, lang), prefs);
        let mut keys: Vec<_> = prefs.json().keys().cloned().collect();
        keys.sort();
        let mut expected = Prefs::KEYS
            .into_iter()
            .filter(|key| *key != "miniRect")
            .map(String::from)
            .collect::<Vec<_>>();
        expected.sort();
        assert_eq!(keys, expected, "every switch is saved under a key listed in KEYS");

        let odd = json!({"desktop": "yes", "autoChatter": 1, "autoPlay": "on", "miniRect": {"x": 1}});
        let back = Prefs::restore(&odd, lang);
        assert!(!back.desktop && !back.auto_chatter && !back.auto_play && back.window_rect.is_none());
        assert!(!Prefs::restore(&odd, lang).json().contains_key("miniRect"));
    }

    #[test]
    fn the_place_and_weather_picked_come_back_and_odd_ones_are_left_out() {
        let lang = i18n::Lang::parse("en").unwrap();
        let raw = json!({"scene": {
            "world": "woodland", "season": "Winter!", "period": 7, "weather": "snow", "colour": "red"
        }});
        let scene = Prefs::restore(&raw, lang).scene;
        assert_eq!(Value::Object(scene), json!({"world": "woodland", "weather": "snow"}));
        assert!(Prefs::restore(&json!({"scene": "woodland"}), lang).scene.is_empty());
        assert_eq!(scene_choice("period", "night"), Some(json!("night")));
        assert_eq!(scene_choice("colour", "red"), None);
        assert_eq!(scene_choice("world", &"a".repeat(65)), None);
        assert_eq!(scene_choice("world", ""), None);
    }
}
