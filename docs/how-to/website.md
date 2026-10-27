# Edit and check the website

## Purpose
- Edit the landing page, the user guide, the release pages, or the developer docs published on the site, and check them locally before they go out.
- When `main` is pushed, `pages.yml` builds the site and publishes it to GitHub Pages automatically.
- The landing page, user guide and release pages are in English (the site root), Korean (`/ko/`), Japanese (`/ja/`) and Simplified Chinese (`/zh-hans/`).
- The developer docs are in English only and are served at https://playpets.gaerae.com/dev/.

## Audience and assumptions
- Anyone who has cloned the repository and run `npm ci`.
- Only taking new screen captures needs macOS.
- Everything else works on any OS.
- The decision "[Publish the introduction, user guide, per-version pages and developer docs as one VitePress site on GitHub Pages](../decisions/2026-10-03-website-on-github-pages.md)" explains the layout and the reasons for it.

## Prerequisites
| What you need | Check |
|---|---|
| Node.js 26 and `npm ci` | `node --version` |
| Screen captures only: macOS, Google Chrome, a Rust toolchain and Xcode Command Line Tools (`npm run shots` builds the app itself with `--profile e2e --features e2e` into `src-tauri/target/e2e/`; its window-list helper uses Swift) | `cargo --version` and `swiftc --version` |

`package.json` holds two `overrides` for the site's tools:

| Override | Why |
|---|---|
| `vite` at 6 | The pinned VitePress 1.6.4 still asks for vite 5, whose dev server has known advisories |
| `katex` at 0.19 | Pulled in by mermaid |

- Remove them once a stable VitePress asks for a fixed vite and mermaid asks for a fixed katex.
- Then check that `npm audit` stays clean and the site builds.

## Steps
1. Find the file for what you are changing.

| To change | File |
|---|---|
| Landing page text and layout | `website/.vitepress/theme/Landing.vue`; one `landing-<language>.ts` per language, each with `copy`, `worldCopy` and `sections`; `landing.css` and `style.css` |
| User guide | `website/guide/*.md` (English), Korean in `website/ko/guide/*.md`, Japanese in `website/ja/guide/*.md`, Simplified Chinese in `website/zh-hans/guide/*.md` |
| Release pages | `website/releases/<version>.md` (English), Korean in `website/ko/releases/`, Japanese in `website/ja/releases/`, Simplified Chinese in `website/zh-hans/releases/` |
| Developer docs | The originals under `docs/` (English only). `website/dev/` is a copy made at build time; do not edit it |
| Top menu, sidebar, fonts | `website/.vitepress/config.mts`; `sidebar-dev.mts` builds the developer docs sidebar from `docs/` |
| What components say (button text and so on) | `website/.vitepress/theme/words.ts` |

2. Edit while watching the dev server. Changes show up as soon as you save.

```bash
npm run site:dev
```

