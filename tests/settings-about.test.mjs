import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { projectLinks } from '../src/core/project.js';
import { installDom } from './support/dom.mjs';

const opened = [];
globalThis.playPets = {
  openExternal: async url => {
    opened.push(url);
    return { ok: true };
  },
};
const { setupSettings } = await import('../src/panel/settings.js');
const { setData } = await import('../src/core/state.js');
const { setLanguageForTests } = await import('../src/core/i18n.js');

test('every About button sends its localized project destination through the guarded opener', async t => {
  const buttons = ['site', 'guide', 'releases', 'github', 'report', 'license'].map(link => ({ dataset: { link } }));
  globalThis.Option = class {};
  const { document } = installDom(t, { anyId: true });
  document.querySelectorAll = selector => (selector === 'button[data-link]' ? buttons : []);
  const project = { site: 'https://gaerae.github.io/playpets/', repository: 'https://github.com/gaerae/playpets' };
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

test('Settings explains external publication and labels the persisted season control', async () => {
  const html = await readFile('src/index.html', 'utf8');
  assert.match(html, /data-i18n="about.publication_note"/);
  assert.match(html, /label for="season"/);
  assert.match(html, /id="season"[^>]*aria-describedby="season-note"/);
});
