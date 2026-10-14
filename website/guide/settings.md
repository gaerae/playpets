---
description: General settings, About and app updates, menus and shortcuts, quitting, the data folder and environment variables, what is saved and what is not
---

# Settings

Open **Menu → Settings**, use <kbd>⌘</kbd>/<kbd>Ctrl</kbd> <kbd>,</kbd>, or choose **Settings…** in the tray. Settings opens over the yard; click outside it or press <kbd>Esc</kbd> to close it. Its four groups are **General** (language and launch at login), **The yard** (season, automatic chatter and sound), **Coding agent hooks**, and **About PlayPets** (the logo, version, updates and project links). [Coding agent hooks](./agents.md) have their own guide.

The title and section menu stay visible while only the selected section scrolls. Select another group to change its contents; the app remembers the last group while you reopen Settings. Quit is in **About PlayPets**.

## Season

Open **Settings → Yard → Season** to choose Auto, Spring, Summer, Autumn or Winter. Auto follows the local calendar. Your choice is saved and changes the scenery and seasonal companion outfits in normal and mini mode. Desktop companions also follow it; synchronization can take up to a minute. Spring and autumn use the layered everyday outfits. Festivals still follow their real dates.

## Language <Since v="0.1.0" />

Choose from 한국어, English, 日本語 and 简体中文. At first it follows the system language; changing it reloads the yard and the desktop windows in the new language. The tray menu and the window title change too. The chosen language is saved as `language` in `state.json`.

Your friends’ greetings and idle chatter use the selected language. AI replies use it by default; you can explicitly ask for another language in your latest message. Changing language cancels replies still being generated, but does not translate earlier messages. The app speaks English to coding agents and the terminal.

Start the app with the environment variable `PLAYPETS_LANG=ko|en|ja|zh-hans` and it takes priority over the saved language. This is for testing.

## Start PlayPets when you log in <Since v="0.1.0" />

Turn this on and PlayPets starts whenever you log in to your computer. It is off by default. With desktop mode on, the yard window does not open at login: your friends come out on the desktop, and the window waits in the tray. The system keeps this choice (Login Items on macOS, the Run list on Windows, an autostart entry on Linux), so turning it off in either place turns it off.

## Let them chat now and then <Since v="0.1.0" />

With this switch, in The yard, turned on, the friends with an AI have a short chat every 20 minutes. It is off by default. These calls use your subscription allowance or your provider's billing; local Ollama models have no hosted inference fee. Turn it on when you want it. A round is skipped while the window is hidden or someone is answering.

## Yard sounds <Since v="0.1.0" />

The yard has its own sounds: a breeze, small waves on the lake, gusts through the leaves, birds by day (most in the morning), crickets on summer and autumn nights, and rain when it rains. Friends make small sounds too: a soft note when you pat one, a drop when a fish bites, a splash when it is landed, a little tune for a gift or a new closeness level. They change with the time of day, the weather and the season.

- They are on by default, at a low volume, and start after your first click in the window.
- They play only while the yard can be seen. When the window is hidden or minimized, or only the desktop friends are out, the yard is silent. Mini mode keeps them.
- To turn them off or on, use the speaker in **Menu**, the tray’s **Yard Sounds** switch, this switch, **View** → **Yard Sounds** in the macOS menu bar, or <kbd>⌘</kbd>/<kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>S</kbd>. The **Volume** slider under the switch sets how loud they are.

## About PlayPets <Since v="0.1.0" />

The last section of the Settings tab shows the version and holds **App updates**, then opens this site's pages and the project on GitHub: **Website**, **User guide**, **Release notes**, **GitHub**, **Report a problem** (a new issue) and **License** (MIT). They open in your browser.

### App updates <Since v="0.1.0" />

The row shows the current version. Click **Check for updates** and the app reads `latest.json` from GitHub releases; if you are current, it says "You're up to date".

When there is a new version, whether this check, the quiet one 20 seconds after the app starts, or one from the menus found it:

- Open **Menu** to see the new-version button and the dot on **Settings**.
- The button opens the update window: **What's new** opens that version's page on this site, and **Later** puts the update button away until the next start (the row and the dot stay). **Install and restart** shows download progress, then the signature check and installation before the app restarts. If the download size is unavailable, the bar moves without a percentage. A failure stays in the window so you can retry. Your friends and settings stay.
- The row in About offers **What's new** and opens the same update window before installation.

