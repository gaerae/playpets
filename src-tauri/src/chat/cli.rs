// Subscription CLIs (Claude Code, Codex) as chat providers.
// claude: one long-lived `--input-format stream-json` child per pet.
// codex: one-shot `codex exec --output-last-message`.
use super::http::ANSWER_LIMIT;
use crate::i18n;
use serde_json::{Value, json};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::Receiver;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// How often a turn in progress looks at its cancel flag.
const CANCEL_POLL: Duration = Duration::from_millis(250);
const TURN_TIMEOUT: Duration = Duration::from_secs(120);
const IDLE_MAX: Duration = Duration::from_secs(600);
// The pet only talks, and as itself: no tools, and none of the person's own Claude Code setup
// (hooks, MCP servers, skills, settings). Left in, that setup made every start slower, fed the
// pet's own turns back to it as "agent activity", and had it answer "who are your friends?"
// with the list of agent sessions.
const CLAUDE_ISOLATION: [&str; 7] = [
    "--tools",
    "",
    "--strict-mcp-config",
    "--setting-sources",
    "",
    "--disable-slash-commands",
    "--no-session-persistence",
];
// The same for Codex: no config.toml (MCP servers, notify, hooks), nothing written to disk.
const CODEX_ISOLATION: [&str; 2] = ["--ephemeral", "--ignore-user-config"];

fn label(kind: &str) -> &'static str {
    super::kind::Kind::parse(kind)
        .and_then(super::kind::Kind::label)
        .unwrap_or("Codex CLI")
}
fn install(kind: &str) -> &'static str {
    if kind == "claude" {
        "npm install -g @anthropic-ai/claude-code"
    } else {
        "npm install -g @openai/codex"
    }
}
fn login_guide(kind: &str) -> String {
    if kind == "claude" {
        i18n::t("cli.login_claude")
    } else {
        i18n::t("cli.login_codex")
    }
}
fn missing(kind: &str) -> String {
    i18n::tr("cli.missing", &[("name", label(kind)), ("command", install(kind))])
}
fn needs_login(text: &str) -> bool {
    let t = text.to_lowercase();
    ["authenticat", "logged in", "log in", "login", "oauth", "api key"]
        .iter()
        .any(|k| t.contains(k))
}

fn extra_dirs() -> Vec<PathBuf> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_default();
    let h = PathBuf::from(home);
    let mut dirs = vec![
        "/opt/homebrew/bin".into(),
        "/usr/local/bin".into(),
        h.join(".local/bin"),
        h.join(".npm-global/bin"),
        h.join(".volta/bin"),
        h.join("bin"),
    ];
    // npm's global folder on Windows, where `npm install -g` puts claude.cmd and codex.cmd.
    if let Ok(appdata) = std::env::var("APPDATA") {
        dirs.push(PathBuf::from(appdata).join("npm"));
    }
    dirs
}

/// The script an npm `.cmd` shim runs, as the shim spells it relative to its own folder:
/// the `"%dp0%\…​.js"` argument, skipping `"%dp0%\node.exe"`.
pub fn shim_script(shim: &str) -> Option<String> {
    ["%dp0%\\", "%~dp0\\"]
        .iter()
        .flat_map(|marker| {
            shim.match_indices(marker)
                .map(move |(at, _)| &shim[at + marker.len()..])
        })
        .filter_map(|rest| rest.split('"').next())
        .find(|rel| rel.to_ascii_lowercase().ends_with(".js"))
        .map(str::to_string)
}

