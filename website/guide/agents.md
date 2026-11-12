---
description: Let your friend follow a coding agent's work, connected in one press or with settings to paste, plus terminal commands and security notes
---

# Coding agent hooks

While a coding agent works, your friend reacts along with it: Claude Code, Codex CLI, Gemini CLI, Cursor, Grok Build, Qoder, Kimi Code and tools that use MCP. Setup is one press of **Connect** or one piece of settings to paste, and you don't need Node.js.

::: tip At a glance
| To | Do this | More |
|---|---|---|
| Connect an agent | **Friends & settings → Settings → Coding tools → Connect** | [Connect in one press](#connect-in-one-press) |
| Add the settings yourself | **Copy settings**, then paste into the file it names | [Copy and paste](#copy-and-paste-the-settings) |
| Read what the agent is doing | The dot in the friend's name tag, beside its name | [What you see](#what-you-see-in-the-yard) |
| Give each agent its own friend | Pick a **Reacting friend** on the tool's row | [A friend for each agent](#a-friend-for-each-agent) |
| Run two sessions of one agent | Start each with `PLAYPETS_PET=Name` | [Two sessions](#two-sessions-of-the-same-agent) |
| Talk to a friend from a script | `playpets say`, `status`, `run` | [From the terminal](#from-the-terminal) |
:::

## Connect in one press <Since v="1.4.0" /> {#connect-in-one-press}

1. Open **Friends & settings → Settings → Coding tools**.
2. Press **Connect** next to the tool you use. PlayPets names the file it will change and asks first.
3. Confirm with **Connect**. The row says **Connected**, and sessions you start from then on report to your friend.

- PlayPets adds only its own hook. Your other settings and other tools' hooks stay as they are.
- The file as it was is kept beside it, for example `settings.json.playpets-backup`.
- Pressing Connect when it's already connected changes nothing.
- After you pick another reacting friend or move the app, the row asks to connect again: press **Connect again**.
- **Disconnect** takes out only PlayPets' entries and leaves the rest of the file alone.
- PlayPets never writes a file it can't read, such as settings with a comment in them. The row says so, and **Copy settings** still works.
- Codex runs only one `notify` program. If another program already holds that spot, PlayPets leaves the file as it is.

## Copy and paste the settings <Since v="0.1.0" /> {#copy-and-paste-the-settings}

<Shot name="settings-agents" caption="Coding agent hooks in Settings → Coding tools. Each tool has Connect and Copy settings buttons." />

1. Open **Friends & settings → Settings → Coding tools**.
2. Click **Copy settings** next to the tool you use. A notice names the file to paste it into.
3. Open that file, paste and save. Restart the agent and it connects right away.

| Tool | Where to paste | How it reports |
|---|---|---|
| Claude Code (recommended) | `~/.claude/settings.json` | Every step, through hooks |
| Codex CLI | At the top of `~/.codex/config.toml` | When a task finishes |
| Gemini CLI | `~/.gemini/settings.json` | Every step, through hooks |
| Cursor | `~/.cursor/hooks.json` | Edits, commands and completion. Only observe-only hooks are used |
| Grok Build | `~/.grok/hooks/playpets.json`, saved as a new file | Every step, through hooks |
| Qoder | `~/.qoder/settings.json` | Every step, through hooks. The Qoder IDE picks it up after a restart |
| Kimi Code | At the end of `~/.kimi-code/config.toml` | Every step, through hooks |
| Other MCP tools | The tool's MCP settings | The AI sends status and speech bubbles itself with the `set_pet_state`, `say`, `react` and `list_pets` tools |

- The copied piece holds the path to the PlayPets executable. That executable is the hook command, so there's nothing else to install.
- Moved the app? Press **Connect again**, or copy and paste the settings again.
- Copied the Claude Code settings before 1.4.0? Copy and paste them again, so your friend also tells you when a turn stops on an error such as a usage limit.
- If the file already has a `hooks` or `mcpServers` entry, merge the piece into that entry.
- Grok Build also runs your Claude Code and Cursor hooks. Its work still shows only on the Grok Build friend.

## What you see in the yard <Since v="0.1.0" /> {#what-you-see-in-the-yard}

A friend with an agent carries the agent's name on its name tag (Clover, Claude Code), and in the chip under its name in the Friend panel. The small dot in its name tag, beside its name, is the agent's state; point at it to see the name.

| The agent | Friend's status | Dot | Stays |
|---|---|---|---|
| Thinks or uses a tool (for example "Using Bash") | Working | Orange, pulsing | Until the agent reports again |
| Waits for a confirmation or an answer | Waiting for you | Blue | Until the agent reports again |
| Finishes the task | Done | Green | Fades after 30 minutes |
| Hits an error | Something went wrong | Red | Fades after 30 minutes |
| Ends the session | Resting | | |

- The status shows beside the friend's name in the Friend panel, in the pill there, on its name tag in the yard, and as a speech bubble above it on the desktop. Chat answers go to the log.
- Not every agent reports every step. Codex CLI reports only when a reply finishes, so its friend shows Done but never Working or Waiting for you.
- Cursor has no hook for a confirmation, so its friend never shows Waiting for you.
- Your friend remembers up to 8 recent activities. Ask "what were you doing?" in the [chat](./chat.md).

### Where friends go <Since v="1.7.0" /> {#where-friends-go}

A friend also shows its agent's state in what it does.

| State | Outdoor places | Garden workshop |
|---|---|---|
| Working | Stops where it is and works | Sits at a long table |
| Waiting | Comes to the front of the yard | Waits by the bell at the front |
| Done | Strolls again | Rests by the tea table until the agent's next step |
| Trouble | Stops where it is | Stays in its seat |

- Friends waiting together stand side by side.
- With more working friends than seats, the others work beside a table.
- In a short, wide window that leaves the tables out, a friend works where it stands.

## A friend for each agent <Since v="0.1.0" /> {#a-friend-for-each-agent}

Give each friend a different agent and the yard becomes a status board of who's doing what.

1. In **Settings → Coding tools**, pick a friend under **Reacting friend** on that tool's row.
2. Press **Connect again** on that row, or copy and paste the settings again.

- The settings name that friend (`--pet`), so Claude Code can report to Clover while Codex reports to Pip.
- With no one picked, or after you send the chosen friend away, the first friend gets the reports.
- Each friend shows only its own agent: its own dot, name tag and desktop speech bubble.
- Ask a friend "what were you doing?" and it recaps its own agent's recent work, not the others'.

| Agent | Friend | What you see |
|---|---|---|
| Claude Code | Clover | Working while it edits files |
| Codex CLI | Pip | Done when a reply finishes |
| Gemini CLI | Daisy | Waiting for you at a confirmation |
| Cursor | Miso | Working while it runs a command |

### Two sessions of the same agent {#two-sessions-of-the-same-agent}

1. In **Settings → Coding tools**, leave **Reacting friend** empty for that tool, then connect it or copy and paste the settings.
2. Start each session with its own friend:

```bash
PLAYPETS_PET=Clover claude
PLAYPETS_PET=Pip claude
```

- In PowerShell: `$env:PLAYPETS_PET="Clover"; claude`.
- `PLAYPETS_PET` takes a friend's name or ID, like `--pet`.
- A friend picked under **Reacting friend** is written into the settings (`--pet`) and wins over `PLAYPETS_PET`.
- Works for agents you start from a terminal: Claude Code, Codex CLI, Gemini CLI, Grok Build, Qoder CLI and Kimi Code. Cursor runs its hooks from the Cursor app, so it reports to one friend.

## From the terminal <Since v="0.1.0" /> {#from-the-terminal}

The same executable talks to your friend from the terminal. Below, `playpets` stands for the app executable; on macOS it's `/Applications/PlayPets.app/Contents/MacOS/playpets`.

```
playpets hook claude|gemini|cursor|grok|qoder|kimi   # hook (JSON on stdin, always exits 0; prints {} for Gemini and Cursor)
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
| `playpets status working "Building"` | Changes the status: `idle`, `working`, `waiting`, `done` or `error` |
| `playpets react wave` | Reacts once: `wave`, `jump` or `pet` |
| `playpets run -- npm test` | "Working" while the command runs, then "Done" or "Something went wrong". Stopped with Ctrl-C, it goes back to "Resting" |

- Point at a friend with `--pet name` or `--pet friendID`. Without it, the first friend gets it.
- The friend ID is at the bottom of the Friend settings window.

## Security <Since v="0.1.0" /> {#security}

| Topic | How it works |
|---|---|
| Where hooks go | Only this computer: a random port on `127.0.0.1`, with a random token checked on every request. Both are in `bridge.json` in the data folder and change each time the app starts |
| What they send | Never your prompts or tool inputs. Short completion and notification reports, including a clipped agent answer, can carry work details, which can end up in a friend's conversation with the AI provider you chose |
| The agent's work | Never blocked: hooks finish quietly within a few seconds, and the agent keeps running when the app is closed |
| Chatting | Separate. Hooks alone don't let you chat with your friend |

- Check what you send through terminal or MCP messages.
- To keep work details on this computer, chat with a downloaded local model.
- Detailed design: [Coding agent integration](/dev/agent-integration) in the developer docs.

## Notes for Windows {#notes-for-windows}

- Locally built trial MSIX package: the executable sits under `WindowsApps` and can't be called by path. The copied settings then point to the execution alias `%LOCALAPPDATA%\Microsoft\WindowsApps\playpets.exe`.
- `claude` and `codex` installed with npm have to be in `%APPDATA%\npm` for the app to find them. Installed elsewhere, automatic detection may not work.
