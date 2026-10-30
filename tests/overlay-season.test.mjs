import assert from 'node:assert/strict';
import test from 'node:test';

test('overlay wardrobe follows saved season changes and minute fallback without unrelated refreshes', async () => {
  const { setupSeason } = await import('../src/core/season.js');
  const events = new EventTarget(),
    applied = [];
  let choice = 'winter',
    minute;
  const now = () => new Date('2026-07-15T12:00:00Z');
  const refresh = setupSeason({
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
  // A choice saved by the yard reaches this window with the app's state, which reads it again.
  choice = 'summer';
  refresh();
  assert.deepEqual(applied, ['winter', 'summer']);
  choice = 'winter';
  refresh();
  applied.splice(0, applied.length, 'winter');
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

test('a fresh desktop wardrobe matches the sunny yard while saved Auto follows the calendar', async () => {
  const { setupSeason } = await import('../src/core/season.js');
  const { initialSceneChoices } = await import('../src/yard/scene.js');
  for (const [choice, expected] of [
    [null, initialSceneChoices().season],
    ['auto', 'winter'],
  ]) {
    const applied = [];
    setupSeason({
      read: () => choice,
      apply: season => applied.push(season),
      minute: () => {},
      events: new EventTarget(),
      now: () => new Date(2026, 0, 15, 12),
    });
    assert.deepEqual(applied, [expected]);
  }
});
