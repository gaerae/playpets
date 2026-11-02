import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('browser icons have portable fallbacks and a revision matching the current brand artwork', async () => {
  const { default: config } = await import('../website/.vitepress/config.mts');
  const source = await readFile('assets/icon.svg');
  const revision = createHash('sha256').update(source).digest('hex').slice(0, 12);
  const links = config.head.filter(([tag, attributes]) => tag === 'link' && attributes.rel.endsWith('icon'));
  assert.deepEqual(
    links.map(([, attributes]) => attributes.type).sort(),
    // No SVG link: assets/icon.svg wraps the whole 1024 px PNG, so a 96 px PNG stands in for it.
    ['image/png', 'image/png', 'image/x-icon'].sort(),
  );
  for (const [, attributes] of links) {
    const url = new URL(attributes.href, 'https://example.test');
    assert.equal(url.searchParams.get('v'), revision);
    assert.ok(url.pathname.startsWith(config.base));
  }
  assert.deepEqual(
    links.filter(([, attributes]) => attributes.type === 'image/png').map(([, attributes]) => attributes.sizes),
    ['32x32', '96x96'],
  );
});

// The site's icons are copies made at build time (and ignored by Git), so they cannot drift from
// the native ones; this checks the copies are made from those sources.
test('site preparation copies the current icon files used by the native app', async () => {
  const prepare = await readFile('scripts/site-prepare.mjs', 'utf8');
  for (const [native, site] of [
    ['assets/icon.svg', 'website/public/icon.svg'],
    ['src-tauri/icons/tray.png', 'website/public/favicon.png'],
    ['src-tauri/icons/icon.ico', 'website/public/favicon.ico'],
  ])
    assert.ok(prepare.includes(`cp('${native}', '${site}')`), `${native} → ${site}`);
});
