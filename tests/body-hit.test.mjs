// A friend's cell is wider and taller than its drawing (a standing Daisy covers half its width), so a
// press on the empty part of the cell went to the friend instead of what was beside it. A press
// counts on the drawing of the pose now playing and a little around it: in the yard through a
// hit area inside the body's button, on the desktop in the backend's hovered().
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { bodyBox, cellsIn } from '../src/core/animation.js';

test('a row of cells is measured around every opaque pixel of all its cells', () => {
  const cell = 4,
    height = 5,
    cells = 2,
    rgba = new Uint8ClampedArray(cells * cell * height * 4);
  const put = (x, y, alpha = 255) => {
    rgba[(y * cells * cell + x) * 4 + 3] = alpha;
  };
  assert.equal(bodyBox(rgba, cells, cell, height), null, 'an empty row has no body');
  put(1, 2);
  put(cell + 2, 4);
  assert.deepEqual(bodyBox(rgba, cells, cell, height), [1 / 4, 2 / 5, 3 / 4, 1], 'both cells, laid over each other');
  put(3, 0, 10);
  assert.deepEqual(
    bodyBox(rgba, cells, cell, height),
    [1 / 4, 2 / 5, 3 / 4, 1],
    'a faint shadow pixel is not the body',
  );
});

test('each row is measured over the cells it plays, a look row over its eight directions', () => {
  assert.equal(cellsIn(0), 6, 'idle');
  assert.equal(cellsIn(1), 8, 'walking right');
  assert.equal(cellsIn(3), 4, 'wave');
  assert.equal(cellsIn(9), 8);
  assert.equal(cellsIn(10), 8);
});

test('the yard takes a press on the hit area, not on the whole button', async () => {
  const css = (await readFile('src/styles/friends.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /#pet-layer \.yard-pet\s*\{[^}]*pointer-events:\s*none/);
  assert.match(css, /\.yard-pet > \.yard-hit\s*\{[^}]*pointer-events:\s*auto/);
  assert.match(css, /\.yard-pet > canvas\s*\{[^}]*pointer-events:\s*none/);
});

// A sheet whose every cell has one opaque block: columns 60–131 and rows 40–199 of the cell.
class Sheet {
  complete = true;
  naturalWidth = 1536;
  set src(value) {
    this.url = value;
  }
}
const measured = [];
function strip() {
  let width = 0,
    height = 0;
  return {
    set width(value) {
      width = value;
    },
    get width() {
      return width;
    },
    set height(value) {
      height = value;
    },
    get height() {
      return height;
    },
    getContext: () => ({
      clearRect() {},
      drawImage() {},
      getImageData: (x, y, w, h) => {
        measured.push(w);
        const data = new Uint8ClampedArray(w * h * 4);
        for (let row = 40; row < 200; row++)
          for (let col = 0; col < w; col++) if (col % 192 >= 60 && col % 192 < 132) data[(row * w + col) * 4 + 3] = 255;
        return { data };
      },
    }),
  };
}

test('a friend drawn on a canvas is hit on its drawing and a little more, measured once a row', async t => {
  globalThis.Image = Sheet;
  globalThis.document = { createElement: () => strip() };
  t.after(() => {
    delete globalThis.Image;
    delete globalThis.document;
  });
  const { bodyOf, drawSprite } = await import('../src/core/sprites.js');
  const canvas = strip(),
    pet = { id: 'reach-pet', spriteUrl: 'reach' };
  assert.equal(bodyOf(canvas), null, 'nothing is known before a drawing');
  drawSprite(canvas, pet);
  const box = bodyOf(canvas);
  assert.ok(box[0] < 60 / 192 && box[0] > 48 / 192, `left ${box[0] * 192}`);
  assert.ok(box[2] > 132 / 192 && box[2] < 144 / 192, `right ${box[2] * 192}`);
  assert.ok(
    box[1] < 40 / 208 && Math.abs(box[3] * 208 - 206) < 0.01,
    'from just above the head to just below the feet',
  );
  assert.equal(measured.at(-1), 6 * 192, 'the idle row is measured over its six cells');
  assert.equal(bodyOf(canvas), box, 'the same row is not measured again');
  assert.equal(measured.length, 1);
  drawSprite(canvas, pet, 'right', 0);
  assert.notEqual(bodyOf(canvas), box, 'a walk is measured over its own row');
  assert.equal(measured.at(-1), 8 * 192);
});

test("a companion's own action is hit on the frames it draws, outside the cell too", async () => {
  const { actionBox } = await import('../src/core/sprites.js');
  const clip = {
    scale: 1,
    anchor: [96, 200],
    offset: [-40, 0],
    frames: [
      { rect: [0, 0, 100, 150], foot: [50, 150] },
      { rect: [0, 0, 140, 150], foot: [50, 150] },
    ],
  };
  const [left, top, right, bottom] = actionBox(clip);
  assert.ok(Math.abs(left * 192 - (96 - 50 - 40 - 6)) < 0.01, `left ${left * 192}`);
  assert.ok(Math.abs(right * 192 - (96 - 50 - 40 + 140 + 6)) < 0.01, `right ${right * 192}`);
  assert.ok(Math.abs(top * 208 - (50 - 6)) < 0.01 && Math.abs(bottom * 208 - (200 + 6)) < 0.01);
  assert.equal(actionBox(clip), actionBox(clip), 'measured once a clip');
});

test("the yard's hit area follows the body it is given", async () => {
  const { fitHit } = await import('../src/yard/views.js');
  const v = { canvas: { _drawn: null }, hit: { style: {} } };
  fitHit(v, [0.25, 0.2, 0.75, 1]);
  assert.deepEqual(v.hit.style, { left: '25%', top: '20%', width: '50%', height: '80%' });
  fitHit(v, null);
  assert.deepEqual(v.hit.style, { left: '0%', top: '0%', width: '100%', height: '100%' }, 'unknown: the whole cell');
});
