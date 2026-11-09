// Signing a subscription CLI in from the app, so nobody is sent to a terminal. Each CLI already
// has a browser sign-in of its own (`claude auth login`, `codex login`) and a way to say whether it
// is signed in; the app runs them as it runs a chat turn (found the same way, with the same PATH).
// Codex finishes by itself once the browser is done; Claude may print a code in the browser for
// the person to paste, which reaches the CLI through its stdin.

use super::launch::{Tree, launcher, setup_child, workdir};
use crate::i18n;
use std::io::{Read, Write};
use std::path::Path;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// Long enough to find a password and get past two-step sign-in; after that the run is stopped.
const LOGIN_TIMEOUT: Duration = Duration::from_secs(15 * 60);
/// A status check is quick; one that hangs (no network, a CLI waiting on something) counts as no.
const STATUS_TIMEOUT: Duration = Duration::from_secs(20);
const POLL: Duration = Duration::from_millis(250);
/// The codes the browser shows are well under this.
const CODE_MAX: usize = 2048;

/// The CLI a sign-in is for, as the fixed names the rest of the app uses.
pub fn cli_kind(name: &str) -> Option<&'static str> {
    match name {
        "claude" => Some("claude"),
        "codex" => Some("codex"),
        _ => None,
    }
}
/// Claude signs in to the subscription (not the API console), as the chat uses the plan.
fn login_args(kind: &str) -> &'static [&'static str] {
    if kind == "claude" {
        &["auth", "login", "--claudeai"]
    } else {
        &["login"]
    }
}
fn status_args(kind: &str) -> &'static [&'static str] {
    if kind == "claude" {
        &["auth", "status", "--json"]
    } else {
        &["login", "status"]
    }
}

fn command(bin: &Path, args: &[&str]) -> Command {
    let (program, script) = launcher(bin);
    let mut cmd = Command::new(program);
    cmd.args(script).args(args);
    setup_child(&mut cmd, bin);
    cmd.current_dir(workdir());
    cmd
}

/// Whether the CLI at `bin` says it is signed in (its status check exits 0).
pub(super) fn signed_in_with(bin: &Path, kind: &str) -> bool {
    let mut cmd = command(bin, status_args(kind));
    cmd.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    let Ok((mut child, tree)) = Tree::spawn(&mut cmd) else {
        return false;
    };
    let deadline = Instant::now() + STATUS_TIMEOUT;
    loop {
        match child.try_wait() {
            // The tree drops with this return, off the list of groups to stop.
            Ok(Some(status)) => return status.success(),
            Ok(None) if Instant::now() < deadline => std::thread::sleep(POLL / 5),
            _ => {
                tree.kill(&mut child);
                let _ = child.wait();
                return false;
            }
        }
    }
}

/// Whether `kind`'s CLI is on this computer and signed in.
pub fn signed_in(kind: &str) -> bool {
    super::resolve_bin(kind).is_some_and(|bin| signed_in_with(&bin, kind))
}

/// What the person pasted, as the one line the CLI reads; None for nothing or more than a line.
fn clean_code(text: &str) -> Option<String> {
    let code = text.trim();
    (!code.is_empty() && code.len() <= CODE_MAX && !code.chars().any(char::is_control)).then(|| code.to_string())
}

struct Run {
    id: u64,
    kind: &'static str,
    child: Child,
    tree: Tree,
    stdin: Option<ChildStdin>,
}

/// The sign-in under way, at most one: a second one replaces it.
#[derive(Default)]
pub struct Logins {
    run: Arc<Mutex<Option<Run>>>,
    next: AtomicU64,
}

/// Waits for run `id` to end. True when it ended by itself (or ran out of time and was stopped);
/// false when it was cancelled or replaced, which the slot no longer holding it says.
fn ended_by_itself(run: &Mutex<Option<Run>>, id: u64) -> bool {
    let deadline = Instant::now() + LOGIN_TIMEOUT;
    loop {
        {
            let mut slot = crate::app::hold(run);
            let Some(current) = slot.as_mut().filter(|r| r.id == id) else {
                return false;
            };
            match current.child.try_wait() {
                Ok(None) if Instant::now() < deadline => {}
                waited => {
                    let mut ended = slot.take().unwrap();
                    if !matches!(waited, Ok(Some(_))) {
                        ended.tree.kill(&mut ended.child);
                        let _ = ended.child.wait();
                    }
                    return true;
                }
            }
        }
        std::thread::sleep(POLL);
    }
}

