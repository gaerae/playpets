// The rules of a release, as plain functions (tests/release.test.mjs): the changelog's
// "Unreleased" becomes a dated section, a version's notes can be read back out of it, and the
// Rust manifest and lockfile carry the app's version.

import { releasePageUrl } from './site-content.mjs';

const SEMVER = /^\d+\.\d+\.\d+$/;
const UNRELEASED = '## [Unreleased]';
const heading = version => `## [${version}]`;

// The changelog with what is under [Unreleased] moved into `## [version] - date`.
export function release(changelog, version, date) {
  if (!SEMVER.test(version)) throw new Error(`The version must look like x.y.z, not "${version}".`);
  if (changelog.includes(`${heading(version)} `) || changelog.includes(`${heading(version)}\n`))
    throw new Error(`The changelog already has a section for ${version}.`);
  // The heading at the start of a line, not the same words quoted in the instructions above it.
  const at = changelog.search(/^## \[Unreleased\]\n/m);
  if (at < 0) throw new Error(`The changelog has no "${UNRELEASED}" heading.`);
  const bodyStart = at + UNRELEASED.length + 1;
  const next = changelog.indexOf('\n## [', bodyStart);
  const body = changelog.slice(bodyStart, next < 0 ? undefined : next).trim();
  if (!body) throw new Error('There is nothing under [Unreleased] to release.');
  const rest = next < 0 ? '' : changelog.slice(next + 1);
  return `${changelog.slice(0, at)}${UNRELEASED}\n\n${heading(version)} - ${date}\n\n${body}\n${rest ? `\n${rest}` : ''}`;
}

// What the changelog says about one version, without its heading: the release notes.
export function notesFor(changelog, version) {
  const lines = changelog.split('\n');
  const start = lines.findIndex(l => l === heading(version) || l.startsWith(`${heading(version)} `));
  if (start < 0) throw new Error(`The changelog has no section for ${version}.`);
  let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  if (end < 0) end = lines.length;
  return lines
    .slice(start + 1, end)
    .join('\n')
    .trim();
}

// The [package] version in Cargo.toml (the first `version =` line, before any table).
export function cargoVersion(toml) {
  return toml.match(/^\[package\][^[]*?^version = "([^"]+)"/ms)?.[1];
}
export function setCargoVersion(toml, version) {
  return toml.replace(/^(\[package\][^[]*?^version = ")[^"]+(")/ms, `$1${version}$2`);
}

// The app's own entry in Cargo.lock.
export function lockVersion(lock) {
  return lock.match(/^name = "playpets"\nversion = "([^"]+)"/m)?.[1];
}
export function setLockVersion(lock, version) {
  return lock.replace(/^(name = "playpets"\nversion = ")[^"]+(")/m, `$1${version}$2`);
}

// The Linux metainfo with this version first in <releases>, dated; an entry for the same
// version (such as the development one written before the release) is replaced.
const xmlText = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// A release in the Linux metainfo, newest first; with `notes` ({intro, changes, url}: the English page's
// Linux lines), software centers show what changed and link to the page.
export function setMetainfoRelease(xml, version, date, notes) {
  if (!SEMVER.test(version)) throw new Error(`The version must look like x.y.z, not "${version}".`);
  // The element on its own line, not a mention of it in a comment.
  const element = /\n([ \t]*)<releases>\n/;
  const open = xml.match(element);
  if (!open) throw new Error('The metainfo has no <releases> element.');
  const same = new RegExp(
    `\\n[ \\t]*<release version="${version.replaceAll('.', '\\.')}"[^>]*?(/>|>[\\s\\S]*?</release>)`,
    'g',
  );
  const indent = open[1];
  const at = `${indent}  `;
  const entry = notes
    ? [
        `${at}<release version="${version}" date="${date}">`,
        `${at}  <description>`,
        `${at}    <p>${xmlText(notes.intro)}</p>`,
        ...(notes.changes.length
          ? [`${at}    <ul>`, ...notes.changes.map(line => `${at}      <li>${xmlText(line)}</li>`), `${at}    </ul>`]
          : []),
        `${at}  </description>`,
        `${at}  <url type="details">${xmlText(notes.url)}</url>`,
        `${at}</release>`,
      ].join('\n')
    : `${at}<release version="${version}" date="${date}"/>`;
  return xml.replace(same, '').replace(element, `\n${indent}<releases>\n${entry}\n`);
}

// A release page written ahead of time gets the release date in its front matter (ReleaseMeta and the
// release list show "in preparation" until then).
export function setPageDate(page, date) {
  const front = page.match(/^---\n([\s\S]*?)\n---\n/);
  if (!front) throw new Error('The release page has no front matter.');
  const lines = front[1].split('\n').filter(line => !line.startsWith('date:'));
  const at = lines.findIndex(line => line.startsWith('version:'));
  lines.splice(at + 1, 0, `date: ${date}`);
  return `---\n${lines.join('\n')}\n---\n${page.slice(front[0].length)}`;
}

// The GitHub release body: the full changelog section, for people working on PlayPets, after a
// link to the release page written for people using it.
export function releaseBody(changelog, version) {
  return `What's new for people using PlayPets: ${releasePageUrl(version)}\n\n${notesFor(changelog, version)}`;
}
