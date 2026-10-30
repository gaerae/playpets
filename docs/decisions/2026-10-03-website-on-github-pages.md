# Decision: Publish the introduction, user guide, per-version pages and developer docs as one VitePress site on GitHub Pages

## Context
The only place for someone who wanted to use the app was the README, and it had not a single screenshot. The goal was a static page with per-version feature descriptions and real screenshots, with the introduction, the developer guide and the user guide in one place. The decision was made on 2026-10-03, and the survey of open-source desktop app sites, "[How do open-source desktop apps lay out their public websites?](../reference/oss-desktop-app-websites.md)", is the basis for the structure.

## Decision
- The site is built with VitePress from `website/` in the repository, and `pages.yml` deploys it to GitHub Pages on every push to `main`. Korean is the default and English is at `/en/`.
- The first screen of the introduction page is a demo in which the mascot, drawn from a real sprite sheet, reacts to hook events in a fake terminal. Below it: gestures for each status, three features (real screenshots), the three connection steps and the agent table, a trust block, a latest-version card, and a final download.
- The user guide keeps only the latest usage. Per-version descriptions are handled by `website/releases/<version>.md`, whose skeleton `npm run release` creates from the changelog section. Feature headings carry a marker for the version they first appeared in (`<Since v="0.1.0" />`).
- For screenshots, `npm run shots -- <version>` launches the real app the E2E way, captures 7 states in three languages and saves them as WebP (`website/public/shots/<version>/<language>/`). The pets used for the screenshots are the three in `assets/pets/` (tabby, smoky, mochi), which draw the mascot in the Codex pet format.
- `docs/` is the source of the developer docs. A pre-build step copies them to `website/dev/` and rewrites links that point outside the site to GitHub addresses. The same text is not written in two places.
- The download button reads the latest release from the GitHub API in the browser and puts the file for the visitor's OS first. If that fails, it sends the visitor to the release list.

## Consequences
- Positive: One repository covers the introduction, the guide, the version history and the developer docs. Screenshots are automatic, so the pictures are current with every release. The build blocks dead links.
- Negative: Screenshots are automatic only on macOS, and screen recording permission has to be granted once. Screenshot files pile up in the repository at about 1 MB per version. The site loads outside fonts (Google Fonts, and Pretendard from jsDelivr).
- Neutral: The Japanese introduction and guide are placeholders only. No custom domain has been chosen.

## Follow-up (2026-10-06)
The one-site decision stands. Some details changed before the first release:
- The developer docs are English only. The pre-build step generates them into `website/dev/`, and they are served at `/dev/`.
- The landing page's first screen is now the yard: three sample pets talking in an illustrated scene, or a short intro video for a language that has one (see [Edit and check the website](../how-to/website.md)). This follows the decision to lead with pets talking to each other.
- A Simplified Chinese site was added at `/zh-hans/`.
- English became the default at the site root, because the README and the repository are in English; Korean moved to `/ko/`. Nothing had been published at the old addresses yet.
- The blog was dropped. Per-version pages under `releases/` cover what is new.
- There is no Japanese site. The app itself still speaks Japanese.
- `npm run shots` captures 8 screens and saves them as WebP for each site language.
- The screenshot regression check with a mock bridge and headless Chrome no longer exists.

## Follow-up (2026-10-30)
- The download links are now set when the site is built, from the releases GitHub lists as published (`scripts/site-releases.mjs`).
- The two reasons given below no longer hold:
  - Publishing a release starts the Pages build (`distribute.yml`), so no one rebuilds the site by hand.
  - The links come from published releases, not from the version in `package.json`, so a draft never gets a link.
- Why: the lookup in the browser was limited to 60 an hour per address and failed behind some networks; then the button only led to the release list.
- A site built while GitHub can't be reached still looks the release up in the browser, as before.

## Alternatives considered
| Alternative | Why rejected |
|---|---|
| Docusaurus versioned doc snapshots | The whole guide is copied for every version, which is hard for one person to maintain. Desktop app users are almost always on the latest version |
| Hand-written HTML | Search, multiple languages and tables of contents would all have to be built by hand |
| Screenshots with a mock bridge and headless Chrome | Deterministic, but without the macOS window frame and real fonts it is not a "real screen". It was kept for regression checks at first and has since been removed (see the follow-up) |
| Screenshots in CI | Permissions and resolution on macOS runners differ from run to run, so the results are unstable |
| Download links with the version baked in at build time | The site would have to be rebuilt for every release, and it would disagree with draft releases |
