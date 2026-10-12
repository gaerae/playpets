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
    'src/art/weather/seasonal.png',
    'src/art/fish/specimens.png',
    'website/public/og-ko.png',
    'src-tauri/icons/icon.ico',
    'src/logo.svg',
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
    'src-tauri/icons/msix/StoreLogo.png': [50, 50],
    'src-tauri/icons/msix/Square44x44Logo.png': [44, 44],
    'src-tauri/icons/msix/Square150x150Logo.png': [150, 150],
    'packaging/macos/dmg-background.png': [1320, 840],
    'packaging/windows/nsis-sidebar.bmp': [164, 314],
    'packaging/windows/nsis-header.bmp': [150, 57],
    'website/public/og.png': [1200, 630],
    'website/public/og-ko.png': [1200, 630],
    'website/public/og-zh-hans.png': [1200, 630],
    'assets/banner.png': [1600, 560],
  })) {
    assert.deepEqual(imageSize(await readFile(path), path.split('.').pop()), dimensions, path);
  }
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
