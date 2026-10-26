# Set up the repository, keys and store accounts

## Purpose
Everything that is done once, in order, before PlayPets can be released and updated: the updater signing key, the GitHub repository and its settings, the CI secrets, the Homebrew tap and the winget submission, and the optional signing accounts. [Release a new version](release.md) assumes it is done. Which secret does what is in [Managing signing keys and secrets](../standards/keys-and-secrets.md); prices and conditions of the signing programs are in [code signing and distribution channels](../reference/code-signing-and-distribution.md).

## Audience and assumptions
The maintainer, with a GitHub account (`gaerae`) that owns the repository, a password manager (macOS Passwords, 1Password, Bitwarden or similar), the GitHub CLI logged in (`gh auth status`), and this repository cloned. Menu names are GitHub's as of 2026; on some accounts "Advanced Security" is still labeled "Code security".

| Account or service | Needed for | Cost | Sign-up |
|---|---|---|---|
| GitHub | The repository, CI, releases, the site, the Homebrew tap, winget | Free | Already there |
| Microsoft Contributor License Agreement | The first pull request to winget-pkgs | Free | Agreed in a comment on that pull request (step 11) |
| Apple Developer Program | Signing and notarizing the macOS app (optional) | $99 a year | Step 13 |
| Microsoft Partner Center | Publishing the MSIX in the Microsoft Store (optional) | Free for individuals | Step 14 |

Homebrew and winget need no account of their own: both are GitHub repositories.

## Steps

### Check an existing setup first

For an existing repository, inspect it before creating keys or accounts again.
Check `git remote -v` and `git status --short` locally, and use the repository's
Settings pages to confirm Pages, the default-branch ruleset, workflow permissions,
private vulnerability reporting and secret scanning. A configured but empty
repository still needs its first code push before Actions can validate the app
and publish the site.

Do not replace an existing updater key just because the secret values cannot be
read back from GitHub. Confirm the saved public key matches `plugins.updater.pubkey`
and retain its private-key backup. Secret names alone do not prove that the private
key and password are correct; a signed release build and update test confirm that.

The local repository includes `.gitignore`, `.gitattributes`, `.editorconfig`,
`.node-version`, Biome and editor recommendations, issue and pull-request templates,
Dependabot, review guidance and native build, Pages, release, distribution,
dependency submission and security workflows. `npm test` checks ignored
generated/secret paths, pinned actions and the Pages input paths. Run `actionlint`
too when it is available. `CODEOWNERS` and funding metadata are optional; add them
when there are review owners or a real funding destination to name.

### The updater signing key
Installed apps accept an update only if it is signed with this key, so it is made once, with a password, and never lost.

1. Generate a password in the password manager (a new entry such as "PlayPets updater signing key", 20 or more random characters) and save it.

2. Create the key pair. When asked, paste the password twice.

```bash
npx tauri signer generate -w ~/.tauri/playpets-updater.key
```

   It writes `~/.tauri/playpets-updater.key` (private, keep secret) and `~/.tauri/playpets-updater.key.pub` (public). If an older key is there and has never been in a release, move it aside first.

3. Back up the private key next to its password: copy the file's text into the note of the same password manager entry, then clear the clipboard.

```bash
pbcopy < ~/.tauri/playpets-updater.key
```

```bash
pbcopy < /dev/null
```

4. Put the public key in `plugins.updater.pubkey` of `src-tauri/tauri.conf.json` (the whole content of the `.pub` file, as it is), run `npm test`, and commit. The private key and the password never go into the repository or a chat.

### The GitHub repository
5. Create the repository: github.com/new, owner `gaerae`, name `playpets`, **Public**, and add nothing (no README, license or .gitignore: the repository already has them). The name matters: the updater address, the site and the install links all use `gaerae/playpets`.

