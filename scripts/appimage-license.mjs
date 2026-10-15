import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { appImageSystemPackages, systemLibraryPackages, verifyAppImageTree } from './appimage-license-lib.mjs';

const [appImage, output] = process.argv.slice(2);
if (!appImage || !output) {
  console.error('Usage: node scripts/appimage-license.mjs <AppImage> <source-manifest>');
  process.exit(2);
}
if (process.platform !== 'linux') {
  console.error('AppImage license verification runs on the Linux build host.');
  process.exit(2);
}

const temporary = mkdtempSync(path.join(tmpdir(), 'playpets-appimage-'));
try {
  execFileSync(path.resolve(appImage), ['--appimage-extract'], {
    cwd: temporary,
    env: { ...process.env, APPIMAGE_EXTRACT_AND_RUN: '1' },
    stdio: 'ignore',
  });
  const root = path.join(temporary, 'squashfs-root');
  const result = verifyAppImageTree(root);
  const packages = systemLibraryPackages(root, basename => {
    try {
      return execFileSync('dpkg-query', ['-S', `*/${basename}`], { encoding: 'utf8' })
        .split('\n')
        .map(line => line.slice(0, line.indexOf(': /')))
        .filter(Boolean);
    } catch {
      return [];
    }
  });
  const queryFormat = '$' + '{binary:Package}\t$' + '{Version}\t$' + '{source:Package}\t$' + '{source:Version}';
  const rows = packages.map(packageName =>
    execFileSync('dpkg-query', ['-W', `-f=${queryFormat}`, packageName], { encoding: 'utf8' }).trim(),
  );
  writeFileSync(output, appImageSystemPackages(rows));
  console.log(`Verified AppImage notices for ${packages.length} system packages.`);
  console.log(`Checked plugin notices: ${result.checkedPlugins.join(', ') || 'none'}.`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
