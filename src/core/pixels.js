// WebKit lets go of a big image's decoded pixels while the image itself is not on screen, and then
// decodes the whole sheet again for each cell drawn from it: 4.5 ms a cell in the yard, against
// 0.04 ms from an ImageBitmap, which keeps its pixels. A sheet that is in is drawn from one bitmap
// of it, made at once; until then, and where there is none, from the image itself.
// In a desktop window that has just opened, WebKit can make an empty bitmap of a sheet loaded but
// not yet decoded, so a bitmap that reads empty is dropped and one more is made once decode()
// settles. decode() is not waited on for every sheet: in the yard WebKit then drew the starter pets
// and the friends' own clips as nothing.
export function pixels(image) {
  if (image._bitmap) return image._bitmap;
  if (
    !image._bitmapAsked &&
    image.complete &&
    image.naturalWidth &&
    typeof globalThis.createImageBitmap === 'function'
  ) {
    image._bitmapAsked = true;
    makeBitmap(image, true);
  }
  return image;
}
function makeBitmap(image, again) {
  globalThis.createImageBitmap(image).then(
    bitmap => {
      if (image._letGo) return bitmap.close();
      if (filled(bitmap)) {
        image._bitmap = bitmap;
        return;
      }
      bitmap.close();
      if (again && image.decode)
        image.decode().then(
          () => image._letGo || makeBitmap(image, false),
          () => {},
        );
    },
    () => {},
  );
}
// Whether `bitmap` has any pixel drawn, read from a small copy of it; true where it cannot be read.
function filled(bitmap) {
  try {
    const surface = globalThis.OffscreenCanvas
      ? new globalThis.OffscreenCanvas(96, 144)
      : Object.assign(globalThis.document.createElement('canvas'), { width: 96, height: 144 });
    const ctx = surface.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, 96, 144);
    const data = ctx.getImageData(0, 0, 96, 144).data;
    for (let i = 3; i < data.length; i += 4) if (data[i]) return true;
    return false;
  } catch {
    return true;
  }
}
/** Frees the bitmap of `image` (pixels), now or as soon as it is made: its sheet is no longer drawn. */
export function letGo(image) {
  if (!image) return;
  image._letGo = true;
  image._bitmap?.close?.();
  image._bitmap = null;
}
