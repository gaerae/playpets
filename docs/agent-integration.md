# Architecture: coding agent integration

## Scope
- How coding agents (Claude Code, Codex, Gemini CLI, Cursor, and tools that use MCP) report their status to PlayPets friends, as it works today.
- For people adding a new integration or building tools on the agent side.
- The whole app's architecture: [PlayPets app architecture](architecture.md).

What leaves the agent, and where it goes:
- The bridge stays inside this computer.
- Hook adapters leave out user prompts and tool inputs.
- They forward short notifications and Codex's last answer.
- MCP and direct commands can also supply sentences.
- The app keeps recent reports.
- When you chat, it adds them to the connected friend's AI prompt as labeled status notes.
- That AI may run outside this computer.

## Diagram
A container-level diagram: from what the agent runs to what appears on the friend.

```mermaid
flowchart LR
  agent([Coding agent])
  subgraph binary[playpets executable]
    cli[CLI mode<br/>hook, mcp, say]
    app[Running app]
    bridge[Bridge<br/>127.0.0.1 random port]
  end
  file[(bridge.json<br/>port and token)]
  pet([Friend's speech bubble])
  agent -- runs hook, MCP stdio --> cli
  cli -- read --> file
  app -- write at launch --> file
  cli -- HTTP + token --> bridge
  bridge --> app
  app --> pet
```

## Components
| Component | Location | Responsibility |
|---|---|---|
| CLI mode | `src-tauri/src/agent/cli.rs` | With a command argument (`hook`, `mcp`, `status`, `say`, `react`, `pets`, `run`), the app executable runs in this mode with no window. Node.js is not needed |
| Hook translation | `agent::cli::hook_event` | Turns each agent's hook payload into a state and a code. Prompts and tool inputs are not sent |
| MCP server | `agent::cli::mcp_reply` | An MCP server that takes JSON-RPC one line at a time over standard input and output. Four tools |
| Bridge | `src-tauri/src/agent/bridge.rs` | The HTTP server inside the app. A random port on `127.0.0.1`, a token check on every request, browser requests refused |
| Event handling | `src-tauri/src/agent/mod.rs` | Turns codes into sentences in the current language, remembers them as recent activity, and shows them as the friend's status |
| Settings snippets | `connection_snippet` in `agent/snippets.rs` (the agent list is in `agent/kinds.rs`) | The snippet to paste into each agent's settings file, built by "Copy settings" in the Settings tab ([details](#settings-snippets)) |

## Data flow
1. **When the app launches:**
   - The bridge opens on `127.0.0.1:0`.
   - The app writes the assigned port and a new token (64 random characters) to `bridge.json` in the data folder.
   - Both change every time the app restarts.
2. **Hooks:**
   - At each step the agent runs `playpets hook claude --bridge <bridge.json>` and passes the hook JSON on standard input.
   - Codex passes the notification JSON as the last argument.
   - CLI mode turns it into a state and a code and sends it with `POST /events`.
   - A hook never blocks the agent's work: it is quiet, finishes within 3 seconds, and exits with code 0 even when it fails.
3. **MCP:**
   - The agent starts `playpets mcp` as an MCP server and sends `initialize`, `tools/list` and `tools/call`.
   - Tool calls go through the same bridge path.
4. **Commands:**
   - A person or script can run commands directly: `playpets say "Tests passed"`.
   - `playpets run -- npm test` sends `working` while the command runs, then `done` or `error` when it ends.
5. **Inside the app:**
   - The bridge checks the token and the payload.
   - It picks the friend: `pet`/`petId` is an id or a name. Without one, it uses the first friend.
   - A code becomes a sentence in the current language (`@tool Bash` → "Using Bash") and shows above the friend.
   - It is remembered among that friend's 8 most recent activities.

## Import links
- A gallery adds a `playpets://import?url=<pet page address>` link.
- The operating system hands the link to PlayPets (`src-tauri/src/links.rs`).
- The app imports the pet through the same path as a pasted address, then opens the Invite tab.
- The scheme is registered under `plugins.deep-link` in `tauri.conf.json`.
- A link received by a second launch is handed over by the single-instance plugin.
- Other kinds of links are ignored.

## Interfaces
**CLI commands**

| Common option | Default |
|---|---|
| `--pet <id or name>` | The first friend, or `PLAYPETS_PET` |
| `--bridge <path to bridge.json>` | The data folder, or `PLAYPETS_BRIDGE` |

