---
description: Settings that send a coding agent's work status to your friend, terminal commands, and security
---

# Coding agent hooks

- While a coding agent works (Claude Code, Codex CLI, Gemini CLI, Cursor, Grok Build and the like), your friend reacts along with it.
- Setup: copy and paste one piece of settings.
- Node.js is not needed.

## A friend for each agent <Since v="0.1.0" />

1. In **Settings → Coding tools**, pick a friend under **Reacting friend** on that tool's row.
2. Press **Copy settings** again and paste.

- The copied settings name the friend (`--pet`), so Claude Code can report to Clover and Codex to Pip.
- No choice: the first friend gets it.
- Send the chosen friend away and it goes back to the first friend.
- Give each friend a different agent and the yard becomes a status board of who is doing what.

## What you see in the yard <Since v="0.1.0" />

- A friend with an agent carries its name on the name tag (Clover, Claude Code).
- The chip under the friend's name in the Friend panel shows the agents too.
- The small dot by a friend's head is the agent's state. Hover it for the name.

| Dot | State | How long it stays |
|---|---|---|
| Orange, pulsing | Working | Until the agent reports again |
| Blue | Waiting | Until the agent reports again |
| Green | Done | Fades after 30 minutes |
| Red | Trouble | Fades after 30 minutes |

- The pill in the Friend panel is the agent's state too. Chat answers show in the log.

## What happens <Since v="0.1.0" />

- The agent's steps become your friend's status. It shows:
  - next to the name in the Friend panel
  - on the name tag in the yard
  - as a speech bubble above the friend on the desktop

| What the agent is doing | Your friend's status |
|---|---|
| Thinking, using a tool (for example "Using Bash") | Working |
| Waiting for confirmation or an answer | Waiting for you |
| Finished the task | Done |
| Hit an error | Something went wrong |
| Session ended | Resting |

- Your friend remembers up to 8 recent activities. Ask "what were you doing?" in the [chat](./chat.md).

## Copy and paste the settings <Since v="0.1.0" />

<Shot name="settings-agents" caption="Coding agent hooks in Settings → Coding tools. Each tool has a Copy settings button." />

1. Open **Friends & settings → Settings → Coding tools**.
2. Click **Copy settings** next to the tool you use. A notice says which file to paste it into.
3. Open that file, paste and save. Restart the agent; it connects right away.

| Tool | Where to paste | How it works |
|---|---|---|
| Claude Code (recommended) | `~/.claude/settings.json` | Reports every step through hooks |
| Codex CLI | At the top of `~/.codex/config.toml` | Reports when a task finishes |
| Gemini CLI | `~/.gemini/settings.json` | Reports every step through hooks |
| Cursor | `~/.cursor/hooks.json` | Reports edits, commands and completion. Only observe-only hooks are used |
| Grok Build | `~/.grok/hooks/playpets.json`, saved as a new file | Reports every step through hooks |
| Other MCP tools | The tool's MCP settings | The AI sends status and speech bubbles itself with the `set_pet_state`, `say`, `react` and `list_pets` tools |

- The copied piece contains the path to the PlayPets executable. The executable is the hook command itself, so there is nothing else to install.
- Moved the app? Copy and paste the settings again.
- File already has a `hooks` or `mcpServers` entry? Merge the piece into that entry.
- Grok Build also runs your Claude Code and Cursor hooks. Its work shows only on the Grok Build friend.

## From the terminal <Since v="0.1.0" />

- The same executable talks to your friend from the terminal.
- Below, `playpets` is the app executable. On macOS: `/Applications/PlayPets.app/Contents/MacOS/playpets`.

```
playpets hook claude|gemini|cursor|grok   # hook (JSON on stdin, always exits 0; prints {} for Gemini and Cursor)
playpets hook codex <json>      # Codex notify
playpets mcp                    # MCP server over stdio
playpets status <state> [message]   [--pet name|ID] [--bridge file]
playpets say <words>
playpets react <action>
playpets pets
playpets run -- <command>
```

| Command | What it does |
|---|---|
| `playpets pets` | Lists the friends and their current status |
| `playpets say "Tests passed"` | Shows a speech bubble without changing the status |
| `playpets status working "Building"` | Changes the status. One of `idle`, `working`, `waiting`, `done`, `error` |
| `playpets react wave` | Reacts once. One of `wave`, `jump`, `pet` |
| `playpets run -- npm test` | "Working" while the command runs, then "Done" or "Something went wrong" |

- Point at a specific friend with `--pet name` or `--pet friendID`. Without it, the first friend gets it.
- The friend ID is at the bottom of the Friend settings window.

## Security <Since v="0.1.0" />

- The hooks stay on this computer.
  - The app opens a random port on `127.0.0.1` and checks a random token on every request.
  - Port and token are in `bridge.json` in the data folder and change every time the app starts.
- [Coding-agent hooks](./agents.md) omit user prompts and tool inputs.
  - The local bridge uses `127.0.0.1` and token authentication.
  - Short completion or notification reports, including a clipped agent answer, may contain work details. They can be included in a friend’s conversation with your chosen AI provider.
  - Review what you send through terminal or MCP messages.
  - Use a downloaded local model when those details need to stay on this computer.
- The hooks never block the agent's work.
  - They finish quietly within 3 seconds.
  - The agent keeps running even when the app is closed.
- This is separate from the AI connection for chatting. Hooks alone do not let you chat with your friend.
- Detailed design: [Coding agent integration](/dev/agent-integration) in the developer docs.

## Notes for Windows

- Locally built trial MSIX package: the executable is under `WindowsApps` and cannot be called by path. The copied settings then point to the execution alias `%LOCALAPPDATA%\Microsoft\WindowsApps\playpets.exe`.
- `claude` and `codex` installed with npm must be in `%APPDATA%\npm` for the app to find them. Installed elsewhere, automatic detection may not work.
