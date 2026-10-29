//! Connecting a coding agent in one press: the same settings Copy settings hands over are merged
//! into the agent's own settings file, beside everything already there, and Disconnect takes out
//! only PlayPets' own entries. A file that cannot be read is never written.
use super::kinds::{self, Format};
use crate::i18n;
use serde_json::{Map, Value, json};
use std::fs;
use std::path::{Path, PathBuf};

/// Where an agent stands, as the settings tab shows it.
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Link {
    /// No PlayPets entry.
    Off,
    /// PlayPets' entries are exactly the ones Connect would write now.
    On,
    /// PlayPets' entries name another friend, an older app path or older events.
    Outdated,
    /// The file is there but is not settings this app can read (a comment, a typo).
    Unreadable,
    /// Codex runs one notify program and another tool's holds the place.
    Taken,
}
impl Link {
    pub fn code(self) -> &'static str {
        match self {
            Link::Off => "off",
            Link::On => "on",
            Link::Outdated => "outdated",
            Link::Unreadable => "unreadable",
            Link::Taken => "taken",
        }
    }
}

/// The agent's settings file under `home`, for an agent that has one.
pub fn settings_path(home: &Path, kind: &str) -> Option<PathBuf> {
    let agent = kinds::by_kind(kind).filter(|a| a.format != Format::None)?;
    Some(
        agent
            .settings_file
            .iter()
            .fold(home.to_path_buf(), |path, part| path.join(part)),
    )
}

/// Where `kind` stands against `snippet`, the settings Connect would write.
pub fn status(home: &Path, kind: &str, snippet: &str) -> Link {
    let Some(path) = settings_path(home, kind) else {
        return Link::Off;
    };
    match read(&path) {
        Err(_) => Link::Unreadable,
        Ok(text) => match Settings::parse(kind, text.as_deref().unwrap_or("")) {
            Err(_) => Link::Unreadable,
            Ok(settings) => settings.link(snippet),
        },
    }
}

/// Writes `snippet` into the agent's settings file; true when the file changed. Connected already,
/// nothing is written.
pub fn connect(home: &Path, kind: &str, snippet: &str) -> Result<bool, String> {
    let path = settings_path(home, kind).ok_or_else(|| i18n::t("error.unknown_link"))?;
    let shown = path.to_string_lossy().to_string();
    let original = read(&path).map_err(|_| unreadable(&shown))?;
    let mut settings = Settings::parse(kind, original.as_deref().unwrap_or("")).map_err(|_| unreadable(&shown))?;
    match settings.link(snippet) {
        Link::On => return Ok(false),
        Link::Taken => return Err(i18n::tr("link.notify_taken", &[("file", &shown)])),
        _ => {}
    }
    settings.remove_own();
    settings.add(snippet);
    save(&path, original.is_some(), Some(&settings.text()))?;
    Ok(true)
}

/// Takes PlayPets' own entries out of the agent's settings file; true when the file changed. A file
/// left with nothing in it is removed, as it was before Connect made it.
pub fn disconnect(home: &Path, kind: &str) -> Result<bool, String> {
    let path = settings_path(home, kind).ok_or_else(|| i18n::t("error.unknown_link"))?;
    let shown = path.to_string_lossy().to_string();
    let Some(original) = read(&path).map_err(|_| unreadable(&shown))? else {
        return Ok(false);
    };
    let mut settings = Settings::parse(kind, &original).map_err(|_| unreadable(&shown))?;
    if !settings.remove_own() {
        return Ok(false);
    }
    let text = settings.text();
    save(&path, true, (!settings.is_empty()).then_some(text.as_str()))?;
    Ok(true)
}

fn unreadable(file: &str) -> String {
    i18n::tr("link.unreadable", &[("file", file)])
}

/// The file's text, or None when there is none yet. A link (a dotfiles folder) is followed, so the
/// file it points to is the one written.
fn read(path: &Path) -> std::io::Result<Option<String>> {
    match fs::read_to_string(path) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e),
    }
}

