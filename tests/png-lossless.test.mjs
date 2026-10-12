import assert from 'node:assert/strict';
import test from 'node:test';
import { crc32, deflateSync } from 'node:zlib';
import {
  eligiblePng,
  inspectPng,
  optimizationProvenance,
  pngSize,
  unfilterPng,
  verifyLossless,
} from '../scripts/png-lossless-lib.mjs';

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const result = Buffer.alloc(body.length + 8);
  result.writeUInt32BE(data.length);
  body.copy(result, 4);
  result.writeUInt32BE(crc32(body), result.length - 4);
  return result;
}
function png(samples = [10, 20, 30, 0], metadata = 'hello', filter = 0) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('tEXt', Buffer.from(metadata)),
    chunk('IDAT', deflateSync(Buffer.from([filter, ...samples]))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

test('PNG verification compares decoded transparent RGB and all metadata', () => {
  const original = png();
  assert.equal(verifyLossless(original, png(undefined, undefined, 1)).pixelSha256, inspectPng(original).pixelSha256);
  assert.throws(() => verifyLossless(original, png([11, 20, 30, 0])), /pixels/);
  assert.throws(() => verifyLossless(original, png(undefined, 'changed profile')), /metadata/);
});
test('PNG validation rejects broken CRC, truncated data and invalid filters', () => {
  const corrupt = png();
  corrupt[29] ^= 1;
  assert.throws(() => inspectPng(corrupt), /PNG/);
  assert.throws(() => inspectPng(png().subarray(0, 45)), /PNG/);
  assert.throws(() => inspectPng(png(undefined, undefined, 5)), /PNG/);
});
test('PNG size reads a checked header and refuses anything else', () => {
  assert.deepEqual(pngSize(png()), { width: 1, height: 1 });
  assert.throws(() => pngSize(Buffer.from('not an image at all, but long enough')), /PNG header/);
  const corrupt = png();
  corrupt[17] ^= 1;
  assert.throws(() => pngSize(corrupt), /PNG header/);
  assert.throws(() => pngSize(png().subarray(0, 32)), /PNG header/);
});
test('row filters are reversed from the bytes already decoded', () => {
  // Two RGB pixels in two rows: Sub on the first row, Up on the second, then Paeth on a third.
  const raw = Buffer.from([1, 10, 20, 30, 5, 5, 5, 2, 1, 1, 1, 1, 1, 1, 4, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(
    [...unfilterPng(raw, 2, 3, 3, () => assert.fail())],
    [10, 20, 30, 15, 25, 35, 11, 21, 31, 16, 26, 36, 11, 21, 31, 16, 26, 36],
  );
  assert.throws(
    () =>
      unfilterPng(Buffer.from([5, 0, 0, 0]), 1, 1, 3, () => {
        throw new Error('bad filter');
      }),
    /bad filter/,
  );
});
test('optimization scope excludes generation sources and unrelated files', () => {
  for (const path of [
    'src/art/sky/cloud.png',
    'assets/pets/aria/spritesheet.png',
    'assets/creator-kit/aria/face-detail.png',
    'website/public/og-ko.png',
  ])
    assert.equal(eligiblePng(path), true, path);
  for (const path of [
    'assets/pets/tabby/source-rows/00-idle.png',
    'assets/pets/tabby/identity-reference.png',
    'assets/pets/generated-originals/x.png',
    'website/public/pets/aria/spritesheet.png',
    '../src/art/x.png',
    'src/art/sky/cloud.png.optimize-4242.png',
    'assets/sources/environments/studio.png',
    'src/art/a.svg',
  ])
    assert.equal(eligiblePng(path), false, path);
});
test('provenance retains the source records and checks the pre-optimization hash', () => {
  const original = { sha256: 'old', rows: [{ sha256: 'untouched' }] };
  const updated = optimizationProvenance(
    original,
    { beforeSha256: 'old', afterSha256: 'new', pixelSha256: 'pixels' },
    'oxipng 10.2.1',
  );
  assert.equal(updated.sha256, 'new');
  assert.deepEqual(updated.rows, original.rows);
  assert.equal(updated.optimizations[0].beforeSha256, 'old');
  assert.throws(() => optimizationProvenance(original, { beforeSha256: 'unexpected' }, 'oxipng'), /hash/);
});

test('all PNG row filters decode to identical RGB/RGBA sample hashes', () => {
  for (const channels of [3, 4]) {
    const samples = Buffer.from(Array.from({ length: 3 * 2 * channels }, (_, i) => (i * 41 + 19) & 255));
    const variants = [];
    for (let filter = 0; filter < 5; filter++) {
      const header = Buffer.alloc(13);
      header.writeUInt32BE(3);
      header.writeUInt32BE(2, 4);
      header[8] = 8;
      header[9] = channels === 4 ? 6 : 2;
      const stride = 3 * channels,
        raw = Buffer.alloc((stride + 1) * 2);
      for (let y = 0; y < 2; y++) {
        raw[y * (stride + 1)] = filter;
        for (let x = 0; x < stride; x++) {
          const i = y * stride + x,
            a = x >= channels ? samples[i - channels] : 0,
            b = y ? samples[i - stride] : 0,
            c = y && x >= channels ? samples[i - stride - channels] : 0;
          let predictor = 0;
          if (filter === 1) predictor = a;
          if (filter === 2) predictor = b;
          if (filter === 3) predictor = Math.floor((a + b) / 2);
          if (filter === 4) {
            const p = a + b - c,
              distances = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
            predictor = [a, b, c][distances.indexOf(Math.min(...distances))];
          }
          raw[y * (stride + 1) + x + 1] = (samples[i] - predictor) & 255;
        }
      }
      variants.push(
        Buffer.concat([
          Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
          chunk('IHDR', header),
          chunk('IDAT', deflateSync(raw)),
          chunk('IEND', Buffer.alloc(0)),
        ]),
      );
    }
    for (const variant of variants) verifyLossless(variants[0], variant);
  }
});

test('C2PA and color profile removal or alteration cannot pass verification', () => {
  const plain = png();
  for (const type of ['caBX', 'iCCP', 'sRGB', 'gAMA']) {
    const withMetadata = Buffer.concat([
      plain.subarray(0, 33),
      chunk(type, Buffer.from('original profile or provenance')),
      plain.subarray(33),
    ]);
    assert.throws(() => verifyLossless(withMetadata, plain), /metadata/);
  }
  const indexed = Buffer.from(plain);
  indexed[25] = 3;
  indexed.writeUInt32BE(crc32(indexed.subarray(12, 29)), 29);
  assert.throws(() => inspectPng(indexed), /Unsupported/);
});

test('a failed provenance replacement restores the original PNG and metadata', async () => {
  const { commitReplacement } = await import('../scripts/optimize-png.mjs');
  const files = new Map([
    ['pet.png', Buffer.from('original pixels')],
    ['next.png', Buffer.from('optimized pixels')],
    ['ART-SOURCES.json', Buffer.from('original metadata')],
  ]);
  let failed = false;
  const io = {
    readFileSync: path => files.get(path),
    writeFileSync: (path, data) => files.set(path, Buffer.from(data)),
    chmodSync: () => {},
    rmSync: path => files.delete(path),
    renameSync: (from, to) => {
      if (to === 'ART-SOURCES.json' && !failed) {
        failed = true;
        throw new Error('metadata disk failure');
      }
      files.set(to, files.get(from));
      files.delete(from);
    },
  };
  assert.throws(
    () =>
      commitReplacement(
        {
          file: 'pet.png',
          temporary: 'next.png',
          before: Buffer.from('original pixels'),
          mode: 0o644,
          metadata: {
            path: 'ART-SOURCES.json',
            before: Buffer.from('original metadata'),
            after: 'new metadata',
            mode: 0o644,
          },
        },
        io,
      ),
    error => error.status === 'failed_rolled_back',
  );
  assert.equal(files.get('pet.png').toString(), 'original pixels');
  assert.equal(files.get('ART-SOURCES.json').toString(), 'original metadata');
  assert.equal(files.size, 2);
});

test('a rollback failure is reported explicitly instead of claiming the file was skipped', async () => {
  const { commitReplacement } = await import('../scripts/optimize-png.mjs');
  const io = {
    writeFileSync: () => {},
    chmodSync: () => {},
    rmSync: () => {},
    renameSync: (from, to) => {
      if (to === 'ART-SOURCES.json' || from.includes('.restore-')) throw new Error('filesystem unavailable');
    },
  };
  assert.throws(
    () =>
      commitReplacement(
        {
          file: 'pet.png',
          temporary: 'next.png',
          before: Buffer.from('original'),
          mode: 0o644,
          metadata: { path: 'ART-SOURCES.json', before: Buffer.from('original'), after: 'new', mode: 0o644 },
        },
        io,
      ),
    error => error.status === 'failed_restore' && /report directory originals/.test(error.message),
  );
});
