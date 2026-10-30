import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

// Removing correctness checks or broadening ignores must not silently pass broken source.
test('Oxlint rejects JavaScript and Vue script mistakes while excluding generated outputs', () => {
  assert.ok(existsSync('.oxlintrc.json'), 'repository Oxlint configuration exists');
  const dir = mkdtempSync(join(tmpdir(), 'playpets-lint-'));
  try {
    copyFileSync('.oxlintrc.json', join(dir, '.oxlintrc.json'));
    const run = path =>
      spawnSync(process.execPath, [resolve('node_modules/oxlint/bin/oxlint'), '--deny-warnings', path], {
        cwd: dir,
        encoding: 'utf8',
      });
    for (const path of [
      'src/broken.js',
      'scripts/broken.mjs',
      'tests/broken.test.mjs',
      'website/.vitepress/theme/Broken.vue',
    ]) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      const broken = 'export function broken() { return; console.log("unreachable"); }';
      writeFileSync(join(dir, path), path.endsWith('.vue') ? `<script>${broken}</script>` : broken);
      const result = run(path);
      assert.equal(result.status, 1, `${path}: ${result.stdout}${result.stderr}`);
      assert.match(result.stdout + result.stderr, /no-unreachable/, path);
      rmSync(join(dir, path));
    }
    for (const path of [
      'scratch/broken.js',
      'release/broken.js',
      'website/dev/broken.js',
      'website/public/pets/broken.js',
      'website/public/creator-kit/broken.js',
      'website/public/yard/broken.js',
      'website/.vitepress/dist/broken.js',
      'src-tauri/gen/broken.js',
    ]) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), 'export function broken() { return; console.log("unreachable"); }');
    }
    writeFileSync(join(dir, 'src/valid.js'), 'export const valid = true;');
    const ignored = run('.');
    assert.equal(ignored.status, 0, ignored.stdout + ignored.stderr);
    // A missing import fails only on the path that reaches it; the check finds it before then.
    writeFileSync(join(dir, 'src/undeclared.js'), 'export const later = () => missingImport();');
    const undeclared = run('src/undeclared.js');
    assert.equal(undeclared.status, 1, undeclared.stdout + undeclared.stderr);
    assert.match(undeclared.stdout + undeclared.stderr, /no-undef/);
    // `!= null` is one check for null and undefined; any other loose comparison fails.
    writeFileSync(join(dir, 'src/nullish.js'), 'export const set = x => x != null;');
    const nullish = run('src/nullish.js');
    assert.equal(nullish.status, 0, nullish.stdout + nullish.stderr);
    writeFileSync(join(dir, 'src/loose.js'), 'export const one = x => x != 1;');
    const loose = run('src/loose.js');
    assert.equal(loose.status, 1, loose.stdout + loose.stderr);
    assert.match(loose.stdout + loose.stderr, /eqeqeq/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Biome rejects CSS mistakes and leaves JavaScript to Oxlint', () => {
  const dir = mkdtempSync(join(tmpdir(), 'playpets-css-lint-'));
  try {
    // Biome reads the ignore file through Git, as in the checkout.
    assert.equal(spawnSync('git', ['init', '-q'], { cwd: dir }).status, 0);
    writeFileSync(join(dir, '.gitignore'), '');
    copyFileSync('biome.jsonc', join(dir, 'biome.jsonc'));
    mkdirSync(join(dir, 'src'));
    const run = () =>
      spawnSync(process.execPath, [resolve('node_modules/@biomejs/biome/bin/biome'), 'lint', '--error-on-warnings'], {
        cwd: dir,
        encoding: 'utf8',
      });
    writeFileSync(join(dir, 'src/broken.css'), '.friend { colr: red; }\n');
    const broken = run();
    assert.equal(broken.status, 1, broken.stdout + broken.stderr);
    assert.match(broken.stdout + broken.stderr, /noUnknownProperty/);
    rmSync(join(dir, 'src/broken.css'));
    writeFileSync(join(dir, 'src/valid.css'), '.friend { color: red; }\n');
    writeFileSync(join(dir, 'src/loose.js'), 'export const one = x => x == 1;\ndebugger;\n');
    const valid = run();
    assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    assert.doesNotMatch(valid.stdout + valid.stderr, /loose\.js/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The formatter's reach is a rule too: hand-kept markup must stay as written, and source must not drift.
test('Oxfmt formats JavaScript, CSS and JSON while leaving hand-kept files as written', () => {
  const dir = mkdtempSync(join(tmpdir(), 'playpets-format-'));
  try {
    copyFileSync('.oxfmtrc.jsonc', join(dir, '.oxfmtrc.jsonc'));
    const files = {
      'src/messy.js': 'import {b} from "./b.js"\nimport {a} from "./a.js"\nexport const x = (y) => [a,b,y]\n',
      'src/messy.css': ".a{content:'x'}\n",
      'src/messy.json': '{"a":1,\n"b":[1,2]}\n',
      'src/kept.html': '<p><b>hand</b>   kept</p>\n',
      'src/kept.svg': '<svg><path d="M0 0"/></svg>\n',
      'website/Kept.vue': '<template><p>{{  a  }}</p></template>\n<script setup>\nconst a = "x"\n</script>\n',
      'docs/kept.md': '*  hand   kept*\n',
    };
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    const result = spawnSync(process.execPath, [resolve('node_modules/oxfmt/bin/oxfmt'), '.'], {
      cwd: dir,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const read = path => readFileSync(join(dir, path), 'utf8');
    assert.equal(
      read('src/messy.js'),
      "import { a } from './a.js';\nimport { b } from './b.js';\nexport const x = y => [a, b, y];\n",
    );
    assert.equal(read('src/messy.css'), '.a {\n  content: "x";\n}\n');
    assert.equal(read('src/messy.json'), '{ "a": 1, "b": [1, 2] }\n');
    for (const path of ['src/kept.html', 'src/kept.svg', 'website/Kept.vue', 'docs/kept.md']) {
      assert.equal(read(path), files[path], path);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
