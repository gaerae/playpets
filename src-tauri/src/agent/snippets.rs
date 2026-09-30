//! The settings a coding agent needs to reach this app, ready to paste: every snippet points at
//! this app's own binary (`playpets hook …`, `playpets mcp`), so no Node.js is needed.
use crate::i18n;
use serde_json::{Map, Value, json};

const CLAUDE_EVENTS: [&str; 5] = ["UserPromptSubmit", "PreToolUse", "Notification", "Stop", "SessionEnd"];
const GEMINI_EVENTS: [&str; 5] = ["BeforeAgent", "BeforeTool", "Notification", "AfterAgent", "SessionEnd"];
// Observational Cursor hooks only: permission hooks block the agent on any output mismatch.
const CURSOR_EVENTS: [&str; 6] = [
    "afterAgentThought",
    "postToolUse",
    "afterFileEdit",
    "afterShellExecution",
    "stop",
    "sessionEnd",
];

/// The app binary itself serves hooks and MCP (agent/cli.rs), so snippets need no Node.js.
/// With `pet`, the agent reports to that friend instead of the first one.
pub fn connection_snippet(kind: &str, exe: &str, bridge_file: &str, pet: Option<&str>) -> Result<String, String> {
    let quote = |s: &str| Value::String(s.to_string()).to_string();
    let target = pet.map(|p| format!(" --pet {}", quote(p))).unwrap_or_default();
    match kind {
        "claude" => {
            let command = format!("{} hook claude --bridge {}{target}", quote(exe), quote(bridge_file));
            let mut hooks = Map::new();
            for event in CLAUDE_EVENTS {
                let mut entry = Map::new();
                if event == "PreToolUse" {
                    entry.insert("matcher".into(), json!("*"));
                }
                entry.insert(
                    "hooks".into(),
                    json!([{"type": "command", "command": command, "timeout": 5}]),
                );
                hooks.insert(event.into(), json!([Value::Object(entry)]));
            }
            Ok(pretty(&json!({"hooks": Value::Object(hooks)})))
        }
        "gemini" => {
            let command = format!("{} hook gemini --bridge {}{target}", quote(exe), quote(bridge_file));
            let mut hooks = Map::new();
            for event in GEMINI_EVENTS {
                hooks.insert(
                    event.into(),
                    json!([{"hooks": [{"name": "playpets", "type": "command", "command": command, "timeout": 5000}]}]),
                );
            }
            Ok(pretty(&json!({"hooks": Value::Object(hooks)})))
        }
        "cursor" => {
            let command = format!("{} hook cursor --bridge {}{target}", quote(exe), quote(bridge_file));
            let mut hooks = Map::new();
            for event in CURSOR_EVENTS {
                hooks.insert(event.into(), json!([{"command": command, "timeout": 5}]));
            }
            Ok(pretty(&json!({"version": 1, "hooks": Value::Object(hooks)})))
        }
        "codex" => {
            let mut parts = vec![
                exe.to_string(),
                "hook".into(),
                "codex".into(),
                "--bridge".into(),
                bridge_file.into(),
            ];
            if let Some(p) = pet {
                parts.extend(["--pet".to_string(), p.to_string()]);
            }
            Ok(format!(
                "notify = [{}]",
                parts.iter().map(|p| quote(p)).collect::<Vec<_>>().join(", ")
            ))
        }
        "mcp" => {
            let mut env = Map::new();
            env.insert("PLAYPETS_BRIDGE".into(), json!(bridge_file));
            if let Some(p) = pet {
                env.insert("PLAYPETS_PET".into(), json!(p));
            }
            Ok(pretty(
                &json!({"mcpServers": {"playpets": {"command": exe, "args": ["mcp"], "env": Value::Object(env)}}}),
            ))
        }
        _ => Err(i18n::t("error.unknown_link")),
    }
}

