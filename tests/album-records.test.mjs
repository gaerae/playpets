// The line under a found entry says what was done with it, in that book's own words.

import assert from 'node:assert/strict';
import test from 'node:test';
import { setLanguageForTests, t } from '../src/core/i18n.js';
import { recordLine } from '../src/panel/album.js';

test('a tree is counted as trees grown, not as flowers', ctx => {
  ctx.after(() => setLanguageForTests('en'));
  for (const lang of ['ko', 'en', 'ja', 'zh-hans']) {
    setLanguageForTests(lang);
    assert.equal(recordLine('tree', { count: 2 }), t('catch.trees_grown', { count: 2 }), lang);
    assert.equal(recordLine('flower', { count: 2 }), t('catch.grown', { count: 2 }), lang);
  }
  setLanguageForTests('ko');
  assert.doesNotMatch(recordLine('tree', { count: 2 }), /송이|피웠/);
});

test('a gift says it was received; where it is now is its button’s to say', ctx => {
  ctx.after(() => setLanguageForTests('en'));
  for (const lang of ['ko', 'en', 'ja', 'zh-hans']) {
    setLanguageForTests(lang);
    assert.notEqual(recordLine('gift', { count: 1 }), t('album.in_yard'), lang);
  }
});
