// How the yard moves between the drawings: friends smaller the farther back they stand, a step
// that bobs, a walk that glides between frames, and trees and flowers that sway in the breeze, all
// on the compositor.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { halt, moveTo } from '../src/core/ticker.js';
import { DEPTH_FAR, depthScale } from '../src/yard/field.js';
import { GLIDE_MS } from '../src/yard/views.js';
import { element, installDom } from './support/dom.mjs';

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

// The frame loops move a friend in steps (the yard's every BUSY_MS, the desktop's every TICK). While
// one moves, a linear glide a little longer than a step carries it to each new place, so a step
// that comes late never shows a stop and the friend never falls far behind where it is.
const frameOf = async (file, pattern) => Number((await readFile(file, 'utf8')).match(pattern)[1]);
test('a moving friend glides for a little longer than a step of its loop', async () => {
  const yard = await frameOf('src/app.js', /const BUSY_MS = (\d+)/),
    desktop = await frameOf(
      'src-tauri/src/desktop/overlay.rs',
      /const TICK: Duration = Duration::from_millis\((\d+)\)/,
    ),
    { GLIDE_MS: desktopGlide } = await import('../src/overlay/glide.js');
  for (const [glide, step] of [
    [GLIDE_MS, yard],
    [desktopGlide, desktop],
  ])
    assert.ok(glide > step && glide <= step * 1.5, `a ${glide}ms glide for a ${step}ms step`);
});

// A friend dragged from one screen to another is drawn there by that screen's window, which never
// had the press: pointer capture stays with the first. The layout row says it is held (overlay.rs),
// so it follows the pointer there too, with no glide behind it.
test('a desktop friend held follows the pointer at once on every screen', async () => {
  const { GLIDE_MS: desktopGlide, glideMs } = await import('../src/overlay/glide.js');
  assert.equal(glideMs({ drag: null }, {}, false), desktopGlide, 'a stroll glides');
  assert.equal(glideMs({ drag: { x: 0, y: 0 } }, {}, false), 0, 'held in the window it was pressed in');
  assert.equal(glideMs({ drag: null }, { dragging: true }, false), 0, 'held, drawn by another screen');
  assert.equal(glideMs({ drag: null }, {}, true), 0, 'with reduced motion');
});

// A fake node that records the glides started on it.
function gliding() {
  const node = element('div', {
    animate(frames, options) {
      const glide = { frames, options, cancelled: false, cancel: () => (glide.cancelled = true) };
      node.glides.push(glide);
      return glide;
    },
  });
  node.glides = [];
  return node;
}
// A timer on battery in Windows ticks every 15.6 ms: a 50 ms frame comes at 46.9 or 62.5 ms, and
// one two ticks late at 78. The glide to a step lasts until the next is likely to come: the gap
// since the last step and one more tick, never shorter than the glide for a frame on time, and no
// longer than twice that. A step after a long rest is a new walk, glided as one on time.
test('a step that comes late is glided into until the next is likely to come, so the friend never stops', async t => {
  const { document } = installDom(t);
  const { GLIDE_MS: desktopGlide } = await import('../src/overlay/glide.js');
  for (const glide of [GLIDE_MS, desktopGlide]) {
    document.timeline = { currentTime: 1000 };
    const node = gliding();
    moveTo(node, 'translate', [0, 0], glide);
    moveTo(node, 'translate', [1, 0], glide);
    const lasts = (gap, x) => {
      document.timeline.currentTime += gap;
      moveTo(node, 'translate', [x, 0], glide);
      return node.glides.at(-1).options.duration;
    };
    assert.equal(lasts(20, 2), glide, 'a step on time glides for the usual time');
    assert.equal(lasts(62.5, 3), Math.max(glide, 78.5), 'a tick late: until a tick after the gap');
    assert.equal(lasts(78, 4), 94, 'two ticks late');
    assert.equal(lasts(glide * 2 - 1, 5), glide * 2, 'no longer than twice the usual');
    assert.equal(lasts(5000, 6), glide, 'after a rest, a new walk');
  }
});

