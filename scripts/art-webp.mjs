// Makes src/art/**/*.webp from the reviewed PNG exports in assets/art, and the built-in friends'
// lossless sheets in src-tauri/pets from assets/pets, and checks every sample against the PNG
// before keeping it. Needs libwebp's cwebp and dwebp; `--check` needs neither.
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { availableParallelism, tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  BUILTIN_MANIFEST,
  BUILTIN_RUNTIME,
  BUILTIN_SOURCE,
  EXPORTS,
  MANIFEST,
  MAX_ERROR,
  NEAR_LOSSLESS,
  RUNTIME,
  builtinExports,
  builtinManifest,
  builtinWebpProblems,
  exactPixels,
  largestError,
  parsePam,
  pngExports,
  readBuiltinRecords,
  readManifest,
  runtimeWebps,
  webpName,
  webpProblems,
} from './art-webp-lib.mjs';
import { decodePng, sha256 } from './png-lossless-lib.mjs';

const run = promisify(execFile);

if (process.argv.includes('--check')) {
  const problems = [...(await webpProblems()), ...(await builtinWebpProblems())];
  for (const problem of problems) console.error(problem);
  if (problems.length) {
    console.error('Run `pnpm run assets:webp` (needs cwebp and dwebp from libwebp).');
    process.exit(1);
  }
  console.log('Every WebP in src/art and src-tauri/pets matches its PNG.');
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
  [pngs, manifest, pets, records] = await Promise.all([
    pngExports(),
    readManifest(),
    builtinExports(),
    readBuiltinRecords(),
  ]),
  work = await mkdtemp(path.join(tmpdir(), 'playpets-webp-')),
  next = {},
  nextBuiltin = {},
  report = [];

const nearLossless = {
  options: ['-near_lossless', String(NEAR_LOSSLESS)],
  verify(png, decoded, source) {
    const error = largestError(png, decoded);
    if (error > MAX_ERROR) throw new Error(`${source}: a sample moved by ${error}, more than ${MAX_ERROR}`);
    return `largest change ${error}`;
  },
};
// -exact keeps the colour under transparent pixels, so the decoded sheet is the PNG's, byte for byte.
const lossless = {
  options: ['-lossless', '-exact'],
  verify(png, decoded, source) {
    if (!exactPixels(png, decoded)) throw new Error(`${source}: the WebP does not decode to the PNG's pixels`);
    return 'every pixel the same';
  },
};

/** Encodes `from/name` into `to` unless its recorded WebP is still current. */
async function convert(name, { from, to, records, made, encoding }) {
  const source = path.join(from, name),
    png = await readFile(source),
    target = path.join(to, webpName(name)),
    record = records[name];
  if (!force && record?.png === sha256(png)) {
    const current = await readFile(target).catch(() => null);
    if (current && sha256(current) === record.webp) {
      made[name] = record;
      return;
    }
  }
  const temporary = path.join(work, `${sha256(Buffer.from(source)).slice(0, 16)}.webp`),
    pam = `${temporary}.pam`;
  await run('cwebp', ['-quiet', ...encoding.options, '-z', '9', '-metadata', 'none', source, '-o', temporary]);
  await run('dwebp', ['-quiet', '-pam', temporary, '-o', pam]);
  const checked = encoding.verify(decodePng(png), parsePam(await readFile(pam)), source);
  const webp = await readFile(temporary);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(`${target}.tmp`, webp);
  await rename(`${target}.tmp`, target);
  made[name] = { png: sha256(png), webp: sha256(webp) };
  report.push(`${source}: ${png.length} → ${webp.length} bytes, ${checked}`);
}

const art = { from: EXPORTS, to: RUNTIME, records: manifest, made: next, encoding: nearLossless },
  builtin = { from: BUILTIN_SOURCE, to: BUILTIN_RUNTIME, records, made: nextBuiltin, encoding: lossless };
for (const pet of pets) {
  const target = path.join(BUILTIN_RUNTIME, pet.id, 'pet.json');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, builtinManifest(pet.source));
}
try {
  const queue = [
    ...pngs.map(name => [name, art]),
    ...pets.flatMap(pet => pet.sheets.map(sheet => [`${pet.id}/${sheet}`, builtin])),
  ];
  await Promise.all(
    Array.from({ length: Math.max(1, availableParallelism() - 1) }, async () => {
      // One refused file stops the others before the work folder goes away.
      while (queue.length)
        await convert(...queue.shift()).catch(error => {
          queue.length = 0;
          throw error;
        });
    }),
  );
} finally {
  await rm(work, { recursive: true, force: true });
}

const sorted = records =>
  Object.fromEntries(
    Object.keys(records)
      .sort()
      .map(name => [name, records[name]]),
  );
await writeFile(MANIFEST, `${JSON.stringify(sorted(next), null, 2)}\n`);
await writeFile(BUILTIN_MANIFEST, `${JSON.stringify(sorted(nextBuiltin), null, 2)}\n`);
const orphans = (await runtimeWebps()).filter(name => !pngs.map(webpName).includes(name)),
  // What is left is not the encoder's to fix: a leftover file, or builtin.rs naming other files.
  leftovers = await builtinWebpProblems(),
  total = pngs.length + Object.keys(nextBuiltin).length;
for (const line of report.sort()) console.log(line);
for (const name of orphans) console.error(`${RUNTIME}/${name} has no PNG in ${EXPORTS}; remove it or restore its PNG.`);
for (const problem of leftovers) console.error(problem);
console.log(`${report.length} made, ${total - report.length} already current.`);
if (orphans.length || leftovers.length) process.exitCode = 1;
