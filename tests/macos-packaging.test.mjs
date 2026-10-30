import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'playpets-dmg-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'packaging/macos'), { recursive: true });
  copyFileSync('packaging/macos/make-dmg.sh', path.join(root, 'packaging/macos/make-dmg.sh'));
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '0.2.0' }));
  const bundle = path.join(root, 'src-tauri/target/release/bundle/dmg');
  mkdirSync(bundle, { recursive: true });
  const arch = execFileSync('uname', ['-m'], { encoding: 'utf8' }).trim().replace('arm64', 'aarch64');
  const name = `PlayPets_0.2.0_${arch}.dmg`;
  writeFileSync(path.join(bundle, `PlayPets_0.1.0_${arch}.dmg`), 'old version');
  return {
    bundle,
    name,
    output: path.join(root, 'release/macos', name),
    run: () => spawnSync('bash', ['packaging/macos/make-dmg.sh'], { cwd: root, encoding: 'utf8' }),
  };
}

test(
  'macOS packaging selects the current version when older bundles remain',
  {
    skip: process.platform === 'win32',
  },
  t => {
    const f = fixture(t);
    writeFileSync(path.join(f.bundle, f.name), 'current version');
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(f.output, 'utf8'), 'current version');
  },
);

test(
  'macOS packaging refuses to relabel an old bundle when the current one is missing',
  {
    skip: process.platform === 'win32',
  },
  t => {
    const f = fixture(t);
    const result = f.run();
    assert.notEqual(result.status, 0);
    assert.equal(existsSync(f.output), false);
  },
);
