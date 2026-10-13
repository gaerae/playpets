import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, matchesGlob } from 'node:path';
import test from 'node:test';

const read = file => readFileSync(file, 'utf8');
// Git reads the rules of this repository only, not a contributor's global ignores or attributes.
const configDir = mkdtempSync(join(tmpdir(), 'playpets-git-'));
const emptyConfig = join(configDir, 'config');
writeFileSync(emptyConfig, '');
process.on('exit', () => rmSync(configDir, { recursive: true, force: true }));
const git = { env: { ...process.env, GIT_CONFIG_GLOBAL: emptyConfig, GIT_CONFIG_NOSYSTEM: '1' } };

test('Pages redeploys when shared application artwork or publishing inputs change', () => {
  const workflow = read('.github/workflows/pages.yml');
  const paths = workflow
    .match(/paths: \[([^\]]+)\]/)?.[1]
    .split(',')
    .map(path => path.trim());
  assert.ok(paths);
  for (const source of [
    'website/ja/guide/install.md',
    'docs/how-to/website.md',
    'assets/pets/aria/realistic/spritesheet.png',
    'src/art/environments/green.png',
    'src/art/sky/sun.png',
    'src/core/animation.js',
    'src-tauri/icons/tray.png',
    'scripts/creator-kit.mjs',
    'scripts/creator-bundle-lib.mjs',
    'scripts/site-content.mjs',
    '.node-version',
    '.npmrc',
    'package-lock.json',
  ])
    assert.ok(
      paths.some(pattern => matchesGlob(source, pattern)),
      source,
    );
});

test('review guidance covers the same four website languages as publishing', () => {
  const config = read('.coderabbit.yaml');
  assert.match(config, /The site in English, Korean, Japanese and Simplified Chinese/);
  assert.match(config, /counterparts in the other three/);
});

test('repository ignores generated files, local state and signing credentials', () => {
  const paths = [
    '.env',
    '.env.production',
    '.dev-data/state.json',
    '.dev-data-ja/state.json',
    '.npm/_cacache/index',
    '.cache/browser/session.json',
    'coverage/lcov.info',
    '.nyc_output/process.json',
    'test-results/run/trace.zip',
    'playwright-report/index.html',
    '.credentials/signing-password.txt',
    '.DS_Store',
    '.claude/settings.local.json',
    '.vscode/settings.json',
    'release/output.zip',
    'scratch/asset-audit/index.html',
    'src-tauri/target/release/playpets',
    'src-tauri/gen/schemas/desktop-schema.json',
    'website/dev/README.md',
    'website/public/pets/aria-full.png',
    'website/public/creator-kit/aria/aria-kit.zip',
    'website/public/yard/green.png',
    'website/public/icon.svg',
    'website/public/favicon.png',
    'website/public/favicon.ico',
    'website/.vitepress/generated.json',
    'website/.vitepress/dist/index.html',
    'website/.vitepress/.temp/app.js',
    '.claude/worktrees/review/package.json',
    'android/release.keystore',
    'signing/PlayPets.mobileprovision',
    'signing.key',
    'certificate.p12',
    'AuthKey.p8',
    'private.pem',
  ];
  const ignored = execFileSync('git', ['check-ignore', '--no-index', '--stdin'], {
    input: `${paths.join('\n')}\n`,
    encoding: 'utf8',
    ...git,
  })
    .trim()
    .split('\n');
  assert.deepEqual(ignored, paths);
});

