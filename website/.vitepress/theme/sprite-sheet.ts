import { withBase } from 'vitepress';
import { previewSource } from '../../../scripts/site-preview-lib.mjs';
import generated from '../generated.json';

const published = generated as {
  petPreviews?: Record<string, string[]>;
  petSeasonalPreviews?: Record<string, Record<string, string[]>>;
  petMotions?: Record<string, Record<string, string[]>>;
};

// The file a sample pet plays one row from: a published one-row strip when there is one,
// otherwise the pet's whole atlas.
export function sheetFor(pet: string, state: string, season = 'base') {
  const preview = previewSource(
    pet,
    state,
    published.petPreviews,
    season,
    published.petSeasonalPreviews,
    published.petMotions,
  );
  return {
    url: withBase(preview || `/pets/${pet}.png`),
    strip: /^\/pets\/(previews|motion)\//.test(preview || ''),
  };
}
