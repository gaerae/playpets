import { readFile, writeFile } from 'node:fs/promises';
import { dataUrl, dataUrlBytes } from './art-lib.mjs';
import { launchBrowser } from './browser-lib.mjs';
import { normalizeCatRow } from './cat-row-normalize-lib.mjs';
import { sha256 } from './png-lossless-lib.mjs';

const [source, destination] = process.argv.slice(2);
if (!source || !destination || source === destination)
  throw new Error('Usage: node scripts/normalize-cat-row.mjs original.png normalized.png');
const bytes = await readFile(source);
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: `window.normalizeCatRow=${normalizeCatRow};` });
  const result = await page.evaluate(async url => {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const result = window.normalizeCatRow(
      ctx.getImageData(0, 0, canvas.width, canvas.height).data,
      canvas.width,
      canvas.height,
    );
    ctx.putImageData(new ImageData(result.rgba, canvas.width, canvas.height), 0, 0);
    return {
      png: canvas.toDataURL('image/png'),
      poses: result.poses.map(({ pixels, ...pose }) => ({ ...pose, pixelCount: pixels.length })),
    };
  }, dataUrl(bytes));
  const output = dataUrlBytes(result.png);
  await writeFile(destination, output);
  await writeFile(
    `${destination}.normalization.json`,
    `${JSON.stringify(
      {
        sourceSha256: sha256(bytes),
        normalizedSha256: sha256(output),
        method:
          "Eight alpha>24 silhouette components with the existing packer's two-pixel low-alpha fringe; integer horizontal translation only; retained RGBA pixels unchanged; no resampling or vertical translation.",
        poses: result.poses,
      },
      null,
      2,
    )}\n`,
  );
  console.log(destination);
} finally {
  await browser.close();
}