/// What to run for a CLI: the binary itself, or, for an npm `.cmd` shim on Windows, node and
/// the shim's script. Rust hands a batch file its arguments through cmd.exe and refuses any
/// with a newline in it, and the pet's system prompt is many lines; node takes them as they are,
/// and no console window comes with cmd.exe. A shim of another shape runs as it is.
fn launcher(bin: &Path) -> (PathBuf, Vec<PathBuf>) {
    let as_is = || (bin.to_path_buf(), Vec::new());
    let ext = bin.extension().and_then(|e| e.to_str()).unwrap_or_default();
    if !ext.eq_ignore_ascii_case("cmd") && !ext.eq_ignore_ascii_case("bat") {
        return as_is();
    }
    let dir = bin.parent().unwrap_or(Path::new("."));
    let Some(rel) = std::fs::read_to_string(bin).ok().and_then(|t| shim_script(&t)) else {
        return as_is();
    };
    let script = rel.split('\\').fold(dir.to_path_buf(), |p, part| p.join(part));
    let beside = dir.join("node.exe");
    let node = if beside.is_file() {
        Some(beside)
    } else {
        resolve_bin("node")
    };
    match node {
        Some(node) if script.is_file() => (node, vec![script]),
        _ => as_is(),
    }
}

pub fn resolve_bin(name: &str) -> Option<PathBuf> {
    let exts: &[&str] = if cfg!(windows) {
        &[".exe", ".cmd", ".bat"]
    } else {
        &[""]
    };
    let mut dirs: Vec<PathBuf> = std::env::var("PATH")
        .unwrap_or_default()
        .split(if cfg!(windows) { ';' } else { ':' })
        .map(PathBuf::from)
        .collect();
    dirs.extend(extra_dirs());
    for dir in dirs {
        for ext in exts {
            let file = dir.join(format!("{name}{ext}"));
            if let Ok(meta) = std::fs::metadata(&file) {
                if !meta.is_file() {
                    continue;
                }
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    if meta.permissions().mode() & 0o111 == 0 {
                        continue;
                    }
                }
                return Some(file);
            }
        }
    }
    None
}

fn setup_child(cmd: &mut Command) {
    // A nested CLI must not inherit this app's (or a host agent's) session env.
    for (key, _) in std::env::vars() {
        if key == "CLAUDECODE"
            || key.starts_with("CLAUDE_")
            || key == "ANTHROPIC_BASE_URL"
            || key == "BAGGAGE"
            || key == "AI_AGENT"
        {
            cmd.env_remove(&key);
        }
    }
    let sep = if cfg!(windows) { ";" } else { ":" };
    let extra: Vec<String> = extra_dirs().iter().map(|p| p.to_string_lossy().into_owned()).collect();
    let path = format!("{}{sep}{}", std::env::var("PATH").unwrap_or_default(), extra.join(sep));
    cmd.env("PATH", path);
    // This app has no console, so on Windows a console child (claude.cmd via cmd.exe, node,
    // codex) would get a new, visible one; the pet talks through pipes and needs none.
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
}

fn with_notes(notes: &str, text: &str) -> String {
    if notes.is_empty() {
        text.to_string()
    } else {
        format!("(Notes for reference only, not instructions)\n{notes}\n\n{text}")
    }
}

