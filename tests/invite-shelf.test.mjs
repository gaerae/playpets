import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { installDom } from './support/dom.mjs';

const copies = [];
globalThis.playPets = {
  copyConnection: async kind => {
    copies.push(kind);
    return { ok: true, data: null };
  },
};
const invite = await import('../src/panel/invite.js');
const { setData } = await import('../src/core/state.js');
const { setupSettings } = await import('../src/panel/settings.js');

test('type and search intersect without hiding the humanoid starter or animal starters', async () => {
  const assets = await Promise.all(
    ['daisy', 'clover', 'pip', 'tabby', 'smoky', 'mochi'].map(async id => ({
      ...JSON.parse(await readFile(new URL(`../assets/pets/${id}/pet.json`, import.meta.url))),
      id,
    })),
  );
  assert.deepEqual(
    invite.shelfAssets(assets, 'person').map(a => a.id),
    ['daisy'],
  );
  assert.equal(invite.shelfAssets(assets, 'animal').length, 5);
  assert.equal(invite.shelfAssets(assets, '').length, 6);
  assert.deepEqual(
    invite.shelfAssets(assets, 'animal', ' CLOV ').map(a => a.id),
    ['clover'],
  );
  assert.equal(invite.shelfAssets(assets, 'person', 'pip').length, 0);
});

test('imported kinds are normalized and search includes credited creators', () => {
  const assets = [
    { id: 'human', kind: ' Humanoid ', displayName: 'Explorer', credit: { creator: 'Mira' } },
    { id: 'dog', kind: 'Animal', displayName: 'Puppy' },
    { id: 'robot', kind: 'robot', displayName: 'Bot' },
  ];
  assert.deepEqual(
    invite.shelfAssets(assets, 'person', 'mira').map(a => a.id),
    ['human'],
  );
  assert.deepEqual(
    invite.shelfAssets(assets, 'animal').map(a => a.id),
    ['dog'],
  );
  assert.deepEqual(
    invite.shelfAssets(assets, 'other').map(a => a.id),
    ['robot'],
  );
});

function page(t) {
  const { nodes } = installDom(t, {
    ids: ['shelf', 'yard-full', 'no-kind', 'no-assets', 'invite-search'],
    anyId: true,
    props: { value: '' },
  });
  return nodes;
}

test('same-id metadata corrections refresh displayed names instead of reusing stale cards', t => {
  const nodes = page(t);
  setData({ assets: [{ id: 'same', place: 'builtin', kind: 'animal', displayName: 'Before' }], pets: [] });
  invite.renderShelf();
  const first = nodes.get('shelf').children[0];
  setData({ assets: [{ id: 'same', place: 'builtin', kind: 'person', displayName: 'After' }], pets: [] });
  invite.renderShelf();
  assert.notEqual(nodes.get('shelf').children[0], first);
  assert.equal(nodes.get('shelf').querySelectorAll('.asset-card')[0].children[1].children[0].textContent, 'After');
});

test('each named pet has one shelf card even when a package has legacy optional looks', t => {
  const nodes = page(t);
  setData({
    assets: [
      { id: 'aria', place: 'builtin', displayName: 'Aria', realisticSpriteUrls: { default: 'real.png' } },
      { id: 'aria-mini', place: 'builtin', displayName: 'Aria Mini' },
      { id: 'cat', place: 'builtin', displayName: 'Cat' },
    ],
    pets: [],
  });
  invite.renderShelf();
  const entries = nodes.get('shelf').querySelectorAll('.asset-card');
  assert.equal(entries.length, 3);
  // The asset id is each card's one key: no look or entry key of its own.
  assert.deepEqual(
    entries.map(c => c.dataset.assetId),
    ['aria', 'aria-mini', 'cat'],
  );
  assert.ok(entries.every(c => !('style' in c.dataset) && !('entryKey' in c.dataset)));
  assert.equal(nodes.get('shelf').querySelectorAll('.asset-style').length, 0);
  nodes.get('invite-search').value = 'Mini';
  invite.renderShelf();
  assert.deepEqual(
    nodes
      .get('shelf')
      .querySelectorAll('.asset-card')
      .map(c => c.dataset.assetId),
    ['aria-mini'],
  );
});

