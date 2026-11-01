# Change the site address

## Purpose
- Move the website to a new domain without leaving the app, documentation, search metadata or share cards on the old address.
- Current public address: `https://playpets.gaerae.com/`.
- The address lives in one place: `homepage` in `package.json`.
- The site's base path, sitemap and share-card addresses follow from it.
- A repository test lists every other file that still names a different address.

## Audience and assumptions
- The maintainer, with admin rights on the repository and access to the domain's DNS.
- The update feed is independent of the website: installed apps read `latest.json` from GitHub releases.

## Set up a subdomain
For a subdomain such as `playpets.gaerae.com`:

1. Add a CNAME record at the DNS provider.

| Type | Name | Value |
|---|---|---|
| CNAME | `playpets` | `gaerae.github.io` |

2. In repository Settings → Pages, set Custom domain to `playpets.gaerae.com`.
3. Wait for GitHub Pages to approve the certificate, then enable Enforce HTTPS.

- GitHub recommends verifying the parent domain in the account's Pages settings, so another GitHub account cannot claim one of its subdomains.
- If `gaerae.com` is not already verified, follow the TXT-record instructions shown there.

## Move to another address
1. Change the canonical address. Keep the trailing slash.

```bash
pnpm pkg set homepage=https://example.com/
```

2. Run the repository test to list every remaining old reference.

```bash
node --test tests/website.test.mjs
```

3. Update the current docs, package metadata and tests it lists until it passes.
   - Do not rewrite dated decisions. When one mentions an address that was correct at the time, add a follow-up decision.

4. Redraw the share cards and check the project.

```bash
pnpm run og
pnpm test
pnpm run lint
pnpm run site:build
```

5. Commit and push. The `pages` workflow deploys the site with the new base path.
6. Update the custom domain in repository Settings → Pages, wait for its certificate, and enable Enforce HTTPS.

## Verification
- The English root and `/ko/`, `/ja/`, `/zh-hans/` and `/dev/` load over HTTPS.
- HTTP redirects to HTTPS.
- The former address redirects to the new canonical address.
- Canonical and language-alternate links, `og:url`, `og:image` and `sitemap.xml` use the new address.
- Styles, scripts, images and internal links load from the new base path.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Pages says DNS check unsuccessful | Check the DNS value and wait for it to propagate. If Cloudflare is in front, use DNS only until GitHub issues the certificate |
| Enforce HTTPS is unavailable | Wait for GitHub Pages to issue the certificate; this can take up to a day after the DNS check passes |
| Styles and scripts are missing | The build still used the old base path. Check `homepage`, rebuild and redeploy |
| Search or social previews show the old address | Rebuild the share cards, deploy again and inspect canonical, Open Graph and sitemap output |
