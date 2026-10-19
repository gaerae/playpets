import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('update checks bound stalled requests without imposing that short timeout on downloads', async () => {
  const source = await readFile(new URL('../src-tauri/src/update.rs', import.meta.url), 'utf8');
  const check = source.slice(source.indexOf('pub fn check('), source.indexOf('pub fn found_version('));
  assert.match(check, /updater_builder\(\)[\s\S]*?\.timeout\(std::time::Duration::from_secs\(30\)\)/);
  assert.doesNotMatch(check, /update\.timeout\s*=.*from_secs\(30\)/);
});
