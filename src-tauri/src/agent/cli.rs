// Command-line mode of the app binary, so coding agents need no Node.js:
//   playpets pets | status <state> [msg] | say <msg> | react <action> | run -- <cmd...>
//   playpets hook claude|gemini|cursor   (hook; JSON on stdin)
//   playpets hook codex <json>           (Codex notify; JSON as last argument)
//   playpets mcp                         (MCP stdio server)
// Options: --pet <id or name> (default: first pet, or $PLAYPETS_PET), --bridge <bridge.json>
use serde_json::{Value, json};
use std::io::{BufRead, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::time::Duration;

/// Must equal `identifier` in tauri.conf.json: Tauri names the app data folder after it.
pub const APP_IDENTIFIER: &str = "app.playpets";

pub const COMMANDS: [&str; 7] = ["hook", "status", "say", "react", "pets", "run", "mcp"];

/// The command agents run to reach this app. Installed from an MSIX package the binary sits
/// under WindowsApps, which nothing outside the package may start by path; the package's
/// execution alias (packaging/windows/msix/AppxManifest.xml) starts it instead, inside the package, where it
/// sees the same data folder as the app.
pub fn agent_command(exe: &str, local_app_data: Option<&str>) -> String {
    let packaged = exe.to_ascii_lowercase().contains("\\windowsapps\\");
    match local_app_data.map(|base| base.trim_end_matches('\\')) {
        Some(base) if packaged && !base.is_empty() => format!("{base}\\Microsoft\\WindowsApps\\playpets.exe"),
        _ => exe.to_string(),
    }
}

pub fn is_cli(args: &[String]) -> bool {
    args.get(1).is_some_and(|a| COMMANDS.contains(&a.as_str()))
}

fn clip(value: Option<&Value>, max: usize) -> String {
    value
        .and_then(|v| v.as_str())
        .map(|s| s.trim().chars().take(max).collect())
        .unwrap_or_default()
}

/// Lifecycle payload → (state, message). Prompts and tool inputs are never forwarded.
/// Claude Code and Gemini CLI share the hook_event_name/tool_name shape; Cursor uses
/// camelCase event names; Codex passes a notify payload as an argument.
pub fn hook_event(agent: &str, payload: &Value) -> Option<(String, String)> {
    if !payload.is_object() {
        return None;
    }
    if agent == "codex" {
        if payload.get("type").and_then(|v| v.as_str()) != Some("agent-turn-complete") {
            return None;
        }
        let message = clip(payload.get("last-assistant-message"), 120);
        return Some(("done".into(), if message.is_empty() { "@done".into() } else { message }));
    }
    let tool_label = |fallback: &str| {
        let tool = clip(payload.get("tool_name"), 60);
        if tool.is_empty() {
            fallback.to_string()
        } else {
            format!("@tool {tool}")
        }
    };
    let event = payload.get("hook_event_name").and_then(|v| v.as_str())?;
    let (state, message) = match (agent, event) {
        ("claude", "UserPromptSubmit") | ("gemini", "BeforeAgent") | ("cursor", "afterAgentThought") => {
            ("working", "@thinking".to_string())
        }
        ("claude", "PreToolUse") | ("gemini", "BeforeTool") | ("cursor", "postToolUse") => {
            ("working", tool_label("@tool_any"))
        }
        ("cursor", "afterFileEdit") => ("working", "@editing".into()),
        ("cursor", "afterShellExecution") => ("working", "@command".into()),
        ("cursor", "subagentStart") => ("working", "@subtask".into()),
        ("claude", "Notification") | ("gemini", "Notification") => {
            let m = clip(payload.get("message"), 160);
            ("waiting", if m.is_empty() { "@confirm".into() } else { m })
        }
        ("claude", "Stop") | ("gemini", "AfterAgent") | ("cursor", "stop") => ("done", "@done".into()),
        ("claude", "SessionEnd") | ("gemini", "SessionEnd") | ("cursor", "sessionEnd") => ("idle", String::new()),
        _ => return None,
    };
    Some((state.into(), message))
}

/// Where the running app writes bridge.json: $PLAYPETS_BRIDGE, $PLAYPETS_DATA, or Tauri's app data dir.
pub fn default_bridge_file() -> PathBuf {
    if let Some(p) = std::env::var_os("PLAYPETS_BRIDGE").filter(|v| !v.is_empty()) {
        return PathBuf::from(p);
    }
    if let Some(p) = std::env::var_os("PLAYPETS_DATA").filter(|v| !v.is_empty()) {
        return PathBuf::from(p).join("bridge.json");
    }
    let home = || std::env::var_os("HOME").map(PathBuf::from).unwrap_or_default();
    let base = if cfg!(target_os = "macos") {
        home().join("Library/Application Support")
    } else if cfg!(windows) {
        std::env::var_os("APPDATA").map(PathBuf::from).unwrap_or_default()
    } else {
        std::env::var_os("XDG_DATA_HOME")
            .filter(|v| !v.is_empty())
            .map(PathBuf::from)
            .unwrap_or_else(|| home().join(".local/share"))
    };
    base.join(APP_IDENTIFIER).join("bridge.json")
}

pub fn request(file: &Path, route: &str, body: Option<Value>, timeout: Duration) -> Result<Value, String> {
    let link: Value = std::fs::read_to_string(file)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .ok_or("Start the PlayPets app first.")?;
    let port = link
        .get("port")
        .and_then(|v| v.as_u64())
        .filter(|p| (1..=65535).contains(p));
    let token = link.get("token").and_then(|v| v.as_str());
    let (Some(port), Some(token)) = (port, token) else {
        return Err("The bridge file is not valid. Start the PlayPets app again.".into());
    };
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(timeout))
        .build()
        .into();
    let url = format!("http://127.0.0.1:{port}{route}");
    let auth = format!("Bearer {token}");
    let sent = match &body {
        Some(b) => agent
            .post(&url)
            .header("Authorization", &auth)
            .header("Content-Type", "application/json")
            .send(b.to_string()),
        None => agent.get(&url).header("Authorization", &auth).call(),
    };
    match sent {
        Ok(mut resp) => resp
            .body_mut()
            .read_json::<Value>()
            .map_err(|_| "Could not read the reply from the PlayPets app.".into()),
        Err(ureq::Error::StatusCode(404)) if body.is_some() => {
            Err("Pet not found. Check the pet id or name shown in the app (pets command or list_pets).".into())
        }
        Err(ureq::Error::StatusCode(code)) => Err(format!("PlayPets connection error ({code})")),
        Err(_) => Err("Start the PlayPets app first.".into()),
    }
}

