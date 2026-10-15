import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

function hasText(file) {
  return existsSync(file) && statSync(file).isFile() && Boolean(readFileSync(file, 'utf8').trim());
}

function requireText(root, relative, label = relative) {
  const file = path.join(root, relative);
  if (!hasText(file)) {
    throw new Error(`AppImage is missing ${label}: /${relative}`);
  }
}

export function verifyAppImageTree(root) {
  requireText(root, 'usr/lib/PlayPets/THIRD-PARTY-NOTICES.txt', 'PlayPets third-party notices');
  requireText(root, 'usr/share/common-licenses/LGPL-2.1', 'the LGPL-2.1 full text');
  if (!bundledCopyright(root, 'dconf-gsettings-backend')) {
    throw new Error('AppImage is missing dconf-gsettings-backend copyright and license text.');
  }
  return { checkedPlugins: ['dconf-gsettings-backend'] };
}

function libraryBasenames(directory, relative = '') {
  if (!existsSync(directory)) return [];
  const names = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const childRelative = path.join(relative, entry.name);
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (childRelative !== 'PlayPets') names.push(...libraryBasenames(child, childRelative));
    } else if (/\.so(?:\.|$)/.test(entry.name)) names.push(entry.name);
  }
  return [...new Set(names)].sort();
}

function packageWithoutArchitecture(packageName) {
  return packageName.replace(/:[^:]+$/, '');
}

function bundledCopyright(root, packageName) {
  const name = packageWithoutArchitecture(packageName);
  return [
    path.join(root, 'usr/share/doc/playpets-bundled-libraries', name, 'copyright'),
    path.join(root, 'usr/share/doc', name, 'copyright'),
  ].find(hasText);
}

export function appImageCopyrightPackages(lddOutput, ownersForBasename) {
  // linuxdeploy adds these runtime-loaded integrations outside the executable's ldd graph.
  const packages = new Set(['dconf-gsettings-backend', 'libayatana-appindicator3-1']);
  for (const line of lddOutput.split('\n')) {
    if (/=>\s+not found\s*$/.test(line)) throw new Error(`Loaded library was not found: ${line.trim()}`);
    const match = line.match(/(?:=>\s+)?(\/\S+)\s+\(/);
    if (!match) continue;
    const basename = path.basename(match[1]);
    const owners = ownersForBasename(basename);
    if (!owners.length) throw new Error(`Loaded library ${basename} has no installed package owner.`);
    for (const owner of owners) packages.add(owner);
  }
  return [...packages].sort();
}

export function systemLibraryPackages(root, ownersForBasename) {
  const packages = new Set();
  for (const basename of libraryBasenames(path.join(root, 'usr/lib'))) {
    const owners = ownersForBasename(basename);
    if (!owners.length) throw new Error(`Bundled library ${basename} has no installed package owner.`);
    const documented = owners.filter(owner => bundledCopyright(root, owner));
    if (!documented.length) {
      throw new Error(`Bundled library ${basename} is missing copyright text for ${owners.join(', ')}.`);
    }
    for (const owner of documented) packages.add(owner);
  }
  return [...packages].sort();
}

export function appImageSystemPackages(rows) {
  const packages = rows
    .filter(Boolean)
    .map(row => {
      const [binary, binaryVersion, sourceName, sourceVersion] = row.split('\t');
      if (!binary || !binaryVersion) throw new Error(`Invalid dpkg package row: ${row}`);
      return {
        binary,
        binaryVersion,
        sourceName: sourceName || binary.replace(/:[^:]+$/, ''),
        sourceVersion: sourceVersion || binaryVersion,
      };
    })
    .sort((left, right) => left.binary.localeCompare(right.binary));
  const sources = new Map();
  for (const item of packages) sources.set(item.sourceName, item.sourceVersion);
  return [
    'PlayPets AppImage system library source manifest',
    '',
    'This manifest records the exact Ubuntu binary and source package versions from the runner that built the AppImage.',
    'Ubuntu source packages can be retrieved after enabling matching deb-src entries:',
    '',
    ...packages.map(item => `${item.binary} ${item.binaryVersion} (source: ${item.sourceName} ${item.sourceVersion})`),
    '',
    'Corresponding source commands',
    '',
    ...[...sources].map(([name, version]) => `apt-get source ${name}=${version}`),
    '',
  ].join('\n');
}
