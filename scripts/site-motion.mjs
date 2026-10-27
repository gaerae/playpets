// Cuts the rows the landing's moving scenes play out of each sample pet's runtime atlas, so a
// visitor downloads a small strip per row instead of the whole 1536×2288 sheet.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dataUrlBytes } from './art-lib.mjs';
import { launchBrowser } from './browser-lib.mjs';
import { MOTION_ROWS } from './site-preview-lib.mjs';

export function motionPlan(pets) {
  return pets.flatMap(pet =>
    ['base', 'summer', 'winter'].map(sheet => ({
      pet: pet.id,
      sheet,
      source: sheet === 'base' ? pet.source : `assets/pets/${pet.id}/seasonal/${sheet}.png`,
      rows: Object.fromEntries(
        Object.keys(MOTION_ROWS).map(state => [state, `website/public/pets/motion/${pet.id}/${sheet}/${state}.webp`]),
      ),
    })),
  );
}

// Returns which strips were written, as { pet: { sheet: [state] } } for generated.json. Without a
// browser the site still builds: the scenes then play these rows from the whole atlas.
export async function exportMotionStrips(pets, launch = launchBrowser) {
  let browser;
  try {
    browser = await launch();
  } catch (error) {
    console.warn(`Motion strips skipped: ${String(error.message).split('\n')[0]}`);
    return {};
  }
  const written = {};
  try {
    const page = await browser.newPage();
    for (const sheet of motionPlan(pets)) {
      const atlas = `data:image/png;base64,${(await readFile(sheet.source)).toString('base64')}`;
      const strips = await page.evaluate(
        async ({ atlas, rows }) => {
          const image = new Image();
          image.src = atlas;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = 1536;
          canvas.height = 208;
          const context = canvas.getContext('2d');
          return Object.fromEntries(
            Object.entries(rows).map(([state, row]) => {
              context.clearRect(0, 0, 1536, 208);
              context.drawImage(image, 0, row * 208, 1536, 208, 0, 0, 1536, 208);
              return [state, canvas.toDataURL('image/webp', 0.86)];
            }),
          );
        },
        { atlas, rows: MOTION_ROWS },
      );
      for (const [state, destination] of Object.entries(sheet.rows)) {
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, dataUrlBytes(strips[state]));
      }
      written[sheet.pet] = { ...written[sheet.pet], [sheet.sheet]: Object.keys(sheet.rows) };
    }
  } finally {
    await browser.close();
  }
  return written;
}
