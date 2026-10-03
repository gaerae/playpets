// Every language says the same things: same keys, same holes, and no Korean left behind in the
// modules themselves (words.js keeps the particles it exists for). ko is the reference.

import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import { LANGUAGES, STRINGS } from '../src/core/strings.js';

const holes = text =>
  [...String(Array.isArray(text) ? text.join(' ') : text).matchAll(/\{(\w+)(?::[^}]+)?\}/g)].map(m => m[1]).sort();

test('every language says every key, with the same holes', () => {
  const keys = Object.keys(STRINGS.ko);
  assert.ok(keys.length > 0);
  assert.deepEqual(Object.keys(STRINGS), Object.keys(LANGUAGES), 'the registry names each language once');
  for (const lang of Object.keys(STRINGS).filter(l => l !== 'ko')) {
    assert.deepEqual(Object.keys(STRINGS[lang]).sort(), [...keys].sort(), `${lang} names the same keys as ko`);
    for (const key of keys) {
      assert.deepEqual(holes(STRINGS[lang][key]), holes(STRINGS.ko[key]), `${key}: holes differ in ${lang}`);
      assert.equal(
        Array.isArray(STRINGS[lang][key]),
        Array.isArray(STRINGS.ko[key]),
        `${key}: list in one, sentence in another`,
      );
      assert.ok(String(STRINGS[lang][key]).trim().length > 0, `${key} is empty in ${lang}`);
    }
  }
});

test('modules and markup keep no Korean of their own', async () => {
  const files = [];
  const walk = async dir => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await walk(path);
      else if (/\.(js|html|css)$/.test(entry.name)) files.push(path);
    }
  };
  await walk('src');
  const allowed = new Set(['src/core/strings/ko.js', 'src/core/words.js', 'src/core/i18n.js']);
  for (const file of files) {
    if (allowed.has(file)) continue;
    const lines = (await readFile(file, 'utf8')).split('\n');
    const hit = lines.findIndex(l => /[가-힣]/.test(l.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')));
    assert.equal(hit, -1, `${file}:${hit + 1} has Korean outside strings/ko.js: ${lines[hit]}`);
  }
});

// A key that is not in the table shows on screen as the key itself; t() cannot tell a typo from
// an intended key, so every key the page names is looked up here. Keys are named in t()/list()
// calls, in data-i18n* and data-title attributes, and as plain strings chosen by a condition.
test('every key the page names is in the table', async () => {
  const known = new Set(Object.keys(STRINGS.ko));
  const areas = new Set([...known].map(k => k.split('.')[0]));
  const files = [];
  const walk = async dir => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await walk(path);
      else if (/\.(js|html)$/.test(entry.name) && !path.includes('core/strings')) files.push(path);
    }
  };
  await walk('src');
  const named = new Map();
  const note = (key, file) => named.set(key, file);
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    for (const [, key] of text.matchAll(/\b(?:t|list)\(\s*['"]([^'"]+)['"]/g)) note(key, file);
    for (const [, key] of text.matchAll(/data-(?:i18n(?:-[a-z-]+)?|title)="([^"]+)"/g)) note(key, file);
    // Plain strings shaped like a key of a known area ('connection.models_found'), not file names.
    for (const [, key] of text.matchAll(/['"]([a-z_]+(?:\.[a-z0-9_]+)+)['"]/g))
      if (areas.has(key.split('.')[0]) && !/\.(json|js|css|html|svg|png|webp|toml)$/.test(key)) note(key, file);
  }
  // Built from the scene: caption.<weather>.<period>.
  for (const w of ['clear', 'rain', 'snow'])
    for (const p of ['morning', 'day', 'evening', 'night']) note(`caption.${w}.${p}`, 'src/yard/scene.js');
  assert.ok(named.size > 150, `found the keys the page names (${named.size})`);
  const missing = [...named].filter(([key]) => !known.has(key)).map(([key, file]) => `${key} (${file})`);
  assert.deepEqual(missing, [], 'keys named but not in the language files');
});
