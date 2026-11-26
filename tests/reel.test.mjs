// The moving pictures are cut from one filmed take by its marks (scripts/reel-lib.mjs).
import assert from 'node:assert/strict';
import test from 'node:test';
import { reelCuts, reelFilter } from '../scripts/reel-lib.mjs';

const marks = [
  { name: 'garden', at: 1.7 },
  { name: 'walk', at: 6.0 },
  { name: 'tag', at: 14.2 },
  { name: 'dig', at: 22.2 },
  { name: 'dig', at: 28.6 },
  { name: 'found', at: 33.1 },
  { name: 'fish', at: 38.9 },
  { name: 'bite', at: 45.4 },
  { name: 'caught', at: 47.6 },
  { name: 'chat', at: 51.0 },
  { name: 'show', at: 60.5 },
  { name: 'end', at: 73.1 },
];

test('a cut keeps the dig that found something, not the empty ones before it', () => {
  const dig = reelCuts(marks, 'site').find(cut => cut.part === 'dig');
  assert.equal(dig.from, 28.6);
  assert.ok(dig.to > 33.1, 'the find card shows');
});

test('the README picture is the find, the catch and the show, in that order', () => {
  const cuts = reelCuts(marks, 'readme');
  assert.deepEqual(
    cuts.map(cut => cut.part),
    ['dig', 'catch', 'show'],
  );
  for (const cut of cuts) assert.ok(cut.to > cut.from);
  assert.ok(cuts.at(-1).to <= 73.1, 'nothing after the take ends');
});

test('the site film shows every part once and stays within the take', () => {
  const cuts = reelCuts(marks, 'site');
  assert.deepEqual(
    cuts.map(cut => cut.part),
    ['garden', 'walk', 'tag', 'dig', 'cast', 'catch', 'chat', 'show'],
  );
  for (const [i, cut] of cuts.entries()) {
    assert.ok(cut.from >= 0 && cut.to <= 73.1);
    if (i) assert.ok(cut.from >= cuts[i - 1].to, 'parts never overlap or go back');
  }
});

test('the site film shows a friend walking where the grass is pressed, then a game of tag', () => {
  const cuts = reelCuts(marks, 'site');
  const walk = cuts.find(cut => cut.part === 'walk');
  const tag = cuts.find(cut => cut.part === 'tag');
  assert.ok(walk.from >= 6.0 && walk.to <= 14.2, 'the walk stays before the game starts');
  assert.ok(tag.from >= 14.2 - 1 && tag.to - tag.from >= 3, 'the game shows the friends running');
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
