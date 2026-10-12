import assert from 'node:assert/strict';
import test from 'node:test';
import { setupAlbum } from '../src/panel/album.js';
import { installDom } from './support/dom.mjs';

test('album tabs have one tab stop and arrow keys select and label the collection', t => {
  const { document, nodes } = installDom(t, {
    ids: ['album-tabs', 'album-grid', 'album-button', 'close-album', 'album-dialog', 'album-total'],
    props: { open: true },
  });
  document.querySelectorAll = () => nodes.get('album-tabs').children;
  document.querySelector = selector => {
    const id = selector.match(/data-count="(.*?)"/)[1];
    return nodes.get('album-tabs').children.find(tab => tab.dataset.book === id).children[1];
  };
  setupAlbum();
  nodes.get('album-button').onclick();
  const tabs = nodes.get('album-tabs').children;
  assert.deepEqual(
    tabs.map(tab => tab.tabIndex),
    [0, -1, -1, -1],
  );
  let prevented = false;
  tabs[0].onkeydown({
    key: 'ArrowLeft',
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(document.activeElement, tabs[3]);
  assert.equal(tabs[3].getAttribute('aria-selected'), 'true');
  assert.equal(nodes.get('album-grid').getAttribute('aria-labelledby'), tabs[3].id);
  tabs[3].onkeydown({ key: 'Home', preventDefault() {} });
  assert.equal(document.activeElement, tabs[0]);
  tabs[0].onkeydown({ key: 'End', preventDefault() {} });
  assert.equal(document.activeElement, tabs[3]);
});
