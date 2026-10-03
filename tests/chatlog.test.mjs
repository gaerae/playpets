import assert from 'node:assert/strict';
import test from 'node:test';
import { logEntries as entries } from '../src/core/chatlog.js';

test('the question just sent shows once, whether or not the history has caught up', () => {
  const asked = { role: 'user', content: '안녕?' };
  assert.deepEqual(entries([], asked), [asked], 'shown while the backend is still answering');
  const caughtUp = [asked, { role: 'assistant', content: '안녕!' }];
  assert.deepEqual(entries(caughtUp, asked), caughtUp, 'not a second time once the history lists it');
  assert.deepEqual(entries(caughtUp, null), caughtUp);
  const peer = [{ role: 'user', name: '둘', content: '안녕?' }];
  assert.deepEqual(entries(peer, asked), [...peer, asked], "a friend's line with the same words is not the question");
  const failed = { role: 'error', content: 'x' };
  assert.deepEqual(entries(caughtUp, failed), [...caughtUp, failed], 'an error is always shown');
});
