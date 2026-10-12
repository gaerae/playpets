// Crops generated layers; painting and animation stay in the app.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/pack-sky.mjs source.png');
const bytes = await readFile(source);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  const layers = await page.evaluate(
    async url => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const regions = {
        cumulus: [0, 105, 512, 295],
        wisps: [520, 100, 500, 280],
        small: [1050, 156, 475, 226],
        overcast: [1040, 554, 490, 370],
        sun: [155, 629, 214, 214],
        moon: [610, 571, 315, 315],
      };
      return Object.fromEntries(
        Object.entries(regions).map(([name, [x, y, w, h]]) => {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(image, x, y, w, h, 0, 0, w, h);
          return [name, canvas.toDataURL('image/png').split(',')[1]];
        }),
      );
    },
    `data:image/png;base64,${bytes.toString('base64')}`,
  );
  await mkdir('src/art/sky', { recursive: true });
  for (const [name, data] of Object.entries(layers))
    await writeFile(`src/art/sky/${name}.png`, Buffer.from(data, 'base64'));
} finally {
  await browser.close();
}
