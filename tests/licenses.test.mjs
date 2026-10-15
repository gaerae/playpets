import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { noticeInputs, packageNotice, verifyNativeNotices, websiteNotices } from '../scripts/licenses-lib.mjs';

test('bundled package notices retain exact license and additional notice text', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'playpets-notices-'));
  try {
    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ name: 'sample', version: '1.2.3', license: 'MIT' }),
    );
    writeFileSync(path.join(root, 'LICENSE'), 'Copyright 2026 Example\nPermission is hereby granted.');
    writeFileSync(path.join(root, 'NOTICE'), 'Includes Example contributions.');
    const notice = packageNotice(root);
    assert.match(notice, /sample@1.2.3/);
    assert.match(notice, /Copyright 2026 Example\nPermission is hereby granted\./);
    assert.match(notice, /Includes Example contributions\./);
    rmSync(path.join(root, 'LICENSE'));
    assert.throws(() => packageNotice(root), /license text/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('native notices fail closed when the lock or generated notice has changed', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'playpets-notices-'));
  try {
    for (const dir of ['src-tauri', 'packaging/licenses', 'scripts'])
      mkdirSync(path.join(root, dir), { recursive: true });
    assert.throws(() => verifyNativeNotices(root), /./);
    for (const file of noticeInputs) cpSync(file, path.join(root, file));
    for (const file of ['upstream', 'generated.json', 'THIRD-PARTY-NOTICES.txt'])
      cpSync(`packaging/licenses/${file}`, path.join(root, 'packaging/licenses', file), { recursive: true });
    verifyNativeNotices(root);
    for (const file of ['src-tauri/Cargo.toml', 'src-tauri/Cargo.lock']) {
      const target = path.join(root, file);
      writeFileSync(
        target,
        readFileSync(target, 'utf8').replace(/(name = "playpets"\nversion = )"[^"]+"/, '$1"9.8.7"'),
      );
    }
    verifyNativeNotices(root);
    const lock = path.join(root, 'src-tauri/Cargo.lock');
    const original = readFileSync(lock, 'utf8');
    writeFileSync(lock, `${original}\n# dependency change`);
    assert.throws(() => verifyNativeNotices(root), /stale/);
    writeFileSync(lock, original);
    writeFileSync(path.join(root, 'packaging/licenses/THIRD-PARTY-NOTICES.txt'), 'truncated');
    assert.throws(() => verifyNativeNotices(root), /stale/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  verifyNativeNotices(process.cwd());
});

test('installers and portable packages carry the native license notices', () => {
  const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
  assert.equal(config.bundle.resources['../packaging/licenses/THIRD-PARTY-NOTICES.txt'], 'THIRD-PARTY-NOTICES.txt');
  assert.match(config.build.beforeBuildCommand, /licenses:check/);
  for (const file of ['packaging/windows/build.sh', '.github/workflows/release.yml']) {
    assert.match(readFileSync(file, 'utf8'), /THIRD-PARTY-NOTICES\.txt/);
  }
});

test('website notice asset covers lazy chunks and excludes unbundled packages', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'playpets-bundle-'));
  try {
    const directory = path.join(root, 'node_modules', 'example');
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name: 'example', version: '1' }));
    writeFileSync(path.join(directory, 'LICENSE'), 'Copyright Example. Permission is hereby granted.');
    mkdirSync(path.join(directory, 'esm'));
    writeFileSync(path.join(directory, 'esm/package.json'), JSON.stringify({ type: 'module' }));
    const plugin = websiteNotices();
    let emitted;
    plugin.generateBundle.call(
      {
        emitFile: asset => {
          emitted = asset;
        },
      },
      {},
      { lazy: { type: 'chunk', modules: { [path.join(directory, 'esm/lazy.js')]: {} } } },
    );
    assert.equal(emitted.fileName, 'THIRD-PARTY-NOTICES.txt');
    assert.match(emitted.source, /Copyright Example/);
    rmSync(path.join(directory, 'LICENSE'));
    assert.throws(
      () =>
        plugin.generateBundle.call(
          { emitFile: () => {} },
          {},
          { lazy: { type: 'chunk', modules: { [path.join(directory, 'esm/lazy.js')]: {} } } },
        ),
      /Missing license text/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('AppImage carries the distro license texts referenced by copied library copyrights', () => {
  const { bundle } = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
  assert.equal(bundle.linux.appimage.files['/usr/share/common-licenses'], '/usr/share/common-licenses');
  // Host distro paths belong only to AppImage packaging, never shared resources or other targets.
  assert.ok(!JSON.stringify(bundle.resources).includes('/usr/share/common-licenses'));
  assert.ok(!JSON.stringify(bundle.linux.deb).includes('/usr/share/common-licenses'));
  assert.ok(!JSON.stringify(bundle.windows).includes('/usr/share/common-licenses'));
  assert.ok(!JSON.stringify(bundle.macOS).includes('/usr/share/common-licenses'));
});
