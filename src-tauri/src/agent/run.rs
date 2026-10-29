//! `playpets run -- <command…>`: the friend works while a command runs and shows how it ended.
//! Kept apart from the rest of the command-line mode (cli.rs) for its signal handling.
use super::cli::{NORMAL, Send};
use serde_json::json;

/// `run -- <command…>`: the friend works while the command runs and reports how it ended; the
/// command's own exit code is handed back.
pub(super) fn run_command(command: &[String], send: Send) -> i32 {
    let publish = |state: &str, message: String| {
        if let Err(e) = send("/events", json!({"state": state, "message": message}), NORMAL) {
            eprintln!("[PlayPets] {e}");
        }
    };
    publish("working", format!("@running {}", command[0]));
    let status = std::process::Command::new(&command[0])
        .args(&command[1..])
        .spawn()
        .and_then(|mut child| {
            interrupt::wait_through(child.id());
            child.wait()
        });
    let (code, state, message) = match status {
        Ok(status) => ended(status),
        Err(e) => {
            eprintln!("{e}");
            (1, "error", "@failed 1".to_string())
        }
    };
    publish(state, message);
    code
}

/// How a command `run` waited for ended: its exit code, as a shell gives it (128 and the signal
/// when one stopped it), and what the friend shows. Stopped from its terminal, the friend is idle.
fn ended(status: std::process::ExitStatus) -> (i32, &'static str, String) {
    #[cfg(unix)]
    {
        use std::os::unix::process::ExitStatusExt;
        if let Some(signal) = status.signal() {
            let code = 128 + signal;
            return if [libc::SIGINT, libc::SIGTERM, libc::SIGHUP, libc::SIGQUIT].contains(&signal) {
                (code, "idle", "@stopped".to_string())
            } else {
                (code, "error", format!("@failed {code}"))
            };
        }
    }
    let code = status.code().unwrap_or(1);
    // STATUS_CONTROL_C_EXIT: a Windows console program ended by Ctrl-C.
    if cfg!(windows) && code as u32 == 0xC000_013A {
        return (code, "idle", "@stopped".to_string());
    }
    match code {
        0 => (0, "done", "@done".to_string()),
        // A command that catches Ctrl-C or a TERM and exits says so with the shell's code for it.
        130 | 143 if cfg!(unix) => (code, "idle", "@stopped".to_string()),
        _ => (code, "error", format!("@failed {code}")),
    }
}

/// Ctrl-C in a terminal reaches `run` and its command together. The command decides what it
/// means, and `run` stays to say how it ended; a SIGTERM sent to `run` alone is passed on.
mod interrupt {
    #[cfg(unix)]
    pub fn wait_through(child: u32) {
        use std::sync::atomic::{AtomicI32, Ordering};
        static CHILD: AtomicI32 = AtomicI32::new(0);
        extern "C" fn on_signal(signal: libc::c_int) {
            let child = CHILD.load(Ordering::SeqCst);
            // SAFETY: tcgetpgrp, getpgrp and kill are async-signal-safe.
            let terminal = [0, 1, 2]
                .into_iter()
                .map(|fd| unsafe { libc::tcgetpgrp(fd) })
                .find(|&g| g >= 0);
            if child > 0 && forwards(signal, terminal, unsafe { libc::getpgrp() }) {
                unsafe { libc::kill(child, signal) };
            }
        }
        CHILD.store(child as i32, Ordering::SeqCst);
        for signal in [libc::SIGINT, libc::SIGQUIT, libc::SIGTERM, libc::SIGHUP] {
            // SAFETY: a zeroed sigaction with an empty mask and a handler that only calls kill.
            // A handler, unlike SIG_IGN, is not inherited: the command still stops at Ctrl-C.
            unsafe {
                let mut action: libc::sigaction = std::mem::zeroed();
                action.sa_sigaction = on_signal as extern "C" fn(libc::c_int) as usize;
                libc::sigemptyset(&mut action.sa_mask);
                libc::sigaction(signal, &action, std::ptr::null_mut());
            }
        }
    }

    /// Whether a signal to `playpets run` is passed on to the command. Ctrl-C, Ctrl-\\ and a hang-up
    /// from the terminal reach its whole foreground group, the command too; any other (a TERM, or a
    /// harness's `kill -INT` to this process alone) is passed on, or the command would never hear it.
    #[cfg(unix)]
    pub(super) fn forwards(signal: libc::c_int, terminal: Option<libc::pid_t>, own: libc::pid_t) -> bool {
        signal == libc::SIGTERM || terminal != Some(own)
    }

    #[cfg(windows)]
    pub fn wait_through(_child: u32) {
        use windows_sys::Win32::System::Console::SetConsoleCtrlHandler;
        // A handler, unlike ignoring Ctrl-C outright, is not inherited by the command.
        unsafe extern "system" fn handled(_event: u32) -> windows_sys::core::BOOL {
            1
        }
        // SAFETY: registers a handler that only reports the event handled.
        unsafe { SetConsoleCtrlHandler(Some(handled), 1) };
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    #[test]
    fn a_command_stopped_by_its_terminal_leaves_the_friend_idle() {
        let ran = |script: &str| ended(std::process::Command::new("sh").args(["-c", script]).status().unwrap());
        assert_eq!(ran("exit 0"), (0, "done", "@done".to_string()));
        assert_eq!(ran("exit 3"), (3, "error", "@failed 3".to_string()));
        // Ctrl-C: the shell's own code for it, and the friend is no longer left working.
        assert_eq!(ran("kill -INT $$"), (130, "idle", "@stopped".to_string()));
        assert_eq!(ran("kill -TERM $$"), (143, "idle", "@stopped".to_string()));
        assert_eq!(ran("kill -KILL $$"), (137, "error", "@failed 137".to_string()));
        assert_eq!(
            ran("exit 130"),
            (130, "idle", "@stopped".to_string()),
            "it caught Ctrl-C and left"
        );
    }

    #[cfg(unix)]
    #[test]
    fn a_signal_sent_to_run_alone_reaches_its_command() {
        use interrupt::forwards;
        // Ctrl-C from the terminal run is in front of: the command has it already.
        assert!(!forwards(libc::SIGINT, Some(42), 42));
        assert!(!forwards(libc::SIGHUP, Some(42), 42));
        // A harness with no terminal, or one where run is in the background, sends it to run alone.
        assert!(forwards(libc::SIGINT, None, 42));
        assert!(forwards(libc::SIGQUIT, Some(7), 42));
        assert!(forwards(libc::SIGTERM, Some(42), 42));
    }

    #[cfg(windows)]
    #[test]
    fn a_console_program_ended_by_ctrl_c_leaves_the_friend_idle() {
        use std::os::windows::process::ExitStatusExt;
        let ended_with = |code: u32| ended(std::process::ExitStatus::from_raw(code));
        assert_eq!(ended_with(0), (0, "done", "@done".to_string()));
        assert_eq!(ended_with(0xC000_013A).1, "idle", "STATUS_CONTROL_C_EXIT");
        assert_eq!(
            ended_with(130),
            (130, "error", "@failed 130".to_string()),
            "a code, not a signal, there"
        );
    }
}
