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

// "데이지의 놀이" read as a thing the friend owns, not "Play with Daisy" as the other languages and
// the dock's 놀기 say it; and the Japanese album hint named two of its four books.
test('playing with a friend and the album say the same in every language', () => {
  assert.equal(ko['controls.play_with'], '{name:과/와} 놀기');
  for (const [lang, strings] of Object.entries({ en, ko, ja, zh })) {
    assert.match(strings['controls.play_with'], /\{name(?::[^}]+)?\}/, lang);
    assert.ok(strings['controls.play_with'].includes(strings['controls.play']), `${lang}: the dock's own word`);
  }
  for (const book of ['花', 'プレゼント', '水中の生きもの', '虫'])
    assert.ok(ja['catch.album_title'].includes(book), book);
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
// the panel's own list said "Friends", and the menu bar's English capitalised what the page did not.
// A native item may add "…" when it opens something to fill in.
test('the tray and the menu bar name every place and switch as the page does', async () => {
  const pairs = {
    'menu.friends': 'controls.friends',
    'menu.invite': 'controls.invite',
    'menu.play': 'controls.play',
    'menu.scene': 'controls.scene',
    'menu.controls': 'controls.menu',
    'menu.sound': 'sound.label',
    'menu.update': 'settings.update_check',
    'tray.desktop': 'desktop.show',
    'tray.wander': 'desktop.wander',
    'tray.grass': 'desktop.grass',
    'tray.alwaysOnTop': 'win.always_on_top',
    'tray.fit': 'win.fit',
  };
  for (const [lang, strings, rs] of [
    ['en', en, 'en'],
    ['ko', ko, 'ko'],
    ['ja', ja, 'ja'],
    ['zh', zh, 'zh_hans'],
  ]) {
    const t = await backend(rs);
    for (const [native, page] of Object.entries(pairs))
      assert.equal(t(native)?.replace(/…$/, ''), strings[page], `${lang} ${native}`);
  }
});

// A place keeps its name when it opens: Friends & settings said "Invite a friend" and the panel it
// opened added a verb in Korean and Japanese, and said "Friend" in English.
test('a panel is titled by the name the menu gives it', () => {
  for (const [lang, strings] of Object.entries({ en, ko, ja, zh })) {
    assert.equal(strings['tabs.friend'], strings['controls.friends'], `${lang} Friends`);
    assert.equal(strings['invite.title'], strings['controls.invite'], `${lang} Invite a friend`);
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

// On a friend's bar its plate names the friend, so Friend settings is said in a word that fits
// beside the others; a Japanese bar in the narrowest window ran out of room with the full name.
test("a friend's bar says its settings no longer than the panel does", () => {
  for (const [lang, strings] of Object.entries({ en, ko, ja, zh })) {
    assert.ok(strings['friend.edit_short'], `${lang} has a short name`);
    assert.ok(strings['friend.edit_short'].length <= strings['friend.edit'].length, lang);
  }
});
