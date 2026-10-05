# Proposal: Publish the landing page, user guide, and developer docs as one site on GitHub Pages

> Approved on 2026-10-03. The decision is in "[Publish the introduction, user guide, per-version pages and developer docs as one VitePress site on GitHub Pages](../decisions/2026-10-03-website-on-github-pages.md)", and the implementation follows that decision. The English version ships at the same time, and the pets for the screenshots were solved by drawing the mascot as pets.

## Summary
Build PlayPets' landing page, user guide, release pages for each version (with real screenshots), and developer docs with VitePress from `website/` in the repository, and publish them on GitHub Pages. Screenshots come from `npm run shots`, which launches the real app the way the E2E tests do, and on each release `npm run release` creates the page skeleton for that version. The developer docs put the current `docs/` on the site as is. The signing research becomes a research document in `docs/reference/`, separate from the blog post, so that when facts change only that document is edited. Korean comes first; English ships at the same time for the landing page and the guide only.

## Background
- The repository has developer docs (`docs/`) and one blog post, but the only place for someone who wants to use the app is the README. Download instructions, installation steps, and feature descriptions are scattered, and there is not a single screenshot.
- The user wants "static pages per version with feature descriptions and real screenshots" and "promotion, developer guide, and user guide in one place". GitHub Pages does this with one repository.
- The signing and distribution research exists only in a blog post (as of 2026-10-01). Blog posts are dated and not edited, but prices and policies change. A separate document that is kept current is needed.
- There is no GitHub remote repository yet. The site address is assumed to be `https://gaerae.github.io/playpets/` (the same account and name as `repository` in `package.json`).

## Goals and non-goals
**Goals**
- Pushing to `main` updates the site automatically. Build and deploy finish within 5 minutes in a single GitHub Actions workflow.
- Zero broken links. VitePress's dead-link check fails the build, so CI guarantees it.
- Every release page has at least one real app screenshot, and every version in the changelog has a release page (checked by `tests/website.test.mjs`).
- Screenshots for all three languages come out of one command (`npm run shots -- <version>`). Nobody has to position windows or click by hand.
- The first screen (the landing page) is 1.5MB or less, images included (checked by the size of the build output).
- `docs/` is the source of the developer docs and the site is a copy. The same text is not written in two places.

**Non-goals**
- No "docs version snapshots" that copy the whole guide for each version (see the alternatives).
- No external services such as comments, visitor analytics, newsletters, or search servers. Search uses VitePress's built-in local search.
- No Japanese landing page or guide this time. Only the slot (`website/ja/`) is opened.
- Windows and Linux screens are not captured automatically. The capture command runs on macOS, and screens from other OSes are added by hand under the same names.
- No custom domain decision this time.

## Proposal
### Site structure
`website/` is a VitePress 1.6 project (latest as of 2026-10-02). Korean is the default locale, and English is `website/en/`.

| Path | Content | Source |
|---|---|---|
| `/` | Landing page: mascot and one-line pitch, download buttons per OS, 6 features (one screenshot each), coding agent integration intro, pet communities you can import from | `website/index.md` |
| `/guide/` | User guide: installation (including first-launch warnings per OS), inviting your first friend, chat and AI connection, coding agent integration, desktop mode, games, importing pets, settings, FAQ | `website/guide/*.md` |
| `/releases/` | Page per version: what's new, what changed, what's fixed, screenshots, downloads, known limitations | `website/releases/<version>.md` |
| `/dev/` | Developer docs | `docs/` copied at build time (`website/dev/` is not in git) |
| `/blog/` | Dated posts | `docs/blog/` copied |
| `/en/` | English versions of the landing page and guide, and English release pages | `website/en/**` |

The fixed GitHub release addresses (`releases/latest/download/PlayPets_<version>_<target>.<ext>`) contain the version, so they cannot be used as "latest" links for the download buttons. So the landing page reads the GitHub API (`/repos/gaerae/playpets/releases/latest`) once in the browser to fill in the version and file addresses, and on failure sends visitors to the release list page. The visitor's OS is picked with `navigator.platform` and that button goes first.

### Screenshots
`scripts/shots.mjs` (`npm run shots -- <version>`) launches the real app the same way E2E does. It uses an isolated data folder, our own test pet (`tests/support/fixture-pet.mjs`), and a fake AI server, and starts the app once per language (`PLAYPETS_LANG=ko|en|ja`). The scenario runs inside the app through `PLAYPETS_E2E_EVAL`, builds the states one by one, and prints a `[shot] <name>` line for each; each time, the script captures the window area with `screencapture -R x,y,w,h`.

The window area comes from a new command, `e2eWindow`. Like `e2eLog`, it is only available when `PLAYPETS_E2E_EVAL` is set; it takes a window name (`main`, `overlay`) and returns `{x, y, width, height, scale}` in logical pixels. The same command also moves the window to a fixed size (1180×760) at the top left of the screen before capturing (`e2eWindow('main', {x, y, width, height})`).

