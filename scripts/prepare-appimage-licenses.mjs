import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { appImageCopyrightPackages } from './appimage-license-lib.mjs';

const [executable, output] = process.argv.slice(2);
if (!executable || !output) {
  console.error('Usage: node scripts/prepare-appimage-licenses.mjs <executable> <output-directory>');
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

const ldd = execFileSync('ldd', [path.resolve(executable)], { encoding: 'utf8' });
const packages = appImageCopyrightPackages(ldd, ownersForBasename);
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
