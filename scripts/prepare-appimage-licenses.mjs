import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { appImageCopyrightPackages, bundledLibraryPackages } from './appimage-license-lib.mjs';

const args = process.argv.slice(2);
const appImageMode = args[0] === '--appimage';
const [input, output] = appImageMode ? args.slice(1) : args;
if (!input || !output) {
  console.error(
    'Usage: node scripts/prepare-appimage-licenses.mjs [--appimage] <executable-or-AppImage> <output-directory>',
  );
  process.exit(2);
}
if (process.platform !== 'linux') {
  console.error('AppImage license preparation runs on the Linux build host.');
  process.exit(2);
}

function ownersForBasename(basename) {
  try {
    return execFileSync('dpkg-query', ['-S', `*/${basename}`], { encoding: 'utf8' })
      .split('\n')
      .map(line => line.slice(0, line.indexOf(': /')))
      .filter(Boolean);
  } catch {
    return [];
  }
}

const temporary = appImageMode ? mkdtempSync(path.join(tmpdir(), 'playpets-appimage-licenses-')) : undefined;
try {
  let packages;
  if (appImageMode) {
    execFileSync(path.resolve(input), ['--appimage-extract'], {
      cwd: temporary,
      env: { ...process.env, APPIMAGE_EXTRACT_AND_RUN: '1' },
      stdio: 'ignore',
    });
    packages = bundledLibraryPackages(path.join(temporary, 'squashfs-root'), ownersForBasename);
  } else {
    const ldd = execFileSync('ldd', [path.resolve(input)], { encoding: 'utf8' });
    packages = appImageCopyrightPackages(ldd, ownersForBasename);
  }
  rmSync(output, { recursive: true, force: true });
  for (const packageName of packages) {
    const name = packageName.replace(/:[^:]+$/, '');
    const source = `/usr/share/doc/${name}/copyright`;
    const text = readFileSync(source, 'utf8');
    if (!text.trim()) throw new Error(`${source} has no copyright or license text.`);
    const destination = path.join(output, name, 'copyright');
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, text);
  }
  console.log(`Collected copyright and license text for ${packages.length} AppImage system packages.`);
} finally {
  if (temporary) rmSync(temporary, { recursive: true, force: true });
}
