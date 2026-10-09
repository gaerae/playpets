// The garden grows by the clock, flowers by the season it was planted in, and friends find seeds
// now and then (src/yard/growth.js).

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FIND_GAP,
  FIRST_FIND,
  FIRST_GIFT,
  flowerFor,
  GIFT_WAIT,
  giftWait,
  hoursMinutes,
  localDay,
  nextFind,
  STAGES,
  stageOf,
  untilBloom,
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

test('each season has its own flower', () => {
  const flowers = ['spring', 'summer', 'autumn', 'winter'].map(flowerFor);
  assert.equal(new Set(flowers).size, 4);
  assert.equal(flowerFor('bogus'), 'tulip');
});

test('seeds are found now and then, the first one soon', () => {
  assert.equal(
    nextFind(() => 0),
    FIND_GAP[0],
  );
  assert.equal(
    nextFind(() => 1),
    FIND_GAP[1],
  );
  assert.ok(nextFind(() => 1, true) <= FIRST_FIND[1]);
  assert.ok(FIRST_FIND[1] < FIND_GAP[0]);
});

test('a wait is said in hours and minutes, rounded up', () => {
  assert.deepEqual(hoursMinutes(80 * MIN), { hours: 1, minutes: 20 });
  assert.deepEqual(hoursMinutes(30 * 1000), { hours: 0, minutes: 1 });
});

test('a gift comes once a day after the yard has been seen a while, the first one soon', () => {
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
