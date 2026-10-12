import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('the brand mark has Clover’s sage hat and cream face without a raster dependency', async () => {
  const svg = await readFile('assets/icon.svg', 'utf8');
  assert.match(svg, /id="clover-hat"/);
  assert.match(svg, /id="clover-leaf-bow"/);
  assert.match(svg, /id="clover-face"/);
  assert.doesNotMatch(svg, /<image|<filter|<text/);
  assert.match(svg, /viewBox="0 0 1024 1024"/);
});

test('installer portraits use the current starters and sharing gives Clover the main position', async () => {
  const installer = await readFile('scripts/make-installer-art.mjs', 'utf8');
  assert.doesNotMatch(installer, /cell\(sheets, '(tabby|smoky|mochi)'/);
  for (const id of ['clover', 'daisy', 'pip']) assert.match(installer, new RegExp(`cell\\(sheets, '${id}'`));
  const og = await readFile('scripts/make-og.mjs', 'utf8');
  // Clover is drawn the largest of the three.
  const scales = Object.fromEntries(
    [...og.matchAll(/cell\('(\w+)', \d+, \d+, ([\d.]+)/g)].map(m => [m[1], Number(m[2])]),
  );
  assert.equal(Object.entries(scales).sort((a, b) => b[1] - a[1])[0][0], 'clover', JSON.stringify(scales));
  assert.match(og, /Promise\.all.*document\.images/);
});

test('installer scenery and sharing artwork use the detailed app environment instead of flat hills', async () => {
  const installer = await readFile('scripts/make-installer-art.mjs', 'utf8');
  assert.match(installer, /loadEnvironment/);
  assert.doesNotMatch(installer, /class="far"|class="ground"|class="hill"/);
  const og = await readFile('scripts/make-og.mjs', 'utf8');
  assert.doesNotMatch(og, /<i class="sun"/);
  assert.match(og, /loadEnvironment/);
});

test('the legacy sample generator cannot overwrite the accepted production cats', async () => {
  const source = await readFile('scripts/make-mascot-pet.mjs', 'utf8');
  assert.match(source, /release\/legacy-pets\//);
  // No path it writes to starts in the shipped pets folder, whatever the variable is called.
  assert.doesNotMatch(source, /['"`]assets\/pets\/|join\(\s*['"]assets['"],\s*['"]pets['"]/);
});

test('drawing tools start Chrome, fall back to Playwright’s Chromium and name both when neither starts', async () => {
  const { launchBrowser } = await import('../scripts/browser-lib.mjs');
  const calls = [];
  const fake = outcomes => ({
    launch: async options => {
      calls.push(options);
      const outcome = outcomes.shift();
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
  });
  assert.equal(await launchBrowser({}, { chromium: fake(['chrome']) }), 'chrome');
  assert.deepEqual(calls.pop(), { headless: true, channel: 'chrome' });
  calls.length = 0;
  assert.equal(await launchBrowser({}, { chromium: fake([new Error('no chrome'), 'chromium']) }), 'chromium');
  assert.deepEqual(calls, [{ headless: true, channel: 'chrome' }, { headless: true }]);
  await assert.rejects(
    launchBrowser({}, { chromium: fake([new Error('no chrome\nlog'), new Error('no chromium\nlog')]) }),
    error => /Google Chrome: no chrome\./.test(error.message) && /Chromium: no chromium\./.test(error.message),
  );
  // Every tool goes through the launcher; only the capture backdrop needs a real Chrome window.
  const { readdir } = await import('node:fs/promises');
  for (const name of (await readdir('scripts')).filter(file => file.endsWith('.mjs') && file !== 'browser-lib.mjs')) {
    const source = await readFile(`scripts/${name}`, 'utf8');
    assert.doesNotMatch(source, /chromium\.launch\(/, name);
  }
});

test('pictures cross into a drawing page and back as data URLs without changing a byte', async () => {
  const { dataUrl, dataUrlBytes } = await import('../scripts/art-lib.mjs');
  const bytes = Buffer.from([0, 1, 2, 250, 255]);
  assert.equal(dataUrl(bytes), 'data:image/png;base64,AAEC+v8=');
  assert.equal(dataUrl(bytes, 'image/webp').slice(0, 16), 'data:image/webp;');
  assert.deepEqual(dataUrlBytes(dataUrl(bytes)), bytes);
});