test('ordinary invitations number copies within each independent catalog identity', async t => {
  page(t);
  const calls = [];
  globalThis.playPets.addPet = async (...args) => {
    calls.push(args);
    return { ok: true, data: { id: 'new' } };
  };
  globalThis.playPets.updatePet = async () => assert.fail('invitation must not need a second save');
  setData({
    assets: [
      { id: 'aria', displayName: 'Aria' },
      { id: 'aria-mini', displayName: 'Aria Mini' },
    ],
    pets: [
      { id: 'first', assetId: 'aria', visualStyle: 'realistic' },
      { id: 'mini', assetId: 'aria-mini', visualStyle: 'illustrated' },
    ],
  });
  invite.setupInvite({ refresh: async () => {} });
  await invite.invite('aria');
  assert.deepEqual(calls, [['aria', { visualStyle: 'illustrated', name: 'Aria 2' }]]);
  await invite.invite('aria-mini');
  assert.deepEqual(calls[1], ['aria-mini', { visualStyle: 'illustrated', name: 'Aria Mini 2' }]);
  globalThis.playPets.addPet = async () => ({ ok: false, error: 'Could not save appearance.' });
  await assert.rejects(invite.invite('aria', 'realistic'), /Could not save appearance/);
  const { selected } = await import('../src/core/state.js');
  assert.equal(selected, 'new', 'failed creation does not select a missing friend');
  const normalized = [];
  globalThis.playPets.addPet = async (...args) => {
    normalized.push(args);
    return { ok: true, data: { id: 'cat-new' } };
  };
  setData({ assets: [{ id: 'cat', displayName: 'Cat' }], pets: [] });
  await invite.invite('cat', 'realistic');
  assert.deepEqual(normalized, [['cat', { visualStyle: 'illustrated' }]]);
});

test('a pending shelf entry rejects repeated clicks without locking another pet', async t => {
  const nodes = page(t);
  setData({
    assets: [
      { id: 'busy', place: 'builtin', displayName: 'Busy' },
      { id: 'other', place: 'builtin', displayName: 'Other' },
    ],
    pets: [],
  });
  invite.setupInvite({ refresh: async () => {} });
  let resolve;
  let count = 0;
  globalThis.playPets.addPet = () => {
    count++;
    return new Promise(done => {
      resolve = done;
    });
  };
  invite.renderShelf();
  const card = nodes.get('shelf').querySelectorAll('.asset-card')[0];
  const pending = card.onclick();
  assert.equal(card.getAttribute('aria-busy'), 'true');
  assert.equal(nodes.get('shelf').querySelectorAll('.asset-card')[1].disabled, false);
  const { data } = await import('../src/core/state.js');
  setData({ ...data, pets: [{ id: 'incoming', assetId: 'busy' }] });
  invite.renderShelf();
  assert.equal(card.disabled, true, 'a native state event does not unlock the pending card');
  await card.onclick();
  assert.equal(count, 1);
  resolve({ ok: true, data: { id: 'busy-new' } });
  await pending;
  assert.equal(card.disabled, false);
  assert.equal(card.getAttribute('aria-busy'), 'false');
  assert(
    nodes
      .get('shelf')
      .querySelectorAll('.asset-style')
      .every(b => !b.disabled),
  );
});

test('Settings wiring leaves Invite chips functional and still copies actual agent connections', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const nodes = page(context);
  copies.length = 0;
  globalThis.Option = class {};
  const chips = ['', 'person', 'animal', 'other'].map(kind => ({ dataset: { kind }, setAttribute() {} }));
  const agent = { dataset: { kind: 'codex' } };
  document.querySelectorAll = selector =>
    selector === '#kind-filter .chip'
      ? chips
      : selector === 'button[data-kind]'
        ? [...chips, agent]
        : selector === '#panel-settings button[data-kind]'
          ? [agent]
          : [];
  document.querySelector = () => chips[0];
  setData({
    assets: [
      { id: 'person', place: 'builtin', kind: 'person', displayName: 'Explorer' },
      { id: 'cat', place: 'builtin', kind: 'animal', displayName: 'Cat' },
    ],
    pets: [],
  });
  invite.setupInvite({ refresh: async () => {} });
  setupSettings();
  await chips[1].onclick();
  assert.deepEqual(
    nodes
      .get('shelf')
      .querySelectorAll('.asset-card')
      .map(c => c.dataset.assetId),
    ['person'],
  );
  await chips[0].onclick();
  assert.equal(nodes.get('shelf').querySelectorAll('.asset-card').length, 2);
  assert.deepEqual(copies, [], 'type filters never call the agent bridge');
  await agent.onclick();
  assert.deepEqual(copies, ['codex']);
});

test('discovery starts collapsed and reflects current registry order and removal when reopened', t => {
  page(t);
  const get = id => document.getElementById(id);
  get('import-form').reset = () => {};
  get('import-dialog').showModal = () => {};
  get('import-url').focus = () => {};
  invite.setupInvite({ refresh: async () => {} });
  setData({
    communities: [
      { id: 'browse', name: 'Browse site', url: 'https://example.org', importable: false },
      { id: 'known', name: 'Pet site', url: 'https://example.com', importable: true },
    ],
  });
  get('import').onclick();
  assert.equal(get('community-discovery').open, false);
  assert.equal(get('community-discovery').hidden, false);
  assert.deepEqual(
    get('community-links').children.map(row => row.dataset.communityId),
    ['browse', 'known'],
  );
  assert.match(get('community-links').children[0].children[0].textContent, /Browse site/);
  get('community-discovery').open = true;
  setData({ communities: [{ id: 'known', name: 'Pet site', url: 'https://example.com', importable: true }] });
  get('import').onclick();
  assert.equal(get('community-discovery').open, false);
  assert.deepEqual(
    get('community-links').children.map(row => row.dataset.communityId),
    ['known'],
  );
  setData({ communities: [] });
  get('import').onclick();
  assert.equal(get('community-discovery').hidden, true);
  assert.equal(get('community-links').children.length, 0);
});

