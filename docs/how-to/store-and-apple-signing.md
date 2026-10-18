# Prepare Microsoft Store and Apple signing

## Purpose

Prepare an MSIX submission for Microsoft Store and Developer ID signing for macOS downloads. These are separate channels. Building a package does not submit it, and passing certification does not have to publish it. This guide does not enable automatic Store submission.

## Values the maintainer supplies

In Partner Center, open the reserved product, then **Product management → Product identity**. Copy these values exactly. They are public package metadata, not signing credentials. Do not use an Azure client secret, a Package SID or the Store ID as the publisher.

| Environment variable | Partner Center field | Required when |
|---|---|---|
| `MSIX_IDENTITY_NAME` | `Package/Identity/Name` | Making a Store MSIX |
| `MSIX_PUBLISHER` | `Package/Identity/Publisher`, including `CN=` | Making a Store MSIX |
| `MSIX_PUBLISHER_DISPLAY_NAME` | `Package/Properties/PublisherDisplayName` | Making a Store MSIX |
| Store ID (not a build variable) | The product's Store ID | Adding a Store listing link after publication |

The MSIX template keeps the app's visible name as PlayPets. `scripts/msix-manifest.mjs` fills and XML-escapes all three identity fields and the four-part package version. Setting any one Store identity field requires all three. No identity is invented on the maintainer's behalf. With all three unset, the build makes a test-signed package instead.

## Build and test Windows packages

Start Docker Desktop. From the repository root, use the real public values in place of these examples:

```bash
MSIX_IDENTITY_NAME='12345.Publisher.PlayPets' \
MSIX_PUBLISHER='CN=the-value-from-Partner-Center' \
MSIX_PUBLISHER_DISPLAY_NAME='Your publisher display name' \
npm run dist:windows
```

For repeated local builds, the maintainer can put the three public values into a local `.env.store` file as `NAME=value` lines and run `node --env-file=.env.store scripts/local.mjs windows`. This explicitly loads the file; `npm run dist:windows` does not load it automatically. `.env.store` is excluded from both Git and the Docker source copy; Node passes the values into the container. GitHub repository Variables are not read by this local path or by a Store CI workflow. Do not put Apple credentials into this file.

The Store hand-off is `release/windows/msix-store/PlayPets_<version>_x64.msix`, without a local test signature. Microsoft signs the package distributed through Store. Do not upload the NSIS EXE, the portable ZIP, a test certificate or a private key in its place. Store signing does not sign the EXE distributed through GitHub. This build path currently produces only x64 MSIX.

For a local install test, unset all three `MSIX_*` variables and run `npm run dist:windows`. Use the package and public certificate under `release/windows/msix-test/` only on a test Windows machine. The private test key stays in Docker's `playpets-msix-key` volume. A test certificate is not a public Windows signing identity. Do not attempt to install the unsigned Store hand-off by trusting a test certificate.

Windows package identity determines update ownership at runtime using `GetCurrentPackageFullName`, rather than a path substring or an environment variable that users can change. MSIX, including test MSIX, never calls the GitHub updater to check, download or install an EXE. Settings explains package-managed updates, and tray/menu update actions lead to that explanation. Unpackaged GitHub installations keep the existing signed updater. Runtime detection does not establish that a test MSIX was installed through Store.

## What Windows CI verifies

The x64 and ARM64 build jobs run `npm run test:msix:ci` after the regular native
E2E. The gate uses a separate `PlayPets.CI` identity and a short-lived local
certificate, without Store credentials or a submission API:

1. Pack, sign, verify and install the production executable as MSIX. Activate it
   through `shell:AppsFolder` with its AUMID, require a visible window, and check
   that it stays alive beyond the scheduled update check.
2. Install an E2E-feature package with the same test identity. In package context,
   verify the native `GetCurrentPackageFullName` result routes updates to Store,
   direct GitHub check/install calls are blocked, and Settings/tray actions show
   the Store explanation without installer controls.
3. Save a preference, install a higher package version with the same executable,
   and confirm it survives. This is a **package-only upgrade**, not a new app
   release or a Store download.
4. Remove the test package and temporary certificates. Upload JSON reports and
   logs even when the gate fails; never upload the private key or test packages
   as release assets.

