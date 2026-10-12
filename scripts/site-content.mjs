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
  { id: 'aria-full', displayName: 'Aria', source: 'assets/pets/aria/realistic/spritesheet.png', kit: 'aria-realistic' },
  { id: 'aria-mini', displayName: 'Aria Mini', source: 'assets/pets/aria/spritesheet.png', kit: 'aria' },
  { id: 'noah-full', displayName: 'Noah', source: 'assets/pets/noah/realistic/spritesheet.png', kit: 'noah-realistic' },
  { id: 'noah-mini', displayName: 'Noah Mini', source: 'assets/pets/noah/spritesheet.png', kit: 'noah' },
  { id: 'tabby', displayName: 'Tabby', source: 'assets/pets/tabby/spritesheet.png', kit: 'tabby' },
  { id: 'smoky', displayName: 'Smoky', source: 'assets/pets/smoky/spritesheet.png', kit: 'smoky' },
  { id: 'mochi', displayName: 'Mochi', source: 'assets/pets/mochi/spritesheet.png', kit: 'mochi' },
]);