3. To add a screen, use `<Shot name="name" caption="One sentence" />`.
   - The name is one of `yard-spring`, `yard-summer`, `yard-winter`, `invite`, `friend-chat`, `yard-talk`, `yard-evening`, `play-hide-and-seek`, `settings-agents`, `mini`, `desktop`, `studio-day`, `studio-night`, `mini-chat`, `companions`.
   - Without a version, it shows the capture for the current `package.json` version.
   - To add a new state, put it in the scenario in `scripts/shots.mjs` and capture again.
   - Normal captures and GIF frames target only the isolated app process's window, matched by its PID and outer bounds.
   - A canvas adds the controlled backdrop behind transparent corners and the screenshot margin, so unrelated desktop windows cannot enter those pictures.
   - If the matching window is missing or ambiguous, capture stops.
   - The desktop picture captures only the app's overlay window and lays it on the same backdrop with a small terminal.
   - Nothing the system draws over the screen (the screen-sharing indicator, notifications, the screen's rounded corners) can appear in it.
   - `SHOT_SCENE=desktop` refreshes it alone.
   - On the English pass, the script also records the yard for a few seconds to make `assets/demo.gif` (the moving picture in the README).

```bash
npm run shots -- 0.2.0
```

   - For a faster pass with screenshots only, skip recording and encoding the GIF. The existing demo animation stays as it is.

```bash
SKIP_GIF=1 npm run shots -- 0.2.0
```

   - For only the four-companion picture, in all four site languages, use the shorter scene.
   - It shows Daisy, Clover, Pip and Miso and leaves the GIF unchanged.
   - The capture option keeps its historical name, `adults`.

```bash
SHOT_SCENE=adults SHOT_LANGS=ko,en,ja,zh-hans npm run shots -- 0.2.0
```

4. Mark the version where a feature first arrived with `<Since v="0.2.0" />` at the end of its heading. A first-release badge (`0.1.0`) shows nothing, and no badge appears in the page outline.
5. If you changed the headline or the first-screen text, redraw the share card and banner too.

```bash
npm run og
```

6. Build and check.
   - A single dead link fails the build and names the file and the link.
   - The test checks that every version in the changelog has a page and that every capture a page points to exists.

```bash
npm run site:build && node --test tests/website.test.mjs
```

   - To preview the production build, run `npm run site:preview` after the build.
   - Stop and restart a running preview after each rebuild, so renamed JavaScript chunks are served.
   - Check an interactive control as well as the page text.
   - Static HTML can load while a stale preview returns missing script files.
   - Use `npm run site:dev` for ongoing edits.

7. Commit.
   - Git ignores what `scripts/site-prepare.mjs` generates (`website/dev/`, the icon and pet sheets it copies into `website/public/`, and `website/.vitepress/generated.json`), so those files are not committed.
   - Captures and intro videos under `website/public/` are committed.

## Derived art and creator packages

Icons:
- `assets/icon.png` is the accepted illustrated Clover face. Its prompt is in `assets/icon-provenance.json`.
- `npm run icons` exports the app and installer icon formats, the matching colored tray face, and a self-contained `assets/icon.svg` wrapper for browsers.
- Site preparation copies that exported SVG and the generated PNG and ICO fallbacks.
- The site config uses content-revisioned favicon addresses, so an unchanged path does not keep an older icon in browser tabs.
- Regenerate these outputs through the scripts.
- After changing the source, inspect the tab icon the site actually serves.

Creator kits:
- `scripts/creator-specs.mjs` describes the approved Daisy, Clover, Pip and Miso sources.
- Site preparation runs `scripts/creator-kit.mjs` to copy accepted references and build each friend's baseline ZIP and design ZIP.
- Keep existing kit IDs and bookmarked query links working.
- The baseline ZIP contains `pet.json` and `spritesheet.png`.
- Optional PlayPets materials do not imply support in other hosts.
- `kitEntries` records the available detailed references and seasonal sheets.
- Source provenance, identity locks and detailed references ship with design kits.
- A runtime collage is not a detailed turnaround.

## Landing scenes and motion

Scenes:
- The landing uses real app captures.
- `WorldPreview.vue` offers the four built-in places and four outdoor seasons.
- Visitors choose a scene instead of waiting for a carousel.
- Refresh the spring, summer and winter captures in all four languages with:

```bash
SHOT_SCENE=seasons SHOT_LANGS=en,ko,ja,zh-hans npm run shots
```

- This shorter capture keeps the existing autumn, city and GIF exports.
- Before accepting each output, check framing, wardrobe, weather and legible UI.
- Captures use isolated data and do not change the user's friends.
- Before each image, the capture script clears transient focus and parks the pointer outside the app.
- Selected tabs and settings that matter stay visible.

Motion:
- Companion previews load when visible.
- The creator shelf and portrait stay still.
- Landing companion previews offer three motions and stop off screen.
- The page pause button and the system's reduced-motion preference stop animation.
- Intro video metadata is still available to tools, but the landing does not autoplay a video.

Copy and layout:
- Keep the landing copy in all four language modules.
- Lead with what a person can do.
- Keep AI costs and privacy visible.
- Put coding integration details in the expandable developer note.
- After changing the layout, check narrow screens, scene selection, keyboard focus and reduced motion.

## Creation KIT and SKILL

The studio component:
- The character and background routes stay separate in all four site languages.
- Each page embeds `CreationStudio.vue` with its `lang` and either `kind="pet"` or `kind="background"`.
- This shared component collects the creation request and prepares one downloadable KIT with the request, the references and the `playpets-creator` SKILL.
- `creation-copy.js` owns its four-language interface copy.
- `creation-kit.mjs` owns shared request construction and ZIP generation.
- Keep request previews and downloaded request text consistent.

What the website does and does not do:
- It is free and prepares files locally in the browser.
- It does not generate artwork, connect image services, upload user files or accept finished artwork for inspection, conversion or packaging.
- Generation, review, assembly, validation and final packaging happen in the person's chosen AI environment.
- The final hand-off is a pet ZIP or background JSON imported directly into PlayPets.
- A local pet folder is registered by path, not copied into app storage.
- Hand-off instructions say to extract the ZIP into a permanent location, and that the selected folder stays there while the pet is in use.
- An image-only service cannot run the supplied scripts.
- The workflow needs an AI agent that can read and write files and run Python, plus an image generation tool that environment supports.
- Do not imply that a ChatGPT subscription automatically grants image API access, or assume that tools and inference are free.

The skill source:
- `assets/creator-skill/playpets-creator/SKILL.md` is the source instruction file.
- The maintained `assets/creator-skill/playpets-creator/scripts/creator-workflow.py` ships as `scripts/creator-workflow.py` inside each downloaded skill.
- The script needs Python 3 and Pillow and does not install dependencies automatically.
- `scripts/creator-skill.mjs` copies the maintained skill and its references into `website/public/creator-kit/skill/` during site preparation.
- Never edit those generated public copies by hand.
- The downloadable KIT includes the skill files, so the AI agent can finish without returning to the website.

Packages:
- The maintained skill folder installs on its own and includes its MIT license.
- Keep it in this repository so the app formats and the validator change together.
- `npm run creator:skill` also emits `playpets-creator-plugin.zip`, using the application version, with:
  - a root `plugin.json`
  - a Claude Code `.claude-plugin/plugin.json` compatibility manifest
  - `skills/playpets-creator/`
- Both manifests point to the same skill files. There is no second skill source to maintain.
- The portable skill ZIP stays available for agents that use the [Agent Skills format](https://agentskills.io/specification).
- The plugin follows the [portable plugin package](https://developers.openai.com/plugins/build/plugins) layout and declares local execution because its helper runs Python.

Local install by hand:

| Host | Where | Invoke |
|---|---|---|
| Codex | `.agents/skills/` in a project, or `~/.agents/skills/` for personal discovery | `$playpets-creator` |
| Claude Code | `.claude/skills/` or `~/.claude/skills/` | `/playpets-creator` |

- Copy the entire folder, including the helper and references.
- Codex's built-in `$skill-installer` can also install this folder from `https://github.com/gaerae/playpets/tree/<published-ref>/assets/creator-skill/playpets-creator`.
  - Replace the placeholder with a published tag or commit that includes the helper.
- Some installed Codex versions use `$CODEX_HOME/skills` instead.
- Let the installed installer choose its supported destination. See [Codex skill discovery](https://learn.chatgpt.com/docs/build-skills).
- Claude Code: see [Claude Code skills](https://code.claude.com/docs/en/skills).

Publication:
- An installable package is separate from a published directory listing.
- Test a plugin through a local marketplace and a fresh conversation before requesting public distribution.
- OpenAI's [submission process](https://developers.openai.com/plugins/deploy/submission) requires access, identity verification, scans and review before publication.
- Do not describe an unsubmitted package as approved or listed.
- Building these archives for the website installs nothing, changes no account and publishes nothing.

Pets:
- The skill guides eleven approved 1536 × 1024 source batches, each a 4 × 2 grid.
- The supplied Python script assembles the 1536 × 2288 RGBA v2 atlas: nine animation states and sixteen gaze directions.
- Keep the format aligned with [Pet file format](../standards/pet-files.md).
- Automated checks cannot judge anatomy, character identity, action meaning or smooth animation.
- The skill includes image review before final packaging.
- Daisy, Clover, Pip and Miso stay downloadable as ready-to-import files through the shared component.
- The complete creation kit includes the detailed reference pictures.

Backgrounds:
- The skill prepares 1536 × 1024 artwork and the supported layout and atmosphere settings, including floor, water, fishing stance, window masks and optional seasonal images.
- Its final JSON follows [Portable backgrounds](add-a-world.md#portable-backgrounds).
- Geometry validation does not detect furniture or other obstacles painted on the floor.
- Review both large and small window crops, then check movement, weather and fishing in the app.

Checks:
1. Check both routes on direct entry, at phone widths, with keyboard navigation, in dark mode and with reduced motion.
2. Inspect the downloaded KIT contents.
3. Run the skill's Python checks against fixtures.
4. Keep reference provenance, and keep every request field and instruction consistent across the four site languages.
5. After rebuilding, test the production build in a freshly loaded preview.
   - An existing tab may keep an older component or stylesheet.

- The [in-app studio proposal](../design/2026-10-17-in-app-studio.md) records a direction that was not implemented.
- Its follow-up explains the current KIT and SKILL hand-off.

### Install with the skills CLI

- Use the [Vercel skills CLI](https://github.com/vercel-labs/skills) instead of publishing another npm installer.
- Its version is pinned in the site's copyable commands.
- Node.js and npm are needed only for installation.
- Image generation and Python with Pillow stay separate requirements.

Run this from the destination project:

```bash
npx --yes skills@1.7.2 add "/absolute/path/to/playpets/assets/creator-skill/playpets-creator" --skill playpets-creator --agent codex claude-code --copy
```

- This copies the whole skill into the project discovery directories that Codex and Claude Code use.
- It does not change personal skill directories.
- To install for only one tool, remove the other agent from the command.
- Quote a local folder path, especially when it contains spaces.
- To install without a checkout after the source has been published, replace the local path with `gaerae/playpets`.
  - The pinned CLI discovers the named skill from the repository root.
  - The isolated installation test covers that discovery from the complete root.
- For reproducible public installs, use the full GitHub source URL with a reviewed published tag or commit.
- Do not present a local-only source as already downloadable from GitHub.

To run the actual pinned CLI without writing to personal configuration:

```bash
PLAYPETS_TEST_SKILLS_INSTALL=1 node --test tests/creator-distribution.test.mjs
```

- The opt-in test uses an isolated temporary project, HOME and npm cache, disables CLI telemetry, compares installed files in both host directories, and runs the installed helper.
- It needs network access to npm and a Python environment with Pillow.
- Set `PLAYPETS_PYTHON` if that is not the default Python.
- Normal unit tests do not download or install the CLI.
- Host discovery in a new Codex or Claude Code conversation and official directory approval stay separate checks.

[Local Claude Code plugin testing](https://code.claude.com/docs/en/plugins):
1. Unzip `playpets-creator-plugin.zip` into a reviewed folder.
2. Run `claude --plugin-dir /absolute/path/to/unzipped-plugin`.
3. Invoke its skill, namespaced as `/playpets-creator:playpets-creator`.

- This is a local plugin command, not a claim that the package is listed in Anthropic's official marketplace.
- The portable manifest follows the current OpenAI package format.
- Test its local marketplace installation in a fresh supported host before submitting it for directory review.
