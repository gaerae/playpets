// Releases: the version lives in one place per tool and they all agree; the changelog has a
// section per release, and the release script moves "Unreleased" into a new one.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  cargoVersion,
  lockVersion,
  notesFor,
  release,
  setCargoVersion,
  setLockVersion,
  setMetainfoRelease,
} from '../scripts/release-lib.mjs';

const CHANGELOG = `# Changelog

## [Unreleased]

### Added
- A new game

## [0.1.0] - 2026-09-30

### Added
- The first version
`;

test('a release moves what is unreleased into a dated section and leaves Unreleased empty', () => {
  const out = release(CHANGELOG, '0.2.0', '2026-10-05');
  assert.match(out, /## \[Unreleased\]\n\n## \[0\.2\.0\] - 2026-10-05\n\n### Added\n- A new game\n\n## \[0\.1\.0\]/);
  assert.throws(() => release(out, '0.3.0', '2026-10-06'), /nothing under \[Unreleased\]/i);
  assert.throws(() => release(CHANGELOG, '0.1.0', '2026-10-06'), /already/i);
  assert.throws(() => release(CHANGELOG, '0.2', '2026-10-06'), /x\.y\.z/);
  const quoted = CHANGELOG.replace(
    '## [Unreleased]',
    'Add a line under `## [Unreleased]\n` when it ships.\n\n## [Unreleased]',
  );
  assert.match(release(quoted, '0.2.0', '2026-10-05'), /when it ships\.\n\n## \[Unreleased\]\n\n## \[0\.2\.0\]/);
});

test('the release notes are the section of that version, without its heading', () => {
  assert.equal(notesFor(CHANGELOG, '0.1.0'), '### Added\n- The first version');
  assert.equal(notesFor(release(CHANGELOG, '0.2.0', '2026-10-05'), '0.2.0'), '### Added\n- A new game');
  assert.throws(() => notesFor(CHANGELOG, '9.9.9'), /no section/i);
});

test('the Linux metainfo gets the release first, replacing a development entry of the same version', () => {
  const xml =
    '<component>\n  <releases>\n    <release version="0.2.0" date="2026-11-01" type="development"/>\n    <release version="0.1.0" date="2026-10-06"/>\n  </releases>\n</component>\n';
  const out = setMetainfoRelease(xml, '0.2.0', '2026-11-02');
  assert.equal(
    out,
    '<component>\n  <releases>\n    <release version="0.2.0" date="2026-11-02"/>\n    <release version="0.1.0" date="2026-10-06"/>\n  </releases>\n</component>\n',
  );
  assert.throws(() => setMetainfoRelease(xml, 'v2', '2026-11-02'));
});

test('updating an older metainfo release preserves the other published versions', () => {
  const xml = `<component>
  <releases>
    <release version="0.3.0" date="2026-12-02"/>
    <release version="0.2.0" date="2026-11-02"/>
    <release version="0.1.0" date="2026-10-06"/>
  </releases>
</component>
`;
  const expected = `<component>
  <releases>
    <release version="0.1.0" date="2026-10-07"/>
    <release version="0.3.0" date="2026-12-02"/>
    <release version="0.2.0" date="2026-11-02"/>
  </releases>
</component>
`;
  const out = setMetainfoRelease(xml, '0.1.0', '2026-10-07');
  assert.equal(out, expected);
  assert.equal(setMetainfoRelease(out, '0.1.0', '2026-10-07'), expected);
});

test('Cargo.toml and Cargo.lock are bumped for the app only', () => {
  const toml =
    '[package]\nname = "playpets"\nversion = "0.1.0"\nedition = "2024"\n\n[dependencies]\nserde = { version = "1.0" }\n';
  assert.equal(cargoVersion(setCargoVersion(toml, '0.2.0')), '0.2.0');
  assert.match(setCargoVersion(toml, '0.2.0'), /serde = \{ version = "1\.0" \}/);
  const lock =
    '[[package]]\nname = "other"\nversion = "0.1.0"\n\n[[package]]\nname = "playpets"\nversion = "0.1.0"\ndependencies = []\n';
  const bumped = setLockVersion(lock, '0.2.0');
  assert.equal(lockVersion(bumped), '0.2.0');
  assert.match(bumped, /name = "other"\nversion = "0\.1\.0"/, 'other packages keep their version');
});

// The version is written in package.json; tauri.conf.json reads it from there, and the Rust side
// must say the same, or the installer, the About box and the binary disagree.
test('every place that states the version states the same one, and the changelog is ready', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const lockfile = JSON.parse(await readFile('package-lock.json', 'utf8'));
  const conf = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8'));
  assert.equal(conf.version, '../package.json', 'tauri.conf.json takes the version from package.json');
  assert.equal(lockfile.version, pkg.version);
  assert.equal(lockfile.packages[''].version, pkg.version);
  assert.equal(cargoVersion(await readFile('src-tauri/Cargo.toml', 'utf8')), pkg.version);
  assert.equal(lockVersion(await readFile('src-tauri/Cargo.lock', 'utf8')), pkg.version);
  const changelog = await readFile('CHANGELOG.md', 'utf8');
  assert.match(changelog, /^## \[Unreleased\]$/m);
  // Tagging empties Unreleased; the current version then owns the release notes.
  const unreleased = changelog.split(/^## \[Unreleased\]\n/m)[1].split(/^## /m)[0];
  assert.match(unreleased.trim() || notesFor(changelog, pkg.version), /^### /);
});

// The workflows call scripts and npm commands by name; a rename on one side must not leave the
// other calling nothing (CI cannot be run from here, so this is checked where it can be).
test('every script and npm command the workflows call exists', async () => {
  const { readdir } = await import('node:fs/promises');
  const { existsSync } = await import('node:fs');
  const scripts = JSON.parse(await readFile('package.json', 'utf8')).scripts;
  for (const file of await readdir('.github/workflows')) {
    const text = await readFile(`.github/workflows/${file}`, 'utf8');
    for (const [, path] of text.matchAll(/node (scripts\/[\w.-]+\.mjs)/g))
      assert.ok(existsSync(path), `${file}: ${path}`);
    for (const [, name] of text.matchAll(/npm run ([\w:-]+)/g)) assert.ok(scripts[name], `${file}: npm run ${name}`);
  }
});

test('a release page written ahead of time gets the release date, once', async () => {
  const { setPageDate } = await import('../scripts/release-lib.mjs');
  const page = '---\nversion: 0.2.0\nheadline: "Hi"\n---\n\n# 0.2.0\n';
  const dated = setPageDate(page, '2026-11-01');
  assert.equal(dated, '---\nversion: 0.2.0\ndate: 2026-11-01\nheadline: "Hi"\n---\n\n# 0.2.0\n');
  assert.equal(setPageDate(dated, '2026-11-02'), dated.replace('2026-11-01', '2026-11-02'));
});

// Published updates use native EXE, deb and AppImage files; macOS tar support is unconditional.
// Legacy ZIP extraction is unnecessary and pulls in vulnerable archive handling on Windows.
test('updates keep TLS and system proxies without legacy ZIP extraction', async () => {
  const manifest = await readFile('src-tauri/Cargo.toml', 'utf8');
  const updater = manifest.match(/^tauri-plugin-updater\s*=\s*(.+)$/m)?.[1] ?? '';
  assert.match(updater, /default-features\s*=\s*false/);
  const features = JSON.parse(updater.match(/features\s*=\s*(\[[^\]]*\])/)?.[1] ?? '[]');
  assert.ok(features.includes('rustls-tls'));
  assert.ok(features.includes('system-proxy'));
  assert.ok(!features.includes('zip'));
  assert.doesNotMatch(await readFile('src-tauri/Cargo.lock', 'utf8'), /name = "zip"\nversion = "[0-8]\./);
});

test('the release push never publishes its tag when the main update is rejected', async () => {
  const root = await mkdtemp(join(tmpdir(), 'playpets-release-push-'));
  const remote = join(root, 'remote.git');
  const client = join(root, 'client');
  const config = join(root, 'config');
  await writeFile(config, '');
  const env = { ...process.env, GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: '1' };
  const git = (args, cwd = client) => spawnSync('git', args, { cwd, env, encoding: 'utf8' });
  const ok = (args, cwd) => {
    const result = git(args, cwd);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  try {
    ok(['init', '--bare', remote], root);
    ok(['init', '--initial-branch=main', client], root);
    ok(['config', 'user.name', 'Release fixture']);
    ok(['config', 'user.email', 'fixture@example.invalid']);
    ok(['commit', '--allow-empty', '-m', 'Initial fixture']);
    ok(['remote', 'add', 'origin', remote]);
    ok(['push', 'origin', 'HEAD']);
    const before = ok(['rev-parse', 'HEAD']);
    ok(['commit', '--allow-empty', '-m', 'Release fixture']);
    ok(['tag', '-a', 'v0.2.0', '-m', 'Release fixture']);
    const hook = join(remote, 'hooks', 'update');
    await writeFile(hook, '#!/bin/sh\ntest "$1" != refs/heads/main\n', { mode: 0o755 });
    const script = await readFile('scripts/release.mjs', 'utf8');
    const hint = script.match(/git push ([^`\\\n]+)/)[1];
    const args = [
      'push',
      ...hint
        .trim()
        .split(/\s+/)
        .map(arg => arg.replace(/v\$\{version\}/, 'v0.2.0')),
    ];
    assert.notEqual(git(args).status, 0, 'the main protection rejects this push');
    assert.equal(ok(['--git-dir', remote, 'rev-parse', 'refs/heads/main']), before);
    assert.notEqual(
      git(['--git-dir', remote, 'rev-parse', '--verify', 'refs/tags/v0.2.0']).status,
      0,
      'a rejected main update must leave the tag unpublished',
    );
    await rm(hook);
    ok(args);
    const after = ok(['rev-parse', 'HEAD']);
    assert.equal(ok(['--git-dir', remote, 'rev-parse', 'refs/heads/main']), after);
    assert.equal(ok(['--git-dir', remote, 'rev-parse', 'refs/tags/v0.2.0^{commit}']), after);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
