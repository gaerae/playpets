# [Research] How do open-source desktop apps lay out their public websites?

## Question
Before building the PlayPets site (landing page, user guide, release pages, developer docs), we checked on real pages how well-known open-source desktop apps and desktop pet projects handle the order of the landing page, download buttons, use of screenshots, changelog structure, docs layout, multiple languages, and trust signals. The research date is 2026-10-03, and every observation comes from reading the pages directly on that day.

## Findings
### Sites read
| Group | Sites |
|---|---|
| Large open-source desktop apps | [Zed](https://zed.dev), [Obsidian](https://obsidian.md), [Warp](https://www.warp.dev), [Bruno](https://www.usebruno.com), [Cap](https://cap.so), [Beekeeper Studio](https://www.beekeeperstudio.io), [Spacedrive](https://www.spacedrive.com) |
| Solo-maker macOS utilities | [Maccy](https://maccy.app), [Rectangle](https://rectangleapp.com), [Ice](https://icemenubar.app), [AltTab](https://alt-tab.app), [Loop](https://github.com/MrKai77/Loop), [Stats](https://github.com/exelban/stats) |
| Changelogs | [Zed releases](https://zed.dev/releases/stable), [Raycast changelog](https://www.raycast.com/changelog), [Linear changelog](https://linear.app/changelog), [Obsidian changelog](https://obsidian.md/changelog), [Cap changelog](https://cap.so/changelog), [Warp changelog](https://docs.warp.dev/getting-started/changelog) |
| VitePress docs sites | [Vite](https://vite.dev), [Vitest](https://vitest.dev), [Slidev](https://sli.dev), [UnoCSS](https://unocss.dev), [VitePress](https://vitepress.dev) |
| Desktop pets | [BongoCat](https://bongocat.pet), [BongoCat README](https://github.com/ayangweb/BongoCat), [OpenPets](https://openpets.dev), [Clawd on Desk](https://github.com/rullerzhou-afk/clawd-on-desk), [clawd-pet](https://zlaxrr.github.io/clawd-pet/), [CoPet](https://github.com/ChanceYu/CoPet), [WindowPet](https://github.com/SeakMengs/WindowPet), [deskpet](https://github.com/Scyyyy4/deskpet), [eSheep](https://adrianotiger.github.io/desktopPet/) |
| Tauri showcase | The official showcase was discontinued ([Discussion #7643](https://github.com/tauri-apps/tauri/discussions/7643)). Instead: [awesome-tauri](https://github.com/tauri-apps/awesome-tauri), [madewithtauri.com](https://madewithtauri.com) |

Could not read: the hoppscotch.io landing page (JavaScript only, so there is no body text), Arc release notes (403).

### Landing page and download button
| Site | First screen | Download |
|---|---|---|
| Zed | 4-word headline, buttons "Download now" and "Clone source" | No OS detection, "Available for macOS, Linux, and Windows" |
| Obsidian | 3-word headline | **"Get Obsidian for Windows" + a "More platforms" link** |
| Bruno | One "Download" button and "Explore docs" | One line under the button describes free and open-source availability, macOS, Windows and Linux support, and no account requirement |
| Cap | "Record. Edit. Share." | "Download free for macOS" + an "Also available on" row of icons |
| Maccy, Rectangle | Product name as the headline, one sentence | Direct file link, minimum macOS version shown |
| AltTab | Two sentences | "Download Free for Mac", a block of numbers (downloads, stars) |
| Spacedrive | "Take back your data." | No download button on the first screen, only the blog and GitHub |

What they share: the clearest sites show what you get within 2 seconds on the first screen, and put one line of trust (free, open source, runs locally) right under the button. Dozens of testimonials, pricing tables, and 10 FAQs are not used by solo open-source projects (even Zed has 5 testimonials).

### Screenshots and motion
- Ice, Rectangle: one screenshot per feature.
- Loop, Clawd on Desk: the first screen is a short looping video or GIF.
- Clawd on Desk: **24 GIFs, one per state, in a 3-column grid**. For a pet app, this shows what it does at a glance.
- A pet app page with no pictures at all leaves the visitor guessing what the pet looks like and does.

### Changelogs and release pages
| Site | Structure | Worth noting |
|---|---|---|
| Zed | List + **a separate page per version** | One-paragraph summary, Features/Bug Fixes/Breaking Changes, PR links and "thanks @user", **download buttons per OS and architecture on the version page** |
| Raycast | Long page, platform tabs | **One image** per entry, "✨ New / 💎 Improvements / 🐞 Fixes" |
| Linear | A unique address per entry | Date, title, hero image or video |
| Obsidian | Pagination | Labels "New / Improvements / No longer broken / Developers", RSS |
| Cap | Long page, platform tabs | Headline sentence + collapsible notes |

Zed is the only one with download buttons on each version page, and Raycast and Linear are the only ones with a screenshot for every entry.

### Docs layout
- Zed: user docs and "Developing Zed" on one site, with the developer section at the bottom of the sidebar. Welcome (Getting Started, Installation, Update, Uninstall, Troubleshooting) → features → Platform Support (macOS/Windows/Linux) → Reference.
- Obsidian: user help and developer docs are separate sites.
- Vite, Vitest, Slidev: language and version switchers at the top right. "On this page", "Suggest changes", and previous/next on every page.
- Bruno, Zed, Slidev, Pake: provide `llms.txt`.

### Multiple languages
- Obsidian: 13 languages in a header dropdown. AltTab: 22 languages, `/de/` `/ko/` paths. BongoCat: Chinese by default, a footer switcher with 10 languages (including Korean). Clawd on Desk: README in 4 languages (including Korean).
- Solo projects run multilingual sites too. A switcher at the top right is easy to find; one in the footer is hard to find.

### Trust signals
- Bruno "Your data never leaves your machine", Beekeeper "By default we don't even know when you install the app", Maccy "Everything is stored on your computer", AltTab "No tracking, no telemetry", Spacedrive "no cloud, no account, no subscription, no telemetry".
- Star count badges: Cap (22k) and Spacedrive (37k) show them in the menu. When the number is small, just the icon.
- Maccy: a banner warning about fake sites. Stats: "Open source, but not open contribution", stating what to expect from a solo maintainer.

### Patterns PlayPets avoids
These are patterns that would work against a small desktop app like PlayPets. They are general patterns, not a verdict on any site; several of the sites above make these choices on purpose for their own audience.

| Pattern | Why PlayPets avoids it |
|---|---|
| The stock VitePress home layout as is (big logo on the right, 2 buttons, 4-card feature grid) | It reads as a docs site rather than an app |
| A product home page without a download button | Visitors who want the app have to hunt for it |
| An empty download button, no version shown, a stale copyright year | It looks unmaintained even when it is not |
| A landing page that renders only with JavaScript | Crawlers and link previews get no content |
| Many sections, a pricing table and a long FAQ | It reads as a commercial service rather than a free app |
| Enterprise jargon on a tool for individuals | The visitor cannot tell what the app does |
| A changelog with no screenshots and no download links | Visitors cannot see the change or get the version they read about |

### Limits of this research
- It was read over one day, and sites change. It reflects 2026-10-03.
- Visitor response (conversion rates and so on) is unknown. Only structure and appearance were looked at.
- Among pets that react to coding agents, the projects read (Clawd on Desk, CoPet, buddy-desktop, nchiyi/desktop-pet) were documented in their READMEs and had no separate site.

## Conclusion and recommendations
**This is how the PlayPets site is laid out.** This research is the basis for the decision "[Publish the introduction, user guide, per-version pages and developer docs as one VitePress site on GitHub Pages](../decisions/2026-10-03-website-on-github-pages.md)".

1. First screen: a 3–5 word headline, one sentence, **an OS-detecting download button + links for other platforms** (Obsidian, Cap), one trust line under the button (Bruno), and instead of text, **moving pets** (Loop, Clawd on Desk). Instead of video, PlayPets animates the real sprite sheets with CSS to stay light.
2. Second screen: **a grid of gestures per state** (Clawd on Desk). For a pet app, this is the product description.
3. Only 3 features, each with one real screenshot (Ice, Rectangle). Connecting is 3 steps plus **a table of agent → settings file → what gets passed along** (CoPet).
4. Release pages: **a separate page per version + a summary paragraph + download buttons per OS** (Zed), plus **at least one screenshot** (Raycast, Linear). The list page shows the version, date, and headline sentence (Cap).
5. User guide and developer docs on one site, split by top tabs (Zed). The installation page has a section per OS on getting past the first-launch warning. Language switcher at the top right (Vite).
6. Leave out: a wall of testimonials, pricing tables, a long FAQ, logo carousels, the stock VitePress home layout.
7. At launch, register with [awesome-tauri](https://github.com/tauri-apps/awesome-tauri) and [madewithtauri.com](https://madewithtauri.com).
