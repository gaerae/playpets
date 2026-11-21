// Cleans the line where an outdoor picture's land meets its clear sky (sky-edge-lib.mjs), in place:
//   node scripts/soften-sky-edges.mjs [--keep-white] [--again] assets/art/environments/<picture>.png ...
// --keep-white keeps the white patches, for a picture whose treetops hold white (winter snow, spring
// blossom: the same white as the paper). Run it on a newly accepted picture, then
// `pnpm run assets:webp`. A picture whose edge is soft already is left as it is: softening it again
// would move its line a pixel into the land. --again softens it all the same.
import { readFile, writeFile } from 'node:fs/promises';
import { decodePng, encodePng } from './png-lossless-lib.mjs';
import { clearPaper, softened, softenSkyEdge } from './sky-edge-lib.mjs';

const args = process.argv.slice(2),
  keepWhite = args.includes('--keep-white'),
  again = args.includes('--again'),
  files = args.filter(arg => !arg.startsWith('--'));
if (!files.length) {
  console.error('Usage: node scripts/soften-sky-edges.mjs [--keep-white] [--again] <picture.png> ...');
  process.exit(2);
}
for (const file of files) {
  const { width, height, pixels } = decodePng(await readFile(file));
  if (!again && softened(pixels, width, height)) {
    console.log(`${file}: its edge is soft already, left as it is (--again to soften it more)`);
    continue;
  }
  const cleared = keepWhite ? 0 : clearPaper(pixels, width, height);
  softenSkyEdge(pixels, width, height);
  await writeFile(file, encodePng(width, height, pixels));
  console.log(`${file}: ${cleared} paper pixels cleared, edge softened`);
}
