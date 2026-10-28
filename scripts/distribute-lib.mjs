// What the channels beyond GitHub releases need, made from a release: the updater's latest.json,
// winget's manifests and the Homebrew cask. Plain functions (tests/distribute.test.mjs); the
// release and distribute workflows call them through scripts/distribute.mjs.

import { releasePageUrl } from './site-content.mjs';

const APP = 'PlayPets';
const WINGET_ID = 'gaerae.PlayPets';
const WINGET_SCHEMA = '1.12.0';
const IDENTIFIER = 'app.playpets';

// "github:owner/repo" (package.json "repository") → "owner/repo".
export function repoSlug(pkg) {
  const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url || '';
  const slug = repo
    .replace(/^github:/, '')
    .replace(/^https:\/\/github\.com\//, '')
    .replace(/\.git$/, '');
  if (!/^[\w.-]+\/[\w.-]+$/.test(slug)) throw new Error(`package.json has no GitHub repository ("${repo}").`);
  return slug;
}

// The release workflow names every file PlayPets_<version>_<platform>.<ext>.
export const assetName = (version, suffix) => `${APP}_${version}_${suffix}`;
const assetUrl = (slug, version, file) => `https://github.com/${slug}/releases/download/v${version}/${file}`;

// SHA256SUMS.txt ("<hash>  <file>" per line) → {file: hash}.
export function parseSums(text) {
  const sums = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([0-9a-f]{64})\s+\*?(.+)$/i);
    if (m) sums[m[2].trim()] = m[1].toLowerCase();
  }
  return sums;
}

// Which updater keys a file serves. The updater looks for "<os>-<arch>-<installer>" first, then
// "<os>-<arch>": a friend installed from the dmg updates from the .app archive, one installed
// from a deb from the deb, and the portable zip is not updated.
const UPDATER_TARGETS = [
  [/_macos-universal\.app\.tar\.gz$/, ['darwin-aarch64', 'darwin-x86_64']],
  [/_windows-x64-setup\.exe$/, ['windows-x86_64-nsis']],
  [/_windows-arm64-setup\.exe$/, ['windows-aarch64-nsis']],
  [/_linux-x64\.AppImage$/, ['linux-x86_64-appimage']],
  [/_linux-arm64\.AppImage$/, ['linux-aarch64-appimage']],
  [/_linux-x64\.deb$/, ['linux-x86_64-deb']],
  [/_linux-arm64\.deb$/, ['linux-aarch64-deb']],
];

// latest.json for the updater. `signatures`: {release file name: contents of its .sig}.
export function updaterManifest({ version, notes, date, slug, signatures }) {
  const platforms = {};
  for (const [file, signature] of Object.entries(signatures)) {
    const targets = UPDATER_TARGETS.find(([pattern]) => pattern.test(file))?.[1] || [];
    for (const target of targets)
      platforms[target] = { signature: signature.trim(), url: assetUrl(slug, version, file) };
  }
  if (!Object.keys(platforms).length) throw new Error('No signed updater file was found.');
  return { version, notes, pub_date: date, platforms };
}

function need(sums, file) {
  const hash = sums[file];
  if (!hash) throw new Error(`SHA256SUMS.txt has no ${file}.`);
  return hash;
}

// winget's multi-file manifest of a version, as {path in winget-pkgs: contents}.
export function wingetManifests({ version, date, slug, sums }) {
  const dir = `manifests/${WINGET_ID[0].toLowerCase()}/${WINGET_ID.replace('.', '/')}/${version}`;
  // wingetcreate checks that the first line names the schema of the manifest's type.
  const schema = type =>
    `# yaml-language-server: $schema=https://aka.ms/winget-manifest.${type}.${WINGET_SCHEMA}.schema.json\n`;
  const head = type => `${schema(type)}PackageIdentifier: ${WINGET_ID}\nPackageVersion: ${version}\n`;
  const tail = type => `ManifestType: ${type}\nManifestVersion: ${WINGET_SCHEMA}\n`;
  const installer = arch => {
    const file = assetName(version, `windows-${arch}-setup.exe`);
    return `  - Architecture: ${arch}\n    InstallerUrl: ${assetUrl(slug, version, file)}\n    InstallerSha256: ${need(sums, file).toUpperCase()}\n`;
  };
  const home = `https://github.com/${slug}`;
  return {
    [`${dir}/${WINGET_ID}.yaml`]: `${head('version')}DefaultLocale: en-US\n${tail('version')}`,
    [`${dir}/${WINGET_ID}.installer.yaml`]:
      `${head('installer')}InstallerType: nullsoft\nScope: user\nUpgradeBehavior: install\nReleaseDate: ${date}\nInstallers:\n` +
      `${installer('x64')}${installer('arm64')}${tail('installer')}`,
    [`${dir}/${WINGET_ID}.locale.en-US.yaml`]:
      `${head('defaultLocale')}PackageLocale: en-US\nPublisher: ${slug.split('/')[0]}\nPublisherUrl: https://github.com/${slug.split('/')[0]}\n` +
      `PackageName: ${APP}\nPackageUrl: ${home}\nLicense: MIT\nLicenseUrl: ${home}/blob/main/LICENSE\n` +
      `ShortDescription: A yard where your pets talk to each other\n` +
      `Tags:\n  - desktop-pet\n  - pet\n  - ai\n  - tauri\nReleaseNotesUrl: ${releasePageUrl(version)}\n` +
      tail('defaultLocale'),
  };
}

// The cask for a Homebrew tap (Casks/playpets.rb).
export function homebrewCask({ version, slug, sums }) {
  const sha = need(sums, assetName(version, 'macos-universal.dmg'));
  return `cask "playpets" do
  version "${version}"
  sha256 "${sha}"

  url "https://github.com/${slug}/releases/download/v#{version}/${APP}_#{version}_macos-universal.dmg"
  name "${APP}"
  desc "Yard where your pets talk to each other"
  homepage "https://github.com/${slug}"

  # The app updates itself (Tauri updater); brew upgrade leaves it to that.
  auto_updates true
  depends_on :macos

  app "${APP}.app"

  zap trash: [
    "~/Library/Application Support/${IDENTIFIER}",
    "~/Library/Caches/${IDENTIFIER}",
    "~/Library/Preferences/${IDENTIFIER}.plist",
    "~/Library/WebKit/${IDENTIFIER}",
  ]
end
`;
}
