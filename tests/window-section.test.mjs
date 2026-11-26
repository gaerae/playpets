import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { strings as en } from '../src/core/strings/en.js';
import { strings as ja } from '../src/core/strings/ja.js';
import { strings as ko } from '../src/core/strings/ko.js';
import { strings as zh } from '../src/core/strings/zh-hans.js';

const read = path => readFile(path, 'utf8');
const compact = css =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([{};:,>()+])\s*/g, '$1')
    .replace(/\s+/g, ' ');
const windowSection = async () => {
  const html = await read('src/index.html');
  return html.slice(html.indexOf('id="management-window"'), html.indexOf('id="window-actions"'));
};

// Fullscreen alone had no switch, and its name turned into Return to previous size while it also
// said pressed, so a screen reader heard the state twice and the row looked out of the list.
test('fullscreen is a switch with a name that stays', async () => {
  const section = await windowSection();
  assert.match(section, /<button id="fullscreen"[^>]*>[\s\S]*?class="wander-switch"[\s\S]*?<\/button>/);
  assert.doesNotMatch(section, /fullscreen-label/);
  assert.doesNotMatch(await read('src/window.js'), /restore_size/);
  for (const [lang, strings] of Object.entries({ en, ko, ja, zh })) {
    assert.equal(strings['win.restore_size'], undefined, lang);
    assert.ok(strings['win.fullscreen'], lang);
  }
  assert.equal(ko['win.fullscreen'], '전체화면');
  assert.equal(en['win.fullscreen'], 'Fullscreen');
});

// The tooltip and the screen reader's name only repeated the words already on the row.
test('the window switches carry no tooltip that repeats their name', async () => {
  const section = await windowSection();
  assert.doesNotMatch(section, /id="always-on-top"[^>]*data-i18n-title/);
  const settings = await read('src/panel/settings.js');
  assert.doesNotMatch(settings, /\$\('desktop'\), 'title'/);
  assert.doesNotMatch(settings, /\$\('desktop'\), 'aria-label'/);
});

test('strolling and the grass sit indented under the desktop, and hide with it', async () => {
  const css = compact(await read('src/styles/caption.css'));
  assert.match(css, /\.view-wander\[hidden\]\{display:none/);
  assert.match(css, /\.view-controls>\.view-wander\{[^}]*padding-left:33px/);
});

// The two window switches and the three desktop ones ran together as one list of five.
test('the window and the desktop switches stand as two groups', async () => {
  const css = compact(await read('src/styles/caption.css'));
  assert.match(css, /\.window-quick-actions\+\.view-controls\{[^}]*margin-top:8px/);
});
