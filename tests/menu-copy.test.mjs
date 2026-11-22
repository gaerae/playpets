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
  assert.match(css, /(?:^|\})\s*\.play-actions\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /\.play-action\s*\{[^}]*flex:\s*1 0 max-content;[^}]*white-space:\s*nowrap/s);
});

test('compact management destinations reserve width for every localized label', async () => {
  const css = await readFile('src/styles/compact.css', 'utf8');
  assert.match(css, /body\.compact \.menu-destination\s*\{[^}]*padding:\s*4px;[^}]*font-size:\s*var\(--font-sm\)/s);
  assert.match(
    css,
    /body\.compact \.menu-destination-copy strong\s*\{[^}]*font-size:\s*var\(--font-sm\);[^}]*font-weight:\s*500/s,
  );
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

const backend = async lang => {
  const rs = await readFile(`src-tauri/src/i18n/${lang}.rs`, 'utf8');
  return key => rs.match(new RegExp(`\\("${key.replace('.', '\\.')}", "([^"]*)"\\)`))?.[1];
};

// One place has one name: the page's menu said "Friends & chat" where the tray, the menu bar and
// the panel's own list said "Friends".
test('the page menu, the tray and the menu bar name the friends’ panel alike', async () => {
  for (const [lang, strings, rs] of [
    ['en', en, 'en'],
    ['ko', ko, 'ko'],
    ['ja', ja, 'ja'],
    ['zh', zh, 'zh_hans'],
  ]) {
    const t = await backend(rs);
    assert.equal(strings['controls.friends'], t('tray.friends'), `${lang} tray`);
    assert.equal(strings['controls.friends'], t('menu.friends'), `${lang} menu bar`);
  }
});

// The small window's corner button opens the yard's menu, which holds more than places, play and
// friends, so it is named for the menu.
test('the corner button is named for the yard menu it opens', () => {
  for (const [lang, strings] of Object.entries({ en, ko, ja, zh })) {
    assert.ok(strings['controls.launcher'].includes(strings['controls.yard']), lang);
    assert.ok(!strings['controls.launcher'].includes(strings['controls.play']), `${lang} lists no destination`);
  }
});
