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
