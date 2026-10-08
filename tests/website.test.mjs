// The website is built from website/ plus a copy of docs/. These check the copy keeps every
// link working and the release pages match the changelog.
import assert from 'node:assert/strict';
import test from 'node:test';
import { destinationFor, rewriteDocLinks } from '../scripts/site-lib.mjs';
import { LANGUAGES } from '../src/core/strings.js';

const repo = 'https://github.com/gaerae/playpets/blob/main';

test('a docs file lands under dev/ and the index keeps its folder', () => {
  assert.equal(destinationFor('docs/README.md'), 'website/dev/index.md');
  assert.equal(destinationFor('docs/how-to/release.md'), 'website/dev/how-to/release.md');
});

test('links between docs files survive the copy, and README becomes the index', () => {
  const out = rewriteDocLinks('[a](../standards/i18n.md) [c](../README.md)', { file: 'docs/how-to/release.md', repo });
  assert.equal(out, '[a](../standards/i18n.md) [c](../index.md)');
  const top = rewriteDocLinks('[b](README.md#area-map)', { file: 'docs/getting-started.md', repo });
  assert.equal(top, '[b](index.md#area-map)');
});

test('links that leave docs/ point at the file on GitHub', () => {
  const out = rewriteDocLinks('[r](../README.md) [c](../CONTRIBUTING.md) [s](../src/app.js)', {
    file: 'docs/README.md',
    repo,
  });
  assert.equal(out, `[r](${repo}/README.md) [c](${repo}/CONTRIBUTING.md) [s](${repo}/src/app.js)`);
});

test('web links and anchors are left alone', () => {
  const text = '[w](https://x.y/z.md) [h](#here)';
  assert.equal(rewriteDocLinks(text, { file: 'docs/reference/a.md', repo }), text);
});

test('each sample pet is a valid v2 sheet with its pet.json', async () => {
  const { readFile: read } = await import('node:fs/promises');
  for (const id of ['tabby', 'smoky', 'mochi']) {
    const png = await read(`assets/pets/${id}/spritesheet.png`);
    assert.equal(png.readUInt32BE(16), 1536, id);
    assert.equal(png.readUInt32BE(20), 2288, id);
    const pet = JSON.parse(await read(`assets/pets/${id}/pet.json`, 'utf8'));
    assert.equal(pet.spriteVersionNumber, 2);
    assert.equal(pet.spritesheetPath, 'spritesheet.png');
    assert.ok(pet.id && pet.displayName && pet.description, id);
  }
});

test('a release page is made from the changelog section: front matter, downloads, the notes', async () => {
  const { releasePage } = await import('../scripts/release-lib.mjs');
  const notes = '### Added\n- The yard has weather.\n\n### Fixed\n- The window no longer stretches.';
  const page = releasePage(notes, '0.2.0', '2026-11-01');
  assert.match(page, /^---\nversion: 0\.2\.0\ndate: 2026-11-01\nheadline: ""\n---\n/);
  assert.match(page, /\n# 0\.2\.0\n/);
  assert.match(page, /<Downloads version="0\.2\.0" \/>/);
  assert.match(page, /<Shot name="yard-evening" version="0\.2\.0"/);
  assert.ok(page.includes('### Added\n- The yard has weather.'));
});

test('every released version in the changelog has a page in each site language, and every screenshot a page names exists', async () => {
  const { readdir, readFile: read, access } = await import('node:fs/promises');
  const changelog = await read('CHANGELOG.md', 'utf8');
  for (const [, version] of changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm))
    for (const dir of ['website', 'website/ko', 'website/zh-hans'])
      await access(`${dir}/releases/${version}.md`).catch(() =>
        assert.fail(`${dir}/releases/${version}.md is missing`),
      );
  const current = JSON.parse(await read('package.json', 'utf8')).version;
  const pages = (await readdir('website', { recursive: true })).filter(
    f => f.endsWith('.md') && !f.startsWith('dev/') && !f.includes('node_modules'),
  );
  for (const file of pages) {
    const text = await read(`website/${file}`, 'utf8');
    for (const [, name, , version] of text.matchAll(/<Shot name="([\w-]+)"(.*?version="([\d.]+)")?/g)) {
      const first = file.split('/')[0];
      const lang = first in LANGUAGES ? first : 'en';
      const shot = `website/public/shots/${version || current}/${lang}/${name}.webp`;
      await access(shot).catch(() => assert.fail(`${file} shows ${shot}, which does not exist`));
    }
  }
});

test('the share card exists at 1200×630', async () => {
  const { readFile: read } = await import('node:fs/promises');
  for (const file of ['website/public/og.png', 'website/public/og-ko.png', 'website/public/og-zh-hans.png']) {
    const png = await read(file);
    assert.equal(png.readUInt32BE(16), 1200, file);
    assert.equal(png.readUInt32BE(20), 630, file);
  }
});

test('the GIF writer makes a GIF89a file with one palette and a frame per input', async () => {
  const { encodeGif, lzw, palette } = await import('../scripts/gif-lib.mjs');
  const w = 4;
  const h = 2;
  const red = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let i = 1; i < red.length; i += 4) red[i] = red[i + 1] = 0;
  const blue = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let i = 0; i < blue.length; i += 4) blue[i] = blue[i + 1] = 0;
  const gif = encodeGif([red, blue], w, h, 10);
  assert.equal(gif.subarray(0, 6).toString('ascii'), 'GIF89a');
  assert.equal(gif.readUInt16LE(6), w);
  assert.equal(gif.readUInt16LE(8), h);
  assert.equal(gif[gif.length - 1], 0x3b);
  assert.equal(gif.filter((b, i) => b === 0x2c && gif[i + 1] === 0 && gif[i + 2] === 0).length, 2);
  const colors = palette([red, blue]);
  assert.ok(colors.some(c => c[0] > 200 && c[2] < 50) && colors.some(c => c[2] > 200 && c[0] < 50));
  const packed = lzw(Uint8Array.from([0, 0, 0, 1, 1, 1]), 2);
  assert.equal(packed[packed.length - 1], 0);
});

// The site's address is package.json "homepage". Every other place that names it (README, the
// security policy, the Linux metainfo, the bundle metadata, the docs) has to agree, so moving the
// site to its own domain (docs/how-to/site-address.md) is caught here wherever it was missed.
test('every place that names the site uses the address in package.json', async () => {
  const { execFileSync } = await import('node:child_process');
  const { readFile: read } = await import('node:fs/promises');
  const { homepage } = JSON.parse(await read('package.json', 'utf8'));
  const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split('\n')
    .filter(f => /\.(md|json|ya?ml|xml|toml|mts|ts|vue|mjs|js|html)$/.test(f) && !f.startsWith('website/public/'))
    .filter(f => !/(^|\/)package-lock\.json$|Cargo\.lock$/.test(f));
  const site = /https?:\/\/[a-z0-9.-]*(?:github\.io\/playpets|gaerae\.com\/playpets|playpets\.app)[^\s)"'<>`]*/g;
  const wrong = [];
  for (const file of files) {
    const text = await read(file, 'utf8').catch(() => '');
    for (const [url] of text.matchAll(site))
      if (!url.startsWith(homepage.replace(/\/$/, ''))) wrong.push(`${file}: ${url}`);
  }
  assert.deepEqual(wrong, []);
});
