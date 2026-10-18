import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { probeMsix } from './msix-scenario.mjs';

function fixture(overrides = {}) {
  const state = { updateChannel: 'store', sound: { on: false, volume: 37 } };
  const nodes = {
    'update-button': { hidden: true },
    'update-pill': { hidden: true },
    'update-note': { textContent: 'fixture store note' },
  };
  const calls = [];
  return {
    phase: 'prepare',
    storeNote: 'fixture store note',
    document: { getElementById: id => nodes[id] },
    renderUpdate() {},
    async checkForUpdates() {},
    api: {
      async bootstrap() {
        return { ok: true, data: state };
      },
      async checkUpdate() {
        calls.push('check');
        return { ok: true, data: { channel: 'store' } };
      },
      async installUpdate() {
        calls.push('install');
        return { ok: false, error: 'Microsoft Store fixture' };
      },
      async setSound(on, volume) {
        state.sound = { on, volume };
        return { ok: true };
      },
    },
    nodes,
    calls,
    state,
    ...overrides,
  };
}
test('MSIX probe checks the native updater guards, UI and retained settings', async () => {
  const f = fixture();
  assert.equal((await probeMsix(f)).channel, 'store');
  assert.deepEqual(f.calls, ['check', 'install']);
  assert.equal((await probeMsix({ ...f, phase: 'upgrade' })).retained, true);
});
test('MSIX probe rejects a GitHub channel, allowed installer and lost settings', async () => {
  const f = fixture();
  f.state.updateChannel = 'github';
  await assert.rejects(probeMsix(f), /package identity/);
  f.state.updateChannel = 'store';
  f.api.installUpdate = async () => ({ ok: true });
  await assert.rejects(probeMsix(f), /installer/);
  f.api.installUpdate = async () => ({ ok: false, error: 'Microsoft Store fixture' });
  f.nodes['update-button'].hidden = false;
  await assert.rejects(probeMsix(f), /controls/);
  f.nodes['update-button'].hidden = true;
  f.state.sound.volume = 50;
  await assert.rejects(probeMsix({ ...f, phase: 'upgrade' }), /retained/);
});
test('Windows CI packages native binaries and always retains MSIX reports', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8');
  assert.match(workflow, /test:msix:ci/);
  assert.match(workflow, /playpets-msix-production/);
  assert.match(workflow, /always\(\).*Windows/);
  const script = readFileSync('packaging/windows/msix/ci.ps1', 'utf8');
  for (const token of [
    'Add-AppxPackage',
    'Remove-AppxPackage',
    'shell:AppsFolder',
    'Invoke-CommandInDesktopPackage',
    'finally',
    'TrustedPeople',
  ])
    assert.ok(script.includes(token), token);
});

test('MSIX gate uses the normal package data path and publishes only complete results', () => {
  const script = readFileSync('packaging/windows/msix/ci.ps1', 'utf8');
  assert.match(script, /Remove-Item Env:PLAYPETS_DATA/);
  assert.doesNotMatch(script, /\$env:PLAYPETS_DATA\s*=/);
  assert.match(script, /Move-Item.*RESULT/);
});

test('MSIX probe rejects an unpackaged updater response and an unrelated install error', async () => {
  const f = fixture();
  f.api.checkUpdate = async () => ({ ok: true, data: { channel: 'github' } });
  await assert.rejects(probeMsix(f), /updater channel/);
  f.api.checkUpdate = async () => ({ ok: true, data: { channel: 'store' } });
  f.api.installUpdate = async () => ({ ok: false, error: 'Network unavailable' });
  await assert.rejects(probeMsix(f), /installer/);
});

test('the packaged probe reads logs while the child still owns its writer', () => {
  const script = readFileSync('packaging/windows/msix/ci.ps1', 'utf8');
  assert.match(script, /function Read-SharedLog/);
  assert.match(script, /\[IO\.FileShare\]::ReadWrite/);
  assert.doesNotMatch(script, /ReadAllText\(STDOUT\)/);
});

test('the shared log reader works with a live Windows writer', { skip: process.platform !== 'win32' }, () => {
  const script = readFileSync('packaging/windows/msix/ci.ps1', 'utf8');
  const helper = script.match(/^function Read-SharedLog[\s\S]*?^}/m)?.[0];
  assert.ok(helper);
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `
$ErrorActionPreference = 'Stop'
${helper}
$file = Join-Path ([IO.Path]::GetTempPath()) ('playpets-shared-' + [guid]::NewGuid())
$writer = $null
try {
    if ((Read-SharedLog $file) -ne '') { throw 'A missing log must be empty' }
    $writer = [IO.File]::Open($file, [IO.FileMode]::Create, [IO.FileAccess]::Write, [IO.FileShare]::Read)
    $bytes = [Text.Encoding]::UTF8.GetBytes('probe output')
    $writer.Write($bytes, 0, $bytes.Length)
    $writer.Flush()
    if ((Read-SharedLog $file) -ne 'probe output') { throw 'The live log was not read' }
    Write-Output 'SHARED_LOG_VERIFIED'
} finally {
    if ($writer) { $writer.Dispose() }
    Remove-Item -LiteralPath $file -ErrorAction SilentlyContinue
}
`,
    ],
    { encoding: 'utf8', timeout: 20000 },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /SHARED_LOG_VERIFIED/);
});
