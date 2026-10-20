import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom, installStorage } from './support/dom.mjs';

installStorage();
globalThis.requestAnimationFrame = () => {};
const { openPanel, setupTabs } = await import('../src/panel/tabs.js');

function page(t) {
  const sections = ['general-title', 'agent-link-title', 'updates-title', 'about-title'];
  const { document, nodes } = installDom(t, {
    ids: [
      'brand',
      'layout',
      'side-panel',
      'panel-invite',
      'panel-pet',
      'panel-settings',
      'panel-title',
      'close-panel',
      'go-invite',
      'step-ai',
      'step-agent',
      'steps-dismiss',
      'settings-content',
      'settings-home',
      'panel-menu',
      'update-dialog',
      'update-pill',
      'update-compact',
      'yard',
      ...sections,
      ...sections.map((_, i) => `settings-tab-${i}`),
      ...sections.map(id => `${id}-body`),
    ],
    props: { hidden: true, scrollTop: 0 },
  });
  for (const [id, node] of nodes) node.dataset.title = id;
  const links = sections.map((id, i) => {
    const link = nodes.get(`settings-tab-${i}`);
    link.dataset.section = id;
    return link;
  });
  const bodies = sections.map(id => {
    const body = nodes.get(`${id}-body`);
    body.dataset.settingsSection = id;
    return body;
  });
  document.activeElement = nodes.get('brand');
  document.querySelector = selector => (selector === '.brand' ? nodes.get('brand') : null);
  document.querySelectorAll = selector =>
    selector.includes('settings-index') ? links : selector.includes('data-settings-section') ? bodies : [];
  setupTabs();
  return { nodes, links, bodies };
}

test('Settings starts at a task list and returns there before leaving management', t => {
  const { nodes, links, bodies } = page(t);
  openPanel('settings');
  assert.equal(nodes.get('settings-home').hidden, false);
  assert.equal(nodes.get('settings-content').hidden, true);
  links[2].onclick();
  assert.equal(nodes.get('settings-home').hidden, true);
  assert.equal(nodes.get('settings-content').hidden, false);
  assert.deepEqual(
    bodies.map(body => body.hidden),
    [true, true, false, true],
  );
  nodes.get('update-dialog').hidden = false;
  nodes.get('panel-menu').dispatch('click');
  assert.equal(nodes.get('update-dialog').hidden, true, 'a hidden update region must not trap Escape on the task list');
  assert.equal(nodes.get('settings-home').hidden, false);
  assert.equal(nodes.get('settings-content').hidden, true);
});

test('direct agent, update and About routes bypass the task list', t => {
  const { nodes, bodies } = page(t);
  nodes.get('step-agent').onclick();
  assert.deepEqual(
    bodies.map(body => body.hidden),
    [true, false, true, true],
  );
  openPanel('settings', 'updates');
  assert.deepEqual(
    bodies.map(body => body.hidden),
    [true, true, false, true],
  );
  assert.equal(document.activeElement, nodes.get('panel-title'));
  openPanel('settings', 'about');
  assert.deepEqual(
    bodies.map(body => body.hidden),
    [true, true, true, false],
  );
  assert.equal(document.activeElement, nodes.get('panel-title'));
  openPanel(null);
  openPanel('settings');
  assert.equal(nodes.get('settings-home').hidden, false, 'reopening starts from explicit tasks');
});

test('Escape closes the Updates task in one step and clears its inline details', async t => {
  const { nodes } = page(t);
  openPanel('settings', 'updates');
  nodes.get('update-dialog').hidden = false;
  await document.dispatch('keydown', { key: 'Escape' });
  assert.equal(nodes.get('side-panel').hidden, true);
  assert.equal(nodes.get('update-dialog').hidden, true);
});

test('a task entered from management returns to its tab without an extra Settings home', async t => {
  const { nodes } = page(t);
  openPanel('settings', 'general-title', true);
  await nodes.get('panel-menu').dispatch('click');
  assert.equal(nodes.get('settings-home').hidden, true, 'management owns the task list for this route');
  assert.equal(nodes.get('panel-menu').getAttribute('aria-label'), 'Back to friends & settings');
});
