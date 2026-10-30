# FAQ

## What is PlayPets?

- PlayPets is a free, open-source desktop pet app for macOS, Windows and Linux that plays your Codex pets, up to 12 at once.
- They share a small yard and can head out onto your desktop. The ChatGPT desktop app shows the one pet you pick ([OpenAI's guide](https://learn.chatgpt.com/docs/pets), October 2026).
- They talk with you and with each other through the AI you connect, and react while Claude Code, Codex, Gemini CLI or Cursor works.

## Does it work with Codex pets?

- "Codex pet" is what people call the custom pets made for ChatGPT and Codex. OpenAI calls the feature Pets.
- Yes. PlayPets reads Codex pet files as they are: a folder with a `pet.json` and a sprite sheet. It plays every action, and the sixteen look directions when the sheet has them.
- Pets in Codex's pet folder (`~/.codex/pets`) show up in **Invite a friend** on their own. [Bring in more](./import.md) from community sites, a GitHub folder or a folder on your computer.
- You don't need Codex. If you use the ChatGPT desktop app, keep your pet there too; PlayPets reads the same pet files.

## Does it cost anything?

- The app is free and open source under the MIT license.
- What chatting costs depends on the AI ([AI connections](./chat.md#kinds-of-ai-connections)):

| Connection | Cost |
|---|---|
| Signed-in Claude Code or Codex CLI subscription | Uses your plan's allowance, no separate API bill. Plan limits and optional purchased credits still apply |
| Local Ollama model | Runs on your computer, no hosted inference fees |
| API-key connections, compatible servers, Ollama cloud models | Their provider's billing |

## Does it work without the internet?

- Works offline: inviting, games, desktop mode, time of day and weather.
- Auto weather does not fetch the real weather either; the clock decides it.
- Needs the internet: importing community pets, checking for updates, chatting with an AI that uses the internet.
- A downloaded local Ollama model chats offline and keeps conversations on your computer.
- An Ollama cloud model needs the internet.

## Does my code or my prompt go to the pet?

- [Coding-agent hooks](./agents.md) omit user prompts and tool inputs.
- The local bridge uses `127.0.0.1` and token authentication.
- Short completion or notification reports, including a clipped agent answer, may contain work details. They can be included in a friend’s conversation with your chosen AI provider.
- Review what you send through terminal or MCP messages.
- Use a downloaded local model when those details need to stay on this computer.

## Something isn't working {#troubleshooting}

| What you see | Why | What to do |
|---|---|---|
| macOS won't open PlayPets | 1.2.0 and earlier aren't signed | Install 1.3.0 or later. For an older version, see [Open Anyway](./install.md#macos) |
| SmartScreen warns about the Windows installer | The installer from GitHub isn't code-signed yet | Install from the [Microsoft Store or winget](./install.md#microsoft-store), which Microsoft signs. Or check the source and choose **More info → Run anyway** ([installer from GitHub](./install.md#installer-from-github)) |
| The AppImage doesn't start on Linux | FUSE 2 is missing | Install `libfuse2` (Ubuntu 24.04: `libfuse2t64`), or run it with `--appimage-extract-and-run` ([Linux](./install.md#linux)) |
| The yard is gone after closing the window | Closing only hides it | Choose **Open the yard** from the tray icon. GNOME hides tray icons without the AppIndicator extension; starting the app again also brings the yard back |
| The friend says "Ready to play!" and doesn't answer | That friend has no AI | [Connect an AI](./chat.md#making-a-connection) |
| The Claude Code or Codex CLI card isn't marked **Installed** | The app can't find the command | Check that `claude` or `codex` runs in a terminal. On Windows, an npm install has to be in `%APPDATA%\npm` |
| Saving a connection says the secure storage can't be reached | The key store is locked or missing (on Linux, no Secret Service) | Allow PlayPets to use it, or use GNOME Keyring or KWallet on Linux. Ollama and the signed-in CLIs need no key |
| The friend doesn't react to the coding agent | The agent isn't connected, no new session was started, or the app moved | Press **Connect** or **Connect again** in **Settings → Coding tools**, or copy and paste the settings again, then start a new session ([Coding agent hooks](./agents.md)). Codex CLI shows only Done, never Working |
| Reports go to the wrong friend | No **Reacting friend** is picked, so the first friend gets them | Pick a Reacting friend in **Settings → Coding tools**, then press **Connect again** or copy and paste the settings again |
| A pet address won't import | The site isn't supported, or its files are on another site | Download the pet and import its folder or ZIP ([Import a pet](./import.md)) |
| It feels slow or uses battery | Friends are drawn often while they move | Close the yard window: a hidden yard isn't drawn. Try fewer friends, or turn off **Stroll on desktop** |

Something else? Tell us in an [issue](https://github.com/gaerae/playpets/issues) with your system and PlayPets version. The Windows build hasn't been tested enough on real machines yet.

## Can I make my own pet?

- Yes. One folder with a `pet.json` and a sprite sheet is a pet, in the same format as Codex pets.
- Invite it right away with **Import from a folder on this computer** in **Import a pet**.
- Full rules: [Import a pet](./import.md#make-your-own) and [Pet file format](/dev/standards/pet-files) in the developer docs.

## What about several monitors?

- In [Desktop mode](./desktop.md) a friend can be on any monitor.
- Drag a friend to another monitor and they stay there.
- The monitors can have different scaling.

## Where is my data?

| Operating system | Location |
|---|---|
| macOS | `~/Library/Application Support/app.playpets/` |
| Windows | `%APPDATA%\app.playpets\`. Microsoft Store, also through winget: inside the package's own folder |
| Linux | `~/.local/share/app.playpets/` |

- `state.json`: friends and settings. `pets/`: imported pets. `backgrounds/`: imported backgrounds. `builtin/`: the starter pets.
- API keys are not here. They are in the OS's secure storage.
- PlayPets does not save chat history to files. It lasts only for the current app session.
- The connected provider may have its own retention policy.
- Details: [Settings](./settings.md#data-folder).
