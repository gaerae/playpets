// Every icon the page names in markup is drawn in icons.js; an unknown name would render an empty svg.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('every data-icon in index.html is a key of icons.js', async () => {
  const html = await readFile('src/index.html', 'utf8'),
    source = await readFile('src/core/icons.js', 'utf8'),
    block = source.split('const paths = {')[1].split('\n};')[0],
    keys = new Set([...block.matchAll(/^ {2}([a-z][\w-]*|'[^']+'):/gm)].map(m => m[1].replaceAll("'", ''))),
    names = new Set([...html.matchAll(/data-icon="([^"]+)"/g)].map(m => m[1]));
  assert.ok(keys.size > 20 && names.size > 5, 'both lists were read');
  for (const name of names) assert.ok(keys.has(name), `${name} is drawn in icons.js`);
});

// Settings and its first section, Language & startup, drew the same sliders, so the section read as
// Settings again. An icon names one thing.
test('Settings and its Language & startup section have their own icons', async () => {
  const html = await readFile('src/index.html', 'utf8');
  const icon = id => html.match(new RegExp(`<button id="${id}"[^>]*>\\s*<span data-icon="([^"]+)"`))?.[1];
  assert.equal(icon('menu-settings'), 'gear');
  assert.equal(icon('settings-general-task'), 'globe');
});
