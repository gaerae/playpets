// The yard's dot and the friend tab's pill mean agent work; a chat's state only shapes the pose.
import assert from 'node:assert/strict';
import test from 'node:test';
import { agentStateOf, FADE_MS, stateOf, statusOf } from '../src/core/status.js';

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
