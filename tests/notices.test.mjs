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

test('notices stack at most two lines, say a repeated line once, and mark errors apart', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document, nodes } = installDom(t, { ids: ['toast'] });
  document.querySelectorAll = () => [];
  const notice = nodes.get('toast');
  notice.hidden = true;
  const lines = () => notice.children.map(line => line.textContent);
  toast('Saved.');
  toast('Every friend is busy right now');
  toast('Saved.');
  assert.deepEqual(lines(), ['Saved.', 'Every friend is busy right now'], 'a repeat refreshes, not repeats');
  toast('The address did not answer.', { error: true });
  assert.deepEqual(lines(), ['Every friend is busy right now', 'The address did not answer.'], 'the oldest gives way');
  assert.equal(notice.children[1].classList.contains('error'), true);
  assert.equal(notice.children[0].classList.contains('error'), false);
  document.body.classList.add('compact');
  toast('Saved.');
  assert.deepEqual(lines(), ['Saved.'], 'a small window keeps one line, so the friends stay in view');
  t.mock.timers.tick(8000);
  assert.equal(notice.children.length, 0);
  assert.equal(notice.hidden, true);
});

test('one reading time for notices, cards and bubbles: 2.5 s and 50 ms a character, 3 to 8 s', async () => {
  const { readingTime } = await import('../src/core/state.js');
  assert.equal(readingTime('Hi'), 3000);
  assert.equal(readingTime('x'.repeat(40)), 4500);
  assert.equal(readingTime('x'.repeat(400)), 8000);
});

test('a notice can carry one action, such as Undo, that runs once and closes the line', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document, nodes } = installDom(t, { ids: ['toast'] });
  document.querySelectorAll = () => [];
  const notice = nodes.get('toast');
  notice.hidden = true;
  let undone = 0;
  toast('Daisy pulled up', { action: { label: 'Undo', run: () => undone++ }, ms: 6000 });
  const line = notice.children[0];
  const button = line.children.find(child => child.localName === 'button');
  assert.equal(button.textContent, 'Undo');
  await button.onclick();
  assert.equal(undone, 1);
  assert.equal(notice.children.length, 0, 'the line goes once its action is taken');
  assert.equal(notice.hidden, true);
});
