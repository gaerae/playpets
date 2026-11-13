// The yard's dot and the friend tab's pill mean agent work; a chat's state only shapes the pose.
import assert from 'node:assert/strict';
import test from 'node:test';
import { agentStateOf, applyBusy, applyStatus, FADE_MS, fadedBetween, stateOf, statusOf } from '../src/core/status.js';

const at = 1_000_000;
const data = {
  statuses: {
    work: { state: 'working', message: '', source: 'agent', at },
    done: { state: 'done', message: '', source: 'agent', at },
    chat: { state: 'done', message: '', source: 'chat', at },
    old: { state: 'done', message: '', source: 'agent' },
  },
};

test('a chat answer shapes the pose but is not agent work', () => {
  assert.equal(stateOf(data, 'chat', at), 'done');
  assert.equal(agentStateOf(data, 'chat', at), 'idle');
  assert.equal(agentStateOf(data, 'work', at), 'working');
  assert.equal(agentStateOf(data, 'none', at), 'idle');
});

test('a finished agent fades after a while, a working one does not', () => {
  assert.equal(agentStateOf(data, 'done', at + FADE_MS - 1), 'done');
  assert.equal(agentStateOf(data, 'done', at + FADE_MS + 1), 'idle');
  assert.equal(statusOf(data, 'done', at + FADE_MS + 1), null);
  assert.equal(agentStateOf(data, 'work', at + 10 * FADE_MS), 'working');
  // Without a time (an older build) nothing fades.
  assert.equal(agentStateOf(data, 'old', at + 10 * FADE_MS), 'done');
});

test('the page is drawn again only in the minute a status fades', () => {
  assert.equal(fadedBetween(data, at, at + 60_000), false, 'nothing fades a minute in');
  assert.equal(fadedBetween(data, at + FADE_MS - 30_000, at + FADE_MS + 30_000), true);
  assert.equal(fadedBetween(data, at + FADE_MS + 30_000, at + FADE_MS + 90_000), false, 'and not every minute after');
  assert.equal(fadedBetween({}, 0, at), false);
});

test('a status event updates only that friend, as the whole state would have', () => {
  const page = { statuses: { other: { state: 'working', message: 'x', source: 'agent', at } } };
  applyStatus(page, { type: 'status', petId: 'a', state: 'done', message: 'ok', source: 'agent', at: at + 1 });
  assert.deepEqual(page.statuses.a, { state: 'done', message: 'ok', source: 'agent', at: at + 1 });
  assert.equal(page.statuses.other.state, 'working');
  const empty = {};
  applyStatus(empty, { type: 'status', petId: 'b', state: 'working', message: '', source: 'chat', at });
  assert.equal(stateOf(empty, 'b', at), 'working', 'a page without statuses yet gets them');
});

test('a busy event keeps who is waiting and names only the friends whose wait began or ended', () => {
  const page = { busy: ['a', 'b'] };
  assert.deepEqual(applyBusy(page, { type: 'busy', busy: ['b', 'c'] }).sort(), ['a', 'c']);
  assert.deepEqual(page.busy, ['b', 'c']);
  assert.deepEqual(applyBusy(page, { type: 'busy', busy: ['c', 'b'] }), [], 'the same friends in another order');
  const fresh = {};
  assert.deepEqual(applyBusy(fresh, { type: 'busy', busy: ['a'] }), ['a'], 'a page without busy yet gets it');
});
