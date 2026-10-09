// The first thing an empty yard shows: the starter pets, moving, one press away from the yard.
// The one under the pointer waves.
import { t } from '../core/i18n.js';
import { canvas, drawSprite } from '../core/sprites.js';
import { $, data, guard } from '../core/state.js';

// invite(assetId) brings a friend into the yard; more() opens the Invite tab. Handed in by app.js.
let on = { invite: async () => {}, more() {} };
let shownKey = '';
let picks = [];
// The starter pets that come with the app, or else the first pet files found; three at most.
function starters() {
  const builtin = data.assets.filter(a => a.place === 'builtin');
  return (builtin.length ? builtin : data.assets).slice(0, 3);
}
function pick(asset) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'starter';
  button.setAttribute('aria-label', t('welcome.pick_aria', { name: asset.displayName }));
  const sprite = canvas(),
    name = document.createElement('span');
  name.textContent = asset.displayName;
  button.append(sprite, name);
  const view = { asset, sprite, waving: 0 };
  button.onpointerenter = () => (view.waving = performance.now());
  button.onpointerleave = () => (view.waving = 0);
  button.onclick = guard(async () => {
    button.disabled = true;
    try {
      await on.invite(asset.id);
    } finally {
      button.disabled = false;
    }
  });
  return { button, view };
}
export function renderWelcome() {
  const list = starters(),
    key = list.map(a => a.id).join('|');
  if (key === shownKey) return;
  shownKey = key;
  const made = list.map(pick);
  picks = made.map(m => m.view);
  $('starter-picks').replaceChildren(...made.map(m => m.button));
  $('starter-picks').hidden = !list.length;
}
// Called by the frame loop while the welcome shows.
export function drawWelcome(now) {
  for (const p of picks) drawSprite(p.sprite, p.asset, p.waving ? 'wave' : 'idle', p.waving ? now - p.waving : now);
}
// Called once, by app.js.
export function setupWelcome(handlers) {
  on = handlers;
  $('welcome-more').onclick = () => on.more();
}
