# Edit and check the website

## Purpose
Edit the landing page, the user guide, the release pages, or the developer docs published on the site, and check them locally before they go out. When `main` is pushed, `pages.yml` builds the site and publishes it to GitHub Pages automatically. The landing page, user guide and release pages are in English (the site root), Korean (`/ko/`), Japanese (`/ja/`) and Simplified Chinese (`/zh-hans/`); the developer docs are in English only and are served at https://playpets.gaerae.com/dev/.

## Audience and assumptions
Anyone who has cloned the repository and run `npm ci`. Only taking new screen captures needs macOS; everything else works on any OS. The layout and the reasons for it are in the decision "[Publish the introduction, user guide, per-version pages and developer docs as one VitePress site on GitHub Pages](../decisions/2026-10-03-website-on-github-pages.md)".

## Prerequisites
| What you need | Check |
|---|---|
| Node.js 26 and `npm ci` | `node --version` |
| Screen captures only: macOS, Google Chrome, a Rust toolchain and Xcode Command Line Tools (`npm run shots` builds the app itself with `--profile e2e --features e2e` into `src-tauri/target/e2e/`; its window-list helper uses Swift) | `cargo --version` and `swiftc --version` |

`package.json` holds two `overrides` for the site's tools: `vite` at 6 (the pinned VitePress 1.6.4 still asks for vite 5, whose dev server has known advisories) and `katex` at 0.19 (pulled in by mermaid). Remove them once a stable VitePress asks for a fixed vite and mermaid for a fixed katex, and check that `npm audit` stays clean and the site builds.

## Steps
1. Find the file for what you are changing.

| To change | File |
|---|---|
| Landing page text and layout | `website/.vitepress/theme/Landing.vue`; one `landing-<language>.ts` per language, each with `copy`, `worldCopy` and `sections`; `landing.css` and `style.css` |
| User guide | `website/guide/*.md` (English), Korean in `website/ko/guide/*.md`, Japanese in `website/ja/guide/*.md`, Simplified Chinese in `website/zh-hans/guide/*.md` |
| Release pages | `website/releases/<version>.md` (English), Korean in `website/ko/releases/`, Japanese in `website/ja/releases/`, Simplified Chinese in `website/zh-hans/releases/` |
| Developer docs | The originals under `docs/` (English only). `website/dev/` is a copy made at build time; do not edit it |
| Top menu, sidebar, fonts | `website/.vitepress/config.mts`; the developer docs sidebar is built by `sidebar-dev.mts` from `docs/` |
| What components say (button text and so on) | `website/.vitepress/theme/words.ts` |

2. Edit while watching the dev server. Changes show up as soon as you save.

```bash
npm run site:dev
```

3. To add a screen, use `<Shot name="name" caption="One sentence" />`. The name is one of `yard-spring`, `yard-summer`, `yard-winter`, `invite`, `friend-chat`, `yard-talk`, `yard-evening`, `play-hide-and-seek`, `settings-agents`, `mini`, `desktop`, `studio-day`, `studio-night`, `mini-chat`, `companions`. Without a version, it shows the capture for the current `package.json` version. To add a new state, put it in the scenario in `scripts/shots.mjs` and capture again. Normal captures and GIF frames target only the isolated app process's window, matched by its PID and outer bounds. A canvas adds the controlled backdrop behind transparent corners and the screenshot margin, so unrelated desktop windows cannot enter those pictures. If the matching window is missing or ambiguous, capture stops. Desktop-overlay pictures bring the prepared backdrop to the foreground before capturing the friends above it. On the English pass, the script also records the yard for a few seconds to make `assets/demo.gif` (the moving picture in the README).

```bash
npm run shots -- 0.2.0
```

For a faster screenshot-only pass, skip recording and encoding the GIF. This preserves the existing demo animation:

```bash
SKIP_GIF=1 npm run shots -- 0.2.0
```

To refresh only the three-companion picture in all four site languages, use the abbreviated scene. It shows Daisy, Clover and Pip and leaves the GIF unchanged. The capture option retains its historical name, `adults`:

