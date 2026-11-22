// A footprint animal out of the album: once followed until it turned to look (SEEN_WHOLE), it comes
// out of its card once, drawn whole, to the yard and the desktop, and hops when poked
// (catalog.json "findsOut" track_out; src/yard/find-out.js).
import assert from 'node:assert/strict';
import test from 'node:test';
import { catalog } from './support/content.mjs';

globalThis.playPets = {};
const { STRINGS, loadStrings } = await import('../src/core/strings.js');
const { t } = await import('../src/core/i18n.js');
const { artHref } = await import('../src/yard/art.js');
const { copiesOf, decorName, findOutFor, heldArt, heldLayers, pokeOf, visitLines } =
  await import('../src/yard/find-out.js');
const { SEEN_WHOLE } = await import('../src/yard/trail-art.js');
const LANGS = ['ko', 'en', 'ja', 'zh-hans'];
await Promise.all(LANGS.map(loadStrings));

test('a footprint animal comes out whole, once, after the follow that showed it', () => {
  const out = findOutFor('track');
  assert.equal(out.id, 'track_out');
  assert.equal(out.onceAfter, SEEN_WHOLE, 'the album draws it whole on the same follow it may come out');
  assert.deepEqual(heldArt('track_out', ['fox']), ['tracks/whole_fox.svg']);
  assert.ok(heldLayers('track_out', ['fox']).includes(artHref('tracks/whole_fox.svg')));
  assert.ok(!heldLayers('track_out', ['fox']).includes('tail_fox'));
  assert.equal(heldLayers('track_out', ['dragon']), '');
  for (const [count, copies] of [
    [1, 0],
    [SEEN_WHOLE - 1, 0],
    [SEEN_WHOLE, 1],
    [SEEN_WHOLE + 4, 1],
  ])
    assert.equal(copiesOf('track', { count }), copies, `${count} follows`);
  assert.equal(copiesOf('fish', { count: 5 }), 5, 'a fish as often as caught');
  assert.equal(copiesOf('fish', undefined), 1);
});

test('an animal out hops when poked, is called by its name and greeted by name', () => {
  for (const k of catalog.tracks) {
    assert.deepEqual(pokeOf('track', k.id), { motion: 'hop' }, k.id);
    assert.equal(decorName('track_out', [k.id]), t(`track.${k.id}`));
  }
  for (const lang of LANGS) {
    const said = STRINGS[lang]['decor.visit_track_out'];
    assert.ok(said?.length >= 2 && said.every(line => line.includes('{name')), lang);
  }
  assert.ok(visitLines('track_out', ['fox']).every(line => line.includes(t('track.fox'))));
});
