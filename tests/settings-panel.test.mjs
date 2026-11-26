import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { strings as en } from '../src/core/strings/en.js';
import { strings as ja } from '../src/core/strings/ja.js';
import { strings as ko } from '../src/core/strings/ko.js';
import { strings as zh } from '../src/core/strings/zh-hans.js';

const compact = css =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([{};:,>()+~])\s*/g, '$1')
    .replace(/\s+/g, ' ');
const sheet = async name => compact(await readFile(`src/styles/${name}.css`, 'utf8'));
const rule = (css, selector) =>
  css.match(new RegExp(`(?:^|\\})${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{([^}]*)\\}`))?.[1] || '';

// Settings drew its switches before the words, 32px wide, while the menu beside it and the
// language row above put the control at the row's end, and the menu's were 30px.
test('every switch in the app has one size and sits at the end of its row', async () => {
  const shell = await sheet('shell');
  assert.match(rule(shell, '.wander-switch'), /width:30px;height:18px/);
  assert.match(rule(shell, '.wander-switch::after'), /top:3px;left:3px;width:12px;height:12px/);
  assert.match(rule(shell, '.wander-toggle input:checked~.wander-switch::after'), /translateX\(12px\)/);
  const caption = await sheet('caption');
  assert.doesNotMatch(caption, /\.wander-switch\{[^}]*width:/, 'the menu no longer sizes its own');
  const settings = await sheet('settings');
  const end = rule(settings, ':is(.auto-chatter,.share-all)>.wander-switch');
  assert.match(end, /order:1/);
  assert.match(end, /margin-left:auto/);
  assert.match(rule(settings, '.share-all'), /border-right:0/, 'no stray divider after the switch');
});

// The two folds in Coding tools showed the browser's own triangle; the app's folds use its chevron.
test("a fold in Settings shows the app's chevron, not the browser's triangle", async () => {
  const settings = await sheet('settings');
  assert.match(rule(settings, '.settings-more>summary'), /list-style:none/);
  assert.match(settings, /\.settings-more>summary::-webkit-details-marker\{display:none/);
  assert.match(rule(settings, '.settings-more>summary::after'), /rotate\(45deg\)/);
  assert.match(rule(settings, '.settings-more[open]>summary::after'), /rotate\(225deg\)/);
});

// In a small window Copy settings took a line of its own even with room beside the name.
test("a coding tool's buttons move under its name only when they do not fit beside it", async () => {
  const settings = await sheet('settings');
  assert.doesNotMatch(settings, /body\.compact \.link-row:has\(\.agent-actions\)>div\{[^}]*flex-basis:100%/);
  assert.match(rule(settings, '.link-row:has(.agent-pet)>div'), /flex:1 1 10em/);
});

// Two to a row, the last section stood alone over half a rule, like a table with a cell missing.
test('the list of sections in a small window has no rules under its tiles', async () => {
  const settings = await sheet('settings');
  assert.match(rule(settings, 'body.compact .settings-index button'), /border-bottom:0/);
});

// "Desktop mode" is a name the app uses nowhere else; what matters is whether something is out.
test('the startup note says when it starts on the desktop in words the app uses', () => {
  for (const [lang, strings, word] of [
    ['ko', ko, '모드'],
    ['en', en, 'mode'],
    ['ja', ja, 'モード'],
    ['zh', zh, '模式'],
  ])
    assert.ok(!strings['settings.autostart_note'].includes(word), lang);
  assert.doesNotMatch(en['settings.language_note'], /page/);
});
