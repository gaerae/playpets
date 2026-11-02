// The yard's raster art is reviewed as lossless PNG in assets/art and ships as near-lossless WebP in
// src/art, which the app embeds; this keeps the two in step without an encoder in tests or CI.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { imageSize } from './asset-audit-lib.mjs';
import { sha256 } from './png-lossless-lib.mjs';

export const EXPORTS = 'assets/art';
export const RUNTIME = 'src/art';
export const MANIFEST = `${EXPORTS}/webp.json`;
// libwebp's near-lossless level 60 changes a drawn sample by at most 4 of 255 on this art.
export const NEAR_LOSSLESS = 60;
export const MAX_ERROR = 4;

/** `trees/oak.png` (relative to assets/art) → `trees/oak.webp` (relative to src/art). */
export const webpName = name => name.replace(/\.png$/, '.webp');

/** The PNG export behind a shipped WebP, named as the page does (`art/…`) or from the repository. */
export const pngFor = name => `${EXPORTS}/${name.replace(/^(?:src\/)?art\//, '').replace(/\.webp$/, '.png')}`;

async function filesIn(root, extension, folder = root) {
  let entries;
  try {
    entries = await readdir(folder, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const found = await Promise.all(
    entries.map(entry => {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) return filesIn(root, extension, file);
      return entry.isFile() && entry.name.endsWith(extension)
        ? [path.relative(root, file).split(path.sep).join('/')]
        : [];
    }),
  );
  return found.flat().sort();
}

export const pngExports = (root = '.') => filesIn(path.join(root, EXPORTS), '.png');
export const runtimeWebps = (root = '.') => filesIn(path.join(root, RUNTIME), '.webp');

export async function readManifest(root = '.') {
  try {
    return JSON.parse(await readFile(path.join(root, MANIFEST), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

/**
 * What would make the shipped WebP differ from the reviewed PNG: an export without its WebP, an
 * export changed after its WebP was made, a WebP edited by hand or left behind by a removed export.
 */
export async function webpProblems(root = '.') {
  const [pngs, webps, manifest] = await Promise.all([pngExports(root), runtimeWebps(root), readManifest(root)]);
  const problems = [],
    expected = new Set(pngs.map(webpName));
  for (const name of pngs) {
    const record = manifest[name],
      png = await readFile(path.join(root, EXPORTS, name));
    let webp;
    try {
      webp = await readFile(path.join(root, RUNTIME, webpName(name)));
    } catch {
      problems.push(`${RUNTIME}/${webpName(name)} is missing`);
      continue;
    }
    if (!record || record.png !== sha256(png)) problems.push(`${EXPORTS}/${name} changed after its WebP was made`);
    else if (record.webp !== sha256(webp)) problems.push(`${RUNTIME}/${webpName(name)} is not the recorded WebP`);
    else if (imageSize(png, 'png').join('x') !== imageSize(webp, 'webp').join('x'))
      problems.push(`${RUNTIME}/${webpName(name)} has another size than its PNG`);
  }
  for (const name of webps) if (!expected.has(name)) problems.push(`${RUNTIME}/${name} has no PNG in ${EXPORTS}`);
  for (const name of Object.keys(manifest))
    if (!pngs.includes(name)) problems.push(`${MANIFEST} names ${name}, which is gone`);
  return problems;
}

/** A PAM file from `dwebp -pam`: width, height and RGBA samples. */
export function parsePam(bytes) {
  const end = bytes.indexOf('ENDHDR\n');
  if (!bytes.subarray(0, 3).equals(Buffer.from('P7\n')) || end < 0) throw new Error('Invalid PAM');
  const fields = Object.fromEntries(
    bytes
      .toString('ascii', 3, end)
      .trim()
      .split('\n')
      .map(line => line.split(' ')),
  );
  const width = Number(fields.WIDTH),
    height = Number(fields.HEIGHT);
  if (fields.DEPTH !== '4' || fields.MAXVAL !== '255' || !width || !height) throw new Error('Unsupported PAM');
  const pixels = bytes.subarray(end + 7);
  if (pixels.length !== width * height * 4) throw new Error('Invalid PAM');
  return { width, height, pixels };
}

/**
 * The largest change a person can see: each colour weighted by its alpha, as it is drawn, and the
 * alpha itself. Colour under (near) transparent pixels barely shows, so the encoder may drop it.
 */
export function largestError(png, decoded) {
  if (png.width !== decoded.width || png.height !== decoded.height) throw new Error('Size changed');
  let largest = 0;
  for (let i = 0, j = 0; j < decoded.pixels.length; i += png.channels, j += 4) {
    const before = png.channels === 4 ? png.pixels[i + 3] : 255,
      after = decoded.pixels[j + 3];
    largest = Math.max(largest, Math.abs(before - after));
    for (let c = 0; c < 3; c++)
      largest = Math.max(largest, Math.abs(png.pixels[i + c] * before - decoded.pixels[j + c] * after) / 255);
  }
  return Math.ceil(largest);
}
