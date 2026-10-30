// Command-line mode of the app binary, so coding agents need no Node.js:
//   playpets pets | status <state> [msg] | say <msg> | react <action> | run -- <cmd...>
//   playpets hook claude|gemini|cursor|grok|qoder|kimi   (hook; JSON on stdin)
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
    if agent == "grok" {
        return grok_event(event, payload);
    }
    if agent == "kimi" {
        return kimi_event(event, payload);
    }
    // Qoder names its events and payload fields as Claude Code does (docs.qoder.com/cli/hooks).
    let agent = if agent == "qoder" { "claude" } else { agent };
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
        ("claude", "Notification") if !claude_asks(payload) => return None,
        ("claude", "Notification") | ("gemini", "Notification") => {
            let m = clip(payload.get("message"), 160);
            ("waiting", if m.is_empty() { "@confirm".into() } else { m })
        }
        ("claude", "Stop") | ("gemini", "AfterAgent") | ("cursor", "stop") => ("done", "@done".into()),
        ("claude", "StopFailure") => (
            "error",
            failure_message(payload.get("error").and_then(|v| v.as_str())).into(),
        ),
        ("claude", "SessionEnd") | ("gemini", "SessionEnd") | ("cursor", "sessionEnd") => ("idle", String::new()),
        _ => return None,
    };
    Some((state.into(), message))
}

/// Grok Build names its events like Claude Code, but a turn can also end failed or cancelled,
/// the session's end fires an observe-only Stop of its own (a subagent's turn fires
/// SubagentStop), and only some notifications wait on the person. Its non-Claude keys are
/// camelCase (xai-grok-hooks event.rs).
fn grok_event(event: &str, payload: &Value) -> Option<(String, String)> {
    let field = |key: &str| payload.get(key).and_then(|v| v.as_str());
    // A subagent's turn ending is not the session's.
    let main_session = payload.get("subagentType").is_none();
    let (state, message) = match event {
        "UserPromptSubmit" if main_session => ("working", "@thinking".to_string()),
        "PreToolUse" => {
            let tool = clip(payload.get("tool_name"), 60);
            (
                "working",
                if tool.is_empty() {
                    "@tool_any".into()
                } else {
                    format!("@tool {tool}")
                },
            )
        }
        "Notification" if field("notificationType") == Some("permission_prompt") => {
            let m = clip(payload.get("message"), 160);
            ("waiting", if m.is_empty() { "@confirm".into() } else { m })
        }
        "Stop" if field("reason") == Some("end_turn") => ("done", "@done".into()),
        // The error is a kind (rate_limit, server_error, …), not an exit code like `@failed`'s.
        "StopFailure" if main_session => ("error", failure_message(field("error")).into()),
        "StopCancelled" | "SessionEnd" if main_session => ("idle", String::new()),
        _ => return None,
    };
    Some((state.into(), message))
}

/// Kimi Code asks the person through PermissionRequest (its Notification only tells of background
/// tasks), and a turn stopped with Esc fires Interrupt instead of Stop (kimi-code hooks.md). It
/// writes every payload key snake_case; its `error_type` is the error's class name, not a kind.
fn kimi_event(event: &str, payload: &Value) -> Option<(String, String)> {
    let (state, message) = match event {
        "UserPromptSubmit" => ("working", "@thinking".to_string()),
        "PreToolUse" => {
            let tool = clip(payload.get("tool_name"), 60);
            (
                "working",
                if tool.is_empty() {
                    "@tool_any".into()
                } else {
                    format!("@tool {tool}")
                },
            )
        }
        "PermissionRequest" => ("waiting", "@confirm".into()),
        "Stop" => ("done", "@done".into()),
        "StopFailure" => ("error", "@error".into()),
        "Interrupt" | "SessionEnd" => ("idle", String::new()),
        _ => return None,
    };
    Some((state.into(), message))
}

