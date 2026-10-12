---
description: Picking the installer for your operating system, the warning on first launch, updates and the data folder
---

# Install

Get the installer from [GitHub releases](https://github.com/gaerae/playpets/releases/latest). File names look like `PlayPets_version_os.extension`.

::: warning macOS and Windows may warn before opening
The release files are not code-signed yet, and the macOS app is not notarized. Gatekeeper or SmartScreen may warn or block opening it. These checks do not establish that the file is safe; only continue if you trust the download from the official release page. The available controls depend on your operating system and device policy. Signing is planned.
:::

## macOS <Since v="0.1.0" />

| File | For |
|---|---|
| `PlayPets_version_macos-universal.dmg` | Both Apple Silicon and Intel |

1. Open the dmg and drag PlayPets into the Applications folder.
2. Try opening PlayPets. If macOS reports an unidentified developer or says it cannot verify the app, close the alert.
3. Go to System Settings > Privacy & Security. Look for the note about PlayPets and **Open Anyway**.
4. If that option is available and you trust the download, click **Open Anyway**, authenticate if asked, then click **Open** in the next alert. macOS saves an exception for the app.

These steps follow [Apple's guide to safely opening apps](https://support.apple.com/en-us/102445). If macOS says the app will damage your computer, do not treat that as an unidentified-developer warning. Managed devices may restrict opening apps.

## Windows <Since v="0.1.0" />

| File | For |
|---|---|
| `PlayPets_version_windows-x64-setup.exe` | Installer for regular PCs (x64) |
| `PlayPets_version_windows-arm64-setup.exe` | Installer for ARM PCs |
| `PlayPets_version_windows-x64-portable.zip`, `…_windows-arm64-portable.zip` | Unzip and run, no installation |

1. Run the installer. If SmartScreen shows "Windows protected your PC" for an unrecognized app, check that the file came from the official release page.
2. If you trust the download, select **More info** to see the available options.
3. If **Run anyway** is available, select it to continue with the installer. If it is unavailable, your device's security settings or organization policy may prevent continuation.

For the portable zip, unzip it into any folder and run `playpets.exe`. The same unrecognized-app warning may appear. SmartScreen evaluates file and publisher reputation, so a new version can warn again. See [Microsoft's explanation of SmartScreen reputation](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation). Keep the protections enabled; a malware warning is a different case from an unrecognized-app warning.

On an ARM PC (Snapdragon and the like), use the arm64 file. The x64 one runs there too, through emulation, but its installer and uninstaller cannot close a running PlayPets for you: quit it from the tray first.

::: tip
The Windows build was checked in a virtual machine, but has not been tested enough on real machines yet. If something looks wrong, let us know in a [GitHub issue](https://github.com/gaerae/playpets/issues).
:::

## Linux <Since v="0.1.0" />

| File | For |
|---|---|
| `PlayPets_version_linux-x64.deb`, `…_linux-arm64.deb` | Debian and Ubuntu family |
| `PlayPets_version_linux-x64.AppImage`, `…_linux-arm64.AppImage` | Compatible Linux distributions |

Install the deb with your package manager. For the AppImage, make it executable and run it.

```sh
chmod +x PlayPets_*.AppImage
./PlayPets_*.AppImage
```

::: tip Good to know on Linux
- The AppImage needs FUSE 2. On Ubuntu 22.04, install it with `sudo apt install libfuse2`; on Ubuntu 24.04, the renamed package is `sudo apt install libfuse2t64`. See the [AppImage FUSE guide](https://docs.appimage.org/user-guide/troubleshooting/fuse.html) for your distribution. Without FUSE, start it with `./PlayPets_*.AppImage --appimage-extract-and-run`.
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

Inside are `state.json` (friends and settings), `bridge.json` (the port and token for agent hooks), `pets/` (imported pets) and `builtin/` (the ten starter pets). To keep it somewhere else, put a folder path in the `PLAYPETS_DATA` environment variable and start the app. See [Settings](./settings.md) for details.
