// Distribution files made from a release: the updater's latest.json, the winget manifests and
// the Homebrew cask. They point at the release's files by name, so the names the release workflow
// gives its files and the names these expect must stay the same.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  assetName,
  homebrewCask,
  parseSums,
  repoSlug,
  updaterManifest,
  wingetManifests,
} from '../scripts/distribute-lib.mjs';

const SLUG = 'gaerae/playpets';
const SUMS = `${'a'.repeat(64)}  PlayPets_0.2.0_macos-universal.dmg
${'b'.repeat(64)}  PlayPets_0.2.0_windows-x64-setup.exe
${'c'.repeat(64)}  PlayPets_0.2.0_windows-arm64-setup.exe
${'d'.repeat(64)}  PlayPets_0.2.0_linux-x64.AppImage
`;

test('package.json names the repository and the updater points at it', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(repoSlug(pkg), SLUG);
  const conf = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8'));
  assert.deepEqual(conf.plugins.updater.endpoints, [`https://github.com/${SLUG}/releases/latest/download/latest.json`]);
  assert.ok(conf.plugins.updater.pubkey.length > 40, 'the updater has a public key');
});

test('release files are named by version and platform', () => {
  assert.equal(assetName('0.2.0', 'macos-universal.dmg'), 'PlayPets_0.2.0_macos-universal.dmg');
  assert.deepEqual(parseSums(SUMS)['PlayPets_0.2.0_linux-x64.AppImage'], 'd'.repeat(64));
});

test('latest.json lists each signed file under the installer kind that updates from it', () => {
  const m = updaterManifest({
    version: '0.2.0',
    notes: '### 고침\n- 무엇',
    date: '2026-10-05T00:00:00Z',
    slug: SLUG,
    signatures: {
      'PlayPets_0.2.0_macos-universal.app.tar.gz': 'SIG-MAC',
      'PlayPets_0.2.0_windows-x64-setup.exe': 'SIG-WIN',
      'PlayPets_0.2.0_linux-x64.AppImage': 'SIG-LINUX',
      'PlayPets_0.2.0_linux-x64.deb': 'SIG-DEB',
      'PlayPets_0.2.0_windows-x64-debug.txt': 'ignored: not an updater artifact',
    },
  });
  const url = file => `https://github.com/${SLUG}/releases/download/v0.2.0/${file}`;
  assert.equal(m.version, '0.2.0');
  assert.equal(m.pub_date, '2026-10-05T00:00:00Z');
  assert.deepEqual(m.platforms['darwin-aarch64'], {
    signature: 'SIG-MAC',
    url: url('PlayPets_0.2.0_macos-universal.app.tar.gz'),
  });
  assert.deepEqual(m.platforms['darwin-x86_64'], m.platforms['darwin-aarch64'], 'one universal app for both Macs');
  assert.equal(m.platforms['windows-x86_64-nsis'].signature, 'SIG-WIN');
  assert.equal(m.platforms['linux-x86_64-appimage'].url, url('PlayPets_0.2.0_linux-x64.AppImage'));
  assert.equal(m.platforms['linux-x86_64-deb'].signature, 'SIG-DEB');
  assert.equal(Object.keys(m.platforms).length, 5, 'unrecognized release files update nothing');
});

test('winget gets the three manifests of a version, with both installers', () => {
  const files = wingetManifests({ version: '0.2.0', date: '2026-10-05', slug: SLUG, sums: parseSums(SUMS) });
  const dir = 'manifests/g/gaerae/PlayPets/0.2.0';
  assert.deepEqual(Object.keys(files).sort(), [
    `${dir}/gaerae.PlayPets.installer.yaml`,
    `${dir}/gaerae.PlayPets.locale.en-US.yaml`,
    `${dir}/gaerae.PlayPets.yaml`,
  ]);
  const installer = files[`${dir}/gaerae.PlayPets.installer.yaml`];
  assert.match(installer, /InstallerType: nullsoft/);
  assert.match(
    installer,
    /Architecture: x64\n {4}InstallerUrl: https:\/\/github\.com\/gaerae\/playpets\/releases\/download\/v0\.2\.0\/PlayPets_0\.2\.0_windows-x64-setup\.exe\n {4}InstallerSha256: B{64}/,
  );
  assert.match(installer, /Architecture: arm64/);
  assert.match(files[`${dir}/gaerae.PlayPets.locale.en-US.yaml`], /License: MIT/);
  assert.throws(() => wingetManifests({ version: '0.2.0', date: 'x', slug: SLUG, sums: {} }), /windows-x64-setup/);
});

test('the Homebrew cask points at the universal dmg and names what zap removes', () => {
  const cask = homebrewCask({ version: '0.2.0', slug: SLUG, sums: parseSums(SUMS) });
  assert.match(cask, /cask "playpets" do/);
  assert.match(cask, /version "0\.2\.0"/);
  assert.match(cask, new RegExp(`sha256 "${'a'.repeat(64)}"`));
  assert.match(
    cask,
    /url "https:\/\/github\.com\/gaerae\/playpets\/releases\/download\/v#\{version\}\/PlayPets_#\{version\}_macos-universal\.dmg"/,
  );
  assert.match(cask, /app "PlayPets\.app"/);
  assert.match(cask, /Application Support\/app\.playpets/);
  assert.match(cask, /auto_updates true/, 'the app updates itself, so brew leaves it be');
  // Homebrew 7 refuses a minimum macOS release in a cask; macOS-only is all it takes.
  assert.match(cask, /^  depends_on :macos$/m);
  assert.doesNotMatch(cask, /depends_on macos:/);
});
