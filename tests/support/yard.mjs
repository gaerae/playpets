// The yard the gift tests draw in: an 800 x 560 yard with the real drawings' sizes, a scene set
// for the test and put back after it, and a clock the test holds. Its after-hook empties the yard
// while that clock still runs, so no timer a drawing started outlives the test.
//
// state.js reads globalThis.playPets when it is first imported, so a test sets its fake first and
// then imports this file with `await import('./support/yard.mjs')`.
import { readFile } from 'node:fs/promises';
import { reduced } from '../../src/core/sprites.js';
import { setData, views } from '../../src/core/state.js';
import { loadArt } from '../../src/yard/art.js';
import { renderDecor, setupDecor } from '../../src/yard/decor.js';
import { measureYard } from '../../src/yard/field.js';
import { scene } from '../../src/yard/world.js';
import { installDom, installStorage } from './dom.mjs';

const empty = () => ({ garden: { decor: [], plants: [], trees: [], boxed: [] }, pets: [], assets: [] });

// The drawings' sizes, as the page reads them from their view boxes (art.js loadArt).
async function loadSizes(ctx, document, paths) {
  const defs = { append() {} };
  document.querySelector = selector => (selector === '#art defs' ? defs : null);
  globalThis.DOMParser = class {
    parseFromString(text) {
      const box = text.match(/viewBox="([^"]+)"/)[1];
      return {
        documentElement: {
          nodeName: 'svg',
          getAttribute: () => box,
          querySelectorAll: () => [],
          attributes: [],
          childNodes: [],
        },
      };
    }
  };
  globalThis.fetch = async path => ({
    ok: true,
    text: () => readFile(new URL(`../../src/${path}`, import.meta.url), 'utf8'),
  });
  ctx.after(() => {
    delete globalThis.DOMParser;
    delete globalThis.fetch;
  });
  await loadArt(paths);
}

/**
 * Draws a yard at `now` (ms) with `scene` values set, the drawings at `art` loaded, and `garden`
 * (merged over an empty one) and `pets` in the state. `drawn` is given to setupDecor; `setup` runs
 * after it, and `before({ document, storage, nodes })` just before the yard is drawn. Returns the
 * nodes by id, the document, the storage, and `shown()`: the gifts' buttons still in the yard.
 */
export async function drawYard(
  ctx,
  { now, scene: values = {}, art = [], garden = {}, pets = [], assets = [], drawn, setup, before } = {},
) {
  ctx.mock.timers.enable({ apis: ['setTimeout', 'Date'], now });
  const was = Object.fromEntries(Object.keys(values).map(key => [key, scene[key]]));
  Object.assign(scene, values);
  const motion = reduced.matches;
  ctx.after(() => {
    Object.assign(scene, was);
    reduced.matches = motion;
    views.clear();
    // The yard empties while this test's clock still runs, so no timer handle outlives it.
    setData(empty());
    renderDecor();
  });
  const { nodes, document } = installDom(ctx, { anyId: true, ids: ['yard', 'garden-layer', 'toast'] });
  // As index.html has it.
  document.getElementById('xmas-sleigh').hidden = true;
  await loadSizes(ctx, document, art);
  nodes.get('yard').getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 560 });
  const storage = installStorage(ctx);
  if (drawn) setupDecor({ drawn });
  setup?.();
  // What an earlier test drew goes first.
  setData(empty());
  renderDecor();
  setData({ ...empty(), garden: { ...empty().garden, ...garden }, pets, assets });
  measureYard();
  before?.({ document, storage, nodes });
  renderDecor();
  // remove() leaves a node in place, marked (support/dom.mjs).
  const shown = () => nodes.get('garden-layer').children.filter(b => !b.removed);
  return { nodes, document, storage, shown };
}
