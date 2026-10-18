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

test('every site language has a privacy policy linked in its footer', async () => {
  const config = await readFile('website/.vitepress/config.mts', 'utf8');
  for (const folder of ['', 'ko/', 'ja/', 'zh-hans/']) {
    const policy = await readFile(`website/${folder}privacy.md`, 'utf8');
    assert.match(policy, /gaerae/);
    assert.match(policy, /2026/);
    assert.match(policy, /Microsoft Store/);
    assert.match(policy, /Google Fonts/);
    assert.match(policy, /jsDelivr/);
    assert.match(policy, /issues\/new\/choose/);
    assert.ok(config.includes(`\${base}${folder}privacy`), folder);
  }
});
