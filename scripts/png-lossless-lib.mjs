import { createHash } from 'node:crypto';
import { crc32, inflateSync } from 'node:zlib';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function eligiblePng(path) {
  if (path.includes('\\') || path.split('/').some(part => part === '..') || !path.endsWith('.png')) return false;
  if (/(?:^|\/)(?:source-rows|generated-originals)(?:\/|$)/.test(path)) return false;
  // A work file an older interrupted run left beside its PNG is not artwork.
  if (/\.(?:optimize|restore)-\d+/.test(path)) return false;
  if (path.startsWith('assets/pets/') && /(?:identity-reference|original|source)\.png$/.test(path)) return false;
  return (
    /^(?:src\/art\/|assets\/pets\/|assets\/creator-kit\/)/.test(path) ||
    path === 'assets/banner.png' ||
    /^website\/public\/og(?:-[a-z-]+)?\.png$/.test(path)
  );
}

// Keep the original sample bytes, including RGB hidden by zero alpha.
export function inspectPng(bytes) {
  const fail = () => {
    throw new Error('Invalid PNG');
  };
  if (bytes.length < 45 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) fail();
  let header,
    ended = false,
    sawData = false,
    dataEnded = false;
  const compressed = [],
    metadata = [];
  for (let at = 8; at < bytes.length; ) {
    if (at + 12 > bytes.length) fail();
    const size = bytes.readUInt32BE(at),
      end = at + size + 12;
    if (end > bytes.length || crc32(bytes.subarray(at + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) fail();
    const type = bytes.toString('ascii', at + 4, at + 8),
      data = bytes.subarray(at + 8, end - 4);
    if (!/^[A-Za-z]{4}$/.test(type)) fail();
    if (type === 'IHDR') {
      if (at !== 8 || size !== 13) fail();
      header = data;
    } else if (!header) fail();
    else if (type === 'IDAT') {
      if (dataEnded) fail();
      compressed.push(data);
      sawData = true;
    } else if (type === 'IEND') {
      if (size || end !== bytes.length || !sawData) fail();
      ended = true;
    } else {
      if (type[0] === type[0].toUpperCase()) throw new Error(`Unsupported PNG critical chunk ${type}`);
      if (sawData) dataEnded = true;
      metadata.push({ type, data: data.toString('base64'), afterData: sawData });
    }
    at = end;
  }
  if (!header || !ended) fail();
  const width = header.readUInt32BE(0),
    height = header.readUInt32BE(4),
    channels = header[9] === 6 ? 4 : header[9] === 2 ? 3 : 0;
  if (!width || !height || width * height > 64 * 1024 * 1024) fail();
  if (header[8] !== 8 || !channels || header[10] || header[11] || header[12])
    throw new Error('Unsupported PNG sample format');
  const stride = width * channels,
    expected = (stride + 1) * height;
  const raw = inflateSync(Buffer.concat(compressed), { maxOutputLength: expected });
  if (raw.length !== expected) fail();
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    if (filter > 4) fail();
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x,
        left = x >= channels ? pixels[i - channels] : 0,
        up = y ? pixels[i - stride] : 0,
        corner = y && x >= channels ? pixels[i - stride - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      if (filter === 2) predictor = up;
      if (filter === 3) predictor = Math.floor((left + up) / 2);
      if (filter === 4) {
        const p = left + up - corner,
          a = Math.abs(p - left),
          b = Math.abs(p - up),
          c = Math.abs(p - corner);
        predictor = a <= b && a <= c ? left : b <= c ? up : corner;
      }
      pixels[i] = (raw[y * (stride + 1) + 1 + x] + predictor) & 255;
    }
  }
  return { width, height, channels, header: header.toString('hex'), metadata, pixelSha256: sha256(pixels) };
}

export function verifyLossless(before, after) {
  const a = inspectPng(before),
    b = inspectPng(after);
  if (a.header !== b.header) throw new Error('PNG header changed');
  if (JSON.stringify(a.metadata) !== JSON.stringify(b.metadata)) throw new Error('PNG metadata changed');
  if (a.pixelSha256 !== b.pixelSha256) throw new Error('PNG pixels changed');
  return b;
}

export function optimizationProvenance(source, record, tool) {
  if (source.sha256 !== record.beforeSha256) throw new Error('Provenance hash does not match original PNG');
  return {
    ...source,
    sha256: record.afterSha256,
    optimizations: [
      ...(source.optimizations ?? []),
      {
        tool,
        arguments: '-o 2 --nx',
        beforeSha256: record.beforeSha256,
        afterSha256: record.afterSha256,
        pixelSha256: record.pixelSha256,
        verification: 'Identical 8-bit decoded sample bytes, IHDR and ancillary chunks',
      },
    ],
  };
}
