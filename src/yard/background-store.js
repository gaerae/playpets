// Imported backgrounds live in the data folder (the backend's `backgrounds`). Before 1.4.0 the
// page kept them in the webview's own storage: each moves over once, and leaves that storage only
// after the data folder holds it. One that could not move is still shown from there.
import { call, data, ownsWebview } from '../core/state.js';
import { backgroundWorld, validateBackgroundPack } from './background-pack.js';
import { worlds } from './worlds.js';

const isCustom = id => typeof id === 'string' && id.startsWith('custom-');

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
// The webview's old copies; none when that storage is missing or cannot open.
async function oldRows() {
  if (typeof indexedDB === 'undefined') return [];
  try {
    return (await transaction('readonly', store => store.getAll())).filter(row => isCustom(row?.id));
  } catch {
    return [];
  }
}
// Another data folder copies the old rows and leaves them to the installed app (ownsWebview, state.js).
async function forgetOld(id) {
  if (typeof indexedDB === 'undefined' || !ownsWebview()) return;
  try {
    await transaction('readwrite', store => store.delete(id));
  } catch {
    /* Left behind, it is read again at the next start and found already moved. */
  }
}
export async function restoreBackgrounds() {
  // Unread, the data folder holds nothing as far as this start knows; the old copies still show.
  const saved = await call('listBackgrounds').catch(() => []);
  const rows = new Map(saved.map(row => [row.id, row]));
  // Another data folder copies the installed app's once, before it keeps any: one removed here
  // later is not copied back from the copy it left.
  const copied = !ownsWebview() && data.hasBackgroundsFolder;
  for (const row of copied ? [] : await oldRows()) {
    if (!rows.has(row.id)) {
      rows.set(row.id, row);
      try {
        await call('saveBackground', row.id, row.pack);
      } catch {
        continue;
      }
    }
    await forgetOld(row.id);
  }
  for (const row of rows.values()) {
    try {
      if (isCustom(row.id)) worlds.push(backgroundWorld(validateBackgroundPack(row.pack), row.id));
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
  await call('saveBackground', id, pack);
  worlds.push(backgroundWorld(pack, id));
  return id;
}
export async function removeBackground(id) {
  if (!worlds.some(world => world.id === id && world.custom)) return;
  // A copy that never moved would bring it back at the next start, so it goes first.
  await forgetOld(id);
  await call('removeBackground', id);
  const index = worlds.findIndex(world => world.id === id);
  if (index >= 0) worlds.splice(index, 1);
}
