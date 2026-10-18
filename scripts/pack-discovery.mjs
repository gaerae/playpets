// Reproduce the reviewed discovery viewports without redrawing the accepted source pixels.
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pngSize } from './png-lossless-lib.mjs';

const root = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(root, 'assets/discovery');
const manifest = JSON.parse(await readFile(path.join(sourceRoot, 'ART-SOURCES.json'), 'utf8'));
for (const source of manifest.sources) {
  const original = path.join(sourceRoot, source.file);
  const bytes = await readFile(original);
  const { width, height } = pngSize(bytes);
  if (width !== source.size[0] || height !== source.size[1]) throw new Error(`Wrong source size: ${source.file}`);
  if (createHash('sha256').update(bytes).digest('hex') !== source.sha256)
    throw new Error(`Source changed: ${source.file}`);
  const destination = path.join(root, 'src/art', source.atlas);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(original, destination);
}
for (const asset of manifest.assets) {
  const source = manifest.sources.find(item => item.id === asset.source);
  if (!source) throw new Error(`Missing atlas for ${asset.id}`);
  const [x, y, cropWidth, cropHeight] = asset.crop;
  const [width, height] = asset.size;
  const frame = asset.frame ?? asset.crop;
  if (
    !asset.crop.every(Number.isFinite) ||
    x < 0 ||
    y < 0 ||
    cropWidth <= 0 ||
    cropHeight <= 0 ||
    x + cropWidth > source.size[0] ||
    y + cropHeight > source.size[1] ||
    !asset.size.every(value => Number.isFinite(value) && value > 0)
  )
    throw new Error(`Invalid viewport for ${asset.id}`);
  if (frame.length !== 4 || !frame.every(Number.isFinite) || frame[2] <= 0 || frame[3] <= 0)
    throw new Error(`Invalid frame for ${asset.id}`);
  const target = path.join(root, 'src/art', asset.art);
  const clip = `discovery-${asset.id}`;
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(
    target,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><svg width="${width}" height="${height}" viewBox="${frame.join(' ')}" preserveAspectRatio="xMidYMax meet" overflow="hidden"><defs><clipPath id="${clip}"><rect x="${x}" y="${y}" width="${cropWidth}" height="${cropHeight}"/></clipPath></defs><image href="art/${source.atlas}" width="${source.size[0]}" height="${source.size[1]}" clip-path="url(#${clip})"/></svg></svg>\n`,
  );
}
console.log(`Packed ${manifest.assets.length} discovery viewports from ${manifest.sources.length} accepted sources`);
