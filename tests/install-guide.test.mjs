import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('localized Linux instructions distinguish the Ubuntu FUSE package rename and retain extraction fallback', async () => {
  for (const locale of ['', 'ko/', 'ja/', 'zh-hans/']) {
    const file = `website/${locale}guide/install.md`;
    const text = await readFile(file, 'utf8');
    assert.ok(text.includes('22.04'), file);
    assert.ok(text.includes('24.04'), file);
    assert.ok(text.includes('sudo apt install libfuse2t64'), file);
    assert.ok(text.includes('--appimage-extract-and-run'), file);
    assert.ok(text.includes('https://docs.appimage.org/user-guide/troubleshooting/fuse.html'), file);
  }
});
