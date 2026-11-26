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

## Follow-up: living room retired (2026-11-12)

- The Garden workshop replaced the living room. The `studio-cozy-*` and `studio-view-*` files above moved to `assets/sources/environments/` with the same pixels; `scripts/creator-skill.mjs` still copies `studio-cozy-day.png` from there as the interior example.

## 2026-11-13 follow-up

- The three outdoor places got a new set of pictures, generated with the Codex image tool from house-style references.
- The descriptions below are briefs, not verbatim prompts.

| Place | Brief |
| --- | --- |
| Hill garden (`woodland`) | The open version of the hillside with a sage-roof cottage |
| Wild garden (`courtyard`) | An open meadow, a pond with a little waterfall and a big oak, no buildings; it replaced the stone courtyard and keeps its id |
| Lakeside cottage (`lakeside`) | A calm autumn lakeside |

- The seasons were toned to one lawn and land tone (lightness L, chroma C, hue h):

  | Season | Lawn |
  | --- | --- |
  | Summer | L ≈ 67, C ≈ 62, h ≈ 114 |
  | Spring | Hue h ≈ 120 |
  | Autumn | L ≈ 64, C ≈ 50, h ≈ 100 |
  | Winter | Land lightness eased halfway to summer |

- The skies were keyed to transparency by flood fill; winter used tighter thresholds.
- The field's top follows the new pictures through a traced `geometry.edge` in `src/content/worlds.json`.
- The previous outdoor files and the retired studio and office sources in `assets/sources/environments/` were removed from the repository. `studio-cozy-day.png` stays as the creator kit's interior example.
- The hashes in the table above are superseded for the outdoor files. SHA-256 of the 12 runtime PNGs now:

| Runtime file | SHA-256 |
| --- | --- |
| `spring.png` | `55156c327af3670095240d546e0c6b9dfd8ab26fdbb84c2293fba6949cf78812` |
| `green.png` | `ab0c5032fbefb5e20e4d5c94e49e96b6ad5d3038f0788f1dcda686a8f2829bb4` |
| `autumn.png` | `e6ab0d7bb5dfb1681a131fc7546c474de6326cece4394833a5f116b38bff84c8` |
| `winter.png` | `6554740736788df13a9add666512ec047e7f3344f49d617a2889befef8ddf0bb` |
| `courtyard-spring.png` | `0f1b42229b0d6a681ce6dcf3292e088974c02f15338e61a2aa855fc0909936af` |
| `courtyard-green.png` | `e071f89c0fb4d82fca842a5ccf9c77567557a268e1e41b65ed63f344b96eca02` |
| `courtyard-autumn.png` | `ee5018778d7e86b04f2f115055f5e22515c0ba06b86040f087e214cef64e8b1f` |
| `courtyard-winter.png` | `12e621f127cbcdbd4c88f7c78f70eafeaca6309f9ac68f03ab72f28ec6b82282` |
| `lakeside-spring.png` | `594a9eaa1dd2afe82df3c5c8f9acfd001b3284284bba48db23f329e17a0ab67d` |
| `lakeside-green.png` | `0df87da0b3d0662abaa448a63d57f9957b6ca2d409fb4d20d1a2435eed6753bf` |
| `lakeside-autumn.png` | `2303dd2300d88b6b5a8571f5c82fb116bbd080b1fcb6ab6cc46b3bb95ef07398` |
| `lakeside-winter.png` | `91af1757037287814d23c40081a3763878eb9683029b56b97afda3dba06c2b0a` |

## Follow-up: soft sky edges and an open meadow (2026-11-21)

- Every outdoor picture's line against the sky was rough: the cut kept a pale ring of the white it was painted on, and its pixels were all or nothing.
- `scripts/soften-sky-edges.mjs` (`scripts/sky-edge-lib.mjs`) cleaned the line in place:
  - the band next to the sky took the colour of the land just inside it, and its alpha rose over a pixel and a half;
  - near-white patches no lower than 4 px under the sky (the ring, gaps between leaves) became sky, in the summer and autumn pictures only. Snow and blossom are the same white, so spring and winter ran with `--keep-white`.
- The land inside and the clear sky kept every sample.
- The Wild garden's left side was opened so friends can walk back to the meadow:
  - Codex's image tool edited each season's picture with one brief: remove the band of ferns, boulders and tall flowers left of the pond, and paint open lawn rising into the meadow.
  - The edit was blended into the original through a soft mask: full left of x 600 between y 420 and 700, fading over 80 px across the water and 60 px above and below. Everything else is the original's pixels.
  - Its pond's left stones stay where they were.
