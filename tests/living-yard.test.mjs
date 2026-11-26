// The yard is alive with nobody touching it (docs/design/2026-11-24-the-yard-plays-like-a-game.md,
// G3): each place shows at least three kinds of motion, all on small layers that CSS moves by
// transform and opacity alone, placed from the place's own geometry.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import './support/content.mjs';

const { livingPlan } = await import('../src/yard/living.js');
const { environmentLake } = await import('../src/yard/environment.js');
const { worlds } = await import('../src/yard/worlds.js');

test('every place has at least three kinds of motion, outdoors and in', () => {
  for (const world of worlds.map(w => w.id)) {
    const plan = livingPlan(world, 1180, 850);
    const kinds = Object.entries(plan.kinds).filter(([, on]) => on);
    assert.ok(kinds.length >= 3, `${world}: ${kinds.map(([k]) => k).join(', ')}`);
  }
});

test('glints sit on the water, in the same place for the same yard', () => {
  for (const world of ['woodland', 'courtyard', 'lakeside']) {
    const plan = livingPlan(world, 1180, 850),
      lake = environmentLake(1180, 850, { world });
    assert.ok(plan.glints.length >= 4, `${world} has glints`);
    for (const g of plan.glints) assert.ok(lake.onWater(g.x, g.y), `${world} glint at ${g.x},${g.y} is on the water`);
    assert.deepEqual(livingPlan(world, 1180, 850).glints, plan.glints, 'no glint jumps on a repaint');
  }
  assert.deepEqual(livingPlan('workshop', 1180, 850).glints, [], 'the room has no water');
});

test("the room's dust drifts in its window light", () => {
  const plan = livingPlan('workshop', 1180, 850);
  assert.ok(plan.motes.length >= 4);
  assert.ok(plan.beams.length >= 1, 'a soft shaft of light from the window');
  assert.equal(plan.kinds.tufts, false, 'no grass indoors');
  assert.equal(plan.kinds.shadows, false, 'no cloud shadows on a floor');
  for (const m of plan.motes) assert.ok(m.x >= 0 && m.x <= 1180 && m.y >= 0 && m.y <= 850);
});

test('the living layers move by transform and opacity only, and rest with reduced motion', async () => {
  const css = (await readFile('src/styles/scenery.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  for (const name of ['living-glint', 'living-shadow', 'living-mote', 'living-beam']) {
    const frames = css.match(new RegExp(`@keyframes ${name}\\s*\\{([\\s\\S]*?\\n)\\}`))?.[1];
    assert.ok(frames, `${name} is defined`);
    const properties = [...frames.matchAll(/([\w-]+)\s*:/g)].map(m => m[1]);
    assert.deepEqual(
      [...new Set(properties)].filter(p => p !== 'transform' && p !== 'opacity'),
      [],
      name,
    );
    assert.doesNotMatch(frames, /var\(/, `${name} reads no custom property`);
  }
  const rules = [...css.matchAll(/([^{}]*\.living-[\w-]+[^{}]*)\{([^{}]*)\}/g)];
  for (const [, selector, body] of rules)
    if (/animation\s*:/.test(body))
      assert.doesNotMatch(body, /filter\s*:/, `${selector.trim()} moves without a filter`);
  // Clouds' shadows only on a clear day, and none at night or in the rain.
  assert.match(
    css,
    /\.yard:is\(\.period-night, \.period-evening, :not\(\.weather-clear\)\) \.living-shadows\s*\{[^}]*display:\s*none/,
  );
});
