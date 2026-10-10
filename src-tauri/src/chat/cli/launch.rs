// Starting a CLI the way this computer has it: where it is (with the folders a GUI app's PATH
// leaves out), npm's Windows shims run as node plus script, a child that opens no console window,
// and a private folder to work in.
use super::*;

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
fn shim_script(shim: &str) -> Option<String> {
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
pub(super) fn launcher(bin: &Path) -> (PathBuf, Vec<PathBuf>) {
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

pub(super) fn setup_child(cmd: &mut Command) {
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

/// Where the chat CLIs run: a folder of this app's own (0700 on Unix), made once per run, so no
/// one else can leave files there that a CLI would read as project instructions (an AGENTS.md or
/// CLAUDE.md in the shared temp folder, which anyone may write to on Linux). None if it could not
/// be made.
pub(super) fn private_dir() -> Option<PathBuf> {
    static DIR: std::sync::OnceLock<Option<PathBuf>> = std::sync::OnceLock::new();
    DIR.get_or_init(|| {
        let dir = std::env::temp_dir().join(format!("playpets-cli-{}", uuid::Uuid::new_v4()));
        let mut builder = std::fs::DirBuilder::new();
        #[cfg(unix)]
        {
            use std::os::unix::fs::DirBuilderExt;
            builder.mode(0o700);
        }
        builder.create(&dir).ok().map(|()| dir)
    })
    .clone()
}

/// The private folder, or should it fail, the system's temp folder as before: the CLI still runs.
pub(super) fn workdir() -> PathBuf {
    private_dir().unwrap_or_else(std::env::temp_dir)
}

/// A file of the private folder that goes when this does.
pub(super) struct TempFile(pub(super) PathBuf);
impl Drop for TempFile {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

/// The system prompt, written for Claude Code to read (`--system-prompt-file`), so it is not on
/// the command line, which any process on the computer can read (`ps`). Only in the private
/// folder (0600 on Unix); without one the caller passes it on the command line as before.
pub(super) fn prompt_file(system: &str) -> Option<TempFile> {
    own_file(&private_dir()?, "system", system).ok()
}

/// A new file in `dir` that only this user can read (0600 on Unix), holding `text`.
pub(super) fn own_file(dir: &Path, name: &str, text: &str) -> std::io::Result<TempFile> {
    let path = dir.join(format!("{name}-{}.txt", uuid::Uuid::new_v4()));
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&path)?;
    let made = TempFile(path);
    file.write_all(text.as_bytes())?;
    Ok(made)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_system_prompt_is_a_private_file_that_goes_with_the_session() {
        let file = prompt_file("Be kind.").expect("a private folder in the temp dir");
        let path = file.0.clone();
        assert!(path.starts_with(private_dir().unwrap()));
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "Be kind.");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = |p: &Path| std::fs::metadata(p).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode(&path), 0o600, "only this user reads it");
            assert_eq!(mode(path.parent().unwrap()), 0o700, "nor lists the folder");
        }
        drop(file);
        assert!(!path.exists(), "removed with its session");
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
}
