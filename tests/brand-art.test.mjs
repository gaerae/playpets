import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('the brand mark uses the approved illustrated Clover face with a portable embedded export', async () => {
  const [svg, provenance, source] = await Promise.all([
    readFile('assets/icon.svg', 'utf8'),
    readFile('assets/icon-provenance.json', 'utf8'),
    readFile('assets/icon.png'),
  ]);
  assert.match(svg, /<image[^>]+href="data:image\/png;base64,/);
  assert.doesNotMatch(svg, /<filter|<text|href="https?:/);
  assert.match(svg, /viewBox="0 0 1024 1024"/);
  assert.equal(source.readUInt32BE(0), 0x89504e47);
  assert.equal(JSON.parse(provenance).character, 'clover');
  assert.match(JSON.parse(provenance).reference, /clover\/face-detail\.png$/);
});

test('installers and sharing keep the four friends together in the same order and visible size', async () => {
  const { brandCast } = await import('../scripts/art-lib.mjs');
  const cast = brandCast(80);
  assert.deepEqual(
    cast.map(pet => pet.id),
    ['daisy', 'clover', 'pip', 'miso'],
  );
  for (const pet of cast) {
    assert.equal(pet.height * pet.scale, 80);
    assert.equal(pet.bottom + 10 * pet.scale, 0);
  }
  const installer = await readFile('scripts/make-installer-art.mjs', 'utf8');
  assert.doesNotMatch(installer, /cell\(sheets, '(tabby|smoky|mochi)'/);
  assert.equal([...installer.matchAll(/castMarkup\(sheets,/g)].length, 3);
  const og = await readFile('scripts/make-og.mjs', 'utf8');
  assert.match(og, /castMarkup\(sheets,/);
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

test('installer casts fit their fixed native artwork areas', async () => {
  const { brandCast, fittedCastHeight } = await import('../scripts/art-lib.mjs');
  for (const [width, desired, gap] of [
    [324, 68, 2],
    [146, 44, 1],
    [142, 40, 1],
    [560, 156, 6],
  ]) {
    const height = fittedCastHeight(width, desired, gap);
    const cast = brandCast(height);
    const used = cast.reduce((sum, pet) => sum + 192 * pet.scale, 0) + gap * (cast.length - 1);
    assert.ok(used <= width + 0.01, `${width}: ${used}`);
    assert.ok(height <= desired && height > 0);
  }
  const sidebar = brandCast(54);
  for (let i = 0; i < sidebar.length; i += 2)
    assert.ok(sidebar.slice(i, i + 2).reduce((sum, pet) => sum + 192 * pet.scale, 4) <= 146);
  assert.throws(() => fittedCastHeight(0, 40), /cast/);
  const og = await readFile('scripts/make-og.mjs', 'utf8');
  for (const name of ['Miso', '미소', 'ミソ', '米索']) assert.ok(og.includes(name), name);
});
