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
