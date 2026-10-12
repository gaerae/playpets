// Packs generated poses into the pet format without drawing new artwork.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dataUrl, dataUrlBytes } from './art-lib.mjs';
import { atlasPoses, isolatePose } from './atlas-lib.mjs';
import { launchBrowser } from './browser-lib.mjs';

const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw new Error('Usage: node scripts/pack-companion.mjs source.png destination.png');
const bytes = await readFile(source);
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.addScriptTag({
    content: `window.atlasPoses = ${atlasPoses.toString()}; window.isolatePose = ${isolatePose.toString()};`,
  });
  const result = await page.evaluate(async url => {
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
        const isolated = window.isolatePose(rgba, raw.width, c.pixels, left, top, width, height);
        pose.getContext('2d').putImageData(new ImageData(isolated, width, height), 0, 0);
        const dx = column * 192 + (192 - width * scale) / 2;
        const dy = row * 208 + 200 - height * scale - (row === 4 ? (floor - c.bottom) * scale : 0);
        ctx.drawImage(pose, dx, dy, width * scale, height * scale);
      }
    }
    return canvas.toDataURL('image/png');
  }, dataUrl(bytes));
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, dataUrlBytes(result));
  console.log(`${destination}: isolated 88 complete poses`);
} finally {
  await browser.close();
}
