# Move the site to its own domain

## Purpose
Serve the site from a domain of its own (for example `https://playpets.app/`) instead of `https://gaerae.github.io/playpets/`. The address lives in one place, `homepage` in `package.json`: the site's base path, sitemap, share-card addresses and cards follow from it, and a test lists every other file that still names the old address.

## Audience and assumptions
The maintainer, with admin rights on the repository and access to the domain's DNS. Until this is done the site's address is `https://gaerae.github.io/playpets/`. While the account's own site (`gaerae.github.io`) uses the custom domain `gaerae.com`, GitHub sends that address on to `gaerae.com/playpets/`; the links still work.

## Prerequisites
- The domain is registered. A `.app` domain only works over HTTPS (the whole TLD is on the browsers' HSTS preload list); GitHub Pages issues the certificate by itself once DNS points at it.
- The address of the update feed does not change: installed apps read `latest.json` from GitHub releases, not from the site.

## Steps
1. Verify the domain for GitHub Pages, so no other account can claim it: your profile's Settings → Pages → Add a domain → `playpets.app`, then add the TXT record it shows (`_github-pages-challenge-gaerae.playpets.app`) at the DNS provider and press Verify.

2. Point the domain at GitHub Pages at the DNS provider.

| Type | Name | Value |
|---|---|---|
| A | `@` | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (four records) |
| AAAA | `@` | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |
| CNAME | `www` | `gaerae.github.io` |

   On Cloudflare, set these records to "DNS only" (grey cloud) at least until GitHub has issued the certificate.

3. In the repository, change the address and let the test list the rest.

```bash
npm pkg set homepage=https://playpets.app/
```

```bash
node --test tests/website.test.mjs
```

   The test "every place that names the site uses the address in package.json" fails with the list of files and addresses to change (README, `SECURITY.md`, the issue form, `packaging/linux/app.playpets.metainfo.xml`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, the docs). Change them until it passes. The site's base path becomes `/` by itself (`website/.vitepress/config.mts` reads it from the address).

4. Redraw the share cards, which print the address, and check the build.

```bash
npm run og
```

```bash
npm test && npm run site:build
```

5. Commit and push. `pages` deploys the site with the new base path.

6. Repository Settings → Pages → Custom domain: `playpets.app` → Save. After the DNS check passes, turn on "Enforce HTTPS". A deploy from GitHub Actions needs no `CNAME` file; the setting is enough.

## Verification
- `https://playpets.app/` opens the English landing page, and `/ko/`, `/zh-hans/` and `/dev/` work.
- `https://gaerae.github.io/playpets/` sends you to `https://playpets.app/`.
- The page source has `og:url` and `og:image` under `https://playpets.app/`, and `sitemap.xml` lists the new addresses.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Pages says "DNS check unsuccessful" | The records from step 2 have not spread yet, or Cloudflare is proxying them. Wait, or switch them to "DNS only" |
| "Enforce HTTPS" cannot be turned on | The certificate is not issued yet. It can take up to a day after the DNS check passes |
| Pages styles and scripts are missing after the move | The build still had the old base path. Check that `homepage` in `package.json` is the new address and redeploy |
