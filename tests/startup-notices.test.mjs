import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom } from './support/dom.mjs';

const notices = await import('../src/core/notices.js');
function page(t) {
  const { nodes, document } = installDom(t, {
    ids: [
      'warnings',
      'warning-details',
      'warning-summary',
      'warning-toggle',
      'warning-messages',
      'dismiss-warnings',
      'yard-controls-toggle',
    ],
  });
  notices.setupNotices();
  return { nodes, document };
}

test('startup notices keep details collapsed and render untrusted messages as plain text', t => {
  const { nodes } = page(t);
  notices.renderNotices(['<img onerror=evil()> missing file']);
  assert.equal(nodes.get('warnings').hidden, false);
  assert.equal(nodes.get('warning-details').open, false);
  assert.equal(nodes.get('warning-messages').textContent, '<img onerror=evil()> missing file');
  nodes.get('warning-details').open = true;
  notices.renderNotices(['<img onerror=evil()> missing file']);
  assert.equal(nodes.get('warning-details').open, true, 'ordinary renders retain an open explanation');
});

test('dismissed notices stay dismissed until the actual messages change', t => {
  const { nodes } = page(t);
  notices.renderNotices(['First reason']);
  nodes.get('dismiss-warnings').onclick();
  assert.equal(nodes.get('warnings').hidden, true);
  notices.renderNotices(['First reason']);
  assert.equal(nodes.get('warnings').hidden, true);
  notices.renderNotices(['New reason']);
  assert.equal(nodes.get('warnings').hidden, false);
  assert.equal(nodes.get('warning-details').open, false);
  nodes.get('dismiss-warnings').onclick();
  notices.renderNotices([]);
  assert.equal(nodes.get('warnings').hidden, true);
  notices.renderNotices(['New reason']);
  assert.equal(nodes.get('warnings').hidden, false, 'an issue that returns after recovery is visible again');
});

test('Escape closes notice details before dismissing the card and restoring focus', async t => {
  const { nodes, document } = page(t);
  notices.renderNotices(['A recoverable issue']);
  nodes.get('warning-details').open = true;
  let consumed = false;
  await nodes.get('warnings').dispatch('keydown', {
    key: 'Escape',
    preventDefault() {
      consumed = true;
    },
  });
  assert.equal(consumed, true);
  assert.equal(nodes.get('warning-details').open, false);
  assert.equal(nodes.get('warnings').hidden, false);
  await nodes.get('warnings').dispatch('keydown', { key: 'Escape' });
  assert.equal(nodes.get('warnings').hidden, true);
  assert.equal(document.activeElement, nodes.get('yard-controls-toggle'));
});
