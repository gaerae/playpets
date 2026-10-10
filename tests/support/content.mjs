// The yard's content (src/content/), loaded the way the page loads it, for tests of the rules that
// read it. Imported for its effect, before the modules under test are used.
import { readFileSync } from 'node:fs';
import { useCatalog } from '../../src/yard/catalog.js';
import { useScenery } from '../../src/yard/layout.js';

export const catalog = JSON.parse(readFileSync(new URL('../../src/content/catalog.json', import.meta.url), 'utf8'));
export const yard = JSON.parse(readFileSync(new URL('../../src/content/yard.json', import.meta.url), 'utf8'));
useCatalog(catalog);
useScenery(yard);