struct Parsed {
    positional: Vec<String>,
    command: Vec<String>,
    pet: String,
    bridge: PathBuf,
}

fn parse(args: &[String]) -> Parsed {
    let split = args.iter().position(|a| a == "--");
    let (head, command) = match split {
        Some(i) => (&args[..i], args[i + 1..].to_vec()),
        None => (args, Vec::new()),
    };
    let mut pet = std::env::var("PLAYPETS_PET").unwrap_or_default();
    let mut bridge = None;
    let mut positional = Vec::new();
    let mut i = 0;
    while i < head.len() {
        match head[i].as_str() {
            "--pet" if i + 1 < head.len() => {
                pet = head[i + 1].clone();
                i += 2;
            }
            "--bridge" if i + 1 < head.len() => {
                bridge = Some(PathBuf::from(&head[i + 1]));
                i += 2;
            }
            other => {
                positional.push(other.to_string());
                i += 1;
            }
        }
    }
    Parsed {
        positional,
        command,
        pet,
        bridge: bridge.unwrap_or_else(default_bridge_file),
    }
}

fn with_pet(mut body: Value, pet: &str) -> Value {
    if !pet.is_empty() {
        body["pet"] = json!(pet);
    }
    body
}

fn read_stdin(limit: usize, wait: Duration) -> String {
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let mut buf = Vec::new();
        let _ = std::io::stdin().take(limit as u64 + 1).read_to_end(&mut buf);
        let _ = tx.send(buf);
    });
    rx.recv_timeout(wait)
        .ok()
        .filter(|b| b.len() <= limit)
        .and_then(|b| String::from_utf8(b).ok())
        .unwrap_or_default()
}

fn attach_console() {
    // The app is a GUI-subsystem binary on Windows; borrow the terminal only when
    // nothing was redirected, so piped hooks and MCP keep their own handles.
    #[cfg(windows)]
    unsafe {
        use windows_sys::Win32::System::Console::{
            ATTACH_PARENT_PROCESS, AttachConsole, GetStdHandle, STD_OUTPUT_HANDLE,
        };
        let out = GetStdHandle(STD_OUTPUT_HANDLE);
        if out.is_null() || out == windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE {
            AttachConsole(ATTACH_PARENT_PROCESS);
        }
    }
}

