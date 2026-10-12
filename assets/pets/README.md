# Companion artwork

## Adult companions and seasonal wardrobes

Aria (a fictional adult woman, 25) and Noah (a fictional adult man, 26) extend the illustrated cast. Their character appearance uses `../concepts/adult-idol-companions.png`; the selectable semi-realistic appearance uses `../concepts/adult-realistic-companions.png`. Both start as friends and support the existing relationship settings. Clover is the brand mascot; Daisy and Pip keep their original character roles.

The five illustrated companions use their layered baseline in spring and autumn and separate generated `seasonal/summer.png` and `seasonal/winter.png` sheets. Every variant keeps all 88 canonical cells, full body visibility and an idle-anchored apparent height. `seasonalSpritesheets` lists the optional local files in each manifest. Runtime validation, lazy selection and safe fallback are described in `docs/design/2026-10-11-companions.md`.

Exact adult generation prompts are recorded in [ART-PROMPTS.md](ART-PROMPTS.md). Source rows and large/mini playback proofs are retained locally under ignored `release/adult-companions/` and `release/seasonal-companions/`. Do not overwrite accepted originals with weaker generation candidates. Some short walks retain a shuffle-like stride; do not describe them as complete hand-authored locomotion cycles.

`npm run mascot-pet` draws the historical flat cats into `release/legacy-pets/`.
It does not overwrite the accepted production artwork in `assets/pets/`.

The built-in image generation tool created `daisy`, `clover` and `pip` on
2026-10-11, using `../concepts/forest-companions.png` as their identity reference.
The original scene and characters were generated for this project; no external
game artwork is included.

The prompt set requested an exact eight-column, eleven-row transparent atlas,
stable proportions and clothes, full-body isolated figures and generous cell
margins. Rows cover idle, walking right, walking left, wave, jump, embarrassment,
waiting, laptop work, celebration and sixteen directional head/eye poses.

- Daisy: chestnut bob, sage daisy beret, ivory blouse, apricot dungaree dress,
  brown boots and leaf satchel; a curious explorer.
- Clover: cream-and-ginger kitten, teal linen overalls, embroidered botanical pocket,
  straw hat with sage ribbon and leaf bow; a gentle gardener.
- Pip: caramel floppy-eared puppy, blue jacket, red scarf and leaf mailbag;
  a cheerful courier.

`scripts/pack-companion.mjs` isolates each complete generated silhouette and packs
it into the standard 1536-by-2288 v2 sheet. The generated source has unequal row
spacing; adjacent silhouettes can overlap in height or meet at a narrow alpha
bridge. Component extraction and a guarded bridge split prevent hats and feet
from being cut into neighboring cells. Uniform scaling and a shared ground line
keep standing poses stable. The script refuses incomplete pose sets. It does
not draw characters or replace the generated poses. Run it with the saved source
PNG and a destination path. The format has sixteen directional gaze cells and
left/right walking cycles. Inspect the small sprites in motion as well as the
large concept image before accepting future revisions.

## Clarity revision

The clarity pass generates each animation row separately as a transparent
four-column, two-row image. Eight larger source poses recover facial, clothing
and fur detail that the original 88-pose source could not retain. References
preserve the original large-head proportions, outfit and character identity.

Use `node scripts/pack-companion-batches.mjs source-directory destination.png idle-height`
with `00-idle.png` through `10-look.png`. The packer uses one scale anchored to
the original idle silhouette height, preserves jump displacement, and refuses
poses that would cross the canonical cell gutters. It does not shrink the entire
pet to accommodate one oversized gesture. Review every row and actual playback
at 176-pixel normal size and 110/75-pixel mini sizes on DPR 1 and 2.

The accepted replacement keeps the 1536×2288 sheet and 192×208 cells; animation
timings, renderer code and decoded sprite memory stay unchanged. Comparison
artifacts and preserved original sheets are local under `release/sprite-clarity/`.
Compare the meaning of every action as well as its sharpness: waiting keeps its
chin-paw gesture, working keeps the laptop, and jumping and celebration remain
visibly different from idle. Inspect the frames the animation actually consumes,
including the first five jump poses.

## Realistic appearance follow-up

The first adult concept was subsequently accepted as a second style direction at the user's request. `../concepts/adult-realistic-companions.png` preserves that reference. Aria and Noah can retain the illustrated appearance or use semi-realistic full-body animations in the yard, mini mode and desktop overlay, with generated face portraits in conversations. They remain fictional adults. Appearance is saved separately for each friend and does not alter their relationship or personality.

The optional `realisticSpritesheets` map contains `default`, `summer` and `winter`; `realisticPortraitPath` identifies the separate face image. Exact character-specific prompts and rejected-candidate notes are in each adult's `REALISTIC-PROMPTS.md`. Realistic production sources and playback proofs are retained under ignored `release/realistic-companions/`.
