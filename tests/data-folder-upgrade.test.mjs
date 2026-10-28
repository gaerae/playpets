// An upgrade from a version that kept imported backgrounds and the place picked in the webview's
// own storage: both move into the data folder, and the old copies go only once it holds them.
import assert from 'node:assert/strict';
import test from 'node:test';
import { installStorage, keepGlobals } from './support/dom.mjs';

globalThis.playPets = {};
const { setData } = await import('../src/core/state.js');
const { restoreBackgrounds, removeBackground } = await import('../src/yard/background-store.js');
const { keepScene, moveOldScene, savedScene } = await import('../src/yard/sky.js');
const { worlds } = await import('../src/yard/worlds.js');

const header = Buffer.alloc(33);
Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(header);
header.writeUInt32BE(13, 8);
header.write('IHDR', 12);
header.writeUInt32BE(1536, 16);
header.writeUInt32BE(1024, 20);
header[24] = 8;
header[25] = 6;
const pack = name => ({
  format: 'playpets-background',
  version: 1,
  name,
  images: { base: `data:image/png;base64,${header.toString('base64')}` },
  floor: 0.66,
  sky: true,
  weather: true,
  ambient: false,
});
const LAKE = 'custom-0b6f2c1e-8d4a-4f1b-9c3e-2a7d5e6f8a90',
  ATTIC = 'custom-f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5b',
  KEPT = 'custom-11111111-2222-4333-8444-555555555555';

// IndexedDB as the page uses it: one store, getAll and delete, each in a transaction.
function fakeIndexedDB(rows) {
  const store = new Map(rows.map(row => [row.id, row]));
  const db = {
    close() {},
    transaction() {
      const tx = {};
      const request = value => ({ result: value });
      tx.objectStore = () => ({
        getAll: () => request([...store.values()]),
        delete: id => request(store.delete(id) && undefined),
      });
      queueMicrotask(() => tx.oncomplete?.());
      return tx;
    },
  };
  return {
    store,
    open() {
      const opening = {};
      queueMicrotask(() => {
        opening.result = db;
        opening.onsuccess?.();
      });
      return opening;
    },
  };
}
function backend({ saved = [], refuse = () => false } = {}) {
  const files = new Map(saved.map(row => [row.id, row]));
  const scene = {};
  Object.assign(globalThis.playPets, {
    listBackgrounds: async () => ({ ok: true, data: [...files.values()] }),
    saveBackground: async (id, p) => {
      if (refuse(id)) return { ok: false, error: 'disk full' };
      files.set(id, { id, pack: p });
      return { ok: true, data: null };
    },
    removeBackground: async id => {
      files.delete(id);
      return { ok: true, data: null };
    },
    setScene: async (key, value) => {
      if (refuse(key)) return { ok: false, error: 'disk full' };
      scene[key] = value;
      return { ok: true, data: null };
    },
  });
  return { files, scene };
}
function freshWorlds(t) {
  const before = worlds.splice(0);
  t.after(() => worlds.splice(0, worlds.length, ...before));
}

test("an older version's backgrounds move into the data folder and leave the webview after", async t => {
  keepGlobals(t, 'indexedDB');
  freshWorlds(t);
  const old = fakeIndexedDB([
    { id: LAKE, pack: pack('Lake') },
    { id: ATTIC, pack: pack('Attic') },
    { id: KEPT, pack: pack('Kept') },
  ]);
  globalThis.indexedDB = old;
  // Kept was moved at an earlier start whose clean-up did not finish; Attic cannot be written now.
  const { files } = backend({ saved: [{ id: KEPT, pack: pack('Kept') }], refuse: id => id === ATTIC });
  await restoreBackgrounds();
  assert.deepEqual([...files.keys()].sort(), [KEPT, LAKE].sort());
  assert.deepEqual([...old.store.keys()], [ATTIC], 'only what the data folder holds leaves the webview');
  assert.deepEqual(
    worlds.map(w => w.name).sort(),
    ['Attic', 'Kept', 'Lake'],
    'one that could not move is still shown from where it was',
  );
  // Removed, it goes from both places, so the old copy cannot bring it back.
  await removeBackground(ATTIC);
  assert.equal(old.store.size, 0);
  assert.ok(!worlds.some(w => w.id === ATTIC));
});

test("with the data folder unreadable, the webview's old copies are still shown", async t => {
  keepGlobals(t, 'indexedDB');
  freshWorlds(t);
  globalThis.indexedDB = fakeIndexedDB([{ id: LAKE, pack: pack('Lake') }]);
  backend();
  globalThis.playPets.listBackgrounds = async () => ({ ok: false, error: 'unreadable' });
  await restoreBackgrounds();
  assert.deepEqual(
    worlds.map(w => w.name),
    ['Lake'],
  );
});

test('a removed background leaves the webview before the data folder, so a stop between cannot bring it back', async t => {
  keepGlobals(t, 'indexedDB');
  freshWorlds(t);
  const old = fakeIndexedDB([{ id: LAKE, pack: pack('Lake') }]);
  globalThis.indexedDB = old;
  const { files } = backend({ saved: [{ id: LAKE, pack: pack('Lake') }], refuse: id => id === LAKE });
  await restoreBackgrounds();
  let oldLeft;
  globalThis.playPets.removeBackground = async id => {
    oldLeft = old.store.has(id);
    files.delete(id);
    return { ok: true, data: null };
  };
  old.store.set(LAKE, { id: LAKE, pack: pack('Lake') });
  await removeBackground(LAKE);
  assert.equal(oldLeft, false);
});

test('with no old storage the backgrounds come from the data folder alone', async t => {
  keepGlobals(t, 'indexedDB');
  freshWorlds(t);
  delete globalThis.indexedDB;
  backend({
    saved: [
      { id: LAKE, pack: pack('Lake') },
      { id: 'woodland', pack: pack('Not ours') },
    ],
  });
  await restoreBackgrounds();
  assert.deepEqual(
    worlds.map(w => w.id),
    [LAKE],
  );
});

test("an older version's place and weather move into the app's state and leave the webview after", async t => {
  const storage = installStorage(t);
  storage.setItem('world', 'courtyard');
  storage.setItem('season', 'winter');
  storage.setItem('weather', 'snow');
  setData({ scene: { weather: 'rain' } });
  t.after(() => setData({ pets: [], assets: [], providers: [], statuses: {}, busy: [] }));
  const { scene } = backend({ refuse: key => key === 'season' });
  // What the webview still holds is newer than the app's: an older version wrote it, or the app
  // could not save it. It wins, and the app's own choice fills in the rest.
  assert.deepEqual(savedScene(), { world: 'courtyard', weather: 'snow', period: undefined, season: 'winter' });
  await moveOldScene();
  assert.deepEqual(scene, { world: 'courtyard', weather: 'snow' });
  assert.equal(storage.getItem('world'), null);
  assert.equal(storage.getItem('weather'), null);
  assert.equal(storage.getItem('season'), 'winter', 'not saved by the app, it stays where it was');
  setData({ scene: { ...scene } });
  assert.equal(savedScene().season, 'winter', 'and is still the one shown at the next start');
  // A new choice the app cannot save is still kept in the webview for the next start.
  await keepScene('season', 'spring');
  assert.equal(storage.getItem('season'), 'spring');
  await keepScene('period', 'night');
  assert.equal(scene.period, 'night');
  assert.equal(storage.getItem('period'), null);
});
