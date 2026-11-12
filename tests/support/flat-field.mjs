// A field whose top is its line all the way across: every place's geometry.edge set aside for one
// test. For tests of what moves on the field (drags, arrow keys, arrivals); field-edge.test.mjs
// covers the edge itself.
import { worlds } from '../../src/yard/worlds.js';

export function flatField(t) {
  const kept = worlds.map(world => [world, world.geometry]);
  for (const world of worlds) if (world.geometry?.edge) world.geometry = { ...world.geometry, edge: undefined };
  t.after(() => {
    for (const [world, geometry] of kept) world.geometry = geometry;
  });
}
