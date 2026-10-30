# The updater signing key is lost or leaked

## Trigger
Use this procedure when one of these is confirmed:
- The updater signing secret key file (`~/.tauri/playpets-updater.key`) and all its backups are gone.
- The secret key file or the CI secret `TAURI_SIGNING_PRIVATE_KEY` may have been exposed to someone else (committed to the repository, lost device, secret scanning alert, compromised GitHub account).

Gather the access points first:

| What | Where |
|---|---|
| Secret key file | `~/.tauri/playpets-updater.key` on the maintainer's device, offline backup (password manager or similar) |
| Public key | `plugins.updater.pubkey` in the repository's `src-tauri/tauri.conf.json` |
| CI secrets | https://github.com/gaerae/playpets/settings/secrets/actions |
| Releases | https://github.com/gaerae/playpets/releases |

## Severity and impact
| Case | Impact |
|---|---|
| The key is lost (no leak) | No new updates reach installed apps. The apps keep running; new installs are not affected. Users download a new version by hand once. No data leak, no fake update |
| The key leaked, the GitHub account is safe | An attacker can sign. The app takes updates only from the latest release of `github.com/gaerae/playpets`, so nothing reaches users unless that release can be changed. High: the moment the account is breached, fake updates become possible |
| The key leaked, and the GitHub account or CI is also compromised | A fake update can reach every installed app. Highest: stop everything and recover the account first |

## Diagnosis
1. Check whether the key files exist.

```bash
ls -la ~/.tauri/playpets-updater.key ~/.tauri/playpets-updater.key.pub
```

2. Look for the key in backups (password manager or similar). Found it? Restore it and end this procedure.

```bash
chmod 600 ~/.tauri/playpets-updater.key
```

3. Check that your key pair's public key matches the one in the app config.
   - The public key file and the config value are the same base64 string.
   - If the two lines match, this key pair is the one installed apps trust.
   - The secret and public key files are generated together, so a pair kept together in one folder matches.

```bash
cat ~/.tauri/playpets-updater.key.pub; echo; node -p "require('./src-tauri/tauri.conf.json').plugins.updater.pubkey"
```

4. Suspect a leak? Search the history for any secret key ever committed to the repository.
   - The secret key file is wrapped in base64.
   - In base64, every secret key starts with the same header: `untrusted comment: rsign encrypted secret key`.

```bash
git log --all -p -S "dW50cnVzdGVkIGNvbW1lbnQ6IHJzaWduIGVuY3J5" | head
```

5. Look for unknown runs or sign-ins in the GitHub account's security log (Settings → Security log) and in the repository's Actions run history.

## Mitigation and recovery
**If the key leaked, stop first.**
1. Change the GitHub account password and two-factor authentication.
   - Revoke every personal token, including `WINGET_TOKEN` and `HOMEBREW_TAP_TOKEN` (Settings → Developer settings → Personal access tokens).
2. Delete any release or tag you do not recognize.

```bash
gh release list --repo gaerae/playpets
gh release delete <unknown tag> --repo gaerae/playpets --cleanup-tag --yes
```

3. Delete the repository's CI secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (**Remove** on the CI secrets page above).

**Switch to a new key (whether it was lost or leaked).**
4. Generate a new key pair. Set a password this time.

```bash
pnpm exec tauri signer generate -w ~/.tauri/playpets-updater.key --force
```

5. Put the new public key in the app config.

```bash
node -e "const f='src-tauri/tauri.conf.json',fs=require('fs'),c=JSON.parse(fs.readFileSync(f));c.plugins.updater.pubkey=fs.readFileSync(process.env.HOME+'/.tauri/playpets-updater.key.pub','utf8').trim();fs.writeFileSync(f,JSON.stringify(c,null,2)+'\n')"
```

6. Store the new secret key in two backups. Recreate the CI secrets with the new values.

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY --repo gaerae/playpets < ~/.tauri/playpets-updater.key
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo gaerae/playpets
```

7. Add a notice and release.
   - Under `[Unreleased]` in `CHANGELOG.md`, write "Users of earlier versions have to download this version by hand once to keep getting updates".
   - Release by following [Release a new version](../how-to/release.md).
   - Why: apps that trust the old key reject updates signed with the new key, so users install this version by hand once.

8. Put the same notice in the README and the release notes.
   - Users who installed with winget or Homebrew get the new version through the package manager's upgrade.

## Verification
- The new release has `latest.json`.
- In an app with the new version installed, "Check for updates" in the Settings tab finds the next release once you publish it.
- The two lines from diagnosis step 3 match.
- If it was a leak, the GitHub security log shows no new unknown activity.

## Escalation
- The maintainer owns this.
- With more than one maintainer, someone else with repository admin rights also reviews it.
- The GitHub account or repository was compromised:
  - Report it to GitHub Support (https://support.github.com).
  - Create a security advisory from the repository's Security tab to tell users.