test('workflow actions stay pinned and do not run untrusted pull requests with privileged triggers', () => {
  for (const file of readdirSync('.github/workflows')) {
    const workflow = read(`.github/workflows/${file}`);
    assert.doesNotMatch(workflow, /^\s*pull_request_target:/m, file);
    for (const match of workflow.matchAll(/^\s*- (?:id:.*\n\s+)?uses: (.+)$/gm))
      assert.match(match[1], /^[\w-]+\/[\w-]+@[a-f0-9]{40} # /, file);
    assert.match(workflow, /permissions:\n {2}contents: read/, file);
  }
});

test('ignore rules retain examples, fixtures, artwork sources and shared configuration', () => {
  const paths = [
    '.env.example',
    '.vscode/extensions.json',
    'tests/fixtures/trace.json',
    'tests/fixtures/process.log',
    'tests/fixtures/archive.zip',
    'assets/pets/daisy/generated-originals/identity.png',
    'assets/pets/daisy/ART-SOURCES.json',
    'src/art/weather/README.md',
    'website/public/video.json',
    'signing.key.pub',
  ];
  const result = spawnSync('git', ['check-ignore', '--no-index', '--stdin'], {
    input: `${paths.join('\n')}\n`,
    encoding: 'utf8',
    ...git,
  });
  assert.equal(result.status, 1, result.stdout);
  assert.equal(result.stdout, '');
});

test('Git treats media as binary and preserves source metadata as reviewable text', () => {
  const paths = [
    'assets/photo.jpeg',
    'assets/motion.webm',
    'assets/audio.ogg',
    'assets/font.woff2',
    'tests/fixtures/archive.zip',
    'assets/icon.svg',
    'assets/pets/daisy/ART-SOURCES.json',
    'website/public/video.json',
    'website/public/shots/0.1.0/ja/mini.webp',
  ];
  const values = execFileSync('git', ['check-attr', '-z', '--stdin', 'text', 'diff', 'linguist-generated'], {
    input: `${paths.join('\0')}\0`,
    encoding: 'utf8',
    ...git,
  }).split('\0');
  const attributes = new Map();
  for (let i = 0; i < values.length - 1; i += 3) attributes.set(`${values[i]}:${values[i + 1]}`, values[i + 2]);
  for (const path of paths.slice(0, 5)) {
    assert.equal(attributes.get(`${path}:text`), 'unset', path);
    assert.equal(attributes.get(`${path}:diff`), 'unset', path);
  }
  for (const path of paths.slice(5, 8)) {
    assert.notEqual(attributes.get(`${path}:text`), 'unset', path);
    assert.notEqual(attributes.get(`${path}:diff`), 'unset', path);
    assert.notEqual(attributes.get(`${path}:linguist-generated`), 'true', path);
  }
  assert.equal(attributes.get(`${paths[8]}:linguist-generated`), 'true');
});

test('installer packages, fonts and certificates are binary, batch files keep CRLF, and generated metadata is marked', () => {
  const binary = ['release/x/PlayPets.msix', 'assets/fonts/Display.ttf', 'assets/art/source.psd', 'packaging/test.cer'];
  const generated = ['src/art/ambient/birds.png.json', 'assets/creator-kit/aria/kit.json'];
  const paths = [...binary, ...generated, 'scripts/run.bat', 'assets/creator-kit/README.md'];
  const values = execFileSync('git', ['check-attr', '-z', '--stdin', 'binary', 'eol', 'linguist-generated'], {
    input: `${paths.join('\0')}\0`,
    encoding: 'utf8',
    ...git,
  }).split('\0');
  const attributes = new Map();
  for (let i = 0; i < values.length - 1; i += 3) attributes.set(`${values[i]}:${values[i + 1]}`, values[i + 2]);
  for (const path of binary) assert.equal(attributes.get(`${path}:binary`), 'set', path);
  for (const path of generated) assert.equal(attributes.get(`${path}:linguist-generated`), 'true', path);
  assert.equal(attributes.get('scripts/run.bat:eol'), 'crlf');
  assert.notEqual(attributes.get('assets/creator-kit/README.md:linguist-generated'), 'true');
});

// The Docker builds copy the checkout into the container; local data and keys stay on the host.
test('container builds leave local data, keys and build output out of the copy', () => {
  for (const script of ['packaging/linux/build.sh', 'packaging/windows/build.sh']) {
    // The rsync command and its continuation lines (each ending in a backslash).
    const lines = read(script).split('\n');
    const start = lines.findIndex(line => line.startsWith('rsync '));
    const end = lines.findIndex((line, i) => i >= start && !line.endsWith('\\'));
    const copy = lines.slice(start, end + 1).join('\n');
    for (const pattern of [
      '/.dev-data*',
      '/.credentials',
      '*.key',
      '*.pfx',
      'target',
      '/release',
      '/scratch',
      'node_modules',
    ])
      assert.ok(copy.includes(pattern), `${script} copies ${pattern}`);
    assert.doesNotMatch(
      copy,
      /--filter=':- \.gitignore'/,
      `${script}: rsync reads '!' in .gitignore as clearing its rules`,
    );
  }
});

// An image is built from packaging/<platform>/; its .dockerignore lets through only what the Dockerfile
// copies, so a certificate left in that folder never reaches Docker.
test('each Docker build context passes only the files its Dockerfile copies', () => {
  for (const platform of ['linux', 'windows']) {
    const dockerfile = read(`packaging/${platform}/Dockerfile`);
    const ignore = read(`packaging/${platform}/.dockerignore`)
      .split('\n')
      .filter(line => line && !line.startsWith('#'));
    assert.equal(ignore[0], '*', `${platform}: excludes everything first`);
    const allowed = ignore.slice(1).map(line => line.replace(/^!/, '').replace(/\/\*\*$/, ''));
    const copied = [...dockerfile.matchAll(/^COPY (?!--from)(\S+)/gm)].map(match => match[1]);
    for (const source of copied) assert.ok(allowed.includes(source), `${platform}: ${source} is copied but ignored`);
    for (const entry of allowed)
      assert.ok(
        entry === 'Dockerfile' || copied.includes(entry),
        `${platform}: ${entry} is let through but never copied`,
      );
  }
  const root = read('.dockerignore');
  for (const pattern of [
    '.git',
    '.credentials',
    '.dev-data*',
    'scratch',
    'release',
    '**/node_modules',
    '**/*.key',
    '**/*.pfx',
  ])
    assert.ok(root.split('\n').includes(pattern), `.dockerignore: ${pattern}`);
});

test('container builds do not run dependency install scripts while the checkout is mounted', () => {
  for (const script of ['packaging/linux/build.sh', 'packaging/windows/build.sh'])
    for (const line of read(script)
      .split('\n')
      .filter(line => /^\s*npm ci\b/.test(line)))
      assert.match(line, /--ignore-scripts/, script);
});
