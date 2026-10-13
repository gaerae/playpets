import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eligiblePng, inspectPng, optimizationProvenance, sha256, verifyLossless } from './png-lossless-lib.mjs';

// Stage both outputs before replacing either; keep a recoverable pair on failure.
export function commitReplacement(
  { file, temporary, before, mode, metadata },
  io = { readFileSync, writeFileSync, renameSync, rmSync, chmodSync },
) {
  const metadataTemporary = metadata ? `${metadata.path}.optimize-${process.pid}` : null;
  let replaced = false;
  try {
    io.chmodSync(temporary, mode);
    if (metadata) io.writeFileSync(metadataTemporary, metadata.after, { flag: 'wx', mode: metadata.mode });
    io.renameSync(temporary, file);
    replaced = true;
    if (metadata) io.renameSync(metadataTemporary, metadata.path);
  } catch (error) {
    if (!replaced) throw error;
    const failures = [];
    for (const original of [
      { path: file, bytes: before, mode },
      ...(metadata ? [{ path: metadata.path, bytes: metadata.before, mode: metadata.mode }] : []),
    ]) {
      const recovery = `${original.path}.restore-${process.pid}`;
      try {
        io.writeFileSync(recovery, original.bytes, { mode: original.mode });
        io.renameSync(recovery, original.path);
      } catch (restoreError) {
        failures.push(`${original.path}: ${restoreError.message}`);
      } finally {
        io.rmSync(recovery, { force: true });
      }
    }
    throw Object.assign(
      new Error(
        failures.length
          ? `${error.message}; restore failed: ${failures.join('; ')}; recover from the report directory originals`
          : `${error.message}; original PNG and provenance restored`,
      ),
      { status: failures.length ? 'failed_restore' : 'failed_rolled_back' },
    );
  } finally {
    if (metadataTemporary) io.rmSync(metadataTemporary, { force: true });
  }
}

export function optimize(args = process.argv.slice(2), root = process.cwd()) {
  const paths = [];
  let reportDir = `scratch/asset-size/${new Date().toISOString().replaceAll(':', '-')}`;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--report-dir') {
      if (!args[i + 1]) throw new Error('--report-dir needs a path');
      reportDir = args[++i];
    } else if (args[i].startsWith('-')) throw new Error(`Unknown option ${args[i]}`);
    else paths.push(relative(root, resolve(root, args[i])).split(sep).join('/'));
  }
  const reportRoot = resolve(root, reportDir);
  if (!reportRoot.startsWith(`${resolve(root, 'scratch/asset-size')}${sep}`))
    throw new Error('Report directory must be below scratch/asset-size/');
  if (existsSync(reportRoot)) throw new Error('Report directory already exists; choose a new run directory');
  const tool = execFileSync('oxipng', ['--version'], { encoding: 'utf8' }).trim();
  const candidates = [
    ...new Set(
      execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
        cwd: root,
        encoding: 'utf8',
      }).split('\0'),
    ),
  ].filter(
    path =>
      eligiblePng(path) &&
      (!paths.length || paths.some(selected => path === selected || path.startsWith(`${selected}/`))),
  );
  if (!candidates.length) throw new Error('No eligible PNG files');
  // Work files live in the ignored run directory, never beside the art: one left by an interrupted
  // run cannot ship inside the app (everything under src/ does) or be picked up by the next run.
  const work = resolve(reportRoot, 'work');
  mkdirSync(work, { recursive: true });
  const report = { tool, arguments: ['-o', '2', '--nx'], files: [] };
  for (const [index, path] of candidates.entries()) {
    const file = resolve(root, path),
      temporary = resolve(work, `${index}.png`);
    const record = { path };
    try {
      if (lstatSync(file).isSymbolicLink()) throw new Error('Symbolic links are excluded');
      const before = readFileSync(file),
        inspected = inspectPng(before);
      Object.assign(record, {
        beforeBytes: before.length,
        beforeSha256: sha256(before),
        pixelSha256: inspected.pixelSha256,
      });
      execFileSync('oxipng', ['-o', '2', '--nx', '--out', temporary, file], { stdio: 'pipe' });
      const after = readFileSync(temporary);
      verifyLossless(before, after);
      Object.assign(record, { afterBytes: after.length, afterSha256: sha256(after) });
      if (after.length >= before.length) record.status = 'unchanged';
      else {
        const sourcePath = resolve(dirname(file), 'ART-SOURCES.json');
        let provenance, originalMetadata;
        if (path.endsWith('/spritesheet.png') && existsSync(sourcePath)) {
          originalMetadata = readFileSync(sourcePath);
          provenance = optimizationProvenance(JSON.parse(originalMetadata.toString('utf8')), record, tool);
        }
        const backup = resolve(reportRoot, 'originals', path);
        mkdirSync(dirname(backup), { recursive: true });
        writeFileSync(backup, before, { flag: 'wx' });
        if (provenance) {
          const backupMetadata = resolve(reportRoot, 'originals', relative(root, sourcePath));
          writeFileSync(backupMetadata, originalMetadata, { flag: 'wx' });
        }
        if (sha256(readFileSync(file)) !== record.beforeSha256) throw new Error('PNG changed during optimization');
        const mode = statSync(file).mode;
        if (provenance && !readFileSync(sourcePath).equals(originalMetadata))
          throw new Error('Provenance changed during optimization');
        commitReplacement({
          file,
          temporary,
          before,
          mode,
          metadata: provenance
            ? {
                path: sourcePath,
                before: originalMetadata,
                after: `${JSON.stringify(provenance, null, 2)}\n`,
                mode: statSync(sourcePath).mode,
              }
            : null,
        });
        record.status = 'optimized';
      }
    } catch (error) {
      record.status = error.status ?? 'skipped';
      record.reason = error.message;
    } finally {
      rmSync(temporary, { force: true });
    }
    report.files.push(record);
    writeFileSync(resolve(reportRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`${record.status}: ${path}`);
  }
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) optimize();
