# PlayPets launch and promotion plan

## Why
PlayPets is explained in one sentence, "Codex pets outside Codex, several at once, with any AI or agent", but nobody knows about it yet. There are already official Codex pets and several open-source desktop pets, so if the first impression does not get the difference across, it passes as "just another pet app". The site and README have been rewritten around that sentence (decision "[Publish the introduction, user guide, per-version pages and developer docs as one VitePress site on GitHub Pages](../decisions/2026-10-03-website-on-github-pages.md)"). This plan sets who we tell that sentence to, where, in what words, and what counts as success. The examples come from "[How do open-source desktop apps lay out their public websites?](../reference/oss-desktop-app-websites.md)".

## What counts as success
Measure the following for 30 days after launch. The numbers come from the GitHub repository Insights, release file download counts, and where visitors come from on the site (GitHub Pages has no analytics, so the reaction count of each post).

| Metric | Target | Where to measure |
|---|---|---|
| GitHub stars | 300 or more | Repository |
| Release file downloads | 1,000 or more (all three OSes combined) | File counts on the release page |
| Links from pet galleries | 2 or more sites point to PlayPets as "an app that uses this pet" | Each site |
| Listings in external lists | 2 or more of awesome-tauri, awesome-claude-code, madewithtauri | Merged PRs in each repository |
| Issues | In the first week after launch, "it won't run" type issues are less than half of all issues | Issue labels |

## Audiences and messages
The sentence is the same; what goes first changes by audience. The audiences are the five groups picked in "[Where does PlayPets fit among open-source desktop pets and pixel-office agent dashboards?](../reference/competitors.md)".

| Audience | What they live with now | What to lead with |
|---|---|---|
| Petdex users | They have collected many pets, but desktop apps show one pet with no conversation | "Put all the pets you collected out at once, and let them talk to each other" |
| Clawd on Desk users | The largest group. One character, no conversation | "More friends next to Clawd. Each friend talks with its own AI" |
| Windows and Linux users among openpets.sh users | The app is macOS-only and has been stalled since May 2026 | "The same pets, three OSes, still being fixed" |
| Pixel Agents users | It only shows inside VS Code and Claude Code | "It keeps going on the desktop after you close the editor. Codex, Gemini, Cursor too" |
| People who have tried Korean pet projects | Single OS, few stars, so its upkeep feels uncertain | "한국어로 먼저 만든, 세 OS가 되는 오픈소스 데스크톱 펫" ("An open-source desktop pet made in Korean first, running on three OSes") |

## Video
Every channel uses the same 25-second video. The scenes and formats are in "[Launch video: one 25-second video covers every channel](2026-10-06-launch-video.md)". GIFs are used only in the README and Hacker News comments.

## Copy by channel
Use the sentences in this table as they are. The numbers were measured in September 2026 (openpets.sh 5,836, Petdex 4,871, Codex PokéPets 1,738, Awesome Codex Pet 260) and are recounted when posting. "Compatible with the Codex pet format" is used only as a description; "Codex Pets" never goes into a name, domain, or badge.

| Channel | Title or first line | Body essentials |
|---|---|---|
| GitHub repository description | A yard where your pets talk to each other. Codex-format pets, each friend with its own AI (Claude Code · Codex · Ollama), friends talking among themselves, any coding agent in company. Tauri, MIT. | Topics: desktop-pet, codex, claude-code, tauri, ollama, mcp |
| Show HN | Show HN: PlayPets – Desktop pets that talk to each other, each with its own AI, reacting to any coding agent | First comment: there are many pet apps, but all of them were status indicators; we added conversation and a yard; subscription CLIs mean no extra fees; local only; light (Tauri); what is still missing (code signing) |
| GeekNews | PlayPets – 펫들이 서로 이야기하는 놀이터. Codex 펫 1만 마리 그대로, 친구마다 다른 AI, 어떤 코딩 에이전트와도 (오픈소스) ("PlayPets – a yard where pets talk to each other. Ten thousand Codex pets as they are, a different AI for each friend, with any coding agent (open source)") | Three lines: Claude Code·Codex·Ollama per friend / friends keep talking among themselves / yard and desktop, local only |
| Product Hunt | PlayPets — A yard where your pets talk to each other | The maker comment has the same structure as the HN first comment. Gallery images are 8 site screenshots |
| X, Threads (Korean) | 코딩 에이전트 펫 앱은 많은데 전부 한 마리가 상태만 보여 줬어요. PlayPets는 펫들이 서로 이야기해요. 친구마다 다른 AI, 날씨 있는 놀이터, Codex 펫 1만 마리 그대로. 오픈소스, 가벼워요. ("There are many coding-agent pet apps, but they all showed one pet and its status. In PlayPets the pets talk to each other. A different AI for each friend, a yard with weather, ten thousand Codex pets as they are. Open source and light.") | One GIF of the pets talking to each other, site link |
| X (English) | Every coding-agent pet app shows one pet and a status. PlayPets is a yard where the pets talk to each other, each with its own AI (Claude Code, Codex, Ollama), with the ten thousand Codex pets as they are. Open source, light. | The same GIF |
| Reddit r/ClaudeAI | I made desktop pets that talk to each other and report on my Claude Code sessions – open source, any agent | The screen showing which friend reports for an agent, with emphasis on local only |
| Reddit r/LocalLLaMA | Desktop pets that chat through Ollama and talk to each other, no cloud: PlayPets (open source) | The Ollama connection screen |
| Disquiet, 커리어리 (Careerly) | 한국어로 만든 오픈소스 데스크톱 펫, PlayPets ("PlayPets, an open-source desktop pet made in Korean") | Why it was made, and the Korean docs |

