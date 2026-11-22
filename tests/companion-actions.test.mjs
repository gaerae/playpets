import assert from 'node:assert/strict';
import test from 'node:test';

// The backend's bridge: petActions answers what each test puts here.
const bridge = (globalThis.playPets = {});
const {
  actionGroundOffset,
  beginCompanionAction,
  clearCompanionAction,
  companionAction,
  setCompanionSeason,
  useCompanionActions,
} = await import('../src/core/companion-actions.js');

test('authored ground contact uses the rendered cell scale instead of centering the tool under the feet', () => {
  assert.deepEqual(actionGroundOffset({ anchor: [96, 199], ground: [168, 199] }, 96, 104), { x: 36, y: 0 });
  assert.deepEqual(actionGroundOffset({}, 96, 104), { x: 0, y: 0 });
  assert.deepEqual(actionGroundOffset({ anchor: [91, 199], ground: [168, 199] }, 96, 104), { x: 36, y: 0 });
  assert.deepEqual(actionGroundOffset({ ground: [Infinity, 200] }, 96, 104), { x: 0, y: 0 });
});

const clip = {
  url: 'art/companions/clover/dig.png',
  anchor: [96, 200],
  scale: 0.75,
  heldTool: true,
  frames: [
    { rect: [0, 0, 256, 288], foot: [128, 270], duration: 300 },
    { rect: [256, 0, 256, 288], foot: [130, 272], duration: 450 },
  ],
};
const view = (place = 'builtin', id = 'playpets-clover', more = {}) => ({
  asset: {
    place,
    sourceId: id,
    id,
    hasActions: true,
    spriteUrl: 'base.png',
    seasonalSpriteUrls: { summer: 'summer.png' },
    ...more,
  },
});
const posesOf = (outfits, id = 'playpets-clover') => useCompanionActions(id, { version: 1, outfits });
function seed() {
  posesOf({ base: { dig: clip }, summer: { wait: clip } });
  setCompanionSeason('spring');
}

test('a pet with poses plays them wherever it came from, and others keep their sheet', () => {
  seed();
  posesOf({ base: { dig: clip } }, 'made-in-the-kit');
  const made = view('folder', 'made-in-the-kit');
  assert.equal(beginCompanionAction(made, 'dig', 10).duration, 750, 'a pet made in the creator kit');
  assert.equal(beginCompanionAction(view('folder', 'made-in-the-kit', { hasActions: false }), 'dig', 10), null);
  assert.equal(beginCompanionAction(view('folder', 'made-in-the-kit', { spriteStyle: 'realistic' }), 'dig', 10), null);
  const v = view();
  assert.equal(beginCompanionAction(v, 'dig', 10).duration, 750);
  assert.deepEqual(companionAction(v, 310).frame.rect, [256, 0, 256, 288]);
  assert.equal(companionAction(v, 761), null);
});
test('season changes cancel an action rather than changing the companion outfit', () => {
  seed();
  const v = view();
  beginCompanionAction(v, 'dig', 0);
  setCompanionSeason('summer');
  assert.equal(companionAction(v, 20), null);
  assert.equal(beginCompanionAction(v, 'dig', 20), null, "summer's own outfit has no dig, so no base clothes either");
  assert.ok(beginCompanionAction(v, 'wait', 20), "summer's own clip");
});

test('a season without its own outfit plays the base poses', () => {
  seed();
  for (const season of ['spring', 'autumn', 'winter']) {
    setCompanionSeason(season);
    assert.equal(beginCompanionAction(view(), 'dig', 0)?.clip, clip, season);
  }
});
test('cancelled clips cannot continue after the friend is taken away', () => {
  seed();
  const v = view();
  beginCompanionAction(v, 'dig', 0);
  clearCompanionAction(v);
  assert.equal(companionAction(v, 20), null);
});
test('looping waits repeat while one-shot actions keep their own start clock', () => {
  seed();
  posesOf({ base: { wait: { ...clip, loop: true } } });
  const v = view();
  beginCompanionAction(v, 'wait', 100);
  assert.deepEqual(companionAction(v, 1150).frame.rect, [256, 0, 256, 288]);
});