/// Writes `text` (or removes the file for None) through a temporary file beside it, so the agent
/// never reads half a file. The file as it was is kept beside it first.
fn save(path: &Path, existed: bool, text: Option<&str>) -> Result<(), String> {
    let path = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let shown = path.to_string_lossy().to_string();
    let failed = |e: std::io::Error| i18n::tr("link.write_failed", &[("file", &shown), ("detail", &e.to_string())]);
    if existed {
        fs::copy(&path, sibling(&path, "playpets-backup")).map_err(failed)?;
    }
    let Some(text) = text else {
        return fs::remove_file(&path).map_err(failed);
    };
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(failed)?;
    }
    // The suffix keeps the temporary file out of a folder the agent reads whole (`*.json`).
    let temporary = sibling(&path, "playpets-tmp");
    fs::write(&temporary, text).map_err(failed)?;
    if let Ok(meta) = fs::metadata(&path) {
        let _ = fs::set_permissions(&temporary, meta.permissions());
    }
    fs::rename(&temporary, &path).map_err(|e| {
        let _ = fs::remove_file(&temporary);
        failed(e)
    })
}

fn sibling(path: &Path, suffix: &str) -> PathBuf {
    let mut name = path.file_name().unwrap_or_default().to_os_string();
    name.push(format!(".{suffix}"));
    path.with_file_name(name)
}

/// An agent's settings as read, in the shape its format keeps hooks in.
enum Settings {
    Json {
        kind: String,
        flat: bool,
        root: Map<String, Value>,
    },
    Notify {
        doc: toml_edit::DocumentMut,
    },
}

impl Settings {
    fn parse(kind: &str, text: &str) -> Result<Settings, ()> {
        let format = kinds::by_kind(kind).map(|a| a.format).ok_or(())?;
        match format {
            Format::Grouped | Format::Flat => {
                let root = if text.trim().is_empty() {
                    Map::new()
                } else {
                    match serde_json::from_str(text).map_err(|_| ())? {
                        Value::Object(root) => root,
                        _ => return Err(()),
                    }
                };
                // Every event must already be a list for an entry to be added beside the others.
                match root.get("hooks") {
                    None => {}
                    Some(Value::Object(hooks)) if hooks.values().all(Value::is_array) => {}
                    Some(_) => return Err(()),
                }
                Ok(Settings::Json {
                    kind: kind.into(),
                    flat: format == Format::Flat,
                    root,
                })
            }
            Format::Notify => Ok(Settings::Notify {
                doc: text.parse().map_err(|_| ())?,
            }),
            Format::None => Err(()),
        }
    }

    fn link(&self, snippet: &str) -> Link {
        match self {
            Settings::Json { .. } => {
                let own = self.own_hooks();
                if own.is_empty() {
                    Link::Off
                } else if Value::Object(own) == json_snippet(snippet)["hooks"] {
                    Link::On
                } else {
                    Link::Outdated
                }
            }
            Settings::Notify { doc } => match doc.get("notify") {
                None => Link::Off,
                Some(item) if !own_notify(item) => Link::Taken,
                Some(item) if notify_args(item) == notify_args(&notify_snippet(snippet)) => Link::On,
                Some(_) => Link::Outdated,
            },
        }
    }

    /// PlayPets' handlers, event by event, each in the group it sits in.
    fn own_hooks(&self) -> Map<String, Value> {
        let Settings::Json { kind, flat, root } = self else {
            return Map::new();
        };
        let mut own = Map::new();
        for (event, list) in root.get("hooks").and_then(Value::as_object).into_iter().flatten() {
            let list: Vec<Value> = list
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(|entry| {
                    if *flat {
                        return own_handler(entry, kind).then(|| entry.clone());
                    }
                    let handlers: Vec<Value> = entry
                        .get("hooks")?
                        .as_array()?
                        .iter()
                        .filter(|h| own_handler(h, kind))
                        .cloned()
                        .collect();
                    (!handlers.is_empty()).then(|| {
                        let mut group = entry.clone();
                        group["hooks"] = Value::Array(handlers);
                        group
                    })
                })
                .collect();
            if !list.is_empty() {
                own.insert(event.clone(), Value::Array(list));
            }
        }
        own
    }

