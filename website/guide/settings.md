---
description: General settings, About and app updates, menus and shortcuts, quitting, the data folder and environment variables, what is saved and what is not
---

# Settings

The **Settings** tab has three groups: **General** (Language, **Start PlayPets when you log in**, and the auto chatter switch, **Let them chat now and then**), **Coding agent hooks**, and **About PlayPets** (the version, App updates and the project's pages), then Quit the app. Coding agent hooks are [explained separately](./agents.md). Open it from the tab, with <kbd>⌘</kbd> <kbd>,</kbd> or <kbd>Ctrl</kbd> <kbd>,</kbd>, or with **Settings…** in the tray menu.

## Language <Since v="0.1.0" />

Choose from 한국어, English, 日本語 and 简体中文. At first it follows the system language; changing it reloads the yard and the desktop windows in the new language. The tray menu and the window title change too. The chosen language is saved as `language` in `state.json`.

Your friends' chatter and greetings use the chosen language as well. Conversations with an AI, though, follow the personality and what you say, and the app speaks English to coding agents and the terminal.

Start the app with the environment variable `PLAYPETS_LANG=ko|en|ja|zh-hans` and it takes priority over the saved language. This is for testing.

## Start PlayPets when you log in <Since v="0.1.0" />

Turn this on and PlayPets starts whenever you log in to your computer. It is off by default. With desktop mode on, the yard window does not open at login: your friends come out on the desktop, and the window waits in the tray. The system keeps this choice (Login Items on macOS, the Run list on Windows, an autostart entry on Linux), so turning it off in either place turns it off.

## Let them chat now and then <Since v="0.1.0" />

With this switch, in General, turned on, the friends with an AI have a short chat every 20 minutes. It is off by default: subscription CLIs cost nothing extra, but the calls add up, so turn it on when you want it. A round is skipped while the window is hidden or someone is answering.

## About PlayPets <Since v="0.1.0" />

The last section of the Settings tab shows the version and holds **App updates**, then opens this site's pages and the project on GitHub: **Website**, **User guide**, **Release notes**, **GitHub**, **Report a problem** (a new issue) and **License** (MIT). They open in your browser.

### App updates <Since v="0.1.0" />

The row shows the current version. Click **Check for updates** and the app reads `latest.json` from GitHub releases; if you are current, it says "You're up to date".

When there is a new version, whether this check, the quiet one 20 seconds after the app starts, or one from the menus found it:

- A button with the new version appears in the top bar (only its icon in a narrow window), and the **Settings** tab gets a dot.
- The button opens the update window: **What's new** opens that version's page on this site, **Later** puts the top-bar button away until the next start (the row and the dot stay), and **Install and restart** downloads it with a progress bar, verifies its signature and restarts on the new version. Your friends and settings stay.
- The row in About offers **What's new** and **Install and restart** too.

If it could not check, look at your network, and keep in mind that the Windows portable zip is not covered by automatic updates. See [Install](./install.md#updates) for details.

## Quit the app <Since v="0.1.0" />

The yard window's close button only hides the window; the app stays in the tray. Friends on the desktop and the agent hooks keep running.

To really quit, click **Quit the app** at the bottom of the Settings tab. A "Quit PlayPets?" confirmation appears. Conversations are not saved, and friends on the desktop go too. **Quit** in the tray menu does the same.

## Menus and shortcuts <Since v="0.1.0" />

- **Tray menu** (the cat in the menu bar or the taskbar): **Open the yard**; then switches with a check mark for **Mini view**, **Show on the desktop** and, while that is on, **Stroll around the desktop** (with no friend yet, these are left out); then **Settings…**, **Check for updates…** (it reads **Update to v…** once a new version is known) and **About PlayPets**, then **Quit**. On Windows a left click on the icon opens the yard and the menu is on the right button. When a coding agent is waiting for you or ran into trouble, the icon gets a small blue or red mark, and its tooltip names the friend.
- **macOS menu bar**: **PlayPets** → **About PlayPets**, **Check for Updates…**, **Settings…**, hiding and **Quit PlayPets**; **Edit** for cut, copy and paste in text fields; **Window**.
- **Shortcuts**: <kbd>⌘</kbd> <kbd>,</kbd> (macOS) or <kbd>Ctrl</kbd> <kbd>,</kbd> (Windows, Linux) opens Settings; <kbd>⌘</kbd> <kbd>Q</kbd> quits on macOS.

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
| `PLAYPETS_LANG` | Forces the language (`ko`, `en`, `ja`, `zh-hans`) |
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
