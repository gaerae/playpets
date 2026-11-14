// A friend standing behind a planted tree, a shoot, a flower or a gift drawn in front of it is
// rightly hidden by it, but a person sees the friend vanish with only a hat showing and its name
// tag pinned to the trunk. While a thing covers most of a friend, it fades (garden.css .veiled),
// and comes back when the friend steps out.
//
// Worked out from boxes kept when they are placed: a thing's as it is set down (props.js setDown),
// a friend's as it is placed or takes a step of a walk (views.js place), not each frame, and never
// by measuring the page. A friend's step tests each thing's box with a few comparisons and goes
// further only for one it overlaps; a step that does not move it tests nothing.
import { drawnBox } from './field.js';

/** How much of a friend's body a thing in front must cover for the thing to fade. */
export const VEIL_COVER = 0.6;

// A box is wider than what is drawn in it: a friend's sprite cell has empty sides, and a tree's or
// a tent's drawing empty corners. What is compared is the inner part: a friend's body (the middle
// half of its cell, above its feet) and the middle of a drawing. With whole boxes, a tent beside a
// friend and a tree just behind one faded too.
const body = ({ x, y, width, height }, z) => ({ x: x + width / 4, y, width: width / 2, height: height * 0.85, z });
const inner = ({ x, y, width, height, z }) => ({ x: x + width * 0.15, y, width: width * 0.7, height, z });

// Each thing on the field (its button) → the middle of its drawing, its depth, and whom it covers.
const things = new Map();
// Each friend that can be covered → its body's box and depth, as last worked out.
const friends = new Map();

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

// The class is written only when whether it covers anyone changes.
function show(button, entry) {
  const veiled = entry.covering.size > 0;
  if (entry.veiled === veiled) return;
  entry.veiled = veiled;
  button.classList.toggle('veiled', veiled);
}

/** A thing set down or moved: `box` is its drawing in yard pixels and `z` its depth. */
export function thingAt(button, box) {
  let entry = things.get(button);
  if (!entry) things.set(button, (entry = { box, covering: new Set(), veiled: false }));
  entry.box = inner(box);
  entry.covering.clear();
  for (const [id, friend] of friends) if (covers(entry.box, friend)) entry.covering.add(id);
  show(button, entry);
}

/** A friend placed or changed: where it is drawn now (field.js drawnBox, its depth v.z). A friend
 * that is not shown, or is hiding in the game, covers nothing: a hiding place is not given away. */
export function friendAt(v) {
  const id = v.pet.id;
  const box = v.button.hidden || v.button.classList.contains('hiding') ? null : body(drawnBox(v), v.z);
  if (same(friends.get(id) || null, box)) return;
  if (box) friends.set(id, box);
  else friends.delete(id);
  for (const [button, entry] of things) {
    // A thing taken off the field is forgotten the next time a friend moves.
    if (button.isConnected === false) {
      things.delete(button);
      continue;
    }
    const covered = !!box && covers(entry.box, box);
    if (covered === entry.covering.has(id)) continue;
    if (covered) entry.covering.add(id);
    else entry.covering.delete(id);
    show(button, entry);
  }
}

/** A friend that left the yard uncovers what it stood behind. */
export function friendGone(id) {
  if (!friends.delete(id)) return;
  for (const [button, entry] of things) if (entry.covering.delete(id)) show(button, entry);
}
