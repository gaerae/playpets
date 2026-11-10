import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dataUrlBytes } from './art-lib.mjs';
import { launchBrowser } from './browser-lib.mjs';
import { PREVIEW_STATES, PREVIEW_STRIP, validatePreview } from './site-preview-lib.mjs';

// Validate all optional artwork before site preparation starts replacing public files.
export async function collectPreviewExports(pets, read = readFile) {
  const petPreviews = {},
    petSeasonalPreviews = {},
    copies = [];
  for (const pet of pets) {
    for (const season of [null, 'summer', 'winter']) {
      for (const state of PREVIEW_STATES) {
        const suffix = `${season ? `${season}/` : ''}${state}`;
        const source = `assets/pets/${pet.id}/preview/${suffix}.png`;
        let bytes;
        try {
          bytes = await read(source);
        } catch (error) {
          if (error.code === 'ENOENT') continue;
          throw error;
        }
        validatePreview(bytes);
        if (season) petSeasonalPreviews[pet.id] ??= {};
        const available = season ? petSeasonalPreviews[pet.id] : petPreviews;
        const key = season || pet.id;
        available[key] ??= [];
        available[key].push(state);
        copies.push({ source, destination: `website/public/pets/previews/${pet.id}/${suffix}.webp` });
      }
    }
  }
  return { petPreviews, petSeasonalPreviews, copies };
}

// Writes each preview as a WebP at the size the site draws it (PREVIEW_STRIP). Returns false when
// there is no browser to encode them: the site then plays those rows from the whole atlas.
export async function exportPreviewStrips(copies, launch = launchBrowser) {
  let browser;
  try {
    browser = await launch();
  } catch (error) {
    console.warn(`Preview strips skipped: ${String(error.message).split('\n')[0]}`);
    return false;
  }
  try {
    const page = await browser.newPage();
    for (const { source, destination } of copies) {
      const png = `data:image/png;base64,${(await readFile(source)).toString('base64')}`;
      const webp = await page.evaluate(
        async ({ png, width, height, quality }) => {
          const image = new Image();
          image.src = png;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          context.imageSmoothingQuality = 'high';
          context.drawImage(image, 0, 0, width, height);
          return canvas.toDataURL('image/webp', quality);
        },
        { png, ...PREVIEW_STRIP },
      );
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, dataUrlBytes(webp));
    }
  } finally {
    await browser.close();
  }
  return true;
}
