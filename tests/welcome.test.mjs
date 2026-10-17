import assert from 'node:assert/strict';
import test from 'node:test';
import { setData } from '../src/core/state.js';
import * as welcome from '../src/yard/welcome.js';
import { installDom } from './support/dom.mjs';

test('a new yard offers every official companion, including Miso, and invites the chosen one', async t => {
  const { nodes } = installDom(t, { ids: ['starter-picks', 'welcome-more'] });
  const invited = [];
  const assets = ['Daisy', 'Clover', 'Pip', 'Miso'].map(displayName => ({
    id: displayName.toLowerCase(),
    displayName,
    place: 'builtin',
  }));
  setData({ assets: [{ id: 'imported', displayName: 'Imported', place: 'codex' }, ...assets] });
  t.after(() => setData({ pets: [], assets: [], providers: [], statuses: {}, busy: [] }));
  welcome.setupWelcome({ invite: async id => invited.push(id), more() {} });
  welcome.renderWelcome();
  const buttons = nodes.get('starter-picks').children;
  assert.deepEqual(
    buttons.map(button => button.children[1].textContent),
    ['Daisy', 'Clover', 'Pip', 'Miso'],
  );
  await buttons[3].onclick();
  assert.deepEqual(invited, ['miso']);
  assert.equal(buttons[3].disabled, false);
});

test('companionship setup finishes without requiring a coding agent', () => {
  assert.equal(welcome.onboardingSteps([], {}, false).hidden, false);
  assert.equal(welcome.onboardingSteps([{ providerId: '' }], {}, false).hidden, false);
  assert.equal(welcome.onboardingSteps([{ providerId: 'local' }], {}, false).hidden, true);
  assert.equal(welcome.onboardingSteps([{ providerId: '' }], {}, true).hidden, true);
  assert.equal(welcome.onboardingSteps([], {}, true).hidden, false);
});
