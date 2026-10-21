---
description: Language and startup, friends and AI, About and app updates, menus and shortcuts, quitting, the data folder and environment variables, what is saved and what is not
---

# Settings

Open **Friends & settings → Settings**. Settings always opens on its list of sections: **Language & startup**, **Friends & AI**, **Coding tools**, **App updates** and **About PlayPets**. [Coding tools](./agents.md) have their own guide. When an update is available, a dot shows on Settings in the menu.

Back from a section returns to the list, and Back from the list returns to Friends & settings. **About PlayPets** and **Check for updates…** in the tray and the macOS menu bar, and an update notice, open their section directly; Back still returns to the list. Close returns to the scenery. Season, sound and volume are in **Place & atmosphere → Atmosphere**.

## Language <Since v="0.1.0" />

Choose from 한국어, English, 日本語 and 简体中文. At first it follows the system language; changing it reloads the yard and the desktop windows in the new language. The tray menu and the window title change too. The chosen language is saved as `language` in `state.json`.

Your friends’ greetings and idle chatter use the selected language. AI replies use it by default; you can explicitly ask for another language in your latest message. Changing language cancels replies still being generated, but does not translate earlier messages. The app speaks English to coding agents and the terminal.

Start the app with the environment variable `PLAYPETS_LANG=ko|en|ja|zh-hans` and it takes priority over the saved language. This is for testing.

## Start PlayPets when you log in <Since v="0.1.0" />

Turn this on and PlayPets starts whenever you log in to your computer. It is off by default. With desktop mode on, the yard window does not open at login: your friends come out on the desktop, and the window waits in the tray. The system keeps this choice (Login Items on macOS, the Run list on Windows, an autostart entry on Linux), so turning it off in either place turns it off.

## Friends & AI <Since v="1.2.0" />

