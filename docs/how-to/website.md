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

To refresh only the four-companion picture in all four site languages, use the abbreviated scene. It shows Daisy, Clover, Pip and Miso and leaves the GIF unchanged. The capture option retains its historical name, `adults`:

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

For a production preview, start `npm run site:preview` after the build. Stop and restart a running preview after each rebuild so renamed JavaScript chunks are served. Check an interactive control as well as the page text: static HTML can load while a stale preview returns missing script files. Use `npm run site:dev` for ongoing edits.

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

`scripts/creator-specs.mjs` describes the approved Daisy, Clover, Pip and Miso sources.
Site preparation runs `scripts/creator-kit.mjs` to copy accepted references and
build each friend's baseline ZIP and design ZIP. Preserve existing kit IDs and
bookmarked query links. The baseline ZIP contains `pet.json` and
`spritesheet.png`; optional PlayPets materials do not imply support in other
hosts. `kitEntries` records available detailed references and seasonal sheets.
Source provenance, identity locks and detailed references travel with design
kits. A runtime collage is not a detailed turnaround.

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


## Creation KIT and SKILL

The character and background routes remain separate in all four site languages.
Each page embeds `CreationStudio.vue` with its `lang` and either `kind="pet"` or
`kind="background"`. This shared component collects the creation request and
prepares one downloadable KIT containing the request, references and the
`playpets-creator` SKILL. `creation-copy.js` owns its four-language interface copy;
`creation-kit.mjs` owns shared request construction and ZIP generation. Keep
request previews and downloaded request text consistent.

The website is free and prepares files locally in the browser. It does not
generate artwork, connect image services, upload user files or accept finished
artwork for inspection, conversion or packaging. Generation, review, assembly,
validation and final packaging happen in the person's chosen AI environment.
The final handoff is a pet ZIP or background JSON imported directly into PlayPets.
A local pet folder is registered by path rather than copied into app storage;
hand-off instructions explain that the ZIP is extracted into a permanent location
and that the selected folder remains there while the pet is used.
An image-only service cannot run the supplied scripts: the workflow needs an AI
agent that can read and write files and execute Python, plus an image generation
tool supported by that environment. Do not imply that a ChatGPT subscription
automatically grants image API access, or assume tools and inference are free.

`assets/creator-skill/playpets-creator/SKILL.md` is the source instruction file.
The maintained `assets/creator-skill/playpets-creator/scripts/creator-workflow.py`
is included at `scripts/creator-workflow.py` inside each downloaded skill and
needs Python 3 and Pillow; it does not install
dependencies automatically. `scripts/creator-skill.mjs` copies the maintained
skill and its references into `website/public/creator-kit/skill/` during site
preparation. Never edit those generated public copies by hand. The downloadable
KIT includes the skill files so the AI agent can finish without returning to the
website.

