---
description: Microsoft Store, winget, Homebrew or the file for your system, the warning on first launch, updates and the data folder
---

# Install

- The button below offers the way to install for the system you are on. Every other file is in the list under it.

<Downloads />

| System | Ways to install |
|---|---|
| Windows | [Microsoft Store](#microsoft-store) (recommended, signed by Microsoft), [winget](#winget), [installer from GitHub](#installer-from-github) |
| macOS | [Homebrew](#homebrew), [dmg from GitHub](#dmg-from-github) |
| Linux | [AppImage or deb](#linux) |

## Windows <Since v="0.1.0" /> {#windows}

| Way | Signed | Updates |
|---|---|---|
| Microsoft Store (recommended) | Signed by Microsoft, no SmartScreen warning | The Store |
| winget | The same Store package | The Store |
| Installer from GitHub | Not yet, SmartScreen may warn | The app itself |

- Pick one way. The Store package and the GitHub installer are two separate installations.

### Microsoft Store {#microsoft-store}

1. Open [PlayPets in Microsoft Store](https://apps.microsoft.com/detail/9NSKXQ6R187M) and select **Get**.
2. Start PlayPets from the Start menu.

- Regular (x64) and ARM PCs each get their own package.
- The Store keeps it up to date. Check in **Microsoft Store → Library**.

### winget {#winget}

```powershell
winget install --id 9NSKXQ6R187M --source msstore
```

- This installs the Microsoft Store package from a terminal.
- The first time, winget may ask you to accept the Store source's terms.

### Installer from GitHub {#installer-from-github}

::: warning This installer is not code-signed yet
- SmartScreen may warn or block opening it. To install without the warning, use the [Microsoft Store](#microsoft-store) or [winget](#winget).
- These checks do not establish that the file is safe. Continue only if you trust the download from the official release page.
:::

| File | For |
|---|---|
| `PlayPets_version_windows-x64-setup.exe` | Installer for regular PCs (x64) |
| `PlayPets_version_windows-arm64-setup.exe` | Installer for ARM PCs |

1. Run the installer. If SmartScreen shows "Windows protected your PC" for an unrecognized app, check that the file came from the official release page.
2. If you trust the download, select **More info** to see the options.
3. If **Run anyway** is there, select it to continue. If not, your device's security settings or organization policy may block continuing.
4. Choose English, Korean, Japanese or Simplified Chinese in the language dialog, then follow the installation steps.

- SmartScreen judges file and publisher reputation, so a new version can warn again. See [Microsoft's explanation of SmartScreen reputation](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation).
- Keep the protections on. A malware warning is a different case from an unrecognized-app warning.
- ARM PC (Snapdragon and the like): use the arm64 file.
  - The x64 file also runs there, through emulation.
  - But its installer and uninstaller cannot close a running PlayPets for you: quit it from the tray first.

::: tip
- The Windows build was checked in a virtual machine, but not tested enough on real machines yet.
- If something looks wrong, tell us in a [GitHub issue](https://github.com/gaerae/playpets/issues).
:::

## macOS <Since v="0.1.0" /> {#macos}

### Homebrew {#homebrew}

```sh
brew install gaerae/tap/playpets
```

- Homebrew installs the same dmg from GitHub releases, so the first-launch steps below apply too.
- Updates come through the app, as with the dmg.

### dmg from GitHub {#dmg-from-github}

::: tip Signed and notarized from 1.3.0
- From 1.3.0, the macOS app is signed with Apple's Developer ID and notarized by Apple, so it opens like other apps you download.
- 1.2.0 and earlier are not signed. Opening one of those may need the steps for older versions below.
:::

| File | For |
|---|---|
| `PlayPets_version_macos-universal.dmg` | Both Apple Silicon and Intel |

1. Open the dmg and drag PlayPets into the Applications folder.
2. Open PlayPets. The first time, macOS asks whether to open an app downloaded from the internet. Click **Open**.

For 1.2.0 and earlier, which are not signed:

1. Try opening PlayPets. If macOS reports an unidentified developer or says it cannot verify the app, close the alert.
2. Go to System Settings > Privacy & Security. Look for the note about PlayPets and **Open Anyway**.
3. If that option is there and you trust the download from the official release page: click **Open Anyway**, authenticate if asked, then click **Open** in the next alert. macOS saves an exception for the app.

- These steps follow [Apple's guide to safely opening apps](https://support.apple.com/en-us/102445).
- If macOS says the app will damage your computer, that is not an unidentified-developer warning.
- Managed devices may restrict opening apps.

## Linux <Since v="0.1.0" /> {#linux}

| File | For |
|---|---|
| `PlayPets_version_linux-x64.deb`, `…_linux-arm64.deb` | Debian and Ubuntu family |
| `PlayPets_version_linux-x64.AppImage`, `…_linux-arm64.AppImage` | Compatible Linux distributions |

- deb: install it with your package manager.
- AppImage: make it executable and run it.

```sh
chmod +x PlayPets_*.AppImage
./PlayPets_*.AppImage
```

::: tip Good to know on Linux
- The AppImage needs FUSE 2.
  - Ubuntu 22.04: `sudo apt install libfuse2`
  - Ubuntu 24.04 (renamed package): `sudo apt install libfuse2t64`
  - Other distributions: the [AppImage FUSE guide](https://docs.appimage.org/user-guide/troubleshooting/fuse.html)
  - Without FUSE: `./PlayPets_*.AppImage --appimage-extract-and-run`
- Closing the window leaves the app in the tray.
  - GNOME hides tray icons unless the "AppIndicator and KStatusNotifierItem Support" extension is on.
  - Even without the icon, starting the app again brings the yard back.
- API keys go to the Secret Service (GNOME Keyring, KWallet).
  - Without one, saving a connection that needs a key shows a message that the secure store cannot be reached.
  - Ollama and the subscription CLIs need no key.
:::

## Updates <Since v="0.1.0" />

- Microsoft Store installation: the Store manages updates. Check in **Microsoft Store → Library**.
- Test MSIX packages also use package-managed updates.
- The GitHub installer update flow below is for installations outside MSIX.
- Storage and network details: [privacy policy](../privacy.md).

**Check now**
- Any of these opens **Settings → App updates**, where the result and update actions stay together:
  - **Check for updates** in **Settings → App updates**
  - **Check for updates…** in the tray menu
  - **PlayPets → Check for Updates…** in the macOS menu bar

**Install a new version**
1. When one is out, a quiet version entry opens that same Settings section.
2. Read the release notes and choose **Install and restart**: it downloads, verifies the signature, installs and restarts.
3. After restart, a brief notice confirms the installed version.

- Automatic checks never start installation.
- You can close Settings and keep playing during download. The progress entry stays reachable, also in small windows.
- Reopening does not start another download.
- Errors and Retry stay in Settings → App updates.

**Automatic checks**
- Silent check 20 seconds after startup, then every 6 hours while the app runs.
- After a failed check: silent retries after 5 minutes, 15 minutes, 1 hour, then every 6 hours.
- A successful check restores the 6-hour schedule.
- Background checks never open Settings or show a notice.

**How versions are found and verified**
- New versions are found through `latest.json` in GitHub releases.
- A downloaded file is installed only after it is verified with the update signing key. A file that fails is not installed.

## Uninstall

| Operating system | How |
|---|---|
| macOS | Move PlayPets from the Applications folder to the Trash. Homebrew: `brew uninstall playpets` |
| Windows, Store or winget | Remove PlayPets in Settings > Apps, or `winget uninstall --id 9NSKXQ6R187M` |
| Windows installer | Remove PlayPets in Settings > Apps |
| Linux deb | Remove it with the package manager you installed it with |
| Linux AppImage | Delete the file |

- The data folder below stays after you remove the app.
- Store or winget: Windows removes the package's data together with the app.
- To also remove settings and imported pets, delete the data folder too.

## Data folder <Since v="0.1.0" />

| Operating system | Location |
|---|---|
| macOS | `~/Library/Application Support/app.playpets/` |
| Windows | `%APPDATA%\app.playpets\`. Store or winget: inside the package's own folder |
| Linux | `~/.local/share/app.playpets/` |

| Inside | What it holds |
|---|---|
| `state.json` | Friends and settings |
| `bridge.json` | The port and token for agent hooks |
| `pets/` | Imported pets |
| `builtin/` | The four starter pets |

- To keep it somewhere else: put a folder path in the `PLAYPETS_DATA` environment variable, then start the app.
- Details: [Settings](./settings.md).
