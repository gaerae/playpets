import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
const start = workflow.indexOf('          args=(--target');
const end = workflow.indexOf('          npx tauri build', start);
const script = workflow
  .slice(start, end)
  .replace(/\$\{\{ matrix\.target \}\}/g, 'aarch64-apple-darwin')
  .replace(/\$\{\{ matrix\.bundles \}\}/g, 'app,dmg');
const fields = [
  'APPLE_CERTIFICATE_SECRET',
  'APPLE_CERTIFICATE_PASSWORD_SECRET',
  'APPLE_SIGNING_IDENTITY_SECRET',
  'APPLE_ID_SECRET',
  'APPLE_PASSWORD_SECRET',
  'APPLE_TEAM_ID_SECRET',
];
function preflight(values) {
  return spawnSync('bash', ['-eu', '-c', `${script}\necho BUILD_READY`], {
    encoding: 'utf8',
    env: {
      ...process.env,
      RUNNER_OS: 'macOS',
      TAURI_SIGNING_PRIVATE_KEY_SECRET: '',
      ...Object.fromEntries(fields.map(key => [key, values[key] || ''])),
    },
  });
}
test('macOS release accepts either no Apple signing credentials or the complete set', {
  skip: process.platform === 'win32',
}, () => {
  assert.ok(start > 0 && end > start);
  assert.equal(preflight({}).status, 0);
  assert.equal(preflight(Object.fromEntries(fields.map(key => [key, 'fixture']))).status, 0);
});
test('every incomplete Apple credential set stops before the native build', {
  skip: process.platform === 'win32',
}, () => {
  for (const field of fields) {
    const single = preflight({ [field]: 'fixture' });
    assert.notEqual(single.status, 0, field);
    assert.match(single.stderr, /all six APPLE_/);
    assert.doesNotMatch(single.stdout, /BUILD_READY/);
    const values = Object.fromEntries(fields.map(key => [key, key === field ? '' : 'fixture']));
    assert.notEqual(preflight(values).status, 0, field);
  }
});
