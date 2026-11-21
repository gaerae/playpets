// A friend sent to a prop the person pressed (a spring shoot to dig up, fallen fruit to pick up):
// errands.js keeps who is on which, marks the prop's button meanwhile, and lets the friend go.
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { element, installDom } from './support/dom.mjs';

const state = await import('../src/core/state.js');
const { errands, friendFor } = await import('../src/yard/errands.js');
const { setDoing } = await import('../src/yard/trips.js');

const prop = () => ({ button: element('button') });

test('an errand marks its prop while it is on, and only its own end clears it', () => {
  const shown = new Map([['a', prop()]]),
    on = errands(shown),
    task = { v: {}, end: () => {} };
  assert.equal(on.busy(), false);
  on.start('a', task);
  assert.ok(on.busy() && on.has('a'));
  assert.ok(shown.get('a').button.classList.contains('picking'));
  on.finish('a', { v: {}, end: () => {} });
  assert.ok(on.has('a'), "another errand's end leaves this one");
  on.finish('a', task);
  assert.equal(on.busy(), false);
  assert.ok(!shown.get('a').button.classList.contains('picking'));
  // A prop no longer drawn is no trouble.
  on.start('gone', task);
  on.finish('gone', task);
  assert.equal(on.busy(), false);
});

test('calling errands off lets go of a friend still on one, and only ends one taken over', () => {
  const ended = [],
    on = errands(new Map()),
    working = { pet: { id: 'w' } },
    elsewhere = { pet: { id: 'e' } };
  const workingEnd = () => ended.push('working');
  setDoing(working, { end: workingEnd });
  on.start('a', { v: working, end: workingEnd });
  // The second friend's errand: something else has the friend now.
  setDoing(elsewhere, { end: () => {} });
  on.start('b', { v: elsewhere, end: () => ended.push('elsewhere') });
  on.cancelAll();
  assert.deepEqual(ended.sort(), ['elsewhere', 'working']);
  assert.equal(working.doing, null, 'the friend on the errand is free again');
  assert.ok(elsewhere.doing, 'the other friend keeps what it is doing');
});

test('only the errands to props that are gone are called off', () => {
  const ended = [],
    on = errands(new Map());
  on.start('here', { v: {}, end: () => ended.push('here') });
  on.start('gone', { v: {}, end: () => ended.push('gone') });
  on.cancelAll(id => id === 'gone');
  assert.deepEqual(ended, ['gone']);
});

test('the friend for an errand is the selected one when free, and a toast says why when none is', ctx => {
  // A toast closes itself later: that timer is the test's, not left running after it.
  ctx.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { nodes } = installDom(ctx, { ids: ['toast'] }),
    said = () => nodes.get('toast').children.map(line => line.dataset.words ?? line.textContent);
  ctx.after(() => {
    state.views.clear();
    state.setSelected(null);
  });
  assert.equal(friendFor({ x: 10, y: 10 }, 'shoot.no_friend'), null);
  const v = { pet: { id: 'clover', size: 112 }, px: 0, py: 0, x: 0.1, y: 0.5 };
  state.views.set('clover', v);
  state.setSelected('clover');
  assert.equal(friendFor({ x: 10, y: 10 }, 'shoot.no_friend'), v);
  setDoing(v, { end: () => {} });
  assert.equal(friendFor({ x: 10, y: 10 }, 'shoot.no_friend'), null);
  assert.equal(said().length, 2, 'no friend at all, then a busy one');
});
