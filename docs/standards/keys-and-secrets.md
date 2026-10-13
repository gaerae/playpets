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

- Do not commit private keys, certificates, or tokens to the repository. Keep them only outside the repository (`~/.tauri/`) or in the ignored `.credentials/` folder, never in `release/` (packages are handed off from there) or `scratch/`. Git also ignores `.env*` files and key and certificate files (`*.key`, `*.pem`, `*.p12`, `*.p8`, `*.pfx`).
- Back up the updater signing private key in at least two places (the maintainer machine and one offline store, for example a password manager). If it is lost, updates can never again be sent to apps already installed.
- The updater signing key has a password. Store the password next to the key in the password manager, and give it to CI as the `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secret.
- Workflows pass a secret as an environment variable only when the secret exists. Passing an empty value makes tools fail trying to read an empty certificate (the Build step in `release.yml` follows this pattern).
- Create GitHub tokens with the narrowest scope and an expiry date (one year or less), and create a new one and replace the secret before it expires.
- If a key is lost or a leak is suspected, follow [When the updater signing key is lost or leaked](../runbooks/updater-key-lost-or-leaked.md).

The commands for building update files locally (macOS). The first two lines ask for the key password without showing it and keep it out of the shell history (they work in both zsh and bash). The signed `PlayPets.app.tar.gz` and `.sig` appear in `src-tauri/target/release/bundle/macos/`.

```bash
printf 'Key password: '; read -rs TAURI_SIGNING_PRIVATE_KEY_PASSWORD; echo
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/playpets-updater.key)" npx tauri build --bundles app --config '{"bundle":{"createUpdaterArtifacts":true}}'
```

The command for creating a new key. It asks for a password; set one. When it finishes, put the contents of `~/.tauri/playpets-updater.key.pub` into `pubkey` in `tauri.conf.json`. The whole first-time sequence (password manager, backup, secrets, store tokens) is in [Set up the repository, keys and store accounts](../how-to/set-up-the-repository.md).

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
- `.gitignore` excludes `.credentials/`, key and certificate files, `release/`, `scratch/` and `.env*`; `tests/repository-config.test.mjs` checks it.
- For the update settings, `tests/distribute.test.mjs` checks that the public key exists and that the update address matches the repository in `package.json`.
- Secret scanning and push protection are not checked by the repository's own tests. The maintainer turns them on in the repository settings (Settings → Advanced Security).

## Change history
- 2026-10-01 First version
- 2026-10-06 The updater key has a password; the local build asks for it instead of passing it on the command line. Secret scanning is turned on in Settings → Advanced Security
