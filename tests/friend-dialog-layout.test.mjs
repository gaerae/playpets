import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('appearance choices scroll with the fields while friend dialog navigation and actions remain reachable', async () => {
  const html = await readFile('src/index.html', 'utf8');
  assert.match(
    html,
    /class="dialog-body friend-dialog-body"[\s\S]*id="pet-appearance"[\s\S]*id="pet-error"[\s\S]*<\/div>\s*<div class="dialog-actions">/,
  );
  const css = await readFile('src/styles/dialog.css', 'utf8');
  assert.match(css, /\.dialog-form\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/);
  assert.match(css, /\.dialog-body\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/);
});

test('small editing sheets keep one row of actions, the destructive one down to its icon', async () => {
  const css = await readFile('src/styles/dialog.css', 'utf8');
  const small = css.slice(css.indexOf('@media (max-width: 640px), (max-height: 480px)'));
  assert.match(small, /\.dialog-form > \.dialog-actions\s*\{[^}]*flex-wrap:\s*nowrap;/);
  assert.match(
    small,
    /\.dialog-form > \.dialog-actions \.push-left > span:not\(\[data-icon\]\)\s*\{[^}]*display:\s*none;/,
  );
  const html = await readFile('src/index.html', 'utf8');
  for (const id of ['remove', 'delete-provider'])
    assert.match(html, new RegExp(`id="${id}"[^>]*push-left[^>]*>.*?<span data-icon=`), `${id} has an icon to keep`);
});
