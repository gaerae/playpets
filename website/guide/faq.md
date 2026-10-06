# FAQ

## Does it cost anything?

The app is free and open source under the MIT license. Chatting through the Claude Code or Codex CLI subscription you already have costs nothing extra, and Ollama runs on your computer. Only when you connect the OpenAI API or a compatible server can that service's fees apply.

## Does it work without the internet?

Inviting, games, desktop mode, and time of day and weather all work without the internet. Auto weather does not fetch the real weather either; it is decided by the clock. The internet is needed for importing community pets, checking for updates, and chatting with an AI that uses the internet. If you chat through Ollama, that stays on your computer too.

## Does my code or my prompt go to the pet?

No. [Coding agent hooks](./agents.md) send only the status and short sentences, never what you type into the agent or your code. The hooks stay on this computer (`127.0.0.1`, token authentication). Conversations with your friend go only to the AI connection you chose separately.

## It won't open on macOS.

The release files are not signed or notarised, so Gatekeeper blocks the first launch. Go to System Settings > Privacy & Security and click **Open Anyway** near the bottom. You only do this once; after that it opens right away. The full steps are in [Install](./install.md#macos).

## Windows shows a warning.

Same reason. In SmartScreen's "Windows protected your PC" window, click **More info** and choose **Run anyway** and the installation continues. Code signing is planned.

## AI chat doesn't work on Windows.

If you installed Claude Code or Codex CLI with npm, they must be in `%APPDATA%\npm` for the app to find them. First check that `claude` or `codex` runs in the terminal, then see whether "Installed on this computer" shows above the connection window. The Windows build has not been tested enough on real machines yet, so if it still does not work, let us know in an [issue](https://github.com/gaerae/playpets/issues).

## The pet is slow or uses battery.

Friends are drawn often only while they are moving, and rarely when they are still. Close the yard window to hide it and the yard is not drawn at all. If it still uses a lot, try fewer friends or turn off **Stroll around the desktop** in desktop mode. Telling us which state it happens in (yard only, desktop only, or both) helps us fix it.

## Can I make my own pet?

Yes. One folder with a `pet.json` and a sprite sheet is a pet. The format is the same as Codex pets. You can invite the folder you made right away with **Import from a folder on this computer** in **Import a pet**. The full rules are in [Import a pet](./import.md#make-your-own) and the developer docs under [Pet file format](/dev/standards/pet-files).

## What about several monitors?

In [Desktop mode](./desktop.md) a friend can be on any monitor. Drag a friend to another monitor and they stay there. The monitors can have different scaling.

## Where is my data?

On macOS it is `~/Library/Application Support/app.playpets/`, on Windows `%APPDATA%\app.playpets\`, and on Linux `~/.local/share/app.playpets/`. Friends and settings are in `state.json`, imported pets in `pets/`, and the starter pets in `builtin/`. API keys are not here; they are in the OS's secure storage. Chat history is not saved anywhere. See [Settings](./settings.md#data-folder) for details.
