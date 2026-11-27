import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('growth stages share one detailed atlas and keep ordered, clipped viewports', async () => {
  const png = await readFile('assets/art/plants/growth.png');
  assert.equal(png.readUInt32BE(16), 1536);
  assert.equal(png.readUInt32BE(20), 1024);
  for (const [column, name] of ['seed', 'sprout', 'leaves', 'bud'].entries()) {
    const svg = await readFile(`src/art/plants/${name}.svg`, 'utf8');
    assert.match(svg, /href="art\/plants\/growth\.webp"/);
    assert.ok(svg.includes(`viewBox="${column * 384} -176 384 1024"`), name);
    assert.match(svg, /clip-path="url\(#growth-/);
    assert.match(svg, /viewBox="0 0 40 60"/);
  }
});

test('each flower patch is cut from one sheet at the size the catalogue gives it, and loads with the yard', async () => {
  const catalog = JSON.parse(await readFile('src/content/catalog.json', 'utf8'));
  const { artOf } = await import('../src/yard/catalog.js');
  const patches = catalog.flowers.filter(f => f.patch);
  assert.ok(patches.length >= 6);
  for (const { id, patch } of patches) {
    assert.equal(patch.art, `flowers/patch-${id}.svg`);
    const svg = await readFile(`src/art/${patch.art}`, 'utf8');
    assert.match(svg, /href="art\/flowers\/patches\.webp"/, id);
    assert.ok(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${patch.size.join(' ')}">`), id);
    assert.ok(patch.foot > 0.8 && patch.foot <= 1, id);
    assert.ok(artOf(catalog).includes(patch.art), id);
  }
});
