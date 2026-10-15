import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { licenseFiles, noticeFingerprint, supplementTexts, verifyNativeNotices } from './licenses-lib.mjs';

if (process.argv.includes('--check')) {
  verifyNativeNotices(process.cwd());
} else {
  const version = execFileSync('cargo', ['about', '--version'], { encoding: 'utf8' }).trim();
  if (version !== 'cargo-about 0.9.2')
    throw new Error('Install cargo-about 0.9.2 with --locked --features cli before regenerating notices.');
  const report = JSON.parse(
    execFileSync(
      'cargo',
      [
        'about',
        'generate',
        '--locked',
        '--fail',
        '--manifest-path',
        'src-tauri/Cargo.toml',
        '--config',
        'packaging/licenses/about.toml',
        '--format',
        'json',
      ],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] },
    ),
  );
  const sections = new Map();
  for (const { package: pkg } of report.crates) {
    if (pkg.name === 'playpets') continue;
    const key = `${pkg.name}@${pkg.version}`;
    const directory = path.dirname(pkg.manifest_path);
    const files = licenseFiles(directory);
    const supplemental = supplementTexts(key, 'rust');
    // cargo-about can silently substitute generic SPDX text. Preserve real attribution separately.
    if (!files.length && !supplemental.length) throw new Error(`Missing original license or copyright text for ${key}`);
    const texts = files.map(file => readFileSync(path.join(directory, file), 'utf8')).concat(supplemental);
    for (const text of texts) {
      if (!text.trim()) throw new Error(`Empty license file for ${key}`);
      if (!sections.has(text)) sections.set(text, new Set());
      sections.get(text).add(key);
    }
  }
  const selected = report.licenses
    .map(
      license =>
        `${license.name}\nUsed by: ${license.used_by
          .filter(item => item.crate.name !== 'playpets')
          .map(item => `${item.crate.name}@${item.crate.version}`)
          .sort()
          .join(', ')}\n\n${license.text}`,
    )
    .join('\n\n');
  const originals = [...sections]
    .map(([text, packages]) => `Used by: ${[...packages].sort().join(', ')}\n\n${text}`)
    .sort()
    .join('\n\n================================================================================\n\n');
  const notice =
    `PlayPets third-party Rust dependency notices\nGenerated with ${version} from Cargo.lock for the desktop targets in about.toml.\nIncludes build dependencies and original license/copyright files.\nSystem libraries redistributed by an OS packager require a separate inventory.\n\nSELECTED LICENSE TERMS\n\n${selected}\n\nORIGINAL LICENSES AND ATTRIBUTION\n\n${originals}\n`.replace(
      /\r\n/g,
      '\n',
    );
  writeFileSync('packaging/licenses/THIRD-PARTY-NOTICES.txt', notice);
  writeFileSync(
    'packaging/licenses/generated.json',
    `${JSON.stringify({ generator: version, inputs: noticeFingerprint(process.cwd()), noticeSha256: createHash('sha256').update(notice).digest('hex') }, null, 2)}\n`,
  );
}
