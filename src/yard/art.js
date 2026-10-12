// The yard's drawings (src/art/): each SVG file becomes a symbol in the page's sprite (#art in
// index.html) once at start, so a plant, a gift or a flower is drawn with <use> and takes the
// yard's colours. A drawing paints with the stylesheet's colours (fill:var(--leaf), --wood,
// --sky-a…), so the season, the light and the weather colour it with no code; the list
// of those names is in docs/how-to/add-to-the-yard.md. The shipped drawings wrap painted PNG
// atlases instead and take none of them. A drawing's view box is its size in the yard.

const NS = 'http://www.w3.org/2000/svg';
const sizes = new Map();
const idOf = path => `art-${path.replace(/\.svg$/, '').replace(/[^a-z0-9]+/gi, '-')}`;

// A drawing is data: nothing in it runs.
function inert(node) {
  for (const el of node.querySelectorAll('script, foreignObject')) el.remove();
  for (const el of [node, ...node.querySelectorAll('*')])
    for (const attr of [...el.attributes]) if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
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
/** The custom properties that colour a drawing (a flower's petals), as a style attribute's value. */
export const colorStyle = colors =>
  Object.entries(colors || {})
    .map(([name, value]) => `--${name}:${value}`)
    .join(';');
