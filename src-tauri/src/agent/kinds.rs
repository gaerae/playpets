//! The coding agents the app knows, one record each: the kind the page and the CLI name it by,
//! how it is shown, whether it reports through a hook, and the settings file it reads. Adding
//! an agent is a record here, an arm in `cli::hook_event` and in `snippets::connection_snippet`,
//! a row in index.html's settings tab, and the strings those name.
use serde_json::{Value, json};

pub struct Agent {
    pub kind: &'static str,
    pub label: &'static str,
    /// Reports through `playpets hook <kind>`; MCP talks to the app itself.
    pub hook: bool,
    /// The settings file under the home folder the copied snippet goes into.
    pub settings_file: &'static [&'static str],
}

pub const AGENTS: [Agent; 5] = [
    Agent {
        kind: "claude",
        label: "Claude Code",
        hook: true,
        settings_file: &[".claude", "settings.json"],
    },
    Agent {
        kind: "codex",
        label: "Codex",
        hook: true,
        settings_file: &[".codex", "config.toml"],
    },
    Agent {
        kind: "gemini",
        label: "Gemini CLI",
        hook: true,
        settings_file: &[".gemini", "settings.json"],
    },
    Agent {
        kind: "cursor",
        label: "Cursor",
        hook: true,
        settings_file: &[".cursor", "hooks.json"],
    },
    Agent {
        kind: "mcp",
        label: "MCP",
        hook: false,
        settings_file: &[],
    },
];

pub fn by_kind(kind: &str) -> Option<&'static Agent> {
    AGENTS.iter().find(|a| a.kind == kind)
}
pub fn is_hook_agent(kind: &str) -> bool {
    by_kind(kind).is_some_and(|a| a.hook)
}
/// The table as the page reads it (labels, settings files).
pub fn agents_json() -> Value {
    json!(
        AGENTS
            .iter()
            .map(|a| json!({"kind": a.kind, "label": a.label, "file": a.settings_file}))
            .collect::<Vec<_>>()
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn agents_are_named_once_and_hook_agents_have_a_settings_file() {
        let mut seen = std::collections::HashSet::new();
        for a in &AGENTS {
            assert!(seen.insert(a.kind), "{} is listed twice", a.kind);
            assert_eq!(
                a.hook,
                !a.settings_file.is_empty(),
                "{}: a hook agent has a file to paste into",
                a.kind
            );
        }
        assert!(is_hook_agent("gemini") && !is_hook_agent("mcp") && !is_hook_agent("nope"));
        assert_eq!(agents_json()[0]["file"], json!([".claude", "settings.json"]));
    }
}
