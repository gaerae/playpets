# Collection specimen artwork

Generated with the built-in imagegen tool on 2026-10-11. The PNG atlases are unchanged tool outputs, with actual alpha; SVG wrappers select reviewed specimen bounds and preserve each existing display size. No script redraws or alters the generated artwork.

- Fish: 19 specimens in a four-column atlas, final slot empty. Source generation: exec-f7ebb832-0567-49f7-acfe-142a0a777802.png.
- Bugs: 16 specimens in a four-column atlas. Source generation: exec-934c7618-72fc-44d7-8342-e5b9174d0f93.png.
- Gifts: 12 remaining decorations, complementing the six existing props. Source generation: exec-96ab43e5-df4a-472f-8aa5-d9dbba2a24fa.png.

Style references: `decor/props.png` and `flowers/specimens.png`. Existing procedural fish and bug drawings and their `look` data remain available by removing a specimen's `art` field. The original gift SVGs are unchanged; the catalogue selects new wrappers under `decor/sculpted/`.

Inspection: all 47 subjects were reviewed for identity, complete silhouettes, alpha, and crop isolation against light and dark backgrounds. The atlas spacing varies; wrapper bounds are individually measured instead of assuming exact cells. These are stylized game collectibles, not scientific identification plates. The moon carp and golden firefly are fantasy event collectibles.

## Fish prompt

Use case: stylized-concept. Asset type: production transparent game specimen atlas for a cozy desktop pet game.
Create ONE atlas of exactly 19 DIFFERENT freshwater fish in a strict FOUR columns by FIVE rows grid, row-major. Final cell row5 col4 MUST be empty. Canvas landscape-ish 1536x1920 if possible. Each cell equal 384x384. One complete fish centered per cell, facing RIGHT, side profile. Entire fish including all fins, whiskers and tail fits inside the central 84% of its cell, 8% clear padding on every side. No elements cross cell boundaries.
Style: professionally art-directed softly sculpted miniature collectible, subtle pearlescent scales, rounded friendly shapes but authentic species anatomy, restrained soft highlights, believable dimensional fins, clean silhouette readable at 80px. References are STYLE/MATERIAL ONLY: same softly sculpted warmth as flowers and props, not their subjects/background. True transparent alpha background, NO painted background, NO cards, NO gridlines, NO labels, NO pedestal, NO water, NO shadows outside subject, no glow halos.
EXACT grid species:
Row1: (1) olive bronze round crucian carp with tall body and no whiskers; (2) bronze common carp with two small mouth barbels and burnt-orange fins; (3) tiny pale beige Japanese ricefish/medaka, short translucent fins and upturned mouth; (4) slender silver minnow, subtle pink horizontal side stripe.
Row2: (1) round orange fancy goldfish with flowing split fan tail; (2) dark grey broad-headed catfish, long whiskers, cream underside; (3) olive freshwater eel long slender S-curved body, cream underside, continuous low fin, NOT snake; (4) icy silver slender smelt, translucent pale blue fins.
Row3: (1) slim sage green sweetfish/ayu, distinct GOLD spot behind gill, pale cream belly; (2) rainbow trout olive back, pink horizontal band and small dark speckles; (3) ochre freshwater mandarin fish Siniperca, irregular dark brown mottling and spiny dorsal fin, NOT tropical marine mandarin dragonet; (4) luminous warm gold common carp with barbels, NOT fancy goldfish.
Row4: (1) slender mottled brown loach with small mouth barbels and rounded small fins; (2) deep round bluegill, blue gill patch, golden belly and dark vertical body bars; (3) olive largemouth bass, large mouth and dark horizontal side stripe; (4) long dark olive snakehead fish, mottled sides, broad head, long low dorsal fin.
Row5: (1) small sandy gudgeon, darker lateral spots and small barbels; (2) silver blue salmon, subtle rosy underside and muted red lateral band, streamlined with small adipose fin; (3) fantasy moon carp, ivory pearl body, golden fins and small golden speckles, fine barbels; (4) EMPTY transparent.
Keep fish individually recognizable. Do not merge specimens. Exactly19 fish. Most fish width about300px within384px cell; eel bends to fit. No text anywhere.

## Bug prompt

