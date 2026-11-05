// The moving pictures are cut from one filmed take by its marks (scripts/reel-lib.mjs).
import assert from 'node:assert/strict';
import test from 'node:test';
import { reelCuts, reelFilter } from '../scripts/reel-lib.mjs';

const marks = [
  { name: 'garden', at: 1.7 },
  { name: 'dig', at: 7.2 },
  { name: 'dig', at: 13.6 },
  { name: 'found', at: 18.1 },
  { name: 'fish', at: 23.9 },
  { name: 'bite', at: 30.4 },
  { name: 'caught', at: 32.6 },
  { name: 'chat', at: 36.0 },
  { name: 'show', at: 45.5 },
  { name: 'end', at: 58.1 },
];

test('a cut keeps the dig that found something, not the empty ones before it', () => {
  const dig = reelCuts(marks, 'site').find(cut => cut.part === 'dig');
  assert.equal(dig.from, 13.6);
  assert.ok(dig.to > 18.1, 'the find card shows');
});

test('the README picture is the find, the catch and the show, in that order', () => {
  const cuts = reelCuts(marks, 'readme');
  assert.deepEqual(
    cuts.map(cut => cut.part),
    ['dig', 'catch', 'show'],
  );
  for (const cut of cuts) assert.ok(cut.to > cut.from);
  assert.ok(cuts.at(-1).to <= 58.1, 'nothing after the take ends');
});

test('the site film shows every part once and stays within the take', () => {
  const cuts = reelCuts(marks, 'site');
  assert.deepEqual(
    cuts.map(cut => cut.part),
    ['garden', 'dig', 'cast', 'catch', 'chat', 'show'],
  );
  for (const [i, cut] of cuts.entries()) {
    assert.ok(cut.from >= 0 && cut.to <= 58.1);
    if (i) assert.ok(cut.from >= cuts[i - 1].to, 'parts never overlap or go back');
  }
});

test('a take without a part it needs is refused instead of cut short', () => {
  assert.throws(
    () =>
      reelCuts(
        marks.filter(m => m.name !== 'caught'),
        'site',
      ),
    /caught/,
  );
});

test('the parts are joined by short fades that start where the previous part ends', () => {
  const cuts = [
    { part: 'a', from: 0, to: 3 },
    { part: 'b', from: 10, to: 14 },
    { part: 'c', from: 20, to: 22 },
  ];
  const { graph, duration } = reelFilter(cuts, { width: 640, fps: 12, fade: 0.5 });
  assert.match(graph, /trim=start=0:end=3/);
  assert.match(graph, /xfade=transition=fade:duration=0\.5:offset=2\.5/);
  assert.match(graph, /xfade=transition=fade:duration=0\.5:offset=6/);
  assert.equal(duration, 3 + 4 + 2 - 0.5 * 2);
});
