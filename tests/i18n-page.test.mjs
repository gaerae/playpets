// The page's t(): holes, Korean particles, the English fallback and the key as last resort.
import assert from 'node:assert/strict';
import test from 'node:test';
import { joinList, list, setLanguageForTests, t } from '../src/core/i18n.js';
import { STRINGS } from '../src/core/strings.js';

test('holes are filled and a Korean particle follows the word', () => {
  setLanguageForTests('ko');
  assert.equal(t('hide.found', { name: '프리렌' }), STRINGS.ko['hide.found'].replace('{name:을/를}', '프리렌을'));
  assert.equal(t('hide.found', { name: '흰둥이' }), STRINGS.ko['hide.found'].replace('{name:을/를}', '흰둥이를'));
  assert.equal(t('hide.found'), STRINGS.ko['hide.found'], 'a hole without a value stays visible');
  setLanguageForTests('en');
});

test('a missing sentence falls back to English, then to the key', () => {
  setLanguageForTests('ja');
  assert.equal(t('no.such.key'), 'no.such.key');
  assert.deepEqual(list('no.such.key'), []);
  assert.equal(t('error.with_detail', { sentence: 'A', detail: 'B' }), 'A（B）');
  setLanguageForTests('en');
  assert.equal(t('error.with_detail', { sentence: 'A', detail: 'B' }), 'A (B)');
});

test('lists are joined the way the language writes them', () => {
  setLanguageForTests('ja');
  assert.equal(joinList(['タビ', 'スモーキー']), 'タビ、スモーキー');
  setLanguageForTests('zh-hans');
  assert.equal(joinList(['塔比', '烟烟']), '塔比、烟烟');
  assert.equal(t('hide.found', { name: '塔比' }), '找到塔比了！');
  setLanguageForTests('zh-CN');
  assert.equal(t('tabs.friend'), '伙伴', 'a region-only tag reaches the simplified file');
  setLanguageForTests('en');
  assert.equal(joinList(['Tabby', 'Smoky']), 'Tabby, Smoky');
});