    /// Takes out PlayPets' entries, and a group or an event they leave empty; true if any was there.
    fn remove_own(&mut self) -> bool {
        match self {
            Settings::Json { kind, flat, root } => {
                let Some(Value::Object(hooks)) = root.get_mut("hooks") else {
                    return false;
                };
                let mut removed = false;
                for list in hooks.values_mut() {
                    let Some(list) = list.as_array_mut() else { continue };
                    let before = list.len();
                    if *flat {
                        list.retain(|h| !own_handler(h, kind));
                    } else {
                        list.retain_mut(|group| {
                            let Some(handlers) = group.get_mut("hooks").and_then(Value::as_array_mut) else {
                                return true;
                            };
                            let count = handlers.len();
                            handlers.retain(|h| !own_handler(h, kind));
                            if handlers.len() == count {
                                return true;
                            }
                            removed = true;
                            !handlers.is_empty()
                        });
                    }
                    removed |= list.len() != before;
                }
                if removed {
                    hooks.retain(|_, list| list.as_array().is_none_or(|l| !l.is_empty()));
                    if hooks.is_empty() {
                        root.remove("hooks");
                    }
                }
                removed
            }
            Settings::Notify { doc } => {
                if doc.get("notify").is_some_and(own_notify) {
                    doc.remove("notify");
                    true
                } else {
                    false
                }
            }
        }
    }

    /// Adds the snippet's entries after the ones already there, and its other keys (Cursor's
    /// `version`) only where the file has none.
    fn add(&mut self, snippet: &str) {
        match self {
            Settings::Json { root, .. } => {
                let Value::Object(wanted) = json_snippet(snippet) else {
                    return;
                };
                for (key, value) in wanted {
                    if key != "hooks" {
                        root.entry(key).or_insert(value);
                        continue;
                    }
                    let hooks = root.entry("hooks").or_insert_with(|| json!({}));
                    for (event, list) in value.as_object().into_iter().flatten() {
                        if let Some(existing) = hooks
                            .as_object_mut()
                            .and_then(|h| h.entry(event.clone()).or_insert_with(|| json!([])).as_array_mut())
                        {
                            existing.extend(list.as_array().into_iter().flatten().cloned());
                        }
                    }
                }
            }
            Settings::Notify { doc } => {
                doc.insert("notify", notify_snippet(snippet));
            }
        }
    }

    fn is_empty(&self) -> bool {
        match self {
            Settings::Json { root, .. } => root.is_empty(),
            Settings::Notify { doc } => doc.as_table().is_empty() && doc.to_string().trim().is_empty(),
        }
    }

    fn text(&self) -> String {
        match self {
            Settings::Json { root, .. } => format!("{}\n", serde_json::to_string_pretty(root).unwrap_or_default()),
            Settings::Notify { doc } => doc.to_string(),
        }
    }
}

/// A handler PlayPets wrote: the app binary called as `hook <kind>` (agent/cli.rs), from wherever
/// the app was then.
fn own_handler(handler: &Value, kind: &str) -> bool {
    handler
        .get("command")
        .and_then(Value::as_str)
        .is_some_and(|c| c.contains(&format!(" hook {kind} --bridge ")))
}

/// A Codex notify program PlayPets wrote: `[<app>, "hook", "codex", …]`.
fn own_notify(item: &toml_edit::Item) -> bool {
    notify_args(item).windows(2).any(|w| w == ["hook", "codex"])
}

fn notify_args(item: &toml_edit::Item) -> Vec<String> {
    item.as_array()
        .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default()
}

fn json_snippet(snippet: &str) -> Value {
    serde_json::from_str(snippet).unwrap_or(Value::Null)
}

