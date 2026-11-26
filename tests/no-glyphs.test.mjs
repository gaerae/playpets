// A symbol drawn as text comes out in each system's own font: an emoji on one, a plain glyph or a
// box on another. The yard's marks (hearts, sparkles, a tick, a flower, a star, a cross) are
// pictures of its own (src/art/ambient/, the line icons in src/core/icons.js), never characters.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const GLYPHS = /[♥♡❤★☆✓✔✕✖✗✘✦✧✿❀❁×]/u;
async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const at = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(at);
    else if (/\.(js|css|html)$/.test(entry.name)) yield at;
  }
}
// What a person never sees: comments, in JS, CSS and HTML. Taken out until none is left, so one
// that a removal joins back together goes too.
const without = (text, pattern, keep = '') => {
  for (let before; before !== text;) {
    before = text;
    text = text.replace(pattern, keep);
  }
  return text;
};
const uncommented = source =>
  without(without(without(source, /\/\*[\s\S]*?\*\//g), /<!--[\s\S]*?-->/g), /(^|[^:'"`\\])\/\/.*$/gm, '$1');

test('no mark is drawn as a character, in the page or in the string tables', async () => {
  const found = [];
  for await (const file of files('src')) {
    // A size such as 1536 × 1024 is a sentence's own multiplication sign, not a mark.
    const lines = uncommented(await readFile(file, 'utf8'))
      .replace(/\d\s*×\s*\d/g, '')
      .split('\n');
    lines.forEach((line, i) => GLYPHS.test(line) && found.push(`${file}:${i + 1}: ${line.trim().slice(0, 80)}`));
  }
  assert.deepEqual(found, []);
});
