import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

// Removing correctness checks or broadening ignores must not silently pass broken source.
test('Oxlint rejects JavaScript and Vue script mistakes while excluding generated outputs', () => {
  assert.ok(existsSync('.oxlintrc.json'), 'repository Oxlint configuration exists');
  const dir = mkdtempSync(join(tmpdir(), 'playpets-lint-'));
  try {
    copyFileSync('.oxlintrc.json', join(dir, '.oxlintrc.json'));
    const run = path =>
      spawnSync(process.execPath, [resolve('node_modules/oxlint/bin/oxlint'), '--deny-warnings', path], {
        cwd: dir,
        encoding: 'utf8',
      });
    for (const path of [
      'src/broken.js',
      'scripts/broken.mjs',
      'tests/broken.test.mjs',
      'website/.vitepress/theme/Broken.vue',
    ]) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      const broken = 'export function broken() { return; console.log("unreachable"); }';
      writeFileSync(join(dir, path), path.endsWith('.vue') ? `<script>${broken}</script>` : broken);
      const result = run(path);
      assert.equal(result.status, 1, `${path}: ${result.stdout}${result.stderr}`);
      assert.match(result.stdout + result.stderr, /no-unreachable/, path);
      rmSync(join(dir, path));
    }
    for (const path of [
      'scratch/broken.js',
      'release/broken.js',
      'website/dev/broken.js',
      'website/public/pets/broken.js',
      'website/public/creator-kit/broken.js',
      'website/public/yard/broken.js',
      'website/.vitepress/dist/broken.js',
      'src-tauri/gen/broken.js',
    ]) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), 'export function broken() { return; console.log("unreachable"); }');
    }
    writeFileSync(join(dir, 'src/valid.js'), 'export const valid = true;');
    const ignored = run('.');
    assert.equal(ignored.status, 0, ignored.stdout + ignored.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
