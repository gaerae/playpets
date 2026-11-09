// What a coding agent's hook payload means for the friend who does its work: a state and a short
// message, never the prompt or a tool's input. Run inside the agent's loop by `playpets hook`.
use serde_json::{Value, json};

fn clip(value: Option<&Value>, max: usize) -> String {
    value
        .and_then(|v| v.as_str())
        .map(|s| s.trim().chars().take(max).collect())
        .unwrap_or_default()
}

/// The tool an agent is about to use, as the friend says it, or "a tool" when it names none.
fn tool_label(payload: &Value) -> String {
    let tool = clip(payload.get("tool_name"), 60);
    if tool.is_empty() {
        "@tool_any".into()
    } else {
        format!("@tool {tool}")
    }
}

/// What the agent asks the person, or the plain "confirm" line when its notice carries no text.
fn asks(payload: &Value) -> String {
    let message = clip(payload.get("message"), 160);
    if message.is_empty() { "@confirm".into() } else { message }
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
            ("working", tool_label(payload))
        }
        ("cursor", "afterFileEdit") => ("working", "@editing".into()),
        ("cursor", "afterShellExecution") => ("working", "@command".into()),
        ("cursor", "subagentStart") => ("working", "@subtask".into()),
        ("claude", "Notification") if !claude_asks(payload) => return None,
        ("claude", "Notification") | ("gemini", "Notification") => ("waiting", asks(payload)),
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
        "PreToolUse" => ("working", tool_label(payload)),
        "Notification" if field("notificationType") == Some("permission_prompt") => ("waiting", asks(payload)),
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
        "PreToolUse" => ("working", tool_label(payload)),
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
pub(super) fn borrowed_by_grok(agent: &str, grok_session: bool) -> bool {
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
pub(super) fn hook_report(
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

#[cfg(test)]
mod tests {
    use super::*;

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
}