Use case: stylized-concept. Create ONE professional game specimen atlas, exactly SIXTEEN different insect collectibles in a strict 4 columns × 4 rows grid, one specimen centered per cell. Square canvas, equal square cells. Reference flowers are STYLE/MATERIAL reference only: softly sculpted dimensional miniature, elegant soft modeling, delicate veins, warm studio highlights, restrained gloss, readable silhouettes at 80px. True transparent alpha. NO scenery, floor, colored haze, cards, text, numbers, grid lines or drop shadows.
All insects seen from ABOVE with heads UP. Their entire silhouette including antennae/legs/wingtips stays inside central80% of their cell, 10% clear padding. Butterflies four natural wings extended symmetrically, realistic antennae and small body; dragonflies exactly four fine translucent veined wings, long segmented abdomen, six legs; fireflies clearly beetles with six tiny legs, antennae, dark wing covers and luminous abdominal tip, not butterflies or wasps.
EXACT row-major grid:
Row1: white cabbage butterfly with charcoal wing tips and paired black spots; lemon yellow butterfly with ochre edges; small powder blue butterfly with darker blue thin edges; yellow swallowtail with bold black stripes and two trailing hindwing tails.
Row2: black swallowtail with blue-green iridescent hindwing sheen and two hindwing tails; warm rusty red peacock butterfly with FOUR distinct blue-centered eye spots; powder-blue dragonfly with silvery translucent wings; vivid red dragonfly with very pale warm translucent wings.
Row3: common firefly dark olive-black beetle, coral-red thorax, soft pale yellow-green luminous abdomen tip; orange-tip butterfly cream wings with ORANGE patches restricted to forewing tips; purple emperor butterfly purple-violet upper wings with white diagonal bands and dark brown margins; brimstone butterfly pale sulphur yellow, pointed leaf-shaped wings, tiny central orange spot.
Row4: delicate slender turquoise damselfly, four narrow transparent wings held slightly open, extra slim abdomen; emperor dragonfly green thorax and rich green/blue segmented abdomen, broad clear four wings; smaller Heike firefly dark brown beetle, orange-red thorax, lime-green luminous abdomen tip; fantasy golden firefly bronze-black beetle, amber thorax, rich warm GOLDEN luminous tip.
Exactly16, do not duplicate species, do not add objects. Glow confined close to abdominal tip with soft alpha, not broad background halos. No wings or antennae clipped. Preserve anatomical differences and fine natural textures.

## Gift prompt

Use case: stylized-concept. Create ONE production game atlas of exactly TWELVE cozy garden gift props, strict FOUR columns × THREE rows, one complete object centered in each equal square cell, landscape4:3 canvas. Style matches reference props ONLY for material: softly sculpted professionally rendered miniature game art, warm wood grain, gentle natural detail, clean modeling, pleasing restrained colors, dimensional but readable at80px. Three-quarter view consistent with reference bench. Background MUST be actual fully transparent alpha, NO painted background/haze, no scenery, no grid lines, no labels/text/numbers, NO contact shadows outside objects.
Every object fits wholly in its cell, including poles, antenna-like tops and base, within central80% of cell; at least10% transparent padding. Natural individual proportions, don't stretch tall objects.
EXACT grid left-right row-major:
Row1 col1: small vintage dark bronze garden lantern on a slim freestanding pole with sturdy base, warm amber glass panels, complete from finial to feet.
Row1 col2: pale turquoise wooden birdhouse on a wood post with sturdy small base, terracotta gabled roof, circular entrance and little perch, a tiny golden songbird perched on roof.
Row1 col3: cheerful red yellow blue green four-blade paper pinwheel on a slim wood stick, complete stick and small stand/base.
Row1 col4: rustic wooden A-frame garden swing, two A-frame sides and crossbeam, two ropes carrying a wood plank seat, plausible complete structure.
Row2 col1: terracotta flowerpot of small white daisies with yellow centers, green leaves.
Row2 col2: low rounded tree stump stool, visible concentric rings on cut top, textured bark, tiny leaf sprig at side.
Row2 col3: blank two-direction wooden signpost with one arrow pointing left and one right, no lettering, small leafy grass base.
Row2 col4: pale blue glass Japanese wind bell with pink flower motif and yellow paper strip, hanging from a gracefully curved dark metal freestanding stake, complete base.
Row3 col1: small cherry blossom sapling with soft pink blossom clusters, slender branching trunk in glazed blue flowerpot.
Row3 col2: striped round green watermelon with ONE red cut triangular wedge beside it, black seeds and cream rind.
Row3 col3: full ripe orange pumpkin with dimensional ribs, short curled woody stem, one green leaf.
Row3 col4: friendly two-snowball snowman, black top hat, red knitted scarf, carrot nose, dark pebble eyes and buttons, twig arms, complete rounded snow base.
Distinct12 objects only. No neighboring items overlap. All silhouettes clean and unclipped. Cohesive materials with the supplied props reference, but do not copy any subjects from it.
