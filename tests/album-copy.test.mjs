// The album's numbers that people read in prose (the README, the guide in every language, what a
// friend knows about the app) are the catalogue's, so adding a kind fails here until the words
// say so too. The landing and the site's album count from the catalogue themselves.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { albumEntries, catalog } from './support/content.mjs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const gifts = catalog.gifts.length;
// Ordinary gifts come on ordinary days: not an event's, and not the snowman, which is built.
const ordinary = catalog.gifts.filter(gift => !gift.event && !gift.built).length;
const keepsakes = catalog.treasures.length;

// Each file and the numbers it writes: a pattern whose first group is the number, and what it is.
const COPY = {
  'README.md': [[/an? (\d+)-entry album/g, albumEntries]],
  'src-tauri/src/chat/guide.rs': [[/\), (\d+) entries\./g, albumEntries]],
  'website/guide/play.md': [
    [/album has (\d+) entries/g, albumEntries],
    [/album has (\d+) gifts/g, gifts],
    [/one of the (\d+)/g, gifts],
    [/one of (\d+) keepsakes/g, keepsakes],
    [/The (\d+) ordinary gifts/g, ordinary],
  ],
  'website/ko/guide/play.md': [
    [/합쳐 (\d+)종/g, albumEntries],
    [/선물은 모두 (\d+)종/g, gifts],
    [/(\d+)종 가운데 하나지만/g, gifts],
    [/작은 발견 (\d+)종/g, keepsakes],
    [/일반 선물 (\d+)종/g, ordinary],
  ],
  'website/ja/guide/play.md': [
    [/合わせて(\d+)種類/g, albumEntries],
    [/全(\d+)種類は/g, albumEntries],
    [/プレゼントは全部で(\d+)種類/g, gifts],
    [/この(\d+)種類のひとつ/g, gifts],
    [/(\d+)種類の小さな発見/g, keepsakes],
    [/通常のプレゼント(\d+)種類/g, ordinary],
  ],
  'website/zh-hans/guide/play.md': [
    [/一共有 (\d+) 种/g, albumEntries],
    [/共 (\d+) 种礼物/g, gifts],
    [/这 (\d+) 种之一/g, gifts],
    [/(\d+) 种小小发现/g, keepsakes],
    [/(\d+) 种普通礼物/g, ordinary],
  ],
};

test("the album's numbers in the README, the guide and a friend's facts are the catalogue's", () => {
  for (const [file, rows] of Object.entries(COPY)) {
    const text = read(file);
    for (const [pattern, count] of rows) {
      const found = [...text.matchAll(pattern)].map(([, n]) => Number(n));
      assert.ok(found.length, `${file}: ${pattern} is not there`);
      for (const n of found) assert.equal(n, count, `${file}: ${pattern}`);
    }
  }
});
