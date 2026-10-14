import { backgroundWorld, validateBackgroundPack } from './background-pack.js';
import { worlds } from './worlds.js';

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('playpets-backgrounds', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('packs', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transaction(mode, action) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('packs', mode);
    const request = action(tx.objectStore('packs'));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function restoreBackgrounds() {
  if (typeof indexedDB === 'undefined') return;
  const rows = await transaction('readonly', store => store.getAll());
  for (const row of rows) {
    try {
      if (typeof row.id === 'string' && row.id.startsWith('custom-'))
        worlds.push(backgroundWorld(validateBackgroundPack(row.pack), row.id));
    } catch {
      /* A damaged package does not prevent the built-in yard from opening. */
    }
  }
}
export async function saveBackground(input) {
  const pack = validateBackgroundPack(input);
  // Headers alone cannot establish that a PNG actually decodes.
  for (const url of new Set(Object.values(pack.images))) {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new Error('background.invalid');
    }
    if (img.naturalWidth !== 1536 || img.naturalHeight !== 1024) throw new Error('background.invalid');
  }
  const id = `custom-${crypto.randomUUID()}`;
  await transaction('readwrite', store => store.put({ id, pack }));
  worlds.push(backgroundWorld(pack, id));
  return id;
}
export async function removeBackground(id) {
  if (!worlds.some(world => world.id === id && world.custom)) return;
  await transaction('readwrite', store => store.delete(id));
  const index = worlds.findIndex(world => world.id === id);
  if (index >= 0) worlds.splice(index, 1);
}
