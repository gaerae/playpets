import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('the audit records every shipping image and resolves all local raster references in artwork', async () => {
  const { inventoryAssets } = await import('../scripts/asset-audit-lib.mjs');
  const records = await inventoryAssets();
  assert.ok(records.length > 100);
  assert.equal(new Set(records.map(r => r.path)).size, records.length);
  for (const record of records) {
    assert.ok(record.sha256 && record.bytes > 0, record.path);
    assert.ok(record.width > 0 && record.height > 0, record.path);
    assert.deepEqual(record.missingReferences, [], record.path);
  }
  for (const path of [
    'assets/pets/tabby/spritesheet.png',
    'assets/art/weather/seasonal.png',
    'src/art/weather/seasonal.webp',
    'src/art/fish/specimens.webp',
    'website/public/og-ko.png',
    'src-tauri/icons/icon.ico',
    'src/logo.webp',
    'packaging/windows/nsis-sidebar.bmp',
  ])
    assert.ok(
      records.some(r => r.path === path),
      path,
    );
});

test('native install and sharing exports retain their actual required dimensions', async () => {
  const { imageSize } = await import('../scripts/asset-audit-lib.mjs');
  for (const [path, dimensions] of Object.entries({
    'src-tauri/icons/icon.png': [512, 512],
    'src-tauri/icons/tray.png': [32, 32],
    // Each tile at 100, 200 and 400 percent, so a high-DPI screen never scales a small one up. The
    // 150 tile stops at 200: at 600px the artwork is larger than the certification kit accepts.
    ...Object.fromEntries(
      [
        ['StoreLogo', 50, [1, 2, 4]],
        ['Square44x44Logo', 44, [1, 2, 4]],
        ['Square150x150Logo', 150, [1, 2]],
      ].flatMap(([name, size, scales]) =>
        scales.map(scale => [
          `src-tauri/icons/msix/${scale === 1 ? name : `${name}.scale-${scale * 100}`}.png`,
          [size * scale, size * scale],
        ]),
      ),
    ),
    // Every target size Microsoft lists for the taskbar, Start and Explorer. Without an unplated
    // variant Windows draws the icon on an accent-colored plate; the light one is for a light taskbar.
    ...Object.fromEntries(
      [16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 256].flatMap(size =>
        ['', '_altform-unplated', '_altform-lightunplated'].map(form => [
          `src-tauri/icons/msix/Square44x44Logo.targetsize-${size}${form}.png`,
          [size, size],
        ]),
      ),
    ),
    'packaging/macos/dmg-background.png': [1320, 840],
    'packaging/windows/nsis-sidebar.bmp': [164, 314],
    'packaging/windows/nsis-header.bmp': [150, 57],
    'website/public/og.png': [1200, 630],
    'website/public/og-ko.png': [1200, 630],
    'website/public/og-zh-hans.png': [1200, 630],
    'assets/banner.png': [1600, 560],
    // The About page draws it at 24px; 96 covers a 4x screen without shipping a large picture.
    'src/logo.webp': [96, 96],
  })) {
    assert.deepEqual(imageSize(await readFile(path), path.split('.').pop()), dimensions, path);
  }
});

// The Windows App Certification Kit fails a package with an image of 204,800 bytes or more.
test('every MSIX tile stays under the certification kit size limit', async () => {
  const { readdir, stat } = await import('node:fs/promises');
  const folder = 'src-tauri/icons/msix';
  for (const file of await readdir(folder)) assert.ok((await stat(`${folder}/${file}`)).size < 204800, file);
});

test('archived references and retired drawings are not counted as active artwork', async () => {
  const { inventoryAssets } = await import('../scripts/asset-audit-lib.mjs');
  const records = await inventoryAssets();
  const role = file => records.find(record => record.path === file)?.role;
  assert.equal(role('assets/sources/events/reference/newyear-vector.svg'), 'reference');
  assert.equal(role('assets/pets/mochi/identity-reference.png'), 'reference');
  assert.equal(role('assets/sources/decor/lantern.svg'), 'reference');
  assert.equal(role('src/art/decor/sculpted/lantern.svg'), 'runtime');
});

// Everything under src/ ships inside the app, so a drawing nothing names is dead weight there;
// retired drawings belong in assets/sources/ (assets/README.md).
test('every decoration drawing in the app is one the content names', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  const named =
    (await readFile('src/content/catalog.json', 'utf8')) + (await readFile('src/art/collection.json', 'utf8'));
  for (const folder of ['decor', 'decor/sculpted'])
    for (const file of await readdir(`src/art/${folder}`))
      if (file.endsWith('.svg')) assert.ok(named.includes(`"${folder}/${file}"`), `src/art/${folder}/${file}`);
});