/// Whether a Claude Code notification waits on the person. It also says it is idle a minute after
/// every turn and tells of sign-ins and quotas; one without `notification_type` comes from a version
/// that only notified to ask.
fn claude_asks(payload: &Value) -> bool {
    match payload.get("notification_type").and_then(|v| v.as_str()) {
        None => true,
        Some(kind) => matches!(
            kind,
            "permission_prompt" | "elicitation_dialog" | "elicitation_url_dialog" | "agent_needs_input"
        ),
    }
}

/// A turn that ended on an API error, by its kind (Claude Code and Grok Build name them alike);
/// the error's own text never reaches the friend.
fn failure_message(error: Option<&str>) -> &'static str {
    match error {
        Some("rate_limit") => "@rate_limit",
        Some("authentication_failed" | "oauth_org_not_allowed") => "@sign_in",
        _ => "@error",
    }
}

/// Grok Build runs Claude Code's and Cursor's hook files too, and gives every hook it runs
/// `GROK_SESSION_ID`. Its own `hook grok` reports the session, so a hook it borrowed would show
/// Grok's work on that agent's friend. It borrows no other agent's file, and the variable also
/// reaches what Grok starts (its MCP servers), so the others still report.
fn borrowed_by_grok(agent: &str, grok_session: bool) -> bool {
    grok_session && matches!(agent, "claude" | "cursor")
}

/// Some turns end with no Stop at all (Claude Code stopped with Esc; Grok's cancel-and-send,
/// rewind or a finished `!` command); Grok's guide names `idle_prompt` as the backstop. It also
/// follows every finished turn, so it only settles a friend still left working and keeps a done
/// one done. Grok keys it camelCase, Claude Code snake_case.
fn settles_when_working(agent: &str, payload: &Value) -> bool {
    let key = match agent {
        "grok" => "notificationType",
        "claude" | "qoder" => "notification_type",
        _ => return false,
    };
    payload.get("hook_event_name").and_then(|v| v.as_str()) == Some("Notification")
        && payload.get(key).and_then(|v| v.as_str()) == Some("idle_prompt")
}

/// Whether the friend a hook reports to (`--pet`, or the first one) is working on the turn `by`
/// reported, by `/pets`. Another agent or session at work on the same friend, a chat answer on its
/// way or a status nobody named (MCP, `playpets status`) is left alone by this idle notice.
fn still_working(pets: &Value, pet: &str, by: &str) -> bool {
    let Some(id) = super::bridge::resolve_pet(pets, Some(pet)) else {
        return false;
    };
    pets.as_array()
        .and_then(|list| list.iter().find(|p| p.get("id").and_then(|v| v.as_str()) == Some(&id)))
        .is_some_and(|p| {
            p["state"] == "working"
                && p["source"] != "chat"
                && p["by"].as_str().is_some_and(|was| same_reporter(was, by))
        })
}

/// Whether an idle notice from `notice` settles a turn reported by `turn`: the same agent and
/// session, or a turn reported with no session named (the agent alone) settled by one of that
/// agent's sessions. A notice that names no session settles only a turn that named none, so it
/// never ends another session's turn on the same friend.
fn same_reporter(turn: &str, notice: &str) -> bool {
    turn == notice || notice.split_once(':').is_some_and(|(agent, _)| agent == turn)
}

/// Who a hook reports for: the agent, and its session when the payload names one (Claude Code and
/// Gemini `session_id`, Grok `sessionId`, Cursor `conversation_id`).
fn reporter(agent: &str, payload: &Value) -> String {
    let session = ["session_id", "sessionId", "conversation_id"]
        .iter()
        .find_map(|key| payload.get(*key).and_then(|v| v.as_str()))
        .filter(|s| !s.is_empty());
    let by = match session {
        Some(session) => format!("{agent}:{session}"),
        None => agent.to_string(),
    };
    by.chars().take(80).collect()
}

