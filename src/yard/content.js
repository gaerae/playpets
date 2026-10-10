// What the yard is made of, apart from its code: the catalogue (src/content/catalog.json: what
// grows, comes and is caught), the scenery's composition (src/content/yard.json: where the hills,
// the lake and the trees are, and what paints each part), the seasonal events
// (src/content/events.json) and the drawings (src/art/). Loaded once
// at start, before anything is drawn. To change what is in the yard, change those files.
// How: docs/how-to/add-to-the-yard.md.
import { loadArt } from './art.js';
import { artOf, useCatalog } from './catalog.js';
import { useEvents } from './events.js';
import { useScenery } from './layout.js';

/** Loads the catalogue, the scenery and the drawings. */
export async function loadContent() {
  const [catalog, yard, events] = await Promise.all(
    ['content/catalog.json', 'content/yard.json', 'content/events.json'].map(path => fetch(path).then(r => r.json())),
  );
  useCatalog(catalog);
  useScenery(yard);
  useEvents(events);
  await loadArt(artOf(catalog, events));
}
