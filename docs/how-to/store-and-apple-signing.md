# Prepare Microsoft Store and Apple signing

## Purpose

- Prepare the Microsoft Store MSIX and its submission, and Developer ID signing for macOS downloads.
- These are separate channels.
- After the one-time setup, each published GitHub release submits itself to the Store ([Submission automation](#submission-automation-and-first-submission-setup)).
- A submission that passes certification publishes on its own only with `STORE_PUBLISH_MODE=Immediate`.

## Values the maintainer supplies

1. In Partner Center, open the reserved product, then **Product management → Product identity**.
2. Copy these values exactly.

- They are public package metadata, not signing credentials.
- Do not use an Azure client secret, a Package SID or the Store ID as the publisher.

| Environment variable | Partner Center field | Required when |
|---|---|---|
| `MSIX_IDENTITY_NAME` | `Package/Identity/Name` | Making a Store MSIX |
| `MSIX_PUBLISHER` | `Package/Identity/Publisher`, including `CN=` | Making a Store MSIX |
| `MSIX_PUBLISHER_DISPLAY_NAME` | `Package/Properties/PublisherDisplayName` | Making a Store MSIX |
| Store ID (not a build variable) | The product's Store ID | Adding a Store listing link after publication |

- The MSIX template keeps the app's visible name as PlayPets.
- `scripts/msix-manifest.mjs` fills and XML-escapes all three identity fields and the four-part package version.
- Setting any one Store identity field requires all three.
- The build never invents an identity for the maintainer.
- With all three unset, the build makes a test-signed package instead.

## Build and test Windows packages

1. Start Docker Desktop.
2. From the repository root, run the build with the real public values in place of these examples:

```bash
MSIX_IDENTITY_NAME='12345.Publisher.PlayPets' \
MSIX_PUBLISHER='CN=the-value-from-Partner-Center' \
MSIX_PUBLISHER_DISPLAY_NAME='Your publisher display name' \
npm run dist:windows
```

Repeated local builds:
- Put the three public values into a local `.env.store` file as `NAME=value` lines and run `node --env-file=.env.store scripts/local.mjs windows`.
- That command loads the file explicitly.
- `npm run dist:windows` does not load it.
- `.env.store` is excluded from Git and from the Docker source copy.
- Node passes the values into the container.
- This local path does not read GitHub repository Variables.
- The `store` workflow has the same three public values in its own file.
- Do not put Apple credentials into this file.

The Store hand-off:
- `release/windows/msix-store/PlayPets_<version>_x64.msix`, without a local test signature.
- Microsoft signs the package distributed through the Store.
- Do not upload the NSIS EXE, the portable ZIP, a test certificate or a private key in its place.
- Store signing does not sign the EXE distributed through GitHub.
- This local build path makes only the x64 MSIX.
- The `store` workflow builds x64 and ARM64.

Local install test:
1. Unset all three `MSIX_*` variables and run `npm run dist:windows`.
2. Use the package and public certificate under `release/windows/msix-test/` only on a test Windows machine.

- The private test key stays in Docker's `playpets-msix-key` volume.
- A test certificate is not a public Windows signing identity.
- Do not try to install the unsigned Store hand-off by trusting a test certificate.

Updates in a package:
- At runtime, the Windows package identity (from `GetCurrentPackageFullName`) decides who owns updates, not a path substring or an environment variable that users can change.
- MSIX, including test MSIX, never calls the GitHub updater to check, download or install an EXE.
- Settings explains package-managed updates.
- The tray and menu update actions lead to that explanation.
- Unpackaged GitHub installations keep the existing signed updater.
- Runtime detection does not prove that a test MSIX was installed through the Store.

## What Windows CI verifies

- The x64 and ARM64 build jobs run `npm run test:msix:ci` after the regular native E2E.
- The gate uses a separate `PlayPets.CI` identity and a short-lived local certificate, without Store credentials or a submission API.

1. Pack, sign, verify and install the production executable as MSIX.
   - Activate it through `shell:AppsFolder` with its AUMID, require a visible window, and check that it stays alive past the scheduled update check.
2. Install an E2E-feature package with the same test identity. In package context, verify that:
   - the native `GetCurrentPackageFullName` result routes updates to the Store
   - direct GitHub check and install calls are blocked
   - Settings and tray actions show the Store explanation without installer controls
3. Save a preference, install a higher package version with the same executable, and confirm the preference survives.
   - This is a package-only upgrade, not a new app release or a Store download.
4. Remove the test package and temporary certificates.
   - Upload JSON reports and logs even when the gate fails.
   - Never upload the private key or test packages as release assets.

Limits:
- The production activation uses the normal installed app entry.
- The instrumented probe uses `Invoke-CommandInDesktopPackage`, Microsoft's debugging context, with the CI package's normal app data path.
- The probe is not identical to Store activation. It does not prove Store certification, service delivery or the behavior of every clean Windows machine.
- The script refuses to run as an ordinary local command, so unit tests cannot change a maintainer's packages or certificate stores.

After both architecture jobs pass, these checks stay manual:

- On a clean Windows device without development tools, confirm WebView2 availability, visual layout, tray and desktop windows, close and exit, always-on-top and optional agent integration.
  - CI checks package activation and update rules.
  - It cannot judge these interactions visually or cover every device setup.
- Before submission, run the Windows App Certification Kit (WACK) against the actual Store hand-off.
  - The CI gate is not a certification test.
- Once submission is approved separately, use a private Store package flight to verify installation and a real Store-delivered update that keeps pets and credentials.
  - A local certificate and `Add-AppxPackage` cannot simulate Store signing, licensing, certification or the delivery service.

## Prepare the listing and request certification

Versions:
- The app starts its aligned Store version series at `1.0.0`.
- The MSIX version appends the reserved fourth component.
- There is no major-version offset.

  | App | MSIX |
  |---|---|
  | `1.0.0` | `1.0.0.0` |
  | `1.0.1` | `1.0.1.0` |
  | `1.1.0` | `1.1.0.0` |

- The generator rejects a zero major, prereleases and components above 65535.
- Local `1.2.0.0` test packages built earlier were never Store releases.
- They cannot be upgraded in place to the lower `1.0.0.0`. Back up any data you want to keep, then remove the test package first.
- Do not uninstall a real Store installation as a routine update step.

The submission:
1. Create the first submission in Partner Center.
2. Complete pricing and markets, properties, age ratings, packages, localized listings and submission options.
3. Upload the Store MSIX and resolve its validation messages.
4. Keep the submission on a manual publication hold until the release is approved separately.

References: [Store package requirements](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements), [package-context debugging](https://learn.microsoft.com/en-us/powershell/module/appx/invoke-commandindesktoppackage).

## Submission automation and first-submission setup

- Publishing a GitHub release starts the `store` workflow (`store.yml`).
- The workflow skips prereleases.
- It uses Microsoft's MSIX submission API directly (`scripts/store-submit.mjs`), with no third-party code in the job that holds the key.
  - The `microsoft/store-submission` action is archived and handles MSI/EXE products.
  - The Store Developer CLI (`msstore`) needs .NET and a setup action in that job, and adds nothing here.
- Before any API submission, a submission made in Partner Center has to be published.
- 1.2.0 is that baseline.
- What each job does:

| Job | Credentials | What it does |
|---|---|---|
| `source` | None | Checks that the tag is a stable `vx.y.z` on `main` and matches `package.json` and the changelog. Makes `notes.json` from the four website release pages |
| `package` | None | Builds `playpets.exe` with `npx tauri build --no-bundle` on Windows x64 and ARM64, then `packaging/windows/msix/store.ps1` makes the unsigned MSIX |
| `bundle` | None | Checks each package's identity, version and architecture, records SHA-256 values in `release.json`, keeps everything as the `store-bundle` artifact |
| `submit` | `microsoft-store` environment | Runs only with `STORE_SUBMISSION_ENABLED=true`, after the environment's approval |

- `submit` steps, in order:
  1. Refuses a product other than PlayPets, a product with no published submission, and any pending submission. Nothing changes.
  2. Refuses a version the Store already has (a rerun). Nothing changes.
  3. Creates a submission. Microsoft makes it a copy of the published one: listings, screenshots, certification notes (the `runFullTrust` explanation), markets and options stay.
  4. Replaces both packages, sets each language's "What's new", and sets the publish mode. Pricing is left out of the update.
  5. Uploads the two MSIX to the API's Azure Blob address only, checks that the publish mode was kept, and commits. Certification starts.
- It never calls the publish endpoint and never retries.
- Logs show a short report with no token, key, upload address or provider error body.

### What's new
- Source: the website release page in each language (`website/releases/x.y.z.md`, `website/ko/…`, `website/ja/…`, `website/zh-hans/…`).
  - People write them before the release.
  - `npm run release` stops without them.
  - Nothing is machine-translated.
- Text: the opening sentence, the bullets under the first `##` section, then the page's address.
- Links keep their words; bold and code marks are dropped.
- The Store allows 1500 characters per language.
- Bullets that do not fit are left out, starting from the end.
- The address leads to all of them, and the `source` log says how many were left out.
- Store languages: `en-us`, `ko-kr`, `ja-jp`, `zh-cn`.
- To check a version before tagging:

```bash
node scripts/store-notes.mjs 1.3.0
```

### Publish mode
- Repository variable `STORE_PUBLISH_MODE`:

| Value | After certification passes |
|---|---|
| `Manual` (or unset) | Waits for **Publish now** in Partner Center |
| `Immediate` | The Store publishes it |

- The workflow reads the variable on each run.
- The copied submission's own setting does not count.

### Submit every release automatically
The account holder does these one-time steps. Never paste a key into a chat, issue or file.

1. Link an Entra tenant to Partner Center.
   - Partner Center → **Settings (gear) → Account settings → Tenants**.
   - **Associate** an existing Microsoft Entra tenant, or **Create new**.
2. Add the automation app.
   - **Account settings → User management → Microsoft Entra applications → Add Microsoft Entra application** (or **Create Microsoft Entra application**).
   - Give it the **Manager** role, which the API requires.
   - The role reaches account-wide settings except tax and payout, so treat the key as a high-privilege credential.
   - Open the app and choose **Add new key**. Copy the **Key** value now: it is shown only once.
   - Note the **Client ID**, the **Tenant ID** and the key's expiry date.
   - You do not need a seller ID; that is for `msstore`.
3. Set up the GitHub environment.
   - Repository **Settings → Environments → microsoft-store** (create it if missing).
   - **Deployment branches and tags → Selected branches and tags**: add the tag rule `v*.*.*`, and keep `main` for `Store API verification`.
   - **Required reviewers**: keep yourself for a one-click approval per release, or remove the rule for no approval.
   - Turn on **Prevent administrators from bypassing**, and leave **Prevent self-review** off.
4. Add the values to that environment.

| Name | Kind | Value |
|---|---|---|
| `STORE_APP_ID` | Environment variable | `9NSKXQ6R187M` |
| `STORE_TENANT_ID` | Environment variable | The tenant ID from step 2 |
| `STORE_CLIENT_ID` | Environment variable | The Client ID from step 2 |
| `STORE_CLIENT_SECRET` | Environment secret | The Key value from step 2, not the Client ID or the key's identifier |

5. Check the values without submitting: run `Store API verification` from **Actions** on `main` and approve it.
   - The summary shows `authenticated: true` and `productIdentityVerified: true`.
6. Wait until 1.2.0 is published.
   - A submission still in certification blocks a new one.
7. Turn it on: repository **Settings → Secrets and variables → Actions → Variables**.
   - `STORE_SUBMISSION_ENABLED` = `true`.
   - `STORE_PUBLISH_MODE` = `Immediate` to publish after certification, like 1.2.0.
   - Leave `STORE_PUBLISH_MODE` unset to keep a manual hold.
8. For the first automated release, open the new submission in Partner Center once certification starts.
   - Check What's new, both packages and the certification notes.

- Missing values:
  - All four missing: `submit` writes a notice and ends green; upload `store-bundle` by hand.
  - Some missing: `submit` fails, as with the `APPLE_*` secrets.
- Before the key expires, add a new key to the same app, replace `STORE_CLIENT_SECRET`, then delete the old key.

### Check credentials without submitting
- `Store API verification` (`store-api.yml`) runs its tests without credentials, then waits for the `microsoft-store` environment.
- Its credentialed step runs `npm run store:verify` with no dependency install.
- It requests a token, reads the app, checks the package identity and publisher, and reads any pending submission's publish mode.
- For a pending submission it also shows its state (for example `Certification`, `CertificationFailed`, `PendingCommit`) and Microsoft's error and warning codes, never their text.
- It never creates, uploads, commits or publishes a submission.
- Logs show a short report with no token responses, provider error bodies, keys or upload addresses.
- It runs only by hand, from **Actions** on `main`.

### When a run stops
- A failure after the submission was created leaves a draft in Partner Center.
- Finish or delete that draft there before running `store` again.
- Microsoft warns that mixing Partner Center edits and API changes on one draft can make it uncommittable.
- Finish such a draft in one place.
- To run `store` again: **Actions → store → Run workflow → Use workflow from → Tags → vx.y.z**.
- A run from a branch stops at `source`.
- Do not use the MSI/EXE submission API for this MSIX product.

References: [MSIX API prerequisites and authentication](https://learn.microsoft.com/en-us/windows/uwp/monetize/create-and-manage-submissions-using-windows-store-services), [submission data and publish mode](https://learn.microsoft.com/en-us/windows/uwp/monetize/manage-app-submissions), [Store Developer CLI](https://learn.microsoft.com/en-us/windows/apps/publish/msstore-dev-cli/commands).

Listing:
- Prepare accurate descriptions and screenshots in the four supported languages.
- Explain AI requirements and provider billing without promising a subscription or free inference that PlayPets does not supply.
- Do not imply that PlayPets is an OpenAI product.

Certification notes:
- The manifest declares `runFullTrust`.
- Explain the desktop windows, the tray and the local coding-tool integration that people choose.
- This capability is not a request to run as administrator.
- Give the reviewer steps for testing the yard without connecting AI.
- Give the steps, and any safe test access, needed to assess the AI features.
- Do not submit personal production credentials.

Use the website privacy page for the listing once it is deployed:

- English: `https://playpets.gaerae.com/privacy`
- Korean: `https://playpets.gaerae.com/ko/privacy`
- Japanese: `https://playpets.gaerae.com/ja/privacy`
- Simplified Chinese: `https://playpets.gaerae.com/zh-hans/privacy`

Privacy policy:
- Before submission, review the policy against the connections that are actually enabled.
- The policy identifies the maintainer by the existing public handle and links to the public project contact.
- Before using it for a public submission, confirm who the responsible operator is.
- If public issues are unsuitable, provide a private privacy-contact route.
- Never ask people to post personal information in an issue.
- Confirm the effective date when publishing the policy.
- Describe accesses and transmissions truthfully in the Store privacy questionnaire.
- Optional AI can still transmit personal information.

A portal submission held after review:
1. Set **Submission options → Publishing hold options → Don't publish this submission until I select Publish now**.
   - The default is automatic publication after certification.
2. Save and verify the hold.
3. Choose **Submit to the Store**.

- API submissions use `STORE_PUBLISH_MODE` instead ([Publish mode](#publish-mode)).

## Apple membership and certificate

What it takes:
- For GitHub and website DMG downloads: Apple Developer Program membership, **Developer ID Application** signing and notarization.
- Membership is normally USD 99 per year, with regional pricing.
- Free developer accounts do not provide release notarization.
- This is not Mac App Store submission.

On the maintainer's Mac (the account holder creates this certificate):
1. Create a CSR in Keychain Access.
2. Issue a Developer ID Application certificate in Apple's Certificates, Identifiers & Profiles.
3. Install the downloaded certificate into the same keychain as its private key.
4. Export the identity, including its private key, as a password-protected `.p12`.
   - Keep it outside the checkout, for example under `~/.tauri/`, with an offline backup.
   - A `.cer` alone is not enough for CI.
5. Find the identity with `security find-identity -v -p codesigning`. It looks like `Developer ID Application: Legal Name (TEAMID)`.
6. Generate an app-specific password at the Apple Account website for notarization. Do not use the normal account password.
7. In the repository's **Settings → Secrets and variables → Actions**, set all six secrets:

| Secret | Value |
|---|---|
| `APPLE_CERTIFICATE` | Base64 of the exported `.p12`, including its private key |
| `APPLE_CERTIFICATE_PASSWORD` | The `.p12` export password |
| `APPLE_SIGNING_IDENTITY` | The full Developer ID Application identity |
| `APPLE_ID` | Apple account email used for notarization |
| `APPLE_PASSWORD` | App-specific password, not the account login password |
| `APPLE_TEAM_ID` | Membership Team ID |

Handling the secrets:
- On macOS, `base64 -i ~/.tauri/playpets-developer-id.p12 | pbcopy` copies the certificate secret without printing it.
- Paste it directly into the secret field and clear the clipboard afterward.
- Base64 is not encryption.
- Do not paste credentials into a chat, issue or commit.
- Existing `TAURI_SIGNING_PRIVATE_KEY` secrets stay as they are.
- They authenticate updates, not the Apple identity.

What the release workflow does:

| Apple secrets | Result |
|---|---|
| None | It keeps the existing ad-hoc build |
| A partial set | The macOS build fails instead of silently publishing an unsigned fallback |
| All six | Tauri receives the explicit identity through `APPLE_SIGNING_IDENTITY` and signs and notarizes the app during bundling. The workflow then notarizes and staples the DMG, which Tauri only signs |

- CI then verifies the signature, checks the Developer ID authority, assesses Gatekeeper acceptance and validates the stapled ticket, for the app and for the DMG.
- A signed DMG without its own ticket is refused when a downloaded copy is opened, even when the app inside is notarized.
- A successful ad-hoc `codesign --verify` alone does not prove Apple trust.

Local release test:
1. Use the installed keychain identity and the `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` and `APPLE_TEAM_ID` environment variables.
   - Enter passwords through a secure prompt instead of leaving them in shell history.
2. Run `npm run dist:mac`.
3. Confirm both Apple Silicon and Intel artifacts when releasing both architectures.
4. After building, run the following against the actual `.app`:

```bash
codesign --verify --deep --strict --verbose=2 /path/to/PlayPets.app
codesign --display --verbose=2 /path/to/PlayPets.app
spctl --assess --type execute --verbose=2 /path/to/PlayPets.app
xcrun stapler validate /path/to/PlayPets.app
```

5. Notarize and staple the DMG, then check it as a download:

```bash
xcrun notarytool submit /path/to/PlayPets.dmg --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID" --wait
xcrun stapler staple /path/to/PlayPets.dmg
spctl --assess --type open --context context:primary-signature --verbose=2 /path/to/PlayPets.dmg
```

6. Test a browser-downloaded DMG on a clean Mac.

Releases:
- Do not replace files of an immutable published release.
- Ship the first formally signed build as part of a new release.
- Creating a certificate does not require a public app release.
- The existing tag-triggered workflow still creates a draft.
- This preparation does not create a tag or publish a release.

Mac App Store:
- It needs a separate assessment: the current app uses macOS private APIs and local coding-tool integration.
- Developer ID signing and notarization do not make that configuration Store-ready.

## Official references

- [Microsoft product identity](https://learn.microsoft.com/en-us/windows/apps/publish/view-app-identity-details)
- [MSIX package requirements](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements)
- [Privacy policy and support information](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/support-info)
- [Hold a submission for manual publication](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/manage-submission-options)
- [Apple Developer Program enrollment](https://developer.apple.com/help/account/membership/program-enrollment/)
- [Developer ID certificates](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/)
- [Tauri macOS signing and notarization](https://v2.tauri.app/distribute/sign/macos/)
