import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('every FAQ distinguishes app-local chat storage from the connected provider policy', async () => {
  const locales = [
    ['website', /not saved anywhere/i, /provider.*retention|retention.*provider/i],
    ['website/ko', /어디에도 저장하지/, /서비스.*저장.*정책/],
    ['website/ja', /どこにも保存しません/, /接続先.*保存.*方針/],
    ['website/zh-hans', /任何地方/, /服务.*保存.*政策/],
  ];
  for (const [dir, overbroad, provider] of locales) {
    const faq = await readFile(`${dir}/guide/faq.md`, 'utf8');
    assert.doesNotMatch(faq, overbroad, dir);
    assert.match(faq, /PlayPets/, dir);
    assert.match(faq, provider, dir);
  }
});
