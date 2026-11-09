// Signing a subscription CLI in from the app, so nobody is sent to a terminal. Each CLI already
// has a browser sign-in of its own (`claude auth login`, `codex login`) and a way to say whether it
// is signed in; the app runs them as it runs a chat turn (found the same way, with the same PATH).
// Codex finishes by itself once the browser is done; Claude may print a code in the browser for
// the person to paste, which reaches the CLI through its stdin.

use super::launch::{Tree, launcher, setup_child, workdir};
use crate::i18n;
use std::collections::HashSet;
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

/// Whether the CLI at `bin` says it is signed in: its status check exits 0 or not. None when the
/// check could not run or did not finish, which says nothing either way. (Claude's check counts an
/// API key or Bedrock as signed in too; Codex's only its own sign-in.)
pub(super) fn signed_in_with(bin: &Path, kind: &str) -> Option<bool> {
    let mut cmd = command(bin, status_args(kind));
    cmd.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    let (mut child, tree) = Tree::spawn(&mut cmd).ok()?;
    let deadline = Instant::now() + STATUS_TIMEOUT;
    loop {
        match child.try_wait() {
            // The tree drops with this return, off the list of groups to stop.
            Ok(Some(status)) => return Some(status.success()),
            Ok(None) if Instant::now() < deadline => std::thread::sleep(POLL / 5),
            _ => {
                tree.kill(&mut child);
                let _ = child.wait();
                return None;
            }
        }
    }
}