/// The `/events` body a hook sends, if any: `borrowed` is a hook Grok ran from another agent's file.
fn hook_report(
    agent: &str,
    payload: &Value,
    borrowed: bool,
    pet: &str,
    pets: &dyn Fn() -> Result<Value, String>,
) -> Option<Value> {
    if borrowed {
        return None;
    }
    let by = reporter(agent, payload);
    let (state, message) = if settles_when_working(agent, payload) {
        pets()
            .is_ok_and(|list| still_working(&list, pet, &by))
            .then(|| ("idle".to_string(), String::new()))?
    } else {
        hook_event(agent, payload)?
    };
    Some(json!({"state": state, "message": message, "by": by}))
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

pub(super) type Send<'a> = &'a dyn Fn(&str, Value, Duration) -> Result<Value, String>;
pub(super) const NORMAL: Duration = Duration::from_secs(3);

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
fn hook(rest: &[&str], send: Send, pets: &dyn Fn() -> Result<Value, String>, pet: &str) -> i32 {
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
    let borrowed = borrowed_by_grok(agent, std::env::var_os("GROK_SESSION_ID").is_some());
    if let Some(body) = hook_report(agent, &payload, borrowed, pet, pets)
        && let Err(e) = send("/events", body, Duration::from_millis(1500))
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
        Some("hook") => hook(
            &rest,
            &send,
            &|| request(&p.bridge, "/pets", None, Duration::from_millis(1500)),
            &p.pet,
        ),
        Some("pets") => pets(&p.bridge),
        Some("status") if !rest.is_empty() => report(send(
            "/events",
            json!({"state": rest[0], "message": rest[1..].join(" ")}),
            NORMAL,
        )),
        Some("say") if !rest.is_empty() => report(send("/say", json!({"message": rest.join(" ")}), NORMAL)),
        Some("react") if !rest.is_empty() => report(send("/react", json!({"action": rest[0]}), NORMAL)),
        Some("run") if !p.command.is_empty() => super::run::run_command(&p.command, &send),
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
    fn qoder_reports_as_claude_code_and_kimi_code_asks_through_permission_requests() {
        let e = |a: &str, v: Value| hook_event(a, &v);
        for event in [
            json!({"hook_event_name": "UserPromptSubmit", "prompt": "secret"}),
            json!({"hook_event_name": "PreToolUse", "tool_name": "Bash", "tool_input": {"command": "rm"}}),
            json!({"hook_event_name": "Notification", "notification_type": "permission_prompt", "message": "Allow?"}),
            json!({"hook_event_name": "Notification", "notification_type": "idle_prompt"}),
            json!({"hook_event_name": "Stop"}),
            json!({"hook_event_name": "StopFailure", "error_type": "rate_limit"}),
            json!({"hook_event_name": "SessionEnd"}),
        ] {
            assert_eq!(e("qoder", event.clone()), e("claude", event.clone()), "{event}");
        }
        let idle = json!({"hook_event_name": "Notification", "notification_type": "idle_prompt"});
        assert!(settles_when_working("qoder", &idle));

        assert_eq!(
            e(
                "kimi",
                json!({"hook_event_name": "UserPromptSubmit", "prompt": "secret"})
            ),
            Some(("working".into(), "@thinking".into()))
        );
        assert_eq!(
            e(
                "kimi",
                json!({"hook_event_name": "PreToolUse", "tool_name": "Shell", "tool_input": {}})
            ),
            Some(("working".into(), "@tool Shell".into()))
        );
        assert_eq!(
            e(
                "kimi",
                json!({"hook_event_name": "PermissionRequest", "tool_name": "Shell"})
            ),
            Some(("waiting".into(), "@confirm".into()))
        );
        assert_eq!(
            e(
                "kimi",
                json!({"hook_event_name": "Notification", "type": "task.completed"})
            ),
            None,
            "Kimi Code's notifications tell of background tasks, not of waiting"
        );
        assert_eq!(
            e("kimi", json!({"hook_event_name": "Stop"})),
            Some(("done".into(), "@done".into()))
        );
        assert_eq!(
            e(
                "kimi",
                json!({"hook_event_name": "StopFailure", "error_type": "ChatProviderError", "error_message": "slow down"})
            ),
            Some(("error".into(), "@error".into())),
            "the error's own text never reaches the friend"
        );
        for event in ["Interrupt", "SessionEnd"] {
            assert_eq!(
                e("kimi", json!({"hook_event_name": event})),
                Some(("idle".into(), String::new())),
                "{event}"
            );
        }
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
            Some(("waiting".into(), "Claude needs your permission to use Bash".into())),
            "a Claude Code without notification_type only notified to ask"
        );
        for asks in [
            "permission_prompt",
            "elicitation_dialog",
            "elicitation_url_dialog",
            "agent_needs_input",
        ] {
            assert_eq!(
                e(
                    "claude",
                    json!({"hook_event_name": "Notification", "notification_type": asks, "message": "Claude needs you"})
                ),
                Some(("waiting".into(), "Claude needs you".into())),
                "{asks}"
            );
        }
        // Claude Code says it is idle a minute after every turn, and tells of sign-ins and quotas;
        // none of them waits on the person.
        for tells in [
            "idle_prompt",
            "auth_success",
            "agent_completed",
            "quota_auto_resume_fired",
        ] {
            assert_eq!(
                e(
                    "claude",
                    json!({"hook_event_name": "Notification", "notification_type": tells, "message": "Claude is waiting for your input"})
                ),
                None,
                "{tells}"
            );
        }
        assert_eq!(
            e("claude", json!({"hook_event_name": "Stop"})),
            Some(("done".into(), "@done".into()))
        );
        assert_eq!(
            e(
                "claude",
                json!({"hook_event_name": "StopFailure", "error": "rate_limit", "error_details": "429", "last_assistant_message": "API Error: Rate limit reached"})
            ),
            Some(("error".into(), "@rate_limit".into()))
        );
        assert_eq!(
            e(
                "claude",
                json!({"hook_event_name": "StopFailure", "error": "authentication_failed"})
            ),
            Some(("error".into(), "@sign_in".into()))
        );
        assert_eq!(
            e(
                "claude",
                json!({"hook_event_name": "StopFailure", "error": "oauth_org_not_allowed"})
            ),
            Some(("error".into(), "@sign_in".into()))
        );
        assert_eq!(
            e(
                "claude",
                json!({"hook_event_name": "StopFailure", "error": "overloaded"})
            ),
            Some(("error".into(), "@error".into())),
            "the error text itself is never shown"
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
    fn grok_build_payloads_become_states_and_only_the_main_session_ends_a_turn() {
        // Grok Build (xai-grok-hooks event.rs) sends Claude's PascalCase `hook_event_name` and
        // `tool_name`, and keeps its other keys camelCase.
        let e = |v: Value| hook_event("grok", &v);
        assert_eq!(
            e(json!({"hook_event_name": "UserPromptSubmit", "prompt": "secret"})),
            Some(("working".into(), "@thinking".into()))
        );
        assert_eq!(
            e(
                json!({"hook_event_name": "PreToolUse", "tool_name": "run_terminal_command", "tool_input": {"command": "rm -rf"}})
            ),
            Some(("working".into(), "@tool run_terminal_command".into()))
        );
        assert_eq!(
            e(json!({"hook_event_name": "PreToolUse", "tool_name": "read_file", "subagentType": "explore"})),
            Some(("working".into(), "@tool read_file".into())),
            "a subagent's tools are still the agent at work"
        );
        assert_eq!(
            e(
                json!({"hook_event_name": "Notification", "notificationType": "permission_prompt", "message": "Allow run_terminal_command?"})
            ),
            Some(("waiting".into(), "Allow run_terminal_command?".into()))
        );
        assert_eq!(
            e(json!({"hook_event_name": "Notification", "notificationType": "permission_prompt"})),
            Some(("waiting".into(), "@confirm".into()))
        );
        assert_eq!(
            e(
                json!({"hook_event_name": "Notification", "notificationType": "idle_prompt", "message": "Waiting for your next prompt"})
            ),
            None,
            "idle is not a question; `settles_when_working` handles it"
        );
        assert_eq!(
            e(json!({"hook_event_name": "Stop", "reason": "end_turn", "lastAssistantMessage": "secret"})),
            Some(("done".into(), "@done".into()))
        );
        assert_eq!(
            e(json!({"hook_event_name": "Stop", "reason": "session_end"})),
            None,
            "the observe-only Stop at session end is not a finished task"
        );
        // Grok's error is a word, not an exit code: the person reads what it means.
        assert_eq!(
            e(json!({"hook_event_name": "StopFailure", "error": "rate_limit", "errorDetails": "secret"})),
            Some(("error".into(), "@rate_limit".into()))
        );
        assert_eq!(
            e(json!({"hook_event_name": "StopFailure", "error": "authentication_failed"})),
            Some(("error".into(), "@sign_in".into()))
        );
        for error in [json!("server_error"), json!(""), Value::Null] {
            assert_eq!(
                e(json!({"hook_event_name": "StopFailure", "error": error})),
                Some(("error".into(), "@error".into())),
                "{error}"
            );
        }
        assert_eq!(
            e(json!({"hook_event_name": "StopCancelled", "reason": "user_interrupt"})),
            Some(("idle".into(), String::new()))
        );
        assert_eq!(
            e(json!({"hook_event_name": "SessionEnd", "reason": "exit"})),
            Some(("idle".into(), String::new()))
        );
        for event in ["StopFailure", "StopCancelled", "SessionEnd", "UserPromptSubmit"] {
            assert_eq!(
                e(json!({"hook_event_name": event, "error": "unknown", "subagentType": "explore"})),
                None,
                "{event} from a subagent leaves the main session's state alone"
            );
        }
        assert_eq!(
            e(json!({"hook_event_name": "PostToolUse", "tool_name": "read_file"})),
            None
        );
        assert_eq!(e(json!({"hook_event_name": "SessionStart", "source": "startup"})), None);
        assert_eq!(
            hook_event(
                "gemini",
                &json!({"hook_event_name": "StopFailure", "error": "rate_limit"})
            ),
            None,
            "event names are per agent"
        );
    }

    #[test]
    fn hooks_grok_build_borrows_from_other_agents_report_nothing() {
        // Grok Build also runs the hooks in ~/.claude/settings.json and ~/.cursor/hooks.json; its
        // own `hook grok` reports the session, so a borrowed one would show it on the wrong friend.
        assert!(borrowed_by_grok("claude", true));
        assert!(borrowed_by_grok("cursor", true));
        assert!(!borrowed_by_grok("grok", true));
        assert!(!borrowed_by_grok("claude", false));
        // It borrows no other agent's file; one that inherited the variable still reports.
        assert!(!borrowed_by_grok("gemini", true));
        assert!(!borrowed_by_grok("codex", true));
    }

    #[test]
    fn grok_idle_settles_a_friend_left_working_but_keeps_a_finished_one() {
        // Some turns end without Stop (cancel-and-send, rewind, a finished `!` command); Grok's
        // guide names idle_prompt as the backstop, and it also follows every finished turn.
        let idle = json!({"hook_event_name": "Notification", "notificationType": "idle_prompt"});
        assert!(settles_when_working("grok", &idle));
        assert!(
            !settles_when_working("claude", &idle),
            "Claude Code's key is snake_case"
        );
        // A Claude Code turn stopped with Esc fires no Stop, so its idle notice settles it too.
        let claude_idle = json!({"hook_event_name": "Notification", "notification_type": "idle_prompt"});
        assert!(settles_when_working("claude", &claude_idle));
        assert!(
            !settles_when_working("gemini", &claude_idle),
            "event names are per agent"
        );
        assert!(!settles_when_working(
            "claude",
            &json!({"hook_event_name": "Notification", "notification_type": "permission_prompt"})
        ));
        assert!(!settles_when_working(
            "grok",
            &json!({"hook_event_name": "Notification", "notificationType": "permission_prompt"})
        ));
        let pets = json!([
            {"id": "p1", "name": "Clover", "state": "working", "by": "grok"},
            {"id": "p2", "name": "Pip", "state": "done", "by": "grok"},
            {"id": "p3", "name": "Miso", "state": "waiting", "by": "grok"},
            {"id": "p4", "name": "Daisy", "state": "working", "source": "chat"}
        ]);
        assert!(still_working(&pets, "", "grok"), "no --pet is the first friend");
        assert!(
            !still_working(&pets, "Daisy", "grok"),
            "a chat answer on its way is not the agent's turn"
        );
        assert!(still_working(&pets, "clover", "grok"));
        assert!(!still_working(&pets, "Pip", "grok"), "done stays done until it fades");
        assert!(!still_working(&pets, "p3", "grok"));
        assert!(!still_working(&pets, "nobody", "grok"));
        assert!(!still_working(&json!({"error": "x"}), "", "grok"));
        // A turn reported with no session is settled by that agent's session; a notice with no
        // session settles only such a turn, never a named session's (another may be working).
        let pets = json!([{"id": "p1", "name": "Clover", "state": "working", "by": "grok"}]);
        assert!(still_working(&pets, "", "grok:s1"));
        assert!(still_working(&pets, "", "grok"));
        assert!(!still_working(&pets, "", "claude:s1"));
        let pets = json!([{"id": "p1", "name": "Clover", "state": "working", "by": "grok:s1"}]);
        assert!(still_working(&pets, "", "grok:s1"));
        assert!(!still_working(&pets, "", "grok"));
        assert!(!still_working(&pets, "", "grok:s2"));
    }

    #[test]
    fn an_idle_notice_settles_only_the_turn_its_own_session_left() {
        let idle = json!({"hook_event_name": "Notification", "notification_type": "idle_prompt", "session_id": "a1"});
        assert_eq!(reporter("claude", &idle), "claude:a1");
        assert_eq!(reporter("grok", &json!({"sessionId": "g"})), "grok:g");
        assert_eq!(
            reporter("codex", &Value::Null),
            "codex",
            "no session named: the agent alone"
        );
        assert_eq!(reporter("claude", &json!({"session_id": "x".repeat(200)})).len(), 80);
        let pets = |by: &str| Ok(json!([{"id": "p1", "name": "Clover", "state": "working", "by": by}]));
        let settle = |by: &str| hook_report("claude", &idle, false, "", &|| pets(by));
        assert_eq!(
            settle("claude:a1"),
            Some(json!({"state": "idle", "message": "", "by": "claude:a1"}))
        );
        assert_eq!(settle("codex"), None, "Codex is still at work on the same friend");
        assert_eq!(
            settle("claude:b2"),
            None,
            "another Claude Code session is still at work"
        );
        assert_eq!(
            settle(""),
            None,
            "a status nobody named (MCP, `playpets status`) is left alone"
        );
        // Every report says who sent it, so a later idle notice can tell its own turn.
        let tool = json!({"hook_event_name": "PreToolUse", "tool_name": "Bash", "session_id": "a1"});
        assert_eq!(
            hook_report("claude", &tool, false, "", &|| unreachable!()),
            Some(json!({"state": "working", "message": "@tool Bash", "by": "claude:a1"}))
        );
        assert_eq!(
            hook_report("claude", &tool, true, "", &|| unreachable!()),
            None,
            "borrowed by Grok"
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
