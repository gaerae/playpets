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
  for (const lang of Object.keys(STRINGS)) {
    assert.deepEqual(Object.keys(STRINGS[lang]).sort(), [...keys].sort(), `${lang} names the same keys as ko`);
    for (const key of keys) {
      assert.deepEqual(holes(STRINGS[lang][key]), holes(STRINGS.ko[key]), `${key}: holes differ in ${lang}`);
      assert.equal(
        Array.isArray(STRINGS[lang][key]),
        Array.isArray(STRINGS.ko[key]),
        `${key}: list in one, sentence in another`,
      );
      const values = Array.isArray(STRINGS[lang][key]) ? STRINGS[lang][key] : [STRINGS[lang][key]];
      assert.ok(values.length > 0, `${key} has no lines in ${lang}`);
      for (const value of values)
        assert.ok(typeof value === 'string' && value.trim().length > 0, `${key} has an empty line in ${lang}`);
    }
  }
});

// Every relationship the friend settings offer (index.html) has its own voice for the moments a
// friend speaks up on its own (bond.js lineFor); a friend uses the plain lines.
// The album's badge and the dig's 24-hour rule name the same finds: one word for them in each
// language, so a "rare" badge never sits beside an "uncommon" rule.
test('the dig rule calls its finds by the word on the album badge', () => {
  for (const [language, table] of Object.entries(STRINGS)) {
    const word = table['catch.rare'];
    for (const key of ['album.rare_rule', 'album.rare_wait'])
      assert.ok(table[key].toLowerCase().includes(word.toLowerCase()), `${language} ${key} says ${word}`);
  }
});

// A narrow album card wraps its stamp; a size never ends a line apart from its unit.
test('a size stays on one line with its unit', () => {
  for (const lang of Object.keys(STRINGS)) assert.match(STRINGS[lang]['catch.best'], /\{size\}\u00a0cm/, lang);
});

test('every relationship has its own welcome, closeness and dear lines', async () => {
  const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
  const relations = [...html.matchAll(/name="relation" value="(\w+)"/g)].map(m => m[1]);
  assert.deepEqual(relations, ['partner', 'senior', 'junior']);
  for (const relation of relations)
    for (const key of ['bond.welcome', 'bond.up_line', 'bond.dear'])
      for (const [lang, strings] of Object.entries(STRINGS))
        assert.ok(strings[`${key}_${relation}`]?.length >= 2, `${key}_${relation} in ${lang}`);
});

// Comments too: the code and its notes are read by contributors in every language. Only the
// Korean table and the two modules that handle Korean particles (words.js, i18n.js) show Korean.
test('modules and markup keep no Korean of their own, comments included', async () => {
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
    const hit = lines.findIndex(l => /[가-힣]/.test(l));
    assert.equal(hit, -1, `${file}:${hit + 1} has Korean outside the Korean table: ${lines[hit]}`);
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

// The page builds these keys from a name it holds at run time, so they never appear whole in the
// source. Each family is spelled out with the module that builds it; a closed set is listed in full,
// and a catalog id (tree, treasure, flower, fish, bug, gift) is any id, since the content tests own those.
const BUILT = [
  /^caption\.(clear|rain|snow)\.(morning|day|evening|night)$/, // yard/scene.js
  /^(tree|treasure)\.[a-z_]+$/, // panel/album.js, yard/discovery.js, yard/planted-trees.js
  /^secret\.(wish|dizzy|fireworks)(_note)?$/, // yard/secrets.js, panel/album.js
  /^garden\.(kind_[a-z_]+|stage_(seed|sprout|leaves|bud|bloom))$/, // yard/garden.js, panel/album.js
  /^decor\.(kind|visit)_[a-z_]+$/, // yard/decor.js, panel/album.js, overlay/overlay.js
  /^catch\.(fish|bug)_[a-z_]+$/, // yard/catch.js, panel/album.js
  /^catch\.season_(spring|summer|autumn|winter)$/, // panel/album.js
  /^event\.[a-z]+\.(name|about|lines)$/, // yard/festival.js, yard/remarks.js, panel/album.js
  /^chatter\.(rainbow|sunshower|mist|snowlight|meteors)$/, // yard/remarks.js, one per sky moment
  /^bond\.(level_[1-5]|unlock_[2-5])$/, // yard/bond.js, panel/friend.js
  /^bond\.(welcome|up_line|dear)_(partner|senior|junior)$/, // yard/bond.js lineFor
  /^pet\.call_me_(friend|partner|senior|junior)$/, // panel/friend-settings.js
  /^connection\.(note|help)_[a-z]+$/, // panel/connection.js, by connection type
  /^game\.(hide|parade|tag)_title$/, // yard/play.js
  /^discovery\.((dig|tree)_hint|empty|seed|full)$/, // yard/discovery.js, by tool and by outcome
];
// Kept though the page never shows it: the e2e reads it as its "no game playing" marker.
const KEPT_FOR_E2E = new Set(['game.label']);

// The other way round: a sentence nothing names is never shown, yet goes on being translated and
// kept in four tables. A key counts as used when src/ names it in quotes (a t() or list() call, a
// data-i18n* attribute, a key chosen by a condition, a content file) or it is in a BUILT family.
test('every key in the table is one the page names', async () => {
  const files = [];
  const walk = async dir => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await walk(path);
      else if (/\.(js|html|json)$/.test(entry.name) && !path.includes('core/strings')) files.push(path);
    }
  };
  await walk('src');
  const quoted = new Set();
  for (const file of files)
    for (const [, key] of (await readFile(file, 'utf8')).matchAll(/['"`]([a-z_]+(?:\.[a-z0-9_]+)+)['"`]/g))
      quoted.add(key);
  const keys = Object.keys(STRINGS.en);
  for (const family of [...BUILT, ...KEPT_FOR_E2E])
    assert.ok(
      keys.some(key => (typeof family === 'string' ? key === family : family.test(key))),
      `${family} no longer names any key; drop it from the list`,
    );
  const unused = keys.filter(
    key => !quoted.has(key) && !KEPT_FOR_E2E.has(key) && !BUILT.some(family => family.test(key)),
  );
  assert.deepEqual(unused, [], 'keys in the language files that nothing in src/ names');
});

// Current contributor guidance stays readable in English; dated records preserve their history.
test('current developer guidance keeps Korean in the language tables', async () => {
  const files = ['README.md', 'CONTRIBUTING.md'];
  const walk = async dir => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await walk(path);
      else if (entry.name.endsWith('.md') && !/^\d{4}-\d{2}-\d{2}-/.test(entry.name)) files.push(path);
    }
  };
  await walk('docs');
  for (const file of files) {
    const lines = (await readFile(file, 'utf8')).split('\n');
    const hit = lines.findIndex(line => /[가-힣]/.test(line));
    assert.equal(hit, -1, `${file}:${hit + 1} has Korean in current developer guidance`);
  }
});
