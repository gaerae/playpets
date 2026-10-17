// The website is built from website/ plus a copy of docs/. These check the copy keeps every
// link working and the release pages match the changelog.
import assert from 'node:assert/strict';
import test from 'node:test';
import { destinationFor, rewriteDocLinks } from '../scripts/site-lib.mjs';
import { LANGUAGES } from '../src/core/strings.js';

const repo = 'https://github.com/gaerae/playpets/blob/main';

test('release pages never render installer or tag links before GitHub confirms publication', async () => {
  const { readFile } = await import('node:fs/promises');
  const { parse, compileScript } = await import('@vue/compiler-sfc');
  const { transform } = await import('esbuild');
  const vue = await import('vue');
  const { renderToString } = await import('vue/server-renderer');
  const words = {
    download: 'Download PlayPets',
    downloadFor: os => `Download for ${os}`,
    files: { 'macos-universal.dmg': 'macOS' },
    releases: 'Releases',
    preparing: 'Preparing',
    unreleased: 'Not released yet',
  };
  const modules = {};
  for (const name of ['Downloads', 'ReleaseLinks', 'ReleaseMeta']) {
    const source = await readFile(`website/.vitepress/theme/${name}.vue`, 'utf8');
    const script = compileScript(parse(source).descriptor, { id: name, inlineTemplate: true });
    modules[name] = (await transform(script.content, { loader: 'ts', format: 'cjs' })).code;
  }
  const render = async (name, frontmatter) => {
    const dependencies = {
      vue,
      vitepress: { useData: () => ({ frontmatter: vue.ref(frontmatter) }) },
      '../generated.json': { slug: 'gaerae/playpets' },
      './site-runtime.mjs': {
        forgetRelease: () => {},
        latestRelease: async () => ({ status: 'missing', version: '', files: [] }),
        taggedRelease: async () => ({ status: 'missing', version: '', files: [] }),
        watchRelease: () => () => {},
      },
      './words': { useWords: () => ({ words: vue.ref(words) }), FILES: ['macos-universal.dmg'] },
    };
    const module = { exports: {} };
    new Function('require', 'module', 'exports', modules[name])(id => dependencies[id], module, module.exports);
    return renderToString(vue.createSSRApp(module.exports.default, { version: '0.1.0' }));
  };
  for (const name of ['Downloads', 'ReleaseLinks']) {
    for (const frontmatter of [
      { version: '0.1.0' },
      { version: '0.1.0', date: '2026-10-13', draft: true },
      { version: '0.1.0', date: '2026-10-13' },
    ]) {
      const html = await render(name, frontmatter);
      assert.doesNotMatch(html, /\/releases\/(?:download|tag)\//, `${name}: unverified links`);
      assert.match(html, /href="https:\/\/github.com\/gaerae\/playpets\/releases"/);
    }
  }
  const datedMeta = await render('ReleaseMeta', { version: '0.1.0', date: '2026-10-13' });
  assert.doesNotMatch(datedMeta, /<time/);
  assert.match(datedMeta, /Preparing/);
});

test('version pages rely on GitHub publication state instead of a hand-maintained draft flag', async () => {
  const { readFile: read } = await import('node:fs/promises');
  for (const file of [
    'website/releases/0.1.0.md',
    'website/ko/releases/0.1.0.md',
    'website/ja/releases/0.1.0.md',
    'website/zh-hans/releases/0.1.0.md',
  ]) {
    const page = await read(file, 'utf8');
    assert.doesNotMatch(page, /^draft:/m, file);
    assert.doesNotMatch(page, /Release draft|공개 준비 중|公開準備中|尚未发布/, file);
  }
});

test('companion choices remain exposed to assistive technology', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile('website/.vitepress/theme/PetGallery.vue', 'utf8');
  assert.match(source, /class="pet-choice"/);
  // A static aria-hidden on a container hides the choices; a bound one (:aria-hidden) is judged at run time.
  assert.doesNotMatch(source, /<(?:section|div)\b[^>]*[^:]aria-hidden="true"/);
});

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
  for (const id of ['daisy', 'clover', 'pip', 'miso']) {
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

test('the capture scenario only presses controls present in the yard page', async () => {
  const { readFile: read } = await import('node:fs/promises');
  const script = await read('scripts/shots.mjs', 'utf8'),
    html = await read('src/index.html', 'utf8');
  for (const [, id] of script.matchAll(/\$\('([^']+)'\)/g))
    assert.ok(html.includes(`id="${id}"`), `capture control ${id} is missing from the page`);
});

test('every released version in the changelog has a page in each site language, and every screenshot a page names exists', async () => {
  const { readdir, readFile: read, access } = await import('node:fs/promises');
  const changelog = await read('CHANGELOG.md', 'utf8');
  for (const [, version] of changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm))
    for (const dir of ['website', 'website/ko', 'website/ja', 'website/zh-hans'])
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
  for (const file of [
    'website/public/og.png',
    'website/public/og-ko.png',
    'website/public/og-ja.png',
    'website/public/og-zh-hans.png',
  ]) {
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
  const timed = encodeGif([red, blue], w, h, [18, 27]);
  const delays = [];
  for (let i = 0; i < timed.length - 7; i++)
    if (timed[i] === 0x21 && timed[i + 1] === 0xf9 && timed[i + 2] === 4) delays.push(timed.readUInt16LE(i + 4));
  assert.deepEqual(delays, [18, 27], 'capture timing survives encoding');
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
    .filter(f => !/(^|\/)package-lock\.json$|Cargo\.lock$/.test(f))
    // The how-to for moving the site names the future address on purpose.
    .filter(f => f !== 'docs/how-to/site-address.md');
  const site = /https?:\/\/[a-z0-9.-]*(?:github\.io\/playpets|gaerae\.com\/playpets|playpets\.app)[^\s)"'<>`]*/g;
  const wrong = [];
  for (const file of files) {
    const text = await read(file, 'utf8').catch(() => '');
    for (const [url] of text.matchAll(site))
      if (!url.startsWith(homepage.replace(/\/$/, ''))) wrong.push(`${file}: ${url}`);
  }
  assert.deepEqual(wrong, []);
});

// Shot.vue reserves each capture's frame before the picture loads; a wrong ratio squashes it.
test('every screenshot has the shape its page reserves for it', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  const shot = await readFile('website/.vitepress/theme/Shot.vue', 'utf8');
  const ratios = Object.fromEntries(
    [...shot.match(/const RATIO[^{]*\{([^}]*)\}/)[1].matchAll(/'?([\w-]+)'?: '(\d+) \/ (\d+)'/g)].map(m => [
      m[1],
      m[2] / m[3],
    ]),
  );
  const fallback = shot.match(/\?\? '(\d+) \/ (\d+)'/).slice(1, 3);
  const size = buffer => {
    const kind = buffer.toString('latin1', 12, 16);
    if (kind === 'VP8X') return [1 + buffer.readUIntLE(24, 3), 1 + buffer.readUIntLE(27, 3)];
    if (kind === 'VP8L') {
      const n = buffer.readUInt32LE(21);
      return [(n & 0x3fff) + 1, ((n >> 14) & 0x3fff) + 1];
    }
    return [buffer.readUInt16LE(26) & 0x3fff, buffer.readUInt16LE(28) & 0x3fff];
  };
  for (const version of await readdir('website/public/shots'))
    for (const lang of await readdir(`website/public/shots/${version}`))
      for (const file of await readdir(`website/public/shots/${version}/${lang}`)) {
        const [width, height] = size(await readFile(`website/public/shots/${version}/${lang}/${file}`));
        const want = ratios[file.replace('.webp', '')] ?? fallback[0] / fallback[1];
        assert.ok(Math.abs(width / height - want) < 0.01, `${version}/${lang}/${file}: ${width}×${height}`);
      }
});
