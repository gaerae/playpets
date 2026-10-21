import assert from 'node:assert/strict';
import test from 'node:test';
import { setupToast, toast } from '../src/core/state.js';
import { element, installDom, keepGlobals } from './support/dom.mjs';

test('a notice stays readable inside the topmost dialog and returns to the yard on close', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document, nodes } = installDom(t, { ids: ['toast'] });
  const home = element(),
    first = element('dialog'),
    second = element('dialog');
  const notice = nodes.get('toast');
  home.append(notice);
  first.open = second.open = true;
  document.querySelectorAll = () => [first, second].filter(node => node.open);
  setupToast();
  toast('<not markup>');
  assert.equal(notice.parentNode, second);
  assert.equal(notice.children[0].textContent, '<not markup>');
  assert.equal(notice.dataset.inDialog, 'true');
  second.open = false;
  await document.dispatch('close', { target: second });
  assert.equal(notice.parentNode, first);
  first.open = false;
  await document.dispatch('close', { target: first });
  assert.equal(notice.parentNode, home);
  assert.equal(notice.dataset.inDialog, undefined);
  t.mock.timers.tick(8000);
  assert.equal(notice.hidden, true);
});

test('a modal notice reserves space before the actions instead of covering them', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document, nodes } = installDom(t, { ids: ['toast'] });
  const home = element(),
    dialog = element('dialog'),
    form = element('form'),
    actions = element();
  actions.className = 'dialog-actions';
  home.append(nodes.get('toast'));
  form.append(actions);
  dialog.append(form);
  document.querySelectorAll = () => [dialog];
  toast('Readable message');
  assert.equal(nodes.get('toast').parentNode, form);
  assert.deepEqual(form.children, [nodes.get('toast'), actions]);
});

test('a message already visible follows a newly opened modal', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document, nodes } = installDom(t, { ids: ['toast'] });
  const home = element(),
    dialog = element('dialog');
  home.append(nodes.get('toast'));
  let changed;
  keepGlobals(t, 'MutationObserver');
  globalThis.MutationObserver = class {
    constructor(callback) {
      changed = callback;
    }
    observe(node, options) {
      assert.equal(node, dialog);
      assert.deepEqual(options.attributeFilter, ['open']);
    }
  };
  document.querySelectorAll = selector => (selector === 'dialog' || dialog.open ? [dialog] : []);
  setupToast();
  toast('Still readable');
  assert.equal(nodes.get('toast').parentNode, home);
  dialog.open = true;
  changed();
  assert.equal(nodes.get('toast').parentNode, dialog);
});

test('yard warnings, game instructions and discoveries share a non-overlapping lane outside the play field', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile('src/index.html', 'utf8');
  const stack = html.indexOf('class="yard-feedback"');
  assert.ok(
    stack > html.indexOf('id="weather-layer"'),
    'feedback follows the field instead of participating in game clicks',
  );
  const end = html.indexOf('id="toast"', stack);
  for (const id of ['warnings', 'game-banner', 'catch-card']) assert.ok(html.indexOf(`id="${id}"`, stack) < end, id);
});

test('an error already shown inline in the open dialog is not repeated as a notice', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document, nodes } = installDom(t, { ids: ['toast'] });
  const dialog = element('dialog'),
    inline = element('p', { className: 'form-error' });
  dialog.open = true;
  inline.textContent = 'That address did not answer.';
  dialog.append(inline);
  dialog.querySelectorAll = selector => (selector === '.form-error' ? [inline] : []);
  document.querySelectorAll = () => [dialog];
  const notice = nodes.get('toast');
  notice.hidden = true;
  toast('That address did not answer.');
  assert.equal(notice.hidden, true, 'the form already says it, beside the field');
  toast('Saved.');
  assert.equal(notice.hidden, false, 'other news still shows');
});
