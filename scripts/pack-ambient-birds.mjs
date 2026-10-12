import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { atlasPoses } from './atlas-lib.mjs';

// The generated original is provenance, kept outside the shipped art (assets/sources).
const out = fileURLToPath(new URL('../src/art/ambient', import.meta.url)),
  kept = fileURLToPath(new URL('../assets/sources/ambient/birds-source.png', import.meta.url)),
  source = process.argv[2] || kept;
await mkdir(out, { recursive: true });
const raw = await readFile(source),
  browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: `window.atlasPoses=${atlasPoses.toString()}` });
  const result = await page.evaluate(
    async data => {
      const image = new Image();
      image.src = data;
      await image.decode();
      const input = document.createElement('canvas');
      input.width = image.width;
      input.height = image.height;
      const ictx = input.getContext('2d');
      ictx.drawImage(image, 0, 0);
      const rgba = ictx.getImageData(0, 0, image.width, image.height).data;
      let zeros = 0;
      for (let i = 3; i < rgba.length; i += 4) if (rgba[i] === 0) zeros++;
      if (zeros / (image.width * image.height) < 0.1) throw Error('Source has no usable true alpha');
      const columns = window.atlasPoses(rgba, image.width, image.height, 3, 1);
      const canvas = document.createElement('canvas');
      canvas.width = 384;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      const bounds = [];
      for (let row = 0; row < 1; row++)
        for (let col = 0; col < 3; col++) {
          const p = columns[col][row],
            sx = Math.max(0, p.left - 2),
            sy = Math.max(0, p.top - 2),
            sw = Math.min(image.width - sx, p.right - p.left + 5),
            sh = Math.min(image.height - sy, p.bottom - p.top + 5);
          const isolated = document.createElement('canvas');
          isolated.width = sw;
          isolated.height = sh;
          const ic = isolated.getContext('2d'),
            pixels = ic.createImageData(sw, sh),
            mask = new Uint8Array(sw * sh);
          for (const at of p.pixels) {
            const x = (at % image.width) - sx,
              y = Math.floor(at / image.width) - sy;
            for (let dy = -2; dy <= 2; dy++)
              for (let dx = -2; dx <= 2; dx++) {
                const nx = x + dx,
                  ny = y + dy;
                if (nx >= 0 && ny >= 0 && nx < sw && ny < sh) mask[ny * sw + nx] = 1;
              }
          }
          for (let y = 0; y < sh; y++)
            for (let x = 0; x < sw; x++)
              if (mask[y * sw + x]) {
                const from = ((sy + y) * image.width + sx + x) * 4;
                pixels.data.set(rgba.subarray(from, from + 4), (y * sw + x) * 4);
              }
          ic.putImageData(pixels, 0, 0);
          const scale = 0.17,
            dw = sw * scale,
            dh = sh * scale;
          if (
            dw > 128 ||
            dh > 128 ||
            col * 128 + 64 + (sx - (col * 512 + 256)) * scale < col * 128 ||
            64 + (sy - 580) * scale < 0 ||
            col * 128 + 64 + (sx - (col * 512 + 256)) * scale + dw > (col + 1) * 128 ||
            64 + (sy - 580) * scale + dh > 128
          )
            throw Error('Bird silhouette clips its runtime cell');
          ctx.drawImage(isolated, col * 128 + 64 + (sx - (col * 512 + 256)) * scale, 64 + (sy - 580) * scale, dw, dh);
          bounds.push({
            row,
            col,
            sourceBounds: [sx, sy, sw, sh],
            scale,
            outputBounds: [col * 128 + 64 + (sx - (col * 512 + 256)) * scale, 64 + (sy - 580) * scale, dw, dh],
          });
        }
      return {
        png: canvas.toDataURL('image/png').split(',')[1],
        audit: {
          source: [image.width, image.height],
          trueAlphaFraction: zeros / (image.width * image.height),
          cells: bounds,
        },
      };
    },
    `data:image/png;base64,${raw.toString('base64')}`,
  );
  await writeFile(kept, raw);
  await writeFile(`${out}/birds.png`, Buffer.from(result.png, 'base64'));
  await writeFile(`${out}/birds.png.json`, `${JSON.stringify(result.audit, null, 2)}\n`);
  console.log(result.audit);
} finally {
  await browser.close();
}
