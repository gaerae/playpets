import { localePath, SITE_LANGS } from '../../scripts/site-content.mjs';

export function alternateLinks(relativePath, site, exists) {
  const page = relativePath.replace(/^(ko|ja|zh-hans)\//, '');
  // Developer documentation has no translated counterpart.
  if (page.startsWith('dev/')) return [];
  const address = path => site + path.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '');
  const links = SITE_LANGS.map(lang => [lang, localePath(lang, page).slice(1)]).filter(([, path]) => exists(path));
  return [
    ...links.map(([lang, path]) => [
      'link',
      { rel: 'alternate', hreflang: lang === 'zh-hans' ? 'zh-Hans' : lang, href: address(path) },
    ]),
    ...(links.some(([lang]) => lang === 'en')
      ? [['link', { rel: 'alternate', hreflang: 'x-default', href: address(page) }]]
      : []),
  ];
}

// What a search or answer engine reads about the app, on each language's landing only. "<" is
// written as \u003c so a description can never close the script tag early.
export function appStructuredData(relativePath, site, { description, version }) {
  const lang = relativePath.match(/^(?:(ko|ja|zh-hans)\/)?index\.md$/);
  if (!lang) return [];
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'PlayPets',
    applicationCategory: 'DesktopEnhancementApplication',
    operatingSystem: 'macOS, Windows, Linux',
    inLanguage: lang[1] === 'zh-hans' ? 'zh-Hans' : (lang[1] ?? 'en'),
    url: site + (lang[1] ? `${lang[1]}/` : ''),
    description,
    softwareVersion: version,
    license: 'https://opensource.org/licenses/MIT',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    downloadUrl: 'https://github.com/gaerae/playpets/releases/latest',
    author: { '@type': 'Person', name: 'gaerae', url: 'https://github.com/gaerae' },
    sameAs: ['https://github.com/gaerae/playpets'],
    image: `${site}og${lang[1] ? `-${lang[1]}` : ''}.png`,
  };
  return [['script', { type: 'application/ld+json' }, JSON.stringify(data).replaceAll('<', '\\u003c')]];
}
