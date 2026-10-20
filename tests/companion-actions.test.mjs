import assert from 'node:assert/strict';
import test from 'node:test';
import {
  actionGroundOffset,
  beginCompanionAction,
  clearCompanionAction,
  companionAction,
  setCompanionSeason,
  useCompanionActions,
} from '../src/core/companion-actions.js';

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
const view = (place = 'builtin', sourceId = 'playpets-clover') => ({
  asset: { place, sourceId, id: sourceId, spriteUrl: 'base.png', seasonalSpriteUrls: { summer: 'summer.png' } },
});
function seed() {
  useCompanionActions({
    version: 1,
    characters: { 'playpets-clover': { variants: { spring: { dig: clip }, autumn: { dig: clip } } } },
  });
  setCompanionSeason('spring');
}

test('only bundled companions opt into authored action clips', () => {
  seed();
  assert.equal(beginCompanionAction(view('custom'), 'dig', 10), null);
  assert.equal(beginCompanionAction(view('builtin', 'other'), 'dig', 10), null);
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
  assert.equal(beginCompanionAction(v, 'dig', 20), null);
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
  useCompanionActions({
    version: 1,
    characters: { 'playpets-clover': { variants: { spring: { wait: { ...clip, loop: true } } } } },
  });
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
    useCompanionActions({ version: 1, characters: { 'playpets-clover': { variants: { spring: { cast: wide } } } } });
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
    useCompanionActions({ version: 1, characters: { 'playpets-clover': { variants: { spring: { cast, wait } } } } });
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

test('every imported source ID collision keeps its portable sheet in every season', () => {
  for (const id of ['playpets-clover', 'playpets-daisy', 'playpets-pip', 'playpets-miso']) {
    for (const season of ['spring', 'summer', 'autumn', 'winter']) {
      useCompanionActions({ version: 1, characters: { [id]: { variants: { [season]: { dig: clip } } } } });
      setCompanionSeason(season);
      for (const place of ['custom', 'codex', 'community']) {
        const v = view(place, id);
        const before = JSON.stringify(v.asset);
        assert.equal(beginCompanionAction(v, 'dig', 0), null, `${id}/${season}/${place}`);
        assert.equal(JSON.stringify(v.asset), before);
      }
    }
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
