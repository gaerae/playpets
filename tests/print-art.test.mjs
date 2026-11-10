import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const PRINTS = ['hare', 'fox', 'water_deer', 'raccoon_dog', 'squirrel', 'sparrow', 'magpie', 'cat'];
const SHAPES = new Set(['path', 'ellipse', 'circle']);
const ELEMENTS = new Set(['svg', 'g', ...SHAPES]);

test('each print is a small soft vector mark that CSS colours', async () => {
  const marks = [];
  for (const id of PRINTS) {
    const svg = await readFile(new URL(`../src/art/prints/${id}.svg`, import.meta.url), 'utf8');
    assert.match(svg, /viewBox="0 0 24 24"/, id);
    assert.doesNotMatch(svg, /<image|<script/i, id);
    assert.doesNotMatch(svg, /\s(stroke[\w-]*|style|id|on\w+)=/i, id);
    const tags = [...svg.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)];
    assert.ok(tags.length > 0, id);
    let shapes = 0;
    for (const [, name, attrs] of tags) {
      assert.ok(ELEMENTS.has(name), `${id}: <${name}>`);
      if (SHAPES.has(name)) {
        shapes++;
        assert.match(attrs, /\sfill="currentColor"/, `${id}: <${name}> fill`);
      }
    }
    assert.ok(shapes >= 2 && shapes <= 16, `${id}: ${shapes} shapes`);
    marks.push(svg.trim());
  }
  assert.equal(new Set(marks).size, PRINTS.length);
});