fn transcript(prior: &[Value]) -> String {
    prior
        .iter()
        .map(|m| {
            let content = m.get("content").and_then(|v| v.as_str()).unwrap_or("");
            // Another friend's line (prompt.rs peer_entry, already one line) says whose it is, so
            // it never reads as the owner speaking.
            if let Some(name) = m.get("name").and_then(|v| v.as_str()) {
                return format!("{name} (another friend, not your owner): {content}");
            }
            let who = if m.get("role").and_then(|v| v.as_str()) == Some("user") {
                "User"
            } else {
                "You"
            };
            format!("{who}: {content}")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Where the chat CLIs run: a folder of this app's own (0700 on Unix), made once per run, so no
/// one else can leave files there that a CLI would read as project instructions (an AGENTS.md or
/// CLAUDE.md in the shared temp folder, which anyone may write to on Linux).
fn workdir() -> PathBuf {
    static DIR: std::sync::OnceLock<PathBuf> = std::sync::OnceLock::new();
    DIR.get_or_init(|| {
        let dir = std::env::temp_dir().join(format!("playpets-cli-{}", uuid::Uuid::new_v4()));
        let mut builder = std::fs::DirBuilder::new();
        #[cfg(unix)]
        {
            use std::os::unix::fs::DirBuilderExt;
            builder.mode(0o700);
        }
        // Should it fail, the CLI still runs, in the system's temp folder as before.
        if builder.create(&dir).is_ok() {
            dir
        } else {
            std::env::temp_dir()
        }
    })
    .clone()
}

struct Session {
    /// Taken on drop, to be reaped away from whatever lock the dropper holds.
    child: Option<Child>,
    stdin: std::process::ChildStdin,
    rx: Receiver<Result<String, String>>,
    key: String,
    /// How many of the friend's history entries, counted from the start of the conversation,
    /// this session has seen (its own last answer included).
    seen: u64,
    last_used: Instant,
}

/// Where a message stands in a friend's conversation, for a CLI session that remembers it.
/// `total`: history entries so far, counted from the start (trimming the history does not lower
/// it). `in_history`: how many of the turns handed over are history entries (a message not yet
/// remembered may follow them). `adds`: entries this exchange will add (the question and the
/// answer, or just the answer when the question is already in the history).
#[derive(Clone, Copy, Debug)]
pub struct At {
    pub total: u64,
    pub in_history: usize,
    pub adds: u64,
}

/// What a live session missed since its last answer, or None when it cannot catch up and a
/// fresh session must be told the whole conversation. `turns` ends with the message to answer;
/// that message is sent as it is and is never part of what was missed.
fn missed(seen: u64, at: At, turns: &[Value]) -> Option<Vec<Value>> {
    let behind = usize::try_from(at.total.checked_sub(seen)?).ok()?;
    if behind > at.in_history {
        return None;
    }
    let history = &turns[..at.in_history.min(turns.len())];
    let mut gap: Vec<Value> = history[history.len() - behind..].to_vec();
    if at.in_history == turns.len() {
        gap.pop();
    }
    Some(gap)
}

impl Session {
    fn spawn(bin: &Path, model: &str, system: &str) -> Result<Session, String> {
        let (program, script) = launcher(bin);
        let mut cmd = Command::new(program);
        cmd.args(script)
            .args([
                "-p",
                "--input-format",
                "stream-json",
                "--output-format",
                "stream-json",
                "--verbose",
            ])
            .args(CLAUDE_ISOLATION);
        if !system.is_empty() {
            cmd.args(["--system-prompt", system]);
        }
        // As one `--model=<name>` argument, so a name the page sent that starts with "-" is never
        // read as an option of its own.
        if !model.is_empty() {
            cmd.arg(format!("--model={model}"));
        }
        setup_child(&mut cmd);
        // Errors arrive as `result` messages on stdout, so stderr is not read.
        cmd.current_dir(workdir())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        let mut child = cmd.spawn().map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                missing("claude")
            } else {
                i18n::tr(
                    "cli.spawn_failed",
                    &[("name", "Claude Code"), ("detail", &e.to_string())],
                )
            }
        })?;
        let stdin = child.stdin.take().unwrap();
        let stdout = child.stdout.take().unwrap();
        let (tx, rx) = std::sync::mpsc::channel::<Result<String, String>>();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines().map_while(Result::ok) {
                let Ok(msg) = serde_json::from_str::<Value>(&line) else {
                    continue;
                };
                if msg.get("type").and_then(|v| v.as_str()) != Some("result") {
                    continue;
                }
                let subtype = msg.get("subtype").and_then(|v| v.as_str()).unwrap_or("");
                let is_err = msg.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
                let result = msg.get("result").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let out = if subtype == "success" && !is_err {
                    Ok(result)
                } else {
                    let detail = if result.is_empty() { subtype.to_string() } else { result };
                    Err(if needs_login(&detail) {
                        login_guide("claude")
                    } else {
                        i18n::tr(
                            "cli.error",
                            &[
                                ("name", "Claude Code"),
                                ("detail", &detail.chars().take(160).collect::<String>()),
                            ],
                        )
                    })
                };
                if tx.send(out).is_err() {
                    break;
                }
            }
        });
        Ok(Session {
            child: Some(child),
            stdin,
            rx,
            key: String::new(),
            seen: 0,
            last_used: Instant::now(),
        })
    }

    /// One turn. The answer is waited for in short slices, so a cancel (the stop button) ends
    /// the turn within a moment by killing the process; so does the turn timeout.
    fn ask(&mut self, text: &str, cancel: &AtomicBool) -> Result<String, String> {
        self.last_used = Instant::now();
        let msg = json!({"type": "user", "message": {"role": "user", "content": [{"type": "text", "text": text}]}});
        writeln!(self.stdin, "{msg}").map_err(|_| i18n::tr("cli.exited", &[("name", "Claude Code")]))?;
        let started = Instant::now();
        let out = loop {
            match self.rx.recv_timeout(CANCEL_POLL) {
                Ok(r) => break r,
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    if cancel.load(Ordering::SeqCst) {
                        self.kill();
                        break Err(i18n::t("chat.cancelled"));
                    }
                    if started.elapsed() >= TURN_TIMEOUT {
                        self.kill();
                        break Err(i18n::t("cli.timeout"));
                    }
                }
                Err(_) => break Err(login_guide("claude")),
            }
        };
        self.last_used = Instant::now();
        out
    }

    fn kill(&mut self) {
        if let Some(child) = self.child.as_mut() {
            let _ = child.kill();
        }
    }
}

