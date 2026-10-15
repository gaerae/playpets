import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { appImageSystemPackages, systemLibraryPackages, verifyAppImageTree } from '../scripts/appimage-license-lib.mjs';
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
  const release = readFileSync('.github/workflows/release.yml', 'utf8');
  assert.match(release, /appimage-license\.mjs/);
  assert.match(release, /SYSTEM-SOURCE-PACKAGES\.txt/);
  assert.match(release, /package-smoke\.mjs macos/);
  assert.match(release, /package-smoke\.mjs windows/);
  assert.match(release, /package-smoke\.mjs linux/);
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
  assert.equal(
    bundle.linux.appimage.files['/usr/share/doc/dconf-gsettings-backend/copyright'],
    '/usr/share/doc/dconf-gsettings-backend/copyright',
  );
  // Host distro paths belong only to AppImage packaging, never shared resources or other targets.
  assert.ok(!JSON.stringify(bundle.resources).includes('/usr/share/common-licenses'));
  assert.ok(!JSON.stringify(bundle.linux.deb).includes('/usr/share/common-licenses'));
  assert.ok(!JSON.stringify(bundle.windows).includes('/usr/share/common-licenses'));
  assert.ok(!JSON.stringify(bundle.macOS).includes('/usr/share/common-licenses'));
});

test('AppImage license verification rejects a bundled dconf plugin without its copyright', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'playpets-appimage-'));
  try {
    for (const file of [
      'usr/lib/PlayPets/THIRD-PARTY-NOTICES.txt',
      'usr/lib/gio/modules/libdconfsettings.so',
      'usr/share/common-licenses/LGPL-2.1',
    ]) {
      const target = path.join(root, file);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, 'complete text');
    }
    assert.throws(() => verifyAppImageTree(root), /dconf-gsettings-backend/);
    const copyright = path.join(root, 'usr/share/doc/dconf-gsettings-backend/copyright');
    mkdirSync(path.dirname(copyright), { recursive: true });
    writeFileSync(copyright, 'Copyright and license text');
    assert.deepEqual(verifyAppImageTree(root), { checkedPlugins: ['dconf-gsettings-backend'] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('AppImage source manifest identifies every bundled system package', () => {
  const report = appImageSystemPackages([
    'dconf-gsettings-backend\t0.40.0-3\tdconf\t0.40.0-3',
    'libgtk-3-0\t3.24.33-1ubuntu2.2\tgtk+3.0\t3.24.33-1ubuntu2.2',
  ]);
  assert.match(report, /dconf-gsettings-backend 0\.40\.0-3 \(source: dconf 0\.40\.0-3\)/);
  assert.match(report, /apt-get source dconf=0\.40\.0-3/);
  assert.match(report, /apt-get source gtk\+3\.0=3\.24\.33-1ubuntu2\.2/);
});

test('AppImage source inventory follows bundled libraries instead of notice directories', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'playpets-appimage-'));
  try {
    for (const file of [
      'usr/lib/libgtk-3.so.0',
      'usr/lib/gio/modules/libdconfsettings.so',
      'usr/share/doc/libgtk-3-0/copyright',
      'usr/share/doc/dconf-gsettings-backend/copyright',
    ]) {
      const target = path.join(root, file);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, 'fixture');
    }
    const owners = new Map([
      ['libgtk-3.so.0', ['libgtk-3-0:amd64']],
      ['libdconfsettings.so', ['dconf-gsettings-backend:amd64']],
    ]);
    assert.deepEqual(
      systemLibraryPackages(root, basename => owners.get(basename) ?? []),
      ['dconf-gsettings-backend:amd64', 'libgtk-3-0:amd64'],
    );
    assert.throws(() => systemLibraryPackages(root, () => []), /no installed package owner/i);
    writeFileSync(path.join(root, 'usr/share/doc/libgtk-3-0/copyright'), '');
    assert.throws(() => systemLibraryPackages(root, basename => owners.get(basename) ?? []), /libgtk-3-0/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
