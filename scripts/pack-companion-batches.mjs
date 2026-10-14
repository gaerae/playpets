// Packs separately generated high-detail rows into the unchanged v2 pet format.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dataUrlBytes, readDataUrl } from './art-lib.mjs';
import { atlasPoses, isolatePose } from './atlas-lib.mjs';
import { launchBrowser } from './browser-lib.mjs';
import { batchFrame, frameOrder, jumpLifts, rowScales } from './companion-batches-lib.mjs';

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
let settings = {};
try {
  settings = JSON.parse(await readFile(path.join(directory, 'pack-settings.json'), 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const scales = rowScales(settings);
const lifts = jumpLifts(settings);
const names = ['idle', 'right', 'left', 'wave', 'jump', 'error', 'waiting', 'working', 'done', 'look', 'look'];
const sources = await Promise.all(
  names.map((name, row) => readDataUrl(path.join(directory, `${String(row).padStart(2, '0')}-${name}.png`))),
);
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.addScriptTag({
    content: `window.atlasPoses = ${atlasPoses.toString()}; window.batchFrame = ${batchFrame.toString()}; window.isolatePose = ${isolatePose.toString()};`,
  });
  const result = await page.evaluate(
    async ({ sources, target, order, scales, lifts }) => {
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
          const lift =
            row === 4
              ? lifts
                ? lifts[column] / (scale * scales[row])
                : bottom - (pose.bottom - (sourceColumn >= 4 ? raw.height / 2 : 0))
              : 0;
          const frame = window.batchFrame(pose, row, column, scale * scales[row], lift);
          const { sx, sy, sw, sh, dx, dy, dw, dh } = frame;
          const isolated = document.createElement('canvas');
          isolated.width = sw;
          isolated.height = sh;
          isolated
            .getContext('2d')
            .putImageData(
              new ImageData(window.isolatePose(rgba, raw.width, pose.pixels, sx, sy, sw, sh), sw, sh),
              0,
              0,
            );
          ctx.drawImage(isolated, dx, dy, dw, dh);
          frames.push({ sourceColumn, width: dw, height: dh, lift: lift * scale * scales[row] });
        }
        stats.push({
          row,
          rowScale: scales[row],
          effectiveScale: scale * scales[row],
          source: [image.width, image.height],
          transparentFraction: transparent / (raw.width * raw.height),
          frames,
        });
      }
      return { png: canvas.toDataURL('image/png'), scale, stats };
    },
    { sources, target: Number(target), order, scales, lifts },
  );
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, dataUrlBytes(result.png));
  await writeFile(
    `${destination}.json`,
    `${JSON.stringify({ scale: result.scale, rowScales: scales, jumpLifts: lifts, rows: result.stats }, null, 2)}\n`,
  );
  console.log(`${destination}: 88 poses, shared scale ${result.scale.toFixed(4)}, idle silhouette ${target}px`);
} finally {
  await browser.close();
}
