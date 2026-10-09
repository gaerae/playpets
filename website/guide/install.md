---
description: Picking the installer for your operating system, the warning on first launch, updates and the data folder
---

# Install

Get the installer from [GitHub releases](https://github.com/gaerae/playpets/releases/latest). File names look like `PlayPets_version_os.extension`.

::: warning You will see a warning on first launch
The release files are not code-signed yet. So macOS Gatekeeper and Windows SmartScreen block the first launch once. This is not a problem with the app, only a warning because there is no signature. Signing is planned, and this note will change once it is ready. Follow the steps for your operating system below to get past it.
:::

## macOS <Since v="0.1.0" />

| File | For |
|---|---|
| `PlayPets_version_macos-universal.dmg` | Both Apple Silicon and Intel |

1. Open the dmg and drag PlayPets into the Applications folder.
2. Open PlayPets once. A message such as "unidentified developer" or "cannot be opened" appears and the app closes.
3. Go to System Settings > Privacy & Security. Near the bottom there is a note about PlayPets and an **Open Anyway** button.
4. Click **Open Anyway** and confirm with your password or Touch ID. From then on it opens right away.

From macOS 15 the Control-click trick to open is gone, so you have to go through System Settings.

## Windows <Since v="0.1.0" />

| File | For |
|---|---|
| `PlayPets_version_windows-x64-setup.exe` | Installer for regular PCs (x64) |
| `PlayPets_version_windows-arm64-setup.exe` | Installer for ARM PCs |
| `PlayPets_version_windows-x64-portable.zip`, `…_windows-arm64-portable.zip` | Unzip and run, no installation |

1. Run the installer. SmartScreen shows the "Windows protected your PC" window.
2. Click **More info**. A **Run anyway** button appears.
3. Click **Run anyway** and follow the installer.

For the portable zip, unzip it into any folder and run `playpets.exe`. The SmartScreen warning appears here too, and you get past it the same way.

On an ARM PC (Snapdragon and the like), use the arm64 file. The x64 one runs there too, through emulation, but its installer and uninstaller cannot close a running PlayPets for you: quit it from the tray first.

::: tip
The Windows build was checked in a virtual machine, but has not been tested enough on real machines yet. If something looks wrong, let us know in a [GitHub issue](https://github.com/gaerae/playpets/issues).
:::

## Linux <Since v="0.1.0" />

| File | For |
|---|---|
| `PlayPets_version_linux-x64.deb`, `…_linux-arm64.deb` | Debian and Ubuntu family |
| `PlayPets_version_linux-x64.AppImage`, `…_linux-arm64.AppImage` | Runs on any distribution |

Install the deb with your package manager. For the AppImage, make it executable and run it.

```sh
chmod +x PlayPets_*.AppImage
./PlayPets_*.AppImage
```

::: tip Good to know on Linux
- The AppImage needs FUSE 2. Ubuntu 22.04 and later do not ship it: run `sudo apt install libfuse2` once, or start the app with `./PlayPets_*.AppImage --appimage-extract-and-run`.
- Closing the window leaves the app in the tray. GNOME hides tray icons unless the "AppIndicator and KStatusNotifierItem Support" extension is on. Even without the icon, starting the app again brings the yard back.
- API keys go to the Secret Service (GNOME Keyring, KWallet). Without one, saving a connection that needs a key shows a message that the secure store cannot be reached. Ollama and the subscription CLIs need no key.
:::

## Updates <Since v="0.1.0" />

- Check now with **Check for updates** under **About PlayPets** in the Settings tab, **Check for updates…** in the tray menu, or **PlayPets → Check for Updates…** in the macOS menu bar.
- A new version shows as a button in the top bar and a dot on the Settings tab. The button opens the update window: **What's new**, **Later** or **Install and restart** (with a progress bar).
- 20 seconds after the app starts, it checks once quietly. If there is a new version, a notice appears and you can install it from the Settings tab.
- New versions are found through `latest.json` in GitHub releases. A downloaded file is installed only after it is verified with the update signing key. A file that fails verification is not installed.
- The Windows portable zip is not covered by automatic updates. Download the new zip and replace it.

## Uninstall

| Operating system | How |
|---|---|
| macOS | Move PlayPets from the Applications folder to the Trash |
| Windows installer | Remove PlayPets in Settings > Apps |
| Windows portable | Delete the folder you unzipped |
| Linux deb | Remove it with the package manager you installed it with |
| Linux AppImage | Delete the file |

The data folder below stays after you remove the app. To remove the settings and imported pets too, delete the data folder as well.

## Data folder <Since v="0.1.0" />

| Operating system | Location |
|---|---|
| macOS | `~/Library/Application Support/app.playpets/` |
| Windows | `%APPDATA%\app.playpets\` |
| Linux | `~/.local/share/app.playpets/` |

Inside are `state.json` (friends and settings), `bridge.json` (the port and token for agent hooks), `pets/` (imported pets) and `builtin/` (the three starter pets). To keep it somewhere else, put a folder path in the `PLAYPETS_DATA` environment variable and start the app. See [Settings](./settings.md) for details.
