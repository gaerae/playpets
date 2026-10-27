import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PREVIEW_STATES, previewSource, validatePreview } from '../scripts/site-preview-lib.mjs';

test('high-resolution website animation is optional per pet and per state', () => {
  const available = { daisy: ['idle'], clover: ['idle', 'wave'] };
  assert.equal(previewSource('daisy', 'idle', available), '/pets/previews/daisy/idle.png');
  assert.equal(previewSource('daisy', 'wave', available), null);
  assert.equal(previewSource('pip', 'idle', available), null);
  assert.equal(previewSource('clover', 'wave', undefined), null);
  assert.deepEqual(PREVIEW_STATES, ['idle', 'wave', 'jump']);
});
test('a runtime atlas cannot be accidentally published as a high-resolution strip', async () => {
  assert.throws(() => validatePreview(Buffer.from('invalid')), /PNG header/);
  const atlas = await readFile('assets/pets/daisy/spritesheet.png');
  assert.throws(() => validatePreview(atlas), /384/);
});

test('all four official companions provide high-resolution idle, wave and jump strips', async () => {
  for (const pet of ['daisy', 'clover', 'pip', 'miso']) {
    for (const state of PREVIEW_STATES) {
      const bytes = await readFile(`assets/pets/${pet}/preview/${state}.png`);
      assert.doesNotThrow(() => validatePreview(bytes), `${pet}:${state}`);
    }
  }
});

test('preview packing shares canonical row corrections and authored jump heights', async () => {
  const { previewPacking } = await import('../scripts/site-preview-lib.mjs');
  const config = { rowScales: { 3: 0.95 }, jumpLifts: [0, 6, 22, 6, 0, 0, 14, 0] };
  assert.deepEqual(previewPacking('wave', config), { scale: 0.95, lifts: null });
  assert.deepEqual(previewPacking('jump', config), { scale: 1, lifts: config.jumpLifts });
  assert.deepEqual(previewPacking('idle'), { scale: 1, lifts: null });
  assert.throws(() => previewPacking('wave', { rowScales: { 3: 0 } }), /row scale/);
  assert.throws(() => previewPacking('jump', { jumpLifts: [0, 1] }), /jump lift/);
  assert.throws(() => previewPacking('unknown'), /preview state/);
});

test('every official companion provides genuine seasonal website strips', async () => {
  for (const pet of ['daisy', 'clover', 'pip', 'miso']) {
    for (const season of ['summer', 'winter']) {
      for (const state of PREVIEW_STATES) {
        const bytes = await readFile(`assets/pets/${pet}/preview/${season}/${state}.png`);
        assert.doesNotThrow(() => validatePreview(bytes), `${pet}:${season}:${state}`);
        assert.notDeepEqual(bytes, await readFile(`assets/pets/${pet}/preview/${state}.png`));
      }
    }
  }
});

test('preview export keeps seasonal paths separate and missing artwork out of metadata', async () => {
  const { collectPreviewExports } = await import('../scripts/site-preview-export.mjs');
  const png = await readFile('assets/pets/pip/preview/winter/idle.png');
  const available = new Set(['assets/pets/pip/preview/idle.png', 'assets/pets/pip/preview/winter/idle.png']);
  const read = async source => {
    if (available.has(source)) return png;
    throw Object.assign(new Error('missing fixture'), { code: 'ENOENT' });
  };
  const result = await collectPreviewExports([{ id: 'pip' }], read);
  assert.deepEqual(result.petPreviews, { pip: ['idle'] });
  assert.deepEqual(result.petSeasonalPreviews, { pip: { winter: ['idle'] } });
  assert.deepEqual(
    result.copies.map(copy => copy.destination),
    ['website/public/pets/previews/pip/idle.png', 'website/public/pets/previews/pip/winter/idle.png'],
  );
  const atlas = await readFile('assets/pets/pip/seasonal/winter.png');
  await assert.rejects(
    collectPreviewExports([{ id: 'pip' }], async () => atlas),
    /384/,
  );
  await assert.rejects(
    collectPreviewExports([{ id: 'pip' }], async () => {
      throw new Error('unreadable');
    }),
    /unreadable/,
  );
});

test('season previews preserve clothes when a high-resolution pose is unavailable', () => {
  const base = { miso: ['idle', 'wave', 'jump'], visitor: ['idle'] };
  const seasonal = { miso: { summer: ['idle'], winter: ['idle', 'wave', 'jump'] } };
  for (const state of PREVIEW_STATES)
    assert.equal(previewSource('miso', state, base, 'winter', seasonal), `/pets/previews/miso/winter/${state}.png`);
  assert.equal(previewSource('miso', 'wave', base, 'summer', seasonal), '/creator-kit/miso/summer.png');
  assert.equal(previewSource('pip', 'jump', base, 'winter', seasonal), '/creator-kit/pip/winter.png');
  for (const season of ['base', 'spring', 'autumn'])
    assert.equal(previewSource('miso', 'idle', base, season, seasonal), '/pets/previews/miso/idle.png');
  assert.equal(previewSource('visitor', 'idle', base, 'winter', seasonal), '/pets/previews/visitor/idle.png');
  assert.equal(previewSource('unknown', 'idle', base, 'winter', seasonal), null);
});