If it could not check, look at your network, and keep in mind that the Windows portable zip is not covered by automatic updates. See [Install](./install.md#updates) for details.

## Quit the app <Since v="0.1.0" />

The yard window's close button only hides the window; the app stays in the tray. Friends on the desktop and the agent hooks keep running.

To really quit, click **Quit the app** in **Menu → Settings → About PlayPets**. A "Quit PlayPets?" confirmation appears. Conversations are not saved, and friends on the desktop go too. **Quit** in the tray menu does the same.

## Menus and shortcuts <Since v="0.1.0" />

- **Tray menu** (the cat in the menu bar or taskbar): **Open the yard**, **Friends** (when friends are present) and **Invite a Friend…**; display switches for **Mini mode**, **Show on the desktop** and, while desktop mode is on, **Stroll around the desktop**; then **Yard Sounds**, **Settings…**, **Check for updates…**, **About PlayPets** and **Quit**. The display switches are omitted when there are no friends; Invite and Sound remain available. Sound shows a check mark when on. An available update changes the update label to **Update to v…**. On Windows, left-click opens the yard and right-click opens the menu. A small blue or red mark signals an agent waiting for you or reporting trouble; the tooltip names its friend.
- **macOS menu bar**: **PlayPets** → **About PlayPets**, **Check for Updates…**, **Settings…**, hiding and **Quit PlayPets**; **Edit** for cut, copy and paste in text fields; **View** → **Friends**, **Invite a Friend…**, and **Mini mode** and **Show on the desktop** with a check mark (greyed until a friend is in), and **Yard Sounds** with a check mark; **Window**.
- **Shortcuts** (<kbd>⌘</kbd> on macOS, <kbd>Ctrl</kbd> on Windows and Linux):

| Keys | Does |
|---|---|
| <kbd>⌘</kbd> <kbd>1</kbd> | Open the Friend tab |
| <kbd>⌘</kbd> <kbd>2</kbd> | Open the Invite tab |
| <kbd>⌘</kbd> <kbd>,</kbd> | Open Settings |
| <kbd>⌘</kbd> <kbd>Shift</kbd> <kbd>M</kbd> | Mini mode on or off |
| <kbd>⌘</kbd> <kbd>Shift</kbd> <kbd>D</kbd> | Show on the desktop, on or off |
| <kbd>⌘</kbd> <kbd>Shift</kbd> <kbd>S</kbd> | Yard sounds on or off |
| <kbd>⌘</kbd> <kbd>Q</kbd> | Quit (macOS) |

## Data folder <Since v="0.1.0" />

| Operating system | Location |
|---|---|
| macOS | `~/Library/Application Support/app.playpets/` |
| Windows | `%APPDATA%\app.playpets\` |
| Linux | `~/.local/share/app.playpets/` |

| File | Contents |
|---|---|
| `state.json` | Friends (name, personality and where it came from, relationship, what it calls you, size, position, chosen AI connection), the list of AI connections (without keys), language, desktop mode and roaming, each agent's friend, auto chatter, yard sounds and their volume, the mini window's place and size (`miniRect`), the garden and decorations (`garden`), the album (`album`), closeness (`bonds`), hand-picked pet folders, the file's format number (`schema`). A file written by a newer version is copied aside and read for the parts this version knows |
| `bridge.json` | The port and token for agent hooks. Rewritten every time the app starts |
| `pets/` | Pet folders imported from an address |
| `builtin/` | Three bundled starter entries, unpacked and checked at each start. Each has its own baseline artwork |

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
- Language, desktop mode and strolling, mini mode and the mini window's place and size, the chosen time of day, weather and season
- Imported pet files and where they came from

**Saved differently**

- API keys do not go into `state.json`. They are kept only in this computer's secure storage (macOS Keychain, Windows Credential Manager, Linux Secret Service), and deleting the connection deletes them too.

**Not saved**

- Conversations with your friends. They live only in memory and are gone when you quit the app.
- The memory of a coding agent's recent activity. Gone when you quit the app.
- Positions during a game. Friends go back to where they were when the game ends.

To remove every trace after uninstalling the app, delete the data folder and the PlayPets entries in the secure storage as well.
