import { readFile } from 'node:fs/promises';
import { PREVIEW_STATES, validatePreview } from './site-preview-lib.mjs';

// Validate all optional artwork before site preparation starts replacing public files.
export async function collectPreviewExports(pets, read = readFile) {
  const petPreviews = {},
    petSeasonalPreviews = {},
    copies = [];
  for (const pet of pets) {
    for (const season of [null, 'summer', 'winter']) {
      for (const state of PREVIEW_STATES) {
        const suffix = `${season ? `${season}/` : ''}${state}.png`;
        const source = `assets/pets/${pet.id}/preview/${suffix}`;
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
        copies.push({ source, destination: `website/public/pets/previews/${pet.id}/${suffix}` });
      }
    }
  }
  return { petPreviews, petSeasonalPreviews, copies };
}