6. Settings before the first push:
   - Settings → General → Pull Requests: turn on **Allow squash merging** and turn off **Allow merge commits** and **Allow rebase merging**. Set the default squash commit title to **Pull request title** and enable **Automatically delete head branches**. Review the commit body and retain co-author trailers before merging ([commit standard](../standards/commits-and-branches.md)).
   - Settings → Pages → Build and deployment → Source: **GitHub Actions**. If the page only lets you choose after a push, re-run the `pages` workflow from the Actions tab afterwards.
   - Settings → Pages → Custom domain: `playpets.gaerae.com`. Its CNAME points to `gaerae.github.io`; after the DNS check and certificate finish, turn on **Enforce HTTPS**. The complete setup and migration checks are in [Change the site address](site-address.md).
   - Settings → Actions → General → Workflow permissions: **Read repository contents and packages permissions**; leave "Allow GitHub Actions to create and approve pull requests" off. Enable "Require actions to be pinned to a full-length commit SHA" (every action here is pinned).
   - Settings → Advanced Security: **Private vulnerability reporting: Enable** (`SECURITY.md`, the Code of Conduct and the issue form send reports there); Dependabot alerts and security updates: Enable; make sure secret scanning and push protection are on.
   - Settings → General → Features: Issues on; Wiki, Discussions and Projects off. Social preview: upload `website/public/og.png`.
   - The gear next to About on the repository page: description `A little yard for companions who talk to you and each other. Optional AI connections and coding-agent reactions.`, website "Use your GitHub Pages website", topics `desktop-pet`, `tauri`, `codex-pet`, `claude-code`, `coding-agent`, `ollama`, `rust`.
   - Settings → General → Releases: enable **Release immutability**. It applies to future releases: finish uploading and checking draft assets before publishing. After publication, preserve their files and tags and ship corrections in the next patch version.
   - Settings → Rules → Rulesets: import the three definitions in [`.github/rulesets/`](https://github.com/gaerae/playpets/tree/main/.github/rulesets). `main-history.json` blocks default-branch deletion and force pushes without a bypass. `main-review.json` requires squash PRs, resolved review threads, the six native/site checks, `Security checks` and CodeQL with no new high-severity security findings or analysis errors. Its Repository admin exception allows only the documented operational use: pushing the generated release commit directly to main. The separate history rule still blocks deletion and force pushes for admins.
   - `release-tags.json` permits new `v*.*.*` tags but blocks later updates and deletions, with no bypass. Validate a tag locally before pushing; a mistaken pushed tag stays in history and a correction uses a new version. Enable required-check and CodeQL rules only after those checks have run successfully; their exact names and the GitHub Actions application ID are recorded in the definitions.

7. Push. Do not push with `--all` or `--tags`.

```bash
git remote add origin https://github.com/gaerae/playpets.git
```

```bash
git push -u origin main
```

8. Watch the Actions tab: `build` (five platforms and `site`), `security`, `codeql` and `pages` run, and `pages` publishes https://playpets.gaerae.com/.

Optional, once the code is pushed: automatic reviews from CodeRabbit (free for public repositories). Sign in at https://app.coderabbit.ai with GitHub, install its app with **Only select repositories** → `gaerae/playpets`, and it reviews every pull request from then on. It reads `.coderabbit.yaml` (what to review and how) and, as its guidelines, `AGENTS.md` and `docs/standards/`. Ask it things in a pull request comment with `@coderabbitai`.

### CI secrets for signed updates
9. Add the key and its password as repository secrets. The second command asks for the value; paste the password from the password manager.

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY --repo gaerae/playpets < ~/.tauri/playpets-updater.key
```

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo gaerae/playpets
```

   From now on a release draft carries `latest.json` and the signed update files.

### Homebrew tap
A tap is your own Homebrew repository. Users install with `brew install gaerae/tap/playpets`; the `distribute` workflow updates the cask after every published release.

10. Create the tap and its token.
    - github.com/new: owner `gaerae`, name **`homebrew-tap`** (Homebrew finds it by this name), Public, **Add a README file** (so it has a `main` branch).
    - One tap holds every app of the account: a later app adds its own `Casks/<app>.rb` there, with its own token.
    - Keep the tap checked: a workflow that runs `brew style` and `brew audit --cask --strict --online` on every push, Dependabot for its actions, and a ruleset on `main` that blocks deletion and force pushes. Do not require pull requests there; `distribute` pushes to `main` directly.
    - github.com/settings/personal-access-tokens/new (fine-grained token): name `playpets homebrew-tap`, expiration 1 year, Repository access → Only select repositories → `gaerae/homebrew-tap`, Permissions → Repository permissions → **Contents: Read and write**. Generate, and save the token in the password manager with its expiry date.
    - Add it to the PlayPets repository (paste the token when asked):

```bash
gh secret set HOMEBREW_TAP_TOKEN --repo gaerae/playpets
```

   Until the app is signed with a Developer ID, Homebrew keeps the download quarantined, so the first launch asks for permission just as the dmg does. The official Homebrew cask repository does not take unsigned apps; the own tap is the path until step 13.

### winget
winget packages are manifests in `microsoft/winget-pkgs`. The `distribute` workflow writes them and, with a token, opens the pull request with `wingetcreate`.

11. Prepare the fork, the token and the license agreement.
    - Fork https://github.com/microsoft/winget-pkgs to the `gaerae` account (Fork → Create fork, default branch only). It is large; the fork is only the place pull requests come from, and every app of the account shares it.
    - In the fork's Settings, turn off Actions (Actions → General → Disable actions) so the upstream workflows never run there, and turn off Wiki, Issues and Projects.
    - github.com/settings/tokens/new (classic token; a fine-grained token cannot open a pull request on another owner's repository): note `playpets winget`, expiration 1 year, scope **public_repo** only. Save it in the password manager with its expiry date.
    - Add it to the PlayPets repository:

```bash
gh secret set WINGET_TOKEN --repo gaerae/playpets
```

    - On the first pull request (opened by `distribute` after the first release is published), a Microsoft bot asks for the Contributor License Agreement. Agree by commenting `@microsoft-github-policy-service agree` on that pull request. A new package is reviewed by winget's moderators by hand (a few days); later versions are merged by their bots once checks pass. Users then install with `winget install gaerae.PlayPets`.

### Reminders
12. Tokens expire. Put the two expiry dates (step 10 and 11) in a calendar a week early, and when they come, create a new token the same way and run the same `gh secret set` again. The updater key does not expire, so it only needs its backup.

### Optional: signing accounts
13. Apple Developer Program (removes the macOS "unidentified developer" step and makes an official Homebrew cask possible).
    - Enroll at https://developer.apple.com/programs/enroll/ as an individual with your Apple Account (two-factor authentication on, legal name, $99 a year).
    - In Certificates, Identifiers & Profiles, create a **Developer ID Application** certificate, install it in the keychain, and export it as a `.p12` with a password.
    - At https://account.apple.com create an app-specific password for notarization, and note the Team ID from the membership page.
    - Add the six secrets (`APPLE_CERTIFICATE` is the `.p12` in base64: `base64 -i cert.p12 | pbcopy`): `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY` (the certificate's name, "Developer ID Application: … (TEAMID)"), `APPLE_ID`, `APPLE_PASSWORD` (the app-specific password), `APPLE_TEAM_ID`. The release workflow requires all six values together and verifies Developer ID trust and notarization. See the [Store and Apple signing guide](store-and-apple-signing.md) before building.

14. Microsoft Store (the Store signs the MSIX, so Store installs have no SmartScreen warning).
    - Register as an individual developer at https://partner.microsoft.com/dashboard/registration (free; an ID scan and a selfie).
    - Reserve the name "PlayPets", and copy all three identity fields (`Name`, `Publisher`, `PublisherDisplayName`) from the product identity page.
    - Follow [Prepare Microsoft Store and Apple signing](store-and-apple-signing.md) to set `MSIX_IDENTITY_NAME`, `MSIX_PUBLISHER` and `MSIX_PUBLISHER_DISPLAY_NAME`, build the unsigned Store MSIX, test a separate test-signed package, and prepare the listing and privacy policy. Store updates are separate from GitHub updates. The first registration is manual. Later certification workflows need the protected `microsoft-store` environment and a separately enabled repository switch; publication remains manual. The read-only API check does not submit anything.


## Verification
- The Actions tab shows `build`, `security`, `codeql` and `pages` green, and https://playpets.gaerae.com/ opens on an `https://` address.
- The repository page shows the description, the website and the topics, and Settings → Rules lists the ruleset for `main`.
- The Security tab shows "Report a vulnerability".
- Settings → Secrets and variables → Actions lists `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, `HOMEBREW_TAP_TOKEN` and `WINGET_TOKEN`.
- After the first published release: `distribute` is green, `Casks/playpets.rb` is in `gaerae/homebrew-tap`, and a pull request for `gaerae.PlayPets` is open on winget-pkgs.

## Troubleshooting
| Symptom | Fix |
|---|---|
| `pages` fails at "Get Pages site failed" | The Pages source is not "GitHub Actions" yet (step 6). Set it and re-run the workflow |
| The security policy's link opens a 404 | Private vulnerability reporting is off (step 6) |
| The release draft has no `latest.json` | The updater secrets are missing or the password is wrong (step 9). Fix them, delete the draft and run `release` by hand with the same tag |
| `homebrew` in `distribute` fails to clone or push | `gaerae/homebrew-tap` does not exist, has no `main` branch, or the token has expired or lacks Contents write (step 10) |
| The winget pull request is not opened | `WINGET_TOKEN` is missing, expired, or not a classic token with `public_repo`, or the fork is missing (step 11). The manifests are still in the run's `store-manifests` artifact for a manual submission |
| The winget pull request waits with a CLA label | The license agreement comment is missing (step 11) |
