# Guide

PlayPets is a shared yard for companions who talk to you and to each other. Invite a starter or import a compatible community pet file, then give it a name, a personality and a relationship. You don't need Codex itself.

The first yard opens on a sunny spring day. Pick the season, time and weather yourself, or leave them on Auto. Friends stroll, eat treats and play three games, and digging turns up flower seeds and saplings.

Friends you play with bring gifts: one every other day for the whole yard, and another each time a friend grows closer. Grow flowers, fish and catch bugs to fill the album, and you grow closer over time.

Resize the window to keep the yard beside your work, or switch to desktop mode and let friends roam over your other windows.

To chat, a friend needs a local model, a signed-in CLI or another AI connection. Coding-agent hooks are optional.

## What you need

| Item | Details |
|---|---|
| Operating system | macOS, Windows, Linux |
| AI | Optional. Inviting, playing and desktop mode all work without one |
| Coding agent | Optional. Works with Claude Code, Codex CLI, Gemini CLI, Cursor, Grok Build, Qoder, Kimi Code and tools that use MCP |
| Internet | Needed for downloads, community imports, updates and remote AI. Yard activities and a local Ollama model already downloaded to your computer can work offline |

PlayPets is built with Tauri, so it uses your operating system's webview instead of bundling a full browser.

## Two words

A pet is a character file: one folder with a `pet.json` and a sprite sheet is one pet. Pets in Codex's pet folder show up automatically. You can also import pets from community sites or pick a folder on your computer.

A friend is a pet you invited into the yard. Invite the same pet several times and you get several friends, each with its own name, personality, size and AI.

## Get started

1. Install PlayPets ([Install](./install.md)) and open it. The yard asks **Who would you like to play with?**
2. Click one of the four friends. It comes into the yard and waves. Click it again to pat it: it jumps and shows a heart.
3. Connect an AI. If Claude Code or Codex CLI is on this computer, press **Connect now** on the **Next up** card. Otherwise follow [Making a connection](./chat.md#making-a-connection). Then click the friend's name tag and say hello: the answer shows in the chat and as a speech bubble in the yard.
4. Optional: open **Friends & settings → Settings → Coding tools**, press **Copy settings** and paste it into the file the notice names. Restart the agent. While it works, the dot by your friend's head pulses orange ([Coding agent hooks](./agents.md)).

Something not working? See [the table in the FAQ](./faq.md#troubleshooting).

## All pages

1. [Install](./install.md) — picking a file, getting past the first-launch warning, updates, the data folder
2. [Your first friend](./first-friend.md) — making a friend with Invite a friend, patting them in the yard
3. [Talking with friends](./chat.md) — kinds of AI connections, personality, chatting with several friends at once
4. [Coding agents](./agents.md) — letting your friend see what the agent is doing
5. [Desktop mode](./desktop.md) — sending friends out onto the desktop
6. [The yard and games](./play.md) — time of day, weather and seasons, garden and gifts, fishing and bugs, album, closeness, events, sounds, three games, resizing the window
7. [Importing pets](./import.md) — community pets and pet folders on your computer
8. [Settings](./settings.md) — language, updates, quitting, what is saved and what is not
9. [FAQ](./faq.md)