impl Drop for Session {
    fn drop(&mut self) {
        // Killed now and reaped on its own thread, so no finished CLI lingers as a zombie and
        // nobody holding the app's state lock (a reset) waits for the process to go.
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            std::thread::spawn(move || {
                let _ = child.wait();
            });
        }
    }
}

#[derive(Default)]
pub struct CliManager {
    sessions: Mutex<HashMap<String, Session>>,
}

impl CliManager {
    pub fn new() -> Arc<CliManager> {
        let m = Arc::new(CliManager::default());
        let weak = Arc::downgrade(&m);
        std::thread::spawn(move || {
            loop {
                std::thread::sleep(Duration::from_secs(60));
                let Some(m) = weak.upgrade() else { break };
                crate::app::hold(&m.sessions).retain(|_, s| s.last_used.elapsed() < IDLE_MAX);
            }
        });
        m
    }

    pub fn close(&self) {
        crate::app::hold(&self.sessions).clear();
    }

    pub fn reset(&self, pet_id: &str) {
        crate::app::hold(&self.sessions).remove(pet_id);
    }

    /// A turn in progress ends by its own flag (the one `chat` was given, which chat/mod.rs sets);
    /// an idle session goes too, so the next chat starts fresh.
    pub fn cancel(&self, pet_id: &str) {
        self.reset(pet_id);
    }

