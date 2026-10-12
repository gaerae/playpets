import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom, installStorage } from './support/dom.mjs';

installStorage();
globalThis.requestAnimationFrame = () => {};
const { openPanel, setupTabs } = await import('../src/panel/tabs.js');

function page(t) {
  const sections = ['general-title', 'yard-settings-title', 'agent-link-title', 'about-title'];
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

test('Settings selects one section and routes agent/update entry points to their contents', t => {
  const { nodes, links, bodies } = page(t);
  openPanel('settings', 'general-title');
  assert.deepEqual(
    bodies.map(body => body.hidden),
    [false, true, true, true],
  );
  nodes.get('settings-content').scrollTop = 200;
  links[1].onclick();
  assert.deepEqual(
    bodies.map(body => body.hidden),
    [true, false, true, true],
  );
  assert.equal(nodes.get('settings-content').scrollTop, 0);
  nodes.get('step-agent').onclick();
  assert.deepEqual(
    bodies.map(body => body.hidden),
    [true, true, false, true],
  );
  openPanel('settings', 'about-title');
  assert.deepEqual(
    bodies.map(body => body.hidden),
    [true, true, true, false],
  );
  assert.equal(document.activeElement, nodes.get('about-title'));
  assert.deepEqual(
    links.map(link => link.getAttribute('aria-selected')),
    ['false', 'false', 'false', 'true'],
  );
  openPanel(null);
  openPanel('settings');
  assert.equal(bodies[3].hidden, false, 'reopening Settings keeps its selected section');
  openPanel('settings', 'about');
  assert.equal(document.activeElement, nodes.get('about-title'), 'the native About route selects the same section');
});

test('Settings section tabs support arrows and Home/End with one keyboard stop', t => {
  const { links, bodies } = page(t);
  openPanel('settings', 'general-title');
  let prevented = false;
  links[0].onkeydown({
    key: 'End',
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(document.activeElement, links[3]);
  assert.deepEqual(
    bodies.map(body => body.hidden),
    [true, true, true, false],
  );
  links[3].onkeydown({ key: 'ArrowRight', preventDefault() {} });
  assert.equal(document.activeElement, links[0]);
  assert.deepEqual(
    links.map(link => link.tabIndex),
    [0, -1, -1, -1],
  );
});