- The field follows it: the courtyard's `geometry.edge` rises to 0.48 on the left, and `geometry.far` and `depthFar` shrink a friend by its height on the screen.
- SHA-256 of the 12 runtime PNGs now:

| Runtime file | SHA-256 |
| --- | --- |
| `spring.png` | `015412a779bae4dc25a6117be914664c2404e5bf56693df3b3c3d5ab0e7062cb` |
| `green.png` | `85d924e2bfcc71795d3d9703bc1376b8f8616c160e8b247b0811fbb1d16d7a8d` |
| `autumn.png` | `d42de93c4ccd60e29b51b24837abed6247d50fd2c4cdfa649a8280f01631cc75` |
| `winter.png` | `c306b04263f54310ac3e531950d4a8725dccb336ca59aba143355c56f7bdcd32` |
| `courtyard-spring.png` | `f0f6e4887db5d67b97212355a3c950ce49a62239c809b9869b80bd880d9201f4` |
| `courtyard-green.png` | `08403272f9bd41a2f5921351f991d25e9df7422fd4d106e19b1cc1e60c17b1f1` |
| `courtyard-autumn.png` | `d5e772f21d4ece245bd4c3137aebdab1e7f00dcec7ab5923d5b7f6e926179524` |
| `courtyard-winter.png` | `17d561b9d9b4481b13f101ddb60ca83e6bc49ba34b6f250b56cc3cd7b6b7410d` |
| `lakeside-spring.png` | `6cc782a8829f5ddeacc9d1d0757d71257d4a0cff6f11bee716697a3b235b736d` |
| `lakeside-green.png` | `90fd800a149dce29841ea8d87b043341a1e7f60399e383712a96f002d7ac7a81` |
| `lakeside-autumn.png` | `65a9d7958328fa506d1b90acdef783927e5b5fb15ec8f1a34d1643647bd289ad` |
| `lakeside-winter.png` | `0fd224676dc3ea103e3726dfa8d21207c967fab7d2e63882a5b1d980c83fdd83` |

## Follow-up: sky between leaves (2026-11-26)

- Small patches of the white the pictures were painted on stayed between leaves and treetops, away from the sky's line, so the 2026-11-21 pass did not reach them.
- `node scripts/soften-sky-edges.mjs --holes` cleared them in all 12 pictures:
  - a patch counts when it is paper white and its ring is dark or green: leaves around it, not snow or blossom;
  - snow's lilac shading and blossom's pink keep every pixel;
  - only the band next to a cleared patch was softened.
- Pixels cleared:

| Place | Spring | Summer | Autumn | Winter |
| --- | --- | --- | --- | --- |
| Hill garden | 309 | 10 | 3 | 552 |
| Wild garden | 143 | 7 | 53 | 9 |
| Lakeside | 403 | 12 | 29 | 324 |

- SHA-256 of the 12 runtime PNGs now:

| Runtime file | SHA-256 |
| --- | --- |
| `spring.png` | `022951be42423d0824bb5f794c39b75459b88ebecda7eaeb99810657763b253c` |
| `green.png` | `71df88392a34a7b3a800561eb8031a2b1486bff65e02629701e26db7b88b40e6` |
| `autumn.png` | `cb0788de1d445f75f06dc5f8780f697a79a5e57eb94503c8d0e0739126ed90e5` |
| `winter.png` | `ad5734596596edd82b88a9f155093a311eee13129774554bd5dc52c928c919e7` |
| `courtyard-spring.png` | `1ce4097cdd5bd5b886d06cd917982c0122fb8a1f0cfb3316b8fd252d15b80900` |
| `courtyard-green.png` | `3a016ac5f5d3435572c44a766d9009d3c561cfc2137dbc9784b227f52bfa48ac` |
| `courtyard-autumn.png` | `13ff47f7ba644a395224c86ca089e601c47bf0f217de6c597fed325e211948a0` |
| `courtyard-winter.png` | `2abc1085ff1a69668a873218203cb720ea7dad2896ef5264a79537a83e6a6e31` |
| `lakeside-spring.png` | `4be35eaceb528391a3363f4937838676aaaff923cab85451693bbf38194267f4` |
| `lakeside-green.png` | `efab1830ad140ae5496f7131b52b73293d3420abc70b943fe3dda833375267aa` |
| `lakeside-autumn.png` | `86968cfcdaeac9bb512ec9abb93a8c2f4bf5fd33846856b1352bb7cc3a87f1c6` |
| `lakeside-winter.png` | `56f8e2be65bdaf9d8e449283e43d6ca3d6f444de5ea65f84b236a4c4199b327f` |