/// JSON.stringify(value, null, 2) — serde_json's pretty printer uses the same layout,
/// and preserve_order keeps keys in insertion order like JS objects.
fn pretty(value: &Value) -> String {
    serde_json::to_string_pretty(value).unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_snippet_can_name_the_friend_the_agent_reports_to() {
        let (exe, bridge) = ("/opt/playpets", "/data/bridge.json");
        let claude: Value =
            serde_json::from_str(&connection_snippet("claude", exe, bridge, Some("pet-1")).unwrap()).unwrap();
        let command = claude["hooks"]["Stop"][0]["hooks"][0]["command"].as_str().unwrap();
        assert!(command.ends_with(r#"--pet "pet-1""#), "{command}");
        assert!(
            connection_snippet("codex", exe, bridge, Some("pet-1"))
                .unwrap()
                .ends_with(r#""--pet", "pet-1"]"#)
        );
        let mcp: Value = serde_json::from_str(&connection_snippet("mcp", exe, bridge, Some("pet-1")).unwrap()).unwrap();
        assert_eq!(mcp["mcpServers"]["playpets"]["env"]["PLAYPETS_PET"], "pet-1");
        let bare: Value = serde_json::from_str(&connection_snippet("mcp", exe, bridge, None).unwrap()).unwrap();
        assert!(bare["mcpServers"]["playpets"]["env"].get("PLAYPETS_PET").is_none());
    }

    #[test]
    fn snippets_call_the_app_binary_without_node() {
        let exe = "/Applications/Play Pets.app/Contents/MacOS/playpets";
        let bridge = "/Users/me/Library/Application Support/app.playpets/bridge.json";
        let claude: Value = serde_json::from_str(&connection_snippet("claude", exe, bridge, None).unwrap()).unwrap();
        let keys: Vec<&String> = claude["hooks"].as_object().unwrap().keys().collect();
        assert_eq!(
            keys,
            ["UserPromptSubmit", "PreToolUse", "Notification", "Stop", "SessionEnd"]
        );
        assert_eq!(claude["hooks"]["PreToolUse"][0]["matcher"], "*");
        assert!(claude["hooks"]["Stop"][0].get("matcher").is_none());
        assert_eq!(
            claude["hooks"]["Stop"][0]["hooks"][0]["command"],
            r#""/Applications/Play Pets.app/Contents/MacOS/playpets" hook claude --bridge "/Users/me/Library/Application Support/app.playpets/bridge.json""#
        );
        assert_eq!(
            connection_snippet("codex", exe, bridge, None).unwrap(),
            r#"notify = ["/Applications/Play Pets.app/Contents/MacOS/playpets", "hook", "codex", "--bridge", "/Users/me/Library/Application Support/app.playpets/bridge.json"]"#
        );
        assert_eq!(
            connection_snippet(
                "codex",
                r"C:\Program Files\PlayPets\playpets.exe",
                r"C:\Users\me\bridge.json",
                None
            )
            .unwrap(),
            r#"notify = ["C:\\Program Files\\PlayPets\\playpets.exe", "hook", "codex", "--bridge", "C:\\Users\\me\\bridge.json"]"#
        );
        let mcp: Value = serde_json::from_str(&connection_snippet("mcp", exe, bridge, None).unwrap()).unwrap();
        assert_eq!(
            mcp,
            json!({"mcpServers": {"playpets": {"command": exe, "args": ["mcp"], "env": {"PLAYPETS_BRIDGE": bridge}}}})
        );
        assert!(
            !connection_snippet("claude", exe, bridge, None)
                .unwrap()
                .contains("node")
        );
        let gemini: Value = serde_json::from_str(&connection_snippet("gemini", exe, bridge, None).unwrap()).unwrap();
        let gkeys: Vec<&String> = gemini["hooks"].as_object().unwrap().keys().collect();
        assert_eq!(
            gkeys,
            ["BeforeAgent", "BeforeTool", "Notification", "AfterAgent", "SessionEnd"]
        );
        assert_eq!(
            gemini["hooks"]["BeforeTool"][0]["hooks"][0]["timeout"], 5000,
            "Gemini timeouts are milliseconds"
        );
        assert!(
            gemini["hooks"]["BeforeTool"][0]["hooks"][0]["command"]
                .as_str()
                .unwrap()
                .ends_with(r#"hook gemini --bridge "/Users/me/Library/Application Support/app.playpets/bridge.json""#)
        );
        let cursor: Value = serde_json::from_str(&connection_snippet("cursor", exe, bridge, None).unwrap()).unwrap();
        assert_eq!(cursor["version"], 1);
        let ckeys: Vec<&String> = cursor["hooks"].as_object().unwrap().keys().collect();
        assert_eq!(
            ckeys,
            [
                "afterAgentThought",
                "postToolUse",
                "afterFileEdit",
                "afterShellExecution",
                "stop",
                "sessionEnd"
            ]
        );
        assert_eq!(cursor["hooks"]["stop"][0]["timeout"], 5, "Cursor timeouts are seconds");
        assert!(
            cursor["hooks"].get("beforeSubmitPrompt").is_none()
                && cursor["hooks"].get("beforeShellExecution").is_none()
        );
        assert!(connection_snippet("nope", exe, bridge, None).is_err());
    }
}
