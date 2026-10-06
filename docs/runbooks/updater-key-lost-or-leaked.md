# The updater signing key is lost or leaked

## Trigger
Use this procedure when one of the following is confirmed.
- The updater signing secret key file (`~/.tauri/playpets-updater.key`) and all its backups are gone.
- The secret key file or the CI secret `TAURI_SIGNING_PRIVATE_KEY` may have been exposed to someone else (committed to the repository, lost device, secret scanning alert, compromised GitHub account).

Gather the access points first.

| What | Where |
|---|---|
| Secret key file | `~/.tauri/playpets-updater.key` on the maintainer's device, offline backup (password manager or similar) |
| Public key | `plugins.updater.pubkey` in the repository's `src-tauri/tauri.conf.json` |
| CI secrets | https://github.com/gaerae/playpets/settings/secrets/actions |
| Releases | https://github.com/gaerae/playpets/releases |

## Severity and impact
- **The key is lost (no leak):** you cannot send new updates to apps already installed. The apps keep running, and new installs are not affected. Users have to download a new version by hand once. There is no data leak and no fake update.
- **The key leaked and the GitHub account is safe:** an attacker can sign, but the app takes updates only from the latest release of `github.com/gaerae/playpets`, so nothing reaches users unless that release can be changed. High: the moment the account is breached, fake updates become possible.
- **The key leaked and the GitHub account or CI is also compromised:** a fake update can reach every installed app. Highest: stop everything and recover the account first.

## Diagnosis
1. Check whether the key files exist.

```bash
ls -la ~/.tauri/playpets-updater.key ~/.tauri/playpets-updater.key.pub
```

2. Look for the key in backups (password manager or similar). If you find it, restore it and end this procedure.

```bash
chmod 600 ~/.tauri/playpets-updater.key
```

3. Check that the public key of the key pair you have matches the public key in the app config. If the two lines match, this key pair is the one installed apps trust. The public key file and the config value are the same base64 string. The secret key and public key files are generated together, so a pair that sat together in the same folder matches.

```bash
cat ~/.tauri/playpets-updater.key.pub; echo; node -p "require('./src-tauri/tauri.conf.json').plugins.updater.pubkey"
```

4. If you suspect a leak, search for a secret key ever committed to the repository. The secret key file is wrapped in base64, and every secret key starts with the same header (`untrusted comment: rsign encrypted secret key` in base64).

```bash
git log --all -p -S "dW50cnVzdGVkIGNvbW1lbnQ6IHJzaWduIGVuY3J5" | head
```

5. Look for unknown runs or sign-ins in the GitHub account's security log (Settings → Security log) and in the repository's Actions run history.

## Mitigation and recovery
**If the key leaked, stop first.**
1. Change the GitHub account password and two-factor authentication, and revoke every personal token (including `WINGET_TOKEN` and `HOMEBREW_TAP_TOKEN`) (Settings → Developer settings → Personal access tokens).
2. Delete any release or tag you do not recognize.

```bash
gh release list --repo gaerae/playpets
gh release delete <unknown tag> --repo gaerae/playpets --cleanup-tag --yes
```

3. Delete the repository's CI secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (Remove at the CI secrets address above).

**Switch to a new key (both when lost and when leaked).**
4. Generate a new key pair. This time, set a password.

```bash
npx tauri signer generate -w ~/.tauri/playpets-updater.key --force
```

5. Put the new public key in the app config.

```bash
node -e "const f='src-tauri/tauri.conf.json',fs=require('fs'),c=JSON.parse(fs.readFileSync(f));c.plugins.updater.pubkey=fs.readFileSync(process.env.HOME+'/.tauri/playpets-updater.key.pub','utf8').trim();fs.writeFileSync(f,JSON.stringify(c,null,2)+'\n')"
```

6. Store the new secret key in two backups, and recreate the CI secrets with the new values.

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY --repo gaerae/playpets < ~/.tauri/playpets-updater.key
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo gaerae/playpets
```

7. Write "Users of earlier versions have to download this version by hand once to keep getting updates" under `[Unreleased]` in `CHANGELOG.md`, and release by following [Release a new version](../how-to/release.md). Apps that trust the old key do not accept updates signed with the new key, so users have to install it by hand once.

8. Put the same notice in the README and the release notes. Users who installed with winget or Homebrew get the new version through the package manager's upgrade.

## Verification
- The new release has `latest.json`.
- In an app with the new version installed, "Check for updates" in the Settings tab finds the next release once you make it.
- The two lines from diagnosis step 3 match.
- If it was a leak, the GitHub security log shows no new unknown activity.

## Escalation
- The maintainer owns this. If there is more than one maintainer, someone with repository admin rights looks at it too.
- If the GitHub account or repository was compromised, report it to GitHub Support (https://support.github.com), and create a security advisory from the repository's Security tab to tell users.
