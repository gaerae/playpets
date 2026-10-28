---
description: Language and startup, friends and AI, About and app updates, menus and shortcuts, quitting, the data folder and environment variables, and what PlayPets saves and what it doesn't
---

# Settings

Open **Friends & settings → Settings**. You'll find five sections there: **Language & startup**, **Friends & AI**, **Coding tools**, **App updates** and **About PlayPets**. [Coding tools](./agents.md) has its own guide.

Season, sound and volume aren't in Settings. They're in **Place & atmosphere → Atmosphere**. When an update is available, a dot shows on Settings in the menu.

| | Large window | Small window |
|---|---|---|
| Layout | List on the left, chosen section beside it, as in System Settings | Opens on the list, one section at a time |
| Opens on | The section you last had open | The list |
| Back | Returns to Friends & settings | From a section: to the list. From the list: to Friends & settings |

- These open their section directly: **About PlayPets** and **Check for updates…** in the tray and the macOS menu bar, and an update notice. In a small window, Back still returns to the list.
- Close returns to the scenery.

## Language <Since v="0.1.0" />

Pick 한국어, English, 日本語 or 简体中文. At first PlayPets follows your system language.

Changing it reloads the yard and the desktop windows in the new language, and the tray menu and window title change with them. Any reply still being generated is canceled. Earlier messages stay as they were; they aren't translated.

Friends greet you and chatter in the language you picked, and AI replies use it too by default. Want an answer in another language? Ask for it in your latest message. With coding agents and the terminal, the app speaks English.

- Saved as `language` in `state.json`.
- For testing: start the app with `PLAYPETS_LANG=ko|en|ja|zh-hans`. It takes priority over the saved language.

## Start PlayPets when you log in <Since v="0.1.0" />

Turn this on and PlayPets starts whenever you log in to your computer. It's off by default.

If desktop mode is on, the yard window doesn't open at login. Your friends come out on the desktop, and the window waits in the tray.

Your system keeps this choice: Login Items on macOS, the Run list on Windows, an autostart entry on Linux. Turning it off in either place turns it off.

## Friends & AI <Since v="1.2.0" />

This section lists every AI connection, with how many friends use it and an **Edit** button. No connection yet? Friends still play and react without one.

**Edit**, or **Connect an AI** for a new connection, opens the connection form right here in the section. No window covers Settings. Editing a connection here doesn't move any friend to it.

