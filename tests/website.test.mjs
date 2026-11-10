// The website is built from website/ plus a copy of docs/. These check the copy keeps every
// link working and the release pages match the changelog.
import assert from 'node:assert/strict';
import test from 'node:test';
import { destinationFor, rewriteDocLinks, sitemapSources, unusedShots } from '../scripts/site-lib.mjs';
import { LANGUAGES } from '../src/core/strings.js';

const repo = 'https://github.com/gaerae/playpets/blob/main';

test('the site publishes only the screenshots a built page shows', () => {
  const files = [
    '0.1.0/en/yard-evening.webp',
    '0.1.0/en/mini.webp',
    '0.2.0/en/mini.webp',
    '1.5.0/ko/mini.webp',
    '1.5.0/en/mini.webp',
    '1.5.0/ja/reel.mp4',
    '1.5.0/ja/reel.webp',
  ];
  const pages = [
    '<img src="/shots/1.5.0/ko/mini.webp">',
    // A release page pins its own capture; the landing names the current one from its script.
    '<figure><img src="/shots/0.1.0/en/yard-evening.webp"></figure>',
    'const film = "/shots/1.5.0/ja/reel.mp4";',
  ];
  assert.deepEqual(unusedShots(files, pages), [
    '0.1.0/en/mini.webp',
    '0.2.0/en/mini.webp',
    '1.5.0/en/mini.webp',
    '1.5.0/ja/reel.webp',
  ]);
  assert.deepEqual(
    unusedShots(['1.5.0/en/mini.webp'], []),
    ['1.5.0/en/mini.webp'],
    'a capture no page shows is left out',
  );
  assert.deepEqual(
    unusedShots(['1.5.0/en/mini.webp'], ['/shots/1.5.0.1/en/mini.webp', '/shots/1.5.0/en/mini.webp.bak']),
    ['1.5.0/en/mini.webp'],
    'a longer version or name is not this file',
  );
  assert.deepEqual(
    unusedShots(['0.2.0/en/mini.webp'], ['<code>website/public/shots/0.2.0/en/mini.webp</code>']),
    ['0.2.0/en/mini.webp'],
    'a guide naming the file in the repository shows no picture',
  );
});

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
    checkingRelease: 'Checking release',
    unreleased: 'Not released yet',
  };
  const modules = {};
  for (const name of ['Downloads', 'ReleaseLinks', 'ReleaseMeta']) {
    const source = await readFile(`website/.vitepress/theme/${name}.vue`, 'utf8');
    const script = compileScript(parse(source).descriptor, { id: name, inlineTemplate: true });
    modules[name] = (await transform(script.content, { loader: 'ts', format: 'cjs' })).code;
  }
  let built;
  const render = async (name, frontmatter) => {
    const dependencies = {
      vue,
      vitepress: { useData: () => ({ frontmatter: vue.ref(frontmatter) }) },
      '../generated.json': { slug: 'gaerae/playpets' },
      './site-runtime.mjs': {
        forgetRelease: () => {},
        knownRelease: () => built,
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
  const pendingDownload = await render('Downloads', {});
  assert.match(pendingDownload, /Checking release/);
  assert.doesNotMatch(pendingDownload, /Preparing|Not released yet/);
  assert.match(pendingDownload, /aria-busy="true"/);
  // A release the site was built with is in the served page: the file itself, no lookup.
  built = {
    status: 'ready',
    version: '0.1.0',
    publishedAt: '2026-10-13T00:00:00Z',
    files: ['PlayPets_0.1.0_macos-universal.dmg'],
  };
  const servedDownload = await render('Downloads', {});
  assert.match(
    servedDownload,
    /href="https:\/\/github.com\/gaerae\/playpets\/releases\/download\/v0.1.0\/PlayPets_0.1.0_macos-universal.dmg"/,
  );
  assert.doesNotMatch(servedDownload, /Checking release|aria-busy="true"/);
  assert.match(await render('ReleaseMeta', { version: '0.1.0' }), /<time datetime="2026-10-13T00:00:00Z"/);
  assert.match(await render('ReleaseLinks', { version: '0.1.0' }), /releases\/tag\/v0.1.0/);
  built = undefined;
  const datedMeta = await render('ReleaseMeta', { version: '0.1.0', date: '2026-10-13' });
  assert.doesNotMatch(datedMeta, /<time/);
  assert.match(datedMeta, /Preparing/);
});

test('the latest download offers the Store and winget on Windows and Homebrew on macOS', async () => {
  const { readFile: read } = await import('node:fs/promises');
  const downloads = await read('website/.vitepress/theme/Downloads.vue', 'utf8');
  assert.match(downloads, /https:\/\/apps\.microsoft\.com\/detail\/9NSKXQ6R187M/);
  assert.match(downloads, /winget install --id 9NSKXQ6R187M --source msstore/);
  assert.match(downloads, /brew install gaerae\/tap\/playpets/);
  // A release page lists that release's files; the Store and the commands always install the latest.
  assert.match(downloads, /!props\.version && os\.value === 'Windows'/);
  const words = await read('website/.vitepress/theme/words.ts', 'utf8');
  for (const key of ['storeFor:', 'storeNote:', 'commands:', 'otherDownloads:'])
    assert.equal(words.split(key).length - 1, 4, key);
  // The command is the alternative to the main button, so it sits right under it.
  assert.ok(downloads.indexOf('class="dl-command"') < downloads.indexOf('class="dl-others"'));
  assert.match(downloads, /store \? words\.otherDownloads : words\.otherPlatforms/);
  // A visitor on another system who opens the list for a Windows PC finds the Store before the unsigned installers.
  assert.match(
    downloads,
    /<li v-if="!version && os !== 'Windows'"><a :href="STORE">\{\{ words\.storeOther \}\}<\/a><\/li>\s*<li v-for="f in others"/,
  );
  assert.equal(words.split('storeOther:').length - 1, 4, 'storeOther:');
  assert.match(downloads, /class="dl-word"/);
  // Under the Store button the installer for this PC is one visible link, with its version (it is out
  // before the Store's review ends) and the SmartScreen note right under it, not folded into the list.
  assert.match(downloads, /<p v-if="store && hasPrimary" class="dl-direct"><a :href="url\(primaryFile\)">/);
  assert.equal(words.split('installer:').length - 1, 4, 'installer:');
  const direct = downloads.indexOf('class="dl-direct"');
  assert.ok(downloads.indexOf('class="dl-command"') < direct && direct < downloads.indexOf('class="dl-others"'));
  assert.ok(downloads.indexOf('words.unsigned', direct) < downloads.indexOf('class="dl-others"', direct));
  assert.match(downloads, /f => f !== primaryFile\.value && \(available/, 'the list does not repeat it');
});

test('every install guide covers the Store, winget, Homebrew and direct files, with a download for the visitor', async () => {
  const { readFile: read } = await import('node:fs/promises');
  for (const lang of ['', 'ko/', 'ja/', 'zh-hans/']) {
    const guide = await read(`website/${lang}guide/install.md`, 'utf8');
    assert.match(guide, /<Downloads \/>/, lang);
    assert.match(guide, /https:\/\/apps\.microsoft\.com\/detail\/9NSKXQ6R187M/, lang);
    assert.match(guide, /winget install --id 9NSKXQ6R187M --source msstore/, lang);
    assert.match(guide, /brew install gaerae\/tap\/playpets/, lang);
    assert.match(guide, /SmartScreen/, lang);
    assert.match(guide, /chmod \+x/, lang);
    // Windows comes first, as the system with the most ways, and each warning sits with the files it is about.
    assert.ok(guide.indexOf('## Windows') < guide.indexOf('## macOS'), lang);
    assert.ok(guide.indexOf('::: warning') > guide.indexOf('{#installer-from-github}'), lang);
  }
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

test('the sitemap dates each page by the files it is written from', () => {
  assert.deepEqual(sitemapSources(''), ['website/index.md', 'website/.vitepress/theme/landing-en.ts']);
  assert.deepEqual(sitemapSources('ko/'), ['website/ko/index.md', 'website/.vitepress/theme/landing-ko.ts']);
  // The release index lists every release page, so it changes with any of them.
  assert.deepEqual(sitemapSources('releases/'), ['website/releases/']);
  assert.deepEqual(sitemapSources('ko/releases/1.5.0'), ['website/ko/releases/1.5.0.md']);
  assert.deepEqual(sitemapSources('ja/guide/faq'), ['website/ja/guide/faq.md']);
  assert.deepEqual(sitemapSources('dev/'), ['docs/README.md']);
  assert.deepEqual(sitemapSources('dev/how-to/release'), ['docs/how-to/release.md']);
});

test('the site build has the history the sitemap dates come from', async () => {
  const { readFile } = await import('node:fs/promises');
  const workflow = await readFile(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  // A shallow clone gives every page the date of the one commit it has.
  assert.match(workflow, /^ {6}- uses: actions\/checkout@.*\n(?: {8,}.*\n)*? {10}fetch-depth: 0$/m);
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
  const { CAPTURE_VERSION } = await import('../scripts/site-content.mjs');
  const pages = (await readdir('website', { recursive: true })).filter(
    f => f.endsWith('.md') && !f.startsWith('dev/') && !f.includes('node_modules'),
  );
  for (const file of pages) {
    const text = await read(`website/${file}`, 'utf8');
    for (const [, name, , version] of text.matchAll(/<Shot name="([\w-]+)"(.*?version="([\d.]+)")?/g)) {
      const first = file.split('/')[0];
      const lang = first in LANGUAGES ? first : 'en';
      const shot = `website/public/shots/${version || CAPTURE_VERSION}/${lang}/${name}.webp`;
      await access(shot).catch(() => assert.fail(`${file} shows ${shot}, which does not exist`));
    }
  }
});

test('default captures have their own real version and every landing capture exists', async () => {
  const { readFile, access } = await import('node:fs/promises');
  const { CAPTURE_VERSION, SITE_LANGS } = await import('../scripts/site-content.mjs');
  assert.match(CAPTURE_VERSION, /^\d+\.\d+\.\d+$/);
  const landing = await readFile('website/.vitepress/theme/Landing.vue', 'utf8');
  assert.match(landing, /\/shots\/\$\{generated\.captureVersion\}/);
  for (const [, name] of landing.matchAll(/shotUrl\('([\w-]+)'\)/g))
    for (const lang of SITE_LANGS) await access(`website/public/shots/${CAPTURE_VERSION}/${lang}/${name}.webp`);
  // The film beside its still, in every language; it plays muted, inline, and only when the script starts it.
  for (const lang of SITE_LANGS) await access(`website/public/shots/${CAPTURE_VERSION}/${lang}/reel.mp4`);
  assert.match(landing, /<PlayReel [^>]*:poster="shotUrl\('reel'\)"/);
  const reel = await readFile('website/.vitepress/theme/PlayReel.vue', 'utf8');
  const video = reel.match(/<video[^>]*>/)[0];
  for (const attribute of ['muted', 'loop', 'playsinline', 'preload="none"'])
    assert.ok(video.includes(attribute), attribute);
  assert.doesNotMatch(video, /autoplay/);
  assert.match(reel, /prefers-reduced-motion: reduce/);
  const prepare = await readFile('scripts/site-prepare.mjs', 'utf8');
  assert.match(prepare, /captureVersion: CAPTURE_VERSION/);
  // The README's English screenshots move with the site's captures.
  const readme = await readFile('README.md', 'utf8');
  const shots = [...readme.matchAll(/website\/public\/shots\/([\d.]+)\/en\/([\w-]+\.webp)/g)];
  assert.ok(shots.length >= 3);
  for (const [path, version] of shots) {
    assert.equal(version, CAPTURE_VERSION, path);
    await access(path);
  }
});

test('a screenshot renders its actual capture version independently of the app version', async () => {
  const { readFile } = await import('node:fs/promises');
  const { parse, compileScript } = await import('@vue/compiler-sfc');
  const { transform } = await import('esbuild');
  const vue = await import('vue');
  const { renderToString } = await import('vue/server-renderer');
  const source = await readFile('website/.vitepress/theme/Shot.vue', 'utf8');
  const script = compileScript(parse(source).descriptor, { id: 'capture-version', inlineTemplate: true });
  const compiled = (await transform(script.content, { loader: 'ts', format: 'cjs' })).code;
  const dependencies = {
    vue,
    vitepress: { withBase: value => value },
    '../generated.json': { version: '1.1.0', captureVersion: '1.0.0' },
    './words': { useWords: () => ({ lang: vue.ref('en'), words: vue.ref({ missingShot: 'Missing capture' }) }) },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(id => dependencies[id], module, module.exports);
  for (const [props, version] of [
    [{ name: 'mini', caption: 'Small yard' }, '1.0.0'],
    [{ name: 'mini', version: '0.2.0' }, '0.2.0'],
  ]) {
    const html = await renderToString(vue.createSSRApp(module.exports.default, props));
    assert.ok(html.includes(`/shots/${version}/en/mini.webp`));
    assert.match(html, new RegExp(`<figcaption[^>]*>[\\s\\S]*${version.replaceAll('.', '\\.')}[\\s\\S]*</figcaption>`));
    assert.doesNotMatch(html, /1\.1\.0/);
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
    .filter(f => !/(^|\/)pnpm-lock\.yaml$|Cargo\.lock$/.test(f))
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
  // The landing's film (scripts/reel.mjs) is the window alone; its still is the shape its <video> reserves.
  const reel = await readFile('website/.vitepress/theme/PlayReel.vue', 'utf8');
  const [, reelWidth, reelHeight] = reel.match(/<video[^>]* width="(\d+)" height="(\d+)"/);
  ratios.reel = reelWidth / reelHeight;
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
        if (file === 'reel.mp4') continue;
        const [width, height] = size(await readFile(`website/public/shots/${version}/${lang}/${file}`));
        const want = ratios[file.replace('.webp', '')] ?? fallback[0] / fallback[1];
        assert.ok(Math.abs(width / height - want) < 0.01, `${version}/${lang}/${file}: ${width}×${height}`);
      }
});

test('a release note line for one system carries a badge the Store reads, in every language', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const only = await readFile('website/.vitepress/theme/Only.vue', 'utf8');
  assert.match(only, /words\.only\(names\)/);
  const theme = await readFile('website/.vitepress/theme/index.ts', 'utf8');
  assert.match(theme, /app\.component\('Only', Only\)/);
  const words = await readFile('website/.vitepress/theme/words.ts', 'utf8');
  assert.equal(words.split('only: (names: string[]) =>').length - 1, 4);
  for (const dir of ['website', 'website/ko', 'website/ja', 'website/zh-hans'])
    for (const file of await readdir(`${dir}/releases`)) {
      if (!file.endsWith('.md')) continue;
      const page = await readFile(`${dir}/releases/${file}`, 'utf8');
      for (const [tag] of page.matchAll(/<Only\b[^>]*>/g))
        assert.match(tag, /^<Only os="(macOS|Windows|Linux)(, (macOS|Windows|Linux))?" \/>$/, file);
      for (const line of page.split('\n').filter(line => line.includes('<Only')))
        assert.match(line, /^- <Only os="[^"]+" \/> \S/, `${dir}/releases/${file}: the badge starts its line`);
    }
});

test('version badges mark only later features and stay out of the page outline', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const since = await readFile('website/.vitepress/theme/Since.vue', 'utf8');
  // VitePress leaves `.ignore-header` out of the outline, so a heading's entry is just its words.
  assert.match(since, /class="since ignore-header"/);
  // Everything in the first release has been there all along, so its badge says nothing.
  const releases = (await readdir('website/releases')).filter(file => /^\d+\.\d+\.\d+\.md$/.test(file));
  const first = releases.map(file => file.slice(0, -3)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))[0];
  assert.match(since, new RegExp(`FIRST_RELEASE = '${first.replaceAll('.', '\\.')}'`));
  assert.match(since, /v-if="v !== FIRST_RELEASE"/);
});
