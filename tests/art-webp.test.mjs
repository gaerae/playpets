// The app ships the yard's raster art as WebP made from reviewed PNG exports (assets/README.md).
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { crc32 } from 'node:zlib';
import {
  builtinManifest,
  builtinWebpProblems,
  exactPixels,
  largestError,
  parsePam,
  pngFor,
  webpName,
  webpProblems,
} from '../scripts/art-webp-lib.mjs';
import { sha256 } from '../scripts/png-lossless-lib.mjs';

function pngHeader(width, height) {
  const body = Buffer.alloc(17);
  body.write('IHDR');
  body.writeUInt32BE(width, 4);
  body.writeUInt32BE(height, 8);
  body[12] = 8;
  body[13] = 6;
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]), body, crc]);
}
// Only the lossless header: enough for the size check, which never decodes.
function webpHeader(width, height) {
  const bytes = Buffer.alloc(30);
  bytes.write('RIFF');
  bytes.writeUInt32LE(22, 4);
  bytes.write('WEBPVP8L', 8);
  bytes.writeUInt32LE(9, 16);
  bytes[20] = 0x2f;
  bytes.writeUInt32LE((width - 1) | ((height - 1) << 14), 21);
  return bytes;
}
async function fixture(files) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'playpets-webp-'));
  for (const [name, bytes] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), bytes);
  }
  return root;
}

test('every WebP the app ships is the recorded one for its current PNG export', async () => {
  assert.deepEqual(await webpProblems(), []);
  assert.deepEqual(await builtinWebpProblems(), []);
});

test('a changed, missing, hand-edited or orphaned WebP is reported', async t => {
  const png = pngHeader(4, 2),
    webp = webpHeader(4, 2),
    record = { 'sky/sun.png': { png: sha256(png), webp: sha256(webp) } };
  const cases = {
    current: [{ 'assets/art/sky/sun.png': png, 'src/art/sky/sun.webp': webp }, []],
    'export changed': [
      { 'assets/art/sky/sun.png': pngHeader(4, 3), 'src/art/sky/sun.webp': webp },
      ['assets/art/sky/sun.png changed after its WebP was made'],
    ],
    'WebP missing': [{ 'assets/art/sky/sun.png': png }, ['src/art/sky/sun.webp is missing']],
    'WebP edited': [
      { 'assets/art/sky/sun.png': png, 'src/art/sky/sun.webp': webpHeader(4, 3) },
      ['src/art/sky/sun.webp is not the recorded WebP'],
    ],
    'WebP left behind': [
      { 'assets/art/sky/sun.png': png, 'src/art/sky/sun.webp': webp, 'src/art/sky/moon.webp': webp },
      ['src/art/sky/moon.webp has no PNG in assets/art'],
    ],
  };
  for (const [name, [files, expected]] of Object.entries(cases)) {
    const root = await fixture({ ...files, 'assets/art/webp.json': JSON.stringify(record) });
    t.after(() => rm(root, { recursive: true, force: true }));
    assert.deepEqual(await webpProblems(root), expected, name);
  }
});

