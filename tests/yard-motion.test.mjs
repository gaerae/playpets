// How the yard moves between the drawings: friends smaller the farther back they stand, a step
// that bobs, and trees and flowers that sway in the breeze, all on the compositor.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DEPTH_FAR, depthScale } from '../src/yard/field.js';

const uncommented = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
// The body of each block that opens at `{` after a matching head, braces balanced.
function blocks(css, head) {
  const found = [];
  for (const match of css.matchAll(head)) {
    let depth = 0,
      at = css.indexOf('{', match.index);
    const start = at;
    do {
      if (css[at] === '{') depth++;
      else if (css[at] === '}') depth--;
      at++;
    } while (depth && at < css.length);
    found.push({ head: match[0].trim(), body: css.slice(start + 1, at - 1) });
  }
  return found;
}
const keyframes = (css, name) => blocks(css, new RegExp(`@keyframes\\s+${name}\\b`, 'g'));
// Keyframes that run on the compositor: a transform (or one of its parts) and opacity, no variable.
function compositorOnly(frames) {
  assert.ok(frames.length > 0, 'the keyframes are there');
  for (const { head, body } of frames) {
    assert.ok(!body.includes('var('), `${head} reads no variable`);
    for (const [, property] of body.matchAll(/([\w-]+)\s*:/g))
      assert.ok(
        ['transform', 'translate', 'rotate', 'scale', 'opacity'].includes(property),
        `${head} moves ${property}`,
      );
  }
}
const reducedRules = css =>
  blocks(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/g)
    .map(b => b.body)
    .join('\n');

test('a friend farther back stands smaller, down to a set size at the ridge', () => {
  assert.equal(depthScale(1), 1, 'at the front edge a friend is its own size');
  assert.equal(depthScale(0), DEPTH_FAR, 'at the ridge it is smallest');
  assert.ok(DEPTH_FAR >= 0.75 && DEPTH_FAR < 1, 'far is smaller, not tiny');
  let last = 0;
  for (let y = 0; y <= 1; y += 0.05) {
    assert.ok(depthScale(y) >= last, 'nearer is never smaller');
    last = depthScale(y);
  }
  assert.equal(depthScale(-1), DEPTH_FAR, 'a place off the field is held to it');
  assert.equal(depthScale(2), 1);
});

test('a walking friend bobs on the compositor, and not with reduced motion', async () => {
  const css = uncommented(await readFile('src/styles/friends.css', 'utf8'));
  const walking = blocks(css, /\.yard-pet\.walking\s*>\s*canvas\s*(?=\{)/g);
  assert.ok(
    walking.some(b => /animation:\s*stroll\b/.test(b.body)),
    'a walking friend runs the stroll',
  );
  compositorOnly(keyframes(css, 'stroll'));
  // A step moves the parts of a transform, so a press (transform) still squashes a walking friend.
  for (const { body } of keyframes(css, 'stroll'))
    assert.doesNotMatch(body, /(^|[\s;{])transform\s*:/, 'the stroll leaves transform to a press');
  assert.match(reducedRules(css), /\.yard-pet\.walking\s*>\s*canvas\s*\{[^}]*animation:\s*none/);
});

test('trees and flowers sway outdoors on the compositor, and not with reduced motion', async () => {
  const css = uncommented(await readFile('src/styles/garden.css', 'utf8'));
  compositorOnly(keyframes(css, 'breeze'));
  const swaying = blocks(css, /[^{}]*(?=\{[^{}]*animation:\s*breeze)/g)
    .map(b => b.head)
    .filter(Boolean);
  assert.ok(swaying.length > 0, 'something sways');
  for (const head of swaying) {
    assert.match(head, /\.(planted-tree|plant)\b/, `${head} is a tree or a flower`);
    assert.match(head, /data-sky="false"/, `${head} leaves an indoor place still`);
  }
  assert.ok(!/\.decor\b/.test(swaying.join(' ')), 'gifts, and the ornaments hung on them, stay still');
  assert.match(reducedRules(css), /animation:\s*none/);
});
