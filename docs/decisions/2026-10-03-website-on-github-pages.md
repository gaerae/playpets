# Decision: Publish the introduction, user guide, per-version pages and developer docs as one VitePress site on GitHub Pages

## Context
The only place for someone who wanted to use the app was the README, and it had not a single screenshot. The user wanted "a static page with per-version feature descriptions and real screenshots" and "promotion, the developer guide and the user guide in one place". The proposal "[Publish the landing page, user guide, and developer docs as one site on GitHub Pages](../design/2026-10-02-website-on-github-pages.md)" was approved on 2026-10-03, and the survey of open-source desktop app sites, "[How do open-source desktop apps lay out their public websites?](../reference/oss-desktop-app-websites.md)", is the basis for the structure.

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

## Alternatives considered
| Alternative | Why rejected |
|---|---|
| Docusaurus versioned doc snapshots | The whole guide is copied for every version, which is hard for one person to maintain. Desktop app users are almost always on the latest version |
| Hand-written HTML | Search, multiple languages and tables of contents would all have to be built by hand |
| Screenshots with a mock bridge and headless Chrome | Deterministic, but without the macOS window frame and real fonts it is not a "real screen". Still used for regression checks |
| Screenshots in CI | Permissions and resolution on macOS runners differ from run to run, so the results are unstable |
| Download links with the version baked in at build time | The site would have to be rebuilt for every release, and it would disagree with draft releases |
