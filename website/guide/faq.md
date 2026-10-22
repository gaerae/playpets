# FAQ

## Does it cost anything?

The app is free and open source under the MIT license. Chatting through a signed-in Claude Code or Codex CLI subscription uses your plan's allowance without a separate API bill; plan limits and optional purchased credits still apply. Local Ollama models run on your computer without hosted inference fees. API-key connections, compatible servers and Ollama cloud models follow their provider's billing. See [AI connections](./chat.md#kinds-of-ai-connections).

## Does it work without the internet?

Inviting, games, desktop mode, and time of day and weather all work without the internet. Auto weather does not fetch the real weather either; it is decided by the clock. The internet is needed for importing community pets, checking for updates, and chatting with an AI that uses the internet. A downloaded local Ollama model can chat offline and keeps conversations on your computer. An Ollama cloud model needs the internet.

## Does my code or my prompt go to the pet?

[Coding-agent hooks](./agents.md) omit user prompts and tool inputs. The local bridge uses `127.0.0.1` and token authentication. Short completion or notification reports, including a clipped agent answer, may contain work details and can be included in a friend’s conversation with your chosen AI provider. Review what you send through terminal or MCP messages; use a downloaded local model when those details need to stay on this computer.

## It won't open on macOS.

The release files are not signed or notarised, so macOS may show a warning. Check that the download came from this project's release page. If your system offers **Open Anyway**, the [install guide](./install.md#macos) explains the steps. Available options depend on the warning and your system's policy.

## Windows shows a warning.

SmartScreen may warn about an unsigned or unfamiliar download. Check its source first. Some systems offer **More info** and **Run anyway**; managed devices may prevent this. See the [install guide](./install.md#windows) for details. Code signing is planned.

## AI chat doesn't work on Windows.

If you installed Claude Code or Codex CLI with npm, they must be in `%APPDATA%\npm` for the app to find them. First check that `claude` or `codex` runs in the terminal, then see whether its card in the connection window is marked "Installed". The Windows build has not been tested enough on real machines yet, so if it still does not work, let us know in an [issue](https://github.com/gaerae/playpets/issues).

## The pet is slow or uses battery.

Friends are drawn often only while they are moving, and rarely when they are still. Close the yard window to hide it and the yard is not drawn at all. If it still uses a lot, try fewer friends or turn off **Stroll on desktop** in desktop mode. Telling us which state it happens in (yard only, desktop only, or both) helps us fix it.

## Can I make my own pet?

Yes. One folder with a `pet.json` and a sprite sheet is a pet. The format is the same as Codex pets. You can invite the folder you made right away with **Import from a folder on this computer** in **Import a pet**. The full rules are in [Import a pet](./import.md#make-your-own) and the developer docs under [Pet file format](/dev/standards/pet-files).

## What about several monitors?

In [Desktop mode](./desktop.md) a friend can be on any monitor. Drag a friend to another monitor and they stay there. The monitors can have different scaling.

## Where is my data?

On macOS it is `~/Library/Application Support/app.playpets/`, on Windows `%APPDATA%\app.playpets\`, and on Linux `~/.local/share/app.playpets/`. Friends and settings are in `state.json`, imported pets in `pets/`, and the starter pets in `builtin/`. API keys are not here; they are in the OS's secure storage. PlayPets does not save chat history to files; it lasts only for the current app session. The connected provider may have its own retention policy. See [Settings](./settings.md#data-folder) for details.
