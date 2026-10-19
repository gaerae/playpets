import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import * as site from '../scripts/site-lib.mjs';
import { STRINGS } from '../src/core/strings.js';

const dots = /[\u00b7\u30fb\u2027\u2219]/u;
async function files(directory, skip = () => false) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = `${directory}/${entry.name}`;
    if (skip(file)) continue;
    if (entry.isDirectory()) output.push(...(await files(file, skip)));
    else if (/\.(md|vue|[jt]s|rs)$/.test(file)) output.push(file);
  }
  return output;
}

test('authored website and backend messages do not use middle-dot separators', async () => {
  const authored = await files('website', file =>
    /^(website\/(public|dev)|website\/\.vitepress\/(dist|cache))($|\/)/.test(file),
  );
  const backend = await files('src-tauri/src/i18n');
  const invalid = [];
  for (const file of [...authored, ...backend]) {
    if (dots.test(await readFile(file, 'utf8'))) invalid.push(file);
  }
  assert.deepEqual(invalid, []);
});

test('every app locale keeps visible labels and sentences free of middle-dot separators', () => {
  for (const [language, strings] of Object.entries(STRINGS))
    for (const [key, value] of Object.entries(strings))
      assert.equal(dots.test(String(value)), false, `${language}: ${key}`);
});

test('historical developer prose is normalized for display without changing code or destinations', () => {
  const source =
    '# Friends \u00b7 settings\n\nUse `a\u00b7b` and [the guide](https://example.test/a\u00b7b).\n\n```js\nconst name = "a\u00b7b";\n```\n';
  assert.equal(
    site.docDisplayProse(source),
    '# Friends, settings\n\nUse `a\u00b7b` and [the guide](https://example.test/a\u00b7b).\n\n```js\nconst name = "a\u00b7b";\n```\n',
  );
});
