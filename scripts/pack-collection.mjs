// Reproduce the reviewed atlas viewports without redrawing or changing generated pixels.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const records = JSON.parse(await readFile('src/art/collection.json', 'utf8'));
for (const { id, kind, atlas, atlasSize, crop, size, art } of records) {
  const [width, height] = size;
  const [sheetWidth, sheetHeight] = atlasSize;
  const target = path.join('src/art', art);
  const clip = `specimen-${kind}-${id}`,
    [x, y, cropWidth, cropHeight] = crop;
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(
    target,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><svg width="${width}" height="${height}" viewBox="${crop.join(' ')}" overflow="hidden"><defs><clipPath id="${clip}"><rect x="${x}" y="${y}" width="${cropWidth}" height="${cropHeight}"/></clipPath></defs><image href="art/${atlas}" width="${sheetWidth}" height="${sheetHeight}" clip-path="url(#${clip})"/></svg></svg>\n`,
  );
}
console.log(`Packed ${records.length} collection viewports`);
