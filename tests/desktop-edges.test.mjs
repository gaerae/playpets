// The desktop's edges: a chime, a hanging pot or a mobile hangs from a screen's top by a cord
// (src/overlay/poke.js; docs/design/2026-11-19-desktop-edges.md).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import './support/content.mjs';

globalThis.playPets = {};
const { giftLayers } = await import('../src/overlay/poke.js');
const { GIFTS, flowerKind, giftKind } = await import('../src/yard/catalog.js');

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
  // The morning glory's vine was taken out until it has a prettier shape.
  assert.equal(flowerKind('morning_glory').climbs, undefined);
  assert.doesNotMatch(css, /\.vine/);
});
