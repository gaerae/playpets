# Yard sounds (2026-10-10)

## Why

People keep PlayPets open in a corner of the screen for hours. A sound that fits what they see makes the yard feel like a real place even while they are looking at something else. Ambient-sound apps and the games people leave running (Animal Crossing's island at night, Rusty's Retirement) show this. Sound also helps with timing: when a fish bites, you can hear it without watching the lake.

Sound also bothers people more than anything on screen. So it plays quietly, only while the yard can be seen, and it is easy to turn off from three places.

## What it is

| Layer | When | How it is made |
|---|---|---|
| Breeze | always; softer at night, muffled in snow | brown noise through a low-pass filter whose cutoff and loudness drift slowly (oscillators in the audio graph, so no timer drives them) |
| Leaves | in gusts every 6 to 18 s, when there are leaves (not in winter or snow) | pink noise in a band around 1.7 kHz, almost silent between gusts |
| Lake | small waves every 2 to 4 s | brown noise below 300 Hz that swells and opens up for each wave |
| Rain | while it rains | pink noise between 0.5 and 4.5 kHz, with single drops landing on leaves |
| Birds | by day: most in the morning, a few at dusk, fewer in winter, none in rain or snow or at night | four songs from gliding tones: a two-note call, a trill, a warble, and a dove's coo in the morning; each call at its own place left to right and its own distance |
| Crickets | on summer and autumn nights, a few at dusk | two crickets, each with its own pitch and rhythm, chirping in three short pulses |
| Cues | when a friend is patted, eats a treat, waters, finds a seed, brings a gift, catches something, reaches a new friendship level, or something new goes into the album | kalimba-like notes on a major pentatonic scale above C6, so any two cues sound right together; the float dipping is a drop into water, and a fish landed is a splash |

Calls and cues go through a short reverb that sounds like open air, while the beds stay dry. A limiter makes sure a burst of tones can never clip.

Everything is generated with Web Audio (`src/yard/soundscape.js`), so nothing is downloaded or licensed and nothing is added to the app's size. The rules for which scene sounds like what are a pure function (`src/yard/soundmix.js`, tested). When things play and the controls are in `src/yard/sound.js`.

## Rules

| Rule | Value | Why |
|---|---|---|
| Default | on, at volume 40 | the user asked for sound that can be turned off; at 40 the yard is a background (about −31 dBFS RMS, peaks under −15 dBFS) |
| Off | the chip by the clock, Settings → The yard (with a volume slider), and the View menu (⌘⇧S; Ctrl+Shift+S elsewhere, answered by the page) | wherever the person is when it is too much |
| When it plays | only while the setting is on and the yard can be seen (not hidden, not minimised, not behind desktop mode's hidden window); mini view keeps it | sound from an app you cannot see is a surprise |
| First sound | after the first click or key press in the window | the webview allows audio only after the person has touched the page; it also means sound never starts by itself at login |
| Saved | `state.json` key `sound` (`on`, `volume` 0–100); the backend clamps the volume | one setting for the page and the menu bar |
| Changes | a scene change glides each layer to its new level over a few seconds; turning the sound on fades it in, turning it off fades it out quickly | no jumps |

## Performance

While the sound rests (off, or the yard unseen), the audio context is suspended and its timers are cleared, so it costs nothing. While it plays, the loops and filters run on the audio thread. The page wakes only for the scheduled events (a gust, a wave, a bird, a batch of crickets two seconds ahead, raindrops a few times a second while it rains). Measured with `npm run measure` (2026-10-10, Apple M2 Pro): the yard alone is 6.1% of one core, and the yard with its sounds playing is 8.6%. Most of that is WebKit's audio output itself; a shorter reverb made no difference.

## Checks

- `tests/soundmix.test.mjs`: which layers play in which scene, and the cue scale.
- e2e: the yard sounds start on at 40, the chip turns them off and on, and the backend holds the volume to 0–100. The run turns sound off first, so it stays quiet.
- Offline renders (an `OfflineAudioContext` in a headless browser) were used to set the layer levels: birds stand out from the beds, rain is not a hiss, nothing clips.