test('authored frame draws once with its foot anchor and falls back until the atlas is decoded', async () => {
  const { drawSprite, setSpriteSeason, reduced } = await import('../src/core/sprites.js');
  const original = globalThis.Image;
  const loaded = [];
  globalThis.Image = class {
    constructor() {
      this.complete = false;
      this.naturalWidth = 0;
      loaded.push(this);
    }
  };
  try {
    seed();
    setSpriteSeason('spring');
    const v = view();
    const calls = [];
    const context = {
      clearRect() {},
      drawImage(...args) {
        calls.push(args);
      },
    };
    const canvas = { getContext: () => context };
    beginCompanionAction(v, 'dig', 0);
    drawSprite(canvas, v.asset, 'idle', 0, null, companionAction(v, 0));
    for (const image of loaded) {
      image.complete = true;
      image.naturalWidth = 1536;
    }
    drawSprite(canvas, v.asset, 'idle', 0, null, companionAction(v, 0));
    const drawn = calls.at(-1);
    assert.match(drawn[0].src, /companions\/clover\/dig.png$/);
    assert.deepEqual(drawn.slice(1), [0, 0, 256, 288, 0, -2.5, 192, 216]);
    const count = calls.length;
    drawSprite(canvas, v.asset, 'idle', 0, null, companionAction(v, 1));
    assert.equal(calls.length, count, 'the same action frame does not repaint');
    reduced.matches = true;
    drawSprite(canvas, v.asset, 'idle', 0, null, companionAction(v, 301));
    assert.equal(calls.length, count, 'reduced motion holds the first authored frame');
    reduced.matches = false;
  } finally {
    globalThis.Image = original;
  }
});

test('a new pose takes precedence over a previous discovery reaction', () => {
  seed();
  const v = view();
  v.pose = 'idle';
  v.since = 10;
  beginCompanionAction(v, 'dig', 20);
  v.pose = 'jump';
  v.since = 30;
  assert.equal(companionAction(v, 40), null);
});

test('a saved state refresh keeps the same appearance playing but a replacement appearance cancels it', () => {
  seed();
  const v = view();
  beginCompanionAction(v, 'dig', 0);
  v.asset = { ...v.asset, seasonalSpriteUrls: { ...v.asset.seasonalSpriteUrls } };
  assert.ok(companionAction(v, 100), 'catalog objects are reserialized after a saved dig');
  v.asset = { ...v.asset, spriteUrl: 'different-outfit.png' };
  assert.equal(companionAction(v, 200), null);
});

test('a wide authored tool preserves body scale and restores the portable canvas on fallback', async () => {
  const previous = globalThis.Image;
  globalThis.Image = class {
    complete = true;
    naturalWidth = 2688;
  };
  try {
    const { drawSprite } = await import('../src/core/sprites.js');
    const wide = {
      url: 'art/companions/clover/fish.png',
      canvas: [224, 216],
      offset: [0, -8],
      anchor: [96, 207],
      scale: 1,
      frames: [{ rect: [0, 0, 224, 216], foot: [96, 207], duration: 400 }],
    };
    posesOf({ base: { cast: wide } });
    setCompanionSeason('spring');
    const v = view();
    const calls = [];
    const surface = {
      width: 192,
      height: 208,
      style: { width: '112px', height: '121px' },
      getContext: () => ({
        clearRect() {},
        drawImage(...args) {
          calls.push(args);
        },
      }),
    };
    beginCompanionAction(v, 'cast', 0);
    drawSprite(surface, v.asset, 'idle', 0, null, companionAction(v, 0));
    assert.equal(surface.width, 224);
    assert.equal(surface.height, 216);
    assert.equal(surface.style.width, '112px', 'logical friend hit area does not widen');
    assert.equal(surface.style.scale, `${224 / 192} ${216 / 208}`);
    assert.deepEqual(calls.at(-1).slice(1), [0, 0, 224, 216, 0, 0, 224, 216]);
    drawSprite(surface, v.asset, 'idle', 0);
    assert.equal(surface.width, 192);
    assert.equal(surface.height, 208);
    assert.equal(surface.style.scale, '');
    assert.equal(surface.style.translate, '');
  } finally {
    globalThis.Image = previous;
  }
});

