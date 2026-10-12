// Packs separately generated high-detail rows into the unchanged v2 pet format.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { atlasPoses } from './atlas-lib.mjs';
import { batchFrame, frameOrder } from './companion-batches-lib.mjs';

const [directory, destination, target = '163'] = process.argv.slice(2);
if (!directory || !destination || !(Number(target) > 0))
  throw new Error('Usage: node scripts/pack-companion-batches.mjs source-directory destination.png idle-height');
let mapping = {};
try {
  mapping = JSON.parse(await readFile(path.join(directory, 'frame-map.json'), 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const order = frameOrder(mapping);
const names = ['idle', 'right', 'left', 'wave', 'jump', 'error', 'waiting', 'working', 'done', 'look', 'look'];
const sources = await Promise.all(
  names.map(
    async (name, row) =>
      `data:image/png;base64,${(await readFile(path.join(directory, `${String(row).padStart(2, '0')}-${name}.png`))).toString('base64')}`,
  ),
);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.addScriptTag({
    content: `window.atlasPoses = ${atlasPoses.toString()}; window.batchFrame = ${batchFrame.toString()};`,
  });
  const result = await page.evaluate(
    async ({ sources, target, order }) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1536;
      canvas.height = 2288;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      const stats = [];
      let scale;
      for (const [row, source] of sources.entries()) {
        const image = new Image();
        image.src = source;
        await image.decode();
        const raw = document.createElement('canvas');
        raw.width = image.width;
        raw.height = image.height;
        const rawContext = raw.getContext('2d');
        rawContext.drawImage(image, 0, 0);
        const rgba = rawContext.getImageData(0, 0, raw.width, raw.height).data;
        let transparent = 0;
        for (let i = 3; i < rgba.length; i += 4) if (rgba[i] === 0) transparent++;
        if (transparent < raw.width * raw.height * 0.1) throw new Error(`Row ${row} needs true transparent gutters`);
        const columns = window.atlasPoses(rgba, raw.width, raw.height, 4, 2);
        const poses = [...columns.map(c => c[0]), ...columns.map(c => c[1])];
        if (row === 0) scale = target / (poses[0].bottom - poses[0].top + 1);
        const bottom = Math.max(...poses.map((p, i) => p.bottom - (i >= 4 ? raw.height / 2 : 0)));
        const frames = [];
        for (const [column, sourceColumn] of order[row].entries()) {
          const pose = poses[sourceColumn];
          const lift = row === 4 ? bottom - (pose.bottom - (sourceColumn >= 4 ? raw.height / 2 : 0)) : 0;
          const frame = window.batchFrame(pose, row, column, scale, lift);
          const { sx, sy, sw, sh, dx, dy, dw, dh } = frame;
          const isolated = document.createElement('canvas');
          isolated.width = sw;
          isolated.height = sh;
          const isolatedContext = isolated.getContext('2d');
          const pixels = isolatedContext.createImageData(sw, sh),
            mask = new Uint8Array(sw * sh);
          for (const at of pose.pixels) {
            const px = (at % raw.width) - sx,
              py = Math.floor(at / raw.width) - sy;
            for (let y = Math.max(0, py - 2); y <= Math.min(sh - 1, py + 2); y++)
              for (let x = Math.max(0, px - 2); x <= Math.min(sw - 1, px + 2); x++) mask[y * sw + x] = 1;
          }
          for (let y = 0; y < sh; y++)
            for (let x = 0; x < sw; x++) {
              if (!mask[y * sw + x]) continue;
              const from = ((sy + y) * raw.width + sx + x) * 4;
              pixels.data.set(rgba.subarray(from, from + 4), (y * sw + x) * 4);
            }
          isolatedContext.putImageData(pixels, 0, 0);
          ctx.drawImage(isolated, dx, dy, dw, dh);
          frames.push({ sourceColumn, width: dw, height: dh, lift: lift * scale });
        }
        stats.push({
          row,
          source: [image.width, image.height],
          transparentFraction: transparent / (raw.width * raw.height),
          frames,
        });
      }
      return { png: canvas.toDataURL('image/png').split(',')[1], scale, stats };
    },
    { sources, target: Number(target), order },
  );
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(result.png, 'base64'));
  await writeFile(`${destination}.json`, `${JSON.stringify({ scale: result.scale, rows: result.stats }, null, 2)}\n`);
  console.log(`${destination}: 88 poses, shared scale ${result.scale.toFixed(4)}, idle silhouette ${target}px`);
} finally {
  await browser.close();
}
