// Assemble approved generated poses at twice the runtime resolution; never redraw them.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dataUrlBytes, readDataUrl } from './art-lib.mjs';
import { atlasPoses, isolatePose } from './atlas-lib.mjs';
import { launchBrowser } from './browser-lib.mjs';
import { batchFrame } from './companion-batches-lib.mjs';
import { PREVIEW_STATES, previewPacking, validatePreview } from './site-preview-lib.mjs';

const [source, idleReference, destination, state = 'idle', target = '163'] = process.argv.slice(2);
if (!source || !idleReference || !destination || !PREVIEW_STATES.includes(state) || !(Number(target) > 0))
  throw new Error(
    'Usage: pnpm run preview:pack -- source-row.png idle-row.png destination.png idle|wave|jump idle-height',
  );
let settings = {};
try {
  settings = JSON.parse(await readFile(path.join(path.dirname(source), 'pack-settings.json'), 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const packing = previewPacking(state, settings);
const sources = await Promise.all([source, idleReference].map(readDataUrl));
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.addScriptTag({
    content: `window.atlasPoses=${atlasPoses.toString()};window.isolatePose=${isolatePose.toString()};window.batchFrame=${batchFrame.toString()};`,
  });
  const png = await page.evaluate(
    async ({ sources, state, target, packing }) => {
      const loaded = await Promise.all(
        sources.map(async source => {
          const image = new Image();
          image.src = source;
          await image.decode();
          if (image.width !== 1536 || image.height !== 1024)
            throw new Error('Source rows must be 1536×1024 (four columns, two rows)');
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0);
          const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let transparent = 0;
          for (let i = 3; i < rgba.length; i += 4) if (rgba[i] === 0) transparent++;
          if (transparent < canvas.width * canvas.height * 0.1)
            throw new Error('Approved source needs true transparent gutters');
          const columns = window.atlasPoses(rgba, canvas.width, canvas.height, 4, 2);
          return { rgba, width: canvas.width, poses: [...columns.map(c => c[0]), ...columns.map(c => c[1])] };
        }),
      );
      const [source, idle] = loaded;
      const scale = (target / (idle.poses[0].bottom - idle.poses[0].top + 1)) * packing.scale;
      if (scale * 2 > 1.05)
        throw new Error('Source resolution is too small for a genuine 2× preview; regenerate larger poses');
      const canvas = document.createElement('canvas');
      canvas.width = 3072;
      canvas.height = 416;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      const bottom = Math.max(...source.poses.map((p, i) => p.bottom - (i >= 4 ? 512 : 0)));
      for (const [column, pose] of source.poses.entries()) {
        const lift = packing.lifts
          ? packing.lifts[column] / scale
          : state === 'jump'
            ? bottom - (pose.bottom - (column >= 4 ? 512 : 0))
            : 0;
        const { sx, sy, sw, sh, dx, dy, dw, dh } = window.batchFrame(pose, 0, column, scale, lift);
        const isolated = document.createElement('canvas');
        isolated.width = sw;
        isolated.height = sh;
        isolated
          .getContext('2d')
          .putImageData(
            new ImageData(window.isolatePose(source.rgba, source.width, pose.pixels, sx, sy, sw, sh), sw, sh),
            0,
            0,
          );
        ctx.drawImage(isolated, dx * 2, dy * 2, dw * 2, dh * 2);
      }
      return canvas.toDataURL('image/png');
    },
    { sources, state, target: Number(target), packing },
  );
  const bytes = dataUrlBytes(png);
  validatePreview(bytes);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
  console.log(`${destination}: 3072×416, eight approved high-resolution ${state} poses`);
} finally {
  await browser.close();
}
