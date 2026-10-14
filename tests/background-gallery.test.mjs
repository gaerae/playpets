import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import './support/content.mjs';
import { backgroundPreview } from '../src/yard/background-ui.js';
import { worlds } from '../src/yard/worlds.js';

test('every built-in background has a real daylight gallery image', async () => {
  for (const world of worlds) {
    const preview = new URL(backgroundPreview(world));
    assert.equal(preview.protocol, 'file:');
    await access(preview);
  }
});

test('imported background thumbnails use their validated embedded image', () => {
  const source = 'data:image/png;base64,preview';
  assert.equal(backgroundPreview({ id: 'custom-example', imageSources: { base: source } }), source);
});

test('season selectors have matching choices and distinct labels', async () => {
  const html = await readFile('src/index.html', 'utf8');
  const choices = id =>
    [...html.match(new RegExp(`<select id="${id}"[^>]*>(.*?)</select>`))[1].matchAll(/value="([^"]+)"/g)].map(
      match => match[1],
    );
  assert.deepEqual(choices('scene-season'), choices('season'));
  assert.match(html, /label for="scene-season"/);
  assert.match(html, /label for="season"/);
});

test('canceling background removal returns to the gallery and its remove button', async t => {
  const { installDom } = await import('./support/dom.mjs');
  const { nodes } = installDom(t, { anyId: true });
  const { setupConfirm } = await import('../src/core/confirm.js');
  const { setupBackgrounds } = await import('../src/yard/background-ui.js');
  const custom = {
    id: 'custom-review',
    custom: true,
    name: 'Review',
    imageSources: { base: 'data:image/png;base64,preview' },
  };
  worlds.push(custom);
  t.after(() => worlds.splice(worlds.indexOf(custom), 1));
  document.getElementById('world').value = custom.id;
  setupConfirm();
  setupBackgrounds();
  const removing = nodes.get('background-remove').dispatch('click');
  document.getElementById('scene-menu').hidden = true;
  nodes.get('confirm-cancel').onclick();
  await nodes.get('confirm-dialog').dispatch('close');
  await removing;
  assert.equal(nodes.get('scene-menu').hidden, false);
  assert.equal(document.activeElement, nodes.get('background-remove'));
  assert.equal(nodes.get('world').value, custom.id);
});
