---
description: Let your friend follow a coding agent's work, with the settings to paste, terminal commands and security notes
---

# Coding agent hooks

While a coding agent works, your friend reacts along with it. This works with Claude Code, Codex CLI, Gemini CLI, Cursor, Grok Build and similar tools.

Setup is one piece of settings you copy and paste. You don't need Node.js.

## A friend for each agent <Since v="0.1.0" />

1. In **Settings → Coding tools**, pick a friend under **Reacting friend** on that tool's row.
2. Press **Copy settings** again and paste.

The copied settings name that friend (`--pet`), so Claude Code can report to Clover while Codex reports to Pip. If you don't pick anyone, the first friend gets the reports. The same happens if you send the chosen friend away.

Give each friend a different agent and the yard becomes a status board of who's doing what.

## Several agents at once

- Each friend shows only its own agent: its own status dot, name tag and desktop speech bubble.
- Ask a friend "what were you doing?" and it recaps its own agent's recent work, not the others'.

| Agent | Friend | What you see |
|---|---|---|
| Claude Code | Clover | Working while it edits files |
| Codex CLI | Pip | Done when a reply finishes |
| Gemini CLI | Daisy | Waiting for you at a confirmation |
| Cursor | Miso | Working while it runs a command |

### Two sessions of the same agent

1. In **Settings → Coding tools**, leave **Reacting friend** empty for that tool, then copy and paste the settings.
2. Start each session with its own friend:

```bash
PLAYPETS_PET=Clover claude
PLAYPETS_PET=Pip claude
```

- In PowerShell: `$env:PLAYPETS_PET="Clover"; claude`.
- `PLAYPETS_PET` takes a friend's name or ID, like `--pet`.
- A friend picked under **Reacting friend** is written into the settings (`--pet`) and wins over `PLAYPETS_PET`.
- This works for agents you start from a terminal: Claude Code, Codex CLI, Gemini CLI and Grok Build. Cursor runs its hooks from the Cursor app, so it reports to one friend.

## What you see in the yard <Since v="0.1.0" />

A friend with an agent carries the agent's name on its name tag (Clover, Claude Code), and the chip under its name in the Friend panel shows it too. The small dot by the friend's head is the agent's state. Hover over it to see the name.

| Dot | State | How long it stays |
|---|---|---|
| Orange, pulsing | Working | Until the agent reports again |
| Blue | Waiting | Until the agent reports again |
| Green | Done | Fades after 30 minutes |
| Red | Trouble | Fades after 30 minutes |

The pill in the Friend panel shows the agent's state as well. Chat answers go to the log.

## What happens <Since v="0.1.0" />

Each step the agent takes becomes your friend's status. You see it next to the friend's name in the Friend panel, on its name tag in the yard, and as a speech bubble above the friend on the desktop.

| What the agent is doing | Your friend's status |
|---|---|
| Thinking, using a tool (for example "Using Bash") | Working |
| Waiting for confirmation or an answer | Waiting for you |
| Finished the task | Done |
| Hit an error | Something went wrong |
| Session ended | Resting |

Your friend remembers up to 8 recent activities. Ask "what were you doing?" in the [chat](./chat.md) and it tells you.

## Copy and paste the settings <Since v="0.1.0" />

<Shot name="settings-agents" caption="Coding agent hooks in Settings → Coding tools. Each tool has a Copy settings button." />

1. Open **Friends & settings → Settings → Coding tools**.
2. Click **Copy settings** next to the tool you use. A notice tells you which file to paste it into.
3. Open that file, paste and save. Restart the agent and it connects right away.

| Tool | Where to paste | How it works |
|---|---|---|
| Claude Code (recommended) | `~/.claude/settings.json` | Reports every step through hooks |
| Codex CLI | At the top of `~/.codex/config.toml` | Reports when a task finishes |
| Gemini CLI | `~/.gemini/settings.json` | Reports every step through hooks |
| Cursor | `~/.cursor/hooks.json` | Reports edits, commands and completion. Only observe-only hooks are used |
| Grok Build | `~/.grok/hooks/playpets.json`, saved as a new file | Reports every step through hooks |
| Other MCP tools | The tool's MCP settings | The AI sends status and speech bubbles itself with the `set_pet_state`, `say`, `react` and `list_pets` tools |

- The copied piece holds the path to the PlayPets executable. That executable is the hook command itself, so there's nothing else to install.
- Moved the app? Copy and paste the settings again.
- Copied the Claude Code settings before version 1.4.0? Copy and paste them again, so your friend also tells you when a turn stops on an error such as a usage limit.
- If the file already has a `hooks` or `mcpServers` entry, merge the piece into that entry.
- Grok Build also runs your Claude Code and Cursor hooks. Its work shows only on the Grok Build friend.

## From the terminal <Since v="0.1.0" />

The same executable lets you talk to your friend from the terminal. Below, `playpets` stands for the app executable. On macOS it's `/Applications/PlayPets.app/Contents/MacOS/playpets`.

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
  - The port and token are in `bridge.json` in the data folder and change each time the app starts.
- [Coding-agent hooks](./agents.md) leave out your prompts and tool inputs.
  - The local bridge uses `127.0.0.1` and token authentication.
  - Short completion and notification reports, including a clipped agent answer, can carry work details. Those details can end up in a friend's conversation with the AI provider you chose.
  - Check what you send through terminal or MCP messages.
  - To keep those details on this computer, use a downloaded local model.
- The hooks never block the agent's work.
  - They finish quietly within a few seconds.
  - The agent keeps running even when the app is closed.
- Hooks are separate from the AI connection for chatting. Hooks alone don't let you chat with your friend.
- Detailed design: [Coding agent integration](/dev/agent-integration) in the developer docs.

## Notes for Windows

- Locally built trial MSIX package: the executable sits under `WindowsApps` and can't be called by path. The copied settings then point to the execution alias `%LOCALAPPDATA%\Microsoft\WindowsApps\playpets.exe`.
- `claude` and `codex` installed with npm have to be in `%APPDATA%\npm` for the app to find them. If they're installed elsewhere, automatic detection may not work.