// The built-in friends ship as lossless WebP in src-tauri/pets, which builtin.rs embeds.
test('a built-in friend with a stale, missing, unembedded or leftover sheet is reported', async t => {
  const png = pngHeader(4, 2),
    webp = webpHeader(4, 2),
    source = JSON.stringify({ id: 'sun', spritesheetPath: 'spritesheet.png' }),
    shipped = builtinManifest(source),
    record = { 'sun/spritesheet.png': { png: sha256(png), webp: sha256(webp) } },
    embeds = files =>
      `const PETS: &[Builtin] = &[\n    pet!(\n        "sun"${files.map(f => `,\n        "${f}"`).join('')}\n    ),\n];\n`;
  const current = {
    'src-tauri/src/pets/builtin.rs': embeds(['spritesheet.webp']),
    'assets/pets/sun/pet.json': source,
    'assets/pets/sun/spritesheet.png': png,
    'src-tauri/pets/sun/pet.json': shipped,
    'src-tauri/pets/sun/spritesheet.webp': webp,
  };
  const cases = {
    current: [{}, []],
    'sheet changed': [
      { 'assets/pets/sun/spritesheet.png': pngHeader(4, 3) },
      ['assets/pets/sun/spritesheet.png changed after its WebP was made'],
    ],
    'WebP missing': [
      { 'src-tauri/pets/sun/spritesheet.webp': null },
      ['src-tauri/pets/sun/spritesheet.webp is missing'],
    ],
    'WebP edited': [
      { 'src-tauri/pets/sun/spritesheet.webp': webpHeader(4, 3) },
      ['src-tauri/pets/sun/spritesheet.webp is not the recorded WebP'],
    ],
    'manifest stale': [
      { 'src-tauri/pets/sun/pet.json': source },
      ['src-tauri/pets/sun/pet.json is not made from assets/pets/sun/pet.json'],
    ],
    'PNG left beside the WebP': [
      { 'src-tauri/pets/sun/spritesheet.png': png },
      ['src-tauri/pets/sun/spritesheet.png is not made from assets/pets/sun'],
    ],
    'not embedded': [
      { 'src-tauri/src/pets/builtin.rs': embeds(['spritesheet.png']) },
      ['src-tauri/src/pets/builtin.rs embeds sun as spritesheet.png, not spritesheet.webp'],
    ],
    'retired friend left behind': [
      { 'src-tauri/pets/moon/pet.json': shipped },
      ['src-tauri/pets/moon is not a built-in friend in src-tauri/src/pets/builtin.rs'],
    ],
  };
  for (const [name, [changes, expected]] of Object.entries(cases)) {
    const files = { ...current, ...changes, 'assets/pets/webp.json': JSON.stringify(record) };
    const root = await fixture(Object.fromEntries(Object.entries(files).filter(([, bytes]) => bytes !== null)));
    t.after(() => rm(root, { recursive: true, force: true }));
    assert.deepEqual(await builtinWebpProblems(root), expected, name);
  }
});

test('a built-in sheet ships with every pixel as it was drawn', () => {
  const png = (pixels, channels = 4) => ({ width: pixels.length / channels, height: 1, channels, pixels });
  const decoded = pixels => ({ width: pixels.length / 4, height: 1, pixels: Buffer.from(pixels) });
  assert.ok(exactPixels(png([10, 20, 30, 255]), decoded([10, 20, 30, 255])));
  assert.ok(exactPixels(png([10, 20, 30], 3), decoded([10, 20, 30, 255])));
  // Colour under a transparent pixel counts too: lossless means the same bytes.
  assert.ok(!exactPixels(png([200, 0, 0, 0]), decoded([0, 0, 0, 0])));
  assert.ok(!exactPixels(png([10, 20, 30, 255]), decoded([10, 20, 31, 255])));
  assert.ok(!exactPixels(png([0, 0, 0, 0]), { width: 2, height: 1, pixels: Buffer.alloc(8) }));
});

test('a built-in manifest names its sheets as WebP and keeps everything else', () => {
  const source = {
    id: 'playpets-sun',
    spritesheetPath: 'spritesheet.png',
    seasonalSpritesheets: { summer: 'seasonal/summer.png' },
    source: { url: 'https://example.org/sun.png.html' },
  };
  assert.deepEqual(JSON.parse(builtinManifest(JSON.stringify(source))), {
    ...source,
    spritesheetPath: 'spritesheet.webp',
    seasonalSpritesheets: { summer: 'seasonal/summer.webp' },
  });
});

test("a place gallery preview is checked for its export's hash and its card width", async t => {
  const png = pngHeader(1536, 1024),
    full = webpHeader(1536, 1024),
    small = webpHeader(400, 267),
    record = {
      'environments/green.png': { png: sha256(png), webp: sha256(full) },
      'environments/previews/green.webp': { png: sha256(png), webp: sha256(small) },
    },
    files = { 'assets/art/environments/green.png': png, 'src/art/environments/green.webp': full };
  const cases = {
    current: [{ 'src/art/environments/previews/green.webp': small }, record, []],
    missing: [{}, record, ['src/art/environments/previews/green.webp is missing']],
    unrecorded: [
      { 'src/art/environments/previews/green.webp': small },
      { 'environments/green.png': record['environments/green.png'] },
      ['assets/art/environments/green.png changed after its preview was made'],
    ],
    'full size': [
      { 'src/art/environments/previews/green.webp': full },
      { ...record, 'environments/previews/green.webp': { png: sha256(png), webp: sha256(full) } },
      ['src/art/environments/previews/green.webp is not 400 pixels wide'],
    ],
  };
  for (const [name, [extra, manifest, expected]] of Object.entries(cases)) {
    const root = await fixture({ ...files, ...extra, 'assets/art/webp.json': JSON.stringify(manifest) });
    t.after(() => rm(root, { recursive: true, force: true }));
    assert.deepEqual(await webpProblems(root), expected, name);
  }
});

