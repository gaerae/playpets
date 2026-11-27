// Japanese runs its words together, and a record's pill on an album card is narrow: broken between
// any two letters, "捕まえました" came apart as "捕まえまし / た". The album breaks Japanese only
// between phrases (after 、 and 。, at a space or a marked break), so each phrase is kept short.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const { strings: ja } = await import('../src/core/strings/ja.js');

// The lines a found kind's card and left page say (album.js BOOKS record), with sample values.
const RECORDS = {
  'catch.count': { count: 12 },
  'catch.best': { size: '20.0' },
  'catch.grown': { count: 12 },
  'catch.trees_grown': { count: 12 },
  'catch.received': {},
  'shoot.count': { count: 12 },
  'album.followed_closer': { count: 3, left: 2 },
  'album.followed_met': { count: 5 },
  'album.secret_found': { date: '2026年11月25日' },
};
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, name) => String(values[name]));

test('every phrase of a Japanese record fits on one line of a card', () => {
  for (const [key, values] of Object.entries(RECORDS)) {
    assert.ok(ja[key], key);
    for (const phrase of fill(ja[key], values).split(/(?<=[、。\s​])/)) {
      assert.ok(phrase.trim().length <= 14, `${key}: "${phrase}" is too long to keep whole`);
    }
  }
});

test('in Japanese the album breaks a line between phrases, never inside a word', async () => {
  const css = (await readFile('src/styles/dialog.css', 'utf8')).replace(/\s+/g, ' ');
  const rule = css.match(/:root:lang\(ja\) \.album-dialog \{([^}]*)\}/)?.[1] || '';
  assert.match(rule, /word-break: keep-all/);
  // a phrase wider than its box may still break rather than spill out
  assert.match(rule, /overflow-wrap: anywhere/);
});
