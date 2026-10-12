// Isolate generated growth silhouettes while preserving their shared ground and scale.
import { writeFile } from 'node:fs/promises';
import { dataUrlBytes, readDataUrl } from './art-lib.mjs';
import { atlasPoses } from './atlas-lib.mjs';
import { launchBrowser } from './browser-lib.mjs';

const [source, destination = 'src/art/plants/growth.png'] = process.argv.slice(2);
if (!source) throw new Error('Usage: node scripts/pack-growth.mjs generated-source.png destination.png');
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: `window.atlasPoses = ${atlasPoses.toString()}` });
  const result = await page.evaluate(
    async url => {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (image.width !== 1536 || image.height !== 1024) throw new Error('Expected a 1536-by-1024 growth source');
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const raw = context.getImageData(0, 0, canvas.width, canvas.height);
      const poses = window.atlasPoses(raw.data, canvas.width, canvas.height, 4, 1).flat();
      const mask = new Uint8Array(canvas.width * canvas.height);
      for (const pose of poses)
        for (const at of pose.pixels) {
          const px = at % canvas.width,
            py = Math.floor(at / canvas.width);
          for (let y = Math.max(0, py - 2); y <= Math.min(canvas.height - 1, py + 2); y++)
            for (let x = Math.max(pose.column * 384, px - 2); x <= Math.min((pose.column + 1) * 384 - 1, px + 2); x++)
              mask[y * canvas.width + x] = 1;
        }
      const packed = context.createImageData(canvas.width, canvas.height);
      for (let at = 0; at < mask.length; at++)
        if (mask[at]) packed.data.set(raw.data.subarray(at * 4, at * 4 + 4), at * 4);
      context.putImageData(packed, 0, 0);
      return canvas.toDataURL('image/png');
    },
    await readDataUrl(source),
  );
  await writeFile(destination, dataUrlBytes(result));
} finally {
  await browser.close();
}