test('the error a person could see weighs colour by its alpha', () => {
  const png = (pixels, channels = 4) => ({ width: pixels.length / channels, height: 1, channels, pixels });
  const decoded = pixels => ({ width: pixels.length / 4, height: 1, pixels });
  assert.equal(largestError(png([10, 20, 30, 255]), decoded([10, 20, 30, 255])), 0);
  assert.equal(largestError(png([10, 20, 30, 255]), decoded([14, 20, 30, 255])), 4);
  // A nearly invisible pixel may lose its colour: 128 at alpha 2 was 1 level of what is drawn.
  assert.equal(largestError(png([128, 128, 128, 2]), decoded([0, 0, 0, 0])), 2);
  assert.equal(largestError(png([200, 0, 0, 0]), decoded([0, 0, 0, 0])), 0);
  assert.equal(largestError(png([0, 0, 0, 0]), decoded([0, 0, 0, 200])), 200);
  assert.equal(largestError(png([10, 20, 30], 3), decoded([10, 20, 31, 255])), 1);
  assert.throws(() => largestError(png([0, 0, 0, 0]), { width: 2, height: 1, pixels: Buffer.alloc(8) }), /Size/);
});

test('a decoded WebP is read from dwebp PAM output', () => {
  const pam = Buffer.concat([
    Buffer.from('P7\nWIDTH 1\nHEIGHT 1\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n'),
    Buffer.from([1, 2, 3, 4]),
  ]);
  assert.deepEqual(parsePam(pam), { width: 1, height: 1, pixels: Buffer.from([1, 2, 3, 4]) });
  assert.throws(() => parsePam(pam.subarray(0, pam.length - 1)), /Invalid PAM/);
  assert.throws(() => parsePam(Buffer.from('P6\n1 1\n255\n')), /Invalid PAM/);
});

test('names map between the shipped WebP and its PNG export', () => {
  assert.equal(webpName('trees/oak.png'), 'trees/oak.webp');
  assert.equal(pngFor('art/trees/oak.webp'), 'assets/art/trees/oak.png');
  assert.equal(pngFor('src/art/trees/oak.webp'), 'assets/art/trees/oak.png');
  assert.equal(pngFor('fish/specimens.webp'), 'assets/art/fish/specimens.png');
});

// Everything under src/ is embedded in the app, once per processor in the macOS build.
test('the shipped art holds only what the page loads, and every literal art path resolves', () => {
  const files = readdirSync('src', { recursive: true }).map(name => name.split(path.sep).join('/'));
  for (const name of files.filter(name => name.startsWith('art/') && name.includes('.')))
    assert.match(name, /\.(?:webp|svg)$|^art\/collection\.json$/, `src/${name}`);
  assert.deepEqual(
    files.filter(name => name.endsWith('.png')),
    [],
    'PNG exports live in assets/art',
  );
  for (const name of files.filter(name => /\.(?:js|css|json|svg|html)$/.test(name))) {
    const text = readFileSync(`src/${name}`, 'utf8');
    for (const [reference] of text.matchAll(/(?:\.\.\/)*art\/[\w/.-]+\.(?:webp|png)/g)) {
      assert.match(reference, /\.webp$/, `src/${name}: ${reference}`);
      const target = reference.startsWith('../')
        ? path.join('src', path.dirname(name), reference)
        : path.join('src', reference);
      assert.ok(existsSync(target), `src/${name}: ${reference}`);
    }
  }
  for (const { atlas } of JSON.parse(readFileSync('src/art/collection.json', 'utf8')))
    assert.ok(existsSync(`src/art/${atlas}`), atlas);
});