| Capture name | State |
|---|---|
| `invite` | Invite tab, with pet cards visible |
| `friend-chat` | Friend tab, after two exchanges in the chat |
| `yard-evening` | Yard in the evening, two friends |
| `play-hide-and-seek` | With the hide-and-seek banner showing |
| `settings-agents` | Coding agent integration in the Settings tab |
| `mini` | Mini mode |
| `desktop` | Desktop mode, the overlay window area |

Results are saved at 2x resolution to `website/public/shots/<version>/<language>/<name>.png`. 7 shots × 3 languages × about 300KB adds about 6MB to the repository per version. The cap is 10MB per version; if it is exceeded, the number of shots is reduced.

### Connection to releases
- When `npm run release -- x.y.z` moves the changelog section, it creates a skeleton from that section's content if `website/releases/x.y.z.md` does not exist (including screenshot slots and a download table). Screenshots are taken before the release with `npm run shots -- x.y.z`. The steps are added to [Release a new version](../how-to/release.md).
- Next to each feature heading in the guide, the version it first arrived in is shown as a small marker (`0.2.0부터`, "since 0.2.0"). Release pages describe each version; the guide covers how to use the app now.
- The first page is `website/releases/0.1.0.md`, based on `[Unreleased]` in the changelog and marked "in preparation".

### Developer docs and signing research
- A pre-build step (`scripts/site-prepare.mjs`) copies `docs/` to `website/dev/` and `docs/blog/` to `website/blog/`. The registration note comment at the bottom of each document is an HTML comment, so it does not show on screen. Decision links written in the 「title」 form stay as they are.
- The signing and distribution research moves to `docs/reference/code-signing-and-distribution.md` and is kept as a current document. The blog post stays as it is, with a link to the current document added at the top. When facts change, only the research document is edited, with a date in its change history.

### Deployment
`.github/workflows/pages.yml` runs `npm run site:build` with Node 26 on pushes to `main` (paths `website/**`, `docs/**`, `CHANGELOG.md`) and on manual runs, and uploads with `actions/deploy-pages`. The Pages source in the repository settings has to be switched to "GitHub Actions" (once, by the maintainer).

### Verification
- `tests/website.test.mjs`: every version in the changelog has a release page, the screenshot files a release page points to exist, and the guide and landing page have the same file layout as the English version.
- `npm run site:build` is added to `build.yml` too, so every PR catches dead links.
- The capture scenario uses the same helper modules as `tests/e2e.mjs`, so if E2E passes, the captures come out too.

## Alternatives considered
| Choice | Alternative | Why rejected |
|---|---|---|
| VitePress | Docusaurus | It has built-in docs version snapshots, but the whole guide is copied for each version, which is hard for one person to maintain. The React toolchain does not fit the page code (no-build ES modules) |
| VitePress | Astro Starlight | Similar features, but VitePress gives a multilingual landing page and Vue components (download button, screenshot gallery) with less configuration |
| VitePress | Hand-written HTML | Search, multiple languages, table of contents, and code highlighting would all have to be built by hand |
| Release pages + version markers in the guide | A guide snapshot per version | Almost everyone on a desktop app runs the latest version. Maintaining old guides costs more than the few people who would read them |
| Capture the real app with `screencapture` | Capture headless Chrome with a mock bridge | Deterministic and runs in CI too, but without the macOS window frame and real fonts it is not a "real screen". It stays in use for regression checks |
| Commit screenshots to the repository | Capture in CI | Capturing a GUI app works on macOS runners, but permissions and resolution vary each time, so results are unstable |
| Copy `docs/` at build time | Make the repository root the VitePress root | The README would become the site's front page, and `src/` and `tests/` would have to be managed in an exclude list |
| Download button reads the GitHub API | Bake the version in at build time | The site would have to be rebuilt for every release, and it would drift from draft releases |

## Risks and security
- Without screen recording permission for the terminal, `screencapture` only captures the desktop. macOS asks for permission on the first run, and allowing it once is enough (confirmed).
- The pets for the screenshots were solved with three pets drawing the mascot in the Codex pet format (`assets/pets/`).
- Screenshot files grow the repository. There is a 10MB cap per version; if it is exceeded, the number of shots is reduced.
- The landing page's download button reads the GitHub API, so if it hits the rate limit (60 per hour per IP without login), the version is empty and only the release list link remains. The feature still works.
- GitHub Pages is free for public repositories. A private repository needs a paid account.

## Rollout plan
1. VitePress base structure, landing page (screenshot slots empty), deploy workflow. Check with a local build.
2. The `e2eWindow` command and `npm run shots`. Check that 7 shots × 3 languages come out.
3. User guide (Korean) and release page 0.1.0, the `npm run release` connection, `tests/website.test.mjs`.
4. Copying the developer docs, the signing research document (`docs/reference/`), and the link from the blog.
5. English landing page, guide, and release pages.
6. After the GitHub repository is created, turn on the Pages setting and check the first deploy (maintainer).

## Open questions
- Is the repository address final as `gaerae/playpets`? If not, change `repository` in `package.json` and the site `base`.
- Does the English version ship now, or Korean first?
- Is a separate pet sprite made for the landing page (see the risks above)?
- Can the terminal be given capture permission? If not, screenshots are taken by hand and put in the same paths.
