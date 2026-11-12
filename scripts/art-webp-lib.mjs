// The yard's raster art is reviewed as lossless PNG in assets/art and ships as near-lossless WebP in
// src/art, which the app embeds; the built-in friends' sheets ship as lossless WebP. This keeps
// each export in step with its PNG without an encoder in tests or CI.
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

// The place gallery's cards (src/yard/background-ui.js) show each place's summer daylight backdrop
// at about card size; decoding four 1536 × 1024 backdrops for that cost more than the cards show.
// These exports also ship as small lossy copies, PREVIEW_WIDTH wide, beside their full WebP.
export const PREVIEWS = [
  'environments/green.png',
  'environments/courtyard-green.png',
  'environments/lakeside-green.png',
  'environments/workshop.png',
];
export const PREVIEW_WIDTH = 400;
export const PREVIEW_QUALITY = 82;
/** `environments/green.png` → `environments/previews/green.webp` (relative to src/art). */
export const previewName = name => name.replace(/([^/]+)\.png$/, 'previews/$1.webp');
/** A preview's height for an export `width` × `height`, as cwebp scales it. */
export const previewHeight = (width, height) => Math.round((PREVIEW_WIDTH * height) / width);

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

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

export const readManifest = (root = '.') => readJson(path.join(root, MANIFEST));

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
  // A preview is recorded under its own WebP name, with the hash of the export it was made from.
  for (const name of PREVIEWS.filter(preview => pngs.includes(preview))) {
    const target = previewName(name),
      record = manifest[target],
      png = await readFile(path.join(root, EXPORTS, name));
    expected.add(target);
    let webp;
    try {
      webp = await readFile(path.join(root, RUNTIME, target));
    } catch {
      problems.push(`${RUNTIME}/${target} is missing`);
      continue;
    }
    const [width, height] = imageSize(png, 'png');
    if (!record || record.png !== sha256(png)) problems.push(`${EXPORTS}/${name} changed after its preview was made`);
    else if (record.webp !== sha256(webp)) problems.push(`${RUNTIME}/${target} is not the recorded preview`);
    else if (imageSize(webp, 'webp').join('x') !== `${PREVIEW_WIDTH}x${previewHeight(width, height)}`)
      problems.push(`${RUNTIME}/${target} is not ${PREVIEW_WIDTH} pixels wide`);
  }
  for (const name of webps) if (!expected.has(name)) problems.push(`${RUNTIME}/${name} has no PNG in ${EXPORTS}`);
  for (const name of Object.keys(manifest))
    if (!pngs.includes(name) && !expected.has(name)) problems.push(`${MANIFEST} names ${name}, which is gone`);
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

// The built-in friends' sheets ship losslessly: every pixel, colour under transparency included,
// is the accepted sheet's. builtin.rs embeds the copies in src-tauri/pets, outside the webview's src/.
export const BUILTIN_SOURCE = 'assets/pets';
export const BUILTIN_RUNTIME = 'src-tauri/pets';
export const BUILTIN_MANIFEST = `${BUILTIN_SOURCE}/webp.json`;
export const BUILTIN_LIST = 'src-tauri/src/pets/builtin.rs';

