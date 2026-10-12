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
