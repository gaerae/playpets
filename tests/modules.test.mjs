// The page is plain ES modules with no build step, so nothing else would notice a script that
// does not parse, an import that points nowhere, or a name that is not exported.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

async function scripts(dir = 'src') {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await scripts(file)));
    else if (file.endsWith('.js')) found.push(file);
  }
  return found;
}

test('every script parses', async () => {
  for (const file of await scripts()) {
    const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(check.status, 0, `${file} does not parse:\n${check.stderr}`);
  }
});

test('every import names a file that exists and something it exports', async () => {
  const sources = new Map();
  for (const file of await scripts()) sources.set(path.resolve(file), await readFile(file, 'utf8'));
  for (const [file, source] of sources) {
    for (const [, names, target] of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
      const resolved = path.resolve(path.dirname(file), target),
        other = sources.get(resolved);
      assert.ok(other !== undefined, `${path.relative('.', file)} imports ${target}, which does not exist`);
      // `{ chatter as letThemChat }` imports `chatter`.
      for (const name of names
        .split(',')
        .map(n => n.trim().split(/\s+as\s+/)[0])
        .filter(Boolean)) {
        // Every export declares one name (`export const a = …;`, never `export const a = …, b = …;`).
        const exported = new RegExp(
          `export\\s+(?:async\\s+)?(?:function|const|let)\\s+${name.replace(/\$/g, '\\$')}\\s*[=(;]`,
        ).test(other);
        assert.ok(exported, `${path.relative('.', file)} imports {${name}} from ${target}, which does not export it`);
      }
    }
  }
});

test('the page loads the entry script and every stylesheet it names exists', async () => {
  const html = await readFile('src/index.html', 'utf8');
  assert.match(html, /<script type="module" src="app\.js">/);
  for (const [, href] of html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g))
    await readFile(path.join('src', href), 'utf8');
});

const imports = source => [...source.matchAll(/^import\s[^;]*?from\s*'([^']+)'/gm)].map(m => m[1]);

test('no module imports itself back, however indirectly', async () => {
  const graph = new Map();
  for (const file of await scripts()) {
    const source = await readFile(file, 'utf8');
    graph.set(
      path.resolve(file),
      imports(source).map(target => path.resolve(path.dirname(file), target)),
    );
  }
  const done = new Set();
  const visit = (file, trail) => {
    const loop = trail.indexOf(file);
    assert.equal(
      loop,
      -1,
      `import cycle: ${[...trail.slice(loop), file].map(f => path.relative('src', f)).join(' → ')}`,
    );
    if (done.has(file)) return;
    for (const next of graph.get(file) || []) visit(next, [...trail, file]);
    done.add(file);
  };
  for (const file of graph.keys()) visit(file, []);
});

// With nothing run at import time, the order of imports is only a matter of style, and the
// order things start in is written down in one place (app.js).
test('only the entry scripts do anything when imported; every other module only declares', async () => {
  const entries = ['src/app.js', 'src/overlay/overlay.js'].map(f => path.resolve(f));
  const declaration = /^(import|export|function|async function|const|let|class)\b/;
  for (const file of await scripts()) {
    if (entries.includes(path.resolve(file))) continue;
    const heads = (await readFile(file, 'utf8')).split('\n').filter(line => /^[^\s/}\])]/.test(line));
    const acts = heads.filter(line => !declaration.test(line));
    assert.deepEqual(acts, [], `${file} runs code when imported; move it into its setup function`);
  }
});

// Importing a module runs nothing that needs a page (no window, document or matchMedia at the top
// level), so every module but the two entry points loads here and its logic can be tested.
test('every module but the entry points imports without a page', async () => {
  const entries = new Set(['src/app.js', 'src/overlay/overlay.js']);
  for (const file of await scripts()) {
    if (entries.has(file) || file.startsWith('src/core/strings/')) continue;
    await assert.doesNotReject(import(path.resolve(file)), `${file} needs a page to import`);
  }
});
