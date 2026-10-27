# FAQ

## What is PlayPets?

- PlayPets is a free, open-source desktop pet app for macOS, Windows and Linux that plays your Codex pets, up to 12 at once.
- They share a small yard and can head out onto your desktop. The ChatGPT desktop app shows the one pet you pick ([OpenAI's guide](https://learn.chatgpt.com/docs/pets), October 2026).
- They talk with you and with each other through the AI you connect, and react while Claude Code, Codex, Gemini CLI or Cursor works.

## Does it work with Codex pets?

- "Codex pet" is what people call the custom pets made for ChatGPT and Codex. OpenAI calls the feature Pets.
- Yes. PlayPets reads Codex pet files as they are: a folder with a `pet.json` and a sprite sheet. It plays every action, and the sixteen look directions when the sheet has them.
- Pets in Codex's pet folder (`~/.codex/pets`) show up on their own. [Bring in more](./import.md) from community sites, a GitHub folder or a folder on your computer.
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

## It won't open on macOS.

- From 1.3.0 the macOS app is signed and notarized. Make sure you have 1.3.0 or later.
- 1.2.0 and earlier are not signed, so macOS may show a warning.
- Check that the download came from this project's release page.
- If your system offers **Open Anyway**, follow the steps in the [install guide](./install.md#macos).
- Available options depend on the warning and your system's policy.

## Windows shows a warning.

- SmartScreen may warn about the installer from GitHub, which is not code-signed yet. Check its source first.
- Some systems offer **More info** and **Run anyway**. Managed devices may prevent this.
- Details: [install guide](./install.md#windows).
- To install without the warning, use the [Microsoft Store](./install.md#microsoft-store) or winget: Microsoft signs that package.

## AI chat doesn't work on Windows.

1. Claude Code or Codex CLI installed with npm must be in `%APPDATA%\npm` for the app to find them.
2. Check that `claude` or `codex` runs in the terminal.
3. Check that its card in the connection window is marked "Installed".
4. Still not working? The Windows build is not tested enough on real machines yet; tell us in an [issue](https://github.com/gaerae/playpets/issues).

## The pet is slow or uses battery.

- Friends are drawn often only while they move, rarely when still.
- Close the yard window to hide it: the yard is not drawn at all.
- Still heavy? Try fewer friends, or turn off **Stroll on desktop** in desktop mode.
- Tell us which state it happens in (yard only, desktop only, or both). It helps us fix it.

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
| Windows | `%APPDATA%\app.playpets\` |
| Linux | `~/.local/share/app.playpets/` |

- `state.json`: friends and settings. `pets/`: imported pets. `builtin/`: the starter pets.
- API keys are not here. They are in the OS's secure storage.
- PlayPets does not save chat history to files. It lasts only for the current app session.
- The connected provider may have its own retention policy.
- Details: [Settings](./settings.md#data-folder).