type Send<'a> = &'a dyn Fn(&str, Value, Duration) -> Result<Value, String>;
const NORMAL: Duration = Duration::from_secs(3);

fn report(r: Result<Value, String>) -> i32 {
    match r {
        Ok(_) => 0,
        Err(e) => {
            eprintln!("[PlayPets] {e}");
            1
        }
    }
}

/// `hook <agent>`: runs inside the agent's loop, so it stays silent, stays fast and never fails it.
fn hook(rest: &[&str], send: Send) -> i32 {
    let agent = rest
        .first()
        .copied()
        .filter(|a| super::kinds::is_hook_agent(a))
        .unwrap_or("claude");
    let raw = if agent == "codex" {
        rest.last().map(|s| s.to_string()).unwrap_or_default()
    } else {
        read_stdin(1024 * 1024, Duration::from_secs(1))
    };
    let payload: Value = serde_json::from_str(&raw).unwrap_or(Value::Null);
    if let Some((state, message)) = hook_event(agent, &payload)
        && let Err(e) = send(
            "/events",
            json!({"state": state, "message": message}),
            Duration::from_millis(1500),
        )
        && std::env::var_os("PLAYPETS_DEBUG").is_some()
    {
        eprintln!("[PlayPets] {e}");
    }
    // Gemini CLI and Cursor parse stdout as JSON; Claude Code would show it to the model.
    if agent == "gemini" || agent == "cursor" {
        println!("{{}}");
    }
    0
}

/// `pets`: the friends in the yard, as JSON.
fn pets(bridge: &Path) -> i32 {
    match request(bridge, "/pets", None, NORMAL) {
        Ok(v) => {
            println!("{}", serde_json::to_string_pretty(&v).unwrap());
            0
        }
        Err(e) => report(Err(e)),
    }
}

/// `run -- <command…>`: the friend works while the command runs and reports how it ended; the
/// command's own exit code is handed back.
fn run_command(command: &[String], send: Send) -> i32 {
    let publish = |state: &str, message: String| {
        if let Err(e) = send("/events", json!({"state": state, "message": message}), NORMAL) {
            eprintln!("[PlayPets] {e}");
        }
    };
    publish("working", format!("@running {}", command[0]));
    let status = std::process::Command::new(&command[0]).args(&command[1..]).status();
    let code = match status {
        Ok(s) => s.code().unwrap_or(1),
        Err(e) => {
            eprintln!("{e}");
            1
        }
    };
    publish(
        if code == 0 { "done" } else { "error" },
        if code == 0 {
            "@done".into()
        } else {
            format!("@failed {code}")
        },
    );
    code
}

/// `mcp`: a stdio MCP server, one JSON-RPC line in, at most one out.
fn mcp(bridge: PathBuf) -> i32 {
    let call = move |route: &str, body: Option<Value>| request(&bridge, route, body, NORMAL);
    let stdin = std::io::stdin();
    let mut out = std::io::stdout();
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        if let Some(reply) = mcp_reply(&line, &call) {
            let _ = writeln!(out, "{reply}");
            let _ = out.flush();
        }
    }
    0
}

/// Runs a CLI command (`args` excludes the program name) and returns the exit code.
pub fn run(args: &[String]) -> i32 {
    attach_console();
    let p = parse(args);
    let rest: Vec<&str> = p.positional.iter().skip(1).map(String::as_str).collect();
    let send =
        |route: &str, body: Value, timeout: Duration| request(&p.bridge, route, Some(with_pet(body, &p.pet)), timeout);
    match p.positional.first().map(String::as_str) {
        Some("hook") => hook(&rest, &send),
        Some("pets") => pets(&p.bridge),
        Some("status") if !rest.is_empty() => report(send(
            "/events",
            json!({"state": rest[0], "message": rest[1..].join(" ")}),
            NORMAL,
        )),
        Some("say") if !rest.is_empty() => report(send("/say", json!({"message": rest.join(" ")}), NORMAL)),
        Some("react") if !rest.is_empty() => report(send("/react", json!({"action": rest[0]}), NORMAL)),
        Some("run") if !p.command.is_empty() => run_command(&p.command, &send),
        Some("mcp") => mcp(p.bridge.clone()),
        _ => {
            eprintln!("Usage: playpets <pets|status|say|react|run|hook|mcp> ... [--pet ID|NAME] [--bridge FILE]");
            2
        }
    }
}