    /// `system` is who the pet is and starts the session; while it stays the same, so does the
    /// session. `notes` change from turn to turn and travel with the message instead.
    /// `turns` are the conversation so far, ending with the message to answer. `config` says
    /// which CLI (claude or codex) and model. `cancel` is the turn's flag: set at any point, from
    /// before the program has started to while it writes, the turn ends as cancelled.
    #[allow(clippy::too_many_arguments)]
    pub fn chat(
        &self,
        pet_id: &str,
        config: &super::http::Config,
        system: &str,
        notes: &str,
        turns: &[Value],
        at: At,
        cancel: &AtomicBool,
    ) -> Result<String, String> {
        let cancelled = || Err(i18n::t("chat.cancelled"));
        let (prior, current) = turns.split_at(turns.len().saturating_sub(1));
        let current = current
            .first()
            .filter(|m| m.get("role").and_then(|v| v.as_str()) == Some("user"))
            .ok_or_else(|| i18n::t("cli.nothing_to_send"))?;
        let text = with_notes(notes, current.get("content").and_then(|v| v.as_str()).unwrap_or(""));

        let model = config.model.as_str();
        if config.kind == super::kind::Kind::Codex {
            return self.codex(model, system, prior, &text, cancel);
        }

        let bin = resolve_bin("claude").ok_or_else(|| missing("claude"))?;
        let key = format!("{}|{}|{}", bin.display(), model, system);
        let mut taken = {
            let mut sessions = crate::app::hold(&self.sessions);
            sessions.remove(pet_id)
        };
        // A live session only needs what it missed (other friends' lines in a group chat);
        // one that cannot catch up is replaced and told the whole conversation.
        let gap = taken
            .as_ref()
            .filter(|s| s.key == key)
            .and_then(|s| missed(s.seen, at, turns));
        let mut ask_text = match &gap {
            Some(gap) if !gap.is_empty() => format!(
                "(Since your last reply)\n{}\n\n(Reply to the message just received)\n{text}",
                transcript(gap)
            ),
            _ => text.clone(),
        };
        if gap.is_none() {
            drop(taken.take());
            // Starting the program takes a while the first time: a stop pressed meanwhile counts.
            if cancel.load(Ordering::SeqCst) {
                return cancelled();
            }
            let mut fresh = Session::spawn(&bin, model, system)?;
            fresh.key = key.clone();
            if !prior.is_empty() {
                ask_text = format!(
                    "(Earlier conversation)\n{}\n\n(Reply to the message just received)\n{text}",
                    transcript(prior)
                );
            }
            taken = Some(fresh);
        }
        let mut session = taken.unwrap();
        if cancel.load(Ordering::SeqCst) {
            return cancelled();
        }
        let result = session.ask(&ask_text, cancel);
        if cancel.load(Ordering::SeqCst) {
            return cancelled();
        }
        match result {
            Ok(answer) => {
                session.seen = at.total + at.adds;
                crate::app::hold(&self.sessions).insert(pet_id.to_string(), session);
                Ok(answer.chars().take(ANSWER_LIMIT).collect())
            }
            Err(e) => Err(e), // session dropped → child killed
        }
    }

    fn codex(
        &self,
        model: &str,
        system: &str,
        prior: &[Value],
        text: &str,
        cancel: &AtomicBool,
    ) -> Result<String, String> {
        let bin = resolve_bin("codex").ok_or_else(|| missing("codex"))?;
        let mut parts = Vec::new();
        if !system.is_empty() {
            parts.push(system.to_string());
        }
        if !prior.is_empty() {
            parts.push(format!("(Earlier conversation)\n{}", transcript(prior)));
        }
        parts.push(format!("(Reply to the message just received)\n{text}"));
        let prompt = parts.join("\n\n");
        // A Codex too old to know the isolation options is asked to update rather than run
        // with the person's own config (MCP servers, network) loaded.
        self.codex_run(&bin, model, &prompt, cancel)
            .map_err(CodexError::message)
    }

    fn codex_run(&self, bin: &Path, model: &str, prompt: &str, cancel: &AtomicBool) -> Result<String, CodexError> {
        // The answer lands in a file only this user can read (the temp folder is shared on Linux).
        let out = workdir().join(format!("playpets-codex-{}.txt", uuid::Uuid::new_v4()));
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        if let Err(e) = options.open(&out) {
            return Err(CodexError::Failed(i18n::tr(
                "cli.spawn_failed",
                &[("name", "Codex"), ("detail", &e.to_string())],
            )));
        }
        let (program, script) = launcher(bin);
        let mut cmd = Command::new(program);
        cmd.args(script)
            .args(["exec", "--skip-git-repo-check", "--sandbox", "read-only"])
            .args(CODEX_ISOLATION);
        cmd.arg("--output-last-message").arg(&out);
        if !model.is_empty() {
            cmd.arg(format!("--model={model}"));
        }
        cmd.arg("-");
        setup_child(&mut cmd);
        cmd.current_dir(workdir())
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::piped());
        let mut child = cmd.spawn().map_err(|e| {
            CodexError::Failed(if e.kind() == std::io::ErrorKind::NotFound {
                missing("codex")
            } else {
                i18n::tr("cli.spawn_failed", &[("name", "Codex"), ("detail", &e.to_string())])
            })
        })?;
        let _ = child.stdin.take().unwrap().write_all(prompt.as_bytes());
        let mut stderr = child.stderr.take().unwrap();
        let errors = std::thread::spawn(move || {
            let mut s = String::new();
            let _ = stderr.read_to_string(&mut s);
            s
        });