/** The friends builtin.rs embeds, in shelf order, with the files it names beside pet.json. */
export async function builtinPets(root = '.') {
  const text = await readFile(path.join(root, BUILTIN_LIST), 'utf8');
  return [...text.matchAll(/\bpet!\(\s*"([\w-]+)"((?:\s*,\s*"[^"]+")*)\s*,?\s*\)/g)].map(([, id, files]) => ({
    id,
    files: [...files.matchAll(/"([^"]+)"/g)].map(([, file]) => file),
  }));
}

// Codex pet manifests name files in `…Path` strings and `…Spritesheets` maps.
const sheetFields = manifest =>
  Object.entries(manifest).flatMap(([key, value]) =>
    key.endsWith('Path') && typeof value === 'string'
      ? [[manifest, key]]
      : key.endsWith('Spritesheets') && value && typeof value === 'object'
        ? Object.keys(value)
            .filter(name => typeof value[name] === 'string')
            .map(name => [value, name])
        : [],
  );

/** The PNG sheets an accepted pet.json names, relative to its folder. */
export const builtinSheets = text =>
  sheetFields(JSON.parse(text))
    .map(([object, key]) => object[key])
    .filter(file => file.endsWith('.png'));

/** The shipped pet.json: the accepted one with its sheets named as WebP. */
export function builtinManifest(text) {
  const manifest = JSON.parse(text);
  for (const [object, key] of sheetFields(manifest)) object[key] = object[key].replace(/\.png$/, '.webp');
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export const readBuiltinRecords = (root = '.') => readJson(path.join(root, BUILTIN_MANIFEST));

/** Every file each built-in friend ships: its pet.json and the WebP of each sheet it names. */
export async function builtinExports(root = '.') {
  return Promise.all(
    (await builtinPets(root)).map(async pet => {
      const source = await readFile(path.join(root, BUILTIN_SOURCE, pet.id, 'pet.json'), 'utf8');
      return { ...pet, source, sheets: builtinSheets(source) };
    }),
  );
}

/**
 * What would make a built-in friend ship something other than its accepted art: a sheet changed
 * after its WebP was made, a WebP missing or edited, a stale pet.json, a file builtin.rs does not
 * embed, or a leftover file or folder the app no longer carries.
 */
export async function builtinWebpProblems(root = '.') {
  const [pets, records] = await Promise.all([builtinExports(root), readBuiltinRecords(root)]);
  const problems = [],
    expected = new Set();
  for (const pet of pets) {
    const folder = `${BUILTIN_RUNTIME}/${pet.id}`,
      ships = pet.sheets.map(webpName);
    const shipped = await readFile(path.join(root, folder, 'pet.json'), 'utf8').catch(() => null);
    if (shipped !== builtinManifest(pet.source))
      problems.push(`${folder}/pet.json is not made from ${BUILTIN_SOURCE}/${pet.id}/pet.json`);
    for (const sheet of pet.sheets) {
      const name = `${pet.id}/${sheet}`,
        record = records[name],
        png = await readFile(path.join(root, BUILTIN_SOURCE, name));
      expected.add(name);
      let webp;
      try {
        webp = await readFile(path.join(root, BUILTIN_RUNTIME, webpName(name)));
      } catch {
        problems.push(`${BUILTIN_RUNTIME}/${webpName(name)} is missing`);
        continue;
      }
      if (!record || record.png !== sha256(png))
        problems.push(`${BUILTIN_SOURCE}/${name} changed after its WebP was made`);
      else if (record.webp !== sha256(webp))
        problems.push(`${BUILTIN_RUNTIME}/${webpName(name)} is not the recorded WebP`);
      else if (imageSize(png, 'png').join('x') !== imageSize(webp, 'webp').join('x'))
        problems.push(`${BUILTIN_RUNTIME}/${webpName(name)} has another size than its PNG`);
    }
    for (const file of await filesIn(path.join(root, folder), ''))
      if (file !== 'pet.json' && !ships.includes(file))
        problems.push(`${folder}/${file} is not made from ${BUILTIN_SOURCE}/${pet.id}`);
    if (pet.files.join(', ') !== ships.join(', '))
      problems.push(`${BUILTIN_LIST} embeds ${pet.id} as ${pet.files.join(', ')}, not ${ships.join(', ')}`);
  }
  const ids = pets.map(pet => pet.id);
  for (const entry of await readdir(path.join(root, BUILTIN_RUNTIME)).catch(() => []))
    if (!ids.includes(entry)) problems.push(`${BUILTIN_RUNTIME}/${entry} is not a built-in friend in ${BUILTIN_LIST}`);
  for (const name of Object.keys(records))
    if (!expected.has(name)) problems.push(`${BUILTIN_MANIFEST} names ${name}, which is gone`);
  return problems;
}

/** Whether a decoded WebP holds exactly the PNG's samples, an opaque PNG read as alpha 255. */
export function exactPixels(png, decoded) {
  if (png.width !== decoded.width || png.height !== decoded.height) return false;
  if (png.channels === 4) return Buffer.from(png.pixels).equals(decoded.pixels);
  for (let i = 0, j = 0; j < decoded.pixels.length; i += png.channels, j += 4)
    for (let c = 0; c < 4; c++) if ((c < 3 ? png.pixels[i + c] : 255) !== decoded.pixels[j + c]) return false;
  return true;
}
