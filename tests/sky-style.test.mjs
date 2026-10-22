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

test('night stars sit behind the land and only show on a clear night', async () => {
  const css = (await readFile('src/styles/scenery.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)].map(([, selectors, body]) => ({
    selectors: selectors.trim(),
    body,
  }));
  const zIndex = selector =>
    Number(
      rules
        .findLast(rule => rule.selectors.split(',').some(s => s.trim() === selector) && /z-index/.test(rule.body))
        ?.body.match(/z-index:\s*(-?\d+)/)[1],
    );
  assert.ok(zIndex('.star-layer') > zIndex('.paint-sky'), 'stars are in front of the painted sky');
  assert.ok(zIndex('.star-layer') < zIndex('.paint-land'), 'stars are behind the land');
  const field = rules.find(rule => /::after/.test(rule.selectors) && /radial-gradient/.test(rule.body));
  assert.ok(field, 'the twinkling star field exists');
  assert.match(field.selectors, /\.weather-clear/, 'the star field waits for a clear night');
});
