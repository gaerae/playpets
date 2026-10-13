// Captures an exhaustive file manifest; visual acceptance is recorded separately in the design audit.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inventoryAssets } from './asset-audit-lib.mjs';

const out = path.resolve(process.argv[2] || 'scratch/asset-audit');
const records = await inventoryAssets();
const invalid = records.filter(r => !(r.width > 0 && r.height > 0) || r.missingReferences.length);
await mkdir(out, { recursive: true });
await writeFile(path.join(out, 'inventory.json'), `${JSON.stringify({ records, invalid }, null, 2)}\n`);
await writeFile(
  path.join(out, 'inventory.md'),
  `# Image asset inventory\n\nDimensions and hashes are file evidence, not a visual-quality score.\n\n| Path | Role | Size | Bytes |\n|---|---|---|---|\n${records.map(r => `| ${r.path} | ${r.role} | ${r.width} × ${r.height} | ${r.bytes} |`).join('\n')}\n`,
);
console.log(
  `${records.length} image files inventoried; ${invalid.length} invalid dimensions or unresolved raster references. ${out}`,
);
if (invalid.length) process.exitCode = 1;
