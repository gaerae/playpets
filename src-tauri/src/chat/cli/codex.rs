// Codex: one `codex exec` per answer, told the whole conversation on standard input, its answer
// read from the file it writes.
use super::*;

// The friend only talks, as with Claude Code: none of the person's config.toml (MCP servers,
// notify, hooks), and nothing written to disk.
const CODEX_ISOLATION: [&str; 2] = ["--ephemeral", "--ignore-user-config"];

pub(super) fn ask(
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
    run(&bin, model, &prompt, cancel).map_err(CodexError::message)
}

fn run(bin: &Path, model: &str, prompt: &str, cancel: &AtomicBool) -> Result<String, CodexError> {
    // The answer lands in a file only this user can read (the temp folder is shared on Linux),
    // removed when this returns.
    let out = own_file(&workdir(), "codex", "").map_err(|e| {
        CodexError::Failed(i18n::tr(
            "cli.spawn_failed",
            &[("name", "Codex"), ("detail", &e.to_string())],
        ))
    })?;
    let (program, script) = launcher(bin);
    let mut cmd = Command::new(program);
    cmd.args(script)
        .args(["exec", "--skip-git-repo-check", "--sandbox", "read-only"])
        .args(CODEX_ISOLATION);
    cmd.arg("--output-last-message").arg(&out.0);
    if !model.is_empty() {
        cmd.arg(format!("--model={model}"));
    }
    cmd.arg("-");
    setup_child(&mut cmd, bin);
    cmd.current_dir(workdir())
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    let (mut child, tree) = Tree::spawn(&mut cmd).map_err(|e| {
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
        // A stopped run ends with everything it started (npm's codex.js runs the real codex as its
        // child, which would go on spending the person's quota), and is reaped so no zombie is left.
        if cancel.load(Ordering::SeqCst) {
            tree.kill(&mut child);
            let _ = child.wait();
            break Err(i18n::t("chat.cancelled"));
        }
        if Instant::now() > deadline {
            tree.kill(&mut child);
            let _ = child.wait();
            break Err(i18n::t("cli.timeout"));
        }
        std::thread::sleep(Duration::from_millis(50));
    };
    finished.map_err(CodexError::Failed).and_then(|status| {
        if !status.success() {
            return Err(codex_failure(
                status.code().unwrap_or(-1),
                &errors.join().unwrap_or_default(),
            ));
        }
        let answer = std::fs::read_to_string(&out.0).unwrap_or_default().trim().to_string();
        if answer.is_empty() {
            return Err(CodexError::Failed(i18n::t("cli.codex_empty")));
        }
        Ok(answer.chars().take(ANSWER_LIMIT).collect())
    })
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
    if at_limit(stderr) {
        return CodexError::Failed(i18n::t("agent.rate_limit"));
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
}