The maintained skill folder is independently installable and includes its MIT
license. Keep it in this repository so the app formats and validator change
together. `npm run creator:skill` also emits `playpets-creator-plugin.zip`, with a
root `plugin.json`, a Claude Code `.claude-plugin/plugin.json` compatibility manifest,
and `skills/playpets-creator/`, using the application version. Both manifests refer
to the same skill files; no second skill source is maintained.
The portable skill ZIP remains available for agents that use the
[Agent Skills format](https://agentskills.io/specification). The plugin follows
the [portable plugin package](https://developers.openai.com/plugins/build/plugins)
layout and declares local execution because its helper runs Python.

For local Codex use, copy the reviewed skill folder into `.agents/skills/` in a
project or `~/.agents/skills/` for personal discovery, then invoke
`$playpets-creator`. The built-in `$skill-installer` can also install this folder
from `https://github.com/gaerae/playpets/tree/<published-ref>/assets/creator-skill/playpets-creator`;
replace the placeholder with a published tag or commit that includes the helper.
Some installed versions use `$CODEX_HOME/skills` instead; let the installed
installer choose its supported destination. See [Codex skill discovery](https://learn.chatgpt.com/docs/build-skills).
Claude Code uses `.claude/skills/` or `~/.claude/skills/`, invoked as
`/playpets-creator`; see [Claude Code skills](https://code.claude.com/docs/en/skills).
Copy the entire folder, including the helper and references.

An installable package is separate from a published directory listing. Test a
plugin through a local marketplace and fresh conversation before requesting
public distribution. OpenAI's [submission process](https://developers.openai.com/plugins/deploy/submission)
requires access, identity verification, scans and review before publication.
Do not describe an unsubmitted package as approved or listed. No installation,
account change or publication occurs when the website builds these archives.

For pets, the skill guides eleven approved 1536 × 1024 source batches, each a
4 × 2 grid. The supplied Python script assembles the 1536 × 2288 RGBA v2 atlas:
nine animation states and sixteen gaze directions. Keep the format aligned with
[Pet file format](../standards/pet-files.md). Automated checks cannot judge anatomy,
character identity, action meaning or smooth animation; the skill includes image
review before final packaging. Daisy, Clover, Pip and Miso remain downloadable as
ready-to-import files through the shared component; the complete creation kit includes the detailed reference pictures.

For backgrounds, the skill prepares 1536 × 1024 artwork and the supported layout
and atmosphere settings, including floor, water, fishing stance, window masks and
optional seasonal images. Its final JSON follows
[Portable backgrounds](add-a-world.md#portable-backgrounds). Geometry validation
does not detect furniture or other obstacles painted on the floor. Review both
large and small window crops, then check movement, weather and fishing in the app.

Check both routes on direct entry, at phone widths, with keyboard navigation,
in dark mode and with reduced motion. Inspect the downloaded KIT contents and
run the skill's Python checks against fixtures. Preserve reference provenance
and keep every request field and instruction consistent across the four site
languages. Test the production build in a freshly loaded preview after rebuilding;
an existing tab may retain an older component or stylesheet.

The [in-app studio proposal](../design/2026-10-17-in-app-studio.md) records an
unimplemented direction; its follow-up explains the current KIT and SKILL handoff.


### Install with the skills CLI

Use the [Vercel skills CLI](https://github.com/vercel-labs/skills) instead of
publishing another npm installer. Its version is pinned in the site's copyable
commands. Node.js/npm are needed only for installation; image generation and
Python/Pillow remain separate requirements. Run this from the destination project:

```bash
npx --yes skills@1.7.2 add "/absolute/path/to/playpets/assets/creator-skill/playpets-creator" --skill playpets-creator --agent codex claude-code --copy
```

This copies the whole skill into the project discovery directories used by Codex
and Claude Code. It does not change personal skill directories. Remove one agent
from the command when installing for only that tool. To install without a checkout
after the source has been published, replace the local path with
`gaerae/playpets`. The pinned CLI discovers the named skill from the repository
root; the isolated installation test exercises that complete-root discovery.
Quote a local folder path, especially when it contains spaces.
For reproducible public installs, use the full GitHub source URL with a reviewed
published tag or commit. Do not present a local-only source as already downloadable from GitHub.

Exercise the actual pinned CLI without writing to personal configuration:

```bash
PLAYPETS_TEST_SKILLS_INSTALL=1 node --test tests/creator-distribution.test.mjs
```

The opt-in test uses an isolated temporary project, HOME and npm cache, disables
CLI telemetry, compares installed files in both host directories, and executes
the installed helper. It requires network access to npm and a Python environment
with Pillow; set `PLAYPETS_PYTHON` if it is not the default Python. Normal unit tests
do not download or install the CLI. Host discovery in a new Codex or Claude Code
conversation and official directory approval remain separate checks.

For [local Claude Code plugin testing](https://code.claude.com/docs/en/plugins),
unzip `playpets-creator-plugin.zip` into a reviewed folder and run
`claude --plugin-dir /absolute/path/to/unzipped-plugin`. Its skill is namespaced
as `/playpets-creator:playpets-creator`. This is a local plugin command, not a
claim that the package is listed in Anthropic's official marketplace. The portable
manifest follows the current OpenAI package format; test its local marketplace
installation in a fresh supported host before submitting it for directory review.