```bash
SHOT_SCENE=adults SHOT_LANGS=ko,en,ja,zh-hans npm run shots -- 0.2.0
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

## Derived art and creator packages

`assets/icon.png` is the accepted illustrated Clover face, with its prompt in
`assets/icon-provenance.json`. `npm run icons` exports the app and installer icon
formats, the matching colored tray face, and a self-contained `assets/icon.svg`
wrapper for browsers. Site preparation copies that exported SVG
and the generated PNG/ICO fallbacks; the site config uses content-revisioned
favicon addresses so unchanged paths do not keep an older icon in browser tabs.
Regenerate these outputs through the scripts and inspect the actual served tab
icon after changing the source.

`CreatorKit.vue` uses specifications from `scripts/creator-specs.mjs`; site
preparation runs `scripts/creator-kit.mjs` to copy accepted references and build
standalone import packages for Daisy, Clover and Pip. The studio is also
a main navigation destination in every site language. Preserve existing kit IDs and bookmarked query links
when changing presentation. The minimal portable package has one canonical
`pet.json` and baseline sheet. Optional PlayPets-specific materials do not imply
compatibility with other hosts. Source provenance, identity locks and references
travel with reusable creator prompts. `kitEntries` records each pet’s available
detailed references and seasonal sheets; the UI and bundles use that inventory.
A runtime collage is not a detailed turnaround. A copied prompt still needs image review,
packing and validation before its result is a playable pet.

## Landing scenes and motion

The landing uses actual app captures. `WorldPreview.vue` offers the four built-in places and
four outdoor seasons; visitors choose a scene rather than waiting for a carousel.
Refresh the spring, summer and winter captures in all four languages with:

```bash
SHOT_SCENE=seasons SHOT_LANGS=en,ko,ja,zh-hans npm run shots
```

The abbreviated capture preserves existing autumn, city and GIF exports.
Check framing, wardrobe, weather and legible UI before accepting each output.
Captures use isolated data and do not change the user's friends. The capture
script clears transient focus and parks the pointer outside the app before each
image; meaningful selected tabs and settings remain visible.

Companion previews load when visible. The creator shelf and portrait stay still;
landing companion previews offer three motions and stop off screen. The page pause button and
the system's reduced-motion preference stop animation. Intro video metadata is
still available to tools, but the landing does not autoplay a video.

Keep the landing copy in all four language modules. Lead with what a person can
do, keep AI costs and privacy visible, and put coding integration details in the
expandable developer note. Check narrow screens, scene selection, keyboard
focus and reduced motion after changing the layout.


## Browser creation workbenches

`CreatorKit.vue` offers the approved source kits. `creator-task.mjs` fills the
chosen motion sequence or seasonal prompt without changing the runtime atlas
contract. `ExtensionPrompts.vue` uses the same supported state choices for a
creator's own permitted reference. `PetPackager.vue` accepts finished v2 atlases,
not the eleven 4 × 2 source batches; the source-batch packer remains a maintainer
tool.

`studio-files.mjs` checks PNG signatures, chunk boundaries, CRCs, exact dimensions
and the pet's 8-bit RGBA format. The browser then decodes pixels and checks the 73
consumed animation and gaze cells. Near-edge artwork is a review warning, not an
automatic rejection. The ZIP contains the original accepted image bytes and a
manifest with only supplied seasonal files. Browser ZIP bytes are tested against
the existing deterministic kit ZIP writer. Input PNGs are limited to 16 MiB each
for pets and 6 MiB each for backgrounds. Files are processed locally and are not
retained after reloading or navigating away.

`BackgroundKit.vue` uses the app's package and geometry validators. Reopening a
v1 JSON checks and decodes every image before replacing the current workbench,
and preserves all supported window masks. The exported guide and prompt include
every enabled pane. Source, full-yard, mini and narrow previews use the same
floor-anchored image transform as the runtime; a regression test compares their
coordinates. These are composition previews, not a substitute for checking live
lighting, weather, fishing and movement inside the app.

Maintain `studio-copy.js` in all four site languages. File errors stay beside the
input and successful operations use an announced status. Check both studios on
direct entry, at phone widths, in dark mode and with reduced motion. The PNG and
cell checks cannot judge anatomy, identity consistency, animation meaning,
obstacles or visual quality; the guides keep those manual review steps explicit.

## Studio interface

The top menu calls both creation tools Studio. Keep the character and background routes separate so shared links still resolve; use a specific document title for each route. `StudioNav.vue` connects them in every language.

Use Reka UI's Tabs and Collapsible primitives for the workbench navigation and optional controls, with the shared visual vocabulary in `studio.css`. The library handles keyboard navigation and disclosure state; the PNG validators and portable file formats remain shared with the app. Website license notices include packages actually bundled into the client.

`StudioWorkspace.vue` keeps character task panels mounted so changing tabs retains the selected files and entered details. Hidden pet previews stop playback. `studio-flow.mjs` resolves the existing guide anchors and creates portable IDs from a name without replacing an ID the person edited. Background phases keep one preview visible beside the active controls. Put numeric placement details behind the disclosure instead of showing every coordinate at first.

A tab change keeps the draft in memory, not on a server. A reload or route change still discards unsaved files. Keep that limitation visible and offer a file download before the person leaves. Check actual exports, keyboard tabs, direct links, narrow screens and dark mode when changing these components.
