// A daylight-only overlay cannot linger while its scene changes to night or precipitation.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('rainbows stop immediately when night or precipitation begins', async () => {
  const css = (await readFile('src/styles/scenery.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  for (const condition of ['period-night', 'weather-rain', 'weather-snow']) {
    const rule = [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)].find(
      ([, selectors, body]) => selectors.includes(`.yard.${condition} .rainbow`) && /transition:\s*none/.test(body),
    );
    assert.ok(rule, `${condition} cancels the rainbow fade`);
    assert.match(rule[2], /opacity:\s*0\s*;/);
  }
});
