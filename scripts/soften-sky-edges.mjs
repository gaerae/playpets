// Cleans the line where an outdoor picture's land meets its clear sky (sky-edge-lib.mjs), in place:
//   node scripts/soften-sky-edges.mjs [--keep-white] [--again] [--holes] assets/art/environments/<picture>.png ...
// --keep-white keeps the white patches, for a picture whose treetops hold white (winter snow, spring
// blossom: the same white as the paper). --holes, for such a picture, clears only the white the sky
// showed through between leaves (sky-edge-lib.mjs clearHoles) and softens round it alone. Run it on a newly accepted picture, then
// `pnpm run assets:webp`. A picture whose edge is soft already is left as it is: softening it again
// would move its line a pixel into the land. --again softens it all the same.
import { readFile, writeFile } from 'node:fs/promises';
import { decodePng, encodePng } from './png-lossless-lib.mjs';
import { clearHoles, clearPaper, softened, softenSkyEdge } from './sky-edge-lib.mjs';

const args = process.argv.slice(2),
  keepWhite = args.includes('--keep-white'),
  again = args.includes('--again'),
  holes = args.includes('--holes'),
  files = args.filter(arg => !arg.startsWith('--'));
if (!files.length) {
  console.error('Usage: node scripts/soften-sky-edges.mjs [--keep-white] [--again] [--holes] <picture.png> ...');
  process.exit(2);
}
for (const file of files) {
  const { width, height, pixels } = decodePng(await readFile(file));
  if (holes) {
    const cleared = clearHoles(pixels, width, height);
    if (cleared.length) {
      softenSkyEdge(pixels, width, height, cleared);
      await writeFile(file, encodePng(width, height, pixels));
    }
    console.log(`${file}: ${cleared.length} pixels of sky between leaves cleared`);
    continue;
  }
  if (!again && softened(pixels, width, height)) {
    console.log(`${file}: its edge is soft already, left as it is (--again to soften it more)`);
    continue;
  }
  const cleared = keepWhite ? 0 : clearPaper(pixels, width, height);
  softenSkyEdge(pixels, width, height);
  await writeFile(file, encodePng(width, height, pixels));
  console.log(`${file}: ${cleared} paper pixels cleared, edge softened`);
}