test('a glide goes on from where the friend shows, from the time of the frame it shows in', t => {
  const { document } = installDom(t);
  document.timeline = { currentTime: 1000 };
  const node = gliding();
  moveTo(node, 'translate', [10, 20], 64);
  assert.equal(node.style.translate, '10px 20px');
  assert.deepEqual(node.glides, [], 'its first place is taken at once, not slid into from the corner');
  moveTo(node, 'translate', [74, 20], 64);
  const [first] = node.glides;
  assert.deepEqual(first.frames, [{ translate: '10px 20px' }, { translate: '74px 20px' }]);
  assert.deepEqual(first.options, { duration: 64, easing: 'linear' });
  assert.equal(first.startTime, 1000, 'it starts at the timeline time, not a frame later');
  assert.equal(node.style.translate, '74px 20px', 'where it ends is written, so it stays there');
  // Half way there, the next step goes on from half way.
  document.timeline.currentTime = 1032;
  moveTo(node, 'translate', [106, 20], 64);
  assert.equal(first.cancelled, true);
  assert.deepEqual(node.glides[1].frames, [{ translate: '42px 20px' }, { translate: '106px 20px' }]);
  moveTo(node, 'translate', [106, 20], 64);
  assert.equal(node.glides.length, 2, 'the same place starts nothing');
  // At once: what was under way ends where it was going.
  moveTo(node, 'translate', [0, 0]);
  assert.equal(node.glides[1].cancelled, true);
  assert.equal(node.style.translate, '0px 0px');
  const label = gliding();
  moveTo(label, 'transform', [1, 2], 64);
  moveTo(label, 'transform', [3, 4], 64);
  assert.deepEqual(label.glides[0].frames, [{ transform: 'translate(1px,2px)' }, { transform: 'translate(3px,4px)' }]);
  halt(label);
  assert.equal(label.glides[0].cancelled, true);
  assert.equal(label.style.transform, 'translate(3px,4px)');
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
    assert.match(head, /data-soil="false"/, `${head} leaves a floor without soil still`);
  }
  assert.ok(!/\.decor\b/.test(swaying.join(' ')), 'gifts, and the ornaments hung on them, stay still');
  assert.match(reducedRules(css), /animation:\s*none/);
});

// props.js setDown places these by their transform. The base button rule eases a transform, which
// would trail each drag step behind the pointer and catch up only after the drop. A fade in front of
// a friend (veil.js) eases its opacity alone.
test('what stands on the field follows the pointer: no easing on the transform that places it', async () => {
  const css = uncommented(
    (await Promise.all(['garden.css', 'play.css'].map(f => readFile(`src/styles/${f}`, 'utf8')))).join('\n'),
  );
  for (const name of ['plant', 'shoot', 'decor', 'planted-tree', 'snowball']) {
    const base = blocks(css, new RegExp(`(^|\\})\\s*\\.${name}\\s*(?=\\{)`, 'g'));
    assert.equal(base.length, 1, `.${name} has one base rule`);
    assert.match(
      base[0].body,
      /(^|;)\s*transition:\s*(none|opacity [^;,]+)\s*(;|$)/,
      `.${name} is not eased into place`,
    );
  }
});

test('a tree or a flower held in a drag stops swaying where it leans, and goes on from there', async () => {
  const css = uncommented(await readFile('src/styles/garden.css', 'utf8'));
  for (const name of ['plant', 'planted-tree']) {
    const held = blocks(css, new RegExp(`\\.${name}\\.dragging[^,{\\s]*\\s+svg\\s*(?=[,{])`, 'g'));
    assert.ok(
      held.some(b => /animation-play-state:\s*paused/.test(b.body)),
      `a dragged .${name} pauses its breeze instead of snapping upright`,
    );
  }
});

// A filter on the element the breeze moves is drawn again with each step of the sway; the light
// drawn inside it is drawn once and moves with it.
test('a swaying tree or flower carries its light inside, not on the drawing the breeze moves', async () => {
  const css = uncommented(await readFile('src/styles/garden.css', 'utf8'));
  for (const name of ['plant', 'planted-tree']) {
    for (const { head, body } of blocks(css, new RegExp(`[^{}]*\\.${name}[^{},]*\\ssvg\\s*(?=\\{)`, 'g')))
      assert.doesNotMatch(body, /var\(--prop-light/, `${head} takes no light`);
    const inside = blocks(css, new RegExp(`(^|\\})\\s*\\.${name} svg > use\\s*(?=\\{)`, 'g'));
    assert.match(inside[0]?.body || '', /filter:\s*var\(--prop-light, none\)/, `.${name}'s drawing takes the light`);
  }
});

test('each tree and flower keeps its own beat when others come and go', async () => {
  const css = uncommented(await readFile('src/styles/garden.css', 'utf8'));
  // A beat by place in the layer changes for everything after a thing that comes or goes, and a new
  // delay makes a running sway jump.
  assert.doesNotMatch(css, /:nth-child\([^)]*\)\s*\{[^}]*--sway/, 'no beat comes from a place in the layer');
});
