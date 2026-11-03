# Four-place environment provenance

- Accepted on 2026-10-13.
- The built-in image generation tool generated these PNGs for PlayPets.
- Visual direction: Tiny Glade's calm stylized architectural forms, readable materials,
  softly lit vegetation and restrained detail.
- No artwork from that game is included in these files.

- The descriptions below record the generation brief, not verbatim prompts.
- The accepted PNGs are the source artwork the app uses.
- There is no editable 3D scene and no promise of deterministic regeneration.
- No scripted repainting was used.

## Composition briefs

- **Hillside garden:** an open hillside with a distinct cottage, layered distant
  scenery and transparent sky. Keep the fishing water visible and leave a quiet,
  compact foreground for the pets.
- **Stone courtyard:** an intimate courtyard with its own house silhouette,
  planting around the edges and a small water feature. Reduce the broad empty
  paving from the earlier concepts while retaining a clear walking strip.
- **Lakeside:** a wider water view and a different cottage silhouette, with
  receding landscape and a compact near shore for the pets.
- **Village study:** a cozy interior in the same visual language, with furniture
  framing a village view through glass. Keep the foreground compact and clear;
  preserve the room's layout across all lighting variants.

- Outdoor places: the accepted summer image was the composition reference for spring,
  autumn and winter.
  - The variants change vegetation and ground; camera, house, shore and walking area stay.
  - Sky uses alpha, so the app supplies sun, clouds and time-of-day color.
  - Winter keeps water unfrozen where fishing remains available.
  - Live precipitation is not baked in.
- Study: the accepted daytime image was the reference for morning, evening and night.
  - The final variants keep its furniture and floor proportions and change outside light
    and interior illumination.
  - These images are opaque and carry their own lighting.
- Window masks, walking boundaries and fishing positions live in `src/content/worlds.json`;
  generated images are not treated as exact geometric specifications.

## Seasonal study views

- The accepted `studio-cozy-day.png` was also the reference for three full-canvas seasonal views.
- Their brief preserved the camera, furniture and window frames and changed only the exterior:

  | Season | Exterior |
  | --- | --- |
  | Spring | Blossom trees and fresh greens |
  | Autumn | Copper and gold foliage |
  | Winter | Snowy hills and roofs, bare trees, an unfrozen lake |

- The renderer uses only the portions within the registered glass panes and adds
  time-of-day lighting there.
- The room's authored time variant stays intact.
- Summer uses that variant's original window view.

## Accepted file hashes

- SHA-256 values identify the accepted bytes below.
- A later lossless optimization can change file hashes without changing pixels.
- When accepting its exports, keep that operation's report and update this table.

| Runtime file | SHA-256 |
| --- | --- |
| `spring.png` | `02b4e0f20e976eb08943bfc3eb0a12e56bedf36b52cead843e23a023aea88d00` |
| `green.png` | `a25126d1ea97d9a5ea609e6aab0101ea793a5c590c89fb4f45d12262d17ed9ae` |
| `autumn.png` | `bf30e804bae07bf5856362eed41ba6804647f45d9fc27292cd717b1236c84a65` |
| `winter.png` | `0eadb70af979392d06712b0f3ca80925772a991570dd34197089bfa695b39791` |
| `courtyard-spring.png` | `5575ccf3cb791f2f678cc419ae658ba60c7dc7369af1244efe8356a64b7e68a2` |
| `courtyard-green.png` | `67cb885fd3441b705af9814bb2bd66fe4c5660b91594032ecd4d8364b543dcfe` |
| `courtyard-autumn.png` | `4888715e964e5ebbc431532cd2e7ecfd5cc1d18992945a692c2adb796fcfc13e` |
| `courtyard-winter.png` | `de4bc2ef5c75c27831d9094d1700ea30eeb1165175017b0fbfe82c887494983e` |
| `lakeside-spring.png` | `88b76a037c2486e372793c033124372222eaf5f2d39b5774b1db920cf76d5cab` |
| `lakeside-green.png` | `23e7bcea78d65fb2dff62f3cab34c52bf19ba28f77f043dba71c5b774c8f95bf` |
| `lakeside-autumn.png` | `e8210b11996738ad979b9b8f8a03204b08030aee50f34563e27143e4791f3b47` |
| `lakeside-winter.png` | `b88936a78335554b9b210d6db8a467b683db0e0714c618430d5840231f0b4369` |
| `studio-cozy-morning.png` | `54fc52617d67a905514849258d9d2cec0ade457f66072e680796f55121326bb2` |
| `studio-cozy-day.png` | `9f356f9c71c03f3adc0d43a2aab8f6c8a794a0d649ae174def702878e78e01d3` |
| `studio-cozy-evening.png` | `8621ed8769fe4d82a3c37e5890f646774596bacd023824221a88a807ec6379df` |
| `studio-cozy-night.png` | `c232be34c3897f0ebd32826d4679a0f7356555419062bbf301f1bf1c5927e38b` |
| `studio-view-spring.png` | `6d24844f4a244483fadba9069c8efcb802e68c2d27b04244d892a28590eb21b0` |
| `studio-view-autumn.png` | `5fa2446b97a1098583772b552fdd3b26b4dc8131b0e486570f576c03973aa0e1` |
| `studio-view-winter.png` | `7ba27c05122aea982bfe0c08730244360ddefea576ccc1c26cc5958469cc1a18` |
