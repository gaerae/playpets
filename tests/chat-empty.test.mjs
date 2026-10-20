import assert from 'node:assert/strict';
import test from 'node:test';
import { setData } from '../src/core/state.js';
import { renderChat } from '../src/panel/chat.js';
import { installDom, keepGlobals } from './support/dom.mjs';

test('an unconnected friend selects the named no-AI option instead of a blank control', t => {
  const { document } = installDom(t, { anyId: true, props: { value: '' } });
  keepGlobals(t, 'Option');
  globalThis.Option = class {};
  const friend = { id: 'a' };
  setData({ pets: [friend], assets: [], providers: [], busy: [] });
  renderChat(friend);
  assert.equal(document.getElementById('provider-select').value, '');
});