fn mcp_tools() -> Value {
    let pet =
        json!({"type": "string", "description": "Pet instance id or name from list_pets. Omit to use the first pet."});
    json!([
        {"name": "list_pets", "description": "List active PlayPets instances with their current state.", "inputSchema": {"type": "object", "properties": {}, "additionalProperties": false}},
        {"name": "set_pet_state", "description": "Show your task status on a desktop pet. Report working when you start, waiting when you need the user, done on completion, error on failure, idle to reset.", "inputSchema": {"type": "object", "properties": {"pet": pet, "petId": {"type": "string", "description": "Alias of pet."}, "state": {"type": "string", "enum": ["idle", "working", "waiting", "done", "error"]}, "message": {"type": "string", "maxLength": 240}}, "required": ["state"], "additionalProperties": false}},
        {"name": "say", "description": "Show a short speech bubble on a pet without changing its state. Use for milestones the user would like to notice.", "inputSchema": {"type": "object", "properties": {"pet": pet, "message": {"type": "string", "minLength": 1, "maxLength": 240}}, "required": ["message"], "additionalProperties": false}},
        {"name": "react", "description": "Play a one-shot animation on a pet: wave to greet, jump to celebrate, pet for a happy wiggle.", "inputSchema": {"type": "object", "properties": {"pet": pet, "action": {"type": "string", "enum": ["wave", "jump", "pet"]}}, "required": ["action"], "additionalProperties": false}}
    ])
}

/// A request to the running app: the route, and a body when it is a POST.
type BridgeCall<'a> = &'a dyn Fn(&str, Option<Value>) -> Result<Value, String>;

