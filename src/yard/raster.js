// What the weather and the small life on the scenery canvas share for their pictures: a canvas where
// there is a page, small materials drawn once and kept, and artwork decoded once however often it
// is asked for. (easel.js loads its backdrops its own way: it keeps only the picture on the wall.)

/** A new canvas, or null where there is no page (as in a test). */
export const canvasFor = () => (typeof document === 'undefined' ? null : document.createElement('canvas'));

/** Materials of 64 by 64 pixels, each drawn once under its key; one that cannot be drawn (no
 * canvas, no context) is kept as null, so it is not tried again every frame. */
export function materialCache(makeCanvas = canvasFor) {
  const materials = new Map();
  return {
    /** The material for `key`, drawn now by `draw(ctx)` if it is new. */
    material(key, draw) {
      if (materials.has(key)) return materials.get(key);
      const canvas = makeCanvas();
      if (canvas) canvas.width = canvas.height = 64;
      const ctx = canvas?.getContext('2d');
      if (!ctx) {
        materials.set(key, null);
        return null;
      }
      draw(ctx);
      materials.set(key, canvas);
      return canvas;
    },
    /** The material drawn for `key` (null if it could not be, undefined if never asked for). */
    get: key => materials.get(key),
  };
}

// Each picture's decoding, by its address: started once, shared by everyone who asks.
const decoding = new Map();
/** The picture at `path` (relative to this folder) once decoded, or null where there is no page
 * or it cannot be decoded. */
export function decodeImage(path) {
  if (typeof Image === 'undefined') return Promise.resolve(null);
  const href = new URL(path, import.meta.url).href;
  if (!decoding.has(href)) {
    const image = new Image();
    image.src = href;
    decoding.set(
      href,
      image
        .decode()
        .then(() => image)
        .catch(() => null),
    );
  }
  return decoding.get(href);
}