/// Whether `kind`'s CLI says it is signed in; None when it is not on this computer.
pub fn signed_in(kind: &str) -> Option<bool> {
    signed_in_with(&super::resolve_bin(kind)?, kind)
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

impl Run {
    /// Stops the CLI and what it started. Called with the run already out of its slot, so nobody
    /// waits on the lock while it goes.
    fn stop(mut self) {
        self.tree.kill(&mut self.child);
        let _ = self.child.wait();
    }
}

/// The sign-in under way, at most one: a second one replaces it.
#[derive(Default)]
pub struct Logins {
    run: Arc<Mutex<Option<Run>>>,
    next: AtomicU64,
    /// Held while a sign-in starts, so two at once cannot both start (Codex's waits on one port).
    starting: Mutex<()>,
    /// The CLIs whose last chat turn said they are not signed in, whatever their status check says
    /// (a sign-in that expired still reads as signed in there).
    turned: Arc<Mutex<HashSet<&'static str>>>,
}

/// Waits for run `id` to end. True when it ended by itself (or ran out of time and was stopped);
/// false when it was cancelled or replaced, which the slot no longer holding it says.
fn ended_by_itself(run: &Mutex<Option<Run>>, id: u64) -> bool {
    let deadline = Instant::now() + LOGIN_TIMEOUT;
    loop {
        let ended = {
            let mut slot = crate::app::hold(run);
            let Some(current) = slot.as_mut().filter(|r| r.id == id) else {
                return false;
            };
            match current.child.try_wait() {
                Ok(None) if Instant::now() < deadline => None,
                waited => slot.take().map(|run| (run, matches!(waited, Ok(Some(_))))),
            }
        };
        match ended {
            None => std::thread::sleep(POLL),
            Some((_, true)) => return true,
            Some((run, false)) => {
                run.stop();
                return true;
            }
        }
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
        // Only another start waits here, for as long as the old run takes to stop and this one to
        // begin: two that overlapped would leave the first running with nobody to stop it.
        let _starting = crate::app::hold(&self.starting);
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
        let (run, turned) = (Arc::clone(&self.run), Arc::clone(&self.turned));
        std::thread::spawn(move || {
            if ended_by_itself(&run, id) {
                // The status, not the exit code, says whether it worked: asked after it ends.
                let ok = signed_in_with(&bin, kind) == Some(true);
                if ok {
                    crate::app::hold(&turned).remove(kind);
                }
                done(kind, ok);
            }
        });
        Ok(())
    }

    /// Gives the waiting Claude sign-in the code its browser page showed. The pipe is written with
    /// the run's lock let go, and goes back to the run after, unless that run ended meanwhile.
    pub fn send_code(&self, text: &str) -> Result<(), String> {
        let code = clean_code(text).ok_or_else(|| i18n::t("cli.login_code_bad"))?;
        let not_waiting = || i18n::t("cli.login_not_waiting");
        let (id, mut stdin) = {
            let mut slot = crate::app::hold(&self.run);
            let run = slot.as_mut().filter(|r| r.kind == "claude").ok_or_else(not_waiting)?;
            (run.id, run.stdin.take().ok_or_else(not_waiting)?)
        };
        let written = stdin
            .write_all(format!("{code}\n").as_bytes())
            .and_then(|()| stdin.flush());
        if let Some(run) = crate::app::hold(&self.run).as_mut().filter(|r| r.id == id) {
            run.stdin = Some(stdin);
        }
        written.map_err(|_| not_waiting())
    }

    /// Stops the sign-in under way, if any; it then reports nothing.
    pub fn cancel(&self) {
        let ended = crate::app::hold(&self.run).take();
        if let Some(run) = ended {
            run.stop();
        }
    }

    /// What a chat turn with `kind`'s CLI said about its sign-in: turned away for not being signed
    /// in, or through (which proves it is).
    pub fn heard(&self, kind: &str, turn: &Result<String, String>) {
        let Some(kind) = cli_kind(kind) else {
            return;
        };
        let mut turned = crate::app::hold(&self.turned);
        match turn {
            Ok(_) => {
                turned.remove(kind);
            }
            Err(error) if *error == super::login_guide(kind) => {
                turned.insert(kind);
            }
            Err(_) => {}
        }
    }

    /// Whether `kind`'s last chat turn was turned away for not being signed in.
    pub fn turned_away(&self, kind: &str) -> bool {
        crate::app::hold(&self.turned).contains(kind)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(unix)]
    use std::path::{Path, PathBuf};

    // The sign-in tests run fake CLIs written as shell scripts, so they and their helpers are
    // Unix only; Windows still checks the arguments each CLI is given.

    /// A program at `path` that runs `body` (a shell script).
    #[cfg(unix)]
    fn program(path: &Path, body: &str) {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, body).unwrap();
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755)).unwrap();
    }

    #[cfg(unix)]
    fn running(logins: &Logins) -> bool {
        crate::app::hold(&logins.run).is_some()
    }

    #[cfg(unix)]
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
        assert_eq!(signed_in_with(&yes, "claude"), Some(true));
        assert_eq!(signed_in_with(&no, "claude"), Some(false));
        assert_eq!(signed_in_with(&odd, "codex"), Some(true));
        assert_eq!(
            signed_in_with(&dir.join("gone/claude"), "claude"),
            None,
            "a check that cannot run says nothing, rather than signed out"
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
                 echo 'Paste code here if prompted >'\n\
                 while read code; do [ \"$code\" = 'good#1' ] && touch '{m}' && exit 0; done\n",
                m = mark.display()
            ),
        );
        let logins = Logins::default();
        // A turn said it is not signed in; a sign-in that goes through takes that back.
        logins.heard("claude", &Err(super::super::login_guide("claude")));
        let (tx, rx) = std::sync::mpsc::channel();
        logins
            .start_with(&bin, "claude", move |kind, ok| tx.send((kind, ok)).unwrap())
            .unwrap();
        assert!(running(&logins));
        // A wrong code leaves the sign-in waiting, and the next one still reaches it.
        logins.send_code("bad#0").unwrap();
        logins.send_code("good#1").unwrap();
        let (kind, ok) = rx.recv_timeout(Duration::from_secs(10)).unwrap();
        assert_eq!((kind, ok), ("claude", true));
        assert!(!logins.turned_away("claude"));
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

    #[cfg(unix)]
    #[test]
    fn sign_ins_started_at_once_leave_one_running() {
        let dir = folder();
        let bin = dir.join("codex");
        let pids = dir.join("pids");
        // Each run writes down its process and waits, as `codex login` does on its port.
        program(
            &bin,
            &format!(
                "#!/bin/sh\n[ \"$1\" = 'login' ] && [ -z \"$2\" ] && echo $$ >> '{p}' && exec sleep 30\nexit 1\n",
                p = pids.display()
            ),
        );
        let logins = std::sync::Arc::new(Logins::default());
        let starts: Vec<_> = (0..6)
            .map(|_| {
                let (logins, bin) = (logins.clone(), bin.clone());
                std::thread::spawn(move || logins.start_with(&bin, "codex", |_, _| {}).unwrap())
            })
            .collect();
        for start in starts {
            start.join().unwrap();
        }
        // Every run has written its line by the time it waits.
        let deadline = Instant::now() + Duration::from_secs(5);
        let alive = || -> Vec<String> {
            std::fs::read_to_string(&pids)
                .unwrap_or_default()
                .lines()
                .filter(|pid| {
                    Command::new("kill")
                        .args(["-0", pid])
                        .status()
                        .is_ok_and(|s| s.success())
                })
                .map(String::from)
                .collect()
        };
        while std::fs::read_to_string(&pids).unwrap_or_default().lines().count() < 6 && Instant::now() < deadline {
            std::thread::sleep(POLL);
        }
        assert_eq!(alive().len(), 1, "the runs replaced along the way were stopped");
        logins.cancel();
        assert!(alive().is_empty());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_turn_turned_away_counts_as_signed_out_until_one_goes_through() {
        let logins = Logins::default();
        assert!(!logins.turned_away("claude"));
        logins.heard("claude", &Err(super::super::login_guide("claude")));
        assert!(
            logins.turned_away("claude"),
            "the CLI said so itself, whatever its status says"
        );
        assert!(!logins.turned_away("codex"));
        logins.heard("claude", &Err("rate limit".into()));
        assert!(
            logins.turned_away("claude"),
            "another failure says nothing about the sign-in"
        );
        logins.heard("claude", &Ok("hi".into()));
        assert!(!logins.turned_away("claude"));
    }
}
