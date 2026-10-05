# Standard: Managing signing keys and secrets

## Applies to
Keys and tokens used to build, sign, and distribute PlayPets, and secrets the app handles while running. This covers the maintainer's local machine, GitHub repository secrets (Settings → Secrets and variables → Actions), and CI workflows.

Not covered: contributors developing and testing. `npm test`, `npm run test:e2e`, `npm run dist:mac`, and `npm run dist:windows` need no keys. Without keys, only signing and update file generation are skipped.

## Rules
Where each key is stored and where it is used.

| Key or secret | Used for | Stored in | Local use | CI secret | Lifetime |
|---|---|---|---|---|---|
| Updater signing private key | Signs update files. Installed apps verify them with the public key | Maintainer machine `~/.tauri/playpets-updater.key` + offline backup | File contents in `TAURI_SIGNING_PRIVATE_KEY` | `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Does not expire. If lost, existing users cannot get updates |
| Updater signing public key | Verification inside the app | `plugins.updater.pubkey` in the repository's `src-tauri/tauri.conf.json` | Already in the config | None | Changes with the private key |
| Apple Developer ID certificate (.p12) | macOS signing | Maintainer keychain + offline backup | The build finds it in the keychain, or `APPLE_SIGNING_IDENTITY` | `APPLE_CERTIFICATE` (base64), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY` | Until the Apple certificate expires |
| Apple notarization account | macOS notarization | App-specific password on the maintainer's Apple account | `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` | Same names | Until the app-specific password is deleted or changed |
| `WINGET_TOKEN` | Submits PRs to winget-pkgs | GitHub token (scope: public_repo, on the account that has the winget-pkgs fork) | Not used | `WINGET_TOKEN` | Token expiry date |
| `HOMEBREW_TAP_TOKEN` | Pushes to `<account>/homebrew-tap` | GitHub token (contents write on that one repository) | Not used | `HOMEBREW_TAP_TOKEN` | Token expiry date |
| `GITHUB_TOKEN` | Release drafts, uploading files | Issued by GitHub for each run | Not used | Automatic | For the run |
| MSIX test certificate | Signs the test MSIX | `release/windows/msix-test/PlayPets-test.pfx` (the build creates it if missing, excluded from git) | Used by `npm run dist:windows` | None | Disposable. If deleted, the next build creates a new one |
| Agent bridge token | Authenticates requests the agent CLI sends to the running app | `bridge.json` in the user data folder | The app creates a new one at each launch | None | While the app runs |
| The user's AI API key | AI connection | OS secure storage (macOS Keychain, Windows Credential Manager, Linux Secret Service) | Handled by the app | None | Until the user deletes it |

- Do not commit private keys, certificates, or tokens to the repository. Keep them only outside the repository (`~/.tauri/`) or in a folder git ignores (`release/`). Git also ignores `.env*` files.
- Back up the updater signing private key in at least two places (the maintainer machine and one offline store, for example a password manager). If it is lost, updates can never again be sent to apps already installed.
- Put a password on the updater key before publishing the first release. The current key was created without a password (2026-10-01). Before the first release, creating a new key and replacing the public key does not affect users.
- Workflows pass a secret as an environment variable only when the secret exists. Passing an empty value makes tools fail trying to read an empty certificate (the Build step in `release.yml` follows this pattern).
- Create GitHub tokens with the narrowest scope and an expiry date (one year or less), and create a new one and replace the secret before it expires.
- If a key is lost or a leak is suspected, follow [When the updater signing key is lost or leaked](../runbooks/updater-key-lost-or-leaked.md).

The command for building update files locally (macOS). The signed `PlayPets.app.tar.gz` and `.sig` appear in `src-tauri/target/release/bundle/macos/`.

```bash
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/playpets-updater.key)" TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" npx tauri build --bundles app --config '{"bundle":{"createUpdaterArtifacts":true}}'
```

The command for creating a new key. When it finishes, put the contents of `~/.tauri/playpets-updater.key.pub` into `pubkey` in `tauri.conf.json`.

```bash
npx tauri signer generate -w ~/.tauri/playpets-updater.key
```

## Recommendations
Follow these when you can. When you cannot, say why in the PR.
- Turn on the repository's secret scanning and push protection (GitHub secret scanning, push protection).

## Exceptions
| When | How |
|---|---|
| Releasing without secrets | Allowed. Only signing and update files are skipped; note it under known limitations in the release notes |
| Someone other than the maintainer needs to sign | Do not hand over the private key. Put only the secrets in the repository so CI signs |

## Rationale
The updater signing key is the only proof every installed app trusts. If it is lost there is no way to recover, and if it leaks someone can make fake updates. Signing and submission turn on only when the secrets exist, so a release is possible without the accounts.
Based on: decision “[GitHub releases are the source, auto-update, winget and a Homebrew tap point at those files, and code signing turns on with secrets](../decisions/2026-10-01-distribution-channels-and-signing.md)”

## Automated checks
- `.gitignore` excludes `release/` and `.env*`.
- For the update settings, `tests/distribute.test.mjs` checks that the public key exists and that the update address matches the repository in `package.json`.
- The maintainer turns on secret scanning in settings after creating the GitHub repository. It is not on yet.

## Change history
- 2026-10-01 First version
