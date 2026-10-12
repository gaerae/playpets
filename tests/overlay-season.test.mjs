import assert from 'node:assert/strict';
import test from 'node:test';

test('overlay wardrobe follows saved season changes and minute fallback without unrelated refreshes', async () => {
  const { setupSeason } = await import('../src/core/season.js');
  const events = new EventTarget(),
    applied = [];
  let choice = 'winter',
    minute;
  const now = () => new Date('2026-07-15T12:00:00Z');
  setupSeason({
    read: () => choice,
    apply: season => applied.push(season),
    minute: cb => {
      minute = cb;
    },
    events,
    now,
    south: false,
  });
  assert.deepEqual(applied, ['winter']);
  const storage = key => {
    const e = new Event('storage');
    e.key = key;
    events.dispatchEvent(e);
  };
  choice = 'spring';
  storage('season');
  assert.deepEqual(applied, ['winter', 'spring']);
  storage('weather');
  assert.equal(applied.length, 2);
  choice = 'autumn';
  minute(now());
  assert.equal(applied.at(-1), 'autumn');
  choice = 'auto';
  storage(null);
  assert.equal(applied.at(-1), 'summer');
});
