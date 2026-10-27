# Companion artwork

## Official cast and archived artwork

- Daisy, Clover, Pip and Miso are the bundled and publicly exported starter
  pets. Clover is the brand mascot.
- Other character directories are archival source artwork: not embedded in the
  executable, not offered in the creator studio.
- Retired built-in friends keep their saved identity and relationships through
  an appearance migration; imported copies stay unchanged.
- The four companions use their layered baseline in spring and autumn, and
  `seasonal/summer.png` and `seasonal/winter.png` in the other seasons.
- Each sheet keeps all 88 canonical cells. `seasonalSpritesheets` lists these
  optional files.
- Archived adult generation prompts: [ART-PROMPTS.md](ART-PROMPTS.md).
- Source rows and large/mini playback proofs are kept locally under ignored
  `scratch/adult-companions/` and `scratch/seasonal-companions/`.
- Do not overwrite accepted originals with weaker generation candidates.
- Some short walks keep a shuffle-like stride; do not describe them as complete
  hand-authored locomotion cycles.
- The historical flat sample generator is retired. The accepted sheets and
  source records below remain the inputs to the current artwork tools.

## Optional game actions

- The portable baseline sheets stay complete for every starter pet.
- Extra game actions are app-owned artwork, selected separately in
  `src/content/companion-actions.json`. They add no requirements to imported
  pet files and do not replace the baseline sheets.
- Daisy, Clover, Pip and Miso have dedicated digging, planting, casting,
  waiting, reeling and find-reaction clips in all four seasons.
- Daisy, Pip and Miso use three matching outfit sets: the baseline in spring
  and autumn, a lighter summer outfit and a winter outfit.
- Clover shares the approved teal short overalls and straw hat in spring,
  summer and autumn; in winter, a dark teal coat, ivory scarf and knitted
  beanie.
- Imported pets keep their original canonical sheets, format and activity
  fallback.
- Accepted action sources, normalization maps, packing plans and provenance:
  `../sources/companion-actions-2026-10-19/`, grouped by character and outfit.
- Runtime atlases: `src/art/companions/` at the repository root.
- A single fishing atlas supplies separate cast, wait and reel clips.
- Keep body scale, foot contact, complete held tools and outfit consistent
  across each clip.
- Bounded paint canvases can extend beyond the logical body while keeping the
  canonical ground point; they do not change the portable pet format.

## Current illustration direction

- The four companions keep their recognizable identities, markings and
  actions, and their upright, anthropomorphic proportions.
- Pip: washed-indigo denim jacket over an ivory T-shirt and warm-ivory shorts,
  with a small white five-petal flower and golden-yellow center on the
  anatomical left chest. Summer: a light short-sleeve denim shirt. Winter: a
  lined denim jacket and ivory trousers.
- New accepted sheets use fine warm-brown outlines, matte painted color planes,
  restrained shading and simplified fur and fabric texture.
- They keep body volume and clear expressions at app and mini sizes, without
  plastic gloss or individually rendered fur strands.
- The reusable prompts in `scripts/creator-specs.mjs` carry the same direction
  into identity, expression, wardrobe and motion sheets.
- A prompt alone does not establish acceptance: compare every state and season
  against the approved reference before export.
- The generation and clarity notes below describe earlier production stages;
  [the earlier source record](../sources/companions-2026-10-14/README.md)
  identifies that revision.
- The current Miso and denim Pip sources live under
  `../sources/companions-2026-10-17/`.
- Miso: lavender cable-knit vest over an ivory collared shirt and warm-grey
  pleated shorts. Summer lightens the knit and linen. Winter: a fitted
  lavender wool cardigan and full-length warm-grey trousers.
- A white-petal, golden-centred daisy links the four official companions.
- The accepted Miso source rows and generation record:
  `../sources/companions-2026-10-17/miso/`. They replace no existing starter
  character.

## Original generation and packing

- The built-in image generation tool created `daisy`, `clover` and `pip` on
  2026-10-11, with `../concepts/forest-companions.png` as their identity
  reference.
