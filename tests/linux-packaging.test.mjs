import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

function fixture(t, { bundles = '', rejects = false } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'playpets-linux-packaging-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (name, text) => {
    const file = path.join(root, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
  };
  put('work/packaging/licenses/THIRD-PARTY-NOTICES.txt', 'license fixture');
  put('work/src-tauri/target/release/playpets', 'executable fixture');
  put('out/PlayPets_old.AppImage', 'older image');
  put('work/src-tauri/target/release/bundle/deb/PlayPets_old.deb', 'cached older deb');
  put('work/src-tauri/target/release/bundle/appimage/PlayPets_old-SYSTEM-SOURCE-PACKAGES.txt', 'cached older manifest');
  put('out/PlayPets_old-SYSTEM-SOURCE-PACKAGES.txt', 'older manifest');
  put('work/src-tauri/target/release/bundle/appimage/PlayPets_old.AppImage', 'cached older image');
  put(
    'build.sh',
    readFileSync('packaging/linux/build.sh', 'utf8')
      .replaceAll('/work', `${root}/work`)
      .replaceAll('/out', `${root}/out`),
  );
  put(
    'harness.sh',
    `
rsync() { :; }
npm() { if [[ "$*" == "run test:e2e:linux" ]]; then echo 'PASS: tauri e2e'; fi; }
cargo() { echo "cargo $*" >> "$TEST_ROOT/calls"; }
uname() { echo aarch64; }
npx() {
  echo "npx $*" >> "$TEST_ROOT/calls"
  mkdir -p src-tauri/target/release/bundle/{deb,appimage}
  echo deb > src-tauri/target/release/bundle/deb/PlayPets_0.2.0_arm64.deb
  if [[ "$*" == *appimage* ]]; then
    test -d src-tauri/target/appimage-license-docs || { echo 'Missing AppImage notices' >&2; return 13; }
    echo image > src-tauri/target/release/bundle/appimage/PlayPets_0.2.0_aarch64.AppImage
  fi
}
node() {
  echo "node $*" >> "$TEST_ROOT/calls"
  if [[ "$1" == *prepare-appimage-licenses.mjs ]]; then
    mkdir -p "\${@: -1}"
  elif [[ "$1" == *appimage-license.mjs ]]; then
    test "$AUDIT_REJECTS" != true || return 19
    echo manifest > "$3"
  fi
}
source "$TEST_ROOT/build.sh"
`,
  );
  const result = spawnSync('bash', [path.join(root, 'harness.sh')], {
    encoding: 'utf8',
    env: { ...process.env, TEST_ROOT: root, BUNDLES: bundles, AUDIT_REJECTS: String(rejects) },
  });
  return {
    root,
    result,
    calls: existsSync(path.join(root, 'calls')) ? readFileSync(path.join(root, 'calls'), 'utf8') : '',
  };
}

test(
  'local Linux AppImages collect the final library notices before exporting packages',
  {
    skip: process.platform === 'win32',
  },
  t => {
    const f = fixture(t);
    assert.equal(f.result.status, 0, f.result.stderr);
    assert.match(f.calls, /cargo build --release/);
    const steps = f.calls.trim().split('\n');
    assert.match(steps[1], /prepare-appimage-licenses\.mjs src-tauri\/target\/release\/playpets/);
    assert.equal(steps.filter(s => s.startsWith('npx ')).length, 2);
    assert.match(steps[3], /prepare-appimage-licenses\.mjs --appimage/);
    assert.match(steps[5], /appimage-license\.mjs/);
    assert.equal(existsSync(path.join(f.root, 'out/PlayPets_0.2.0_aarch64.AppImage')), true);
    assert.equal(existsSync(path.join(f.root, 'out/PlayPets_old.deb')), false);
    assert.equal(existsSync(path.join(f.root, 'out/PlayPets_old-SYSTEM-SOURCE-PACKAGES.txt')), false);
    assert.equal(existsSync(path.join(f.root, 'out/PlayPets_0.2.0_aarch64-SYSTEM-SOURCE-PACKAGES.txt')), true);
  },
);

test(
  'a local deb-only build exports no stale AppImage or source manifest',
  {
    skip: process.platform === 'win32',
  },
  t => {
    const f = fixture(t, { bundles: 'deb' });
    assert.equal(f.result.status, 0, f.result.stderr);
    assert.doesNotMatch(f.calls, /appimage-license/);
    assert.equal(existsSync(path.join(f.root, 'out/PlayPets_old.AppImage')), false);
    assert.equal(existsSync(path.join(f.root, 'out/PlayPets_old-SYSTEM-SOURCE-PACKAGES.txt')), false);
    assert.equal(existsSync(path.join(f.root, 'out/PlayPets_0.2.0_arm64.deb')), true);
    assert.equal(existsSync(path.join(f.root, 'out/PlayPets_old.deb')), false);
  },
);

test(
  'an AppImage whose bundled library notices fail verification is not exported',
  {
    skip: process.platform === 'win32',
  },
  t => {
    const f = fixture(t, { rejects: true });
    assert.equal(f.result.status, 19, f.result.stderr);
    assert.equal(existsSync(path.join(f.root, 'out/PlayPets_0.2.0_aarch64.AppImage')), false);
  },
);