test('actions sharing an atlas repaint when their first frame rectangles differ', async () => {
  const previous = globalThis.Image;
  globalThis.Image = class {
    complete = true;
    naturalWidth = 2688;
  };
  try {
    const { drawSprite } = await import('../src/core/sprites.js');
    const common = { url: 'art/companions/clover/fish.png', anchor: [96, 199], scale: 1 };
    const cast = { ...common, frames: [{ rect: [0, 0, 192, 208], foot: [96, 199], duration: 300 }] };
    const wait = { ...common, frames: [{ rect: [192, 0, 192, 208], foot: [96, 199], duration: 300 }] };
    posesOf({ base: { cast, wait } });
    setCompanionSeason('spring');
    const v = view(),
      calls = [];
    const surface = {
      getContext: () => ({
        clearRect() {},
        drawImage(...args) {
          calls.push(args);
        },
      }),
    };
    beginCompanionAction(v, 'cast', 0);
    drawSprite(surface, v.asset, 'idle', 0, null, companionAction(v, 0));
    beginCompanionAction(v, 'wait', 10);
    drawSprite(surface, v.asset, 'idle', 0, null, companionAction(v, 10));
    assert.equal(calls.length, 2);
    assert.equal(calls[1][1], 192);
  } finally {
    globalThis.Image = previous;
  }
});

test('a pet never plays poses it does not carry, whatever its pet file calls it', () => {
  seed();
  for (const place of ['custom', 'codex', 'community']) {
    // Same name as Clover, a folder of its own, and no poses that passed.
    useCompanionActions(`copy-${place}`, null);
    const v = view(place, `copy-${place}`, { sourceId: 'playpets-clover' });
    assert.equal(beginCompanionAction(v, 'dig', 0), null, place);
  }
});

test('dragging, a replacement trip and absence invalidate an authored action', () => {
  for (const [field, value] of [
    ['drag', {}],
    ['target', { x: 20, y: 30 }],
    ['away', true],
  ]) {
    seed();
    const v = view();
    beginCompanionAction(v, 'dig', 0);
    v[field] = value;
    assert.equal(companionAction(v, 20), null, field);
    delete v[field];
    assert.equal(companionAction(v, 30), null, `${field}: no resumed stale action`);
  }
});

// Poses are asked for once per pet, after the yard draws, and only for a pet that has them.
test('poses are asked for once, and only for a pet that has them', async () => {
  // A module of its own, not yet given any poses.
  const fresh = await import('../src/core/companion-actions.js?lazy');
  const asked = [];
  bridge.petActions = async id => {
    asked.push(id);
    return { version: 1, outfits: { base: { dig: clip } } };
  };
  fresh.setCompanionSeason('spring');
  const plain = view('folder', 'plain', { hasActions: false }).asset;
  fresh.loadCompanionActionsFor([
    plain,
    view('folder', 'shown-realistic', { spriteStyle: 'realistic' }).asset,
    undefined,
  ]);
  assert.equal(fresh.prepareCompanionAction(plain, 'dig'), null);
  assert.deepEqual(asked, [], 'no pet with poses: nothing is asked');
  assert.equal(fresh.prepareCompanionAction(view().asset, 'dig'), null, 'not there on the first ask');
  fresh.loadCompanionActionsFor([view().asset]);
  assert.deepEqual(asked, ['playpets-clover'], 'asked once');
  await fresh.loadCompanionActionsFor([view().asset]);
  assert.equal(fresh.prepareCompanionAction(view().asset, 'dig'), clip);
  assert.equal(asked.length, 1, 'still once');
  bridge.petActions = async () => {
    throw new Error('gone');
  };
  await fresh.loadCompanionActionsFor([view('folder', 'unreadable').asset]);
  assert.equal(fresh.prepareCompanionAction(view('folder', 'unreadable').asset, 'dig'), null);
});
