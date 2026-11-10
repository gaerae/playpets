// Kinds that look alike in a small yard are told apart by how they are drawn there: a firefly at night
// by its light, rhythm and size, a slender flier by its size, a cricket by its colour. Any two bugs
// of one kind and about one size differ in a colour or a marking, in the drawing that stands in
// until the collection art is ready as much as in the art.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import './support/content.mjs';
import { BUGS } from '../src/yard/catalog.js';
import { bugSvg } from '../src/yard/creatures.js';
import { fireflyLit, fireflyPace, paintPlainBug } from '../src/yard/scenery.js';

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const bug = id => BUGS.find(item => item.id === id);
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

const fireflies = BUGS.filter(bug => bug.kind === 'firefly');
const kind = id => fireflies.find(bug => bug.id === id);
// How many flashes a firefly makes over `ms`, and how far its light swings while it does.
function flashes(look, ms) {
  let phase = 0,
    count = 0,
    low = 1,
    high = 0,
    last = fireflyLit(look, phase);
  for (let t = 0; t < ms; t += 10) {
    phase += 10 * fireflyPace(look);
    const lit = fireflyLit(look, phase);
    if (last < 0.9 && lit >= 0.9) count++;
    [low, high, last] = [Math.min(low, lit), Math.max(high, lit), lit];
  }
  return { count, swing: high - low };
}

test('no two kinds of firefly glow the same way: each has its own rhythm or size', () => {
  assert.ok(fireflies.length >= 4);
  // The time between flashes, in ms; 0 for a steady light.
  const rhythm = bug => (bug.look.blink === 0 ? 0 : (Math.PI * 2) / fireflyPace(bug.look)),
    size = bug => bug.look.size ?? 1;
  for (const [i, a] of fireflies.entries())
    for (const b of fireflies.slice(i + 1)) {
      const [x, y] = [rhythm(a), rhythm(b)];
      const paced = x !== y && (x === 0 || y === 0 || Math.max(x, y) / Math.min(x, y) >= 1.4),
        sized = Math.max(size(a), size(b)) / Math.min(size(a), size(b)) >= 1.25;
      assert.ok(paced || sized, `${a.id} and ${b.id} look alike at night`);
      assert.notEqual(a.look.glow, b.look.glow, `${a.id} and ${b.id} share a light`);
    }
});

test('the Heike firefly flickers quickly, the late firefly holds a steady light', () => {
  const common = flashes(kind('firefly').look, 20000),
    heike = flashes(kind('heike_firefly').look, 20000),
    late = flashes(kind('late_firefly').look, 20000);
  assert.ok(common.count >= 5, 'the common firefly flashes about every two seconds');
  assert.ok(heike.count >= common.count * 2, 'the Heike firefly at least twice as often');
  assert.ok(common.swing > 0.8, 'a flash goes from dim to bright');
  assert.equal(late.count, 0, 'the late firefly never flashes');
  assert.ok(late.swing < 0.01, 'its light stays the same');
  assert.ok(kind('heike_firefly').look.size < 1, 'and the Heike firefly is the small one');
  assert.ok(kind('late_firefly').look.size > 1, 'the late firefly the big one');
});

test('a damselfly flies smaller than the blue dragonfly it shares the pond with', () => {
  const size = id => BUGS.find(bug => bug.id === id).look.size ?? 1;
  assert.ok(size('damselfly') <= size('dragonfly') * 0.8, 'a damselfly is small and slender');
  assert.ok(size('blue_butterfly') <= size('cabbage_white') * 0.8, 'and so is the little blue butterfly');
});

test('the field cricket is not the green of the katydid that hops beside it', () => {
  const [cricket, katydid] = [rgb(bug('field_cricket').look.body), rgb(bug('katydid').look.body)];
  assert.ok(cricket[0] > cricket[1], 'the cricket is a warm brown');
  assert.ok(katydid[1] > katydid[0], 'the katydid stays green');
  // The album and the yard draw the art, so it is the brown redraw that is checked, not only the
  // colours above: the atlas its provenance records.
  const art = id => json('../src/art/collection.json').find(entry => entry.id === id);
  const redraw = json('../assets/sources/look-alikes-2026-11-10/accepted-art.json').sources.find(source =>
    source.acceptedIds.includes('field_cricket'),
  );
  assert.equal(art('field_cricket').atlas, redraw.runtimeAtlas.replace(/\.png$/, '.webp'));
  assert.deepEqual(art('field_cricket').crop, redraw.boxes.field_cricket);
  assert.notEqual(art('katydid').atlas, art('field_cricket').atlas, 'the katydid keeps its own drawing');
});

test('a damselfly drawn before its art is ready is still smaller than the dragonfly', () => {
  // The largest ellipse each bug's stand-in drawing makes, at one scale and one wingbeat.
  const reach = id => {
    let largest = 0;
    const ctx = new Proxy(
      {
        ellipse(x, y, rx, ry) {
          largest = Math.max(largest, rx, ry);
        },
      },
      { get: (target, key) => target[key] ?? (() => {}) },
    );
    paintPlainBug(ctx, { ...bug(id), x: 100, y: 100, heading: 0, phase: 1 }, 2);
    return largest;
  };
  assert.ok(reach('damselfly') < reach('dragonfly'), 'the damselfly');
  assert.ok(reach('blue_butterfly') < reach('cabbage_white'), 'the little blue butterfly');
});

test('the album draws the little blue butterfly narrower than the cabbage white when it has no art', () => {
  // How far the first (lower left) wing's tip reaches from the body at x 30: the curve's end point.
  const span = id => {
    const tip = bugSvg({ kind: 'butterfly', look: bug(id).look }).match(/d="M[\d.]+ [\d.]+C[\d.]+ [\d.]+ ([\d.]+)/);
    return 30 - Number(tip[1]);
  };
  assert.ok(span('blue_butterfly') < span('cabbage_white') * 0.8, `${span('blue_butterfly')} ${span('cabbage_white')}`);
});

test('two bugs of one kind and about one size differ in a colour or a marking', () => {
  const size = item => item.look.size ?? 1;
  const COLOURS = ['body', 'wing', 'edge', 'glow', 'spots', 'stripes', 'sheen', 'eyes'];
  const distance = (a, b) => Math.hypot(...rgb(a).map((value, i) => value - rgb(b)[i]));
  const marks = item => Object.keys(item.look).filter(key => key !== 'size' && !COLOURS.includes(key));
  for (const [i, a] of BUGS.entries())
    for (const b of BUGS.slice(i + 1)) {
      if (a.kind !== b.kind || Math.max(size(a), size(b)) / Math.min(size(a), size(b)) >= 1.25) continue;
      const keys = new Set([...Object.keys(a.look), ...Object.keys(b.look)]);
      const marked =
        [...keys].some(key => key !== 'size' && a.look[key] === undefined) ||
        [...keys].some(key => key !== 'size' && b.look[key] === undefined) ||
        marks(a).some(key => a.look[key] !== b.look[key]);
      const coloured = COLOURS.some(key => a.look[key] && b.look[key] && distance(a.look[key], b.look[key]) >= 40);
      assert.ok(marked || coloured, `${a.id} and ${b.id} look alike`);
    }
});
