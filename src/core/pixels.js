// WebKit lets go of a big image's decoded pixels while the image itself is not on screen, and then
// decodes the whole sheet again for each cell drawn from it: 4.5 ms a cell in the yard, against
// 0.04 ms from an ImageBitmap, which keeps its pixels. A sheet that is in is drawn from one bitmap
// of it, made once the sheet has been drawn from: drawing it decodes it, and a bitmap made from a
// sheet only loaded comes out empty. decode() is not waited on: while it is pending WebKit draws
// the sheet as nothing, and it may never settle. Until then, and where there is none, the sheet is
// drawn from the image itself.
export function pixels(image) {
  if (image._bitmap) return image._bitmap;
  if (
    !image._bitmapAsked &&
    image.complete &&
    image.naturalWidth &&
    typeof globalThis.createImageBitmap === 'function'
  ) {
    if (!image._drawnFrom) {
      image._drawnFrom = true;
      return image;
    }
    image._bitmapAsked = true;
    globalThis.createImageBitmap(image).then(
      bitmap => {
        if (image._letGo) bitmap.close();
        else image._bitmap = bitmap;
      },
      () => {},
    );
  }
  return image;
}
/** Frees the bitmap of `image` (pixels), now or as soon as it is made: its sheet is no longer drawn. */
export function letGo(image) {
  if (!image) return;
  image._letGo = true;
  image._bitmap?.close?.();
  image._bitmap = null;
}
