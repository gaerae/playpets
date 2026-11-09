// The yard's content (src/content/), loaded the way the page loads it, for tests of the rules that
// read it. Imported for its effect, before the modules under test are used.
import { readFileSync } from 'node:fs';
import { useCatalog } from '../../src/yard/catalog.js';
import { useEvents } from '../../src/yard/events.js';
import { useScenery } from '../../src/yard/layout.js';
import { useWorlds } from '../../src/yard/worlds.js';

const content = name => JSON.parse(readFileSync(new URL(`../../src/content/${name}.json`, import.meta.url), 'utf8'));
export const catalog = content('catalog');
export const yard = content('yard');
export const events = content('events');
export const worlds = content('worlds');
/** How many entries the album's books hold, all told (the hidden one aside). */
export const albumEntries = ['flowers', 'fish', 'bugs', 'gifts', 'trees', 'treasures', 'tracks'].reduce(
  (sum, book) => sum + catalog[book].length,
  0,
);
useCatalog(catalog);
useScenery(yard);
useEvents(events);
useWorlds(worlds);