impl Logins {
    /// Starts `kind`'s sign-in, which opens the browser. `done(kind, signed_in)` is called once the
    /// CLI ends by itself (or after the time allowed), never after a cancel or a replacement.
    pub fn start(&self, kind: &str, done: impl FnOnce(&'static str, bool) + Send + 'static) -> Result<(), String> {
        let kind = cli_kind(kind).ok_or_else(|| i18n::t("error.bad_request"))?;
        let bin = super::resolve_bin(kind).ok_or_else(|| super::missing(kind))?;
        self.start_with(&bin, kind, done)
    }

    fn start_with(
        &self,
        bin: &Path,
        kind: &'static str,
        done: impl FnOnce(&'static str, bool) + Send + 'static,
    ) -> Result<(), String> {
        self.cancel();
        let mut cmd = command(bin, login_args(kind));
        cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
        let (mut child, tree) = Tree::spawn(&mut cmd).map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                super::missing(kind)
            } else {
                i18n::tr(
                    "cli.spawn_failed",
                    &[("name", super::label(kind)), ("detail", &i18n::reason(&e))],
                )
            }
        })?;
        // What it prints (the address, the prompt) only needs reading so it never blocks on a full pipe.
        for out in [
            child.stdout.take().map(|o| Box::new(o) as Box<dyn Read + Send>),
            child.stderr.take().map(|e| Box::new(e) as _),
        ]
        .into_iter()
        .flatten()
        {
            std::thread::spawn(move || {
                let _ = std::io::copy(&mut { out }, &mut std::io::sink());
            });
        }
        let id = self.next.fetch_add(1, Ordering::SeqCst);
        let stdin = child.stdin.take();
        *crate::app::hold(&self.run) = Some(Run {
            id,
            kind,
            child,
            tree,
            stdin,
        });
        let bin = bin.to_path_buf();
        let run = Arc::clone(&self.run);
        std::thread::spawn(move || {
            if ended_by_itself(&run, id) {
                // The status, not the exit code, says whether it worked: asked after it ends.
                done(kind, signed_in_with(&bin, kind));
            }
        });
        Ok(())
    }

    /// Gives the waiting Claude sign-in the code its browser page showed.
    pub fn send_code(&self, text: &str) -> Result<(), String> {
        let code = clean_code(text).ok_or_else(|| i18n::t("cli.login_code_bad"))?;
        let mut slot = crate::app::hold(&self.run);
        let stdin = slot
            .as_mut()
            .filter(|r| r.kind == "claude")
            .and_then(|r| r.stdin.as_mut())
            .ok_or_else(|| i18n::t("cli.login_not_waiting"))?;
        stdin
            .write_all(format!("{code}\n").as_bytes())
            .and_then(|()| stdin.flush())
            .map_err(|_| i18n::t("cli.login_not_waiting"))
    }

    /// Stops the sign-in under way, if any; it then reports nothing.
    pub fn cancel(&self) {
        let ended = crate::app::hold(&self.run).take();
        if let Some(mut ended) = ended {
            ended.tree.kill(&mut ended.child);
            let _ = ended.child.wait();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::{Path, PathBuf};

    /// A program at `path` that runs `body` (a shell script).
    fn program(path: &Path, body: &str) {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, body).unwrap();
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755)).unwrap();
    }

    fn running(logins: &Logins) -> bool {
        crate::app::hold(&logins.run).is_some()
    }

    fn folder() -> PathBuf {
        std::env::temp_dir().join(format!("playpets-login-{}", uuid::Uuid::new_v4()))
    }

    #[test]
    fn only_the_two_subscription_clis_sign_in() {
        assert_eq!(cli_kind("claude"), Some("claude"));
        assert_eq!(cli_kind("codex"), Some("codex"));
        assert_eq!(cli_kind("ollama"), None);
        assert_eq!(cli_kind("../claude"), None);
        assert_eq!(login_args("claude"), ["auth", "login", "--claudeai"]);
        assert_eq!(login_args("codex"), ["login"]);
        assert_eq!(status_args("claude"), ["auth", "status", "--json"]);
        assert_eq!(status_args("codex"), ["login", "status"]);
    }

    #[cfg(unix)]
    #[test]
    fn a_cli_is_signed_in_when_its_status_says_so() {
        let dir = folder();
        let yes = dir.join("yes/claude");
        let no = dir.join("no/claude");
        let odd = dir.join("odd/codex");
        program(&yes, "#!/bin/sh\n[ \"$1 $2\" = 'auth status' ] && exit 0\nexit 3\n");
        program(&no, "#!/bin/sh\necho 'Not logged in'\nexit 1\n");
        program(&odd, "#!/bin/sh\n[ \"$1 $2\" = 'login status' ] && exit 0\nexit 3\n");
        assert!(signed_in_with(&yes, "claude"));
        assert!(!signed_in_with(&no, "claude"));
        assert!(signed_in_with(&odd, "codex"));
        assert!(
            !signed_in_with(&dir.join("gone/claude"), "claude"),
            "a CLI that went is not signed in"
        );
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_pasted_code_is_one_plain_line() {
        assert_eq!(clean_code("  abc123#xyz \n"), Some("abc123#xyz".to_string()));
        assert_eq!(clean_code(""), None);
        assert_eq!(clean_code("   "), None);
        assert_eq!(
            clean_code("two\nlines"),
            None,
            "a second line would be read as another answer"
        );
        assert_eq!(clean_code(&"x".repeat(CODE_MAX + 1)), None);
    }

    #[cfg(unix)]
    #[test]
    fn a_sign_in_waits_for_the_pasted_code_and_says_how_it_ended() {
        let dir = folder();
        let bin = dir.join("claude");
        // Signs in when the right code arrives; the status then reads the mark it left.
        let mark = dir.join("signed-in");
        program(
            &bin,
            &format!(
                "#!/bin/sh\nif [ \"$1 $2\" = 'auth status' ]; then [ -f '{m}' ]; exit $?; fi\n\
                 echo 'Paste code here if prompted >'\nread code\n[ \"$code\" = 'good#1' ] && touch '{m}'\n",
                m = mark.display()
            ),
        );
        let logins = Logins::default();
        let (tx, rx) = std::sync::mpsc::channel();
        logins
            .start_with(&bin, "claude", move |kind, ok| tx.send((kind, ok)).unwrap())
            .unwrap();
        assert!(running(&logins));
        logins.send_code("good#1").unwrap();
        let (kind, ok) = rx.recv_timeout(Duration::from_secs(10)).unwrap();
        assert_eq!((kind, ok), ("claude", true));
        assert!(!running(&logins));
        assert!(logins.send_code("good#1").is_err(), "nothing is waiting for a code now");
        let _ = std::fs::remove_dir_all(dir);
    }

    #[cfg(unix)]
    #[test]
    fn a_cancelled_sign_in_stops_and_says_nothing() {
        let dir = folder();
        let bin = dir.join("codex");
        program(
            &bin,
            "#!/bin/sh\n[ \"$1\" = 'login' ] && [ -z \"$2\" ] && sleep 30\nexit 1\n",
        );
        let logins = Logins::default();
        let (tx, rx) = std::sync::mpsc::channel();
        logins
            .start_with(&bin, "codex", move |kind, ok| tx.send((kind, ok)).unwrap())
            .unwrap();
        logins.cancel();
        assert!(!running(&logins));
        assert!(
            rx.recv_timeout(Duration::from_secs(2)).is_err(),
            "the person who cancelled already knows"
        );
        let _ = std::fs::remove_dir_all(dir);
    }

    #[cfg(unix)]
    #[test]
    fn a_second_sign_in_replaces_the_first() {
        let dir = folder();
        let bin = dir.join("codex");
        program(
            &bin,
            "#!/bin/sh\n[ \"$1\" = 'login' ] && [ -z \"$2\" ] && sleep 30\nexit 1\n",
        );
        let logins = Logins::default();
        let (tx, rx) = std::sync::mpsc::channel();
        let first = tx.clone();
        logins
            .start_with(&bin, "codex", move |kind, ok| first.send((kind, ok)).unwrap())
            .unwrap();
        logins
            .start_with(&bin, "codex", move |kind, ok| tx.send((kind, ok)).unwrap())
            .unwrap();
        assert!(running(&logins));
        logins.cancel();
        assert!(
            rx.recv_timeout(Duration::from_secs(2)).is_err(),
            "neither run reports after a cancel"
        );
        let _ = std::fs::remove_dir_all(dir);
    }
}