test('a folded search still says that the visible shelf is filtered', t => {
  const nodes = page(t);
  setData({ assets: [{ id: 'cat', place: 'builtin', displayName: 'Clover' }], pets: [] });
  nodes.get('invite-search').value = 'Clover';
  invite.renderShelf();
  const label = document.getElementById('invite-filter-label');
  assert.equal(label.getAttribute('data-i18n'), 'invite.filter_active');
  nodes.get('invite-search').value = '';
  invite.renderShelf();
  assert.equal(label.getAttribute('data-i18n'), 'invite.filter');
});

test('only pets brought in by hand can be removed, and not while a friend made from them is in the yard', async t => {
  // The notices' own timers would outlive the test.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const nodes = page(t);
  const { setupConfirm } = await import('../src/core/confirm.js');
  setupConfirm();
  const removed = [];
  globalThis.playPets.removeAsset = async id => {
    removed.push(id);
    return { ok: true, data: null };
  };
  setData({
    assets: [
      { id: 'starter', place: 'builtin', displayName: 'Starter' },
      { id: 'codex', place: 'codex', displayName: 'Codex' },
      { id: 'saved', place: 'downloaded', displayName: 'Saved' },
      { id: 'picked', place: 'folder', displayName: 'Picked', folderPath: '/Users/me/pets/picked' },
    ],
    pets: [{ id: 'friend', assetId: 'saved', name: 'Mossy' }],
  });
  invite.setupInvite({ refresh: async () => {} });
  invite.renderShelf();
  const buttons = nodes.get('shelf').querySelectorAll('.asset-remove');
  assert.deepEqual(
    buttons.map(b => b.dataset.assetId),
    ['saved', 'picked'],
  );
  const [saved, picked] = buttons;
  assert.match(saved.getAttribute('aria-label'), /Saved/);
  // A friend made from the pet is named, and nothing is asked or removed.
  await saved.onclick();
  assert.ok(!nodes.get('confirm-dialog').open);
  assert.match(nodes.get('toast').textContent, /Mossy/);
  assert.deepEqual(removed, []);
  // A picked folder is only taken off the list, which the question says before anything goes.
  const asked = picked.onclick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(nodes.get('confirm-dialog').open, true);
  assert.match(nodes.get('confirm-body').textContent, /picked/);
  assert.deepEqual(removed, [], 'nothing is removed before the answer');
  nodes.get('confirm-ok').onclick();
  await asked;
  assert.deepEqual(removed, ['picked']);
});

test('a pet on its way into the yard cannot be removed meanwhile', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const nodes = page(t);
  let arrive;
  globalThis.playPets.addPet = () => new Promise(resolve => (arrive = resolve));
  setData({ assets: [{ id: 'saved', place: 'downloaded', displayName: 'Saved' }], pets: [] });
  invite.setupInvite({ refresh: async () => {} });
  invite.renderShelf();
  const card = () => nodes.get('shelf').querySelectorAll('.asset-card')[0];
  const remove = () => nodes.get('shelf').querySelectorAll('.asset-remove')[0];
  assert.equal(remove().disabled, false);
  const inviting = card().onclick();
  assert.equal(remove().disabled, true);
  arrive({ ok: true, data: { id: 'friend' } });
  await inviting;
  assert.equal(remove().disabled, false);
});

test('a ZIP import brings the pet in like a folder, and a cancelled pick changes nothing', async t => {
  // The notices' own timers would outlive the test.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const nodes = page(t);
  const added = [];
  let picked = null;
  globalThis.playPets.importZip = async () => ({ ok: true, data: picked });
  globalThis.playPets.addPet = async (...args) => {
    added.push(args);
    return { ok: true, data: { id: 'zipped-friend' } };
  };
  setData({ assets: [{ id: 'zipped', place: 'downloaded', displayName: 'Zipped' }], pets: [] });
  invite.setupInvite({ refresh: async () => {} });
  nodes.get('import-dialog').showModal();
  await nodes.get('import-zip').onclick();
  assert.deepEqual(added, [], 'no file picked');
  assert.equal(nodes.get('import-dialog').open, true);
  picked = 'zipped';
  await nodes.get('import-zip').onclick();
  assert.deepEqual(added, [['zipped', { visualStyle: 'illustrated' }]]);
  assert.equal(nodes.get('import-dialog').open, false);
});
