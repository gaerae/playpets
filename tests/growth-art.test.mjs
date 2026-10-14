import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('growth stages share one detailed atlas and keep ordered, clipped viewports', async () => {
  const png = await readFile('src/art/plants/growth.png');
  assert.equal(png.readUInt32BE(16), 1536);
  assert.equal(png.readUInt32BE(20), 1024);
  for (const [column, name] of ['seed', 'sprout', 'leaves', 'bud'].entries()) {
    const svg = await readFile(`src/art/plants/${name}.svg`, 'utf8');
    assert.match(svg, /href="art\/plants\/growth.png"/);
    assert.ok(svg.includes(`viewBox="${column * 384} -176 384 1024"`), name);
    assert.match(svg, /clip-path="url\(#growth-/);
    assert.match(svg, /viewBox="0 0 40 60"/);
  }
});
