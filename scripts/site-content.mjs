// One inventory for public captures, pet previews and locale-dependent publishing paths.
// Advance only after native captures for the new version exist in every site language.
export const CAPTURE_VERSION = '1.5.0';

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

/** Where a starter friend's own download is served (scripts/creator-kit.mjs writes it). */
export const petDownload = id => `/pets/playpets-${id}.zip`;

// The landing's album: three kinds each book shows, drawn with the app's own artwork
// (scripts/site-album.mjs), in the order of the album's books (src/yard/catalog.js ALBUM_BOOKS).
export const ALBUM_SAMPLES = Object.freeze({
  flowers: ['tulip', 'sunflower', 'camellia'],
  fish: ['goldfish', 'crayfish', 'softshell_turtle'],
  bugs: ['swallowtail', 'red_dragonfly', 'rhinoceros_beetle'],
  gifts: ['swing', 'birdhouse', 'campfire'],
  trees: ['cherry', 'maple', 'ginkgo'],
  treasures: ['amber', 'toy_robot', 'sleeping_fox'],
  tracks: ['fox', 'squirrel', 'magpie'],
  shoots: ['fiddlehead', 'bamboo_shoot', 'morel'],
});

// The landing's year: each season's events (src/content/events.json, `event`) and the other
// things a season brings, each with the album kinds that picture it as [book, id].
export const YEAR = Object.freeze([
  {
    season: 'spring',
    items: [
      {
        id: 'blossom',
        event: true,
        art: [
          ['trees', 'cherry'],
          ['gifts', 'cherry_sapling'],
        ],
      },
      {
        id: 'shoots',
        art: [
          ['shoots', 'wild_garlic'],
          ['shoots', 'morel'],
        ],
      },
    ],
  },
  {
    season: 'summer',
    items: [
      {
        id: 'fireflies',
        event: true,
        art: [
          ['bugs', 'golden_firefly'],
          ['gifts', 'watermelon'],
        ],
      },
    ],
  },
  {
    season: 'autumn',
    items: [
      {
        id: 'harvest',
        event: true,
        art: [
          ['fish', 'moon_carp'],
          ['gifts', 'pumpkin'],
        ],
      },
    ],
  },
  {
    season: 'winter',
    items: [
      {
        id: 'lights',
        event: true,
        art: [
          ['gifts', 'baby_reindeer'],
          ['gifts', 'santa'],
        ],
      },
      // Called up by the scene on any day, so it has no dates.
      { id: 'christmas', art: [['gifts', 'xmas_tree']] },
      { id: 'snowman', art: [['gifts', 'snowman']] },
      {
        id: 'footprints',
        art: [
          ['tracks', 'hare'],
          ['tracks', 'raccoon_dog'],
        ],
      },
      { id: 'letter', from: '12-26', to: '12-31', art: [['gifts', 'mailbox']] },
      { id: 'newyear', event: true, art: [['gifts', 'kite']] },
    ],
  },
]);

export const LANDING_PETS = Object.freeze([
  { id: 'daisy', displayName: 'Daisy', source: 'assets/pets/daisy/spritesheet.png', kit: 'daisy' },
  { id: 'clover', displayName: 'Clover', source: 'assets/pets/clover/spritesheet.png', kit: 'clover' },
  { id: 'pip', displayName: 'Pip', source: 'assets/pets/pip/spritesheet.png', kit: 'pip' },
  { id: 'miso', displayName: 'Miso', source: 'assets/pets/miso/spritesheet.png', kit: 'miso' },
]);
