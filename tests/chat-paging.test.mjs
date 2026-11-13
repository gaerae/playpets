// A friend's conversation can run to hundreds of lines. Opening it draws the last of them; the
// earlier ones come in as the log is scrolled to its top, and what is on screen stays where it was.

import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom } from './support/dom.mjs';

const line = n => ({ role: n % 2 ? 'assistant' : 'user', content: `line ${n}` });
let history = Array.from({ length: 200 }, (_, n) => line(n));
globalThis.playPets = { getChat: async () => ({ ok: true, data: history }) };
globalThis.Image = class {
  complete = true;
  naturalWidth = 1536;
};
const { setData, setSelected } = await import('../src/core/state.js');
const { CHAT_PAGE, refreshChat, showEarlier } = await import('../src/panel/chat.js');

// A log whose height is its lines' (20 px each), as the page lays it out.
function chatLog(t) {
  const { document } = installDom(t, {
    anyId: true,
    props: {
      clientHeight: 300,
      getContext: () => ({ clearRect() {}, drawImage() {} }),
      prepend(child) {
        this.insertBefore(child, this.children[0]);
      },
    },
  });
  const log = document.getElementById('chat-log');
  const lines = () => log.children.filter(n => !n.removed && n.classList.contains('message'));
  Object.defineProperty(log, 'scrollHeight', { get: () => lines().length * 20 });
  log.scrollTop = 0;
  setData({ pets: [{ id: 'a', assetId: 'a' }], assets: [{ id: 'a', spriteUrl: 'toon' }], busy: [] });
  setSelected('a');
  return { log, lines };
}

test('opening a long conversation draws its last lines, and earlier ones come in at the top', async t => {
  const { log, lines } = chatLog(t);
  await refreshChat();
  assert.equal(CHAT_PAGE, 50);
  assert.equal(lines().length, 50, 'the last 50 lines');
  assert.match(lines().at(-1).textContent, /line 199$/);
  assert.match(lines()[0].textContent, /line 150$/);
  assert.equal(log.scrollTop, 1000, 'at the end');
  // Read up to the top: the 50 before come in above, and the line read stays where it was.
  const top = lines()[0];
  log.scrollTop = 0;
  showEarlier();
  assert.equal(lines().length, 100);
  assert.match(lines()[0].textContent, /line 100$/);
  assert.equal(log.scrollTop, 1000, 'the line that was at the top is still in view');
  assert.equal(lines()[50], top);
  // Not at the top: nothing comes in.
  log.scrollTop = 400;
  showEarlier();
  assert.equal(lines().length, 100);
  // A new line still goes at the end.
  history = [...history, line(200)];
  await refreshChat();
  assert.equal(lines().length, 101);
  assert.match(lines().at(-1).textContent, /line 200$/);
});
