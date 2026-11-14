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

// A cloud crosses the yard in minutes, about a pixel at a time: moved smoothly, WebView2 composited
// the yard 60 times a second while nothing else moved. WebKit moves steps on the page's own thread,
// which costs more there, so only WebView2 takes them (docs/standards/performance.md).
test('in WebView2 clouds drift in pixel-sized steps, so a still yard is not composited every frame', async () => {
  const css = (await readFile('src/styles/scenery.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)];
  const body = selector => rules.find(([, selectors]) => selectors.trim() === selector)?.[2] ?? '';
  assert.match(body('.cloud-lane'), /animation:\s*drift var\(--t\) linear infinite;/);
  const steps = Number(
    body(':root[data-webview2] .cloud-lane').match(/animation-timing-function:\s*steps\((\d+)\);/)?.[1],
  );
  const travel = 1.22 * 1180;
  assert.ok(steps >= travel && steps <= 2 * travel, `about one step a pixel in the usual window: ${steps}`);
  const app = await readFile('src/app.js', 'utf8');
  assert.match(app, /toggleAttribute\('data-webview2', !!globalThis\.chrome\?\.webview\)/);
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

test('snow under the moon glitters in two layers that twinkle in turn, lit most under the moon, still with reduced motion', async () => {
  const css = (await readFile('src/styles/scenery.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  const body = selector =>
    [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)]
      .filter(([, selectors]) => selectors.split(',').some(s => s.trim() === selector))
      .map(([, , b]) => b)
      .join('');
  const before = body('.yard.moment-snowlight .moment-layer::before'),
    after = body('.yard.moment-snowlight .moment-layer::after');
  for (const layer of [before, after]) {
    assert.match(layer, /glints\.svg/);
    assert.match(layer, /animation:\s*moment-glint/);
  }
  assert.match(before, /animation-delay:\s*-/, 'out of step with the other layer');
  assert.match(
    body('.yard.moment-snowlight .moment-layer'),
    /radial-gradient\(.*var\(--orb-x/,
    'a sheen under the moon',
  );
  const still = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*moment-snowlight[^@]*/)?.[0] ?? '';
  assert.match(still, /moment-snowlight \.moment-layer::before/);
  assert.match(still, /moment-snowlight \.moment-layer::after/);
});

test('the harvest moon is a whole disc, not tonight’s phase through the big moon', async () => {
  const css = (await readFile('src/styles/scenery.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)].find(([, selectors]) =>
    selectors.split(',').some(s => s.trim() === '.look-fullmoon.moon-full.period-night .sky-body::after'),
  );
  assert.ok(rule, 'the harvest moon has its own drawing');
  assert.match(rule[2], /mask:\s*radial-gradient/, 'its mask is a full disc, not the phase in --moon-lit');
});
