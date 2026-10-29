//! The settings a coding agent needs to reach this app, ready to paste: every snippet points at
//! this app's own binary (`playpets hook …`, `playpets mcp`), so no Node.js is needed.
use crate::i18n;
use serde_json::{Map, Value, json};

// A turn that ends on an API error fires StopFailure instead of Stop.
const CLAUDE_EVENTS: [&str; 6] = [
    "UserPromptSubmit",
    "PreToolUse",
    "Notification",
    "Stop",
    "StopFailure",
    "SessionEnd",
];
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
// Every event `cli::hook_event` maps for Grok Build; a turn that fails or is cancelled ends
// without its Stop.
const GROK_EVENTS: [&str; 7] = [
    "UserPromptSubmit",
    "PreToolUse",
    "Notification",
    "Stop",
    "StopFailure",
    "StopCancelled",
    "SessionEnd",
];
// Kimi Code asks through PermissionRequest, and Esc ends a turn with Interrupt instead of Stop.
const KIMI_EVENTS: [&str; 7] = [
    "UserPromptSubmit",
    "PreToolUse",
    "PermissionRequest",
    "Stop",
    "StopFailure",
    "Interrupt",
    "SessionEnd",
];

/// The app binary itself serves hooks and MCP (agent/cli.rs), so snippets need no Node.js.
/// With `pet`, the agent reports to that friend instead of the first one.
pub fn connection_snippet(kind: &str, exe: &str, bridge_file: &str, pet: Option<&str>) -> Result<String, String> {
    let quote = |s: &str| Value::String(s.to_string()).to_string();
    let target = pet.map(|p| format!(" --pet {}", quote(p))).unwrap_or_default();
    match kind {
        // Qoder reads Claude Code's own settings shape, events and timeouts in seconds.
        "claude" | "qoder" => {
            let command = format!("{} hook {kind} --bridge {}{target}", quote(exe), quote(bridge_file));
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
        "grok" => {
            let command = format!("{} hook grok --bridge {}{target}", quote(exe), quote(bridge_file));
            let mut hooks = Map::new();
            for event in GROK_EVENTS {
                hooks.insert(
                    event.into(),
                    json!([{"hooks": [{"type": "command", "command": command, "timeout": 5}]}]),
                );
            }
            Ok(pretty(&json!({"hooks": Value::Object(hooks)})))
        }
        // Kimi Code refuses its whole config for any other key in a row, so a row has no marker:
        // PlayPets knows its own by the command. No matcher is every tool; timeouts are seconds.
        "kimi" => {
            let command = format!("{} hook kimi --bridge {}{target}", quote(exe), quote(bridge_file));
            Ok(KIMI_EVENTS
                .iter()
                .map(|event| {
                    format!(
                        "[[hooks]]\nevent = {}\ncommand = {}\ntimeout = 5\n",
                        quote(event),
                        quote(&command)
                    )
                })
                .collect::<Vec<_>>()
                .join("\n"))
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
        let exe = "/Applications/PlayPets.app/Contents/MacOS/playpets";
        let bridge = "/Users/me/Library/Application Support/app.playpets/bridge.json";
        let claude: Value = serde_json::from_str(&connection_snippet("claude", exe, bridge, None).unwrap()).unwrap();
        let keys: Vec<&String> = claude["hooks"].as_object().unwrap().keys().collect();
        assert_eq!(
            keys,
            [
                "UserPromptSubmit",
                "PreToolUse",
                "Notification",
                "Stop",
                "StopFailure",
                "SessionEnd"
            ]
        );
        assert_eq!(claude["hooks"]["PreToolUse"][0]["matcher"], "*");
        assert!(claude["hooks"]["Stop"][0].get("matcher").is_none());
        assert_eq!(
            claude["hooks"]["Stop"][0]["hooks"][0]["command"],
            r#""/Applications/PlayPets.app/Contents/MacOS/playpets" hook claude --bridge "/Users/me/Library/Application Support/app.playpets/bridge.json""#
        );
        assert_eq!(
            connection_snippet("codex", exe, bridge, None).unwrap(),
            r#"notify = ["/Applications/PlayPets.app/Contents/MacOS/playpets", "hook", "codex", "--bridge", "/Users/me/Library/Application Support/app.playpets/bridge.json"]"#
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

    #[test]
    fn qoder_takes_claude_codes_shape_and_kimi_code_takes_toml_rows() {
        let (exe, bridge) = ("/opt/playpets", "/data/bridge.json");
        let claude: Value = serde_json::from_str(&connection_snippet("claude", exe, bridge, None).unwrap()).unwrap();
        let qoder: Value = serde_json::from_str(&connection_snippet("qoder", exe, bridge, None).unwrap()).unwrap();
        assert_eq!(
            qoder["hooks"].as_object().unwrap().keys().collect::<Vec<_>>(),
            claude["hooks"].as_object().unwrap().keys().collect::<Vec<_>>()
        );
        assert_eq!(
            qoder["hooks"]["Stop"][0]["hooks"][0]["command"],
            r#""/opt/playpets" hook qoder --bridge "/data/bridge.json""#
        );
        let kimi: toml_edit::DocumentMut = connection_snippet("kimi", exe, bridge, Some("pet-1"))
            .unwrap()
            .parse()
            .unwrap();
        let rows = kimi["hooks"].as_array_of_tables().unwrap();
        assert_eq!(
            rows.iter().map(|r| r["event"].as_str().unwrap()).collect::<Vec<_>>(),
            [
                "UserPromptSubmit",
                "PreToolUse",
                "PermissionRequest",
                "Stop",
                "StopFailure",
                "Interrupt",
                "SessionEnd"
            ]
        );
        let row = rows.get(0).unwrap();
        assert_eq!(
            row.len(),
            3,
            "no matcher is every tool, and no key Kimi Code does not allow"
        );
        assert_eq!(row["timeout"].as_integer(), Some(5), "Kimi Code timeouts are seconds");
        assert_eq!(
            row["command"].as_str(),
            Some(r#""/opt/playpets" hook kimi --bridge "/data/bridge.json" --pet "pet-1""#)
        );
    }

    #[test]
    fn the_grok_build_snippet_is_a_hook_file_of_its_own() {
        let (exe, bridge) = ("/opt/playpets", "/data/bridge.json");
        let grok: Value = serde_json::from_str(&connection_snippet("grok", exe, bridge, None).unwrap()).unwrap();
        let keys: Vec<&String> = grok["hooks"].as_object().unwrap().keys().collect();
        assert_eq!(
            keys,
            [
                "UserPromptSubmit",
                "PreToolUse",
                "Notification",
                "Stop",
                "StopFailure",
                "StopCancelled",
                "SessionEnd"
            ]
        );
        let handler = &grok["hooks"]["PreToolUse"][0]["hooks"][0];
        assert_eq!(handler["type"], "command");
        assert_eq!(handler["timeout"], 5, "Grok Build timeouts are seconds");
        assert_eq!(
            handler["command"],
            r#""/opt/playpets" hook grok --bridge "/data/bridge.json""#
        );
        assert!(
            grok["hooks"]["PreToolUse"][0].get("matcher").is_none(),
            "no matcher is every tool"
        );
        let pinned: Value =
            serde_json::from_str(&connection_snippet("grok", exe, bridge, Some("pet-1")).unwrap()).unwrap();
        assert!(
            pinned["hooks"]["Stop"][0]["hooks"][0]["command"]
                .as_str()
                .unwrap()
                .ends_with(r#"--pet "pet-1""#)
        );
    }
}
