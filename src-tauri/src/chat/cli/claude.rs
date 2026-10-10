// Claude Code: one long-lived `--input-format stream-json` child per friend, told who it is once
// and then sent each message as it comes.
use super::*;

/// How much of the end of Claude Code's stderr is kept to say why it quit.
const STDERR_TAIL: usize = 4096;
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

pub(super) struct Session {
    /// Taken on drop, to be reaped away from whatever lock the dropper holds.
    child: Option<Child>,
    stdin: std::process::ChildStdin,
    rx: Receiver<Result<String, String>>,
    /// The end of the CLI's stderr, for why it quit (`claude_quit`).
    stderr: Arc<Mutex<String>>,
    /// The system prompt's file, removed with the session.
    _prompt: Option<TempFile>,
    pub(super) key: String,
    /// How many of the friend's history entries, counted from the start of the conversation,
    /// this session has seen (its own last answer included).
    pub(super) seen: u64,
    pub(super) last_used: Instant,
}

impl Session {
    pub(super) fn spawn(bin: &Path, model: &str, system: &str) -> Result<Session, String> {
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
        let prompt = if system.is_empty() { None } else { prompt_file(system) };
        if let Some(file) = &prompt {
            cmd.arg("--system-prompt-file").arg(&file.0);
        } else if !system.is_empty() {
            cmd.args(["--system-prompt", system]);
        }
        // As one `--model=<name>` argument, so a name the page sent that starts with "-" is never
        // read as an option of its own.
        if !model.is_empty() {
            cmd.arg(format!("--model={model}"));
        }
        setup_child(&mut cmd);
        // Errors in a turn arrive as `result` messages on stdout; stderr only says why the CLI
        // quit before it could answer (an option this version does not know, say).
        cmd.current_dir(workdir())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
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
        // The end of what it printed to stderr, read all along so the pipe never fills.
        let stderr = Arc::new(Mutex::new(String::new()));
        if let Some(mut pipe) = child.stderr.take() {
            let tail = stderr.clone();
            std::thread::spawn(move || {
                let mut buf = [0u8; 1024];
                while let Ok(n) = pipe.read(&mut buf) {
                    if n == 0 {
                        break;
                    }
                    let mut t = crate::app::hold(&tail);
                    t.push_str(&String::from_utf8_lossy(&buf[..n]));
                    let extra = t.len().saturating_sub(STDERR_TAIL);
                    if extra > 0 {
                        let cut = (extra..=t.len()).find(|&i| t.is_char_boundary(i)).unwrap_or(t.len());
                        t.drain(..cut);
                    }
                }
            });
        }
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
            stderr,
            _prompt: prompt,
            key: String::new(),
            seen: 0,
            last_used: Instant::now(),
        })
    }

    /// One turn. The answer is waited for in short slices, so a cancel (the stop button) ends
    /// the turn within a moment by killing the process; so does the turn timeout.
    pub(super) fn ask(&mut self, text: &str, cancel: &AtomicBool) -> Result<String, String> {
        self.last_used = Instant::now();
        let msg = json!({"type": "user", "message": {"role": "user", "content": [{"type": "text", "text": text}]}});
        if writeln!(self.stdin, "{msg}").is_err() {
            return Err(self.why_quit());
        }
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
                Err(_) => break Err(self.why_quit()),
            }
        };
        self.last_used = Instant::now();
        out
    }

    /// The CLI quit without an answer: what it said on its way out, read a moment after (the
    /// stderr reader may still be catching up).
    fn why_quit(&self) -> String {
        std::thread::sleep(Duration::from_millis(100));
        claude_quit(&crate::app::hold(&self.stderr))
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

/// Why Claude Code quit before answering, from the end of its stderr: an option this version does
/// not know means it is too old; a word about signing in means that; anything else is quoted; and
/// with nothing said, signing in is the usual reason.
fn claude_quit(stderr: &str) -> String {
    if stderr.contains("unknown option") {
        return i18n::t("cli.claude_outdated");
    }
    let line = stderr
        .lines()
        .rev()
        .map(str::trim)
        .find(|l| !l.is_empty())
        .unwrap_or("");
    if line.is_empty() || needs_login(stderr) {
        return login_guide("claude");
    }
    i18n::tr(
        "cli.error",
        &[
            ("name", "Claude Code"),
            ("detail", &line.chars().take(160).collect::<String>()),
        ],
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_claude_code_that_quit_says_why() {
        assert_eq!(
            claude_quit("error: unknown option '--system-prompt-file'"),
            i18n::t("cli.claude_outdated")
        );
        assert_eq!(
            claude_quit(""),
            login_guide("claude"),
            "nothing said: most often not signed in"
        );
        assert_eq!(
            claude_quit("Invalid API key · Please run /login"),
            login_guide("claude")
        );
        let other = claude_quit("warming up\nError: disk full\n");
        assert!(other.contains("disk full") && !other.contains("warming"), "{other}");
    }

    #[cfg(unix)]
    #[test]
    fn an_old_claude_code_that_refuses_an_option_is_told_to_update() {
        use std::os::unix::fs::PermissionsExt;
        let bin = private_dir()
            .unwrap()
            .join(format!("old-claude-{}", uuid::Uuid::new_v4()));
        std::fs::write(
            &bin,
            "#!/bin/sh\necho \"error: unknown option '--system-prompt-file'\" >&2\nexit 1\n",
        )
        .unwrap();
        std::fs::set_permissions(&bin, std::fs::Permissions::from_mode(0o700)).unwrap();
        let mut session = Session::spawn(&bin, "", "Be kind.").unwrap();
        let answer = session.ask("hello", &AtomicBool::new(false));
        let _ = std::fs::remove_file(&bin);
        assert_eq!(answer, Err(i18n::t("cli.claude_outdated")));
    }
}
