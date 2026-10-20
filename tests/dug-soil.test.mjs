import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url));

test('dug soil uses reviewed transparent depth artwork for normal and winter ground', () => {
  for (const name of ['dug-soil.png', 'dug-soil-winter.png']) {
    const image = read(`src/art/discovery/${name}`);
    assert.equal(image.readUInt32BE(16), 256);
    assert.equal(image.readUInt32BE(20), 147);
    assert.equal(image[25], 6, 'the earth rim blends into its actual scenery with RGBA');
  }
  const css = read('src/styles/garden.css').toString();
  assert.match(css, /url\("\.\.\/art\/discovery\/dug-soil\.png"\)/);
  assert.match(css, /\[data-soil="winter"\][\s\S]*?dug-soil-winter\.png/);
});
