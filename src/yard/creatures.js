// Drawings of what is in the catalogue, as SVG, in the flat colour and clear edges the friends have.
// A fish or a bug is drawn from its `look` (catalog.json) by the drawer for its shape or kind, or
// from its own drawing when it names one (`art`, under src/art/); flowers and gifts are their
// drawings. One not yet found is a plain silhouette for the album.
import { artSvg, colorStyle } from './art.js';
import { color, css, mix } from './brush.js';
import { flowerKind } from './catalog.js';

const hex = c => css(color(c));
const darker = (c, k = 0.3) => css(mix(color(c), [30, 36, 40, 1], k));
const lighter = (c, k = 0.4) => css(mix(color(c), [255, 255, 255, 1], k));
const SHADOW = '#b7c0c3';

const FISH_SHAPES = {
  round: { rx: 28, ry: 17 },
  normal: { rx: 32, ry: 13 },
  slender: { rx: 34, ry: 9 },
  flat: { rx: 34, ry: 12 },
};

function eel(look, unknown) {
  const body = unknown ? SHADOW : hex(look.body),
    line = unknown ? SHADOW : darker(look.body);
  return `<svg viewBox="0 0 100 50" aria-hidden="true"><path d="M8 30C20 14 34 40 50 26S78 12 90 22" fill="none" stroke="${line}" stroke-width="12" stroke-linecap="round"/><path d="M8 30C20 14 34 40 50 26S78 12 90 22" fill="none" stroke="${body}" stroke-width="9" stroke-linecap="round"/>${
    unknown
      ? ''
      : `<path d="M14 31C24 22 34 40 50 29S76 17 88 24" fill="none" stroke="${hex(look.belly)}" stroke-width="2.5" stroke-linecap="round" opacity=".8"/><circle cx="86" cy="20" r="2" fill="#fff"/><circle cx="86.6" cy="20" r="1.1" fill="#222"/>`
  }</svg>`;
}

/** A fish of the catalogue, facing right. */
export function fishSvg(fish, unknown = false) {
  if (fish.art) return artSvg(fish.art, unknown ? 'class="unknown-art"' : '');
  const look = fish.look;
  if (look.shape === 'eel') return eel(look, unknown);
  const { rx, ry } = FISH_SHAPES[look.shape] || FISH_SHAPES.normal,
    cx = 54,
    cy = 25,
    tail = cx - rx + 4,
    fill = unknown ? SHADOW : hex(look.body),
    fin = unknown ? SHADOW : hex(look.fin),
    edge = unknown ? SHADOW : darker(look.body, 0.35),
    spread = look.fancy ? 1.6 : 1;
  const parts = [
    // tail: forked, and flowing for a fancy one
    `<path d="M${tail} ${cy}L${tail - 16 * spread} ${cy - ry * 0.95 * spread}Q${tail - 9} ${cy} ${tail - 16 * spread} ${cy + ry * 0.95 * spread}Z" fill="${fin}" stroke="${edge}" stroke-width="1.2" stroke-linejoin="round"/>`,
    // fin on the back
    `<path d="M${cx - rx * 0.35} ${cy - ry + 2}Q${cx - rx * 0.05} ${cy - ry - 9} ${cx + rx * 0.3} ${cy - ry + 3}Z" fill="${fin}" stroke="${edge}" stroke-width="1.2" stroke-linejoin="round"/>`,
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${edge}" stroke-width="1.4"/>`,
  ];
  if (!unknown) {
    const id = `b${Math.round(rx)}${Math.round(ry)}`;
    parts.push(
      `<clipPath id="${id}"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/></clipPath>`,
      `<g clip-path="url(#${id})"><ellipse cx="${cx + 2}" cy="${cy + ry * 0.75}" rx="${rx * 0.95}" ry="${ry * 0.6}" fill="${hex(look.belly)}"/>`,
    );
    if (look.stripes)
      parts.push(
        `<rect x="${cx - rx}" y="${cy - 2}" width="${rx * 2}" height="3.2" fill="${hex(look.stripes)}" opacity=".85"/>`,
      );
    if (look.band)
      parts.push(
        `<rect x="${cx - rx}" y="${cy - 1}" width="${rx * 2}" height="4" fill="${hex(look.band)}" opacity=".7"/>`,
      );
    if (look.spots)
      for (const [dx, dy] of [
        [-0.5, -0.45],
        [-0.25, -0.2],
        [0, -0.5],
        [0.2, -0.15],
        [-0.6, 0.05],
        [-0.1, 0.1],
      ])
        parts.push(`<circle cx="${cx + dx * rx}" cy="${cy + dy * ry}" r="1.7" fill="${hex(look.spots)}"/>`);
    if (look.spot)
      parts.push(`<ellipse cx="${cx + rx * 0.25}" cy="${cy - 1}" rx="3.5" ry="2.2" fill="${hex(look.spot)}"/>`);
    parts.push(
      `<path d="M${cx + rx * 0.45} ${cy - ry * 0.75}Q${cx + rx * 0.3} ${cy} ${cx + rx * 0.45} ${cy + ry * 0.75}" fill="none" stroke="${edge}" stroke-width="1.2" opacity=".7"/>`,
      `<ellipse cx="${cx - rx * 0.1}" cy="${cy - ry * 0.45}" rx="${rx * 0.45}" ry="${ry * 0.18}" fill="${lighter(look.body, 0.5)}" opacity=".5"/></g>`,
      // a fin at the side, the eye, whiskers
      `<path d="M${cx + rx * 0.2} ${cy + 2}Q${cx + rx * 0.05} ${cy + ry * 0.7} ${cx - rx * 0.12} ${cy + ry * 0.55}Z" fill="${fin}" stroke="${edge}" stroke-width="1" stroke-linejoin="round"/>`,
      `<circle cx="${cx + rx * 0.66}" cy="${cy - ry * 0.22}" r="2.6" fill="#fff"/><circle cx="${cx + rx * 0.68}" cy="${cy - ry * 0.22}" r="1.5" fill="#222"/>`,
    );
    if (look.whiskers)
      parts.push(
        `<path d="M${cx + rx * 0.9} ${cy + 2}q5 3 9 9M${cx + rx * 0.88} ${cy + 3}q2 4 3 10" fill="none" stroke="${edge}" stroke-width="1.1" stroke-linecap="round"/>`,
      );
  }
  return `<svg viewBox="0 0 100 50" aria-hidden="true">${parts.join('')}</svg>`;
}