test('the world forwards its season through visibility loading and keeps canonical seasonal row geometry', async () => {
  const world = await readFile('website/.vitepress/theme/WorldPreview.vue', 'utf8');
  const visible = await readFile('website/.vitepress/theme/VisibleSprite.vue', 'utf8');
  const sprite = await readFile('website/.vitepress/theme/Sprite.vue', 'utf8');
  assert.match(world, /:season="\['spring', 'summer', 'autumn', 'winter'\]\[season\]"/);
  assert.match(visible, /:season="season"/);
  assert.match(sprite, /petSeasonalPreviews/);
  assert.match(sprite, /strip\.value \? '0' : String\(row\.value\.row\)/);
});

test('all four friends resolve all preview poses in each approved seasonal outfit', () => {
  for (const pet of ['daisy', 'clover', 'pip', 'miso']) {
    const available = { [pet]: PREVIEW_STATES };
    const seasonal = { [pet]: { summer: PREVIEW_STATES, winter: PREVIEW_STATES } };
    for (const season of ['summer', 'winter'])
      for (const state of PREVIEW_STATES)
        assert.equal(
          previewSource(pet, state, available, season, seasonal),
          `/pets/previews/${pet}/${season}/${state}.png`,
        );
  }
});

test('landing season fallback uses only the small cast inventory and matches shipped wardrobes', async () => {
  const { LANDING_PETS } = await import('../scripts/site-content.mjs');
  const source = await readFile('scripts/site-preview-lib.mjs', 'utf8');
  assert.doesNotMatch(source, /creator-specs/);
  for (const { id } of LANDING_PETS) {
    const pet = JSON.parse(await readFile(`assets/pets/${id}/pet.json`, 'utf8'));
    assert.deepEqual(Object.keys(pet.seasonalSpritesheets).sort(), ['summer', 'winter']);
    for (const season of Object.keys(pet.seasonalSpritesheets))
      assert.equal(previewSource(id, 'idle', {}, season, {}), `/creator-kit/${id}/${season}.png`);
  }
});

test('walking, agent and gaze rows use light motion strips cut from the runtime atlas', async () => {
  const { MOTION_ROWS } = await import('../scripts/site-preview-lib.mjs');
  assert.deepEqual(MOTION_ROWS, { right: 1, left: 2, waiting: 6, working: 7, done: 8, 'look-0': 9, 'look-1': 10 });
  const base = { daisy: ['idle'] };
  const motion = { daisy: { base: ['right', 'look-1'], winter: ['right'] } };
  assert.equal(previewSource('daisy', 'right', base, 'base', {}, motion), '/pets/motion/daisy/base/right.webp');
  assert.equal(previewSource('daisy', 'right', base, 'autumn', {}, motion), '/pets/motion/daisy/base/right.webp');
  assert.equal(previewSource('daisy', 'right', base, 'winter', {}, motion), '/pets/motion/daisy/winter/right.webp');
  // A missing strip falls back to the whole atlas, never to another season's clothes.
  assert.equal(previewSource('daisy', 'look-1', base, 'winter', {}, motion), '/creator-kit/daisy/winter.png');
  assert.equal(previewSource('daisy', 'left', base, 'base', {}, motion), null);
  assert.equal(previewSource('daisy', 'idle', base, 'base', {}, motion), '/pets/previews/daisy/idle.png');
});

test('the motion export plans every official companion, sheet and motion row', async () => {
  const { MOTION_ROWS } = await import('../scripts/site-preview-lib.mjs');
  const { motionPlan } = await import('../scripts/site-motion.mjs');
  const plan = motionPlan([{ id: 'pip', source: 'assets/pets/pip/spritesheet.png' }]);
  assert.deepEqual(
    plan.map(sheet => [sheet.sheet, sheet.source]),
    [
      ['base', 'assets/pets/pip/spritesheet.png'],
      ['summer', 'assets/pets/pip/seasonal/summer.png'],
      ['winter', 'assets/pets/pip/seasonal/winter.png'],
    ],
  );
  for (const sheet of plan) {
    assert.deepEqual(Object.keys(sheet.rows), Object.keys(MOTION_ROWS));
    assert.equal(sheet.rows.right, `website/public/pets/motion/pip/${sheet.sheet}/right.webp`);
  }
});
