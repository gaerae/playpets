# Review the yard's visual states

1. With Chrome installed, run the isolated fixtures:

```sh
node scripts/visual-audit.mjs /tmp/playpets-visual-review
```

2. Open `index.html` in the output folder.

- The script serves repository files on an ephemeral loopback port.
- It loads the real content, scenery, sprite, view and game modules, and substitutes the native bridge with an isolated fixture.
- It does not read or change the app's saved yard.

The gallery covers these fixture groups; its generated index reports the exact capture count:

- 48 season, time and weather combinations;
- five seasonal events;
- four collection books with discovered specimens in both system appearances;
- 24 studio combinations (four times of day, three weathers, light and dark appearance), plus two studio small window sizes, a wide strip and a portrait window;
- four window sizes, including the narrow window and a wide strip;
- game instructions, wrong guesses, discovery, tag transfer, formation, active laps and completion;
- reduced-motion game states, a pet reaction and evening rain.

What the captures prove:
- Game fixtures assert the expected phase before capturing it.
- Fixed-step travel makes the fixtures repeatable; temporary poses are drawn against their real clock.
- Screenshots show how those states compose, not frame-by-frame animation smoothness.
- Native end-to-end checks cover the app bridge and real interactions separately.

Sound:
- `sound-report.json` contains 48 offline renders at maximum volume with overlapping cues, birds, water and cricket sounds.
- Seeded noise keeps the stress scenario repeatable.
- The script rejects non-finite samples and clipping.
- This checks signal integrity, not whether someone finds a sound pleasant.

What to review:
- Readability, clipped figures, coherent lighting, layered depth, visible progress and completion, and cleanup after replay.
- Changed art against the previous version, before keeping it.
- Ordinary interface icons can remain vectors; generated art is useful when material, shape or scenery detail needs it.

After changing behaviour:
1. Run its focused regression checks.
2. Run `npm test`, `npm run lint` and `npm run test:e2e`.
3. For docs or website changes, run `npm run site:build`.

- A successful fixture run does not replace first-use testing with people or validation on the other desktop platforms.
