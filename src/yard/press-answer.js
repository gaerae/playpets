// A press on a flower, a tree or a gift answers, the same in the yard (garden.js, planted-trees.js,
// decor.js) and on the desktop (overlay.js): a flower bobs from its foot and drops a few of its own
// petals, a tree rustles and lets a few leaves go in the colours it wears now (snow off its
// branches in winter), and a gift bobs. Each is one short CSS animation (styles/answer.css) and a
// few small bits that remove themselves, so nothing joins the frame loop; with reduced motion there
// is none. The yard's and the desktop's stylesheets say which drawing moves. Now and then a friend
// standing near says something about it (remarker), with the lines it says when it visits one.

import { flowerKind, treeKind } from './catalog.js';

// A tree's leaves by what it wears: fresh or deep green, its autumn colours once it has them, and
// snow in winter, on an evergreen too.
const GREEN = ['#93c45a', '#c7de7e'];
const AUTUMN = ['#e0873a', '#f0b847'];
const SNOW = ['#ffffff', '#e9f1fa'];
// How long the longest bit takes to land and fade (styles/answer.css answer-fall, plus its delay).
const BIT_MS = 1900;
// No more than this many bits on one thing at a time, however fast it is pressed.
const MOST_BITS = 8;

/** How a press on `what` ("plant", "tree" or "gift") of `kind` in `season` answers: its motion, the
 * kind of bit it lets go ("petal", "leaf", "snow" or null), their colours and how many; null for a
 * kind the catalogue does not have. */
export function answerOf({ what, kind, season }) {
  if (what === 'plant') {
    const flower = flowerKind(kind);
    if (!flower) return null;
    const { petal, 'petal-hi': light } = flower.colors || {};
    return { motion: 'bob', bit: 'petal', colors: [petal, light].filter(Boolean), count: 3 };
  }
  if (what === 'tree') {
    const tree = treeKind(kind);
    if (!tree) return null;
    if (season === 'winter') return { motion: 'rustle', bit: 'snow', colors: SNOW, count: 4 };
    const turned = season === 'autumn' && !!tree.seasonArt?.autumn;
    return { motion: 'rustle', bit: 'leaf', colors: turned ? AUTUMN : GREEN, count: 3 };
  }
  return { motion: 'bob', bit: null, colors: [], count: 0 };
}

// How often a press has a friend say something about what was pressed, and how near (in pixels,
// on the desktop and in the yard alike) the friend must stand to see it.
export const REMARK = { chance: 0.4, reach: 360 };
/** The friend among `friends` who says something about a press, now and then: the nearest by
 * `away` (its distance in pixels) within reach, or null. */
export function remarker(friends, away, { random = Math.random } = {}) {
  if (random() >= REMARK.chance) return null;
  let best = null,
    bestD = REMARK.reach;
  for (const friend of friends) {
    const d = away(friend);
    if (d <= bestD) [best, bestD] = [friend, d];
  }
  return best;
}

/** Where each bit of `look` starts in a drawing of `box` ({ width, height } in pixels), as shares of
 * it (x, y), how far it drifts (dx) and falls (fall) in pixels, how it turns, its colour and its
 * delay in ms: from the drawing's upper half, spread across it, landing about at its foot. */
export function bitsOf(look, box, random = Math.random) {
  return Array.from({ length: look.count }, (_, i) => {
    // Each in its own share of the width, so two never start on top of each other.
    const x = 0.2 + ((i + 0.2 + random() * 0.6) / look.count) * 0.6,
      y = 0.15 + random() * 0.35;
    return {
      x,
      y,
      dx: Math.round((random() - 0.5) * 40),
      fall: Math.round(box.height * (0.88 + random() * 0.1 - y)),
      turn: Math.round((random() - 0.5) * 360),
      color: look.colors[i % look.colors.length],
      delay: Math.round(i * 90 + random() * 120),
    };
  });
}

// A thing's own animations, which the answer's would take the place of (answer.css sets `animation`
// on the same drawing): arriving (garden.css, overlay.css) and a Christmas tree turning grand or
// looking up at its star (worn.css, garden.css).
const OWN = ['arrive', 'arrive-pop', 'xmas-rise', 'look-up'];
/** Answers a press on `button`, whose drawing moves by its `data-answer` (styles/answer.css), with
 * `look` (answerOf); its bits fall in `into` (the element the drawing fills). A press while the
 * thing plays its own animation answers nothing. */
export function answer(button, look, { into = button, reduced = false, random = Math.random } = {}) {
  if (!look || reduced || OWN.some(name => button.classList.contains(name))) return;
  // From the start again when pressed while it still moves.
  button.classList.remove('answering');
  void button.offsetWidth;
  button.dataset.answer = look.motion;
  button.classList.add('answering');
  clearTimeout(button.answerTimer);
  button.answerTimer = setTimeout(() => button.classList.remove('answering'), 800);
  if (!look.bit || into.querySelectorAll(':scope > .answer-bit').length >= MOST_BITS) return;
  const { width, height } = into.getBoundingClientRect();
  for (const bit of bitsOf(look, { width, height }, random)) {
    const el = document.createElement('i');
    el.className = 'answer-bit';
    el.dataset.bit = look.bit;
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText =
      `left:${(bit.x * 100).toFixed(1)}%;top:${(bit.y * 100).toFixed(1)}%;--c:${bit.color};` +
      `--dx:${bit.dx}px;--fall:${bit.fall}px;--turn:${bit.turn}deg;animation-delay:${bit.delay}ms`;
    into.append(el);
    setTimeout(() => el.remove(), BIT_MS);
  }
}
