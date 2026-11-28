// Every place in every window shape at once: what went wrong one size at a time (a light seam at
// the sides, things planted in the blur, a jump at 3:1, friends too big beside the cottage in a tall
// window, a workshop strip drawing friends as tall as the window) is checked here across a grid of
// sizes, so a later change to the framing or the zoom cannot bring one back unseen.
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { installDom } from './support/dom.mjs';

const { environmentFrame } = await import('../src/yard/environment.js');
const { worldFor } = await import('../src/yard/worlds.js');
const { field, fieldAcross, fieldToYard, geometry, measureYard, petHeight, propZoom, sizeOf, topAt, yardZoom } =
  await import('../src/yard/field.js');
const { scene } = await import('../src/yard/world.js');

const PLACES = ['woodland', 'courtyard', 'lakeside', 'workshop'];
const WIDTHS = [320, 420, 560, 700, 820, 1000, 1180, 1366, 1600, 1920, 2560, 3440, 3840];
const HEIGHTS = [240, 300, 400, 560, 700, 850, 1000, 1080, 1440, 2160];
const EPS = 1e-6;

function yardOf(t) {
  const { nodes } = installDom(t, { ids: ['yard'] });
  const yard = nodes.get('yard');
  yard.dataset.environment = 'illustrated';
  const before = scene.world;
  t.after(() => {
    scene.world = before;
  });
  return (world, width, height) => {
    scene.world = world;
    yard.getBoundingClientRect = () => ({ width, height });
    measureYard();
  };
}

test('every place in every window shape keeps its picture, its field and its friends in proportion', t => {
  const show = yardOf(t);
  const pet = { size: 100 };
  for (const world of PLACES)
    for (const w of WIDTHS)
      for (const h of HEIGHTS) {
        const at = `${world} ${w}x${h}`,
          f = environmentFrame(w, h, { world }),
          safe = worldFor(world).geometry.safe,
          ratio = w / h;
        show(world, w, h);
        // The picture keeps its shape and fills the window's height; its sides, when it has them,
        // are even, and the seam falls inside the window.
        assert.ok(Math.abs(f.width / f.height - 1.5) < EPS, `${at}: stretched`);
        if (f.x > EPS) assert.ok(Math.abs(f.x * 2 + f.width - w) < EPS && f.x < w / 2, `${at}: uneven sides`);
        else assert.ok(f.x + f.width >= w - EPS, `${at}: a gap at the right`);
        assert.ok(f.y + f.height >= h - EPS, `${at}: a gap at the bottom`);
        // From 4:3 to 16:9 the part always seen is all in view.
        if (ratio >= 4 / 3 - EPS && ratio <= 16 / 9 + EPS) {
          const [x0, y0, x1, y1] = safe;
          assert.ok(f.x + x0 * f.width >= -0.5 && f.x + x1 * f.width <= w + 0.5, `${at}: the safe rect is cut across`);
          assert.ok(f.y + y0 * f.height >= -0.5 && f.y + y1 * f.height <= h + 0.5, `${at}: the safe rect is cut down`);
        }
        // Across, the field is the picture: no place of 0 to 1 stands in the blurred sides.
        const span = field(),
          { from, span: wide } = fieldAcross(span);
        assert.ok(span.left >= -EPS && span.right <= w + EPS, `${at}: the field leaves the window`);
        if (f.x > EPS) assert.ok(Math.abs(span.left - f.x) < EPS && Math.abs(span.right - f.x - f.width) < EPS, at);
        for (const x of [0, 0.5, 1]) {
          const px = fieldToYard({ x, y: 0.5 }).x;
          assert.ok(px >= Math.max(0, f.x) && px <= Math.min(w, f.x + f.width), `${at}: x ${x} at ${px}`);
        }
        assert.ok(Math.abs(from + wide - fieldToYard({ x: 1, y: 0 }).x) < EPS, at);
        const box = geometry(pet, 1);
        assert.ok(box.left + box.w + sizeOf(pet) <= span.right + EPS, `${at}: a friend at the right edge sticks out`);
        // The field's top is in the window, and a friend fits between it and the window's foot.
        for (const x of [0, 0.5, 1]) {
          const top = topAt(fieldToYard({ x, y: 0 }).x);
          assert.ok(top >= 0 && top < h, `${at}: the field begins at ${top}`);
        }
        // Friends and what stands with them stay readable and never taller than the window.
        const friends = yardZoom(),
          props = propZoom();
        assert.ok(friends >= 0.35 - EPS && friends <= 2 + EPS, `${at}: friends at ${friends}`);
        assert.ok(props > 0 && props <= 2 + EPS, `${at}: props at ${props}`);
        assert.ok(petHeight(pet) < h * 0.95, `${at}: a friend ${petHeight(pet)} tall`);
        // Outdoors, a friend is never much bigger beside the cottage than the picture allows: no
        // more than the readable floor over the picture's own scale.
        if (worldFor(world).fit !== 'cover-bottom' && ratio < 4 / 3 && h >= 560) {
          const picture = f.width / 1536 / (850 / 1024);
          assert.ok(friends <= Math.max(0.6, picture) * 1.6 + EPS, `${at}: friends ${friends} over picture ${picture}`);
        }
      }
});

test('dragging any window across every width changes nothing at once', t => {
  const show = yardOf(t);
  for (const world of PLACES)
    for (const h of [260, 400, 700, 1080]) {
      let last = null;
      for (let w = Math.round(h * 0.5); w <= h * 4; w += Math.max(2, Math.round(h / 100))) {
        show(world, w, h);
        const f = environmentFrame(w, h, { world }),
          now = { scale: f.width, friends: yardZoom(), props: propZoom(), top: field().top };
        if (last) {
          const at = `${world} ${w}x${h}`;
          for (const key of ['scale', 'friends', 'props'])
            assert.ok(Math.abs(now[key] / last[key] - 1) < 0.05, `${at}: ${key} ${last[key]} -> ${now[key]}`);
          assert.ok(Math.abs(now.top - last.top) < h * 0.03 + 2, `${at}: the field's top ${last.top} -> ${now.top}`);
        }
        last = now;
      }
    }
});
