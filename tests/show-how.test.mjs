import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { environmentLake } from '../src/yard/environment.js';
import { clearPatch, groundPatches, showHowSpot } from '../src/yard/show-how.js';

// What to try next is shown, not written: a hand taps the first friend until it is patted, then the
// lake until it is fished, and nothing is pointed at otherwise.
const lake = environmentLake(1180, 850, { world: 'woodland' });

test('until the first pat the hand taps the first friend', () => {
  assert.deepEqual(showHowSpot({ key: 'hint.pat' }, { friend: 'daisy', lake }), { friend: 'daisy' });
  assert.equal(showHowSpot({ key: 'hint.pat' }, { friend: null, lake }), null, 'no friend in sight, no hand');
});

test('then the hand taps the middle of the water', () => {
  const spot = showHowSpot({ key: 'hint.fish' }, { friend: 'daisy', lake });
  assert.ok(lake.onWater(spot.x, spot.y), `${spot.x},${spot.y} is on the water`);
  assert.equal(showHowSpot({ key: 'hint.fish' }, { friend: 'daisy', lake: null }), null, 'a place with no water');
});

test('a game or nothing left to learn points at nothing', () => {
  assert.equal(showHowSpot({ text: 'Find Miso!' }, { friend: 'daisy', lake }), null);
  assert.equal(showHowSpot(null, { friend: 'daisy', lake }), null);
});

// With a tool in hand the hand taps the open ground, until that tool has once been used.
test('a tool in hand taps the ground until it has been used once', () => {
  const ground = { x: 590, y: 700 };
  assert.deepEqual(showHowSpot(null, { aiming: 'dig', ground, learned: () => false }), {
    x: 590,
    y: 700,
    ground: true,
  });
  assert.equal(showHowSpot(null, { aiming: 'dig', ground, learned: tool => tool === 'dig' }), null, 'learned');
  assert.equal(showHowSpot(null, { aiming: 'seed', ground: null, learned: () => false }), null, 'no open ground');
  assert.equal(
    showHowSpot({ key: 'hint.pat' }, { friend: 'daisy', aiming: 'treat', ground, learned: () => true }),
    null,
    'a tool in hand comes before the pat',
  );
});

// The hand on the ground taps open grass: a patch with a friend on it is passed over for the next,
// and when every patch has someone, the one farthest from them all.
test('the hand on the ground keeps clear of friends', () => {
  const patches = [
    { x: 500, y: 600 },
    { x: 400, y: 600 },
    { x: 590, y: 600 },
  ];
  assert.deepEqual(clearPatch(patches, [], 80), { x: 500, y: 600 }, 'nobody near: the first patch');
  assert.deepEqual(clearPatch(patches, [{ x: 510, y: 620 }], 80), { x: 400, y: 600 }, 'a friend on the first');
  assert.deepEqual(
    clearPatch(
      patches,
      [
        { x: 500, y: 600 },
        { x: 410, y: 600 },
        { x: 560, y: 600 },
      ],
      80,
    ),
    { x: 590, y: 600 },
    'all taken: the farthest from anyone',
  );
  assert.equal(clearPatch([], [], 80), null);
});

// The hand never taps under the lane of news (a find's card, a notice): a patch it would cover, or
// that the hand's own picture would reach into, gives way to one nearer the ridge, wherever the lane
// is drawn at the moment.
test('the hand on the ground keeps out of the lane of news', () => {
  const ground = { width: 1000, bottom: 800, topAt: () => 400 };
  const free = groundPatches(ground);
  assert.deepEqual(free[0], { x: 420, y: 540 }, 'no news: a little left of the middle, a third of the way down');
  const lane = { left: 12, right: 988, top: 560, bottom: 700 };
  const patches = groundPatches({ ...ground, lane });
  assert.ok(patches.length > 0, 'somewhere is still open');
  for (const p of patches)
    assert.ok(p.y + 64 < lane.top || p.y - 10 > lane.bottom, `${p.x},${p.y} is clear of the lane`);
  assert.equal(patches[0].y, 480, 'nearer the ridge first');
  const high = { left: 12, right: 988, top: 380, bottom: 600 };
  const below = groundPatches({ ...ground, lane: high });
  assert.ok(below.length && below.every(p => p.y - 10 > high.bottom), 'a lane drawn high sends the hand lower down');
  assert.deepEqual(groundPatches({ ...ground, lane: { left: 0, right: 1000, top: 0, bottom: 800 } }), []);
});

// After the first fishing trip the hand goes on teaching from the dock: Play leads to Dig, then to
// Plant a seed once one is found, then to the Album once something is in it. It taps Play while the
// panel is shut and the tile itself once it is open.
test('past the lake the hand taps the next tile, by way of Play', () => {
  for (const [key, tile] of [
    ['hint.dig', 'dig-tool'],
    ['hint.sow', 'plant-tool'],
    ['hint.album', 'album-button'],
  ])
    assert.deepEqual(showHowSpot({ key }, { friend: 'daisy', lake }), { tile, via: 'play-button' }, key);
});

// Asked after every agent report and every state push, the hand reads no layout when there is nothing
// to teach: the yard's box is read only for a tool in hand, the lake only for the water's turn.
test('nothing to teach reads no layout', async t => {
  const { installDom } = await import('./support/dom.mjs');
  const { nodes } = installDom(t, { ids: ['yard', 'label-layer'] });
  let reads = 0;
  nodes.get('yard').getBoundingClientRect = () => {
    reads++;
    return { left: 0, top: 0, width: 1180, height: 850 };
  };
  const { showHow } = await import('../src/yard/show-how.js');
  showHow(null);
  showHow({ key: 'hint.dig' });
  assert.equal(reads, 0);
});

// The hand is drawn in proportion to what it points at: about half a friend's height (so a small
// window's smaller friends get a smaller hand), a little taller than Play, and inside a low window's
// one-line tiles, over the tile below rather than under it.
test('the hand is sized by what it points at', async () => {
  const { readFile } = await import('node:fs/promises');
  const friends = await readFile('src/styles/friends.css', 'utf8');
  assert.match(
    friends,
    /\.label-body > \.show-how\s*\{[^}]*height:\s*clamp\(30px, 52%, 46px\);[^}]*background-position:\s*left top;/s,
  );
  assert.match(friends, /\.yard-play-toggle > \.show-how\s*\{[^}]*width:\s*40px;[^}]*height:\s*40px;/s);
  const play = await readFile('src/styles/play.css', 'utf8');
  const low = play.slice(play.indexOf('@media (max-height: 480px)'));
  assert.match(low, /\.play-board \.play-action:has\(> \.show-how\)\s*\{[^}]*z-index:\s*1;/s);
  assert.match(low, /\.play-board \.play-action > \.show-how\s*\{[^}]*width:\s*30px;[^}]*height:\s*30px;/s);
});