function butterfly(look, unknown) {
  const wing = unknown ? SHADOW : hex(look.wing),
    edge = unknown ? SHADOW : hex(look.edge),
    s = look.small ? 0.8 : 1;
  const wingPair = (dir, upper) => {
    const x = 30 + dir * (upper ? 3 : 2),
      tipX = 30 + dir * (upper ? 24 : 18) * s,
      y0 = upper ? 22 : 26,
      tipY = upper ? 6 : 42;
    return `<path d="M${x} ${y0}C${x + dir * 6} ${tipY - (upper ? 6 : -6)} ${tipX} ${tipY - (upper ? 2 : 0)} ${tipX} ${tipY + (upper ? 6 : -6)}C${tipX} ${y0 + (upper ? 4 : -2)} ${x + dir * 8} ${y0 + (upper ? 4 : -2)} ${x} ${y0 + (upper ? 4 : 0)}Z" fill="${wing}" stroke="${edge}" stroke-width="${unknown ? 1 : 2}" stroke-linejoin="round"/>`;
  };
  const parts = [];
  if (look.tails && !unknown)
    parts.push(`<path d="M22 38l-4 9M38 38l4 9" stroke="${edge}" stroke-width="2.2" stroke-linecap="round"/>`);
  parts.push(wingPair(-1, false), wingPair(1, false), wingPair(-1, true), wingPair(1, true));
  if (!unknown) {
    if (look.spots)
      parts.push(
        `<circle cx="18" cy="15" r="2" fill="${hex(look.spots)}"/><circle cx="42" cy="15" r="2" fill="${hex(look.spots)}"/>`,
      );
    if (look.stripes)
      parts.push(
        `<path d="M14 10l6 10M20 8l5 11M46 10l-6 10M40 8l-5 11" stroke="${hex(look.stripes)}" stroke-width="1.8" stroke-linecap="round"/>`,
      );
    if (look.sheen)
      parts.push(
        `<ellipse cx="20" cy="34" rx="4" ry="3" fill="${hex(look.sheen)}"/><ellipse cx="40" cy="34" rx="4" ry="3" fill="${hex(look.sheen)}"/>`,
      );
    if (look.eyes)
      parts.push(
        `<circle cx="16" cy="12" r="3.6" fill="${hex(look.eyes)}" stroke="#f3e2b0" stroke-width="1.2"/><circle cx="44" cy="12" r="3.6" fill="${hex(look.eyes)}" stroke="#f3e2b0" stroke-width="1.2"/>`,
      );
  }
  const body = unknown ? SHADOW : '#3b332c';
  parts.push(
    `<ellipse cx="30" cy="26" rx="2.2" ry="11" fill="${body}"/><path d="M29 16q-4-8-7-10M31 16q4-8 7-10" fill="none" stroke="${body}" stroke-width="1.1" stroke-linecap="round"/>`,
  );
  return parts.join('');
}

