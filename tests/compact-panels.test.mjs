import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rule = async (file, selector) => {
  const css = await readFile(`src/styles/${file}.css`, 'utf8');
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, selector);
  return css.slice(start, css.indexOf('}', start));
};
test('conversation can shrink inside a short panel while keeping readable messages', async () => {
  assert.match(await rule('chat', '.chat-log'), /min-height: 0;/);
  assert.match(await rule('chat', '.message'), /font-size: 14px;/);
  const css = await readFile('src/styles/chat.css', 'utf8');
  assert.doesNotMatch(css, /min-height: 220px/);
});
test('invite rows reduce surplus space without shrinking names or touch targets', async () => {
  assert.match(await rule('invite', '.asset-card'), /min-height: 68px;/);
  assert.match(await rule('invite', '.asset-info strong'), /font-size: 13px;/);
  assert.match(await rule('invite', '.asset-card canvas'), /width: 46px;/);
});
test('friend progress remains a readable line instead of another framed card', async () => {
  assert.match(await rule('friend', '.bond-next'), /padding: 0;/);
  assert.match(await rule('friend', '.bond-next'), /font-size: 12px;/);
  assert.match(await rule('friend', '.relation-chip'), /min-height: 28px;/);
});

test('invite uses two columns when its browsing panel has enough room', async () => {
  const css = await readFile('src/styles/invite.css', 'utf8');
  assert.match(css, /@container panel \(min-width: 460px\)/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.shelf-group-head\s*\{\s*grid-column: 1 \/ -1;/);
});

test('onboarding steps do not compete with an open task panel', async () => {
  const css = await readFile('src/styles/welcome.css', 'utf8');
  assert.match(css, /\.layout:is\(\.panel-open, \.settings-open\) \.empty-yard\s*\{\s*display: none;/);
});

test('Invite scrolls its list without losing the panel close button', async () => {
  assert.match(await rule('panel', '#panel-invite'), /overflow-y: auto;/);
  assert.match(await rule('panel', '.layout.panel-open .side-panel'), /overflow: hidden;/);
});

test('mini view shares one row for desktop and sound to keep care tools in sight', async () => {
  assert.match(await rule('mini', 'body.mini .view-controls > #desktop'), /grid-column: auto;/);
  assert.match(await rule('mini', 'body.mini .yard-controls-panel'), /gap: 4px;/);
});
