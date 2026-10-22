import assert from 'node:assert/strict';
import test from 'node:test';
import { element, installDom, installStorage, keepGlobals } from './support/dom.mjs';

installStorage();
globalThis.requestAnimationFrame = () => {};
const { openPanel, setupTabs } = await import('../src/panel/tabs.js');

// A small window opens one section at a time (compact); a wide one shows the list beside it.
function page(t, { wide = false } = {}) {
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
  if (!wide) document.body.classList.add('compact');
  keepGlobals(t, 'window');
  globalThis.window = element('window');
  document.activeElement = nodes.get('brand');
  document.querySelector = selector => (selector === '.brand' ? nodes.get('brand') : null);
  document.querySelectorAll = selector =>
    selector.includes('settings-index') ? links : selector.includes('data-settings-section') ? bodies : [];
  setupTabs();
  return { nodes, links, bodies };
}

test('in a small window Settings starts at a task list and returns there before leaving management', t => {
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

test('Back from a section always returns to the list of sections, however it was opened', async t => {
  const { nodes } = page(t);
  openPanel('settings', 'general-title');
  assert.equal(nodes.get('panel-menu').getAttribute('aria-label'), 'Back to settings');
  await nodes.get('panel-menu').dispatch('click');
  assert.equal(nodes.get('settings-home').hidden, false, 'the list of sections, one step up');
});

test('a wide window shows the list of sections beside the open one, as System Settings does', async t => {
  const { nodes, links, bodies } = page(t, { wide: true });
  openPanel('settings');
  assert.equal(nodes.get('settings-home').hidden, false, 'the list stays');
  assert.equal(nodes.get('settings-content').hidden, false, 'with the first section open beside it');
  assert.deepEqual(
    bodies.map(body => body.hidden),
    [false, true, true, true],
  );
  assert.equal(links[0].getAttribute('aria-current'), 'page');
  document.activeElement = links[2];
  links[2].onclick();
  assert.equal(nodes.get('settings-home').hidden, false);
  assert.deepEqual(
    bodies.map(body => body.hidden),
    [true, true, false, true],
  );
  assert.equal(links[2].getAttribute('aria-current'), 'page');
  assert.equal(links[0].getAttribute('aria-current'), null);
  assert.equal(document.activeElement, links[2], 'choosing from the list leaves the focus on it');
  assert.equal(
    nodes.get('panel-menu').getAttribute('aria-label'),
    'Back to friends & settings',
    'beside the list, Back leaves Settings',
  );
  openPanel(null);
  openPanel('settings');
  assert.equal(links[2].getAttribute('aria-current'), 'page', 'it opens again where it was left');
});

test('Settings follows the window between the two layouts without losing its section', async t => {
  const { nodes, links } = page(t);
  openPanel('settings', 'updates');
  document.body.classList.remove('compact');
  await window.dispatch('resize');
  assert.equal(nodes.get('settings-home').hidden, false, 'widened: the list joins the open section');
  assert.equal(links[2].getAttribute('aria-current'), 'page');
  document.body.classList.add('compact');
  await window.dispatch('resize');
  assert.equal(nodes.get('settings-home').hidden, true, 'narrowed: the open section alone');
  assert.equal(nodes.get('updates-title-body').hidden, false);
});
