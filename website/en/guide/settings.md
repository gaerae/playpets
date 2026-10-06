---
description: Language, app updates, quitting, the data folder and environment variables, what is saved and what is not
---

# Settings

The **Settings** tab has Language, App updates, Coding agent hooks and Quit the app. Coding agent hooks are [explained separately](./agents.md).

## Language <Since v="0.1.0" />

Choose from 한국어, English, 日本語 and 简体中文. At first it follows the system language; changing it reloads the yard and the desktop windows in the new language. The tray menu and the window title change too. The chosen language is saved as `language` in `state.json`.

Your friends' chatter and greetings use the chosen language as well. Conversations with an AI, though, follow the personality and what you say, and the app speaks English to coding agents and the terminal.

Start the app with the environment variable `PLAYPETS_LANG=ko|en|ja` and it takes priority over the saved language. This is for testing.

## Let them chat now and then <Since v="0.1.0" />

With this switch near the top of the Settings tab on, the friends with an AI have a short chat every 20 minutes. It is off by default: subscription CLIs cost nothing extra, but the calls add up, so turn it on when you want it. A round is skipped while the window is hidden or someone is answering.

## App updates <Since v="0.1.0" />

The line shows the current version. Click **Check for updates** and the app reads `latest.json` from GitHub releases.

- If you are current, it says "You're up to date".
- If there is a new version, the button changes to **Install and restart**. Click it to download, verify the signature and, when done, restart on the new version.

20 seconds after the app starts, it checks once quietly. If there is a new version, a notice appears. If it could not check, look at your network, and keep in mind that the Windows portable zip is not covered by automatic updates. See [Install](./install.md#updates) for details.

## Quit the app <Since v="0.1.0" />

The yard window's close button only hides the window; the app stays in the tray. Friends on the desktop and the agent hooks keep running.

To really quit, click **Quit the app** at the bottom of the Settings tab. A "Quit PlayPets?" confirmation appears. Conversations are not saved, and friends on the desktop go too. **Quit** in the tray menu does the same.

## Data folder <Since v="0.1.0" />

| Operating system | Location |
|---|---|
| macOS | `~/Library/Application Support/app.playpets/` |
| Windows | `%APPDATA%\app.playpets\` |
| Linux | `~/.local/share/app.playpets/` |

| File | Contents |
|---|---|
| `state.json` | Friends (name, personality and where it came from, relationship, size, position, chosen AI connection), the list of AI connections (without keys), language, desktop mode and roaming, each agent's friend, auto chatter, hand-picked pet folders, the file's format number (`schema`). A file written by a newer version is copied aside and read for the parts this version knows |
| `bridge.json` | The port and token for agent hooks. Rewritten every time the app starts |
| `pets/` | Pet folders imported from an address |
| `builtin/` | The three starter pets (Tabby, Smoky, Mochi) that come with the app, unpacked at each start |

## Environment variables

| Variable | What it does |
|---|---|
| `PLAYPETS_DATA` | Moves the data folder somewhere else. Terminal commands (`playpets say` and so on) read the same value |
| `CODEX_HOME` | Codex's home folder. The Codex pet folder in the Invite tab becomes `$CODEX_HOME/pets` |
| `PLAYPETS_LANG` | Forces the language (`ko`, `en`, `ja`) |
| `PLAYPETS_PET` | The default friend for terminal commands. Same as the `--pet` option |
| `PLAYPETS_BRIDGE` | The path to the `bridge.json` that terminal commands read. Same as the `--bridge` option |

The variables must be set in the environment the app runs in. Start the app from a terminal, or use your operating system's environment variable settings.

## What is saved and what is not <Since v="0.1.0" />

**Saved**

- Each friend's name, personality, size and position in the yard
- The kind, server address and model name of each AI connection
- Language, desktop mode and strolling, mini mode, the chosen time of day and weather
- Imported pet files and where they came from

**Saved differently**

- API keys do not go into `state.json`. They are kept only in this computer's secure storage (macOS Keychain, Windows Credential Manager, Linux Secret Service), and deleting the connection deletes them too.

**Not saved**

- Conversations with your friends. They live only in memory and are gone when you quit the app.
- The memory of a coding agent's recent activity. Gone when you quit the app.
- Positions during a game. Friends go back to where they were when the game ends.

To remove every trace after uninstalling the app, delete the data folder and the PlayPets entries in the secure storage as well.
