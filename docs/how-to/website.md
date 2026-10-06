# Edit and check the website

## Purpose
Edit the landing page, the user guide, the release pages, or the developer docs published on the site, and check them locally before they go out. When `main` is pushed, `pages.yml` builds the site and publishes it to GitHub Pages automatically. The landing page, user guide and release pages are in English (the site root), Korean (`/ko/`) and Simplified Chinese (`/zh-hans/`); the developer docs are in English only and are served at https://gaerae.github.io/playpets/dev/.

## Audience and assumptions
Anyone who has cloned the repository and run `npm ci`. Only taking new screen captures needs macOS; everything else works on any OS. The layout and the reasons for it are in the decision "[Publish the introduction, user guide, per-version pages and developer docs as one VitePress site on GitHub Pages](../decisions/2026-10-03-website-on-github-pages.md)".

## Prerequisites
| What you need | Check |
|---|---|
| Node.js 26 and `npm ci` | `node --version` |
| Screen captures only: macOS, Google Chrome, and a Rust toolchain (`npm run shots` builds the app itself with `--features e2e`) | `cargo --version` |

## Steps
1. Find the file for what you are changing.

| To change | File |
|---|---|
| Landing page text and layout | `website/.vitepress/theme/Landing.vue` (English, Korean and Simplified Chinese text live together), styling in `style.css` |
| User guide | `website/guide/*.md` (English), Korean in `website/ko/guide/*.md`, Simplified Chinese in `website/zh-hans/guide/*.md` |
| Release pages | `website/releases/<version>.md` (English), Korean in `website/ko/releases/`, Simplified Chinese in `website/zh-hans/releases/` |
| Developer docs | The originals under `docs/` (English only). `website/dev/` is a copy made at build time; do not edit it |
| Top menu, sidebar, fonts | `website/.vitepress/config.mts`; the developer docs sidebar is built by `sidebar-dev.mts` from `docs/` |
| What components say (button text and so on) | `website/.vitepress/theme/words.ts` |

2. Edit while watching the dev server. Changes show up as soon as you save.

```bash
npm run site:dev
```

3. To add a screen, use `<Shot name="name" caption="One sentence" />`. The name is one of `invite`, `friend-chat`, `yard-talk`, `yard-evening`, `play-hide-and-seek`, `settings-agents`, `mini`, `desktop`. Without a version, it shows the capture for the current `package.json` version. To add a new state, put it in the scenario in `scripts/shots.mjs` and capture again. Captures are taken over a backdrop window that covers the whole screen, so no other window shows behind the window corners and shadow; on the English pass, the script also records the yard for a few seconds to make `assets/demo.gif` (the moving picture in the README).

```bash
npm run shots -- 0.2.0
```

4. Mark the version where a feature first arrived with `<Since v="0.2.0" />` at the end of its heading. If you changed the headline or the first-screen text, redraw the share card and banner too.

```bash
npm run og
```

5. Build and check. A single dead link fails the build and names the file and the link. The test checks that every version in the changelog has a page and that every capture a page points to exists.

```bash
npm run site:build && node --test tests/website.test.mjs
```

6. Commit. Git ignores what `scripts/site-prepare.mjs` generates (`website/dev/`, the icon and pet sheets it copies into `website/public/`, and `website/.vitepress/generated.json`), so they are not included. Captures and intro videos under `website/public/` are committed.

## Landing intro video
The landing page has a slot for a short intro video in each site language. Without one, the first screen shows the illustrated yard scene (hills, sky and the three sample pets talking).

1. Put the files in `website/public/media/`, named by site language (`ko`, `en`, `zh-hans`).

| File | Needed |
|---|---|
| `intro-<lang>.mp4` | Yes. Its presence is what turns the video on for that language |
| `intro-<lang>.webm` | Optional. Browsers that play WebM pick it before the MP4 |
| `intro-<lang>.jpg` | Optional. The poster shown before the video starts |

2. Run `npm run site:dev` or `npm run site:build`. `scripts/site-prepare.mjs` checks each language for `intro-<lang>.mp4` and writes the result to `website/.vitepress/generated.json` as `video: { ko, en, "zh-hans" }`, each `true` or `false`.
3. `website/.vitepress/theme/Landing.vue` reads that file. For a language marked `true`, it shows a `<video>` (autoplay, muted, looping, inline) with the WebM and MP4 sources and the JPG poster. For a language marked `false`, it shows the illustrated scene. Each language is decided on its own, so the Korean page can have a video while the others still show the scene.

Only the MP4 is checked. If you add a WebM without an MP4, the page keeps showing the scene.

## Verification
- `website/.vitepress/dist/index.html` exists, and the build output has no `dead link`.
- Open it with `npm run site:preview` and the pages you changed show up. The address is `http://localhost:4173/playpets/`.

## Troubleshooting
| Symptom | Cause and fix |
|---|---|
| `Found dead link ../README.md in file dev/...` | A link in `docs/` points outside it. `scripts/site-lib.mjs` turns those into GitHub addresses, so this rarely happens. When it does, check that the linked file actually exists |
| "This screen has not been captured yet." where a screen should be | The capture file for that version and language is missing. Run `npm run shots -- <version>` or put `website/public/shots/<version>/<language>/<name>.webp` in place by hand |
| A macOS permission dialog shows up in the capture | Screen recording permission is not granted yet. Allow it in the dialog and capture again |
| The landing page download button shows only "Releases" | No release is published on GitHub, or the API call was blocked. It changes by itself once a release is out |
