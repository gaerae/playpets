import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { strings as en } from '../src/core/strings/en.js';
import { strings as ja } from '../src/core/strings/ja.js';
import { strings as ko } from '../src/core/strings/ko.js';
import { strings as zh } from '../src/core/strings/zh-hans.js';

test('app-owned copy does not use middle dots to join unrelated labels', () => {
  for (const [lang, strings] of Object.entries({ en, ko, ja, zh })) {
    for (const [key, value] of Object.entries(strings))
      assert.doesNotMatch(JSON.stringify(value), /[·・‧∙]/, `${lang}.${key}`);
  }
});

test('Play labels keep their intrinsic width and wrap whole actions rather than words', async () => {
  const css = await readFile('src/styles/play.css', 'utf8');
  assert.match(css, /\.play-actions,\s*\.discovery-tree-choices\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /\.play-action\s*\{[^}]*flex:\s*1 0 max-content;[^}]*white-space:\s*nowrap/s);
});

test('compact management destinations reserve width for every localized label', async () => {
  const css = await readFile('src/styles/compact.css', 'utf8');
  assert.match(css, /body\.compact \.menu-destination\s*\{[^}]*padding:\s*4px;[^}]*font-size:\s*12px/s);
  assert.match(css, /body\.compact \.menu-destination-copy strong\s*\{[^}]*font-size:\s*12px;[^}]*font-weight:\s*500/s);
});

test('atmosphere auto choices rely on their group headings instead of repeating long qualifiers', () => {
  for (const [lang, strings, auto] of [
    ['en', en, 'Auto'],
    ['ko', ko, '자동'],
    ['ja', ja, '自動'],
    ['zh', zh, '自动'],
  ]) {
    for (const key of ['settings.season_auto', 'period.auto', 'weather.auto'])
      assert.equal(strings[key], auto, `${lang}.${key}`);
  }
});
