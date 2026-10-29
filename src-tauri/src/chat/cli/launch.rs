// Starting a CLI the way this computer has it: where it is (with the folders a GUI app's PATH
// leaves out, version managers' included), a PATH on which it finds its node, npm's Windows shims
// run as node plus script, a child that opens no console window, and a private folder to work in.
use super::*;

/// The folders a GUI app's PATH leaves out, where a CLI and the node it runs on may be. An app
/// opened from the Dock or a desktop menu gets the system's short PATH, not the one a login shell
/// builds from `.zshrc` or `.bashrc`, so nvm's, fnm's or pnpm's folders are not on it.
fn extra_dirs() -> Vec<PathBuf> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_default();
    dirs_under(Path::new(&home), |key| {
        std::env::var_os(key).filter(|v| !v.is_empty()).map(PathBuf::from)
    })
}

/// `extra_dirs` for the home folder and environment given, so a test can lay out its own.
/// The fixed folders come first, so a CLI there stays the one found; a version manager's folder
/// only adds a CLI none of them has.
fn dirs_under(home: &Path, var: impl Fn(&str) -> Option<PathBuf>) -> Vec<PathBuf> {
    let or_home = |key: &str, rel: &str| var(key).unwrap_or_else(|| home.join(rel));
    let data = or_home("XDG_DATA_HOME", ".local/share");
    let mut dirs = vec![
        "/opt/homebrew/bin".into(),
        "/usr/local/bin".into(),
        home.join(".local/bin"),
        home.join(".npm-global/bin"),
        or_home("VOLTA_HOME", ".volta").join("bin"),
        home.join("bin"),
    ];
    if let Some(bin) = nvm_bin(&or_home("NVM_DIR", ".nvm")) {
        dirs.push(bin);
    }
    // fnm keeps the default node under `aliases/default`; its multishell folders are made per
    // shell and gone when that shell closes, so only the alias is a place to look.
    let fnm = match var("FNM_DIR") {
        Some(dir) => vec![dir],
        None => vec![
            data.join("fnm"),
            home.join("Library/Application Support/fnm"),
            home.join(".fnm"),
        ],
    };
    dirs.extend(fnm.into_iter().map(|dir| dir.join("aliases/default/bin")));
    dirs.push(or_home("ASDF_DATA_DIR", ".asdf").join("shims"));
    dirs.push(var("MISE_DATA_DIR").unwrap_or_else(|| data.join("mise")).join("shims"));
    dirs.push(or_home("BUN_INSTALL", ".bun").join("bin"));
    match var("PNPM_HOME") {
        Some(dir) => dirs.push(dir),
        None => dirs.extend([home.join("Library/pnpm"), data.join("pnpm")]),
    }
    // npm's global folder on Windows, where `npm install -g` puts claude.cmd and codex.cmd.
    if let Some(appdata) = var("APPDATA") {
        dirs.push(appdata.join("npm"));
    }
    // With no home folder these would be relative, read against whatever folder the CLI runs in.
    dirs.retain(|dir| dir.is_absolute());
    dirs
}

/// The bin folder of nvm's default node: the version `alias/default` names, or the newest one
/// installed when it names none of them. nvm puts only that one on a new shell's PATH.
fn nvm_bin(nvm: &Path) -> Option<PathBuf> {
    let mut versions: Vec<(Vec<u64>, PathBuf)> = std::fs::read_dir(nvm.join("versions/node"))
        .ok()?
        .flatten()
        .filter_map(|entry| Some((node_version(entry.file_name().to_str()?)?, entry.path())))
        .collect();
    versions.sort();
    let wanted = nvm_default(nvm);
    let picked = wanted
        .and_then(|line| versions.iter().rev().find(|(v, _)| v.starts_with(&line)))
        .or(versions.last());
    picked.map(|(_, dir)| dir.join("bin"))
}

/// The version `alias/default` names, as far as it goes: `20` is the newest 20.x, and `node` or
/// `stable` (an empty prefix) the newest of all. An alias may name another, as `lts/*` names
/// `lts/iron`, which names a version; a few steps cover the ones nvm writes.
fn nvm_default(nvm: &Path) -> Option<Vec<u64>> {
    let mut name = "default".to_string();
    for _ in 0..4 {
        let next = std::fs::read_to_string(nvm.join("alias").join(&name)).ok()?;
        let next = next.trim();
        if next == "node" || next == "stable" {
            return Some(Vec::new());
        }
        if let Some(version) = node_version(next) {
            return Some(version);
        }
        if next.is_empty() || next.contains("..") {
            return None;
        }
        name = next.to_string();
    }
    None
}