- **Esc** folds the form. If you typed something, it says "You have changes here. Save them, or press Cancel to discard them." instead.
- How to make a connection: [Chat with a friend](./chat.md#making-a-connection).

## Let them chat now and then <Since v="0.1.0" />

This switch is in Friends & AI and is off by default. Turn it on and friends with an AI have a short chat every 20 minutes. A round is skipped while the window is hidden or someone is answering.

These calls use your subscription allowance or your provider's billing, so turn it on when you want it. Local Ollama models have no hosted inference fee.

## Let them dig on their own now and then <Since v="1.2.0" />

This switch is in Friends & AI too. It's off by default and needs no AI connection. Turn it on and, while the yard is shown, an idle friend digs a spot of its own every few minutes. Whatever it finds is kept, the same as any other dig.

A friend doesn't dig on its own:
- during a game
- while you hold a tool
- in places without soil, such as Cozy living room

## About PlayPets <Since v="0.1.0" />

This section shows the version, then three groups. Links open in your browser. App updates have their own section.

| Group | Holds |
|---|---|
| **Help** | The user guide, reporting a problem, **Open the data folder** (friends, settings and backups; see [Data folder](#data-folder)) |
| **Project** | The website, release notes, GitHub |
| **Privacy and license** | The privacy policy, the license |

## App updates <Since v="0.1.0" />

If you installed PlayPets from the Microsoft Store, the Store manages updates. Check in **Microsoft Store → Library**. Test MSIX packages also use package-managed updates. The GitHub installer update flow below is for installations outside MSIX.

Storage and network details are in the [privacy policy](../privacy.md).

**Checking**
- The row shows the current version.
- **Check for updates** reads `latest.json` from GitHub releases. If you're current, it says "You're up to date".
- Quiet check 20 seconds after startup, retried every six hours. The section says so under the row.
- Installs only when you choose. You can also check manually.
- **What changed in this version** opens the release page of the version you use.
- An available update's entry opens **Friends & settings → Settings → App updates**.

**Installing**
- **What's new** opens the release page in your browser.
- All of these stay in App updates; no separate update window opens:
  - **Install and restart**
  - download progress, verification, installation
  - retry after a failure
- Download size unknown: progress has no percentage.

Your friends and settings stay after the restart, and a brief notice confirms the installed version.

## Quit PlayPets <Since v="0.1.0" />

| In **Friends & settings** | What it does |
|---|---|
| **Close window** | Hides the yard in the tray. Desktop friends and agent hooks keep running |
| **Quit PlayPets** | Exits at once; conversations are not saved. Same as **Quit PlayPets** in the tray and <kbd>⌘</kbd> <kbd>Q</kbd> on macOS |

Neither is a direct item in the scenery's right-click menu. Choose Friends & settings first.

## Menus and shortcuts <Since v="0.1.0" />

- **Tray menu** (the cat in the menu bar or taskbar), in order:
  - **Open the yard**, **Friends** (when friends are present), **Invite a Friend…**
  - Display switches: **Always on top**, **Show on desktop**, and **Stroll on desktop** while desktop mode is on
  - **Yard Sounds**, **Settings…**, **Check for updates…**, **About PlayPets**, **Quit PlayPets**
- Tray details:
  - Always on top stays available without friends. Desktop switches appear once a friend is present.
  - Sound shows a check mark when on.
  - An available update changes the update label to **Update to v…**.
  - On Windows, left-click opens the yard; right-click opens the menu.
  - A small blue or red mark signals an agent waiting for you or reporting trouble. The tooltip names its friend.
- **macOS menu bar**:
  - **PlayPets** → **About PlayPets**, **Check for Updates…**, **Settings…**, hiding, **Quit PlayPets**
  - **Edit**: cut, copy and paste in text fields
  - **View** → **Friends & Settings**, **Friends**, **Invite a Friend…**; **Always on top** and **Show on desktop** with a check mark (the desktop switch is grayed out until a friend is in); **Yard Sounds** with a check mark
  - **Window**
- **Shortcuts** (<kbd>⌘</kbd> on macOS, <kbd>Ctrl</kbd> on Windows and Linux):

| Keys | Does |
|---|---|
| <kbd>⌘</kbd> <kbd>1</kbd> | Open Friends & chat |
| <kbd>⌘</kbd> <kbd>2</kbd> | Open Invite a friend |
| <kbd>⌘</kbd> <kbd>,</kbd> | Open Settings |
| <kbd>⌘</kbd> <kbd>Shift</kbd> <kbd>P</kbd> | Open Friends & settings |
| <kbd>⌘</kbd> <kbd>Shift</kbd> <kbd>M</kbd> | Always on top on or off |
| <kbd>⌘</kbd> <kbd>Shift</kbd> <kbd>D</kbd> | Show on desktop, on or off |
| <kbd>⌘</kbd> <kbd>Shift</kbd> <kbd>S</kbd> | Yard sounds on or off |
| <kbd>⌘</kbd> <kbd>Q</kbd> | Quit PlayPets (macOS) |

## Data folder <Since v="0.1.0" />

| Operating system | Location |
|---|---|
| macOS | `~/Library/Application Support/app.playpets/` |
| Windows | `%APPDATA%\app.playpets\` |
| Linux | `~/.local/share/app.playpets/` |

| File | Contents |
|---|---|
| `state.json` | Friends, AI connections, settings and the yard's progress (list below) |
| `bridge.json` | The port and token for agent hooks. Rewritten every time the app starts |
| `pets/` | Pet folders imported from an address |
| `builtin/` | Four bundled starter entries, unpacked and checked at each start. Each has its own baseline artwork |

- `state.json` holds:
  - friends: name, personality and where it came from, relationship, what it calls you, size, position, chosen AI connection
  - the list of AI connections (without keys)
  - language, desktop mode and roaming, each agent's friend, auto chatter, auto digging, yard sounds and their volume
  - the window's position and size and Always on top setting
  - the garden and decorations (`garden`), the album (`album`), closeness (`bonds`)
  - hand-picked pet folders
  - the file's format number (`schema`)
- A `state.json` written by a newer version is copied aside, and the parts this version knows are read.

**Startup notices**

If a friend can't load when the app opens, a collapsed **Startup notices** card floats just above the dock. It doesn't take any space from the yard. Open it to read the details.

When it says pet files are missing:
1. Check the original pet folder and its files.
2. Restore them if needed.
3. Quit and open PlayPets again.

When the yard is at its 12-friend limit, free a slot before opening the app again.

These notices don't delete the saved friend records. Dismissing the card hides it for this session, and new notices bring it back.

## Environment variables

| Variable | What it does |
|---|---|
| `PLAYPETS_DATA` | Moves the data folder somewhere else. Terminal commands (`playpets say` and so on) read the same value |
| `CODEX_HOME` | Codex's home folder. The Codex pet folder in Invite a friend becomes `$CODEX_HOME/pets` |
| `PLAYPETS_LANG` | Forces the language (`ko`, `en`, `ja`, `zh-hans`) |
| `PLAYPETS_PET` | The default friend for terminal commands. Same as the `--pet` option |
| `PLAYPETS_BRIDGE` | The path to the `bridge.json` that terminal commands read. Same as the `--bridge` option |

- Set them in the environment the app runs in: start the app from a terminal, or use your operating system's environment variable settings.

## What is saved and what is not <Since v="0.1.0" />

**Saved**

- Each friend's name, personality, relationship, what it calls you, size and position in the yard
- Each friend's closeness
- The garden, the decorations in the yard and the album
- The kind, server address and model name of each AI connection
- Language, desktop mode and strolling, the window position, size and Always on top setting, the chosen time of day, weather and season
- Imported pet files and where they came from

**Saved differently**

- API keys do not go into `state.json`.
  - Kept only in this computer's secure storage (macOS Keychain, Windows Credential Manager, Linux Secret Service).
  - Deleting the connection deletes them too.

**Not saved**

- Conversations with your friends. Only in memory; gone when you quit the app.
- The memory of a coding agent's recent activity. Gone when you quit the app.
- Positions during a game. Friends go back to where they were when the game ends.

To remove every trace after uninstalling, delete the data folder and the PlayPets entries in the secure storage too.
