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
    'src/app.js.orig',
    'src/app.js.rej',
    'notes.md~',
    '.notes.md.swo',
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
    'docs/release/notes.md',
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
  const binary = [
    'release/x/PlayPets.msix',
    'assets/fonts/Display.ttf',
    'assets/art/source.psd',
    'assets/pets/mochi/sheet.aseprite',
    'packaging/test.cer',
    'packaging/libmsix.dylib',
  ];
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

// The Docker builds copy the mounted checkout with rsync, excluding what the root .dockerignore lists.
const dockerignore = () =>
  read('.dockerignore')
    .split('\n')
    .filter(line => line && !line.startsWith('#'));

test('container builds copy the checkout through the root .dockerignore', () => {
  for (const script of ['packaging/linux/build.sh', 'packaging/windows/build.sh']) {
    const copies = read(script)
      .split('\n')
      .filter(line => line.startsWith('rsync '));
    assert.equal(copies.length, 1, script);
    assert.match(copies[0], / --exclude-from=\/src\/\.dockerignore \/src\/ \/work\/$/, script);
  }
});

// rsync reads a lone '!' as clearing the list, and a bare name as matching at any depth, which Docker
// does not; '/name' and '**/name' mean the same to both.
test('.dockerignore patterns mean the same to Docker and to rsync', () => {
  for (const line of dockerignore()) {
    assert.match(line, /^(\/|\*\*\/)/, line);
    assert.doesNotMatch(line, /!/, line);
  }
});

test('.dockerignore keeps out of containers everything Git ignores', () => {
  const docker = dockerignore();
  // Sanitized parser fixtures (tests/fixtures/**/*.log) are source a build may read.
  const readable = new Set(['*.log']);
  for (const raw of read('.gitignore').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('!') || readable.has(line)) continue;
    const name = line.replace(/\/\*?$/, '');
    const pattern = name.startsWith('/') ? name : name.includes('/') ? `/${name}` : `**/${name}`;
    assert.ok(
      docker.some(entry => entry === pattern || pattern.startsWith(`${entry}/`)),
      `.dockerignore lacks ${pattern} (.gitignore: ${line})`,
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
});

test('container builds do not run dependency install scripts while the checkout is mounted', () => {
  for (const script of ['packaging/linux/build.sh', 'packaging/windows/build.sh'])
    for (const line of read(script)
      .split('\n')
      .filter(line => /^\s*npm ci\b/.test(line)))
      assert.match(line, /--ignore-scripts/, script);
});

// tauri-build watches src-tauri/capabilities, and Cargo counts a watched path that does not exist as
// changed: without the folder every cargo build compiled the app again.
test('the capabilities folder Tauri watches is kept in the repository', () => {
  const files = readdirSync('src-tauri/capabilities');
  assert.ok(files.length > 0, 'Git keeps a folder only while it holds a file');
  const ignored = spawnSync(
    'git',
    ['check-ignore', '--no-index', ...files.map(f => `src-tauri/capabilities/${f}`)],
    git,
  );
  assert.equal(ignored.status, 1, String(ignored.stdout));
});

test('checkouts drop the job token, and the job holding signing secrets restores no cache', () => {
  for (const file of readdirSync('.github/workflows')) {
    const steps = read(`.github/workflows/${file}`).split(/\n(?=\s*- )/);
    for (const step of steps.filter(step => /uses: actions\/checkout@/.test(step)))
      assert.match(step, /persist-credentials: false/, file);
  }
  const release = read('.github/workflows/release.yml');
  const build = release.slice(release.indexOf('\n  build:'), release.indexOf('\n  publish:'));
  assert.match(build, /TAURI_SIGNING_PRIVATE_KEY/);
  assert.doesNotMatch(build, /cache: npm|rust-cache/);
});

// Tauri skips a target the platform cannot build, so one list gives each platform what CI builds;
// with only "app", `npm run build` on Windows or Linux made no package at all.
test("npm run build makes each platform's packages, as CI does", () => {
  const targets = JSON.parse(read('src-tauri/tauri.conf.json')).bundle.targets;
  const ci = [...read('.github/workflows/build.yml').matchAll(/bundles: "?([\w,]+)"?\}/g)].flatMap(m =>
    m[1].split(','),
  );
  for (const bundle of ci.filter(b => b !== 'dmg')) assert.ok(targets.includes(bundle), bundle);
  // A disk image is styled through Finder, which asks for permission on a developer's Mac.
  assert.ok(!targets.includes('dmg'));
});

test('Node has one major version: .node-version, package.json engines and the Docker images', () => {
  const major = read('.node-version').trim();
  assert.equal(JSON.parse(read('package.json')).engines.node, `>=${major}`);
  for (const platform of ['linux', 'windows'])
    assert.match(
      read(`packaging/${platform}/Dockerfile`),
      new RegExp(`^FROM node:${major}-\\S+ AS node$`, 'm'),
      platform,
    );
});

// CI runs the e2e from its release build instead of test:e2e's own profile (build.yml). A change to
// test:e2e fails here until the workflow's E2E steps make the same change.
test('the CI e2e builds and runs what npm run test:e2e does', () => {
  const local = JSON.parse(read('package.json')).scripts['test:e2e'];
  assert.equal(
    local,
    'cargo build --profile e2e --features e2e --manifest-path src-tauri/Cargo.toml && node tests/e2e.mjs',
    'test:e2e changed: update the E2E steps in .github/workflows/build.yml too',
  );
  const workflow = read('.github/workflows/build.yml');
  assert.match(workflow, /run: cargo build --release --features e2e --manifest-path src-tauri\/Cargo\.toml\n/);
  assert.equal([...workflow.matchAll(/run: .*node tests\/e2e\.mjs\n/g)].length, 2);
  const binaries = [
    ...workflow.matchAll(/PLAYPETS_BINARY: \$\{\{ github\.workspace \}\}\/src-tauri\/target\/release\/playpets/g),
  ];
  assert.equal(binaries.length, 2);
  assert.doesNotMatch(workflow, /npm run test:e2e/);
});
