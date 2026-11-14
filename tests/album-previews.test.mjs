// The album's cards draw small previews made from the painted sheets (scripts/art-webp.mjs), so
// opening a book does not decode a 1536 × 1024 sheet for a 112-pixel card.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  ALBUM_BOX,
  ALBUM_DENSITY,
  albumPreviewName,
  albumPreviewSize,
  albumPreviews,
  wrapperCrop,
  webpProblems,
} from '../scripts/art-webp-lib.mjs';
import { imageSize } from '../scripts/asset-audit-lib.mjs';
import { sha256 } from '../scripts/png-lossless-lib.mjs';
import { data, setData } from '../src/core/state.js';
import { setupAlbum } from '../src/panel/album.js';
import { albumArt } from '../src/yard/catalog.js';
import { catalog } from './support/content.mjs';
import { installDom } from './support/dom.mjs';

const filesUnder = folder =>
  readdirSync(folder, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? filesUnder(path.join(folder, entry.name)).map(name => `${entry.name}/${name}`) : [entry.name],
  );

test('every drawing an album card shows has a preview at twice the card size, and no other', () => {
  const arts = albumArt(catalog);
  // Every book with painted kinds: flowers, fish, bugs, gifts, grown trees, keepsakes and shoots.
  assert.equal(arts.length, new Set(arts).size);
  assert.ok(arts.length >= 150, `${arts.length} drawings`);
  for (const art of arts) {
    const crop = wrapperCrop(readFileSync(`src/art/${art}`, 'utf8'));
    const [width, height] = imageSize(readFileSync(`src/art/${albumPreviewName(art)}`), 'webp');
    assert.deepEqual([width, height], albumPreviewSize(crop), art);
    assert.ok(width <= ALBUM_BOX[0] * ALBUM_DENSITY && height <= ALBUM_BOX[1] * ALBUM_DENSITY, art);
  }
  assert.deepEqual(
    filesUnder('src/art/album').sort(),
    arts.map(art => albumPreviewName(art).replace(/^album\//, '')).sort(),
  );
});

test("a preview is as large as the crop shows on a card, at twice the screen's pixels, and never larger", () => {
  // A wide gift: its crop fills the card's height.
  assert.deepEqual(albumPreviewSize({ box: [80, 64], crop: [20, 40, 492, 430] }), [146, 128]);
  // A tall tree, set in a box of its own shape.
  assert.deepEqual(albumPreviewSize({ box: [160, 170], crop: [1034, 15, 446, 466] }), [120, 126]);
  // A small crop is not blown up.
  assert.deepEqual(albumPreviewSize({ box: [100, 50], crop: [0, 0, 40, 20] }), [40, 20]);
});

test('a wrapper names its box, its crop and alignment, and the sheet it is cut from', () => {
  const tree =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 170"><svg width="160" height="170" viewBox="1034 15 446 466" preserveAspectRatio="xMidYMax meet" overflow="hidden"><image href="art/trees/bamboo.webp" width="1536" height="1024"/></svg></svg>';
  assert.deepEqual(wrapperCrop(tree), {
    box: [160, 170],
    crop: [1034, 15, 446, 466],
    sheet: 'trees/bamboo.webp',
    sheetSize: [1536, 1024],
  });
  assert.equal(wrapperCrop('<svg viewBox="0 0 40 40"><path d="M0 0"/></svg>'), null);
});

test('each book draws its cards from the previews, never from the painted sheets', t => {
  const before = data;
  t.after(() => setData(before));
  installDom(t, { anyId: true });
  document.querySelectorAll = () => document.getElementById('album-tabs').children;
  setupAlbum();
  const tabs = document.getElementById('album-tabs').children;
  document.getElementById('album-dialog').open = true;
  document.querySelector = selector => {
    const id = selector.match(/data-count="(.*?)"/)?.[1];
    return tabs.find(tab => tab.dataset.book === id)?.children[1];
  };
  document.querySelectorAll = () => tabs;
  setData({ ...before, album: {}, garden: { received: [] } });
  for (const book of ['flower', 'fish', 'bug', 'gift', 'tree', 'treasure', 'shoot']) {
    tabs.find(tab => tab.dataset.book === book).onclick();
    const cards = document.getElementById('album-grid').children;
    assert.ok(cards.length, book);
    for (const card of cards) {
      const drawing = card.children[0].innerHTML;
      assert.match(drawing, /<image href="art\/album\/[^"]+\.webp"/, `${book}: ${drawing}`);
      assert.doesNotMatch(drawing, /<use /, book);
    }
  }
});

test('a missing, stale, hand-edited or wrongly sized album preview is reported', async t => {
  const wrapper =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 64"><svg width="80" height="64" viewBox="20 40 492 430" overflow="hidden"><image href="art/decor/props.webp" width="1536" height="1024"/></svg></svg>\n';
  const png = Buffer.from('png');
  const header = (width, height) => {
    const bytes = Buffer.alloc(30);
    bytes.write('RIFF');
    bytes.writeUInt32LE(22, 4);
    bytes.write('WEBPVP8L', 8);
    bytes.writeUInt32LE(9, 16);
    bytes[20] = 0x2f;
    bytes.writeUInt32LE((width - 1) | ((height - 1) << 14), 21);
    return bytes;
  };
  const small = header(146, 128),
    catalogText = JSON.stringify({ gifts: [{ id: 'bench', art: 'decor/bench.svg' }] });
  const record = (preview = small) => ({
    'album/decor/bench.webp': { png: sha256(png), svg: sha256(Buffer.from(wrapper)), webp: sha256(preview) },
  });
  const cases = {
    current: [{ 'src/art/album/decor/bench.webp': small }, record(), []],
    missing: [{}, record(), ['src/art/album/decor/bench.webp is missing']],
    'sheet changed': [
      { 'src/art/album/decor/bench.webp': small },
      { 'album/decor/bench.webp': { ...record()['album/decor/bench.webp'], png: sha256(Buffer.from('other')) } },
      ['src/art/decor/bench.svg or assets/art/decor/props.png changed after its album preview was made'],
    ],
    'hand edited': [
      { 'src/art/album/decor/bench.webp': header(146, 127) },
      record(),
      ['src/art/album/decor/bench.webp is not the recorded preview'],
    ],
    'wrong size': [
      { 'src/art/album/decor/bench.webp': header(80, 64) },
      record(header(80, 64)),
      ['src/art/album/decor/bench.webp is not 146 × 128'],
    ],
    'left behind': [
      { 'src/art/album/decor/bench.webp': small, 'src/art/album/decor/kite.webp': small },
      record(),
      ['src/art/album/decor/kite.webp has no PNG in assets/art'],
    ],
  };
  for (const [name, [extra, manifest, expected]] of Object.entries(cases)) {
    const root = await mkdtemp(path.join(os.tmpdir(), 'playpets-album-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const files = {
      'src/content/catalog.json': catalogText,
      'src/art/decor/bench.svg': wrapper,
      'assets/art/decor/props.png': png,
      'assets/art/webp.json': JSON.stringify(manifest),
      ...extra,
    };
    for (const [file, bytes] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), bytes);
    }
    // The sheet's own WebP is not part of this case.
    const problems = (await webpProblems(root)).filter(
      p => !p.startsWith('src/art/decor/props.webp') && !p.endsWith('changed after its WebP was made'),
    );
    assert.deepEqual(problems, expected, name);
    assert.equal((await albumPreviews(root)).length, 1, name);
  }
});
