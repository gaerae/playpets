// A friend standing behind a planted tree, a shoot, a flower or a gift drawn in front of it is
// rightly hidden by it, but a person sees the friend vanish with only a hat showing and its name
// tag pinned to the trunk. While a thing covers most of a friend, it fades (garden.css .veiled),
// and comes back when the friend steps out.
//
// Worked out from boxes kept when they are placed, never by measuring the page: a thing's as it is
// set down (props.js setDown), a friend's as it is placed (views.js place), which during a walk is
// each step at the yard's pace. A step that does not move the friend compares nothing; one that
// does compares it only with the things in the strips of the yard its body spans (COLUMN), and
// those it stood behind, which it may have left.
import { drawnBox } from './field.js';

/** How much of a friend's body a thing in front must cover for the thing to fade. */
export const VEIL_COVER = 0.6;
// What fades (garden.css); the snowman game's balls are set down too, and do not.
const FADES = ['plant', 'shoot', 'decor', 'planted-tree'];
// The yard is cut into strips this many pixels wide, and each thing is kept under every strip
// its drawing spans.
const COLUMN = 96;

// A box is wider than what is drawn in it: a friend's sprite cell has empty sides, and a tree's or
// a tent's drawing empty corners. What is compared is the inner part: a friend's body (the middle
// half of its cell, above its feet) and the middle of a drawing. With whole boxes, a tent beside a
// friend and a tree just behind one faded too.
const body = ({ x, y, width, height }, z) => ({ x: x + width / 4, y, width: width / 2, height: height * 0.85, z });
const inner = ({ x, y, width, height, z }) => ({ x: x + width * 0.15, y, width: width * 0.7, height, z });

// Each thing on the field (its button) → the middle of its drawing, its depth, and whom it covers.
const things = new Map();
// Each friend that can be covered → its body's box and depth, and the things it stands behind.
const friends = new Map();
// Each strip of the yard → the things drawn across it.
const columns = new Map();

/** Whether `thing` (a box with its depth z) is drawn in front of `friend` (its body's box and
 * depth) and covers most of it. */
export function covers(thing, friend) {
  if (!(thing.z > friend.z)) return false;
  const w = Math.min(thing.x + thing.width, friend.x + friend.width) - Math.max(thing.x, friend.x);
  if (w <= 0) return false;
  const h = Math.min(thing.y + thing.height, friend.y + friend.height) - Math.max(thing.y, friend.y);
  return h > 0 && w * h >= VEIL_COVER * friend.width * friend.height;
}

const same = (a, b) =>
  a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height && a.z === b.z);

function* strips({ x, width }) {
  for (let c = Math.floor(x / COLUMN); c <= Math.floor((x + width) / COLUMN); c++) yield c;
}
function file(button, box) {
  for (const c of strips(box)) {
    if (!columns.has(c)) columns.set(c, new Set());
    columns.get(c).add(button);
  }
}
function unfile(button, box) {
  for (const c of strips(box)) columns.get(c)?.delete(button);
}

/** The things drawn across the strips of the yard that `box` spans. */
export function thingsNear(box) {
  const near = new Set();
  for (const c of strips(box)) for (const button of columns.get(c) || []) near.add(button);
  return near;
}

// The class is written only when whether it covers anyone changes.
function show(button, entry) {
  const veiled = entry.covering.size > 0;
  if (entry.veiled === veiled) return;
  entry.veiled = veiled;
  button.classList.toggle('veiled', veiled);
}
// Whether the thing covers the friend, kept on both sides.
function mark(button, entry, id, friend, covered) {
  if (covered === entry.covering.has(id)) return;
  if (covered) {
    entry.covering.add(id);
    friend?.behind.add(button);
  } else {
    entry.covering.delete(id);
    friend?.behind.delete(button);
  }
  show(button, entry);
}

/** A thing set down or moved: `box` is its drawing in yard pixels and `z` its depth. */
export function thingAt(button, box) {
  if (!FADES.some(kind => button.classList.contains(kind))) return;
  let entry = things.get(button);
  if (entry) unfile(button, entry.box);
  else things.set(button, (entry = { box: null, covering: new Set(), veiled: false }));
  entry.box = inner(box);
  file(button, entry.box);
  for (const [id, friend] of friends) mark(button, entry, id, friend, covers(entry.box, friend.box));
}

/** A thing taken off the field (props.js reconcile): it covers no one, and is forgotten. */
export function thingGone(button) {
  const entry = things.get(button);
  if (!entry) return;
  for (const id of entry.covering) friends.get(id)?.behind.delete(button);
  entry.covering.clear();
  show(button, entry);
  unfile(button, entry.box);
  things.delete(button);
}

/** A friend placed or changed: where it is drawn now (field.js drawnBox, its depth v.z). A friend
 * that is not shown, or is hiding in the game, covers nothing: a hiding place is not given away. */
export function friendAt(v) {
  const id = v.pet.id;
  const box = v.button.hidden || v.button.classList.contains('hiding') ? null : body(drawnBox(v), v.z);
  const friend = friends.get(id);
  if (same(friend?.box || null, box)) return;
  if (!box) return friendGone(id);
  const now = friend || { box, behind: new Set() };
  now.box = box;
  friends.set(id, now);
  for (const button of new Set([...now.behind, ...thingsNear(box)])) {
    const entry = things.get(button);
    if (entry) mark(button, entry, id, now, covers(entry.box, box));
  }
}

/** A friend that left the yard uncovers what it stood behind. */
export function friendGone(id) {
  const friend = friends.get(id);
  if (!friend) return;
  friends.delete(id);
  for (const button of friend.behind) {
    const entry = things.get(button);
    if (entry) mark(button, entry, id, null, false);
  }
}