fn notify_snippet(snippet: &str) -> toml_edit::Item {
    snippet
        .parse::<toml_edit::DocumentMut>()
        .ok()
        .and_then(|doc| doc.get("notify").cloned())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent::snippets::connection_snippet;

    const EXE: &str = "/Applications/PlayPets.app/Contents/MacOS/playpets";
    const BRIDGE: &str = "/data/bridge.json";

    fn home() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("playpets-connect-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }
    fn snippet(kind: &str, pet: Option<&str>) -> String {
        connection_snippet(kind, EXE, BRIDGE, pet).unwrap()
    }
    fn put(home: &Path, kind: &str, text: &str) -> PathBuf {
        let path = settings_path(home, kind).unwrap();
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, text).unwrap();
        path
    }
    fn json_at(path: &Path) -> Value {
        serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap()
    }

    #[test]
    fn connecting_claude_keeps_every_other_setting_and_hook() {
        let home = home();
        let original = r#"{
  "model": "opus",
  "hooks": {
    "Stop": [{"hooks": [{"type": "command", "command": "say done"}]}],
    "PostToolUse": [{"matcher": "Edit", "hooks": [{"type": "command", "command": "fmt"}]}]
  },
  "mcpServers": {"other": {"command": "x"}}
}"#;
        let path = put(&home, "claude", original);
        assert_eq!(status(&home, "claude", &snippet("claude", None)), Link::Off);
        assert!(connect(&home, "claude", &snippet("claude", None)).unwrap());
        let after = json_at(&path);
        assert_eq!(after["model"], "opus");
        assert_eq!(after["mcpServers"]["other"]["command"], "x");
        assert_eq!(after["hooks"]["PostToolUse"][0]["hooks"][0]["command"], "fmt");
        assert_eq!(after["hooks"]["Stop"][0]["hooks"][0]["command"], "say done");
        assert!(
            after["hooks"]["Stop"][1]["hooks"][0]["command"]
                .as_str()
                .unwrap()
                .contains(" hook claude --bridge ")
        );
        assert_eq!(after["hooks"]["PreToolUse"][0]["matcher"], "*");
        assert_eq!(status(&home, "claude", &snippet("claude", None)), Link::On);
        // The file as it was stays beside it.
        assert_eq!(fs::read_to_string(sibling(&path, "playpets-backup")).unwrap(), original);
    }

    #[test]
    fn connecting_twice_changes_nothing() {
        let home = home();
        for kind in ["claude", "gemini", "cursor", "grok", "codex"] {
            assert!(connect(&home, kind, &snippet(kind, None)).unwrap(), "{kind}");
            let path = settings_path(&home, kind).unwrap();
            let first = fs::read_to_string(&path).unwrap();
            let modified = fs::metadata(&path).unwrap().modified().unwrap();
            assert!(!connect(&home, kind, &snippet(kind, None)).unwrap(), "{kind}");
            assert_eq!(fs::read_to_string(&path).unwrap(), first, "{kind}");
            assert_eq!(fs::metadata(&path).unwrap().modified().unwrap(), modified, "{kind}");
            assert_eq!(status(&home, kind, &snippet(kind, None)), Link::On, "{kind}");
        }
    }

    #[test]
    fn another_friend_or_app_path_is_outdated_until_connected_again() {
        let home = home();
        connect(&home, "claude", &snippet("claude", None)).unwrap();
        let pinned = snippet("claude", Some("pet-1"));
        assert_eq!(status(&home, "claude", &pinned), Link::Outdated);
        assert!(connect(&home, "claude", &pinned).unwrap());
        assert_eq!(status(&home, "claude", &pinned), Link::On);
        let after = json_at(&settings_path(&home, "claude").unwrap());
        // Replaced, not added beside the old entry.
        assert_eq!(after["hooks"]["Stop"].as_array().unwrap().len(), 1);
        assert!(
            after["hooks"]["Stop"][0]["hooks"][0]["command"]
                .as_str()
                .unwrap()
                .ends_with(r#"--pet "pet-1""#)
        );
        let moved = connection_snippet("claude", "/opt/playpets", BRIDGE, Some("pet-1")).unwrap();
        assert_eq!(status(&home, "claude", &moved), Link::Outdated);
    }

    #[test]
    fn disconnecting_takes_out_only_playpets_entries() {
        let home = home();
        let original = r#"{"version": 1, "hooks": {"stop": [{"command": "./notify.sh"}]}}"#;
        let path = put(&home, "cursor", original);
        connect(&home, "cursor", &snippet("cursor", None)).unwrap();
        assert_eq!(json_at(&path)["hooks"]["stop"].as_array().unwrap().len(), 2);
        assert!(disconnect(&home, "cursor").unwrap());
        assert_eq!(
            json_at(&path),
            json!({"version": 1, "hooks": {"stop": [{"command": "./notify.sh"}]}})
        );
        assert_eq!(status(&home, "cursor", &snippet("cursor", None)), Link::Off);
        assert!(!disconnect(&home, "cursor").unwrap(), "nothing left to take out");

        // A group of another tool's handlers keeps them; only PlayPets' handler leaves it.
        let shared = format!(
            r#"{{"hooks": {{"Stop": [{{"hooks": [{{"type": "command", "command": "say"}}, {{"type": "command", "command": "\"{EXE}\" hook claude --bridge \"{BRIDGE}\""}}]}}]}}}}"#
        );
        let path = put(&home, "claude", &shared);
        assert!(disconnect(&home, "claude").unwrap());
        assert_eq!(
            json_at(&path),
            json!({"hooks": {"Stop": [{"hooks": [{"type": "command", "command": "say"}]}]}})
        );
    }

    #[test]
    fn a_file_connect_made_is_gone_after_disconnect() {
        let home = home();
        connect(&home, "grok", &snippet("grok", None)).unwrap();
        let path = settings_path(&home, "grok").unwrap();
        assert!(path.ends_with(".grok/hooks/playpets.json") && path.exists());
        assert!(disconnect(&home, "grok").unwrap());
        assert!(!path.exists());
        // Nothing else in the hooks folder Grok Build reads ends in .json.
        let left: Vec<String> = fs::read_dir(path.parent().unwrap())
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().to_string())
            .collect();
        assert!(left.iter().all(|name| !name.ends_with(".json")), "{left:?}");
    }

    #[test]
    fn a_file_that_cannot_be_read_is_left_alone() {
        let home = home();
        for (kind, text) in [
            ("gemini", "{\n  // a comment\n  \"theme\": \"dark\"\n}"),
            ("claude", "[1, 2]"),
            ("claude", r#"{"hooks": {"Stop": "say"}}"#),
            ("codex", "model = \n"),
        ] {
            let path = put(&home, kind, text);
            assert_eq!(status(&home, kind, &snippet(kind, None)), Link::Unreadable, "{kind}");
            let error = connect(&home, kind, &snippet(kind, None)).unwrap_err();
            assert!(error.contains(&path.to_string_lossy().to_string()), "{error}");
            assert!(disconnect(&home, kind).is_err(), "{kind}");
            assert_eq!(fs::read_to_string(&path).unwrap(), text, "{kind}");
            assert!(!sibling(&path, "playpets-backup").exists(), "{kind}");
        }
    }

    #[test]
    fn codex_notify_goes_at_the_top_and_keeps_tables_and_comments() {
        let home = home();
        let original = "# my settings\nmodel = \"gpt-5\"\n\n[projects.\"/work\"]\ntrust_level = \"trusted\"\n";
        let path = put(&home, "codex", original);
        connect(&home, "codex", &snippet("codex", Some("pet-1"))).unwrap();
        let text = fs::read_to_string(&path).unwrap();
        let doc: toml_edit::DocumentMut = text.parse().unwrap();
        assert_eq!(notify_args(&doc["notify"])[1..3], ["hook", "codex"]);
        assert!(text.starts_with("# my settings\nmodel = \"gpt-5\"\n"), "{text}");
        assert!(
            text.find("notify").unwrap() < text.find("[projects").unwrap(),
            "a top-level key comes before any table: {text}"
        );
        assert_eq!(doc["projects"]["/work"]["trust_level"].as_str(), Some("trusted"));
        assert_eq!(status(&home, "codex", &snippet("codex", Some("pet-1"))), Link::On);
        assert!(disconnect(&home, "codex").unwrap());
        assert_eq!(fs::read_to_string(&path).unwrap(), original);
    }

    #[test]
    fn another_codex_notify_program_is_never_replaced() {
        let home = home();
        let original = "notify = [\"terminal-notifier\", \"-title\", \"Codex\"]\n";
        let path = put(&home, "codex", original);
        assert_eq!(status(&home, "codex", &snippet("codex", None)), Link::Taken);
        assert!(connect(&home, "codex", &snippet("codex", None)).is_err());
        assert!(!disconnect(&home, "codex").unwrap());
        assert_eq!(fs::read_to_string(&path).unwrap(), original);
    }

    #[cfg(unix)]
    #[test]
    fn a_linked_settings_file_stays_a_link() {
        let home = home();
        let real = home.join("dotfiles-settings.json");
        fs::write(&real, r#"{"model": "opus"}"#).unwrap();
        fs::create_dir_all(home.join(".claude")).unwrap();
        let link = settings_path(&home, "claude").unwrap();
        std::os::unix::fs::symlink(&real, &link).unwrap();
        connect(&home, "claude", &snippet("claude", None)).unwrap();
        assert!(fs::symlink_metadata(&link).unwrap().file_type().is_symlink());
        assert_eq!(json_at(&real)["model"], "opus");
        assert!(json_at(&real)["hooks"]["Stop"].is_array());
    }

    #[test]
    fn mcp_has_no_file_to_connect() {
        let home = home();
        assert!(settings_path(&home, "mcp").is_none());
        assert_eq!(status(&home, "mcp", "{}"), Link::Off);
        assert!(connect(&home, "mcp", "{}").is_err());
    }
}