The production activation uses the normal installed app entry. The instrumented
probe uses `Invoke-CommandInDesktopPackage`, Microsoft's debugging context, with
the CI package's normal app data path. It is not identical to Store activation and does not prove Store
certification, service delivery or the behavior of every clean Windows machine.
The script refuses ordinary local execution so unit tests cannot alter a
maintainer's packages or certificate stores.

After both architecture jobs pass, the remaining manual checks are:

- On a clean Windows device without development tools, confirm WebView2
  availability, visual layout, tray/desktop windows, close/exit, always-on-top
  and optional agent integration. CI checks package activation and update rules;
  it cannot judge these interactions visually or cover every device setup.
- Before submission, run the Windows App Certification Kit (WACK) against the
  actual Store hand-off. The CI gate is not a certification test. After
  submission is separately authorized, use a private Store package flight
  to verify installation and a real Store-delivered update with retained pets
  and credentials. A local certificate and `Add-AppxPackage` cannot simulate
  Store signing, licensing, certification or the delivery service.

## Prepare the listing and request certification

The app starts its aligned Store version series at `1.0.0`. The MSIX version
appends the reserved fourth component: app `1.0.0` becomes `1.0.0.0`, `1.0.1`
becomes `1.0.1.0`, and `1.1.0` becomes `1.1.0.0`. There is no major-version offset.
The generator rejects a zero major, prereleases and components above 65535.
Previously built local `1.2.0.0` test packages were never Store releases. They
cannot be upgraded in place to lower `1.0.0.0`; remove the test package first,
backing up any data you want to keep. Do not uninstall a real Store installation
as a routine update procedure.

Create a submission in Partner Center and complete pricing/markets, properties,
age ratings, packages, localized listings and submission options. Upload the
Store MSIX and resolve its validation messages. Keep the submission on manual
publication hold until release is separately authorized.