/// One JSON-RPC line in, at most one line out (notifications get no reply).
pub fn mcp_reply(line: &str, call: BridgeCall) -> Option<String> {
    if line.len() > 65536 {
        return Some(
            json!({"jsonrpc": "2.0", "id": null, "error": {"code": -32600, "message": "Request too large"}})
                .to_string(),
        );
    }
    let Ok(message) = serde_json::from_str::<Value>(line) else {
        return Some(
            json!({"jsonrpc": "2.0", "id": null, "error": {"code": -32700, "message": "Parse error"}}).to_string(),
        );
    };
    let id = message.get("id").cloned()?;
    let result = match message.get("method").and_then(|v| v.as_str()).unwrap_or("") {
        "initialize" => {
            json!({"protocolVersion": "2024-11-05", "capabilities": {"tools": {}}, "serverInfo": {"name": "playpets", "version": env!("CARGO_PKG_VERSION")}})
        }
        "ping" => json!({}),
        "tools/list" => json!({"tools": mcp_tools()}),
        "tools/call" => {
            let params = message.get("params").cloned().unwrap_or(Value::Null);
            let name = params.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let args = params
                .get("arguments")
                .cloned()
                .filter(|a| a.is_object())
                .unwrap_or_else(|| json!({}));
            let route = match name {
                "list_pets" => Some("/pets"),
                "set_pet_state" => Some("/events"),
                "say" => Some("/say"),
                "react" => Some("/react"),
                _ => None,
            };
            let outcome = match route {
                None => Err("Unknown tool".to_string()),
                Some(route) => call(route, if name == "list_pets" { None } else { Some(args) }),
            };
            match outcome {
                Ok(v) => json!({"content": [{"type": "text", "text": v.to_string()}]}),
                Err(e) => json!({"isError": true, "content": [{"type": "text", "text": e}]}),
            }
        }
        _ => {
            return Some(
                json!({"jsonrpc": "2.0", "id": id, "error": {"code": -32601, "message": "Method not found"}})
                    .to_string(),
            );
        }
    };
    Some(json!({"jsonrpc": "2.0", "id": id, "result": result}).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent::bridge;
    use std::sync::{Arc, Mutex};

    fn strs(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn hook_payloads_become_states_and_never_carry_prompts() {
        let e = |a: &str, v: Value| hook_event(a, &v);
        assert_eq!(
            e(
                "claude",
                json!({"hook_event_name": "UserPromptSubmit", "prompt": "secret"})
            ),
            Some(("working".into(), "@thinking".into()))
        );
        assert_eq!(
            e("claude", json!({"hook_event_name": "PreToolUse", "tool_name": "Bash"})),
            Some(("working".into(), "@tool Bash".into()))
        );
        assert_eq!(
            e(
                "claude",
                json!({"hook_event_name": "Notification", "message": "Claude needs your permission to use Bash"})
            ),
            Some(("waiting".into(), "Claude needs your permission to use Bash".into()))
        );
        assert_eq!(
            e("claude", json!({"hook_event_name": "Stop"})),
            Some(("done".into(), "@done".into()))
        );
        assert_eq!(
            e("claude", json!({"hook_event_name": "SessionEnd"})),
            Some(("idle".into(), String::new()))
        );
        assert_eq!(e("claude", json!({"hook_event_name": "PostToolUse"})), None);
        assert_eq!(e("claude", Value::Null), None);
        assert_eq!(
            e(
                "codex",
                json!({"type": "agent-turn-complete", "last-assistant-message": "테스트를 모두 고쳤어요."})
            ),
            Some(("done".into(), "테스트를 모두 고쳤어요.".into()))
        );
        assert_eq!(
            e(
                "codex",
                json!({"type": "agent-turn-complete", "last-assistant-message": "a".repeat(300)})
            )
            .unwrap()
            .1
            .len(),
            120
        );
        assert_eq!(
            e("codex", json!({"type": "agent-turn-complete"})),
            Some(("done".into(), "@done".into()))
        );
        assert_eq!(e("codex", json!({"type": "other"})), None);
        assert_eq!(
            e("gemini", json!({"hook_event_name": "BeforeAgent", "prompt": "secret"})),
            Some(("working".into(), "@thinking".into()))
        );
        assert_eq!(
            e(
                "gemini",
                json!({"hook_event_name": "BeforeTool", "tool_name": "write_file"})
            ),
            Some(("working".into(), "@tool write_file".into()))
        );
        assert_eq!(
            e("gemini", json!({"hook_event_name": "AfterAgent"})),
            Some(("done".into(), "@done".into()))
        );
        assert_eq!(
            e("gemini", json!({"hook_event_name": "SessionEnd"})),
            Some(("idle".into(), String::new()))
        );
        assert_eq!(e("gemini", json!({"hook_event_name": "BeforeModel"})), None);
        assert_eq!(
            e("cursor", json!({"hook_event_name": "afterAgentThought"})),
            Some(("working".into(), "@thinking".into()))
        );
        assert_eq!(
            e(
                "cursor",
                json!({"hook_event_name": "afterFileEdit", "file_path": "/secret/x.rs"})
            ),
            Some(("working".into(), "@editing".into()))
        );
        assert_eq!(
            e(
                "cursor",
                json!({"hook_event_name": "afterShellExecution", "command": "rm -rf"})
            ),
            Some(("working".into(), "@command".into()))
        );
        assert_eq!(
            e("cursor", json!({"hook_event_name": "stop"})),
            Some(("done".into(), "@done".into()))
        );
        assert_eq!(
            e("cursor", json!({"hook_event_name": "beforeSubmitPrompt"})),
            None,
            "permission-style events are never wired"
        );
        assert_eq!(
            e("claude", json!({"hook_event_name": "BeforeAgent"})),
            None,
            "event names are per agent"
        );
    }

    #[test]
    fn data_folder_follows_the_bundle_identifier() {
        let conf: Value = serde_json::from_str(include_str!("../../tauri.conf.json")).unwrap();
        assert_eq!(
            conf["identifier"], APP_IDENTIFIER,
            "CLI must find bridge.json where the app writes it"
        );
    }

    #[test]
    fn a_packaged_app_is_reached_through_its_alias() {
        let packaged = r"C:\Program Files\WindowsApps\gaerae.PlayPets_0.1.0.0_x64__abc\playpets.exe";
        let local = Some(r"C:\Users\me\AppData\Local");
        assert_eq!(
            agent_command(packaged, local),
            r"C:\Users\me\AppData\Local\Microsoft\WindowsApps\playpets.exe"
        );
        assert_eq!(
            agent_command(packaged, None),
            packaged,
            "without the folder there is no alias to name"
        );
        let installed = r"C:\Users\me\AppData\Local\PlayPets\playpets.exe";
        assert_eq!(
            agent_command(installed, local),
            installed,
            "an installed or portable app is run where it is"
        );
        let mac = "/Applications/PlayPets.app/Contents/MacOS/playpets";
        assert_eq!(agent_command(mac, None), mac);
    }

    #[test]
    fn cli_mode_is_detected_only_for_known_commands() {
        assert!(is_cli(&strs(&["playpets", "hook", "claude"])));
        assert!(is_cli(&strs(&["playpets", "mcp"])));
        assert!(!is_cli(&strs(&["playpets"])));
        assert!(
            !is_cli(&strs(&["playpets", "-psn_0_12345"])),
            "macOS Finder launch argument"
        );
    }

    #[test]
    fn options_are_read_up_to_the_double_dash() {
        let p = parse(&strs(&[
            "run",
            "--pet",
            "Frieren",
            "--bridge",
            "/tmp/b.json",
            "--",
            "cargo",
            "--pet",
            "x",
        ]));
        assert_eq!(
            (p.positional, p.pet.as_str(), p.bridge),
            (strs(&["run"]), "Frieren", PathBuf::from("/tmp/b.json"))
        );
        assert_eq!(p.command, strs(&["cargo", "--pet", "x"]));
        let h = parse(&strs(&[
            "hook",
            "codex",
            "--bridge",
            "/b.json",
            r#"{"type":"agent-turn-complete"}"#,
        ]));
        assert_eq!(h.positional.last().unwrap(), r#"{"type":"agent-turn-complete"}"#);
    }

    #[test]
    fn mcp_lists_four_tools_and_routes_calls() {
        type Calls = Vec<(String, Option<Value>)>;
        let calls: Arc<Mutex<Calls>> = Arc::default();
        let c = calls.clone();
        let call = move |route: &str, body: Option<Value>| -> Result<Value, String> {
            c.lock().unwrap().push((route.to_string(), body.clone()));
            if body.as_ref().and_then(|b| b.get("action")).and_then(|a| a.as_str()) == Some("explode") {
                return Err("PlayPets connection error (400)".into());
            }
            Ok(json!({"ok": true}))
        };
        let reply = |line: &str| serde_json::from_str::<Value>(&mcp_reply(line, &call).unwrap()).unwrap();
        assert_eq!(
            reply(r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}"#)["result"]["serverInfo"]["name"],
            "playpets"
        );
        assert!(mcp_reply(r#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#, &call).is_none());
        let names: Vec<String> = reply(r#"{"jsonrpc":"2.0","id":2,"method":"tools/list"}"#)["result"]["tools"]
            .as_array()
            .unwrap()
            .iter()
            .map(|t| t["name"].as_str().unwrap().to_string())
            .collect();
        assert_eq!(names, ["list_pets", "set_pet_state", "say", "react"]);
        let ok = reply(
            r#"{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"say","arguments":{"pet":"Frieren","message":"다 됐어!"}}}"#,
        );
        assert!(ok["result"].get("isError").is_none());
        assert_eq!(
            calls.lock().unwrap().last().unwrap(),
            &(
                "/say".to_string(),
                Some(json!({"pet": "Frieren", "message": "다 됐어!"}))
            )
        );
        assert_eq!(
            reply(
                r#"{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"react","arguments":{"action":"explode"}}}"#
            )["result"]["isError"],
            true
        );
        assert_eq!(
            reply(r#"{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"nope"}}"#)["result"]["isError"],
            true
        );
        assert_eq!(reply("{")["error"]["code"], -32700);
        assert_eq!(
            reply(r#"{"jsonrpc":"2.0","id":6,"method":"bogus"}"#)["error"]["code"],
            -32601
        );
    }

    #[test]
    fn requests_reach_a_real_bridge_and_explain_failures() {
        let events: Arc<Mutex<Vec<bridge::AgentEvent>>> = Arc::default();
        let ev = events.clone();
        let b = bridge::start(
            "t0k".into(),
            Arc::new(|| json!([{"id": "p1", "name": "Mangu"}])),
            Arc::new(move |e| ev.lock().unwrap().push(e)),
        )
        .unwrap();
        let dir = std::env::temp_dir().join(format!("playpets-cli-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("bridge.json");
        std::fs::write(&file, json!({"port": b.port, "token": "t0k"}).to_string()).unwrap();
        let t = Duration::from_secs(2);
        assert!(request(&file, "/say", Some(json!({"message": "안녕!"})), t).is_ok());
        assert_eq!(
            events.lock().unwrap()[0],
            bridge::AgentEvent::Say {
                pet_id: "p1".into(),
                message: "안녕!".into()
            }
        );
        assert!(
            request(&file, "/events", Some(json!({"pet": "nobody", "state": "done"})), t)
                .unwrap_err()
                .contains("Pet not found")
        );
        assert_eq!(request(&file, "/pets", None, t).unwrap()[0]["name"], "Mangu");
        assert!(
            request(&dir.join("missing.json"), "/pets", None, t)
                .unwrap_err()
                .contains("Start the PlayPets app")
        );
        let _ = std::fs::remove_dir_all(&dir);
    }
}
