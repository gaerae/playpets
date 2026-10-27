# Guide

- PlayPets is a shared yard for companions who talk to you and each other.
- Invite a starter or import a compatible community pet file, then choose a name, personality and relationship.
- Codex itself is not required.
- The first yard opens on a sunny spring day. Choose a season, time and weather, or set them to Auto.
- Friends stroll, eat treats and play three games.
- Dig to find flower seeds and saplings.
- Gifts: one per local calendar day for the whole yard, shared by all friends.
- Grow flowers, fish and catch bugs for the album; grow closer over time.
- Resize the window to keep the yard beside your work. Desktop mode lets friends roam over other windows.
- Conversation needs a local model, a signed-in CLI or another AI connection. Coding-agent hooks are optional.

## What you need

| Item | Details |
|---|---|
| Operating system | macOS, Windows, Linux |
| AI | Optional. Inviting, playing and desktop mode all work without one |
| Coding agent | Optional. Works with Claude Code, Codex CLI, Gemini CLI, Cursor and tools that use MCP |
| Internet | Needed for downloads, community imports, updates and remote AI. Yard activities and a local Ollama model already downloaded to your computer can work offline |

- Built with Tauri: uses the operating system's webview instead of bundling a full browser.

## Two words

- **Pet:** a character file. One folder with a `pet.json` and a sprite sheet is one pet.
  - Pets in Codex's pet folder show up automatically.
  - You can also import pets from community sites or pick a folder on your computer.
- **Friend:** a pet you invited into the yard.
  - Invite the same pet several times to get several friends.
  - Each has its own name, personality, size and AI.

## Read in this order

1. [Install](./install.md) — picking a file, getting past the first-launch warning, updates, the data folder
2. [Your first friend](./first-friend.md) — making a friend with Invite a friend, patting them in the yard
3. [Talking with friends](./chat.md) — kinds of AI connections, personality, chatting with several friends at once
4. [Coding agents](./agents.md) — letting your friend see what the agent is doing
5. [Desktop mode](./desktop.md) — sending friends out onto the desktop
6. [The yard and games](./play.md) — time of day, weather and seasons, garden and gifts, fishing and bugs, album, closeness, events, sounds, three games, resizing the window
7. [Importing pets](./import.md) — community pets and pet folders on your computer
8. [Settings](./settings.md) — language, updates, quitting, what is saved and what is not
9. [FAQ](./faq.md)

- First time: steps 1 to 3 are enough. Open the rest when you need it.
