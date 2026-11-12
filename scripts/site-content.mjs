import { MOMENTS } from '../src/yard/sky-moments.js';

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
// things a season brings, each with the album kinds that picture it as [book, id]. `recipes` are
// what has to come together, as chips the landing names with the app's own words (SceneChips.vue):
// `season:`, `period:` and `weather:` (`a|b` is either), `change:rain>clear` (the weather turning),
// `gift:` (out in the yard) and `play:` (a Play menu item's string key). Each recipe's `gives` is its
// line in the landing's `year.gives`, the item's id by default. `or` is another way to the same line;
// `also` adds to the recipe before it for a line of its own.
export const YEAR = Object.freeze([
  {
    season: 'spring',
    items: [
      {
        id: 'blossom',
        event: true,
        recipes: [{ when: ['weather:clear', 'play:viewing.action'] }],
        art: [
          ['trees', 'cherry'],
          ['gifts', 'cherry_sapling'],
        ],
      },
      {
        id: 'shoots',
        recipes: [
          { when: ['season:spring', 'change:rain>clear'] },
          { when: ['season:spring', 'period:morning', 'weather:clear'], or: true },
        ],
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
        recipes: [{ when: ['period:evening|night'] }],
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
        recipes: [{ when: ['period:night'] }],
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
        recipes: [{ when: [] }, { when: ['gift:xmas_tree'], gives: 'ornaments', also: true }],
        art: [
          ['gifts', 'baby_reindeer'],
          ['gifts', 'santa'],
        ],
      },
      // Called up by the scene on any day, so it has no dates.
      {
        id: 'christmas',
        recipes: [
          { when: ['season:winter', 'period:evening|night', 'weather:snow', 'gift:xmas_tree'] },
          { when: ['gift:baby_reindeer', 'gift:santa', 'period:night'], gives: 'sleigh', also: true },
        ],
        art: [['gifts', 'xmas_tree']],
      },
      { id: 'snowman', recipes: [{ when: ['season:winter', 'play:game.snowman'] }], art: [['gifts', 'snowman']] },
      {
        id: 'footprints',
        recipes: [{ when: ['season:winter'] }],
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

// The sky's moments on the landing: the app's own rows (sky-moments.js), then the flock of birds
// that crosses a clear sky by day (scenery.js), each named in the landing's `moments.items`.
export const SKY_SCENES = Object.freeze([
  ...MOMENTS,
  { id: 'flock', weather: 'clear', periods: ['morning', 'day', 'evening'] },
]);

// Steam's own tag names for this kind of app (store.steampowered.com/tag/browse, checked
// 2026-11-12), for the landing's structured data. "Desktop Pet" is not one; "Desktop Companion" is.
export const STEAM_TAGS = Object.freeze(['Desktop Companion', 'Cozy', 'Relaxing', 'Idler', 'Casual', 'Cute']);

export const LANDING_PETS = Object.freeze([
  { id: 'daisy', displayName: 'Daisy', source: 'assets/pets/daisy/spritesheet.png', kit: 'daisy' },
  { id: 'clover', displayName: 'Clover', source: 'assets/pets/clover/spritesheet.png', kit: 'clover' },
  { id: 'pip', displayName: 'Pip', source: 'assets/pets/pip/spritesheet.png', kit: 'pip' },
  { id: 'miso', displayName: 'Miso', source: 'assets/pets/miso/spritesheet.png', kit: 'miso' },
]);
