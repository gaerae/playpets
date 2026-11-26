// The yard's drawings (src/art/): each SVG file becomes a symbol in the page's sprite (#art in
// index.html) once at start, so a plant, a gift or a flower is drawn with <use> and takes the
// yard's colours. A drawing paints with the stylesheet's colours (fill:var(--leaf), --wood,
// --sky-a…), so the season, the light and the weather colour it with no code; the list
// of those names is in docs/how-to/add-to-the-yard.md. The shipped drawings wrap painted PNG
// atlases instead and take none of them. A drawing's view box is its size in the yard.

const NS = 'http://www.w3.org/2000/svg';
const sizes = new Map(),
  // How each drawing sets its crop in its box (a tree stands on the box's floor).
  aligns = new Map();
const idOf = path => `art-${path.replace(/\.svg$/, '').replace(/[^a-z0-9]+/gi, '-')}`;

// A drawing is data: nothing in it runs.
function inert(node) {
  for (const el of node.querySelectorAll('script, foreignObject')) el.remove();
  for (const el of [node, ...node.querySelectorAll('*')]) {
    // Snapshot the live attributes: removing one otherwise skips the next handler.
    for (const attr of Array.from(el.attributes)) if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
  }
  return node;
}

/** Loads the drawings at these paths (under src/art/) into the sprite. */
export async function loadArt(paths, base = 'art/') {
  const defs = document.querySelector('#art defs'),
    unique = [...new Set(paths)].filter(p => !sizes.has(p));
  const texts = await Promise.all(
    unique.map(p =>
      fetch(base + p)
        .then(r => (r.ok ? r.text() : ''))
        .catch(() => ''),
    ),
  );
  for (const [i, text] of texts.entries()) {
    const svg = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
    if (svg?.nodeName !== 'svg') continue;
    const box = svg.getAttribute('viewBox') || '0 0 40 40',
      symbol = document.createElementNS(NS, 'symbol');
    symbol.id = idOf(unique[i]);
    symbol.setAttribute('viewBox', box);
    symbol.append(...[...inert(svg).childNodes].map(n => document.importNode(n, true)));
    defs.append(symbol);
    aligns.set(unique[i], svg.querySelector?.('svg')?.getAttribute('preserveAspectRatio') || 'xMidYMid meet');
    sizes.set(
      unique[i],
      box
        .trim()
        .split(/[\s,]+/)
        .map(Number)
        .slice(2),
    );
  }
}
/** A drawing's size (its view box's width and height). */
export const artSize = path => sizes.get(path) || [40, 40];
/** The reference <use> takes for a drawing. */
export const artHref = path => `#${idOf(path)}`;
/** A drawing as an inline SVG, with extra attributes (`class="…" style="…"`). */
export function artSvg(path, attrs = '') {
  const [w, h] = artSize(path);
  return `<svg viewBox="0 0 ${w} ${h}" ${attrs} aria-hidden="true"><use href="${artHref(path)}"/></svg>`;
}
/** Where a drawing's album preview is: a small crop of its sheet that scripts/art-webp.mjs makes
 * for each drawing an album card shows (albumArt in catalog.js). */
const previewHref = path => `art/album/${path.replace(/\.svg$/, '.webp')}`;
/** A drawing from its small preview, set in its box as the drawing sets its crop: for a card, where
 * decoding the whole painted sheet would cost more than the card shows. */
export function previewSvg(path, attrs = '') {
  const [w, h] = artSize(path);
  return `<svg viewBox="0 0 ${w} ${h}" data-art="${path}" ${attrs} aria-hidden="true"><image href="${previewHref(path)}" width="${w}" height="${h}" preserveAspectRatio="${aligns.get(path) || 'xMidYMid meet'}"/></svg>`;
}
// The sheets decoded so far: a drawing on one of them is drawn sharp with no blurred frame first.
// One still decoding is asked for once, however often the left page is drawn meanwhile (each press
// and each push of the state redraws it); one that failed is tried again next time.
const decodedSheets = new Set(),
  decoding = new Map();
const decodeSheet = href => {
  if (!decoding.has(href)) {
    const image = new Image();
    image.src = href;
    decoding.set(
      href,
      image.decode().then(
        () => decodedSheets.add(href),
        error => {
          decoding.delete(href);
          throw error;
        },
      ),
    );
  }
  return decoding.get(href);
};
/** The previews in `root` drawn larger than a card (the album's left page) become their drawings
 * once the painted sheets they were cut from are decoded: a preview is cut for a card, and drawn
 * two to three times that size it blurs. Until then, or if a sheet does not decode, it stays. */
export function sharpen(root) {
  for (const svg of root.querySelectorAll('svg[data-art]')) {
    const symbol = document.getElementById(idOf(svg.dataset.art)),
      sheets = [...(symbol?.querySelectorAll('image') || [])].map(image => image.getAttribute('href'));
    if (!sheets.length) continue;
    const swap = () => {
      const use = document.createElementNS(NS, 'use');
      use.setAttribute('href', artHref(svg.dataset.art));
      svg.replaceChildren(use);
    };
    if (sheets.every(href => decodedSheets.has(href))) swap();
    else
      Promise.all(sheets.filter(href => !decodedSheets.has(href)).map(decodeSheet)).then(
        () => svg.isConnected && swap(),
        () => {},
      );
  }
}
/** The custom properties that colour a drawing (a flower's petals), as a style attribute's value. */
export const colorStyle = colors =>
  Object.entries(colors || {})
    .map(([name, value]) => `--${name}:${value}`)
    .join(';');
