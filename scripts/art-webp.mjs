// Makes src/art/**/*.webp from the reviewed PNG exports in assets/art, and checks every sample
// against the PNG before keeping it. Needs libwebp's cwebp and dwebp; `--check` needs neither.
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { availableParallelism, tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  EXPORTS,
  MANIFEST,
  MAX_ERROR,
  NEAR_LOSSLESS,
  RUNTIME,
  largestError,
  parsePam,
  pngExports,
  readManifest,
  runtimeWebps,
  webpName,
  webpProblems,
} from './art-webp-lib.mjs';
import { decodePng, sha256 } from './png-lossless-lib.mjs';

const run = promisify(execFile);

if (process.argv.includes('--check')) {
  const problems = await webpProblems();
  for (const problem of problems) console.error(problem);
  if (problems.length) {
    console.error('Run `pnpm run assets:webp` (needs cwebp and dwebp from libwebp).');
    process.exit(1);
  }
  console.log('Every WebP in src/art matches its PNG export.');
  process.exit(0);
}

try {
  await run('cwebp', ['-version']);
  await run('dwebp', ['-version']);
} catch {
  console.error('Install libwebp first (cwebp and dwebp): brew install webp, or apt install webp.');
  process.exit(1);
}

const force = process.argv.includes('--force'),
  [pngs, manifest] = await Promise.all([pngExports(), readManifest()]),
  work = await mkdtemp(path.join(tmpdir(), 'playpets-webp-')),
  next = {},
  report = [];

async function convert(name) {
  const png = await readFile(path.join(EXPORTS, name)),
    target = path.join(RUNTIME, webpName(name)),
    record = manifest[name];
  if (!force && record?.png === sha256(png)) {
    const current = await readFile(target).catch(() => null);
    if (current && sha256(current) === record.webp) {
      next[name] = record;
      return;
    }
  }
  const temporary = path.join(work, `${sha256(Buffer.from(name)).slice(0, 16)}.webp`),
    pam = `${temporary}.pam`;
  const source = path.join(EXPORTS, name);
  await run('cwebp', [
    '-quiet',
    '-near_lossless',
    String(NEAR_LOSSLESS),
    '-z',
    '9',
    '-metadata',
    'none',
    source,
    '-o',
    temporary,
  ]);
  await run('dwebp', ['-quiet', '-pam', temporary, '-o', pam]);
  const error = largestError(decodePng(png), parsePam(await readFile(pam)));
  if (error > MAX_ERROR) throw new Error(`${source}: a sample moved by ${error}, more than ${MAX_ERROR}`);
  const webp = await readFile(temporary);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(`${target}.tmp`, webp);
  await rename(`${target}.tmp`, target);
  next[name] = { png: sha256(png), webp: sha256(webp) };
  report.push(`${name}: ${png.length} → ${webp.length} bytes, largest change ${error}`);
}

try {
  const queue = [...pngs];
  await Promise.all(
    Array.from({ length: Math.max(1, availableParallelism() - 1) }, async () => {
      // One refused file stops the others before the work folder goes away.
      while (queue.length)
        await convert(queue.shift()).catch(error => {
          queue.length = 0;
          throw error;
        });
    }),
  );
} finally {
  await rm(work, { recursive: true, force: true });
}

const sorted = Object.fromEntries(
  Object.keys(next)
    .sort()
    .map(name => [name, next[name]]),
);
await writeFile(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`);
const orphans = (await runtimeWebps()).filter(name => !pngs.map(webpName).includes(name));
for (const line of report.sort()) console.log(line);
for (const name of orphans) console.error(`${RUNTIME}/${name} has no PNG in ${EXPORTS}; remove it or restore its PNG.`);
console.log(`${report.length} made, ${pngs.length - report.length} already current.`);
if (orphans.length) process.exitCode = 1;
