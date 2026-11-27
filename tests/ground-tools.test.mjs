// Digging, a sapling and a seed are one kind of tool (yard/discovery.js, the seed's own rules in
// yard/garden.js): the spot under the pointer is marked the same way for each, the strip shows what is
// in hand to spend as a picture, a name and a count, and with none left it says where more come from
// and offers digging.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import './support/content.mjs';
import { element, installDom, installStorage, keepGlobals } from './support/dom.mjs';

const planted = [];
globalThis.playPets = {
  plant: async (...args) => {
    planted.push(args);
    return { ok: true, data: {} };
  },
};
const { setupDiscovery, beginDiscovery, cancelDiscovery, syncDiscovery } = await import('../src/yard/discovery.js');
const { renderGarden, setupGarden } = await import('../src/yard/garden.js');
const { setAimingMode } = await import('../src/yard/care.js');
const state = await import('../src/core/state.js');
const { setData, setSelected, views } = state;
const { measureYard } = await import('../src/yard/field.js');
const { release } = await import('../src/yard/trips.js');
const { useWorlds } = await import('../src/yard/worlds.js');
const { scene } = await import('../src/yard/world.js');
const { STAGES } = await import('../src/yard/catalog.js');
const { t: say } = await import('../src/core/i18n.js');
const page = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');

let wired = false;
function yard(t, garden, { soil = true } = {}) {
  let v;
  t.after(() => {
    if (v) release(v);
    views.clear();
    cancelDiscovery();
    setAimingMode(false);
  });
  installDom(t, { anyId: true });
  installStorage(t);
  keepGlobals(t, 'setTimeout', 'clearTimeout');
  globalThis.setTimeout = () => 0;
  globalThis.clearTimeout = () => {};
  document.getElementById('yard').getBoundingClientRect = () => ({ width: 1000, height: 700, left: 0, top: 0 });
  measureYard();
  useWorlds([{ id: 'woodland', capabilities: { soil, sky: true, fishing: false }, geometry: { fieldTop: 0.6 } }]);
  scene.world = 'woodland';
  scene.season = 'spring';
  const pet = { id: 'friend', size: 112, name: 'Clover' };
  v = {
    pet,
    asset: { place: 'folder', id: 'clover', sourceId: 'clover', hasActions: false },
    px: 200,
    py: 400,
    x: 0.2,
    y: 0.5,
    pose: 'idle',
    bubble: element('span'),
  };
  views.clear();
  views.set(pet.id, v);
  setData({
    pets: [pet],
    assets: [],
    garden: { plants: [], decor: [], trees: [], seeds: 0, saplings: {}, ...garden },
    album: { treasures: {} },
    statuses: {},
    busy: [],
  });
  setSelected(pet.id);
  planted.length = 0;
  wired = false;
  setupDiscovery();
  setupGarden();
  wired = true;
  const $ = id => document.getElementById(id);
  const point = (clientX, clientY) => ({ clientX, clientY, target: $('yard') });
  return {
    $,
    hover: (x, y) => $('yard').dispatch('pointermove', point(x, y)),
    click: (x, y) => $('yard').dispatch('click', point(x, y)),
  };
}
const look = $ => $('discovery-marker').querySelector('.marker-sapling');
const seedArt = () => STAGES.find(s => s.name === 'seed').art;