        let deadline = Instant::now() + TURN_TIMEOUT;
        let finished = loop {
            match child.try_wait() {
                Ok(Some(status)) => break Ok(status),
                Ok(None) => {}
                Err(e) => break Err(e.to_string()),
            }
            if cancel.load(Ordering::SeqCst) {
                let _ = child.kill();
                break Err(i18n::t("chat.cancelled"));
            }
            if Instant::now() > deadline {
                let _ = child.kill();
                break Err(i18n::t("cli.timeout"));
            }
            std::thread::sleep(Duration::from_millis(50));
        };
        let answer = finished.map_err(CodexError::Failed).and_then(|status| {
            if !status.success() {
                return Err(codex_failure(
                    status.code().unwrap_or(-1),
                    &errors.join().unwrap_or_default(),
                ));
            }
            let answer = std::fs::read_to_string(&out).unwrap_or_default().trim().to_string();
            if answer.is_empty() {
                return Err(CodexError::Failed(i18n::t("cli.codex_empty")));
            }
            Ok(answer.chars().take(ANSWER_LIMIT).collect())
        });
        let _ = std::fs::remove_file(&out);
        answer
    }
}

enum CodexError {
    UnknownOption,
    Failed(String),
}

impl CodexError {
    fn message(self) -> String {
        match self {
            CodexError::UnknownOption => i18n::t("cli.codex_outdated"),
            CodexError::Failed(message) => message,
        }
    }
}