References: [Store package requirements](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements), [package-context debugging](https://learn.microsoft.com/en-us/powershell/module/appx/invoke-commandindesktoppackage).

## Submission automation and first-submission setup

Microsoft provides an MSIX submission API. Before creating submissions through
it, create the app's first submission in Partner Center, including its age-rating
questionnaire. Product reservation and the three package identity values alone
do not satisfy this prerequisite. The official requirement says to create a
first submission; it does not establish that this project has submitted, passed
certification or published anything.

The API also needs an Entra tenant associated with the Partner Center account,
an Entra application assigned the Manager role, and its tenant ID, client ID and
client secret. Confirm that the account supports the association; do not assume
that buying a developer membership grants API access. Keep the package identity
and the API application identity separate.

After this one-time setup, the intended flow is:

1. Build and validate the exact version on all supported architectures.
2. Create an API submission from the approved listing, replace the packages and
   apply the release notes. Stop if an unrelated pending submission exists.
3. Set `targetPublishMode` to `Manual`, upload packages and verify that the server
   retained manual hold before committing the submission for certification.
4. Poll certification status and preserve submission identifiers and redacted
   diagnostics. Do not call the publish endpoint; publishing needs a separate
   maintainer action.

For a future submission workflow, use a protected GitHub environment named
`microsoft-store`. Supply these values there, after its required-reviewer gate is
configured:

| Value | Storage | Source |
|---|---|---|
| `STORE_APP_ID` | Environment variable | Application ID expected by the MSIX submission API, confirmed from Partner Center/API app data |
| `STORE_TENANT_ID` | Environment variable | Associated Entra directory |
| `STORE_CLIENT_ID` | Environment variable | Entra application's application/client ID |
| `STORE_CLIENT_SECRET` | Environment secret | New client-secret **value**, not its identifier |

`STORE_CLIENT_SECRET` receives the **Key value**, not the Client ID or a key's
identifier. The Client ID belongs in `STORE_CLIENT_ID`. Never put the key in an
issue, chat message, checked-in file, workflow input or ordinary variable.
GitHub lists a saved secret's name and timestamp, not its value. Only a token
request and Store API call can confirm that it is the correct key.

The human Microsoft account owns the Store developer account. The associated
Entra tenant manages identities and application access. The Entra application is
an automation identity, not another Store product and not an ownership transfer.
GitHub uses its Client ID and key instead of the human administrator's password.
Microsoft's API guide requires Manager; the Partner Center UI describes that role
as account-wide access including user, role and tenant management, excluding tax
and payout settings. Treat the key as a high-privilege credential.

### Check credentials without submitting

`Store API verification` (`store-api.yml`) runs tests without credentials, then
waits for the `microsoft-store` environment's required reviewer. Its credentialed
step runs `npm run store:verify` without installing dependencies. It requests a
token, reads the app, checks its package identity and publisher, and reads any
pending submission's publication mode. It never creates, uploads, commits or
publishes a submission. Logs contain a small allowlisted report, not token
responses, provider error bodies, keys or upload URLs.

For initial setup without changing `main`, the workflow also runs on pushes to
the exact `ci/store-api-verification` branch. The environment needs that exact
branch rule temporarily. Remove the branch rule after checking credentials;
remove the temporary push trigger when integrating the workflow. Preserve the
required reviewer and the ban on administrator bypass. A sole maintainer can
approve their own manually started run, so `Prevent self-review` stays off.

### Prepare packages and request certification later

The Store workflows are separate from tag-triggered GitHub releases:

1. On `main`, run `Store packages` (`store-package.yml`) with an existing stable
   `v1.0.0` or later tag at the current `main` HEAD that includes the Store tooling.
   It requires the tag, workflow commit and current `main` source to match,
   builds/tests Windows x64 and ARM64 without Store
   credentials, and creates unsigned Store MSIX files. Its `store-bundle`
   artifact records the source commit, version and SHA-256 values. It does not
   install the unsigned packages or replace the Windows installation/WACK check.
2. Review that run and its artifacts. Run `Store certification submission`
   (`store-submit.yml`) on `main` with its run ID, a JSON object containing
   release notes for `en-us`, `ko-kr`, `ja-jp` and `zh-cn` (at most 1500
   characters each), and the exact confirmation `SUBMIT_FOR_CERTIFICATION`.
3. The workflow checks that the artifact came from a successful first-party
   Store package workflow on `main`. It verifies tag ancestry, file hashes,
   package CRCs, versions, architectures and Store manifest identities before
   waiting for the protected environment reviewer.
4. The repository variable `STORE_SUBMISSION_ENABLED` is a separate switch,
   defaulting to disabled. Leave it `false` during setup. Only change it to
   `true` after initial registration, publication and Windows validation are
   separately authorized and complete. Enabling it does not start a run.
5. After approval, `store:submit` refuses a product with no published baseline
   or any existing pending submission. For later releases it creates a new
   draft, replaces both architecture packages, updates localized release notes,
   and omits Pricing V2 from the update. It uploads only to the API's HTTPS Azure
   Blob destination and confirms that the saved mode is `Manual` before
   requesting certification. It reports the submission ID and leaves progress
   monitoring and publication to Partner Center.

There is no publish call or automatic retry. If a mutation times out or fails,
inspect the pending draft before doing anything else; a retry never silently
deletes a draft. A successful workflow means certification was requested, not
that certification passed or the product became public. The first portal draft
is left untouched. Do not use the MSI/EXE submission API for this MSIX product.

If an API creates a submission, continue editing that submission through the API;
Microsoft warns that mixing Partner Center edits with API changes can leave it
uncommittable. First-submission listing preparation in the portal is a separate
step.

References: [MSIX API prerequisites and authentication](https://learn.microsoft.com/en-us/windows/uwp/monetize/create-and-manage-submissions-using-windows-store-services), [submission data and manual publication](https://learn.microsoft.com/en-us/windows/uwp/monetize/manage-app-submissions).

Prepare accurate descriptions and screenshots in the four supported languages. Explain AI requirements and provider billing without promising a subscription or free inference that PlayPets does not supply. Do not imply that PlayPets is an OpenAI product.

The manifest declares `runFullTrust`. In certification notes, explain the desktop windows, tray and user-selected local coding-tool integration. This capability is not a request to run as administrator. Give the reviewer steps for testing the yard without connecting AI, and steps and any safe test access needed to assess AI-specific features. Do not submit personal production credentials.

Use the website privacy page for the listing, once it has actually been deployed:

- English: `https://playpets.gaerae.com/privacy`
- Korean: `https://playpets.gaerae.com/ko/privacy`
- Japanese: `https://playpets.gaerae.com/ja/privacy`
- Simplified Chinese: `https://playpets.gaerae.com/zh-hans/privacy`

Review the policy against actual enabled connections before submission. The policy identifies the maintainer by the existing public handle and links to public project contact. Before using it for a public submission, confirm the responsible operator identity and provide a private privacy-contact route if public issues are unsuitable. Never ask people to post personal information in an issue. Confirm the effective date when publishing the policy. Describe accesses and transmissions truthfully in the Store privacy questionnaire; optional AI can still transmit personal information.

For a review without immediate publication, set **Submission options → Publishing hold options → Don't publish this submission until I select Publish now**. The default is automatic publication after certification. Save and verify the hold before choosing **Submit to the Store**. A maintainer separately authorizes submission and later publication.

## Apple membership and certificate

For GitHub and website DMG downloads, use Apple Developer Program membership, **Developer ID Application** signing and notarization. Membership is normally USD 99 per year, with regional pricing. Free developer accounts do not provide release notarization. This is not Mac App Store submission.

On the maintainer's Mac, create a CSR in Keychain Access, issue a Developer ID Application certificate in Apple's Certificates, Identifiers & Profiles, then install the downloaded certificate into the same keychain as its private key. The account holder creates this certificate. Export the identity, including its private key, as a password-protected `.p12`. Keep it outside the checkout, for example under `~/.tauri/`, with an offline backup. A `.cer` alone is not enough for CI.

Find the identity with `security find-identity -v -p codesigning`. It looks like `Developer ID Application: Legal Name (TEAMID)`. Generate an app-specific password at the Apple Account website for notarization; do not use the normal account password.

In the repository's **Settings → Secrets and variables → Actions**, set all six secrets:

| Secret | Value |
|---|---|
| `APPLE_CERTIFICATE` | Base64 of the exported `.p12`, including its private key |
| `APPLE_CERTIFICATE_PASSWORD` | The `.p12` export password |
| `APPLE_SIGNING_IDENTITY` | The full Developer ID Application identity |
| `APPLE_ID` | Apple account email used for notarization |
| `APPLE_PASSWORD` | App-specific password, not the account login password |
| `APPLE_TEAM_ID` | Membership Team ID |

On macOS, `base64 -i ~/.tauri/playpets-developer-id.p12 | pbcopy` copies the certificate secret without printing it. Paste it directly into the secret field and clear the clipboard afterward. Base64 is not encryption. Do not paste credentials into a chat, issue or commit. Existing `TAURI_SIGNING_PRIVATE_KEY` secrets remain unchanged; they authenticate updates, not Apple identity.

The release workflow accepts the six secrets only as a complete set. With none, it retains the existing ad-hoc build; with a partial set, the macOS build fails instead of silently publishing an unsigned fallback. Tauri receives the explicit identity through `APPLE_SIGNING_IDENTITY`. It signs and notarizes the app during bundling. CI then verifies the signature, checks the Developer ID authority, assesses Gatekeeper acceptance and validates the stapled ticket. A successful ad-hoc `codesign --verify` alone does not prove Apple trust.

For a local release test, use the installed keychain identity and the `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` and `APPLE_TEAM_ID` environment variables, then run `npm run dist:mac`. Enter passwords through a secure prompt rather than writing them in shell history. Confirm both Apple Silicon and Intel artifacts when releasing both architectures.

After building, run the following against the actual `.app`, and test a browser-downloaded DMG on a clean Mac:

```bash
codesign --verify --deep --strict --verbose=2 /path/to/PlayPets.app
codesign --display --verbose=2 /path/to/PlayPets.app
spctl --assess --type execute --verbose=2 /path/to/PlayPets.app
xcrun stapler validate /path/to/PlayPets.app
```

Do not replace files of an immutable published release. Make the first formally signed build part of a new release. Creating a certificate does not require a public app release. The existing tag-triggered workflow still creates a draft; this preparation does not create a tag or publish a release.

Mac App Store needs a separate assessment: the current app uses macOS private APIs and local coding-tool integration. Developer ID signing and notarization do not make that configuration Store-ready.

## Official references

- [Microsoft product identity](https://learn.microsoft.com/en-us/windows/apps/publish/view-app-identity-details)
- [MSIX package requirements](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements)
- [Privacy policy and support information](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/support-info)
- [Hold a submission for manual publication](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/manage-submission-options)
- [Apple Developer Program enrollment](https://developer.apple.com/help/account/membership/program-enrollment/)
- [Developer ID certificates](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/)
- [Tauri macOS signing and notarization](https://v2.tauri.app/distribute/sign/macos/)
