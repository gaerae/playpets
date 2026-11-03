# Plant growth artwork

- The built-in image generation tool created `growth.png` on 2026-10-11.
- Four clipped SVG viewports keep the existing 40-by-60 garden footprint, common ground line and relative growth heights.
- They reference the generated pixels without repainting them.
- Mature flowers still use their separate specimen atlas.
- No external game artwork is included.

## Generation prompt

- `node scripts/pack-growth.mjs generated-source.png` selects the dominant connected silhouette in each column and copies its original pixels.
- It removes neighboring leaf fragments without drawing, recoloring, moving or rescaling the plant.
- Review the inline SVG symbols at native 40-by-60 and enlarged size on light and dark surfaces.

Production cozy game garden artwork atlas, FOUR columns ONE row, transparent 1536x1024 canvas. Exactly four isolated stages of the SAME flowering plant growing from a small rich brown soil mound, shared ground line near bottom, each safely within its column. Left to right: 1 a tiny golden seed in soil, no stem; 2 a very small two-leaf fresh sprout; 3 a taller healthy stem with layered three pairs of rounded leaves, no blossom; 4 tallest stem topped by a closed pale pink flower bud. Stage heights visibly increase 1 through4, not four equally tall plants. Detailed soft sculpted 3D storybook game rendering, delicate leaf veins, smooth clean edges, warm sunlight, rich natural material detail, calm gentle colors, same style as high-quality cozy village games. Broad legible shapes for small sprites. Transparent background outside the isolated plants and small soil mounds, no pots, no scenery, no text or grid or extra flowers. All soil mounds same size and ground height. Do not crop stems or leaves.

## Final gutter-safe generation

- The final, independently generated source keeps complete leaves and oval soil mounds inside each column.
- Acceptance evidence: runtime compositing at 40-by-60 and 80-by-120 on light/dark surfaces.
- Image previews that ignore alpha can show RGB glow outside the true silhouette; source alpha was checked separately.
- The first packed atlas is kept locally for comparison.

Game asset sprite atlas on TRUE fully transparent 1536x1024 background, no halo or shadows. Four isolated garden plant growth icons in exactly FOUR equal columns ONE row. Icon centers x192,576,960,1344. Every plant AND soil mound fits inside 240px width, fully isolated with at least72px transparent gutter on each side within each384px column. Shared ground y900. Left to right golden seed in rich brown oval soil mound height80; two-leaf sprout on identical soil height240; healthy green six-leaf stem no blossom height480; green leafy stem with closed pale pink bud height720. Same mature plant identity and equal soil dimensions. Detailed polished soft sculpted cozy game rendering, broad clean shapes, delicate leaf veins, calm warm daylight and natural greens. Soil complete rounded oval each width220 with smooth outer silhouette. No blurred colored atmosphere, no glow, no backdrop, no text, no grid, no scenery. Entire leaves and soil visible far from column edges. This image will be sliced at384pixel intervals so exact safe gutters are essential.

- The four stage viewports shift upward by 176 source pixels to remove the transparent
  ground gutter while keeping scale.
- Indoor young stages rise into the ceramic planter opening.
- Planter lighting follows the stems at evening and night.