/// What went wrong, from what Codex printed: its own last ERROR line says it best
/// (a usage limit, for one), and the start of stderr is only a banner.
fn codex_failure(code: i32, stderr: &str) -> CodexError {
    if stderr.contains("unexpected argument") {
        return CodexError::UnknownOption;
    }
    if needs_login(stderr) {
        return CodexError::Failed(login_guide("codex"));
    }
    let line = stderr
        .lines()
        .rev()
        .map(str::trim)
        .find(|l| l.starts_with("ERROR"))
        .or_else(|| stderr.lines().rev().map(str::trim).find(|l| !l.is_empty()))
        .unwrap_or("");
    let detail: String = line.trim_start_matches("ERROR:").trim().chars().take(160).collect();
    CodexError::Failed(i18n::tr(
        "cli.codex_failed",
        &[("code", &code.to_string()), ("detail", &detail)],
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_live_session_is_kept_however_long_the_conversation_gets() {
        let turn = |role: &str, text: &str| json!({"role": role, "content": text});
        // One friend: the history is capped at a few entries, but the count from the start goes on.
        // After an exchange at total 30 the session has seen 32 entries; the next call starts there.
        let turns = vec![turn("user", "a"), turn("assistant", "b"), turn("user", "next")];
        let at = At {
            total: 32,
            in_history: 2,
            adds: 2,
        };
        assert_eq!(missed(32, at, &turns), Some(vec![]), "nothing missed, no restart");
        // Talking together: two lines came from others since this friend last spoke.
        let turns = vec![
            turn("assistant", "mine"),
            turn("user", "question"),
            turn("user", "[A] hello"),
        ];
        let at = At {
            total: 12,
            in_history: 3,
            adds: 1,
        };
        assert_eq!(
            missed(10, at, &turns),
            Some(vec![turn("user", "question")]),
            "the line to answer is sent as it is; only what came before it is caught up"
        );
        // Too far behind (more missed than the history still holds), or a history started over.
        assert_eq!(missed(1, at, &turns), None);
        assert_eq!(missed(20, at, &turns), None);
    }

    const NPM_SHIM: &str = "@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\n\r\nIF EXIST \"%dp0%\\node.exe\" (\r\n  SET \"_prog=%dp0%\\node.exe\"\r\n) ELSE (\r\n  SET \"_prog=node\"\r\n  SET PATHEXT=%PATHEXT:;.JS;=;%\r\n)\r\n\r\nendLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & \"%_prog%\"  \"%dp0%\\node_modules\\@anthropic-ai\\claude-code\\cli.js\" %*\r\n";

    #[test]
    fn an_npm_cmd_shim_names_its_script_and_not_node() {
        assert_eq!(
            shim_script(NPM_SHIM).as_deref(),
            Some("node_modules\\@anthropic-ai\\claude-code\\cli.js")
        );
        assert_eq!(
            shim_script("@echo off\r\n\"%~dp0\\..\\lib\\codex.js\" %*"),
            Some("..\\lib\\codex.js".into())
        );
        assert_eq!(
            shim_script("@echo off\r\nstart something.exe %*"),
            None,
            "not a node shim"
        );
    }

    #[test]
    fn a_cmd_shim_runs_as_node_plus_script_so_multiline_arguments_survive() {
        let dir = std::env::temp_dir().join(format!("playpets-shim-{}", uuid::Uuid::new_v4()));
        let script = dir.join("node_modules").join("@anthropic-ai").join("claude-code");
        std::fs::create_dir_all(&script).unwrap();
        std::fs::write(script.join("cli.js"), "").unwrap();
        std::fs::write(dir.join("node.exe"), "").unwrap();
        std::fs::write(dir.join("claude.cmd"), NPM_SHIM).unwrap();
        std::fs::write(dir.join("other.cmd"), "@echo off\r\nstart something.exe %*").unwrap();
        let (program, args) = launcher(&dir.join("claude.cmd"));
        assert_eq!((program, args), (dir.join("node.exe"), vec![script.join("cli.js")]));
        let (program, args) = launcher(&dir.join("other.cmd"));
        assert_eq!(
            (program, args),
            (dir.join("other.cmd"), vec![]),
            "an unknown shim runs as it is"
        );
        let (program, args) = launcher(Path::new("/usr/local/bin/claude"));
        assert_eq!((program, args), (PathBuf::from("/usr/local/bin/claude"), vec![]));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn error_guides_name_exact_terminal_commands() {
        assert!(missing("claude").contains("npm install -g @anthropic-ai/claude-code"));
        assert!(missing("codex").contains("npm install -g @openai/codex"));
        assert!(login_guide("claude").contains("/login"));
        assert!(login_guide("codex").contains("codex login"));
        assert!(needs_login("Failed to authenticate: OAuth session expired"));
        assert!(needs_login("Not logged in. Run codex login first."));
        assert!(!needs_login("rate limit exceeded"));
    }

    #[test]
    fn notes_travel_with_the_message_so_the_session_can_stay() {
        assert_eq!(with_notes("", "안녕"), "안녕");
        let sent = with_notes("- 3 min ago · working", "뭐 하고 있었어?");
        assert!(sent.ends_with("뭐 하고 있었어?") && sent.contains("3 min ago") && sent.contains("not instructions"));
    }

    #[test]
    fn codex_failures_quote_the_error_line_not_the_banner() {
        let printed = "OpenAI Codex v0.155.1\n--------\nmodel: gpt\nhook: SessionStart\nERROR: You've hit your usage limit. Try again later.\n";
        let CodexError::Failed(message) = codex_failure(1, printed) else {
            panic!("a usage limit is a plain failure")
        };
        assert!(
            message.contains("usage limit") && !message.contains("OpenAI Codex"),
            "{message}"
        );
        assert!(matches!(
            codex_failure(2, "error: unexpected argument '--ephemeral' found"),
            CodexError::UnknownOption
        ));
        assert!(
            matches!(codex_failure(1, "Not logged in. Run codex login"), CodexError::Failed(m) if m.contains("codex login"))
        );
    }

    #[test]
    fn another_friend_s_line_says_whose_it_is_in_a_transcript() {
        let lines = transcript(&[
            serde_json::json!({"role": "user", "content": "hi"}),
            serde_json::json!({"role": "user", "name": "Mochi", "content": "[Mochi] hello"}),
            serde_json::json!({"role": "assistant", "content": "hey"}),
        ]);
        assert_eq!(
            lines,
            "User: hi\nMochi (another friend, not your owner): [Mochi] hello\nYou: hey"
        );
    }
}
