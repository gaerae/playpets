import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { nearTop } from '../src/window.js';

test('the yard has no native or custom title bar on any platform after resizing', async () => {
  const [rust, html, wiring] = await Promise.all(
    ['src-tauri/src/window.rs', 'src/index.html', 'src/window.js'].map(p => readFile(p, 'utf8')),
  );
  assert.match(rust, /\.decorations\(false\)/);
  assert.doesNotMatch(rust, /TitleBarStyle|traffic_light_position|standardWindowButton|setHidden/);
  assert.doesNotMatch(html, /class="topbar"|win-controls|id="win-(?:min|max|close)"/);
  assert.match(html, /id="window-drag"/);
  assert.match(html, /id="hide-window"/);
  assert.doesNotMatch(html, /id="(?:mini|unmini)"/);
  assert.doesNotMatch(wiring, /windowMini\b|setMini|isMini/);
  assert.equal([...html.matchAll(/data-resize="/g)].length, 8);
  assert.doesNotMatch(wiring, /win-min|win-max|win-close|windowMaximize/);
});

test('the window buttons come with the pointer at the top and with the keyboard', async () => {
  const [html, wiring, shell] = await Promise.all(
    ['src/index.html', 'src/window.js', 'src/styles/shell.css'].map(p => readFile(p, 'utf8')),
  );
  for (const id of ['window-fit', 'window-minimize', 'window-close'])
    assert.match(html, new RegExp(`<div id="window-buttons"[^]*id="${id}"`));
  assert.match(wiring, /call\('windowFit'\)/);
  assert.match(wiring, /call\('windowMinimize'\)/);
  assert.match(wiring, /call\('windowHide'\)/);
  assert.match(shell, /\.window-buttons:has\(:focus-visible\)/);
  assert.match(shell, /body\.window-top \.window-buttons/);
  assert.match(shell, /\.fullscreen \.window-buttons/);
});

test('the top of the yard counts as near only while the pointer is there', () => {
  assert.equal(nearTop(0), true);
  assert.equal(nearTop(55), true);
  assert.equal(nearTop(56), false);
});

test('the right-click menu and the shortcut reach the same fitting as the buttons', async () => {
  const [html, controls, wiring, tray, menu] = await Promise.all(
    ['src/index.html', 'src/core/controls.js', 'src/window.js', 'src-tauri/src/tray.rs', 'src-tauri/src/menu.rs'].map(
      p => readFile(p, 'utf8'),
    ),
  );
  assert.match(html, /data-context-action="fit"/);
  assert.match(controls, /action === 'fit'\) \$\('window-fit'\)\.click\(\)/);
  assert.match(wiring, /onShortcut\('fitWindow'/);
  assert.match(tray, /Item\("fit", None\)/);
  assert.match(menu, /"fit" =>/);
  assert.match(menu, /item\("fit", "tray\.fit", Some\("CmdOrCtrl\+0"\)\)/);
});