function dragonfly(look, unknown) {
  const body = unknown ? SHADOW : hex(look.body),
    wing = unknown ? '#d6dcde' : hex(look.wing),
    vein = unknown ? SHADOW : darker(look.wing, 0.25);
  const wings = [
    [-1, 15],
    [1, 15],
    [-1, 22],
    [1, 22],
  ]
    .map(
      ([dir, y]) =>
        `<ellipse cx="${30 + dir * 14}" cy="${y}" rx="14" ry="3.6" transform="rotate(${dir * (y < 18 ? -8 : 8)} ${30 + dir * 14} ${y})" fill="${wing}" fill-opacity=".85" stroke="${vein}" stroke-width="1"/>`,
    )
    .join('');
  return `${wings}<rect x="28" y="14" width="4" height="32" rx="2" fill="${body}"/><circle cx="30" cy="11" r="4" fill="${body}"/>${
    unknown
      ? ''
      : `<circle cx="28.4" cy="10" r="1.4" fill="#2a2a2a"/><circle cx="31.6" cy="10" r="1.4" fill="#2a2a2a"/>`
  }`;
}

function beetle(look, unknown) {
  const body = unknown ? SHADOW : hex(look.body || look.wing),
    edge = unknown ? SHADOW : hex(look.edge || '#342a22');
  return `<path d="M19 21L11 17M18 28L8 29M20 35L12 41M41 21L49 17M42 28L52 29M40 35L48 41" fill="none" stroke="${edge}" stroke-width="2" stroke-linecap="round"/><ellipse cx="30" cy="28" rx="13" ry="15" fill="${body}" stroke="${edge}" stroke-width="1.5"/><path d="M30 15V42" stroke="${edge}" stroke-width="1.5"/><circle cx="30" cy="12" r="6" fill="${edge}"/>${unknown ? '' : '<g fill="#342a22"><circle cx="24" cy="23" r="2.5"/><circle cx="37" cy="24" r="2.5"/><circle cx="23" cy="33" r="2.5"/><circle cx="36" cy="35" r="2.5"/></g>'}`;
}

function cricket(look, unknown) {
  const body = unknown ? SHADOW : hex(look.body || '#7b9e57'),
    edge = unknown ? SHADOW : hex(look.edge || '#3f5732');
  return `<path d="M24 29L12 18L8 41M36 29L48 18L52 41M26 20L17 14M34 20L43 14M27 12L18 3M33 12L42 3" fill="none" stroke="${edge}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="30" cy="29" rx="6" ry="14" fill="${body}" stroke="${edge}" stroke-width="1.5"/><circle cx="30" cy="13" r="6" fill="${body}"/><path d="M30 21V40" stroke="${edge}" stroke-width="1"/>`;
}

function firefly(look, unknown) {
  const body = unknown ? SHADOW : hex(look.body);
  return `${
    unknown ? '' : `<circle cx="30" cy="34" r="12" fill="${hex(look.glow)}" opacity=".35"/>`
  }<ellipse cx="30" cy="34" rx="5" ry="6" fill="${unknown ? SHADOW : hex(look.glow)}"/><ellipse cx="30" cy="24" rx="7" ry="10" fill="${body}"/><circle cx="30" cy="14" r="4" fill="${unknown ? SHADOW : '#d9573f'}"/><path d="M28 11q-3-5-6-6M32 11q3-5 6-6" fill="none" stroke="${body}" stroke-width="1.1" stroke-linecap="round"/>`;
}

/** A heart with a friendship level in it, for the card that says two friends grew closer. */
export function heartSvg(level) {
  return `<svg viewBox="0 0 60 50" aria-hidden="true"><image href="art/ambient/heart.svg" x="5" y="0" width="50" height="50"/><text x="30" y="30" text-anchor="middle" font-size="15" font-weight="800" fill="#682a42" stroke="#ffe8ee" stroke-width=".7" paint-order="stroke">${level}</text></svg>`;
}

/** A flower in bloom (by its id), from its drawing in its colours. */
export function flowerSvg(id, unknown = false) {
  const flower = flowerKind(id);
  if (!flower) return '';
  return artSvg(
    flower.art,
    `data-flower="${id}" style="${colorStyle(flower.colors)}"${unknown ? ' class="unknown-art"' : ''}`,
  );
}
/** A gift, from its drawing. */
export function giftSvg(gift, unknown = false) {
  return artSvg(gift.art, `class="decor-art${unknown ? ' unknown-art' : ''}"`);
}

// How each kind of bug is drawn; a bug of a kind not here is drawn as a butterfly.
const BUG_DRAWERS = { butterfly, dragonfly, firefly, beetle, cricket };
/** A bug, seen from above. */
export function bugSvg(bug, unknown = false) {
  if (bug.art) return artSvg(bug.art, unknown ? 'class="unknown-art"' : '');
  const draw = BUG_DRAWERS[bug.kind] || butterfly;
  return `<svg viewBox="0 0 60 50" aria-hidden="true">${draw(bug.look, unknown)}</svg>`;
}
