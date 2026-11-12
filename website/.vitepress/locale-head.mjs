import { CAPTURE_VERSION, localePath, SITE_LANGS, STEAM_TAGS } from '../../scripts/site-content.mjs';

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

// What a search or answer engine reads about the app, on each language's landing only: its name as
// said in that language (`alternateName`) and the kind of app in Steam's tag words, English first,
// then Steam's own names for them in that language (`genre`). "<" is
// written as \u003c so a description can never close the script tag early.
export function appStructuredData(relativePath, site, { description, version, alternateName, genre = [] }) {
  const lang = relativePath.match(/^(?:(ko|ja|zh-hans)\/)?index\.md$/);
  if (!lang) return [];
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'PlayPets',
    ...(alternateName && { alternateName }),
    applicationCategory: 'DesktopEnhancementApplication',
    applicationSubCategory: STEAM_TAGS[0],
    genre: [...new Set([...STEAM_TAGS, ...genre])],
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
    screenshot: `${site}shots/${CAPTURE_VERSION}/${lang[1] ?? 'en'}/yard-talk.webp`,
  };
  return [jsonLd(data)];
}

// The landing's search words, in its language (landing-*.ts keywords); no other page has them.
export const landingKeywords = (relativePath, keywords) =>
  /^(?:(ko|ja|zh-hans)\/)?index\.md$/.test(relativePath)
    ? [['meta', { name: 'keywords', content: keywords.join(', ') }]]
    : [];

const jsonLd = data => ['script', { type: 'application/ld+json' }, JSON.stringify(data).replaceAll('<', '\\u003c')];

// Markdown read as the words a person sees: links keep their text, emphasis and code marks go.
const plainText = markdown =>
  markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s*(?:[-*]|\d+\.)\s+/gm, '')
    .replace(/(\*\*|__|\*|`)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Search results show about this much; a longer description is cut at a word (anywhere in CJK).
const DESCRIPTION_LENGTH = 160;
function clamp(text) {
  if (text.length <= DESCRIPTION_LENGTH) return text;
  const cut = text.slice(0, DESCRIPTION_LENGTH - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > DESCRIPTION_LENGTH / 2 ? cut.slice(0, space) : cut).replace(/[\s,.:;、，。]+$/, '')}…`;
}

// A page with no description of its own (the guide's front page, the FAQ, release notes, developer
// docs) is described by its first paragraph, or the first item of a list that comes first, so no
// two pages share the landing's sentence. A page that is all components gives "".
export function leadDescription(markdown) {
  const body = markdown
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/^(```|~~~)[\s\S]*?^\1.*$/gm, '')
    .replace(/^#.*$/gm, '');
  for (const block of body.split(/\n\s*\n/)) {
    const text = block.trim();
    if (!text || /^(<|:::|\||>|!\[)/.test(text)) continue;
    if (!/^(?:[-*]|\d+\.)\s/.test(text)) return clamp(plainText(text));
    const [item] = text.split(/\n(?=(?:[-*]|\d+\.)\s)/);
    const [lead, ...nested] = item.split(/\n(?=\s+(?:[-*]|\d+\.)\s)/);
    return clamp(plainText([lead, nested.map(plainText).join(', ')].filter(Boolean).join(' ')));
  }
  return '';
}

// Each language's FAQ as questions and answers for search and answer engines: every "## " heading
// is a question, the text under it until the next heading its answer.
export function faqStructuredData(relativePath, markdown) {
  const lang = relativePath.match(/^(?:(ko|ja|zh-hans)\/)?guide\/faq\.md$/);
  if (!lang) return [];
  const mainEntity = markdown
    .split(/^## /m)
    .slice(1)
    .map(section => {
      const [name, ...answer] = section.split('\n');
      return {
        '@type': 'Question',
        name: name.trim(),
        acceptedAnswer: { '@type': 'Answer', text: plainText(answer.join('\n').replace(/^#.*$/gm, '')) },
      };
    });
  return [
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: lang[1] === 'zh-hans' ? 'zh-Hans' : (lang[1] ?? 'en'),
      mainEntity,
    }),
  ];
}

// A release page's title: "1.4.0: Gifts from friends" says more in a result than the bare version.
export function releaseTitle(frontmatter) {
  if (!frontmatter.version) return undefined;
  return frontmatter.headline ? `${frontmatter.version}: ${frontmatter.headline}` : String(frontmatter.version);
}
