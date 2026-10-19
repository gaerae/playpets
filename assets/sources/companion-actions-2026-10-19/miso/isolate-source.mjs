import { spawnSync } from 'node:child_process';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { atlasPoses, isolatePose } from '../../../../scripts/atlas-lib.mjs';

const [source, outDir] = process.argv.slice(2);
const python = process.env.PLAYPETS_PYTHON || 'python3';
const raw = spawnSync(
  python,
  [
    '-c',
    'from PIL import Image;import sys; im=Image.open(sys.argv[1]).convert("RGBA");sys.stdout.buffer.write(im.tobytes())',
    source,
  ],
  { maxBuffer: 30_000_000 },
);
if (raw.status) throw new Error(raw.stderr.toString());
const rgba = new Uint8Array(raw.stdout),
  width = 1536,
  height = 1024;
if (rgba.length !== width * height * 4) throw new Error('Expected 1536x1024 source');
const poses = atlasPoses(rgba, width, height, 1, 24)[0];
mkdirSync(outDir, { recursive: true });
const metadata = {
  source,
  assembly:
    'atlasPoses columns=1 rows=24, group by vertical centre then left, isolatePose two-pixel alpha fringe, no resizing',
  rows: [],
};
for (let row = 0; row < 4; row++) {
  const selected = poses.slice(row * 6, row * 6 + 6).sort((a, b) => a.left - b.left);
  const data = new Uint8Array(384 * 6 * 320 * 4),
    frames = [];
  for (let col = 0; col < 6; col++) {
    const p = selected[col],
      sx = Math.max(0, p.left - 2),
      sy = Math.max(0, p.top - 2),
      w = Math.min(width - sx, p.right - sx + 3),
      h = Math.min(height - sy, p.bottom - sy + 3);
    if (w > 384 || h > 320) throw new Error('Isolated pose exceeds canonical tile');
    const isolated = isolatePose(rgba, width, p.pixels, sx, sy, w, h);
    for (let y = 0; y < h; y++) data.set(isolated.subarray(y * w * 4, (y + 1) * w * 4), (y * 2304 + col * 384) * 4);
    frames.push({ sourceRect: [sx, sy, w, h], rect: [col * 384, 0, 384, 320] });
  }
  const action = ['dig', 'plant', 'fish', 'discover'][row];
  writeFileSync(`${outDir}/${action}.raw`, data);
  const result = spawnSync(
    python,
    [
      '-c',
      'from PIL import Image;import sys;from pathlib import Path;Image.frombytes("RGBA",(2304,320),Path(sys.argv[1]).read_bytes()).save(sys.argv[2])',
      `${outDir}/${action}.raw`,
      `${outDir}/${action}-canonical.png`,
    ],
    { maxBuffer: 30_000_000 },
  );
  if (result.status) throw new Error(result.stderr.toString());
  unlinkSync(`${outDir}/${action}.raw`);
  metadata.rows.push({ action, frames });
}
writeFileSync(`${outDir}/isolation.json`, `${JSON.stringify(metadata, null, 2)}\n`);
