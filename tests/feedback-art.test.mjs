import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { reduced } from '../src/core/sprites.js';
import { setData } from '../src/core/state.js';
import { sizeOf } from '../src/yard/field.js';
import { effect } from '../src/yard/views.js';

test('decorative feedback clears on time, stays above the face and disappears with reduced motion', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const nodes = [],
    yard = { append: node => nodes.push(node) };
  globalThis.document = {
    getElementById: () => yard,
    // A new element has no text, as the page's own does.
    createElement: () => ({
      textContent: '',
      dataset: {},
      style: { setProperty() {} },
      setAttribute(key, value) {
        this[key] = value;
      },
      remove() {
        nodes.splice(nodes.indexOf(this), 1);
      },
    }),
  };
  setData({ pets: [], assets: [], providers: [] });
  const view = { pet: { id: 'test', size: 176 }, px: 100, py: 80 };
  reduced.matches = false;
  effect(view, 'heart');
  assert.equal(nodes.length, 3);
  assert.ok(nodes.every(node => node.textContent === '' && node['aria-hidden'] === 'true'));
  assert.ok(
    nodes.every(node => Number.parseFloat(node.style.top) < view.py),
    'reaction never overlays an imported face',
  );
  context.mock.timers.tick(1600);
  assert.equal(nodes.length, 0);
  reduced.matches = true;
  effect(view, 'spark');
  assert.equal(nodes.length, 0);
  reduced.matches = false;
  delete globalThis.document;
});

test('game discovery marks use a material icon beside the speech bubble', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const nodes = [];
  globalThis.document = {
    getElementById: () => ({ append: node => nodes.push(node) }),
    createElement: () => ({
      textContent: '',
      dataset: {},
      style: { setProperty() {} },
      setAttribute() {},
      remove() {},
    }),
  };
  const view = { pet: { id: 'test', size: 176 }, px: 100, py: 80 };
  effect(view, 'notice');
  assert.equal(nodes[0].dataset.kind, 'notice');
  assert.equal(nodes[0].textContent, '');
  assert.ok(
    Number.parseFloat(nodes[0].style.left) > view.px + sizeOf(view.pet),
    'discovery mark avoids the centered speech bubble',
  );
  delete globalThis.document;
});

// A glyph is drawn by each system's own font (an emoji on one, a box on another): every mark is a
// picture of the yard's own, a wrong guess's ? too.
test("a wrong guess's mark is a picture as well, with no text in it", context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const nodes = [];
  globalThis.document = {
    getElementById: () => ({ append: node => nodes.push(node) }),
    createElement: () => ({
      textContent: '',
      dataset: {},
      style: { setProperty() {} },
      setAttribute() {},
      remove() {},
    }),
  };
  effect({ pet: { id: 'test', size: 176 }, px: 100, py: 80 }, 'question');
  assert.equal(nodes[0].dataset.kind, 'question');
  assert.equal(nodes[0].textContent, '');
  delete globalThis.document;
});