| Command | What it does |
|---|---|
| `playpets pets` | Friend list and states |
| `playpets status <state> [message]` | Status notification |
| `playpets say <message>` | Only a speech bubble, without changing the state |
| `playpets react <wave\|jump\|pet>` | A one-off reaction |
| `playpets run -- <command…>` | Status notifications while a command runs |
| `playpets hook <claude\|gemini\|cursor>` | Handles hook JSON on standard input |
| `playpets hook codex <json>` | Handles a Codex notification |
| `playpets mcp` | MCP server (standard input and output) |

**States and reactions**
- States: `idle`, `working`, `waiting`, `done`, `error`.
- Reactions: `wave`, `jump`, `pet`.

**Hook translation**
- Events not in the table are not sent.
- The app turns codes into the current language.

| Agent event | State | Sentence sent |
|---|---|---|
| Claude `UserPromptSubmit`, Gemini `BeforeAgent`, Cursor `afterAgentThought` | working | `@thinking` |
| Claude `PreToolUse`, Gemini `BeforeTool`, Cursor `postToolUse` | working | `@tool <tool name>`, or `@tool_any` when there is no name |
| Cursor `afterFileEdit`, `afterShellExecution`, `subagentStart` | working | `@editing`, `@command`, `@subtask` |
| Claude, Gemini `Notification` | waiting | The agent's notification sentence, or `@confirm` when there is none |
| Claude `Stop`, Gemini `AfterAgent`, Cursor `stop` | done | `@done` |
| Claude, Gemini `SessionEnd`, Cursor `sessionEnd` | idle | None |
| Codex `agent-turn-complete` | done | The last answer (120 characters), or `@done` when there is none |
| `playpets run` start, failure | working, error | `@running <command>`, `@failed <exit code>` |

**HTTP bridge**
- Every request needs `Authorization: Bearer <token from bridge.json>`.
- Requests with an `Origin` header (browsers) are refused.
- The body is JSON of 8 KB or less.
- Sentences are cut at 240 characters.

| Request | Body | Response |
|---|---|---|
| `GET /pets` | None | `[{id, name, state}]` |
| `POST /events` | `{pet or petId, state, message}` | `{ok, petId}` |
| `POST /say` | `{pet, message}` | `{ok, petId}` |
| `POST /react` | `{pet, action}` | `{ok, petId}` |

| Error | Meaning |
|---|---|
| `400` | Bad payload |
| `401` | Missing or wrong token |
| `403` | Browser request |
| `404` | Unknown path or friend |
| `413` | Over 8 KB |

**MCP tools**
- Protocol version `2024-11-05`.

| Tool | Input | What it does |
|---|---|---|
| `list_pets` | None | Friend list and states |
| `set_pet_state` | `state` (required), `message`, `pet` | Status notification |
| `say` | `message` (required), `pet` | Speech bubble |
| `react` | `action` (required), `pet` | Reaction |

## Environment and touchpoints
- The Settings tab's "Copy settings" tells you which file to paste into.

| Agent | Settings file | What you paste |
|---|---|---|
| Claude Code | `~/.claude/settings.json` | A `hook claude` command for each event |
| Codex CLI | Top of `~/.codex/config.toml` | `notify = [executable, "hook", "codex", …]` |
| Gemini CLI | `~/.gemini/settings.json` | A `hook gemini` command for each event |
| Cursor | `~/.cursor/hooks.json` | A `hook cursor` command for each event |
| Other MCP tools | Each tool's MCP settings | The `playpets mcp` server |

### Settings snippets
- Built by `connection_snippet` when you press "Copy settings" in the Settings tab.
- Contains the executable path and the `bridge.json` path.
- If a friend was picked for that agent in the Settings tab, it adds `--pet <friend id>` (`PLAYPETS_PET` for MCP).
- The assignment is saved in `AppData.agent_pets` and removed when that friend is sent away.

MSIX install on Windows:
- The executable lives under WindowsApps and cannot be run by path from outside.
- The settings snippet points at the execution alias instead: `%LOCALAPPDATA%\Microsoft\WindowsApps\playpets.exe`.

## Related decisions
- Design record "[Stronger agent integration, community import, personality and activity memory](design/2026-09-29-agent-link-import-persona.md)": hook-first integration, CLI mode without Node, activity memory
- "[Strings live in two per-language tables, one for the page and one for the backend, and agent status is sent as codes](decisions/2026-09-30-strings-in-two-tables.md)": why hooks send codes

## Change history
- 2026-09-29 Moved hooks, MCP and status commands into the CLI mode of the app executable (no Node needed)
- 2026-09-30 Hook states are sent as codes so they show in the app's language. CLI and MCP text is fixed to English
- 2026-09-30 With an MSIX install, the settings snippet points at the execution alias
