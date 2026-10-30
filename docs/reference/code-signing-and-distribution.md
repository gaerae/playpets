# [Research] What do code signing and distribution channels cost for a desktop app, and in what order does PlayPets take them?

## Question
- What code signing does PlayPets need to ship on macOS, Windows and Linux?
- Is the cost per account or per app, and what identity checks are required?
- What are the conditions of the channels open-source desktop apps commonly use: GitHub releases, Homebrew, winget, in-app auto-update?
- This document is kept current. When prices or policies change, edit it and note the change in the change history.

## Findings
### Costs and units
- The original price survey is from 2026-10-01; the Store and Apple preparation follow-up is from 2026-10-18.
- "Checked directly": the official page was opened. "Search summary": seen only in search results.

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
- macOS: Gatekeeper blocks the first launch.
  - From macOS 15 the Control-click workaround is gone; users have to open "Privacy & Security" in System Settings.
- Windows: unsigned downloads can trigger SmartScreen warnings.
  - Signing does not guarantee immediate reputation; even EV certificates no longer grant an instant bypass.
  - See [Microsoft code signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options).
- Official Homebrew casks: from September 1, 2026, casks that fail the Gatekeeper check were disabled (search summary).
- Distribution channels for macOS effectively assume Apple code signing.

### Four paths on Windows
| Path | Cost | What it gives | What it does not |
|---|---|---|---|
| Microsoft Store (free for individuals) | Free | The Store signs the MSIX for you, hosts it and auto-updates it. No SmartScreen warning | Installers outside the Store (exe, zip) are still unsigned. A `runFullTrust` app has to explain why it needs it in review |
| Azure Artifact Signing | $9.99 a month | Publicly trusted signature on the installer | Not available to individuals in Korea. Organizations only |
| OV certificate from a CA | Varies by seller | Installer signing | Hardware token storage, cost |
| Ship unsigned | Free | Installation itself works. winget registration is possible too | SmartScreen warning |

- Not confirmed: whether organization Store accounts also became free. Reports disagree.
- Not confirmed in official docs: Azure Artifact Signing applications from sole proprietors (a search result said from April 2026).

### Distribution channels
- Open-source desktop apps keep GitHub releases as the source; package managers and in-app updates point at those files.

| Channel | How | Conditions | Source |
|---|---|---|---|
| GitHub releases | Push a tag and CI builds and uploads | None | The repository's `release.yml` |
| Official Homebrew cask | `brew install --cask` | Code signing and notarization required, notability review (no numeric threshold) | [Acceptable Casks](https://docs.brew.sh/Acceptable-Casks) checked directly |
| Own Homebrew tap | `Casks/*.rb` in your own `homebrew-tap` repository | No review. Without code signing the first launch is blocked | Same document |
| winget | YAML manifest PR to `microsoft/winget-pkgs`. `wingetcreate` generates and submits it | Free. Public installer URL and SHA256. A person reviews the first version, later ones are merged by a bot | [Submit packages](https://learn.microsoft.com/en-us/windows/package-manager/package/) checked directly |
| Scoop, Chocolatey, Flathub, AUR | Each has its own manifest | Free | Not researched |
| Tauri auto-update | Reads `latest.json`, verifies the signature, then installs | Free key pair. Verification cannot be turned off. If the private key is lost, installed apps can never receive another update | [Updater plugin](https://v2.tauri.app/plugin/updater/) checked directly |

- The Tauri updater looks for `<os>-<arch>-<install type>` first (for example `linux-x86_64-deb`) and falls back to `<os>-<arch>`.
- That way deb and AppImage users each get the right file.
- The official docs do not say whether the updater works in an app without OS code signing.
- Checked locally: signature verification and rejection of tampered files.
- Whether an update actually replaces the installed app will be checked after the first release.

### Limits of this research
- All prices are as seen on 2026-10-01.
- Amounts in Korean won appear only on the enrollment screen.
- CA certificate prices and the detailed conditions of Scoop, Chocolatey, Flathub and AUR were not researched.
- Items marked "search summary" were not checked on the official page.

## Conclusion and recommendations
- Recommended first signed channels: Apple Developer ID with notarization for macOS downloads, and Microsoft Store MSIX for Windows.
- Neither guarantees that every OS security prompt disappears.
- Store MSIX signing does not sign GitHub EXE downloads.
- The earlier conclusion that Korean individuals had no affordable EXE signing path was too broad:
  - [SignPath Foundation](https://signpath.org/terms) offers reviewed OSS signing.
  - Commercial providers also sell individual certificates.
  - Approval, country eligibility, cloud fees and automation need separate review.
- Without Apple credentials, PlayPets uses ad-hoc macOS signing.
- Release signing turns on only with the complete set of six Apple secrets (decision "[GitHub releases are the source, auto-update, winget and a Homebrew tap point at those files, and code signing turns on with secrets](../decisions/2026-10-01-distribution-channels-and-signing.md)").

The order:

1. One-time setup: create the GitHub repository, set it up and push, so CI runs for the first time ([Set up the repository, keys and store accounts](../how-to/set-up-the-repository.md)).
2. Add the update secret key to the repository secrets ([Managing signing keys and secrets](../standards/keys-and-secrets.md)).
3. Run `pnpm run release -- 0.1.0`, push the tag, check the draft and publish it ([Release a new version](../how-to/release.md)).
4. Create the `homebrew-tap` repository and the winget-pkgs fork, and add their tokens (one-time setup). `distribute` then submits each version, including the first winget one.
5. After joining the Apple Developer Program, add the `APPLE_*` secrets together, verify code signing and notarization, and consider the official Homebrew cask.
6. For Windows, start with free individual registration in the Microsoft Store. Revisit Azure Artifact Signing when we become an organization or the region limit for individuals is lifted.

- Current implementation steps and outstanding maintainer inputs: [Prepare Microsoft Store and Apple signing](../how-to/store-and-apple-signing.md).
- MSIX installations update through the package manager; GitHub installations keep the Tauri updater.
- The app's pre-1.0 version is mapped to a nonzero-major MSIX version, without changing the public app version.

## Change history
- 2026-10-18 Corrected the Windows signing availability conclusion and SmartScreen wording; linked current Store identity, update-channel and Apple signing preparation.
- 2026-10-02 Moved the 2026-10-01 research into this living document. The facts are unchanged.
