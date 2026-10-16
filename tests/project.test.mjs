// The app's own pages (site, guide, release notes, repository) are built from the two addresses the
// backend reports, in the site's language for the app's language.
import assert from 'node:assert/strict';
import test from 'node:test';
import { projectLinks } from '../src/core/project.js';

const project = { site: 'https://playpets.gaerae.com/', repository: 'https://github.com/gaerae/playpets' };

test('the about links point at the site in the app language and at the repository', () => {
  const ko = projectLinks(project, 'ko');
  assert.equal(ko.site, 'https://playpets.gaerae.com/ko/');
  assert.equal(ko.guide, 'https://playpets.gaerae.com/ko/guide/');
  assert.equal(ko.releases, 'https://playpets.gaerae.com/ko/releases/');
  assert.equal(ko.notes('0.2.0'), 'https://playpets.gaerae.com/ko/releases/0.2.0');
  assert.equal(ko.github, 'https://github.com/gaerae/playpets');
  assert.equal(ko.report, 'https://github.com/gaerae/playpets/issues/new/choose');
  assert.equal(ko.license, 'https://github.com/gaerae/playpets/blob/main/LICENSE');
  assert.equal(projectLinks(project, 'zh-hans').guide, 'https://playpets.gaerae.com/zh-hans/guide/');
});

test('Japanese uses its translated site and guide', () => {
  assert.equal(projectLinks(project, 'ja').guide, 'https://playpets.gaerae.com/ja/guide/');
});

test('English, and app languages the site does not have, use the site root', () => {
  for (const lang of ['en', 'fr']) {
    const links = projectLinks(project, lang);
    assert.equal(links.site, 'https://playpets.gaerae.com/');
    assert.equal(links.notes('0.2.0'), 'https://playpets.gaerae.com/releases/0.2.0');
  }
});

test('a site address without a trailing slash still makes whole paths', () => {
  const links = projectLinks({ ...project, site: 'https://example.org' }, 'ko');
  assert.equal(links.guide, 'https://example.org/ko/guide/');
});