/// `v20.11.0`, `20.11` or `20` as numbers, so 22 sorts after 9; None for anything else.
fn node_version(name: &str) -> Option<Vec<u64>> {
    let digits = name.strip_prefix('v').unwrap_or(name);
    digits.split('.').map(|part| part.parse().ok()).collect()
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
    let mut dirs: Vec<PathBuf> = std::env::var("PATH")
        .unwrap_or_default()
        .split(if cfg!(windows) { ';' } else { ':' })
        .map(PathBuf::from)
        .collect();
    dirs.extend(extra_dirs());
    find_in(name, &dirs)
}

/// The first `name` in `dirs` that can run: a file, executable on Unix.
fn find_in(name: &str, dirs: &[PathBuf]) -> Option<PathBuf> {
    let exts: &[&str] = if cfg!(windows) {
        &[".exe", ".cmd", ".bat"]
    } else {
        &[""]
    };
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

/// Readies `cmd` to run the CLI found at `bin`.
pub(super) fn setup_child(cmd: &mut Command, bin: &Path) {
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
    let inherited = std::env::var("PATH").unwrap_or_default();
    cmd.env("PATH", child_path(bin.parent(), &inherited, &extra_dirs()));
    // This app has no console, so on Windows a console child (claude.cmd via cmd.exe, node,
    // codex) would get a new, visible one; the pet talks through pipes and needs none.
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
}

/// The PATH a CLI runs with: the folder it was found in first, then this app's own PATH and the
/// folders that leaves out. npm's CLIs start with `#!/usr/bin/env node`, so the node beside the
/// CLI (nvm's or fnm's, the one it was installed with) has to come before an older one the
/// system may have in `/usr/bin`. No empty entry, which Unix reads as the current folder.
fn child_path(found_in: Option<&Path>, inherited: &str, extra: &[PathBuf]) -> String {
    let sep = if cfg!(windows) { ";" } else { ":" };
    let mut seen = std::collections::HashSet::new();
    let found_in = found_in.map(|dir| dir.to_string_lossy().into_owned());
    let extra = extra.iter().map(|dir| dir.to_string_lossy().into_owned());
    found_in
        .into_iter()
        .chain(inherited.split(sep).map(str::to_string))
        .chain(extra)
        .filter(|dir| !dir.is_empty() && seen.insert(dir.clone()))
        .collect::<Vec<_>>()
        .join(sep)
}

/// Where the chat CLIs run: a folder of this app's own (0700 on Unix), so no one else can leave
/// files there that a CLI would read as project instructions (an AGENTS.md or CLAUDE.md in the
/// shared temp folder, which anyone may write to on Linux). Made when first needed, and made again
/// under a new name if it went (the system's temp cleaner, after days of running). None if it
/// could not be made.
pub(super) fn private_dir() -> Option<PathBuf> {
    static DIR: Mutex<Option<PathBuf>> = Mutex::new(None);
    let mut dir = crate::app::hold(&DIR);
    if dir.as_ref().is_some_and(|d| d.is_dir()) {
        return dir.clone();
    }
    let fresh = std::env::temp_dir().join(format!("playpets-cli-{}", uuid::Uuid::new_v4()));
    let builder = std::fs::DirBuilder::new();
    #[cfg(unix)]
    let builder = {
        use std::os::unix::fs::DirBuilderExt;
        let mut builder = builder;
        builder.mode(0o700);
        builder
    };
    *dir = builder.create(&fresh).ok().map(|()| fresh);
    dir.clone()
}

/// A started CLI with every process it starts: npm's wrappers (codex.js, and claude.cmd through
/// node) run the real program as their child, which a kill of the wrapper alone leaves running.
/// On Unix the CLI leads a process group of its own; on Windows it is put in a job object that
/// ends every process in it when stopped or dropped.
pub(super) struct Tree {
    #[cfg(unix)]
    group: i32,
    #[cfg(windows)]
    job: isize,
}

/// The process groups of the CLIs running now. A group of its own outlives the app on Unix, so
/// quitting stops each one, the session answering a turn too (Windows' job ends with the app).
#[cfg(unix)]
static GROUPS: Mutex<Vec<i32>> = Mutex::new(Vec::new());

/// At quit: every CLI the app started and what it started.
pub(super) fn stop_every_tree() {
    #[cfg(unix)]
    stop_trees(|_| true);
}

/// Stops the listed trees `which` picks; a test stops only its own, as others run beside it.
#[cfg(unix)]
fn stop_trees(which: impl Fn(i32) -> bool) {
    let mut groups = crate::app::hold(&GROUPS);
    for &group in groups.iter().filter(|&&g| which(g)) {
        // SAFETY: a plain signal to a process group a live Tree leads.
        unsafe { libc::kill(-group, libc::SIGKILL) };
    }
    groups.retain(|&g| !which(g));
}

impl Tree {
    /// Spawns `cmd` as the head of a tree.
    pub(super) fn spawn(cmd: &mut Command) -> std::io::Result<(Child, Tree)> {
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            cmd.process_group(0);
        }
        let child = cmd.spawn()?;
        #[cfg(windows)]
        let tree = Tree {
            job: windows_job(&child),
        };
        #[cfg(unix)]
        let tree = {
            let group = i32::try_from(child.id()).unwrap_or(0);
            if group > 0 {
                crate::app::hold(&GROUPS).push(group);
            }
            Tree { group }
        };
        Ok((child, tree))
    }

    /// Stops the CLI and everything it started. The caller reaps `child` (killed, it ends at once).
    pub(super) fn kill(&self, child: &mut Child) {
        #[cfg(unix)]
        if self.group > 0 {
            // SAFETY: a plain signal to the process group this CLI leads (made in `spawn`).
            unsafe { libc::kill(-self.group, libc::SIGKILL) };
            self.forget();
        }
        #[cfg(windows)]
        if self.job != 0 {
            use windows_sys::Win32::System::JobObjects::TerminateJobObject;
            // SAFETY: the job handle is ours and still open (closed only in Drop).
            unsafe { TerminateJobObject(self.job as _, 1) };
        }
        let _ = child.kill();
    }
}

