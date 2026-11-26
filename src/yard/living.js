// The yard alive with nobody touching it (docs/design/2026-11-24-the-yard-plays-like-a-game.md, G3):
// glints on the place's water (stars in it at night), the shadows of clouds passing over the field,
// and tufts of grass in the near corners swaying in the breeze; in the room, dust drifting in the
// window's light. Each is a small layer that CSS alone moves by transform and opacity
// (scenery.css .living-*), placed here from the place's geometry when the place or the yard's size
// changes. Nothing here runs per frame, and nothing repaints the backdrop.
import { seeded } from '../core/math.js';
import { $ } from '../core/state.js';
import { environmentFrame, environmentLake, weatherPanes } from './environment.js';
import { scene } from './world.js';
import { worldAllows, worldFor } from './worlds.js';

const GLINTS = 8,
  MOTES = 7;

/** What moves in `world` for a yard `width` by `height`: glints on its water and dust in its
 * window light (yard pixels, each with a delay in seconds), and which kinds of motion it has
 * (`kinds`, the clouds the sky already moves among them). The same yard always gets the same. */
export function livingPlan(world, width, height) {
  const place = { world },
    outdoors = worldAllows(world, 'ambient'),
    sky = worldAllows(world, 'sky'),
    lake = outdoors ? environmentLake(width, height, place) : null,
    rng = seeded(world.length * 131 + Math.round(width) * 7 + Math.round(height));
  const glints = [];
  if (lake)
    for (let i = 0, tries = 0; glints.length < GLINTS && tries < 60; tries++) {
      const x = lake.ends[0] + (lake.ends[1] - lake.ends[0]) * (0.12 + rng() * 0.76),
        top = lake.shoreAt(x),
        bottom = lake.ridgeAt(x),
        y = top + (bottom - top) * (0.25 + rng() * 0.55);
      if (!Number.isFinite(y) || !lake.onWater(x, y)) continue;
      glints.push({ x: Math.round(x), y: Math.round(y), delay: +(i++ * 0.9 + rng()).toFixed(2) });
    }
  const panes = outdoors
    ? null
    : weatherPanes(width, height, environmentFrame(width, height, place), worldFor(world).windowPanes);
  const motes = [],
    beams = [];
  for (const pane of panes || []) {
    beams.push({
      x: Math.round(pane.x),
      y: Math.round(pane.y),
      width: Math.round(pane.width),
      height: Math.round(pane.height),
    });
    // Dust shows against the window's greenery, not the bright sky through a roof pane.
    if (pane.y <= 0) continue;
    const count = Math.max(2, Math.round((MOTES * pane.width) / width));
    for (let i = 0; i < count && motes.length < MOTES * 2; i++)
      motes.push({
        x: Math.round(pane.x + pane.width * (0.1 + rng() * 0.8)),
        y: Math.round(pane.y + pane.height * (0.15 + rng() * 0.45)),
        delay: +(rng() * 9).toFixed(2),
      });
  }
  return {
    glints,
    motes,
    beams,
    kinds: {
      clouds: sky,
      glints: glints.length > 0,
      shadows: outdoors && sky,
      tufts: outdoors,
      motes: motes.length > 0,
      beams: beams.length > 0,
    },
  };
}

let placed = '';
const dot = (className, { x, y, delay }) => {
  const node = document.createElement('i');
  node.className = className;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  node.style.animationDelay = `${-delay}s`;
  return node;
};
/** Places the living layers for the place and yard size shown now; a repaint of the same place at
 * the same size leaves them as they are. Called by app.js on the yard's repaints and resizes. */
export function renderLiving() {
  const layer = $('living-layer'),
    box = $('yard')?.getBoundingClientRect?.();
  if (!layer || !box?.width) return;
  const key = `${scene.world} ${Math.round(box.width)} ${Math.round(box.height)}`;
  if (key === placed) return;
  placed = key;
  const plan = livingPlan(scene.world, box.width, box.height);
  const shadows = [];
  if (plan.kinds.shadows) {
    const lanes = document.createElement('div');
    lanes.className = 'living-shadows';
    for (const n of [1, 2]) {
      const lane = document.createElement('i');
      lane.className = `living-shadow living-shadow-${n}`;
      lanes.append(lane);
    }
    shadows.push(lanes);
  }
  const tufts = [];
  if (plan.kinds.tufts)
    for (const side of ['left', 'right']) {
      const tuft = document.createElement('i');
      tuft.className = `living-tuft living-tuft-${side}`;
      tufts.push(tuft);
    }
  const beams = plan.beams.map(beam => {
    const node = document.createElement('i');
    node.className = 'living-beam';
    Object.assign(node.style, {
      left: `${beam.x}px`,
      top: `${beam.y}px`,
      width: `${beam.width}px`,
      height: `${beam.height * 2.4}px`,
    });
    return node;
  });
  layer.replaceChildren(
    ...shadows,
    ...beams,
    ...plan.glints.map(g => dot('living-glint', g)),
    ...plan.motes.map(m => dot('living-mote', m)),
    ...tufts,
  );
}
