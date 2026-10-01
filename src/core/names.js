// What a friend is called, the same way in the yard and on the desktop: its own name, else the
// pet file's, else a word for "friend" in the current language.
export const displayName = (pet, asset, fallback) => pet?.name || asset?.displayName || fallback;
