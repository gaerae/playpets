// Keepsake sheets ship only what their drawings cut: a cell nobody draws (an old drawing that was
// redrawn elsewhere, a spare one the generator made) is cleared to 0,0,0,0, so it costs almost
// nothing in the WebP the app carries. The packers call this after writing their wrappers.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { decodePng, encodePng, inspectPng } from './png-lossless-lib.mjs';

const RUNTIME = 'src/art',
  EXPORTS = 'assets/art';

async function svgs(folder) {
  const entries = await readdir(folder, { withFileTypes: true });
  const found = await Promise.all(
    entries.map(entry => {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) return svgs(file);
      return entry.name.endsWith('.svg') ? [file] : [];
    }),
  );
  return found.flat();
}

/** Every rectangle cut from each sheet (named as the page names it, `discovery/finds.webp`). */
export async function sheetCuts(root = '.') {
  const cuts = new Map();
  for (const file of await svgs(path.join(root, RUNTIME))) {
    const text = await readFile(file, 'utf8');
    for (const image of text.matchAll(/<image[^>]*\shref="art\/([^"]+\.webp)"/g)) {
      const rect = text.match(/<clipPath[^>]*><rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"\/>/);
      const viewBox = text.match(/<svg[^>]*\swidth="[^"]+"[^>]*\sviewBox="([^"]+)"/);
      const cut = (rect ? rect.slice(1) : viewBox?.[1].split(/\s+/))?.map(Number);
      if (!cut) continue;
      cuts.set(image[1], [...(cuts.get(image[1]) ?? []), cut]);
    }
  }
  return cuts;
}

/** The sheets keepsakes are cut from, by their wrappers in the catalogue. */
export async function keepsakeSheets(root = '.') {
  const catalog = JSON.parse(await readFile(path.join(root, 'src/content/catalog.json'), 'utf8'));
  const sheets = new Set();
  for (const { art } of catalog.treasures) {
    const text = await readFile(path.join(root, RUNTIME, art), 'utf8');
    const sheet = text.match(/<image[^>]*\shref="art\/([^"]+\.webp)"/)?.[1];
    if (sheet) sheets.add(sheet);
  }
  return sheets;
}

/** Clears every sample outside `cuts`; the same bytes back when there is nothing to clear. */
export function trimPng(bytes, cuts) {
  const { width, height, channels, pixels } = decodePng(bytes);
  if (channels !== 4) throw new Error('A keepsake sheet must be RGBA');
  const kept = new Uint8Array(width * height);
  for (const [x, y, w, h] of cuts)
    for (let row = Math.max(0, Math.floor(y)); row < Math.min(height, Math.ceil(y + h)); row++)
      kept.fill(1, row * width + Math.max(0, Math.floor(x)), row * width + Math.min(width, Math.ceil(x + w)));
  let cleared = 0;
  for (let i = 0; i < kept.length; i++)
    if (!kept[i] && (pixels[i * 4] || pixels[i * 4 + 1] || pixels[i * 4 + 2] || pixels[i * 4 + 3])) {
      pixels.fill(0, i * 4, i * 4 + 4);
      cleared++;
    }
  return cleared ? encodePng(width, height, pixels) : bytes;
}

/** Trims the keepsake sheets among `owned` (export names, `discovery/finds.png`) in place. */
export async function trimKeepsakeSheets(owned, root = '.') {
  const [cuts, sheets] = await Promise.all([sheetCuts(root), keepsakeSheets(root)]);
  const trimmed = [];
  for (const name of owned) {
    const sheet = name.replace(/\.png$/, '.webp');
    if (!sheets.has(sheet)) continue;
    const file = path.join(root, EXPORTS, name),
      before = await readFile(file),
      after = trimPng(before, cuts.get(sheet) ?? []);
    if (after === before) continue;
    await writeFile(file, after);
    trimmed.push(name);
  }
  return trimmed;
}

/**
 * Puts `previous` back at `file` when it holds the same pixels, so a sheet made smaller since
 * (`pnpm run assets:optimize`) is not rewritten by the next pack.
 */
export async function keepIfSamePixels(file, previous) {
  if (!previous) return;
  const current = await readFile(file);
  if (current.equals(previous)) return;
  const [before, after] = [inspectPng(previous), inspectPng(current)];
  if (before.header === after.header && before.pixelSha256 === after.pixelSha256) await writeFile(file, previous);
}
