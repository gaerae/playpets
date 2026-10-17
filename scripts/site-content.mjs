// One inventory for public pet previews and locale-dependent publishing paths.
export const SITE_LANGS = Object.freeze(['en', 'ko', 'ja', 'zh-hans']);

export function localePath(lang, page) {
  if (!SITE_LANGS.includes(lang)) throw new Error(`Unknown website locale: ${lang}`);
  return `${lang === 'en' ? '' : `/${lang}`}${page.startsWith('/') ? page : `/${page}`}`;
}

export const releasePagesFor = version =>
  SITE_LANGS.map(lang => `website${localePath(lang, `/releases/${version}.md`)}`);

export const LANDING_PETS = Object.freeze([
  { id: 'daisy', displayName: 'Daisy', source: 'assets/pets/daisy/spritesheet.png', kit: 'daisy' },
  { id: 'clover', displayName: 'Clover', source: 'assets/pets/clover/spritesheet.png', kit: 'clover' },
  { id: 'pip', displayName: 'Pip', source: 'assets/pets/pip/spritesheet.png', kit: 'pip' },
  { id: 'miso', displayName: 'Miso', source: 'assets/pets/miso/spritesheet.png', kit: 'miso' },
]);
