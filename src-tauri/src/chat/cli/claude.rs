// Claude Code: one long-lived `--input-format stream-json` child per friend, told who it is once
// and then sent each message as it comes.
use super::*;

/// How much of the end of Claude Code's stderr is kept to say why it quit.
const STDERR_TAIL: usize = 4096;
/// How long a turn waits for that stderr to close once the CLI has gone.
const STDERR_WAIT: Duration = Duration::from_secs(1);

/// The end of a CLI's stderr, kept as bytes (a character split between two reads stays whole)
/// and read once the pipe has closed.
#[derive(Default)]
pub(super) struct StderrTail {
    state: Mutex<(Vec<u8>, bool)>,
    closed: std::sync::Condvar,
}

impl StderrTail {
    /// Reads `pipe` to its end on a thread of its own, so the CLI never blocks on a full pipe.
    fn follow(pipe: impl Read + Send + 'static) -> Arc<StderrTail> {
        let tail = Arc::new(StderrTail::default());
        let reader = tail.clone();
        std::thread::spawn(move || {
            let mut pipe = pipe;
            let mut buf = [0u8; 1024];
            loop {
                let n = match pipe.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => n,
                    Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
                    Err(_) => break,
                };
                let mut state = crate::app::hold(&reader.state);
                state.0.extend_from_slice(&buf[..n]);
                let extra = state.0.len().saturating_sub(STDERR_TAIL);
                state.0.drain(..extra);
            }
            crate::app::hold(&reader.state).1 = true;
            reader.closed.notify_all();
        });
        tail
    }

    /// What it said, once the pipe has closed or `wait` has passed. A character cut by the trim at
    /// the start is dropped.
    fn text(&self, wait: Duration) -> String {
        let state = crate::app::hold(&self.state);
        let (state, _) = self
            .closed
            .wait_timeout_while(state, wait, |s| !s.1)
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let start = state.0.iter().position(|b| b & 0xC0 != 0x80).unwrap_or(state.0.len());
        String::from_utf8_lossy(&state.0[start..]).into_owned()
    }
}

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
    /// What stops the CLI with everything it started (launch.rs).
    tree: Tree,
    stdin: std::process::ChildStdin,
    rx: Receiver<Result<String, String>>,
    /// The end of the CLI's stderr, for why it quit (`claude_quit`).
    stderr: Arc<StderrTail>,
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
        let (mut child, tree) = Tree::spawn(&mut cmd).map_err(|e| {
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
        let stderr = match child.stderr.take() {
            Some(pipe) => StderrTail::follow(pipe),
            None => Arc::new(StderrTail::default()),
        };
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
            tree,
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

    /// The CLI quit without an answer: what it said on its way out, once its stderr has closed
    /// (at most a second; no lock is held meanwhile).
    fn why_quit(&self) -> String {
        claude_quit(&self.stderr.text(STDERR_WAIT))
    }

    fn kill(&mut self) {
        if let Some(child) = self.child.as_mut() {
            self.tree.kill(child);
        }
    }
}

impl Drop for Session {
    fn drop(&mut self) {
        // Killed now and reaped on its own thread, so no finished CLI lingers as a zombie and
        // nobody holding the app's state lock (a reset) waits for the process to go.
        if let Some(mut child) = self.child.take() {
            self.tree.kill(&mut child);
            std::thread::spawn(move || {
                let _ = child.wait();
            });
        }
    }
}

/// Why Claude Code quit before answering, from the end of its stderr: an option this version does
/// not know means it is too old; a word about signing in means that; its last error line is quoted
/// (`error: …`, or Node's `TypeError: …` after a crash, not the `Node.js v…` line under it); and
/// with no error said, signing in is the usual reason.
fn claude_quit(stderr: &str) -> String {
    if stderr.contains("unknown option") {
        return i18n::t("cli.claude_outdated");
    }
    let line = stderr
        .lines()
        .rev()
        .map(str::trim)
        .find(|l| {
            l.split(':')
                .next()
                .is_some_and(|w| w.eq_ignore_ascii_case("error") || (w.ends_with("Error") && !w.contains(' ')))
        })
        .unwrap_or("");
    if line.is_empty() || needs_login(line) {
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
        let crashed = claude_quit("TypeError: x is undefined\n    at main (cli.js:1)\n\nNode.js v22.11.0\n");
        assert!(
            crashed.contains("TypeError: x is undefined"),
            "the crash, not Node's version: {crashed}"
        );
        let old_node = claude_quit("SyntaxError: Unexpected token '?'\n\nNode.js v14.0.0\n");
        assert!(old_node.contains("SyntaxError"), "{old_node}");
        assert_eq!(
            claude_quit("warning: something\nNode.js v22.11.0\n"),
            login_guide("claude")
        );
        let crash = claude_quit("Error: ENOSPC: no space left on device\n\nNode.js v22.11.0\n");
        assert!(crash.contains("ENOSPC"), "{crash}");
        assert_eq!(claude_quit("Error: authentication failed"), login_guide("claude"));
    }

    #[test]
    fn a_tail_keeps_whole_characters_and_reads_once_the_pipe_closes() {
        // A Korean user name in a path, cut between two reads, and more than the tail holds.
        let said = format!("{}\nError: C:\\Users\\홍길동\\.claude 없음\n", "x".repeat(STDERR_TAIL));
        struct Chunks(Vec<Vec<u8>>);
        impl Read for Chunks {
            fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
                let Some(chunk) = self.0.first_mut() else { return Ok(0) };
                let n = chunk.len().min(buf.len()).min(7);
                buf[..n].copy_from_slice(&chunk[..n]);
                chunk.drain(..n);
                if chunk.is_empty() {
                    self.0.remove(0);
                }
                Ok(n)
            }
        }
        let tail = StderrTail::follow(Chunks(vec![said.into_bytes()]));
        let text = tail.text(Duration::from_secs(5));
        assert!(text.ends_with("홍길동\\.claude 없음\n"), "{text:?}");
        assert!(!text.contains('\u{FFFD}'), "no character split: {text:?}");
        assert!(text.len() <= STDERR_TAIL);
        // Cut inside a character: the trim drops its leftover bytes, not the text after them.
        let wide = StderrTail::follow(Chunks(vec!["가".repeat(STDERR_TAIL).into_bytes()]));
        let text = wide.text(Duration::from_secs(5));
        assert_eq!(
            text.len(),
            STDERR_TAIL - 1,
            "4096 bytes start two bytes into a character"
        );
        assert!(
            text.chars().all(|c| c == '가'),
            "no stray bytes or replacement characters"
        );
    }

    // One test for everything that uses the chat CLIs' private folder, which it removes at the end
    // so test runs leave nothing in the temp folder.
    #[test]
    fn the_private_folder_holds_the_prompt_and_an_old_cli_is_told_to_update() {
        let dir = private_dir().expect("a private folder in the temp dir");
        let file = prompt_file("Be kind.").unwrap();
        let path = file.0.clone();
        assert!(path.starts_with(&dir));
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "Be kind.");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = |p: &Path| std::fs::metadata(p).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode(&path), 0o600, "only this user reads the prompt");
            assert_eq!(mode(&dir), 0o700, "nor lists the folder");
        }
        drop(file);
        assert!(!path.exists(), "the prompt goes with its session");

        // A Claude Code too old for an option quits at once and says so on stderr.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let bin = dir.join("old-claude");
            std::fs::write(
                &bin,
                "#!/bin/sh\necho \"error: unknown option '--system-prompt-file'\" >&2\nexit 1\n",
            )
            .unwrap();
            std::fs::set_permissions(&bin, std::fs::Permissions::from_mode(0o700)).unwrap();
            // A temp folder mounted noexec cannot run it; only then is this part skipped.
            if Command::new(&bin).output().is_ok() {
                let mut session = Session::spawn(&bin, "", "Be kind.").unwrap();
                let answer = session.ask("hello", &AtomicBool::new(false));
                assert_eq!(answer, Err(i18n::t("cli.claude_outdated")));
            }
        }
        let _ = std::fs::remove_dir_all(&dir);
        // Gone (as a temp cleaner may take it after days of running), it is made again, anew.
        let again = private_dir().expect("made again");
        assert!(again.is_dir() && again != dir);
        let _ = std::fs::remove_dir_all(&again);
    }
}
