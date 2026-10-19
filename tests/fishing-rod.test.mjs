import assert from 'node:assert/strict';
import test from 'node:test';

test('the illustrated rod connects its actual grip and terminal guide to the fishing geometry', async () => {
  const { rodPlacement, ROD } = await import('../src/yard/fishing-rod.js');
  for (const [grip, tip] of [
    [
      { x: 100, y: 200 },
      { x: 180, y: 130 },
    ],
    [
      { x: 30, y: 80 },
      { x: 60, y: 50 },
    ],
  ]) {
    const m = rodPlacement(grip, tip);
    for (const [source, target] of [
      [ROD.grip, grip],
      [ROD.tip, tip],
    ]) {
      assert.ok(Math.abs(m.a * source.x + m.c * source.y + m.e - target.x) < 1e-8);
      assert.ok(Math.abs(m.b * source.x + m.d * source.y + m.f - target.y) < 1e-8);
    }
    assert.equal(m.a, m.d);
    assert.equal(m.b, -m.c);
  }
});

test('the cast tip stays between the hand and the float on either side', async () => {
  const { castGeometry } = await import('../src/yard/fishing-rod.js');
  for (const float of [
    { x: 180, y: 140 },
    { x: 20, y: 140 },
  ]) {
    const grip = { x: 100, y: 180 };
    const cast = castGeometry(grip, float, 80, 100);
    assert.ok(cast.tip.y < grip.y, 'the rod lifts above the hand');
    assert.ok(
      Math.min(grip.x, float.x) < cast.tip.x && cast.tip.x < Math.max(grip.x, float.x),
      'the line continues outward from the rod instead of returning behind it',
    );
    assert.equal(cast.float, float);
  }
});

test('the fishing line begins at the rod tip and ends just above the float', async () => {
  const { linePath } = await import('../src/yard/fishing-rod.js');
  for (const [tip, float, bend] of [
    [{ x: 70, y: 90 }, { x: 170, y: 180 }, 3],
    [{ x: 170, y: 90 }, { x: 70, y: 180 }, -3],
  ]) {
    assert.equal(
      linePath(tip, float),
      `M${tip.x} ${tip.y}Q${(tip.x + float.x) / 2 + bend} ${(tip.y + float.y) / 2 + 5} ${float.x} ${float.y - 6}`,
    );
  }
});

test('a nearby cast moves outward within the water instead of crossing the pet face', async () => {
  const { castLandingX } = await import('../src/yard/fishing-rod.js');
  assert.equal(castLandingX(100, 110, 100, [80, 240]), 170);
  assert.equal(castLandingX(200, 190, 100, [80, 240]), 130);
  assert.equal(castLandingX(100, 200, 100, [80, 240]), 200, 'a distant chosen target stays put');
  assert.equal(castLandingX(100, 105, 100, [90, 130]), 122, 'a small pond keeps the float in the water');
  assert.equal(castLandingX(100, 100, 100, [95, 105]), 100, 'a pond without safe interior is unchanged');
});

test('an authored rod tip follows the cropped frame anchor and displayed pet scale', async () => {
  const rod = await import('../src/yard/fishing-rod.js');
  const action = {
    clip: { heldTool: true, anchor: [96, 199], scale: 1, frames: [{ foot: [96, 199], tip: [150, 40] }] },
    frame: { foot: [96, 199], tip: [170, 60] },
  };
  assert.deepEqual(rod.authoredRodTip(action, { x: 10, y: 20, width: 96, height: 104 }), { x: 95, y: 50 });
  assert.deepEqual(rod.authoredRodTip(action, { x: 10, y: 20, width: 96, height: 104 }, true), { x: 85, y: 40 });
  assert.equal(
    rod.authoredRodTip(
      { ...action, clip: { ...action.clip, heldTool: false } },
      { x: 0, y: 0, width: 96, height: 104 },
    ),
    null,
  );
  assert.equal(
    rod.authoredRodTip(
      { ...action, frame: { foot: [96, 199], tip: [NaN, 40] } },
      { x: 0, y: 0, width: 96, height: 104 },
    ),
    null,
  );
});

test('overscan artwork offsets keep the held rod aligned without shrinking the pet', async () => {
  const { authoredRodTip } = await import('../src/yard/fishing-rod.js');
  const action = {
    clip: { heldTool: true, canvas: [224, 216], offset: [0, -8], anchor: [96, 207], scale: 1 },
    frame: { foot: [96, 207], tip: [214, 24] },
  };
  assert.deepEqual(authoredRodTip(action, { x: 100, y: 200, width: 192, height: 208 }), { x: 314, y: 216 });
  assert.deepEqual(authoredRodTip(action, { x: 100, y: 200, width: 96, height: 104 }), { x: 207, y: 208 });
});
