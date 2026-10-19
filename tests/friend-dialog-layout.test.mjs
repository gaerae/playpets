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

test('friend dialog footer wraps actions instead of pushing removal outside narrow windows', async () => {
  const css = await readFile('src/styles/dialog.css', 'utf8');
  assert.match(css, /#pet-form\s*>\s*\.dialog-actions\s*\{[^}]*flex-wrap:\s*wrap;/);
});
