// Rules for building the website from docs/: where each file lands and how its links are rewritten.
// Pure functions; scripts/site-prepare.mjs applies them and tests/website.test.mjs checks them.
import path from 'node:path/posix';

/** Where a file under docs/ is copied for the site: dev/ in the English root, since the docs are English. README.md becomes the section index. */
export function destinationFor(source) {
  const rest = source.replace(/^docs\//, '');
  return `website/dev/${rest === 'README.md' ? 'index.md' : rest}`;
}

/**
 * Rewrites the relative links of one docs file so they still resolve after the copy.
 * A link to another docs file follows that file's destination; a link that leaves docs/
 * (README, CONTRIBUTING, source files) points at GitHub.
 */
export function rewriteDocLinks(text, { file, repo }) {
  const from = path.dirname(destinationFor(file));
  return text.replace(/\]\(([^)\s]+)\)/g, (whole, target) => {
    if (/^(https?:|mailto:|#)/.test(target)) return whole;
    const [p, hash = ''] = target.split(/(?=#)/);
    const resolved = path.normalize(path.join(path.dirname(file), p));
    if (!resolved.startsWith('docs/')) return `](${repo}/${resolved}${hash})`;
    return `](${path.relative(from, destinationFor(resolved))}${hash})`;
  });
}

/** Historical source stays intact; displayed prose follows the site's current punctuation. */
export function docDisplayProse(text) {
  let fence = null;
  return text
    .split('\n')
    .map(line => {
      const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (marker) {
        if (!fence) fence = marker[1];
        else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
        return line;
      }
      if (fence) return line;
      // Inline code and link destinations remain exact, including technical punctuation.
      const protectedParts = /(`+)[^\n]*?\1|\]\([^\n)]*\)/g;
      let end = 0;
      let output = '';
      const prose = value => value.replace(/\s*[\u00b7\u30fb\u2027\u2219]\s*/g, ', ');
      for (const match of line.matchAll(protectedParts)) {
        output += prose(line.slice(end, match.index)) + match[0];
        end = match.index + match[0].length;
      }
      return output + prose(line.slice(end));
    })
    .join('\n');
}
