import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

for (const ready of [true, false]) {
  test(
    `Linux E2E ${ready ? 'runs after the window manager is ready' : 'rejects a missing window manager'}`,
    {
      skip: process.platform === 'win32',
    },
    t => {
      const root = mkdtempSync(path.join(tmpdir(), 'playpets-linux-e2e-'));
      t.after(() => rmSync(root, { recursive: true, force: true }));
      const bin = path.join(root, 'bin');
      mkdirSync(bin);
      const put = (name, body) => writeFileSync(path.join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
      put('openbox', 'exec /bin/sleep 30');
      put('xprop', ready ? 'echo "_NET_SUPPORTING_WM_CHECK(WINDOW): window id # 0x1"' : 'exit 1');
      put('sleep', ':');
      put('scenario', 'echo scenario-ran; exit 7');
      const result = spawnSync('bash', ['scripts/linux-e2e.sh', '--session', 'scenario'], {
        encoding: 'utf8',
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
      });
      assert.equal(result.status, ready ? 7 : 1, result.stderr);
      if (ready) assert.match(result.stdout, /scenario-ran/);
      else {
        assert.doesNotMatch(result.stdout, /scenario-ran/);
        assert.match(result.stderr, /window manager/i);
      }
    },
  );
}

test('CI and local Linux E2E provide the same native window manager', () => {
  const read = file => readFileSync(file, 'utf8');
  assert.match(read('packaging/linux/Dockerfile'), /openbox x11-utils/);
  assert.match(read('.github/workflows/build.yml'), /openbox x11-utils/);
  assert.match(read('.github/workflows/build.yml'), /bash scripts\/linux-e2e\.sh node tests\/e2e\.mjs/);
  assert.match(read('packaging/linux/build.sh'), /pnpm run test:e2e:linux/);
  assert.equal(
    JSON.parse(read('package.json')).scripts['test:e2e:linux'],
    'bash scripts/linux-e2e.sh pnpm run test:e2e',
  );
});
