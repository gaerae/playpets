import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('both studios share the primary destination without selecting the guide menu', async () => {
  const config = await readFile('website/.vitepress/config.mts', 'utf8');
  const { creationCopy } = await import('../website/.vitepress/theme/creation-copy.js');
  const entries = [...config.matchAll(/text:\s*'([^']+)',\s*link:\s*'([^']+)',\s*activeMatch:\s*'([^']+)'/g)];
  for (const prefix of ['', 'ko/', 'ja/', 'zh-hans/']) {
    const studio = entries.find(row => row[2] === `/${prefix}guide/creator-kit`);
    const guideMenu = entries.find(row => row[2] === `/${prefix}guide/`);
    assert.equal(studio[1], creationCopy[prefix.slice(0, -1) || 'en'].studioTitle);
    for (const tool of ['creator-kit', 'background-kit']) {
      assert.ok(new RegExp(studio[3]).test(`/${prefix}guide/${tool}`));
      assert.ok(!new RegExp(guideMenu[3]).test(`/${prefix}guide/${tool}`));
      const guide = await readFile(`website/${prefix}guide/${tool}.md`, 'utf8');
      assert.match(guide, /sidebar: false/);
      assert.match(guide, /outline: false/);
      assert.match(guide, /aside: false/);
    }
    assert.ok(!new RegExp(studio[3]).test(`/${prefix}guide/import`));
  }
});
