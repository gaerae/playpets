// What the yard keeps to itself (pets/album.rs SECRETS has the same list). Each is kept in the
// album once found, in a book that shows nothing until then, and told of once, on a card.
import { t } from '../core/i18n.js';
import { call } from '../core/state.js';
import { showCard } from './card.js';

// Each drawing sits on the same night-blue seal, so the book reads as one set; a faint rim keeps it
// apart from a dark page.
const seal = inner =>
  `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#33406e" stroke="#fff3d6" stroke-opacity=".3" stroke-width=".8"/>${inner}</svg>`;
const star = (x, y, r, fill) =>
  `<path d="M${x} ${y - r}l${r * 0.3} ${r * 0.7} ${r * 0.7} ${r * 0.3}-${r * 0.7} ${r * 0.3}L${x} ${y + r}l-${r * 0.3}-${r * 0.7}-${r * 0.7}-${r * 0.3} ${r * 0.7}-${r * 0.3}z" fill="${fill}"/>`;
const rays = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4,
    [c, s] = [Math.cos(a), Math.sin(a)],
    at = r => `${(20 + c * r).toFixed(1)} ${(20 + s * r).toFixed(1)}`;
  return `<path d="M${at(6.5)}L${at(12.5)}" stroke="${i % 2 ? '#ffd27a' : '#ff9db0'}" stroke-width="2" stroke-linecap="round"/><circle cx="${(20 + c * 15).toFixed(1)}" cy="${(20 + s * 15).toFixed(1)}" r="1" fill="#fff3d6"/>`;
}).join('');

export const SECRETS = [
  {
    id: 'wish',
    svg: seal(
      `<path d="M15.5 8.5a7 7 0 1 0 6 10.6 5.6 5.6 0 0 1-6-10.6z" fill="#fff3d6"/><path d="M17 17L30.1 25.7 26.9 29.3z" fill="#ffd27a" opacity=".45"/><path d="M21.5 21.3L29.4 26.5 27.6 28.5z" fill="#ffe7b0" opacity=".8"/><circle cx="20.3" cy="23.6" r=".8" fill="#fff3d6"/><circle cx="24.2" cy="19.6" r=".6" fill="#fff3d6"/>${star(28.5, 27.5, 5, '#ffd27a')}${star(30, 12, 1.6, '#fff3d6')}${star(11, 28, 1.3, '#fff3d6')}`,
    ),
  },
  {
    id: 'dizzy',
    svg: seal(
      `<path d="M19 21a1 1 0 0 1 2 0a2 2 0 0 1-4 0a3 3 0 0 1 6 0a4 4 0 0 1-8 0a5 5 0 0 1 10 0a6 6 0 0 1-12 0" fill="none" stroke="#fff3d6" stroke-width="1.8" stroke-linecap="round"/>${star(10, 11, 3, '#ffd27a')}${star(30.5, 10.5, 2.4, '#ff9db0')}${star(31, 29, 2.8, '#ffd27a')}`,
    ),
  },
  {
    id: 'fireworks',
    svg: seal(
      `${rays}<path d="M20 23.6c-3-2.1-4.6-3.6-4.6-5.3a2.3 2.3 0 0 1 4.6-.9 2.3 2.3 0 0 1 4.6.9c0 1.7-1.6 3.2-4.6 5.3z" fill="#ff9db0"/>`,
    ),
  },
];

/** Keeps a secret found and, the first time, says so on a card `after` ms on, once its moment has
 * played out. */
export async function discover(id, after = 0, show = showCard) {
  const kind = SECRETS.find(s => s.id === id);
  if (!kind) return;
  // How many are found comes from the backend: two moments close together may both end before the
  // page hears of the first.
  const found = await call('foundSecret', id).catch(() => null);
  if (!found?.first) return;
  const more = found.found > 1;
  // What was done is the detail; that it was a secret is the news, which a narrow yard still shows.
  setTimeout(
    () =>
      show(
        kind.svg,
        t(`secret.${id}`),
        t(`secret.${id}_note`),
        t(more ? 'secret.found_more' : 'secret.found'),
        'secret',
      ),
    after,
  );
}
