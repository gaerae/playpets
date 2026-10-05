# Launch video: one 25-second video covers every channel

## Why video
In 2026, X, Threads, Reddit, and LinkedIn show video ahead of GIFs and keep people on it longer. GIFs are used only where video cannot go, such as the README and Hacker News comments. So **the source is one video**, cut down for each channel. The message is the one sentence from the "[PlayPets launch and promotion plan](2026-10-04-launch-plan.md)": a yard where pets talk to each other.

## What to shoot (25 seconds, no sound, captions as on-screen text)
| Segment | Scene | Difference it shows |
|---|---|---|
| 0–5 s | Two friends talk to each other in speech bubbles in the yard (Let them chat) | Pets actually talking to each other |
| 5–11 s | Click a friend and ask one line in the chat window. "Claude Code · 이 컴퓨터에 설치됨" ("Claude Code · Installed on this computer") shows at the top | It talks through a subscription CLI, no key |
| 11–17 s | Claude Code works in the terminal, and the dot next to the reporting friend's head blinks orange. When it finishes, green. Ask the friend "What were you doing?" and get an answer | Agent reactions + hearing about them in words |
| 17–23 s | Turn on desktop mode and the friends walk out over a full-screen app (macOS) | Both the yard and the desktop |
| 23–25 s | End card: logo, "서로 이야기하는 펫들의 놀이터" ("A yard where your pets talk to each other"), site address | – |

Rules: one thing per scene. Move the cursor slowly, and wait until the speech bubbles can be read in full. Use the three built-in pets (Tabby·Smoky·Mochi), so there are no license worries. Each video sticks to one language; make two, Korean and English (switch the app language and reshoot, rather than using subtitles).

## How to make it
- **Shooting**: on macOS, launch the app with the same staging that `npm run shots` uses (`PLAYPETS_DATA` isolated folder, `PLAYPETS_LANG`), and record the screen at 1920×1080 30fps with OBS or `screencapture -v`. Answers come from real Claude Code (no fake server: that the conversation is real is the core message). Fix the weather to snow in the settings so the scenes come out the same every time.
- **Editing**: cuts only, no effects. Make the end card with the same design as the site's OG image (`scripts/make-og.mjs`).
- **Export**:
  | Use | Format | Size |
  |---|---|---|
  | Posts on X, Threads, LinkedIn, Reddit | MP4 (H.264, 1080p, 30fps, no audio) | 25 seconds, 20MB or less |
  | First screen of the site's landing page | WebM + MP4 (720p), `autoplay muted loop playsinline`, `poster` is the first frame | 3MB or less |
  | README, Hacker News first comment, awesome list PRs | The 0–5 s segment as a GIF (720px wide, 12fps) | 3MB or less |
  | YouTube (optional) | 60–90 seconds from the same material, including the actual setup steps | – |
- **File location**: put them in `website/public/media/` and the site serves them. The GitHub README points to a release asset address or the site address.

## Landing page and stores
- **Landing page**: put `website/public/media/intro-ko.mp4` (+ `.webm`, first frame `.jpg`) and `intro-en.*` in place, and `npm run site:build` checks for the files and puts the video, autoplaying (muted, looping), in the scene slot of the first screen. Languages without a file keep showing the current animated scene, and with the reduced-motion setting (prefers-reduced-motion) the video is taken down and the scene is shown.
- **Store screenshots**: along with the site screenshots, `npm run shots` crops five scenes (Let them chat, chat, hide and seek, agent settings, desktop) to 16:9 and puts them as 1920×1080 PNGs in `release/store/<language>/`. These are the sizes used by the Microsoft Store (minimum 1366×768, up to 10), the Product Hunt gallery (1270×760 recommended, 16:9 gets cropped), and the GitHub social card (1280×640, replaced by the OG image from `npm run og`). winget and Homebrew need no pictures.

## When it is done
- Both videos (ko, en) fit the five scenes above into 25 seconds, and what is different reads even with the sound off.
- The landing page's first screen plays the video, and `npm run site:build` and the screenshot tests pass.
- The README's first screen has a GIF of 3MB or less.

## What we do not do
- No shooting with fake answers. No music or narration (silent playback is the default on every channel).
- "Codex Pets" does not appear in titles, captions, or file names (trademark). "Compatible with the Codex pet format" is used only as a description.
