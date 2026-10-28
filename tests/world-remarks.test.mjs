import assert from 'node:assert/strict';
import test from 'node:test';
import { list } from '../src/core/i18n.js';
import { data, setData, setGame, views } from '../src/core/state.js';
import { idleChatter, remark } from '../src/yard/remarks.js';
import { scene } from '../src/yard/world.js';
import { useWorlds } from '../src/yard/worlds.js';
import { worlds as definitions } from './support/content.mjs';

function pending(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  setGame(null);
  views.clear();
  const before = { ...scene };
  Object.assign(scene, { world: 'woodland', weather: 'rain', period: 'day' });
  const friend = { pet: { id: 'friend' }, bubble: { hidden: true } };
  views.set('friend', friend);
  t.after(() => {
    Object.assign(scene, before);
    views.clear();
  });
  remark();
  return friend;
}

test('a queued outdoor remark cannot arrive after changing to the studio', t => {
  const friend = pending(t);
  Object.assign(scene, { world: 'studio', weather: 'clear', period: 'night' });
  t.mock.timers.tick(1600);
  assert.equal(friend.bubble.hidden, true);
});

test('queued remarks do not speak through a removed or replaced friend', t => {
  const friend = pending(t);
  views.set('friend', { pet: { id: 'friend' }, bubble: { hidden: true } });
  t.mock.timers.tick(1600);
  assert.equal(friend.bubble.hidden, true);
});

test('a new indoor place uses its registered atmosphere instead of studio lines', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const previous = { ...scene },
    before = data;
  useWorlds([...definitions, { id: 'reading-room', chatter: 'chatter.day', capabilities: { weather: false } }]);
  setData({ ...data, limits: { bondLevels: [0, 10, 20, 30, 40] } });
  views.clear();
  const friend = { pet: { id: 'reader' }, bubble: { hidden: true } };
  views.set('reader', friend);
  Object.assign(scene, { world: 'reading-room', weather: 'clear', period: 'day', event: null });
  t.after(() => {
    useWorlds(definitions);
    setData(before);
    Object.assign(scene, previous);
    views.clear();
  });
  idleChatter(1);
  idleChatter(120001);
  const { textContent } = friend.bubble;
  assert.ok(textContent, 'a quiet friend speaks after its idle wait');
  assert.ok(list('chatter.day').includes(textContent), textContent);
});

test('a friend whose agent finished long ago is quiet again, and chats like one', t => {
  const before = data;
  views.clear();
  const done = { state: 'done', source: 'agent', at: Date.now() - 31 * 60 * 1000 };
  setData({ ...data, statuses: { finished: done, fresh: { ...done, at: Date.now() } } });
  const finished = { pet: { id: 'finished' }, bubble: { hidden: true } };
  const fresh = { pet: { id: 'fresh' }, bubble: { hidden: true } };
  views.set('finished', finished);
  views.set('fresh', fresh);
  t.after(() => {
    setData(before);
    views.clear();
  });
  idleChatter(5_000_000);
  assert.ok(finished.bubble.textContent, 'the faded "done" no longer keeps it from talking');
  assert.ok(!fresh.bubble.textContent, 'a friend that just finished is still showing it');
});

test('selectable studio weather never produces outdoor rain or snow remarks', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  useWorlds(
    definitions.map(world =>
      world.id === 'studio'
        ? {
            ...world,
            capabilities: { ...world.capabilities, weather: true },
          }
        : world,
    ),
  );
  const before = { ...scene };
  views.clear();
  setGame(null);
  const friend = { pet: { id: 'indoors' }, bubble: { hidden: true } };
  views.set('indoors', friend);
  t.after(() => {
    useWorlds(definitions);
    Object.assign(scene, before);
    views.clear();
  });
  for (const weather of ['rain', 'snow']) {
    Object.assign(scene, { world: 'studio', weather, period: 'day' });
    remark();
    t.mock.timers.tick(1600);
    assert.equal(friend.bubble.hidden, true, 'friends remain indoors instead of asking for outdoor gear');
  }
});
