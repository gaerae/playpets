// Reproduce the reviewed atlas viewports without redrawing or changing generated pixels.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { trimKeepsakeSheets } from './sheet-trim-lib.mjs';

const records = JSON.parse(await readFile('src/art/collection.json', 'utf8'));
for (const { id, kind, atlas, atlasSize, crop, size, art } of records) {
  const [width, height] = size;
  const [sheetWidth, sheetHeight] = atlasSize;
  const target = path.join('src/art', art);
  // A keepsake stands on the ground, so its drawing sits on the bottom of its box.
  const align = kind === 'treasure' ? ' preserveAspectRatio="xMidYMax meet"' : '';
  const clip = `specimen-${kind}-${id}`,
    [x, y, cropWidth, cropHeight] = crop;
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(
    target,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><svg width="${width}" height="${height}" viewBox="${crop.join(' ')}"${align} overflow="hidden"><defs><clipPath id="${clip}"><rect x="${x}" y="${y}" width="${cropWidth}" height="${cropHeight}"/></clipPath></defs><image href="art/${atlas}" width="${sheetWidth}" height="${sheetHeight}" clip-path="url(#${clip})"/></svg></svg>\n`,
  );
}
console.log(`Packed ${records.length} collection viewports`);
const trimmed = await trimKeepsakeSheets(new Set(records.map(record => record.atlas.replace(/\.webp$/, '.png'))));
if (trimmed.length)
  console.log(`Cleared what no drawing cuts from ${trimmed.join(', ')}; run \`pnpm run assets:webp\`.`);
