// Cleans the line where an outdoor picture's land meets its clear sky (sky-edge-lib.mjs), in place:
//   node scripts/soften-sky-edges.mjs [--keep-white] assets/art/environments/<picture>.png ...
// --keep-white keeps the white patches, for a picture whose treetops hold white (winter snow, spring
// blossom: the same white as the paper). Run it
// once on a newly accepted picture, then `pnpm run assets:webp`; running it again only softens the
// edge a little more.
import { readFile, writeFile } from 'node:fs/promises';
import { decodePng, encodePng } from './png-lossless-lib.mjs';
import { clearPaper, softenSkyEdge } from './sky-edge-lib.mjs';

const args = process.argv.slice(2),
  keepWhite = args.includes('--keep-white'),
  files = args.filter(arg => arg !== '--keep-white');
if (!files.length) {
  console.error('Usage: node scripts/soften-sky-edges.mjs [--keep-white] <picture.png> ...');
  process.exit(2);
}
for (const file of files) {
  const { width, height, pixels } = decodePng(await readFile(file));
  const cleared = keepWhite ? 0 : clearPaper(pixels, width, height);
  softenSkyEdge(pixels, width, height);
  await writeFile(file, encodePng(width, height, pixels));
  console.log(`${file}: ${cleared} paper pixels cleared, edge softened`);
}
