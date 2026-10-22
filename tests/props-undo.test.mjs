import assert from 'node:assert/strict';
import test from 'node:test';
import { element, installDom } from './support/dom.mjs';

const { removeWithUndo } = await import('../src/yard/props.js');

test('taking a plant away is gentle: it goes at once, Undo brings it back, and only then is it removed', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document, nodes } = installDom(t, { ids: ['toast'] });
  document.querySelectorAll = () => [];
  nodes.get('toast').hidden = true;
  const view = { button: element('button') };
  let commits = 0;
  removeWithUndo('rose', view, 'Rose pulled up', async () => commits++);
  assert.equal(view.button.hidden, true, 'it leaves the field at once');
  const undo = nodes.get('toast').children[0].children.find(child => child.localName === 'button');
  await undo.onclick();
  assert.equal(view.button.hidden, false, 'Undo puts it back');
  t.mock.timers.tick(7000);
  assert.equal(commits, 0, 'nothing was removed');
  removeWithUndo('rose', view, 'Rose pulled up', async () => commits++);
  t.mock.timers.tick(6000);
  await Promise.resolve();
  assert.equal(commits, 1, 'without Undo it is removed after the notice');
});

test('Undo is offered exactly until the removal is saved, one line for each thing taken away', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document, nodes } = installDom(t, { ids: ['toast'] });
  document.querySelectorAll = () => [];
  const notice = nodes.get('toast');
  notice.hidden = true;
  const tulips = [{ button: element('button') }, { button: element('button') }];
  let commits = 0;
  removeWithUndo('tulip-1', tulips[0], 'Tulip pulled up', async () => commits++);
  removeWithUndo('tulip-2', tulips[1], 'Tulip pulled up', async () => commits++);
  assert.equal(notice.children.length, 2, 'the same words still get a line, and an Undo, each');
  const undoSecond = notice.children[1].children.find(child => child.localName === 'button');
  await undoSecond.onclick();
  assert.equal(tulips[1].button.hidden, false);
  assert.equal(tulips[0].button.hidden, true, 'undoing one leaves the other taken away');
  // The pointer resting on the line does not keep Undo past the save.
  notice.children[0].matches = selector => selector === ':hover';
  t.mock.timers.tick(6000);
  await Promise.resolve();
  assert.equal(commits, 1);
  assert.equal(notice.children.length, 0, 'once saved, its Undo is gone');
});

test('in a small window a later notice does not push out a pending Undo', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document, nodes } = installDom(t, { ids: ['toast'] });
  document.querySelectorAll = () => [];
  document.body.classList.add('compact');
  const { toast } = await import('../src/core/state.js');
  const notice = nodes.get('toast');
  notice.hidden = true;
  removeWithUndo('rose', { button: element('button') }, 'Rose pulled up', async () => {});
  toast('Pip went to fish');
  assert.deepEqual(
    notice.children.map(line => line.dataset.words),
    ['Rose pulled up', 'Pip went to fish'],
  );
  toast('Daisy is resting');
  assert.deepEqual(
    notice.children.map(line => line.dataset.words),
    ['Rose pulled up', 'Daisy is resting'],
    'plain notices take turns in the one line beside it',
  );
});

test('at most two Undo lines stay; an older one gives way but its removal still happens', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document, nodes } = installDom(t, { ids: ['toast'] });
  document.querySelectorAll = () => [];
  const notice = nodes.get('toast');
  notice.hidden = true;
  let commits = 0;
  for (const id of ['a', 'b', 'c'])
    removeWithUndo(id, { button: element('button') }, `Pulled ${id}`, async () => commits++);
  assert.deepEqual(
    notice.children.map(line => line.dataset.words),
    ['Pulled b', 'Pulled c'],
  );
  t.mock.timers.tick(6000);
  await Promise.resolve();
  assert.equal(commits, 3);
});
