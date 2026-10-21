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
