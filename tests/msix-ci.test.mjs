import assert from 'node:assert/strict';
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
