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
| Desktop pets | [BongoCat](https://bongocat.pet), [BongoCat README](https://github.com/ayangweb/BongoCat), [OpenPets](https://openpets.dev), [Clawd on Desk](https://github.com/xingfanxia/clawd-on-desk), [clawd-pet](https://zlaxrr.github.io/clawd-pet/), [CoPet](https://github.com/ChanceYu/CoPet), [WindowPet](https://github.com/SeakMengs/WindowPet), [deskpet](https://github.com/Scyyyy4/deskpet), [eSheep](https://adrianotiger.github.io/desktopPet/) |
| Tauri showcase | The official showcase was discontinued ([Discussion #7643](https://github.com/tauri-apps/tauri/discussions/7643)). Instead: [awesome-tauri](https://github.com/tauri-apps/awesome-tauri), [madewithtauri.com](https://madewithtauri.com) |

Could not read: the hoppscotch.io landing page (JavaScript only, so there is no body text), Arc release notes (403).

### Landing page and download button
| Site | First screen | Download |
|---|---|---|
| Zed | 4-word headline, buttons "Download now" and "Clone source" | No OS detection, "Available for macOS, Linux, and Windows" |
| Obsidian | 3-word headline | **"Get Obsidian for Windows" + a "More platforms" link** |
| Bruno | One "Download" button and "Explore docs" | One line under the button: "Free and open source · macOS, Windows & Linux · No account needed" |
| Cap | "Record. Edit. Share." | "Download free for macOS" + an "Also available on" row of icons |
| Maccy, Rectangle | Product name as the headline, one sentence | Direct file link, minimum macOS version shown |
| AltTab | Two sentences | "Download Free for Mac", a block of numbers (downloads, stars) |
| Spacedrive | "Take back your data." | No download button, only the blog and GitHub — it reads as a blog, not a product |

What they share: successful sites show what you get within 2 seconds on the first screen, and put one line of trust (free, open source, runs locally) right under the button. Dozens of testimonials, pricing tables, and 10 FAQs are not used by solo open-source projects (even Zed has 5 testimonials).

### Screenshots and motion
- Ice, Rectangle: one screenshot per feature.
- Loop, Clawd on Desk: the first screen is a short looping video or GIF.
- Clawd on Desk: **24 GIFs, one per state, in a 3-column grid** — the only format where the value of a pet app is visible at a glance.
- OpenPet (dengyie): a pet app without a single picture — an example of what not to do.

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

### What looks bad (anti-patterns)
| Anti-pattern | Where |
|---|---|
| The stock VitePress layout as is (big logo on the right, 2 buttons, 4-card feature grid) | vitepress.dev home — it reads as a docs site, not a product |
| A product home page without a download button | Spacedrive |
| Empty download button, no version shown, stale copyright year | Ice |
| A JavaScript-only landing page | Hoppscotch — crawlers and link previews get no content |
| 20 sections, pricing table, 9 FAQs | Cap — gives a commercial SaaS impression |
| A developer tool covered in enterprise jargon | Warp "Open infrastructure for cloud software factories" |
| No screenshots and no download links in the changelog | Obsidian, Cap |

### Limits of this research
- It was read over one day, and sites change. It reflects 2026-10-03.
- Visitor response (conversion rates and so on) is unknown. Only structure and appearance were looked at.
- In our direct competitive space (pets that react to coding agents), Clawd on Desk, CoPet, buddy-desktop, and nchiyi/desktop-pet all had only a README and no site.

## Conclusion and recommendations
**This is how the PlayPets site is laid out.** This research is the basis for the decision "[Publish the introduction, user guide, per-version pages and developer docs as one VitePress site on GitHub Pages](../decisions/2026-10-03-website-on-github-pages.md)".

1. First screen: a 3–5 word headline, one sentence, **an OS-detecting download button + links for other platforms** (Obsidian, Cap), one trust line under the button (Bruno), and instead of text, **moving pets** (Loop, Clawd on Desk). Instead of video, PlayPets animates the real sprite sheets with CSS to stay light.
2. Second screen: **a grid of gestures per state** (Clawd on Desk). For a pet app, this is the product description.
3. Only 3 features, each with one real screenshot (Ice, Rectangle). Connecting is 3 steps plus **a table of agent → settings file → what gets passed along** (CoPet).
4. Release pages: **a separate page per version + a summary paragraph + download buttons per OS** (Zed), plus **at least one screenshot** (Raycast, Linear). The list page shows the version, date, and headline sentence (Cap).
5. User guide and developer docs on one site, split by top tabs (Zed). The installation page has a section per OS on getting past the first-launch warning. Language switcher at the top right (Vite).
6. Leave out: a wall of testimonials, pricing tables, a long FAQ, logo carousels, the stock VitePress home layout.
7. At launch, register with [awesome-tauri](https://github.com/tauri-apps/awesome-tauri) and [madewithtauri.com](https://madewithtauri.com).
