import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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
  assert.doesNotMatch(wiring, /windowMini|setMini|isMini/);
  assert.equal([...html.matchAll(/data-resize="/g)].length, 8);
  assert.doesNotMatch(wiring, /win-min|win-max|win-close|windowMaximize/);
});
