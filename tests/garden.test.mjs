// The garden grows by the clock and flowers by the season it was planted in.

import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { FLOWERS } from '../src/yard/catalog.js';
import {
  FIRST_GIFT,
  flowerFor,
  GIFT_WAIT,
  giftWait,
  hoursMinutes,
  localDay,
  STAGES,
  stageOf,
  untilBloom,
  plantLook,
  hasPatch,
  offersPatch,
} from '../src/yard/growth.js';

const MIN = 60000;

test('a plant goes from seed to flower with time, and says how long until the next stage', () => {
  const planted = 1_000_000;
  assert.equal(stageOf(planted, planted).name, 'seed');
  assert.equal(stageOf(planted, planted + 9 * MIN).name, 'seed');
  assert.equal(stageOf(planted, planted + 10 * MIN).name, 'sprout');
  assert.equal(stageOf(planted, planted + 60 * MIN).name, 'leaves');
  assert.equal(stageOf(planted, planted + 130 * MIN).name, 'bud');
  assert.equal(stageOf(planted, planted + 5 * 60 * MIN).name, 'bloom');
  assert.equal(stageOf(planted, planted + 5 * MIN).untilNext, 5 * MIN);
  assert.equal(stageOf(planted, planted + 99 * 24 * 60 * MIN).untilNext, 0, 'a flower stays a flower');
  assert.equal(stageOf(planted, planted - 1000).name, 'seed', 'a clock set back does not unplant it');
  assert.equal(untilBloom(planted, planted), STAGES.at(-1).at);
  assert.equal(untilBloom(planted, planted + 9 * 60 * MIN), 0);
  for (let i = 1; i < STAGES.length; i++) assert.ok(STAGES[i].at > STAGES[i - 1].at, 'stages come in order');
});

test("a seed grows into one of its season's flowers, and every flower can grow", () => {
  const grown = new Set();
  for (const season of ['spring', 'summer', 'autumn', 'winter'])
    for (const [index] of FLOWERS.filter(f => f.season === season).entries()) {
      const r = (index + 0.5) / FLOWERS.filter(f => f.season === season).length;
      const id = flowerFor(season, () => r);
      assert.equal(FLOWERS.find(f => f.id === id).season, season);
      grown.add(id);
    }
  assert.deepEqual([...grown].sort(), FLOWERS.map(f => f.id).sort());
  assert.equal(flowerFor('bogus'), FLOWERS[0].id);
});

test('growth has no autonomous seed award schedule', async () => {
  const growth = await import('../src/yard/growth.js');
  for (const name of ['nextFind', 'FIND_GAP', 'FIRST_FIND']) assert.equal(name in growth, false);
});

test('a wait is said in hours and minutes, rounded up', () => {
  assert.deepEqual(hoursMinutes(80 * MIN), { hours: 1, minutes: 20 });
  assert.deepEqual(hoursMinutes(30 * 1000), { hours: 0, minutes: 1 });
});

test('a gift waits a while once it may come, the first one soon', () => {
  assert.equal(
    giftWait(() => 0.9, true),
    FIRST_GIFT,
  );
  assert.ok(FIRST_GIFT < GIFT_WAIT[0], 'the first gift does not keep a new yard waiting');
  assert.equal(
    giftWait(() => 0),
    GIFT_WAIT[0],
  );
  assert.ok(giftWait(() => 0.999) < GIFT_WAIT[1]);
  assert.equal(localDay(new Date(2026, 0, 5, 23, 59)), '2026-01-05', "the person's own day, by their clock");
  assert.equal(localDay(new Date(2026, 9, 9)), '2026-10-09');
});

test('a flower with a patch blooms as its planted patch outdoors, unless set to one bloom', () => {
  const tulip = FLOWERS.find(f => f.id === 'tulip'),
    sunflower = FLOWERS.find(f => f.id === 'sunflower'),
    daffodil = FLOWERS.find(f => f.id === 'daffodil');
  assert.ok(tulip.patch && sunflower.patch && !daffodil.patch);
  assert.deepEqual(plantLook({ kind: 'tulip' }, 'bloom'), { art: tulip.patch.art, tall: 1, foot: tulip.patch.foot });
  assert.deepEqual(plantLook({ kind: 'tulip', single: true }, 'bloom'), { art: tulip.art, tall: 1, foot: tulip.foot });
  // A patch is drawn at its own size: a tall flower's stature is for its one bloom.
  assert.equal(plantLook({ kind: 'sunflower' }, 'bloom').tall, 1);
  assert.equal(plantLook({ kind: 'sunflower', single: true }, 'bloom').tall, sunflower.stature);
  assert.equal(plantLook({ kind: 'sunflower' }, 'bud').tall, sunflower.stature);
  // Before it blooms, and for a flower with no patch, nothing changes.
  const bud = STAGES.find(s => s.name === 'bud').art;
  assert.deepEqual(plantLook({ kind: 'tulip' }, 'bud'), { art: bud, tall: 1, foot: 1 });
  assert.equal(plantLook({ kind: 'daffodil' }, 'bloom').art, daffodil.art);
  // Indoors a flower stands in its pot: one bloom, standing at its box's edge.
  assert.deepEqual(plantLook({ kind: 'tulip' }, 'bloom', { outdoors: false }), { art: tulip.art, tall: 1, foot: 1 });
  assert.equal(hasPatch('tulip'), true);
  assert.equal(hasPatch('daffodil'), false);
});

test('a flower offers one bloom or its patch only once it blooms, outdoors, and only if it has a patch', () => {
  assert.equal(offersPatch({ kind: 'tulip' }, 'bloom', true), true);
  assert.equal(offersPatch({ kind: 'tulip', single: true }, 'bloom', true), true, 'and back to its patch');
  assert.equal(offersPatch({ kind: 'tulip' }, 'bud', true), false, 'its kind is still a surprise');
  assert.equal(offersPatch({ kind: 'tulip' }, 'bloom', false), false, 'indoors it is in a pot');
  assert.equal(offersPatch({ kind: 'daffodil' }, 'bloom', true), false);
});