test('every ground tool marks the spot the same way, greyed where nothing can go', t => {
  const { $, hover } = yard(t, { saplings: { maple: 1 }, seeds: 2 });
  assert.ok(wired);
  beginDiscovery('dig');
  hover(500, 620);
  assert.equal($('discovery-marker').hidden, false);
  assert.equal($('discovery-marker').classList.contains('invalid'), false);
  assert.equal(look($).dataset.art, '', 'a dig puts nothing in the soil');
  hover(500, 40);
  assert.equal($('discovery-marker').classList.contains('invalid'), true, 'the sky is not ground');

  beginDiscovery('tree');
  hover(500, 620);
  assert.match(look($).dataset.art, /trees\//, 'the sapling in hand stands in the soil');

  document.getElementById('plant-tool').onclick({ detail: 1 });
  assert.equal(state.aiming, 'seed');
  hover(500, 620);
  assert.equal($('discovery-marker').hidden, false, 'a seed marks its spot as the others do');
  assert.equal($('discovery-marker').classList.contains('invalid'), false);
  assert.equal(look($).dataset.art, seedArt(), 'the seed shows as it will look planted');
  assert.match(look($).innerHTML, /<svg/);
  hover(500, 40);
  assert.equal($('discovery-marker').classList.contains('invalid'), true, 'nor is the sky for a seed');
});

test('the hand row shows a picture, a name and a count for the sapling and the seeds in hand', t => {
  const { $ } = yard(t, { saplings: { maple: 2 }, seeds: 3 });
  beginDiscovery('tree');
  assert.equal($('discovery-tree-picker').hidden, false);
  assert.match($('discovery-tree-picture').innerHTML, /<svg[^>]*>.*<\/svg>/, 'the sapling is drawn');
  assert.match($('discovery-tree-current').textContent, /2/);
  const maple = $('discovery-tree-choices').children.find(c => c.dataset.treeKind === 'maple');
  assert.match(maple.querySelector('.hand-picture').innerHTML, /<svg/, 'each sapling in the menu is drawn too');
  assert.equal($('discovery-seed-hand').hidden, true);

  $('plant-tool').onclick({ detail: 1 });
  assert.equal($('discovery-tree-picker').hidden, true);
  assert.equal($('discovery-seed-hand').hidden, false);
  // A planted seed is a speck at the row's size, so the row shows the seed packet the tool wears.
  assert.match(page, /id="discovery-seed-picture"[^>]*data-clue="seeds"/);
  assert.match($('discovery-seed-current').textContent, /3/);
  // The count is in the hand row, not again on the strip's seed tool.
  const seedTool = $('discovery-tools').children.find(b => b.dataset.tool === 'seed');
  assert.equal(seedTool.querySelector('.tool-count'), null);
  // Digging spends nothing, so nothing is in hand.
  beginDiscovery('dig');
  assert.equal($('discovery-tree-picker').hidden, true);
  assert.equal($('discovery-seed-hand').hidden, true);
  // A seed used elsewhere shows at once.
  $('plant-tool').onclick({ detail: 1 });
  state.data.garden.seeds = 1;
  syncDiscovery();
  assert.match($('discovery-seed-current').textContent, /1/);
});

test('with no seeds the seed tool says where seeds come from and offers digging, as the sapling tool does', async t => {
  const { $, click } = yard(t, { seeds: 0 });
  beginDiscovery('tree');
  assert.equal($('discovery-find').hidden, false);
  $('plant-tool').onclick({ detail: 1 });
  assert.equal(state.aiming, 'seed', 'the tool is in hand, as a tree is with no sapling');
  assert.equal($('discovery-target').hidden, false);
  assert.equal($('discovery-seed-hand').hidden, true);
  assert.equal($('discovery-find').hidden, false);
  assert.equal($('discovery-target-label').textContent, say('garden.no_seeds'));
  await click(500, 620);
  assert.equal(planted.length, 0);
  $('discovery-find').onclick();
  assert.equal(state.aiming, 'dig');
});

test('the last seed spent keeps the tool in hand, offering digging for more', async t => {
  const { $, click } = yard(t, { seeds: 1 });
  $('plant-tool').onclick({ detail: 1 });
  assert.equal($('discovery-find').hidden, true, 'with a seed in hand there is nothing to fetch');
  await click(500, 620);
  assert.equal(planted.length, 1);
  state.data.garden.seeds = 0;
  renderGarden();
  syncDiscovery();
  assert.equal(state.aiming, 'seed');
  assert.equal($('discovery-find').hidden, false);
});

// As a tree is refused when the yard has all it holds, a seed is refused when the field has: the
// marker greys, the press says why and plants nothing, and the tool is not taken up.
test('a full field greys the seed marker and says so, as a full yard of trees does', async t => {
  const plants = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, kind: 'tulip', x: 0.1, y: 0.9, planted: 0 }));
  const { $, hover, click } = yard(t, { seeds: 2, plants });
  $('plant-tool').onclick({ detail: 1 });
  assert.equal(state.aiming, false, 'not taken up with no room');
  setAimingMode('seed');
  hover(500, 620);
  assert.equal($('discovery-marker').classList.contains('invalid'), true);
  await click(500, 620);
  assert.equal(planted.length, 0);
});

// Indoors a seed goes in a pot and no friend can dig the floor: the marker shows the pot, and with no
// seeds the strip still says where seeds come from but offers no dig it would refuse.
test('indoors the seed marker stands in a pot and no dig is offered', t => {
  const { $, hover } = yard(t, { seeds: 0 }, { soil: false });
  $('plant-tool').onclick({ detail: 1 });
  assert.equal(state.aiming, 'seed');
  assert.equal($('discovery-target-label').textContent, say('garden.no_seeds'));
  assert.equal($('discovery-find').hidden, true);
  hover(500, 620);
  assert.equal($('discovery-marker').dataset.soil, 'none');
});