#[cfg(unix)]
impl Tree {
    /// Off the list once stopped or gone, so a group id the system hands out again is never hit.
    fn forget(&self) {
        crate::app::hold(&GROUPS).retain(|&g| g != self.group);
    }
}

#[cfg(unix)]
impl Drop for Tree {
    fn drop(&mut self) {
        self.forget();
    }
}

#[cfg(windows)]
impl Drop for Tree {
    fn drop(&mut self) {
        if self.job != 0 {
            // SAFETY: the handle is ours; closing it ends what is left in the job (KILL_ON_JOB_CLOSE).
            unsafe { windows_sys::Win32::Foundation::CloseHandle(self.job as _) };
        }
    }
}

/// A job object that ends its processes when closed, with `child` in it; 0 if the system refused
/// (the CLI then runs as before, and only it is stopped).
#[cfg(windows)]
fn windows_job(child: &Child) -> isize {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JobObjectExtendedLimitInformation, SetInformationJobObject,
    };
    // SAFETY: plain Win32 calls on a job handle made here and the child's own process handle.
    unsafe {
        let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if job.is_null() {
            return 0;
        }
        let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        let set = SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            (&raw const limits).cast(),
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );
        if set == 0 || AssignProcessToJobObject(job, child.as_raw_handle() as _) == 0 {
            CloseHandle(job);
            return 0;
        }
        job as isize
    }
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

    #[cfg(unix)]
    #[test]
    fn stopping_a_cli_stops_what_it_started() {
        // A wrapper that runs the real program as its child, as npm's codex.js does.
        let mut cmd = Command::new("sh");
        cmd.args(["-c", "sleep 30 & echo $!; wait"]).stdout(Stdio::piped());
        let (mut child, tree) = Tree::spawn(&mut cmd).unwrap();
        let mut line = String::new();
        BufReader::new(child.stdout.take().unwrap())
            .read_line(&mut line)
            .unwrap();
        let grandchild: i32 = line.trim().parse().unwrap();
        tree.kill(&mut child);
        let _ = child.wait();
        let gone = (0..60).any(|_| {
            std::thread::sleep(Duration::from_millis(50));
            // SAFETY: signal 0 only asks whether the process is still there.
            unsafe { libc::kill(grandchild, 0) != 0 }
        });
        assert!(gone, "the wrapper's child ({grandchild}) still runs");
    }

    #[cfg(unix)]
    #[test]
    fn a_cli_still_answering_when_the_app_quits_is_stopped_with_it() {
        // A turn in progress holds its session outside the manager's map; quitting stops it anyway.
        let mut cmd = Command::new("sh");
        cmd.args(["-c", "sleep 30 & echo $!; wait"]).stdout(Stdio::piped());
        let (mut child, tree) = Tree::spawn(&mut cmd).unwrap();
        let mut line = String::new();
        BufReader::new(child.stdout.take().unwrap())
            .read_line(&mut line)
            .unwrap();
        let grandchild: i32 = line.trim().parse().unwrap();
        stop_trees(|group| group == tree.group);
        let _ = child.wait();
        let gone = (0..60).any(|_| {
            std::thread::sleep(Duration::from_millis(50));
            // SAFETY: signal 0 only asks whether the process is still there.
            unsafe { libc::kill(grandchild, 0) != 0 }
        });
        assert!(gone, "the CLI's child ({grandchild}) outlived the app");
        drop(tree);
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

    /// A fresh folder to lay a home out in; the caller removes it.
    fn fake_home() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("playpets-home-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// A program at `path` that runs `body` (a shell script on Unix).
    fn program(path: &Path, body: &str) {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, body).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
    }

    fn no_env(_: &str) -> Option<PathBuf> {
        None
    }

    /// The folders searched under `home` alone, so a CLI this computer has in `/usr/local/bin`
    /// is not what a test finds.
    fn searched_under(home: &Path) -> Vec<PathBuf> {
        dirs_under(home, no_env)
            .into_iter()
            .filter(|dir| dir.starts_with(home))
            .collect()
    }

    #[test]
    fn nvm_s_default_alias_picks_the_node_and_else_the_newest_does() {
        let home = fake_home();
        let nvm = home.join(".nvm");
        assert_eq!(nvm_bin(&nvm), None, "no nvm, no folder");
        for version in ["v9.11.2", "v18.20.4", "v20.11.0", "v20.18.0", "v22.1.0"] {
            std::fs::create_dir_all(nvm.join("versions/node").join(version).join("bin")).unwrap();
        }
        let node = |version: &str| Some(nvm.join("versions/node").join(version).join("bin"));
        assert_eq!(
            nvm_bin(&nvm),
            node("v22.1.0"),
            "no alias: the newest, by number (22 after 9)"
        );

        let alias = nvm.join("alias");
        std::fs::create_dir_all(alias.join("lts")).unwrap();
        let default = |text: &str| std::fs::write(alias.join("default"), text).unwrap();
        default("v18.20.4\n");
        assert_eq!(nvm_bin(&nvm), node("v18.20.4"), "a version named in full");
        default("20");
        assert_eq!(nvm_bin(&nvm), node("v20.18.0"), "a line: its newest");
        default("node");
        assert_eq!(nvm_bin(&nvm), node("v22.1.0"));
        std::fs::write(alias.join("lts/*"), "lts/iron\n").unwrap();
        std::fs::write(alias.join("lts/iron"), "v20.11.0\n").unwrap();
        default("lts/*");
        assert_eq!(nvm_bin(&nvm), node("v20.11.0"), "an alias that names another");
        default("16");
        assert_eq!(nvm_bin(&nvm), node("v22.1.0"), "a version not installed: the newest");
        default("system");
        assert_eq!(nvm_bin(&nvm), node("v22.1.0"));
        std::fs::remove_dir_all(&home).unwrap();
    }

    #[test]
    fn version_managers_folders_are_searched_after_the_older_list() {
        let home = fake_home();
        std::fs::create_dir_all(home.join(".nvm/versions/node/v20.11.0/bin")).unwrap();
        let dirs = dirs_under(&home, no_env);
        let expected = [
            ".local/bin",
            ".npm-global/bin",
            ".volta/bin",
            ".nvm/versions/node/v20.11.0/bin",
            ".local/share/fnm/aliases/default/bin",
            "Library/Application Support/fnm/aliases/default/bin",
            ".asdf/shims",
            ".local/share/mise/shims",
            ".bun/bin",
            "Library/pnpm",
            ".local/share/pnpm",
        ];
        for rel in expected {
            assert!(dirs.contains(&home.join(rel)), "{rel} is searched");
        }
        let at = |dir: &Path| dirs.iter().position(|d| d == dir).unwrap();
        assert!(
            at(&home.join(".npm-global/bin")) < at(&home.join(".nvm/versions/node/v20.11.0/bin")),
            "a CLI found before is still the one found"
        );

        // The folders the managers were told to use, where the person set them.
        let custom = home.join("custom");
        let env = |key: &str| match key {
            "NVM_DIR" | "FNM_DIR" | "PNPM_HOME" | "XDG_DATA_HOME" => Some(custom.join(key)),
            _ => None,
        };
        std::fs::create_dir_all(custom.join("NVM_DIR/versions/node/v22.1.0/bin")).unwrap();
        let dirs = dirs_under(&home, env);
        for dir in [
            custom.join("NVM_DIR/versions/node/v22.1.0/bin"),
            custom.join("FNM_DIR/aliases/default/bin"),
            custom.join("PNPM_HOME"),
            custom.join("XDG_DATA_HOME/mise/shims"),
        ] {
            assert!(dirs.contains(&dir), "{} is searched", dir.display());
        }
        assert!(!dirs.contains(&home.join(".nvm/versions/node/v20.11.0/bin")));

        let homeless = dirs_under(Path::new(""), no_env);
        assert!(
            homeless.iter().all(|dir| dir.is_absolute()),
            "no folder read against the CLI's own"
        );
        std::fs::remove_dir_all(&home).unwrap();
    }

    #[test]
    fn a_cli_installed_with_nvm_is_found() {
        let home = fake_home();
        let bin = home.join(".nvm/versions/node/v20.11.0/bin");
        let name = if cfg!(windows) { "codex.cmd" } else { "codex" };
        program(&bin.join(name), "");
        let dirs = searched_under(&home);
        assert_eq!(find_in("codex", &dirs), Some(bin.join(name)));
        assert_eq!(find_in("claude", &dirs), None);
        std::fs::remove_dir_all(&home).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn a_file_that_cannot_run_is_not_a_cli() {
        let home = fake_home();
        std::fs::write(home.join("codex"), "").unwrap();
        assert_eq!(find_in("codex", std::slice::from_ref(&home)), None);
        std::fs::remove_dir_all(&home).unwrap();
    }

    #[test]
    fn a_cli_runs_with_its_own_folder_first_on_path() {
        let sep = if cfg!(windows) { ";" } else { ":" };
        let found = fake_home();
        let extra = [found.join("extra"), found.clone()];
        let path = child_path(Some(&found), &["/usr/bin", "", "/bin"].join(sep), &extra);
        let parts: Vec<&str> = path.split(sep).collect();
        let found = found.to_string_lossy();
        let extra = extra[0].to_string_lossy();
        assert_eq!(
            parts,
            [&*found, "/usr/bin", "/bin", &*extra],
            "no empty entry, each folder once"
        );
        assert_eq!(child_path(None, "", &[]), "", "nothing to add, nothing added");
    }

    #[cfg(unix)]
    #[test]
    fn a_cli_s_env_node_is_the_node_beside_it() {
        // npm's CLIs start with `#!/usr/bin/env node`; with nvm's folder first, env finds that node
        // even where the inherited PATH has another one.
        let home = fake_home();
        let nvm_bin = home.join(".nvm/versions/node/v20.11.0/bin");
        let system = home.join("usr/bin");
        program(&nvm_bin.join("node"), "#!/bin/sh\necho nvm-node\n");
        program(&system.join("node"), "#!/bin/sh\necho old-node\n");
        program(&nvm_bin.join("codex"), "#!/usr/bin/env node\n");
        let codex = find_in("codex", &searched_under(&home)).unwrap();
        let inherited = format!("{}:/usr/bin:/bin", system.display());
        let mut cmd = Command::new(&codex);
        cmd.env("PATH", child_path(codex.parent(), &inherited, &[]));
        // A temp folder mounted noexec cannot run it; only then is this skipped.
        if let Ok(out) = cmd.output() {
            assert_eq!(String::from_utf8_lossy(&out.stdout).trim(), "nvm-node");
        }
        std::fs::remove_dir_all(&home).unwrap();
    }
}
