// One inventory for public captures, pet previews and locale-dependent publishing paths.
// Advance only after native captures for the new version exist in every site language.
export const CAPTURE_VERSION = '1.3.0';

export const SITE_LANGS = Object.freeze(['en', 'ko', 'ja', 'zh-hans']);

export function localePath(lang, page) {
  if (!SITE_LANGS.includes(lang)) throw new Error(`Unknown website locale: ${lang}`);
  return `${lang === 'en' ? '' : `/${lang}`}${page.startsWith('/') ? page : `/${page}`}`;
}

export const releasePagesFor = version =>
  SITE_LANGS.map(lang => `website${localePath(lang, `/releases/${version}.md`)}`);

export const SITE_URL = 'https://playpets.gaerae.com';

// A version's release page, the notes written for people using the app.
export const releasePageUrl = (version, lang = 'en') => `${SITE_URL}${localePath(lang, `/releases/${version}`)}`;

export const LANDING_PETS = Object.freeze([
  { id: 'daisy', displayName: 'Daisy', source: 'assets/pets/daisy/spritesheet.png', kit: 'daisy' },
  { id: 'clover', displayName: 'Clover', source: 'assets/pets/clover/spritesheet.png', kit: 'clover' },
  { id: 'pip', displayName: 'Pip', source: 'assets/pets/pip/spritesheet.png', kit: 'pip' },
  { id: 'miso', displayName: 'Miso', source: 'assets/pets/miso/spritesheet.png', kit: 'miso' },
]);
