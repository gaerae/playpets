import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cellsPath, cropPlacement, shapeHits, solidCells } from '../src/yard/hit-shape.js';
import { element, installDom } from './support/dom.mjs';

test('an atlas crop lands where preserveAspectRatio puts it', () => {
  // A crop twice as tall as wide in a square drawing: half as wide, centred, or at the bottom.
  assert.deepEqual(cropPlacement(40, 40, [100, 200, 50, 100]), { x: 10, y: 0, scale: 0.4 });
  assert.deepEqual(cropPlacement(40, 40, [0, 0, 100, 50], 'xMidYMax meet'), { x: 0, y: 20, scale: 0.4 });
  assert.deepEqual(cropPlacement(40, 40, [0, 0, 100, 50], 'xMinYMin'), { x: 0, y: 0, scale: 0.4 });
  assert.equal(cropPlacement(40, 40, [0, 0, 100, 50], 'none'), null);
  assert.equal(cropPlacement(40, 40, [0, 0, 100, 50], 'xMidYMid slice'), null);
  assert.equal(cropPlacement(40, 40, [0, 0, 0, 50]), null);
});

test('a cell counts as drawn when an eighth of it is opaque, so a thin twig still takes a click', () => {
  // An 8 × 4 map in 4 × 4 cells: the left cell has a two-pixel twig, the right one a faint haze.
  const alpha = new Uint8Array(32);
  alpha[1] = alpha[9] = 255;
  for (const i of [4, 5, 6, 7, 12, 13, 14, 15]) alpha[i] = 60;
  assert.deepEqual(solidCells(alpha, 8, 4, 4), { cells: [true, false], cols: 2, rows: 1 });
  assert.deepEqual(solidCells(new Uint8Array(32), 8, 4, 4).cells, [false, false]);
});

test('each row’s run of drawn cells is one rectangle of the hit path, in drawing units', () => {
  const grid = { cells: [true, true, false, true, false, false, false, true], cols: 4, rows: 2 };
  assert.equal(cellsPath(grid, 4), 'M0 0h8v4h-8zM12 0h4v4h-4zM12 4h4v4h-4z');
  assert.equal(cellsPath({ cells: [false], cols: 1, rows: 1 }, 4), '');
});

test('a tree takes clicks only on its drawn shape once known, and a stale shape never lands', async t => {
  installDom(t);
  const svg = element('svg'),
    laid = () => svg.children.filter(path => !path.removed),
    button = element('button', {
      querySelector: selector => (selector === 'svg' ? svg : selector === '.hit' ? (laid()[0] ?? null) : null),
    });
  button.append(svg);
  let finish;
  const pending = shapeHits(button, 'trees/oak-young.svg', () => new Promise(resolve => (finish = resolve)));
  assert.ok(!button.classList.contains('shaped'), 'the whole box takes clicks until the shape is read');
  // The tree grows before its first shape is read: only the newer drawing's shape is laid.
  const grown = shapeHits(button, 'trees/oak-mature.svg', async () => 'M0 0h4v4h-4z');
  finish('M0 0h8v8h-8z');
  await Promise.all([pending, grown]);
  assert.ok(button.classList.contains('shaped'));
  assert.deepEqual(
    laid().map(path => path.getAttribute('d')),
    ['M0 0h4v4h-4z'],
  );
  // A drawing whose shape cannot be read gives the whole box back, without the old shape.
  await shapeHits(button, 'trees/unread.svg', async () => '');
  assert.ok(!button.classList.contains('shaped'));
  assert.deepEqual(laid(), []);
});

test('a shaped tree or flower passes the pointer through everywhere but its drawn path', () => {
  const css = readFileSync(new URL('../src/styles/garden.css', import.meta.url), 'utf8');
  assert.match(css, /\.plant\.shaped,\s*\.planted-tree\.shaped \{\s*pointer-events: none;\s*\}/);
  assert.match(css, /\.shaped \.hit \{\s*fill: transparent;\s*pointer-events: all;\s*\}/);
});
