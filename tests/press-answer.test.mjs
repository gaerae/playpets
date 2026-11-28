// A press on a flower, a tree or a gift answers the same in the yard and on the desktop
// (src/yard/press-answer.js): a flower bobs and drops a few of its own petals, a tree rustles and
// lets a few leaves go in the colours it wears now (snow in winter), and a gift only bobs.

import './support/content.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { flowerKind } from '../src/yard/catalog.js';
import { answerOf, bitsOf } from '../src/yard/press-answer.js';

test('a flower bobs and drops a few petals in its own colours', () => {
  const tulip = flowerKind('tulip');
  const look = answerOf({ what: 'plant', kind: 'tulip', season: 'spring' });
  assert.equal(look.motion, 'bob');
  assert.equal(look.bit, 'petal');
  assert.deepEqual(look.colors, [tulip.colors.petal, tulip.colors['petal-hi']]);
  assert.ok(look.count >= 2 && look.count <= 4, 'a few, not a shower');
});

test('a tree rustles and lets leaves go as it looks in the season, snow in winter', () => {
  const autumn = answerOf({ what: 'tree', kind: 'maple', season: 'autumn' }),
    summer = answerOf({ what: 'tree', kind: 'maple', season: 'summer' });
  assert.equal(autumn.motion, 'rustle');
  assert.equal(autumn.bit, 'leaf');
  assert.notDeepEqual(autumn.colors, summer.colors, 'an autumn maple drops autumn leaves');
  // An evergreen keeps its green in autumn: no orange leaf falls from a pine.
  assert.deepEqual(answerOf({ what: 'tree', kind: 'pine', season: 'autumn' }).colors, summer.colors);
  assert.equal(answerOf({ what: 'tree', kind: 'pine', season: 'winter' }).bit, 'snow');
});

test('a gift only bobs, and what is not known answers nothing', () => {
  assert.deepEqual(answerOf({ what: 'gift', kind: 'bench', season: 'summer' }), {
    motion: 'bob',
    bit: null,
    colors: [],
    count: 0,
  });
  assert.equal(answerOf({ what: 'plant', kind: 'no-such-flower', season: 'summer' }), null);
});

test('the bits start in the drawing and fall to about its foot, a little apart', () => {
  const look = answerOf({ what: 'plant', kind: 'cosmos', season: 'autumn' });
  const rolls = [0.1, 0.9, 0.5, 0.3, 0.7, 0.2, 0.8, 0.4, 0.6, 0.15, 0.85, 0.45];
  let i = 0;
  const bits = bitsOf(look, { width: 60, height: 80 }, () => rolls[i++ % rolls.length]);
  assert.equal(bits.length, look.count);
  for (const bit of bits) {
    assert.ok(bit.x >= 0.2 && bit.x <= 0.8, 'across the drawing, not its empty sides');
    assert.ok(bit.y >= 0.15 && bit.y <= 0.5, 'from its upper half');
    // It lands near the foot: where it starts plus its fall.
    const lands = bit.y * 80 + bit.fall;
    assert.ok(lands > 0.8 * 80 && lands < 1.05 * 80, `lands near the foot: ${lands}`);
    assert.ok(Math.abs(bit.dx) <= 24);
    assert.ok(look.colors.includes(bit.color));
    assert.ok(bit.delay >= 0 && bit.delay < 400);
  }
  assert.ok(new Set(bits.map(bit => bit.x)).size === bits.length, 'not on top of each other');
});

test('now and then the nearest friend within reach says something about what was pressed', async () => {
  const { remarker, REMARK } = await import('../src/yard/press-answer.js');
  const friends = [
    { name: 'far', x: 900 },
    { name: 'near', x: 160 },
    { name: 'nearer', x: 60 },
  ];
  const away = f => Math.abs(f.x - 0);
  assert.equal(remarker(friends, away, { random: () => 0 })?.name, 'nearer');
  // Most presses pass quietly: words at every press would be noise.
  assert.ok(REMARK.chance > 0 && REMARK.chance < 0.5);
  assert.equal(remarker(friends, away, { random: () => REMARK.chance }), null);
  // A friend across the screen does not answer for a flower it cannot see.
  assert.equal(remarker([{ x: REMARK.reach + 1 }], away, { random: () => 0 }), null);
  assert.equal(remarker([], away, { random: () => 0 }), null);
});

// Review: the answer's animation took the place of a gift's own while it ran (answer.css sets
// `animation` on the same drawing), cutting short a gift arriving, a Christmas tree turning grand
// or looking up at its star. A press then answers nothing; the next one does.
test('a press while the thing still plays its own animation leaves that one be', async t => {
  const { installDom, element } = await import('./support/dom.mjs');
  installDom(t);
  const { answer } = await import('../src/yard/press-answer.js');
  const look = answerOf({ what: 'decor', kind: 'bench' });
  for (const own of ['arrive', 'arrive-pop', 'xmas-rise', 'look-up']) {
    const button = element('button');
    button.classList.add(own);
    answer(button, look);
    assert.ok(!button.classList.contains('answering'), own);
  }
  const button = element('button');
  answer(button, look);
  assert.ok(button.classList.contains('answering'));
  clearTimeout(button.answerTimer);
});

// Review: a dressed snowman and a decorated tree bobbed bare, what they wear standing still. All of
// a gift's drawing moves together, in the yard and on the desktop.
test('what a gift wears bobs with it', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../src/styles/answer.css', import.meta.url), 'utf8');
  const bob = css.split('}').find(rule => rule.includes('[data-answer="bob"]') && rule.includes('answer-bob 520ms'));
  for (const layer of ['svg', '.ornaments', '.dress-layers', '.held-layer', '.xmas-night'])
    assert.ok(bob.includes(layer), layer);
});