## What we make
- Share cards and banner: `npm run og` draws `website/public/og.png` (Korean), `og-en.png`, `og-zh-hans.png`, and `assets/banner.png`. The site head has Open Graph and Twitter card tags.
- One animated first-screen GIF: `npm run shots` records a few seconds of the yard in the real app and turns it into `assets/demo.gif`. Used in the README and on X.
- 3 PRs to external lists: submissions to awesome-tauri, awesome-claude-code, and madewithtauri.
- Requests to pet galleries: an email or issue to the operators of OpenPets Registry, Petdex, Codex PokéPets, and Awesome Codex Pet, asking for a one-line note "these pets also work in PlayPets" and a link. Use the text below.
- One-step import from galleries: a `playpets://import?url=<pet address>` deep link, so galleries can add an "Open in PlayPets" button. This is the biggest growth path, so it goes into 0.2.0 (as a separate issue).
- Launch-day batch of posts: post all the copy by channel above in one day. HN between Tuesday and Thursday at 9 a.m. US West Coast time; the Korean posts on the morning of the same day.

Text for gallery operators (English):
> Hi, I'm the author of PlayPets, an open-source desktop app (Tauri, MIT) that runs Codex-format pets outside Codex: several at once, each with its own AI, reacting to any coding agent. Your pets import as they are from their page URL. Would you consider a one-line note or an "Open in PlayPets" link on pet pages? Happy to credit your site in the app's import tab, where it already appears.

## What we do not make
- Paid ads, influencer sponsorships, waitlist pages.
- Mobile app, web version.
- Visitor analytics tools (no external scripts on the site). Reactions are read from each post and the repository numbers.
- Sentences that put down the official Codex pets or other pet apps. Comparison tables state only facts.
- A Product Hunt launch before signing. While the first launch is blocked, the reactions fill up with installation problems.

## Checkpoints
- The repository is public, and the 0.1.0 release is published with files for all five targets built by the `release` workflow.
- The download button on the site's landing page leads to the 0.1.0 file for the visitor's OS.
- None of the 7 screenshots has a permission dialog, and all three pets show in all three languages.
- `og.png` shows up in link previews (X, Slack, GeekNews).
- Signing and notarization are on for macOS, with no first-launch warning. Product Hunt only comes after this checkpoint.
- 2 galleries have added the note or a link.

## Blockers
- There is no GitHub repository yet. CI, releases, and Pages start only after the repository is created and pushed.
- The screenshots show the macOS screen recording permission dialog. Allow it once, then run `npm run shots -- 0.1.0` again.
- There is no code signing. Joining the Apple Developer Program is a precondition for the Product Hunt launch ("[What do code signing and distribution channels cost for a desktop app, and in what order does PlayPets take them?](../reference/code-signing-and-distribution.md)").

## Phases
1. Before launch: make the repository public, release 0.1.0, retake the screenshots, record the GIF, submit the external list PRs.
2. Launch week: post to GeekNews, X, two Reddit communities, and Disquiet on the same day. HN goes up whether or not the app is signed (technical readers accept Gatekeeper instructions).
3. Two weeks after launch: contact gallery operators, answer issues, ship first-week bug fixes in 0.1.1.
4. After signing: Product Hunt, consider an official Homebrew cask, ask galleries for the button with 0.2.0, which includes the deep link.

## Completion check
- On day 30 after launch, record the five metrics from "What counts as success" above in a table in this document's change history. For each item below its target, write one line on why.
- Fill in the address of each channel's post in the table below.

| Channel | Posted on | Address | Reaction |
|---|---|---|---|
| GeekNews | Launch day | | |
| Show HN | Launch day | | |
| X (Korean) | Launch day | | |
| X (English) | Launch day | | |
| Reddit r/ClaudeAI | Launch day | | |
| Reddit r/LocalLLaMA | Launch day | | |
| Product Hunt | After signing | | |
