import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('editing dialogs keep headings and actions outside one bounded body scroller', async () => {
  const html = await readFile('src/index.html', 'utf8');
  for (const id of ['pet', 'import', 'connection']) {
    const form = html.match(new RegExp(`<form id="${id}-form"[^>]*>([\\s\\S]*?)</form>`))?.[1];
    assert.ok(form, id);
    assert.match(form, /class="dialog-body(?: friend-dialog-body)?"/, `${id} has one body scroller`);
    assert.match(form, /<\/div>\s*<div class="dialog-actions">/, `${id} keeps actions out of the scroller`);
  }
  const css = await readFile('src/styles/dialog.css', 'utf8');
  assert.match(css, /\.dialog-body\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.dialog-form\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column/s);
});

test('desktop controls use a compact reading scale while touch targets stay generous', async () => {
  const base = await readFile('src/styles/base.css', 'utf8');
  const button = base.match(/\.button\s*\{([^}]+)\}/)?.[1] || '';
  assert.match(button, /min-height:\s*36px/);
  assert.match(button, /font-size:\s*13px/);
  assert.match(base, /@media\s*\(pointer:\s*coarse\)/);
  const play = await readFile('src/styles/play.css', 'utf8');
  assert.match(play, /\.play-action,\s*\.discovery-tree-choice\s*\{[^}]*min-height:\s*40px/s);
});
