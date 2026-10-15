import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const noticeInputs = [
  'src-tauri/Cargo.lock',
  'src-tauri/Cargo.toml',
  'packaging/licenses/about.toml',
  'packaging/licenses/rust-supplements.json',
  'scripts/licenses.mjs',
  'scripts/licenses-lib.mjs',
];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function noticeFingerprint(root) {
  const files = [
    ...noticeInputs,
    ...readdirSync(path.join(root, 'packaging/licenses/upstream'))
      .sort()
      .map(file => `packaging/licenses/upstream/${file}`),
  ];
  return Object.fromEntries(
    files.map(file => {
      let text = readFileSync(path.join(root, file), 'utf8');
      // The app's own version changes during release; dependency versions remain significant.
      if (file === 'src-tauri/Cargo.toml') text = text.replace(/(\[package\][\s\S]*?\nversion = )"[^"\n]+"/, '$1"APP"');
      if (file === 'src-tauri/Cargo.lock') text = text.replace(/(name = "playpets"\nversion = )"[^"\n]+"/, '$1"APP"');
      return [file, digest(text)];
    }),
  );
}
export function verifyNativeNotices(root) {
  const recorded = JSON.parse(readFileSync(path.join(root, 'packaging/licenses/generated.json'), 'utf8'));
  const inputs = noticeFingerprint(root);
  const notice = readFileSync(path.join(root, 'packaging/licenses/THIRD-PARTY-NOTICES.txt'));
  if (JSON.stringify(inputs) !== JSON.stringify(recorded.inputs) || digest(notice) !== recorded.noticeSha256)
    throw new Error('Native license notices are stale; run npm run licenses:generate and review the changes.');
}
export function licenseFiles(directory) {
  return readdirSync(directory, { withFileTypes: true, recursive: true })
    .filter(entry => entry.isFile() && /^(licen[cs]e|copying|copyright|notice)([._-]|$)/i.test(entry.name))
    .map(entry => path.relative(directory, path.join(entry.parentPath, entry.name)))
    .sort();
}
export function supplementTexts(key, kind, root = process.cwd()) {
  const directory = path.join(root, 'packaging/licenses');
  const records = JSON.parse(readFileSync(path.join(directory, `${kind}-supplements.json`), 'utf8'))[key] ?? [];
  return records.map(record => {
    const text = readFileSync(path.join(directory, record.file), 'utf8');
    if (digest(text) !== record.sha256) throw new Error(`Changed supplemental license text for ${key}`);
    return `Source: ${record.source}\n${text}`;
  });
}
export function packageNotice(directory) {
  const pkg = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const files = licenseFiles(directory);
  const supplemental = supplementTexts(`${pkg.name}@${pkg.version}`, 'website');
  const licenses = files.filter(file => /^(licen[cs]e|copying)([._-]|$)/i.test(path.basename(file)));
  if (
    (!licenses.length && !supplemental.length) ||
    licenses.some(file => readFileSync(path.join(directory, file), 'utf8').trim().length < 30)
  )
    throw new Error(`Missing license text for ${pkg.name}@${pkg.version} (${directory})`);
  return `${pkg.name}@${pkg.version}\nDeclared license: ${pkg.license ?? 'See license text'}\n${files
    .map(file => `\n--- ${file} ---\n${readFileSync(path.join(directory, file), 'utf8')}`)
    .concat(supplemental)
    .join('\n')}`;
}

// Rollup supplies the modules actually included in the client bundle, including lazy chunks.
export function websiteNotices() {
  let server = false;
  return {
    configResolved(config) {
      server = Boolean(config.build.ssr);
    },
    name: 'playpets-third-party-notices',
    generateBundle(_options, bundle) {
      if (server) return;
      const packages = new Set();
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        for (const id of Object.keys(chunk.modules)) {
          const clean = id.replace(/^\0/, '').split('?')[0];
          if (!clean.includes('node_modules')) continue;
          let directory = path.dirname(clean);
          while (
            !existsSync(path.join(directory, 'package.json')) ||
            !JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8')).name
          ) {
            const parent = path.dirname(directory);
            if (parent === directory) throw new Error(`Cannot find package for bundled module ${id}`);
            directory = parent;
          }
          packages.add(directory);
        }
      }
      if (!packages.size) throw new Error('No third-party packages found in website bundle');
      const notices = [...packages].map(packageNotice).sort();
      this.emitFile({
        type: 'asset',
        fileName: 'THIRD-PARTY-NOTICES.txt',
        source: `PlayPets website — third-party notices\n\n${notices.join('\n\n================================================================================\n\n')}`,
      });
    },
  };
}
