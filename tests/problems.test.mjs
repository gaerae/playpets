// A page's errors join the backend's problem report (problems.rs): what went wrong and where, a few
// a minute at most, so an error repeated every frame does not flood it.
import assert from 'node:assert/strict';
import test from 'node:test';
import { describeProblem, noteProblem } from '../src/core/problems.js';

test('a page error is reported as its kind, its words and where it happened', () => {
  const error = new TypeError('v.pet is undefined');
  error.stack =
    'TypeError: v.pet is undefined\n    at place (tauri://localhost/yard/views.js:12:3)\n    at moveFriends';
  assert.equal(describeProblem(error), 'TypeError: v.pet is undefined at place (tauri://localhost/yard/views.js:12:3)');
  assert.equal(describeProblem('plain words'), 'plain words');
  assert.equal(describeProblem(null), '');
  assert.equal(describeProblem({ message: 'no stack' }), 'no stack');
});

test('no more than a few page errors a minute are sent, and none without a bridge', t => {
  const sent = [];
  globalThis.window = { playPets: { noteProblem: text => sent.push(text) } };
  t.after(() => delete globalThis.window);
  for (let i = 0; i < 50; i++) noteProblem(new Error(`e${i}`), 1_000 + i);
  assert.equal(sent.length, 20);
  noteProblem(new Error('later'), 1_000 + 61_000);
  assert.equal(sent.at(-1).startsWith('Error: later'), true, 'a minute on, it is sent again');
  delete globalThis.window.playPets;
  assert.doesNotThrow(() => noteProblem(new Error('no bridge'), 200_000));
});
