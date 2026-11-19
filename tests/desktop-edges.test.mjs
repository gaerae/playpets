// The desktop's edges: a chime, a hanging pot or a mobile hangs from a screen's top by a cord, and a
// morning glory in bloom on a screen's bottom climbs its edges a little more each day
// (src/overlay/poke.js, src/overlay/vine.js; docs/design/2026-11-19-desktop-edges.md).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import './support/content.mjs';

globalThis.playPets = {};
const { giftLayers } = await import('../src/overlay/poke.js');
const { vineOf, vineSvg, VINE } = await import('../src/overlay/vine.js');
const { GIFTS, STAGES, flowerKind, giftKind } = await import('../src/yard/catalog.js');

const DAY = 24 * 60 * 60 * 1000;
const bloomAt = STAGES.find(s => s.name === 'bloom').at;
// A 1440 × 800 work area, and a morning glory 60 × 90 standing on its bottom near the left.
const origin = { x: 0, y: 25, width: 1440, height: 800 };
const glory = { id: 'mg', kind: 'morning_glory', planted: 0 };
const standing = (x, y = 825 - 90 * flowerKind('morning_glory').foot) => ({ x, y, width: 60, height: 90, origin });

test('the chime, the hanging pot and the mobile hang, each by a part with its pivot on its box', () => {
  assert.deepEqual(
    GIFTS.filter(g => g.hangs)
      .map(g => g.id)
      .sort(),
    ['hanging_pot', 'mobile', 'windchime'],
  );
  for (const id of ['hanging_pot', 'mobile', 'windchime']) {
    const { part } = giftKind(id);
    assert.equal(part?.motion, 'sway', id);
    for (const [x, y] of [...part.points, part.pivot])
      assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1, `${id} ${x},${y}`);
    // Its cord runs from the box's top down to the pivot.
    const [px, py] = part.pivot;
    assert.match(giftLayers(id), new RegExp(`class="cord" style="left: ?${px * 100}%; ?height: ?${py * 100}%"`), id);
  }
  assert.doesNotMatch(giftLayers('pinwheel'), /class="cord"/);
  // The stand and the shade are what a hung gift leaves out.
  const css = readFileSync(new URL('../src/overlay/overlay.css', import.meta.url), 'utf8');
  assert.match(css, /\.decor\.hung \.part-still\s*\{\s*display: none;/);
  assert.match(css, /\.decor:not\(\.hung\) \.cord\s*\{\s*display: none;/);
});

test('a morning glory in bloom on the bottom climbs to the nearer side and up it, longer each day', () => {
  const at = standing(200),
    first = vineOf(glory, at, bloomAt);
  assert.equal(first.side, 'left');
  // From its foot, along the bottom to the left edge, then up to a third of the way down the screen.
  // The vine runs just above the flower's foot, so it is not cut by the screen's edge.
  const foot = at.y + at.height * flowerKind('morning_glory').foot - origin.y - VINE.lift;
  assert.deepEqual(first.points[0], [230, foot]);
  const across = 230 - VINE.edge,
    up = foot - origin.height * (1 - VINE.climb);
  assert.ok(Math.abs(first.total - (across + up)) < 1e-9);
  assert.ok(Math.abs(first.length - first.total * VINE.start) < 1e-9, 'a tenth on the day it blooms');
  const later = vineOf(glory, at, bloomAt + 3.5 * DAY);
  assert.ok(later.length > first.length && later.length < later.total);
  const full = vineOf(glory, at, bloomAt + 30 * DAY);
  assert.equal(full.length, full.total, 'all of it after a week');
  assert.deepEqual(full.points, [
    [230, foot],
    [VINE.edge, foot],
    [VINE.edge, origin.height * (1 - VINE.climb)],
  ]);
  // Near the right, it goes right.
  assert.equal(vineOf(glory, standing(1300), bloomAt + 30 * DAY).side, 'right');
});

test('only a morning glory in bloom standing on the bottom climbs', () => {
  assert.equal(vineOf(glory, standing(200), bloomAt - 1), null, 'not before it blooms');
  assert.equal(vineOf(glory, standing(200, 400), bloomAt + DAY), null, 'not mid-screen');
  assert.equal(vineOf({ ...glory, kind: 'tulip' }, standing(200), bloomAt + DAY), null);
  assert.equal(vineOf(glory, null, bloomAt + DAY), null);
  assert.ok(vineOf(glory, standing(200, 825 - 90 * 0.968 - VINE.reach + 1), bloomAt + DAY), 'within reach');
});

test('a vine has leaves on its inner side, flowers with their buds, a tendril now and then and a tip', () => {
  const vine = vineOf(glory, standing(600), bloomAt + 30 * DAY);
  const of = kind => vine.pieces.filter(p => p.kind === kind);
  assert.ok(of('leaf').length > 10 && of('flower').length > 3 && of('tendril').length > 0);
  assert.equal(of('tip').length, 1);
  const { climbs } = flowerKind('morning_glory');
  for (const p of vine.pieces) {
    const arts = { leaf: climbs.leaves, flower: climbs.flowers, tendril: [climbs.tendril], tip: [climbs.tip] }[p.kind];
    assert.ok(arts.includes(p.art), `${p.kind} ${p.art}`);
    if (p.kind === 'flower') assert.equal(p.bud, climbs.bud);
    // On the screen, inside the work area.
    assert.ok(p.x >= 0 && p.x <= origin.width && p.y >= 0 && p.y <= origin.height, `${p.x},${p.y}`);
  }
  // The same vine each time it is drawn, and another flower's is its own.
  assert.deepEqual(vineOf(glory, standing(600), bloomAt + 30 * DAY), vine);
  assert.notDeepEqual(vineOf({ ...glory, id: 'other' }, standing(600), bloomAt + 30 * DAY).pieces, vine.pieces);
  // Drawn only: no pointer, flowers open by day and buds by night (overlay.css, by the hour's class).
  const svg = vineSvg(vine);
  assert.match(svg, /^<svg class="vine"/);
  assert.match(svg, /<path class="vine-stem"/);
  assert.equal(svg.match(/class="vine-open"/g).length, of('flower').length);
  assert.equal(svg.match(/class="vine-closed"/g).length, of('flower').length);
  const css = readFileSync(new URL('../src/overlay/overlay.css', import.meta.url), 'utf8');
  assert.match(css, /\.vine\s*\{[^}]*pointer-events: none;/);
  assert.match(css, /:root:is\(\.period-evening, \.period-night\) \.vine-open/);
  assert.match(css, /:root:is\(\.period-morning, \.period-day\) \.vine-closed/);
});
