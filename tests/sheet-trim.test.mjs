import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { crc32 } from 'node:zlib';
import { decodePng, encodePng } from '../scripts/png-lossless-lib.mjs';
import { keepIfSamePixels, trimPng } from '../scripts/sheet-trim-lib.mjs';

// A 4 × 2 sheet: every pixel a different opaque colour.
const sheet = () => {
  const pixels = Buffer.alloc(4 * 2 * 4);
  for (let i = 0; i < 8; i++) pixels.set([i + 1, 10 * i, 200 - i, 255], i * 4);
  return encodePng(4, 2, pixels);
};

test('a trimmed sheet keeps what is cut and clears the rest to 0,0,0,0', () => {
  const { pixels } = decodePng(trimPng(sheet(), [[1, 0, 2, 1]]));
  for (let i = 0; i < 8; i++) {
    const kept = i === 1 || i === 2;
    assert.deepEqual(
      [...pixels.subarray(i * 4, i * 4 + 4)],
      kept ? [i + 1, 10 * i, 200 - i, 255] : [0, 0, 0, 0],
      `pixel ${i}`,
    );
  }
});

test('a sheet with nothing outside its cuts comes back as the same bytes', () => {
  const bytes = trimPng(sheet(), [[1, 0, 2, 1]]);
  assert.equal(trimPng(bytes, [[1, 0, 2, 1]]), bytes);
  assert.equal(trimPng(sheet(), [[0, 0, 4, 2]]).length, sheet().length);
});

test('a repack keeps the earlier export when its pixels are the same', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'playpets-trim-')),
    file = path.join(folder, 'sheet.png');
  // The same pixels in other bytes, as oxipng would leave them: a text chunk before IEND.
  const text = Buffer.from('tEXtnote\0same', 'latin1'),
    chunk = Buffer.alloc(12 + text.length - 4);
  chunk.writeUInt32BE(text.length - 4);
  text.copy(chunk, 4);
  chunk.writeUInt32BE(crc32(text), 4 + text.length);
  const smaller = Buffer.concat([sheet().subarray(0, -12), chunk, sheet().subarray(-12)]);
  await writeFile(file, sheet());
  await keepIfSamePixels(file, smaller);
  assert.ok((await readFile(file)).equals(smaller));
  const other = trimPng(sheet(), [[0, 0, 1, 1]]);
  await writeFile(file, sheet());
  await keepIfSamePixels(file, other);
  assert.ok((await readFile(file)).equals(sheet()), 'different pixels are not put back');
});
