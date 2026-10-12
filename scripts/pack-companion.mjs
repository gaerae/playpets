// Packs generated poses into the pet format without drawing new artwork.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { atlasPoses } from './atlas-lib.mjs';

const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw new Error('Usage: node scripts/pack-companion.mjs source.png destination.png');
const bytes = await readFile(source);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: `window.atlasPoses = ${atlasPoses.toString()}` });
  const result = await page.evaluate(
    async url => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const raw = document.createElement('canvas');
      raw.width = image.width;
      raw.height = image.height;
      const sourceContext = raw.getContext('2d');
      sourceContext.drawImage(image, 0, 0);
      const rgba = sourceContext.getImageData(0, 0, raw.width, raw.height).data;
      const columns = window.atlasPoses(rgba, raw.width, raw.height);
      const all = columns.flat();
      const scale = Math.min(
        174 / Math.max(...all.map(c => c.right - c.left + 5)),
        186 / Math.max(...all.map(c => c.bottom - c.top + 5)),
      );
      const canvas = document.createElement('canvas');
      canvas.width = 1536;
      canvas.height = 2288;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      for (let row = 0; row < 11; row++) {
        const floor = Math.max(...columns.map(c => c[row].bottom));
        for (let column = 0; column < 8; column++) {
          const c = columns[column][row];
          const left = Math.max(0, c.left - 2),
            top = Math.max(0, c.top - 2);
          const width = c.right - left + 3,
            height = c.bottom - top + 3;
          const pose = document.createElement('canvas');
          pose.width = width;
          pose.height = height;
          const poseContext = pose.getContext('2d');
          const mask = new Uint8Array(width * height);
          for (const at of c.pixels) {
            const px = (at % raw.width) - left,
              py = Math.floor(at / raw.width) - top;
            for (let dy = -2; dy <= 2; dy++)
              for (let dx = -2; dx <= 2; dx++) {
                const x = px + dx,
                  y = py + dy;
                if (x >= 0 && x < width && y >= 0 && y < height) mask[y * width + x] = 1;
              }
          }
          const pixels = poseContext.createImageData(width, height);
          for (let y = 0; y < height; y++)
            for (let x = 0; x < width; x++) {
              if (!mask[y * width + x]) continue;
              const from = ((top + y) * raw.width + left + x) * 4;
              const to = (y * width + x) * 4;
              pixels.data.set(rgba.subarray(from, from + 4), to);
            }
          poseContext.putImageData(pixels, 0, 0);
          const dx = column * 192 + (192 - width * scale) / 2;
          const dy = row * 208 + 200 - height * scale - (row === 4 ? (floor - c.bottom) * scale : 0);
          ctx.drawImage(pose, dx, dy, width * scale, height * scale);
        }
      }
      return canvas.toDataURL('image/png').split(',')[1];
    },
    `data:image/png;base64,${bytes.toString('base64')}`,
  );
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(result, 'base64'));
  console.log(`${destination}: isolated 88 complete poses`);
} finally {
  await browser.close();
}
