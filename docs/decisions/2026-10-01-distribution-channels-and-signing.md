# Decision: GitHub releases are the source, auto-update, winget and a Homebrew tap point at those files, and code signing turns on with secrets

## Context
We had to decide how users get the app. The research (as of 2026-10-01; the current summary is `docs/reference/code-signing-and-distribution.md`) found this. On macOS, without the Apple Developer Program ($99 a year), Gatekeeper blocks the first launch, and official Homebrew casks also require code signing and notarization from September 2026. On Windows, individual registration in the Microsoft Store is free and the Store signs the app, but installers outside the Store need their own signing. Individuals in Korea cannot use Azure's signing service. We have no accounts yet.

## Decision
We make GitHub releases the source of every file. Three channels sit on top of it.
- **Auto-update:** The Tauri updater reads `latest.json` from the latest release and verifies the signature with an update-only key pair (free, separate from OS code signing).
- **winget:** When a release is published, a manifest is generated and sent as a PR to `microsoft/winget-pkgs`.
- **Homebrew:** The cask in our own tap (`<account>/homebrew-tap`) is updated. The official cask is considered after code signing.

Code signing and submission all turn on only when the repository secrets exist (the update key, `APPLE_*`, `WINGET_TOKEN`, `HOMEBREW_TAP_TOKEN`). Without a secret, only that step is skipped and the rest runs as usual.

## Consequences
- Positive: We can release today without any account, and when an account exists we turn it on just by adding secrets. Once installed, the app updates itself.
- Negative: Until the app is signed, macOS and Windows warn on first launch, and macOS blocks the app even when installed from the Homebrew tap. If the update secret key is lost, installed apps can never receive another update.
- Neutral: The portable zip is not covered by auto-update. On Linux, deb and AppImage each update in their own format.

## Alternatives considered
- **Only the Microsoft Store and the Mac App Store:** The stores take care of code signing, but bring review and sandbox limits, and features that need full trust, such as the agent integration, could be blocked in review.
- **No auto-update, leave it to package managers:** Users who downloaded directly would have no way to learn about new versions.