- The original scene and characters were generated for this project; no
  external game artwork is included.
- The prompt set requested an exact eight-column, eleven-row transparent atlas,
  stable proportions and clothes, full-body isolated figures and generous cell
  margins.
- Rows cover idle, walking right, walking left, wave, jump, embarrassment,
  waiting, laptop work, celebration and sixteen directional head/eye poses.

| Character | Design |
| --- | --- |
| Daisy | Chestnut bob, sage daisy beret, ivory blouse, apricot dungaree dress, brown boots and leaf satchel; a curious explorer |
| Clover | Cream-and-ginger kitten, teal linen overalls, embroidered botanical pocket, straw hat with sage ribbon and leaf bow; a gentle gardener |
| Pip | Caramel floppy-eared puppy, blue jacket, red scarf and leaf mailbag; a cheerful courier |

`scripts/pack-companion.mjs`:
- Isolates each complete generated silhouette and packs it into the standard
  1536-by-2288 v2 sheet.
- The generated source has unequal row spacing; adjacent silhouettes can
  overlap in height or meet at a narrow alpha bridge.
- Component extraction and a guarded bridge split keep hats and feet from being
  cut into neighboring cells.
- Uniform scaling and a shared ground line keep standing poses stable.
- Refuses incomplete pose sets. Does not draw characters or replace the
  generated poses.
- Run it with the saved source PNG and a destination path.
- The format has sixteen directional gaze cells and left/right walking cycles.
- Before accepting future revisions, inspect the small sprites in motion as
  well as the large concept image.

## Earlier clarity revision

- The clarity pass generates each animation row separately as a transparent
  four-column, two-row image.
- Eight larger source poses recover facial, clothing and fur detail that the
  original 88-pose source could not keep.
- References keep the original large-head proportions, outfit and character
  identity.
- Pack with `node scripts/pack-companion-batches.mjs source-directory destination.png idle-height`,
  using `00-idle.png` through `10-look.png`.
- The packer uses one scale anchored to the original idle silhouette height,
  keeps jump displacement, and refuses poses that would cross the canonical
  cell gutters.
- It does not shrink the entire pet to fit one oversized gesture.
- Review every row and actual playback at 176-pixel normal size and 110/75-pixel
  mini sizes on DPR 1 and 2.
- The accepted replacement keeps the 1536×2288 sheet and 192×208 cells;
  animation timings, renderer code and decoded sprite memory stay unchanged.
- Comparison artifacts and preserved original sheets are local under
  `scratch/sprite-clarity/`.
- Compare the meaning of every action as well as its sharpness: waiting keeps
  its chin-paw gesture, working keeps the laptop, and jumping and celebration
  stay visibly different from idle.
- Inspect the frames the animation actually consumes, including the first five
  jump poses.

Website previews:
- Genuine double-resolution idle, wave and jump strips for summer and winter at
  `preview/<season>/<state>.png` in all four official pet directories.
- Assembled from accepted seasonal source rows with the same idle scale, row
  corrections and jump choreography as the app.
- Spring and autumn reuse the base strips.
- Source paths, settings and export hashes:
  `../sources/companions-2026-10-17/seasonal-previews.json`. The packing
  procedure is in the maintainer scripts guide.
- These exports do not replace or resize the runtime atlases.

## Archived realistic appearance exploration

- The first adult concept was later accepted as a second style direction at the
  user's request. `../concepts/adult-realistic-companions.png` keeps that
  reference.
- This exploration supplied illustrated and semi-realistic adult variants with
  separate portraits.
- These characters are no longer part of the bundled cast or public creator
  kits. Their source directories remain as an archive.
- Imported compatible artwork may still use the optional appearance fields.
- The optional `realisticSpritesheets` map contains `default`, `summer` and
  `winter`; `realisticPortraitPath` names the separate face image.
- Exact character-specific prompts and rejected-candidate notes: each adult's
  `REALISTIC-PROMPTS.md`.
- Realistic production sources and playback proofs are kept under ignored
  `scratch/realistic-companions/`.
