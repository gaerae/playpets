// Commands that link coding agents to the app and give their work to a friend.
use super::*;

/// The settings a coding agent needs to reach this app: the app binary, its bridge file and the
/// friend the agent reports to, read under the lock and used after it.
pub(super) fn connection_snippet(state: &State<Shared>, kind: &str) -> Result<String, String> {
    let exe = std::env::current_exe().map_err(|_| i18n::t("error.exe_missing"))?;
    let (bridge_file, pet) = {
        let d = lock(state);
        (
            d.store.dir.join("bridge.json"),
            // The real choice, a parked friend too: the bridge sends its events to the first friend
            // until it is back (agent/bridge.rs resolve_pet), and to it after.
            d.agent_pets.get(kind).cloned(),
        )
    };
    let local = std::env::var("LOCALAPPDATA").ok();
    let command = agent::cli::agent_command(&exe.to_string_lossy(), local.as_deref());
    agent::snippets::connection_snippet(kind, &command, &bridge_file.to_string_lossy(), pet.as_deref())
}

/// The settings a coding agent needs to reach this app, put on the clipboard.
pub(super) fn copy_connection(app: &AppHandle, state: &State<Shared>, kind: &str) -> Result<Value, String> {
    let snippet = connection_snippet(state, kind)?;
    app.clipboard()
        .write_text(snippet.clone())
        .map_err(|_| i18n::t("clipboard.failed"))?;
    Ok(json!(snippet))
}

/// Set by the e2e harness: the home folder whose agent settings Connect writes, so a test run
/// never touches the real ones.
pub const E2E_HOME_ENV: &str = "PLAYPETS_E2E_HOME";

/// The folder the agents' settings files are under (`~`).
pub(super) fn agent_home(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    if e2e_mode() {
        return std::env::var_os(E2E_HOME_ENV)
            .filter(|v| !v.is_empty())
            .map(std::path::PathBuf::from)
            .ok_or_else(|| i18n::t("link.home_missing"));
    }
    app.path().home_dir().map_err(|_| i18n::t("link.home_missing"))
}

/// Where each agent that can be connected stands (agent/connect.rs Link), read from its file.
pub(super) fn agent_links(app: &AppHandle, state: &State<Shared>) -> Result<Value, String> {
    let home = agent_home(app)?;
    let mut links = serde_json::Map::new();
    for a in agent::kinds::AGENTS
        .iter()
        .filter(|a| a.format != agent::kinds::Format::None)
    {
        let snippet = connection_snippet(state, a.kind)?;
        links.insert(
            a.kind.into(),
            json!(agent::connect::status(&home, a.kind, &snippet).code()),
        );
    }
    Ok(Value::Object(links))
}

/// Connect or Disconnect, after the page asked the person; answers where the agent stands now.
pub(super) fn link_agent(app: &AppHandle, state: &State<Shared>, kind: &str, on: bool) -> Result<Value, String> {
    let home = agent_home(app)?;
    let snippet = connection_snippet(state, kind)?;
    if on {
        agent::connect::connect(&home, kind, &snippet)?;
    } else {
        agent::connect::disconnect(&home, kind)?;
    }
    Ok(json!(agent::connect::status(&home, kind, &snippet).code()))
}

/// Which friend a coding agent reports to. An empty pet id clears the choice (back to the first
/// friend). The copied or connected settings carry it as `--pet`, so they must be pasted or connected again.
pub(super) fn assign_agent(app: &AppHandle, state: &State<Shared>, kind: &str, pet: &str) -> Result<Value, String> {
    if agent::kinds::by_kind(kind).is_none() {
        return Err(i18n::t("error.unknown_link"));
    }
    commit(app, state, |d| {
        if pet.is_empty() {
            d.agent_pets.remove(kind);
        } else {
            require_pet(d, pet)?;
            d.agent_pets.insert(kind.to_string(), pet.to_string());
        }
        Ok(Value::Null)
    })
}
