# [Research] What do code signing and distribution channels cost for a desktop app, and in what order does PlayPets take them?

## Question
To ship PlayPets on macOS, Windows and Linux, we looked at what code signing is needed, whether the cost is per account or per app, what identity checks are required, and what the conditions are for the distribution channels open-source desktop apps commonly use (GitHub releases, Homebrew, winget, in-app auto-update). This document is kept current. When prices or policies change, edit this document and note it in the change history.

## Findings
### Costs and units
As of 2026-10-01. "Checked directly" means the official page was opened; "search summary" means it was seen only in search results.

| Item | Cost | Unit | Identity check | Source |
|---|---|---|---|---|
| Apple Developer Program (individual) | $99 a year. Shown in won on the enrollment screen | Per account, no limit on apps, covers every Apple OS | Apple Account with two-factor authentication, legal name, card in your own name | [Enrollment](https://developer.apple.com/support/enrollment/) checked directly |
| Apple Developer Program (organization) | $99 a year | Per account | Legal entity, D-U-N-S number, company-domain email, public website | [Program enrollment](https://developer.apple.com/help/account/membership/program-enrollment) checked directly |
| Microsoft Store (individual) | Free (since September 2025) | Per account, each app reviewed | Scan of a government-issued ID and a selfie | [Windows Developer Blog](https://blogs.windows.com/windowsdeveloper/2025/09/10/free-developer-registration-for-individual-developers-on-microsoft-store/) checked directly |
| Azure Artifact Signing (formerly Trusted Signing) | $9.99 a month, 5,000 signatures | Per account | Individuals only in the US and Canada. In Korea, organizations only (business registration number, domain email, website, 1 to 20 business days) | [Quickstart](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart) checked directly |
| OV code signing certificate from a certificate authority (CA) | Varies by seller (not researched) | Per issuer | Identity and business verification. Since 2023 the private key is on a hardware token (search summary) | Not researched |
| Tauri update signing key | Free | One key pair per app | None | [Updater plugin](https://v2.tauri.app/plugin/updater/) checked directly |
| Own Homebrew tap, winget | Free | Repository, manifest | None | Below |

### What happens without code signing
- macOS: Gatekeeper blocks the first launch. From macOS 15 the Control-click workaround is gone, so users have to go all the way to "Privacy & Security" in System Settings.
- Windows: SmartScreen shows the "Windows protected your PC" warning. Even with code signing, a reputation warning is reported to appear until downloads build up (not confirmed in official docs).
- Official Homebrew casks: from September 1, 2026, casks that fail the Gatekeeper check were disabled (search summary). Distribution channels for macOS effectively assume Apple code signing.

### Four paths on Windows
| Path | Cost | What it gives | What it does not |
|---|---|---|---|
| Microsoft Store (free for individuals) | Free | The Store signs the MSIX for you, hosts it and auto-updates it. No SmartScreen warning | Installers outside the Store (exe, zip) are still unsigned. A `runFullTrust` app has to explain why it needs it in review |
| Azure Artifact Signing | $9.99 a month | Publicly trusted signature on the installer | Not available to individuals in Korea. Organizations only |
| OV certificate from a CA | Varies by seller | Installer signing | Hardware token storage, cost |
| Ship unsigned | Free | Installation itself works. winget registration is possible too | SmartScreen warning |

Whether organization Store accounts also became free could not be confirmed; reports disagree. Azure Artifact Signing applications from sole proprietors (a search result said from April 2026) could not be confirmed in official docs either.

### Distribution channels
Open-source desktop apps keep GitHub releases as the source, and package managers and in-app updates point at those files.

| Channel | How | Conditions | Source |
|---|---|---|---|
| GitHub releases | Push a tag and CI builds and uploads | None | The repository's `release.yml` |
| Official Homebrew cask | `brew install --cask` | Code signing and notarization required, notability review (no numeric threshold) | [Acceptable Casks](https://docs.brew.sh/Acceptable-Casks) checked directly |
| Own Homebrew tap | `Casks/*.rb` in your own `homebrew-tap` repository | No review. Without code signing the first launch is blocked | Same document |
| winget | YAML manifest PR to `microsoft/winget-pkgs`. `wingetcreate` generates and submits it | Free. Public installer URL and SHA256. A person reviews the first version, later ones are merged by a bot | [Submit packages](https://learn.microsoft.com/en-us/windows/package-manager/package/) checked directly |
| Scoop, Chocolatey, Flathub, AUR | Each has its own manifest | Free | Not researched |
| Tauri auto-update | Reads `latest.json`, verifies the signature, then installs | Free key pair. Verification cannot be turned off. If the private key is lost, installed apps can never receive another update | [Updater plugin](https://v2.tauri.app/plugin/updater/) checked directly |

The Tauri updater looks for `<os>-<arch>-<install type>` first (for example `linux-x86_64-deb`) and falls back to `<os>-<arch>`. So deb and AppImage users each get the right file. The official docs do not say whether the updater works in an app without OS code signing. Signature verification and rejection of tampered files were checked locally; actually replacing the installed app will be checked after the first release.

### Limits of this research
- All prices are the values seen on 2026-10-01. Amounts in Korean won appear only on the enrollment screen.
- CA certificate prices and the detailed conditions of Scoop, Chocolatey, Flathub and AUR were not researched.
- Items marked "search summary" were not checked on the official page.

## Conclusion and recommendations
**The cheapest combination that covers every OS without warnings is Apple at $99 a year plus free individual registration in the Microsoft Store.** For Windows installer (exe) signing there is no affordable path open to individuals in Korea, so the Store MSIX is the signed path and the exe accepts the warning.

PlayPets already runs without code signing and turns each step on as soon as the secrets are added (decision "[GitHub releases are the source, auto-update, winget and a Homebrew tap point at those files, and code signing turns on with secrets](../decisions/2026-10-01-distribution-channels-and-signing.md)"). So the order is:

1. One-time setup: create the GitHub repository, set it up and push, so CI runs for the first time ([Set up the repository, keys and store accounts](../how-to/set-up-the-repository.md)).
2. Add the update secret key to the repository secrets ([Managing signing keys and secrets](../standards/keys-and-secrets.md)).
3. Run `npm run release -- 0.1.0`, push the tag, check the draft and publish it ([Release a new version](../how-to/release.md)).
4. Create the `homebrew-tap` repository and the winget-pkgs fork, and add their tokens; `distribute` then submits each version, the first winget one included (one-time setup).
5. After joining the Apple Developer Program, add the `APPLE_*` secrets to turn on code signing and notarization, and consider the official Homebrew cask.
6. For Windows, start with individual registration in the Microsoft Store (free). Revisit Azure Artifact Signing when we become an organization or the region condition for individuals is lifted.

## Change history
- 2026-10-02 Moved the 2026-10-01 research into this living document. The facts are unchanged.
