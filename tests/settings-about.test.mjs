import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { projectLinks } from '../src/core/project.js';
import { installDom } from './support/dom.mjs';

const opened = [],
  folders = [];
globalThis.playPets = {
  openExternal: async url => {
    opened.push(url);
    return { ok: true };
  },
  openFolder: async which => {
    folders.push(which);
    return { ok: true };
  },
};
const { setupSettings } = await import('../src/panel/settings.js');
const { setData } = await import('../src/core/state.js');
const { setLanguageForTests } = await import('../src/core/i18n.js');

test('every About button sends its localized project destination through the guarded opener', async t => {
  const buttons = ['site', 'guide', 'releases', 'github', 'report', 'license', 'privacy'].map(link => ({
    dataset: { link },
  }));
  globalThis.Option = class {};
  const { document } = installDom(t, { anyId: true });
  document.querySelectorAll = selector => (selector === 'button[data-link]' ? buttons : []);
  const project = { site: 'https://playpets.gaerae.com/', repository: 'https://github.com/gaerae/playpets' };
  setData({ project });
  for (const lang of ['en', 'ko', 'ja', 'zh-hans']) {
    setLanguageForTests(lang);
    setupSettings();
    for (const button of buttons) {
      await button.onclick();
      assert.equal(opened.at(-1), projectLinks(project, lang)[button.dataset.link]);
    }
  }
});

test('Settings explains external publication and atmosphere labels the persisted season control', async () => {
  const html = await readFile('src/index.html', 'utf8');
  assert.match(html, /data-i18n="about.publication_note"/);
  assert.match(html, /label for="scene-season"/);
  assert.match(html, /id="scene-season"/);
});

test('About opens the data folder, and App updates opens the notes of the version in use', async t => {
  globalThis.Option = class {};
  const { document, nodes } = installDom(t, { anyId: true });
  document.querySelectorAll = () => [];
  const project = { site: 'https://playpets.gaerae.com/', repository: 'https://github.com/gaerae/playpets' };
  setData({ project, version: '1.2.0' });
  setLanguageForTests('ko');
  setupSettings();
  await nodes.get('open-data').onclick();
  assert.equal(folders.at(-1), 'data');
  await nodes.get('update-this-version').onclick();
  assert.equal(opened.at(-1), projectLinks(project, 'ko').notes('1.2.0'));
});

test('About groups its pages and keeps the license note last', async () => {
  const html = await readFile('src/index.html', 'utf8');
  const about = html.slice(
    html.indexOf('id="settings-about"'),
    html.indexOf('</section>', html.indexOf('id="settings-about"')),
  );
  const order = [
    'about.help',
    'data-link="guide"',
    'id="open-data"',
    'about.project',
    'data-link="releases"',
    'about.policies',
    'data-link="license"',
    'about.lead',
  ].map(s => about.indexOf(s));
  assert.ok(
    order.every(at => at > 0),
    JSON.stringify(order),
  );
  assert.deepEqual(
    [...order].sort((a, b) => a - b),
    order,
  );
});
