# Companion artwork

## Official cast and archived artwork

Daisy, Clover and Pip are the only bundled and publicly exported starter pets.
Other character directories are archival source artwork; they are not embedded
in the executable or offered in the creator studio. Clover is the brand mascot.
Retired built-in friends retain their saved identity and relationships through
an appearance migration; imported copies remain unchanged.

The three companions use their layered baseline in spring and autumn and
`seasonal/summer.png` and `seasonal/winter.png` in the other seasons. Each sheet
retains all 88 canonical cells. `seasonalSpritesheets` lists these optional files.

Archived adult generation prompts are recorded in [ART-PROMPTS.md](ART-PROMPTS.md). Source rows and large/mini playback proofs are retained locally under ignored `scratch/adult-companions/` and `scratch/seasonal-companions/`. Do not overwrite accepted originals with weaker generation candidates. Some short walks retain a shuffle-like stride; do not describe them as complete hand-authored locomotion cycles.

The historical flat sample generator has been retired. The accepted sheets and
source records below remain the inputs to the current artwork tools.

## Current illustration direction

The three companions retain their recognizable identities, markings and actions.
Pip wears a butter-yellow varsity jacket with ivory sleeves, a small blue
five-petal flower with a cream center on the anatomical left chest, and navy
shorts. Summer uses a yellow and ivory round-neck short-sleeve T-shirt; winter
uses a padded quilted jacket and navy trousers. All three
companions keep their upright, anthropomorphic proportions. New accepted sheets use fine warm-brown outlines, matte painted
color planes, restrained shading and simplified fur and fabric texture. They
keep body volume and clear expressions at app and mini sizes, without plastic
gloss or individually rendered fur strands. The reusable prompts in
`scripts/creator-specs.mjs` carry the same direction into identity, expression,
wardrobe and motion sheets. A prompt alone does not establish acceptance:
compare every state and season against the approved reference before export.

The generation and clarity notes below describe earlier production stages;
[the accepted source record](../sources/companions-2026-10-14/README.md) identifies the replacement files and packing adjustments.

## Original generation and packing

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

## Earlier clarity revision

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
artifacts and preserved original sheets are local under `scratch/sprite-clarity/`.
Compare the meaning of every action as well as its sharpness: waiting keeps its
chin-paw gesture, working keeps the laptop, and jumping and celebration remain
visibly different from idle. Inspect the frames the animation actually consumes,
including the first five jump poses.

## Archived realistic appearance exploration

The first adult concept was subsequently accepted as a second style direction at the user's request. `../concepts/adult-realistic-companions.png` preserves that reference. This exploration supplied illustrated and semi-realistic adult variants with separate portraits. These characters are no longer part of the bundled cast or public creator kits. Their source directories remain as an archive; imported compatible artwork may still use the optional appearance fields.

The optional `realisticSpritesheets` map contains `default`, `summer` and `winter`; `realisticPortraitPath` identifies the separate face image. Exact character-specific prompts and rejected-candidate notes are in each adult's `REALISTIC-PROMPTS.md`. Realistic production sources and playback proofs are retained under ignored `scratch/realistic-companions/`.
