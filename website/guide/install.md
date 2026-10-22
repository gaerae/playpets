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

1. Run the installer. If SmartScreen shows "Windows protected your PC" for an unrecognized app, check that the file came from the official release page.
2. If you trust the download, select **More info** to see the available options.
3. If **Run anyway** is available, select it to continue with the installer. If it is unavailable, your device's security settings or organization policy may prevent continuation.
4. Choose English, Korean, Japanese or Simplified Chinese in the language dialog, then follow the installation steps.

SmartScreen evaluates file and publisher reputation, so a new version can warn again. See [Microsoft's explanation of SmartScreen reputation](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation). Keep the protections enabled; a malware warning is a different case from an unrecognized-app warning.

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

For a Microsoft Store installation, updates are managed by Store. Open **Microsoft Store → Library** to check. The GitHub installer update flow below applies to installations outside MSIX. Test MSIX packages also use package-managed updates. See the [privacy policy](../privacy.md) for storage and network details.

- Check now with **Check for updates** in **Settings → App updates**, **Check for updates…** in the tray menu, or **PlayPets → Check for Updates…** in the macOS menu bar. Each opens Settings → App updates, where the check result and update actions stay together.
- When a new version is available, a quiet version entry opens that same Settings section. Read the release notes and choose **Install and restart** to download, verify the signature, install and restart. Automatic checks never start installation. You can close Settings and keep playing during download; the progress entry stays reachable, including in small windows. Reopening does not start another download. Errors and Retry stay in Settings → App updates. After restart, a brief notice confirms the installed version.
- The app checks silently 20 seconds after startup, then every 6 hours while it runs. If a check fails, it retries silently after 5 minutes, 15 minutes, 1 hour, then every 6 hours. A successful check restores the 6-hour schedule. Background checks never open Settings or show a notice.
- New versions are found through `latest.json` in GitHub releases. A downloaded file is installed only after it is verified with the update signing key. A file that fails verification is not installed.

## Uninstall

| Operating system | How |
|---|---|
| macOS | Move PlayPets from the Applications folder to the Trash |
| Windows installer | Remove PlayPets in Settings > Apps |
| Linux deb | Remove it with the package manager you installed it with |
| Linux AppImage | Delete the file |

The data folder below stays after you remove the app. To remove the settings and imported pets too, delete the data folder as well.

## Data folder <Since v="0.1.0" />

| Operating system | Location |
|---|---|
| macOS | `~/Library/Application Support/app.playpets/` |
| Windows | `%APPDATA%\app.playpets\` |
| Linux | `~/.local/share/app.playpets/` |

Inside are `state.json` (friends and settings), `bridge.json` (the port and token for agent hooks), `pets/` (imported pets) and `builtin/` (the four starter pets). To keep it somewhere else, put a folder path in the `PLAYPETS_DATA` environment variable and start the app. See [Settings](./settings.md) for details.
