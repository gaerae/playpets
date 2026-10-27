# Standard: Managing signing keys and secrets

## Applies to
- Keys and tokens used to build, sign and distribute PlayPets.
- Secrets the app handles while running.
- Wherever they are kept or used: the maintainer's local machine, GitHub repository secrets (Settings → Secrets and variables → Actions) and CI workflows.
- Not covered: contributors' development and testing.
  - `npm test`, `npm run test:e2e`, `npm run dist:mac` and `npm run dist:windows` need no keys.
  - Without keys, only signing and update file generation are skipped.

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
| Store application key | Authenticates the dedicated Entra application's Store API requests | Protected `microsoft-store` environment Secret; optional backup in the maintainer's password manager | Not used for normal builds | `STORE_CLIENT_SECRET` (Key value, not Client ID or key identifier) | Entra key expiry date; record it privately and rotate before expiry |
| MSIX test certificate | Signs the test MSIX | The private key in the `playpets-msix-key` Docker volume (the build creates it if missing); only the public `PlayPets-test.cer` goes to `release/windows/msix-test/`. A key an older build left there is moved into the volume | Used by `npm run dist:windows` | None | Disposable. After `docker volume rm playpets-msix-key` the next build makes a new one, and testers trust the new certificate again |
| Agent bridge token | Authenticates requests the agent CLI sends to the running app | `bridge.json` in the user data folder | The app creates a new one at each launch | None | While the app runs |
| The user's AI API key | AI connection | OS secure storage (macOS Keychain, Windows Credential Manager, Linux Secret Service) | Handled by the app | None | Until the user deletes it |

### Storing keys
- Do not commit private keys, certificates or tokens to the repository.
- Keep them only outside the repository (`~/.tauri/`) or in the ignored `.credentials/` folder.
- Never keep them in `release/` (packages are handed off from there) or `scratch/`.
- Git also ignores `.env*` files and key and certificate files (`*.key`, `*.pem`, `*.p12`, `*.p8`, `*.pfx`).
- Back up the updater signing private key in at least two places: the maintainer machine and one offline store (for example a password manager).
- If it is lost, apps already installed can never get updates again.
- The updater signing key has a password. Store the password next to the key in the password manager, and give it to CI as the `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secret.

### Store and Apple values
- Store identity values (`MSIX_IDENTITY_NAME`, `MSIX_PUBLISHER`, `MSIX_PUBLISHER_DISPLAY_NAME`) are public metadata, supplied together to the local Docker build.
- They are not signing keys or Store submission API credentials ([Store and Apple signing guide](../how-to/store-and-apple-signing.md)).
- Store API identifiers (`STORE_APP_ID`, `STORE_TENANT_ID`, `STORE_CLIENT_ID`) are environment variables.
- The Store key stays in an environment Secret behind required approval.
- The repository variable `STORE_SUBMISSION_ENABLED=true` turns on the Store submission of each published release.
- `STORE_PUBLISH_MODE=Immediate` lets certification publish the submission.
- Only the `submit` job of `store.yml` receives the key.
- Apple release signing needs all six `APPLE_*` values together. A partial set fails the macOS release build.
- Keep the exported Apple certificate password-protected and outside the checkout.

### Workflows and tokens
- Workflows pass a secret as an environment variable only when the secret exists (the Build step in `release.yml` follows this pattern).
- An empty value makes tools fail when they try to read an empty certificate.
- Create GitHub tokens with the narrowest scope and an expiry date (one year or less).
- Create a new token and replace the secret before the old one expires.
- If a key is lost or a leak is suspected, follow [When the updater signing key is lost or leaked](../runbooks/updater-key-lost-or-leaked.md).

### Commands
Build update files locally (macOS):
- The first two lines ask for the key password without showing it and keep it out of the shell history (zsh and bash).
- The signed `PlayPets.app.tar.gz` and `.sig` appear in `src-tauri/target/release/bundle/macos/`.

```bash
printf 'Key password: '; read -rs TAURI_SIGNING_PRIVATE_KEY_PASSWORD; echo
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/playpets-updater.key)" npx tauri build --bundles app --config '{"bundle":{"createUpdaterArtifacts":true}}'
```

Create a new key:
1. Run the command below. It asks for a password; set one.
2. Put the contents of `~/.tauri/playpets-updater.key.pub` into `pubkey` in `tauri.conf.json`.

```bash
npx tauri signer generate -w ~/.tauri/playpets-updater.key
```

- The whole first-time sequence (password manager, backup, secrets, store tokens): [Set up the repository, keys and store accounts](../how-to/set-up-the-repository.md).

## Recommendations
Follow these when you can. When you cannot, say why in the PR.
- Turn on the repository's secret scanning and push protection (GitHub secret scanning, push protection).

## Exceptions
| When | How |
|---|---|
| Releasing without secrets | Allowed. Only signing and update files are skipped; note it under known limitations in the release notes |
| Someone other than the maintainer needs to sign | Do not hand over the private key. Put only the secrets in the repository so CI signs |

## Rationale
- The updater signing key is the only proof every installed app trusts.
- If it is lost, it cannot be recovered.
- If it leaks, someone can make fake updates.
- Signing and submission turn on only when the secrets exist, so a release is possible without the accounts.
- Based on: decision “[GitHub releases are the source, auto-update, winget and a Homebrew tap point at those files, and code signing turns on with secrets](../decisions/2026-10-01-distribution-channels-and-signing.md)”

## Automated checks
- `.gitignore` excludes `.credentials/`, key and certificate files, `release/`, `scratch/` and `.env*`; `tests/repository-config.test.mjs` checks it.
- `tests/distribute.test.mjs` checks the update settings: the public key exists, and the update address matches the repository in `package.json`.
- The repository's own tests do not check secret scanning and push protection. The maintainer turns them on in the repository settings (Settings → Advanced Security).

## Change history
- 2026-10-01 First version
- 2026-10-06 The updater key has a password; the local build asks for it instead of passing it on the command line. Secret scanning is turned on in Settings → Advanced Security
