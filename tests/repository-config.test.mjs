import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, matchesGlob } from 'node:path';
import test from 'node:test';

test('the Windows installer offers every app language without relying on English artwork', () => {
  const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
  assert.deepEqual(config.bundle.windows.nsis.languages, ['English', 'Korean', 'Japanese', 'SimpChinese']);
  assert.equal(config.bundle.windows.nsis.displayLanguageSelector, true);
});

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
    'src/core/season.js',
    'src/yard/background-pack.js',
    'scripts/background-specs.mjs',
    'src-tauri/icons/tray.png',
    'scripts/creator-kit.mjs',
    'scripts/creator-bundle-lib.mjs',
    'scripts/creator-skill.mjs',
    'scripts/creator-workflow.py',
    'assets/creator-skill/playpets-creator/SKILL.md',
    'assets/creator-skill/playpets-creator/scripts/creator-workflow.py',
    'scripts/site-content.mjs',
    '.node-version',
    '.npmrc',
    'package-lock.json',
    'packaging/licenses/website-supplements.json',
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
      assert.match(match[1], /^[\w-]+\/[\w-]+(?:\/[\w-]+)*@[a-f0-9]{40} # /, file);
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

test('native CI installs the creator image dependency before running the shared unit suite', () => {
  for (const file of ['build.yml', 'release.yml']) {
    const workflow = read(`.github/workflows/${file}`);
    const unit = workflow.indexOf('- name: Unit tests');
    assert.ok(unit > 0, file);
    const setup = workflow.slice(0, unit);
    assert.match(setup, /uses: actions\/setup-python@/, file);
    assert.match(setup, /python -m pip install -r assets\/creator-skill\/playpets-creator\/requirements\.txt/, file);
    const step = workflow.slice(unit).split(/\n {6}- /)[0];
    assert.match(step, /PLAYPETS_PYTHON: python/, file);
    assert.match(step, /run: npm test/, file);
  }
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

test('security CI checks the full redacted history and shares the local dependency command', () => {
  const workflow = read('.github/workflows/security.yml');
  const scripts = JSON.parse(read('package.json')).scripts;
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /GITLEAKS_VERSION: 8\.30\.1/);
  assert.match(workflow, /GITLEAKS_SHA256: [a-f0-9]{64}/);
  assert.match(workflow, /sha256sum -c -/);
  assert.match(workflow, /cargo-audit@0\.22\.2/);
  assert.match(workflow, /npm run security:check/);
  assert.match(scripts['security:check'], /gitleaks git --redact/);
  assert.match(scripts['security:check'], /npm audit --audit-level=high/);
  assert.match(scripts['security:check'], /cargo audit --file src-tauri\/Cargo\.lock/);
  assert.doesNotMatch(workflow, /secrets\.|security-events: write|contents: write|continue-on-error/);
});

test('CodeQL covers app, workflow and creator sources without exposing signing secrets', () => {
  const workflow = read('.github/workflows/codeql.yml');
  assert.match(workflow, /language: \[actions, javascript-typescript, python, rust\]/);
  assert.match(workflow, /build-mode: none/);
  assert.match(workflow, /security-events: write/);
  assert.match(workflow, /category: \/language:\$\{\{ matrix.language \}\}/);
  assert.doesNotMatch(workflow, /secrets\.|contents: write|pull_request_target/);
});

test('root Rust tooling and future npm additions keep contributor setup explicit', () => {
  const toolchain = read('rust-toolchain.toml');
  assert.match(toolchain, /channel = "stable"/);
  assert.match(toolchain, /components = \["clippy", "rustfmt"\]/);
  assert.match(toolchain, /profile = "minimal"/);
  assert.match(read('.npmrc'), /^save-exact=true$/m);
  assert.match(read('.github/pull_request_template.md'), /What changed and why/);
});

test('review gates cover actual CI names without bypassing main history protection', () => {
  const history = JSON.parse(read('.github/rulesets/main-history.json'));
  const review = JSON.parse(read('.github/rulesets/main-review.json'));
  assert.deepEqual(history.bypass_actors, []);
  assert.deepEqual(history.rules.map(rule => rule.type).sort(), ['deletion', 'non_fast_forward']);
  for (const policy of [history, review]) {
    assert.equal(policy.target, 'branch');
    assert.equal(policy.enforcement, 'active');
    assert.deepEqual(policy.conditions.ref_name, { include: ['~DEFAULT_BRANCH'], exclude: [] });
  }
  assert.deepEqual(review.bypass_actors, [{ actor_type: 'RepositoryRole', actor_id: 5, bypass_mode: 'always' }]);
  assert.doesNotMatch(JSON.stringify(review.rules), /deletion|non_fast_forward/);
  const pr = review.rules.find(rule => rule.type === 'pull_request').parameters;
  assert.deepEqual(pr.allowed_merge_methods, ['squash']);
  assert.equal(pr.required_approving_review_count, 0);
  assert.equal(pr.required_review_thread_resolution, true);
  const checks = review.rules.find(rule => rule.type === 'required_status_checks').parameters;
  const native = [...read('.github/workflows/build.yml').matchAll(/name: ([\w-]+), bundles:/g)].map(match => match[1]);
  const security = read('.github/workflows/security.yml').match(/^ {4}name: (.+)$/m)[1];
  assert.equal(native.length, 5);
  assert.deepEqual(
    checks.required_status_checks.map(check => check.context).sort(),
    [...native, 'site', security].sort(),
  );
  assert.equal(checks.strict_required_status_checks_policy, true);
  const scanning = review.rules.find(rule => rule.type === 'code_scanning').parameters;
  assert.deepEqual(scanning.code_scanning_tools, [
    { tool: 'CodeQL', security_alerts_threshold: 'high_or_higher', alerts_threshold: 'errors' },
  ]);
});

test('release tag protection permits creation but forbids later movement or deletion', () => {
  const policy = JSON.parse(read('.github/rulesets/release-tags.json'));
  assert.equal(policy.target, 'tag');
  assert.equal(policy.enforcement, 'active');
  assert.deepEqual(policy.conditions.ref_name, { include: ['refs/tags/v*.*.*'], exclude: [] });
  assert.deepEqual(policy.bypass_actors, []);
  assert.deepEqual(policy.rules.map(rule => rule.type).sort(), ['deletion', 'non_fast_forward', 'update']);
});

test('container builds keep the image compiler and its installed cross targets', () => {
  for (const platform of ['linux', 'windows']) {
    assert.match(read(`packaging/${platform}/Dockerfile`), /^ENV RUSTUP_TOOLCHAIN=\$\{RUST_VERSION\}$/m);
  }
});
