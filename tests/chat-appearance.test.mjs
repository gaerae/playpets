import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom } from './support/dom.mjs';

let history = [{ role: 'assistant', content: 'Hello' }];
globalThis.playPets = { getChat: async () => ({ ok: true, data: history }) };
globalThis.Image = class {
  complete = true;
  naturalWidth = 1536;
};
const { setData, setSelected } = await import('../src/core/state.js');
const { refreshChat } = await import('../src/panel/chat.js');
const { setSpriteSeason } = await import('../src/core/sprites.js');

test('appearance refresh updates existing chat avatars without replacing history, scrolling, or drafts', async t => {
  const { nodes } = installDom(t, {
    anyId: true,
    props: {
      scrollHeight: 600,
      scrollTop: 20,
      clientHeight: 100,
      prepend(child) {
        this.insertBefore(child, this.children[0]);
      },
      getContext: () => ({ clearRect() {}, drawImage() {} }),
    },
  });
  const friend = { id: 'a', assetId: 'a', visualStyle: 'illustrated' };
  setData({
    pets: [friend],
    assets: [
      {
        id: 'a',
        spriteUrl: 'toon',
        seasonalSpriteUrls: { winter: 'winter' },
        realisticSpriteUrls: { default: 'real' },
        realisticPortraitUrl: 'portrait',
      },
    ],
    busy: [],
  });
  setSelected('a');
  await refreshChat();
  const log = nodes.get('chat-log');
  const message = log.children[0];
  log.scrollTop = 20;
  document.getElementById('message').value = 'Unsent draft';
  friend.visualStyle = 'realistic';
  await refreshChat();
  assert.equal(log.children[0], message, 'the existing message stays in place');
  const frame = log.querySelectorAll('.chat-avatar')[0];
  assert.ok(frame.children.some(child => child.localName === 'img' && child.src === 'portrait'));
  assert.equal(log.scrollTop, 20);
  assert.equal(nodes.get('message').value, 'Unsent draft');
  const photo = frame.children.find(child => child.localName === 'img');
  await refreshChat();
  assert.ok(frame.children.includes(photo), 'unchanged appearance does not reload the portrait');
  history = [...history, { role: 'user', content: 'Thanks' }];
  await refreshChat();
  assert.equal(log.children.length, 2);
  assert.equal(log.children[0], message);
  friend.visualStyle = 'illustrated';
  await refreshChat();
  assert.equal(
    frame.children.some(child => child.localName === 'img'),
    false,
  );
  const autumnAvatar = frame.children[0];
  setSpriteSeason('winter');
  await refreshChat();
  assert.notEqual(frame.children[0], autumnAvatar, 'the static avatar follows a changed wardrobe');
  assert.equal(log.children[0], message, 'wardrobe changes preserve the conversation');
  setSpriteSeason('autumn');
});
