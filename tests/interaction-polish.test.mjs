import assert from 'node:assert/strict';
import test from 'node:test';
import { setupInteractions } from '../src/core/interactions.js';
import { element, installDom } from './support/dom.mjs';

test('pointer focus stays quiet and keyboard navigation restores a visible location', t => {
  installDom(t);
  document.documentElement = element();
  setupInteractions();
  document.dispatch('pointerdown', {});
  assert.equal(document.documentElement.classList.contains('pointer-input'), true);
  document.dispatch('keydown', { key: 'Tab', metaKey: false, ctrlKey: false, altKey: false });
  assert.equal(document.documentElement.classList.contains('pointer-input'), false);
});

test('native page context menu is suppressed without blocking editable text menus', t => {
  installDom(t);
  document.documentElement = element();
  setupInteractions();
  for (const editable of [false, true]) {
    let prevented = false;
    document.dispatch('contextmenu', {
      target: { closest: () => editable },
      preventDefault: () => {
        prevented = true;
      },
    });
    assert.equal(prevented, !editable);
  }
});
