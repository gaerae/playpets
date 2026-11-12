import assert from 'node:assert/strict';
import test from 'node:test';
import { list } from '../src/core/i18n.js';
import { data, setData, setGame, views } from '../src/core/state.js';
import { idleChatter, momentRemark, remark } from '../src/yard/remarks.js';
import { MOMENTS } from '../src/yard/sky-moments.js';
import { scene } from '../src/yard/world.js';
import { useWorlds } from '../src/yard/worlds.js';
import { attic, withAttic } from './support/attic.mjs';
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

test('a queued outdoor remark cannot arrive after changing to the workshop', t => {
  const friend = pending(t);
  Object.assign(scene, { world: 'workshop', weather: 'clear', period: 'night' });
  t.mock.timers.tick(1600);
  assert.equal(friend.bubble.hidden, true);
});

test('queued remarks do not speak through a removed or replaced friend', t => {
  const friend = pending(t);
  views.set('friend', { pet: { id: 'friend' }, bubble: { hidden: true } });
  t.mock.timers.tick(1600);
  assert.equal(friend.bubble.hidden, true);
});

test("a new indoor place uses its registered atmosphere instead of another room's lines", t => {
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
  t.mock.timers.enable({ apis: ['setTimeout'] });
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
  // The first call may only set when chatter is next due; the second is past any wait.
  idleChatter(5_000_000);
  idleChatter(5_200_000);
  assert.ok(finished.bubble.textContent, 'the faded "done" no longer keeps it from talking');
  assert.ok(!fresh.bubble.textContent, 'a friend that just finished is still showing it');
});

test('weather in a room without a sky never produces outdoor rain or snow remarks', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  withAttic(t);
  const before = { ...scene };
  views.clear();
  setGame(null);
  const friend = { pet: { id: 'indoors' }, bubble: { hidden: true } };
  views.set('indoors', friend);
  t.after(() => {
    Object.assign(scene, before);
    views.clear();
  });
  for (const weather of ['rain', 'snow']) {
    Object.assign(scene, { world: attic.id, weather, period: 'day' });
    remark();
    t.mock.timers.tick(1600);
    assert.equal(friend.bubble.hidden, true, 'friends remain indoors instead of asking for outdoor gear');
  }
});

test('a moment in the sky is pointed out by one friend, unless it is over by then', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  setGame(null);
  views.clear();
  const before = { ...scene };
  Object.assign(scene, { world: 'woodland', weather: 'clear', period: 'day' });
  const friend = { pet: { id: 'friend' }, bubble: { hidden: true } },
    other = { pet: { id: 'other' }, bubble: { hidden: true } };
  views.set('friend', friend);
  views.set('other', other);
  t.after(() => {
    Object.assign(scene, before);
    views.clear();
  });
  for (const { id } of MOMENTS) {
    for (const v of [friend, other]) v.bubble.hidden = true;
    momentRemark(id, () => true);
    t.mock.timers.tick(1600);
    const spoke = [friend, other].filter(v => !v.bubble.hidden);
    assert.equal(spoke.length, 1, id);
    assert.ok(list(`chatter.${id}`).includes(spoke[0].bubble.textContent), `${id}: ${spoke[0].bubble.textContent}`);
  }

  for (const v of [friend, other]) v.bubble.hidden = true;
  let on = true;
  momentRemark('rainbow', () => on);
  on = false;
  t.mock.timers.tick(1600);
  assert.ok(
    [friend, other].every(v => v.bubble.hidden),
    'a moment gone before the friend speaks is not mentioned',
  );
});

test("a moment's line is not talked over by the weather that brought it", t => {
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
  momentRemark('sunshower', () => true);
  remark();
  t.mock.timers.tick(3000);
  assert.ok(list('chatter.sunshower').includes(friend.bubble.textContent), friend.bubble.textContent);
  friend.bubble.hidden = true;
  remark();
  t.mock.timers.tick(3000);
  assert.equal(friend.bubble.hidden, false, 'the weather is remarked on again once the moment has been pointed out');
});
