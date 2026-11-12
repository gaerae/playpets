# Guide

PlayPets is a shared yard for companions who talk to you and to each other. Invite a starter or import a compatible community pet file, then give it a name, a personality and a relationship. You don't need Codex itself.

## What you can do

| Thing | In short | Page |
|---|---|---|
| Invite friends | Four starter friends come with the app, any Codex pet can join, up to 12 at once | [Your first friend](./first-friend.md) |
| Chat | A friend needs a local model, a signed-in CLI or another AI connection | [Talking with friends](./chat.md) |
| Play in the yard | The first yard opens on a sunny spring day. Pick the season, time and weather, or leave them on Auto. Friends stroll, eat treats and play four games (one only in winter) | [The yard and games](./play.md) |
| Grow and collect | Digging turns up flower seeds and saplings. Grow flowers, fish and catch bugs to fill the album | [The yard and games](./play.md) |
| Gifts and closeness | Friends you play with bring gifts: one every other day for the whole yard, and another each time a friend grows closer | [Gifts](./play.md#gifts) |
| Keep it beside your work | Resize the window, or switch to desktop mode and let friends roam over your other windows | [Desktop mode](./desktop.md) |
| Coding agents | Optional hooks let a friend react while your agent works | [Coding agents](./agents.md) |

## What you need

| Item | Details |
|---|---|
| Operating system | macOS, Windows, Linux |
| AI | Optional. Inviting, playing and desktop mode all work without one |
| Coding agent | Optional. Works with Claude Code, Codex CLI, Gemini CLI, Cursor, Grok Build, Qoder, Kimi Code and tools that use MCP |
| Internet | Needed for downloads, community imports, updates and remote AI. Yard activities and a local Ollama model already downloaded to your computer can work offline |

PlayPets is built with Tauri, so it uses your operating system's webview instead of bundling a full browser.

## Two words

| Word | Means |
|---|---|
| Pet | A character file: one folder with a `pet.json` and a sprite sheet. Pets in Codex's pet folder show up automatically; you can also import pets from community sites or pick a folder on your computer |
| Friend | A pet you invited into the yard. Invite the same pet several times and you get several friends, each with its own name, personality, size and AI |

## Get started

1. Install PlayPets ([Install](./install.md)) and open it. The yard asks **Who would you like to play with?**
2. Click one of the four friends. It comes into the yard and waves. Click it again to pat it: it jumps and shows a heart.
3. Connect an AI. If Claude Code or Codex CLI is on this computer, press **Connect now** on the **Next up** card. Otherwise follow [Making a connection](./chat.md#making-a-connection). Then click the friend's name tag and say hello: the answer shows in the chat and as a speech bubble in the yard.
4. Optional: open **Friends & settings → Settings → Coding tools**, press **Connect** next to the tool you use and confirm. Start a new session in the agent. While it works, the dot on your friend's name tag, beside its name, pulses orange ([Coding agent hooks](./agents.md)).

Something not working? See [the table in the FAQ](./faq.md#troubleshooting).

## All pages

| Page | What you'll find |
|---|---|
| [Install](./install.md) | Picking a file, getting past the first-launch warning, updates, the data folder |
| [Your first friend](./first-friend.md) | The four starter friends, Invite a friend, friend settings, patting and treats |
| [Talking with friends](./chat.md) | Kinds of AI connections, personality, relationship, chatting with several friends at once |
| [Coding agents](./agents.md) | Letting your friend see what the agent is doing |
| [Desktop mode](./desktop.md) | Sending friends, flowers and gifts out onto the desktop |
| [The yard and games](./play.md) | Places, time of day, weather and seasons, garden and gifts, fishing and bugs, the album, closeness, seasonal events (on their dates, or any day you pick their scene), sounds, four games, resizing the window |
| [Importing pets](./import.md) | Community pets, pet folders and ZIP files on your computer, making your own |
| [Character studio](./creator-kit.md) | A creation kit for making your own friend in your AI tool |
| [Background studio](./background-kit.md) | A creation kit for making your own place in your AI tool |
| [Settings](./settings.md) | Language, updates, quitting, what is saved and what is not |
| [FAQ](./faq.md) | Short answers and a troubleshooting table |