**Friends & AI** lists every AI connection, with how many friends use it and an **Edit** button. **Edit** and **Connect an AI** (for a new one) open the connection form in place inside this section, with no window over Settings. **Esc** folds the form; if you have typed something, it says "You have changes here. Save them, or press Cancel to discard them." instead. Editing a connection here moves no friend to it. With no connection yet, friends still play and react. How to make a connection is in [Chat with a friend](./chat.md#making-a-connection).

## Let them chat now and then <Since v="0.1.0" />

With this switch in Friends & AI turned on, the friends with an AI have a short chat every 20 minutes. It is off by default. These calls use your subscription allowance or your provider's billing; local Ollama models have no hosted inference fee. Turn it on when you want it. A round is skipped while the window is hidden or someone is answering.

## Let them dig on their own now and then <Since v="1.2.0" />

With this switch in Friends & AI turned on, an idle friend digs a spot of its own every few minutes while the yard is shown. It is off by default and needs no AI connection. No friend digs on its own during a game or while you hold a tool, nor in places without soil such as Cozy living room. What it finds is kept as with any other dig.

## About PlayPets <Since v="0.1.0" />

**About PlayPets** shows the version and links to the website, user guide, release notes, GitHub, issue reporting and license. Links open in your browser. App updates have their own section.

## App updates <Since v="0.1.0" />

For a Microsoft Store installation, updates are managed by Store. Open **Microsoft Store → Library** to check. The GitHub installer update flow below applies to installations outside MSIX. Test MSIX packages also use package-managed updates. See the [privacy policy](../privacy.md) for storage and network details.

The row shows the current version. Click **Check for updates** and the app reads `latest.json` from GitHub releases; if you are current, it says "You're up to date".

The app quietly checks 20 seconds after startup and retries every six hours. You can also check manually. When an update is available, its entry opens **Friends & settings → Settings → App updates**.

**What's new** opens the release page in your browser. **Install and restart**, download progress, verification, installation and retry after a failure all stay in App updates; no separate update window opens. If the download size is unavailable, progress has no percentage. Friends and settings stay after the restart. A brief notice confirms the installed version.

## Quit PlayPets <Since v="0.1.0" />

Open **Friends & settings** and choose **Close window** to hide the yard in the tray while desktop friends and agent hooks keep running. **Quit PlayPets** beside it exits at once, the same as **Quit PlayPets** in the tray and <kbd>⌘</kbd> <kbd>Q</kbd> on macOS; conversations are not saved. These actions are not direct items in the scenery right-click menu: choose Friends & settings first.

## Menus and shortcuts <Since v="0.1.0" />

- **Tray menu** (the cat in the menu bar or taskbar): **Open the yard**, **Friends** (when friends are present) and **Invite a Friend…**; display switches for **Always on top**, **Show on desktop** and, while desktop mode is on, **Stroll on desktop**; then **Yard Sounds**, **Settings…**, **Check for updates…**, **About PlayPets** and **Quit PlayPets**. Always on top remains available without friends; desktop switches appear once a friend is present. Sound shows a check mark when on. An available update changes the update label to **Update to v…**. On Windows, left-click opens the yard and right-click opens the menu. A small blue or red mark signals an agent waiting for you or reporting trouble; the tooltip names its friend.
- **macOS menu bar**: **PlayPets** → **About PlayPets**, **Check for Updates…**, **Settings…**, hiding and **Quit PlayPets**; **Edit** for cut, copy and paste in text fields; **View** → **Friends & Settings**, **Friends**, **Invite a Friend…**, and **Always on top** and **Show on desktop** with a check mark (the desktop switch is greyed until a friend is in), and **Yard Sounds** with a check mark; **Window**.
- **Shortcuts** (<kbd>⌘</kbd> on macOS, <kbd>Ctrl</kbd> on Windows and Linux):

| Keys | Does |
|---|---|
| <kbd>⌘</kbd> <kbd>1</kbd> | Open Friends & chat |
| <kbd>⌘</kbd> <kbd>2</kbd> | Open Invite a friend |
| <kbd>⌘</kbd> <kbd>,</kbd> | Open Settings (the list of sections) |
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
| `state.json` | Friends (name, personality and where it came from, relationship, what it calls you, size, position, chosen AI connection), the list of AI connections (without keys), language, desktop mode and roaming, each agent's friend, auto chatter, auto digging, yard sounds and their volume, the window's position and size and Always on top setting, the garden and decorations (`garden`), the album (`album`), closeness (`bonds`), hand-picked pet folders, the file's format number (`schema`). A file written by a newer version is copied aside and read for the parts this version knows |
| `bridge.json` | The port and token for agent hooks. Rewritten every time the app starts |
| `pets/` | Pet folders imported from an address |
| `builtin/` | Four bundled starter entries, unpacked and checked at each start. Each has its own baseline artwork |

If a friend cannot load when the app opens, a collapsed **Startup notices** card floats at the top of the yard without reducing its space. Open it to read the details. For missing pet files, check the original pet folder and its files, restore them if needed, then quit and open PlayPets again. If the yard has reached its 12-friend limit, free a slot before opening the app again. These notices do not delete the saved friend records. Dismissing the card hides it for this session; new notices make it appear again.

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

- Each friend's name, personality, relationship, what it calls you, size and position in the yard
- Each friend's closeness
- The garden, the decorations in the yard and the album
- The kind, server address and model name of each AI connection
- Language, desktop mode and strolling, the window position, size and Always on top setting, the chosen time of day, weather and season
- Imported pet files and where they came from

**Saved differently**

- API keys do not go into `state.json`. They are kept only in this computer's secure storage (macOS Keychain, Windows Credential Manager, Linux Secret Service), and deleting the connection deletes them too.

**Not saved**

- Conversations with your friends. They live only in memory and are gone when you quit the app.
- The memory of a coding agent's recent activity. Gone when you quit the app.
- Positions during a game. Friends go back to where they were when the game ends.

To remove every trace after uninstalling the app, delete the data folder and the PlayPets entries in the secure storage as well.
