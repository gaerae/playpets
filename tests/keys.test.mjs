// The page's shortcuts (src/core/keys.js) and the macOS menu bar's (src-tauri/src/menu.rs) are the
// same keys, so a key works the same with the menu bar and without it.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { matches, SHORTCUTS } from '../src/core/keys.js';

const menu = readFileSync(new URL('../src-tauri/src/menu.rs', import.meta.url), 'utf8');
const accelerator = keys =>
  keys
    .split('+')
    .map(k => (k === 'mod' ? 'CmdOrCtrl' : k.length === 1 ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1)))
    .join('+');

test('every page shortcut is the key the menu bar shows, and the menu bar has no other but Quit', () => {
  const shown = [...menu.matchAll(/"(CmdOrCtrl\+[^"]+)"/g)].map(m => m[1]);
  const page = Object.values(SHORTCUTS).map(s => accelerator(s.keys));
  for (const keys of page) assert.ok(shown.includes(keys), `${keys} is in menu.rs`);
  assert.deepEqual(
    shown.filter(k => !page.includes(k)),
    ['CmdOrCtrl+Q'],
    'Quit is the menu bar’s own; every other key the page answers too',
  );
});

test('a shortcut matches its modifiers exactly, Cmd or Ctrl alike', () => {
  const press = (key, mods = {}) => ({ key, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...mods });
  assert.ok(matches(press('1', { metaKey: true }), 'mod+1'));
  assert.ok(matches(press('1', { ctrlKey: true }), 'mod+1'));
  assert.ok(!matches(press('1'), 'mod+1'), 'no modifier');
  assert.ok(!matches(press('1', { metaKey: true, shiftKey: true }), 'mod+1'), 'an extra Shift');
  assert.ok(matches(press('S', { ctrlKey: true, shiftKey: true }), 'mod+shift+s'), 'Shift makes the letter upper case');
  assert.ok(!matches(press('s', { ctrlKey: true, shiftKey: true, altKey: true }), 'mod+shift+s'), 'Alt is never part');
  assert.ok(matches(press(',', { metaKey: true }), 'mod+,'));
});
