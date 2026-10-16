import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('native review windows isolate web storage only in explicitly enabled e2e runs', async () => {
  for (const path of ['src-tauri/src/window.rs', 'src-tauri/src/desktop/overlay.rs']) {
    const source = await readFile(path, 'utf8');
    assert.match(source, /\.incognito\(crate::commands::e2e_mode\(\)\)/, path);
    assert.doesNotMatch(source, /\.incognito\(true\)/, 'normal app profiles retain their storage');
  }
});
