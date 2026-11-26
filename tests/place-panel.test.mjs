import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { strings as en } from '../src/core/strings/en.js';
import { strings as ja } from '../src/core/strings/ja.js';
import { strings as ko } from '../src/core/strings/ko.js';
import { strings as zh } from '../src/core/strings/zh-hans.js';
import { setupAtmosphereChoices } from '../src/yard/background-ui.js';
import { element, installDom } from './support/dom.mjs';

const languages = { en, ko, ja, zh };
const compact = css =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([{};:,>()])\s*/g, '$1')
    .replace(/\s+/g, ' ');
const caption = async () => compact(await readFile('src/styles/caption.css', 'utf8'));

// Korean alone called the panel by its word for background while its own section, and every other language,
// say place; and the dock button's hint left out the season the panel also sets.
test('the panel is named for its places, and its hint names everything it sets', () => {
  assert.equal(ko['controls.scene'], '장소와 분위기');
  for (const [lang, strings] of Object.entries(languages)) {
    const title = strings['controls.scene'];
    assert.ok(title.includes(strings['scene.places']) || title.includes(strings['world.label']), `${lang}: ${title}`);
    const hint = strings['scene.title'].toLowerCase();
    for (const key of ['settings.season', 'period.label', 'weather.label'])
      assert.ok(hint.includes(strings[key].toLowerCase()), `${lang}: ${key}`);
    assert.ok(strings['scene.now'], `${lang}: the Now tag`);
  }
});

function climate(t) {
  const { nodes } = installDom(t, { anyId: true });
  const box = element();
  const choices = {
    'scene-season': ['auto', 'spring', 'summer', 'autumn', 'winter'],
    period: ['auto', 'morning', 'day', 'evening', 'night'],
    weather: ['auto', 'clear', 'rain', 'snow'],
  };
  for (const [id, values] of Object.entries(choices)) {
    const select = document.getElementById(id);
    select.options = values.map(value => ({ value, dataset: { i18n: `choice.${value}` } }));
    select.value = 'auto';
    box.append(select);
  }
  setupAtmosphereChoices();
  return { nodes, box };
}

// On Auto the panel showed only Auto chosen; what the yard was in came from the dock's caption.
test('on Auto, the season, time and weather the yard is in now carry a Now tag', async t => {
  const { nodes, box } = climate(t);
  const season = nodes.get('scene-season');
  const shown = () =>
    box
      .querySelectorAll('fieldset')[0]
      .querySelectorAll('label')
      .filter(label => label.querySelector('.atmosphere-now')?.hidden === false)
      .map(label => label.querySelector('input').value);
  season.dataset.now = 'summer';
  await season.dispatch('now');
  assert.deepEqual(shown(), ['summer']);
  season.dataset.now = 'autumn';
  await season.dispatch('now');
  assert.deepEqual(shown(), ['autumn'], 'it moves when the season turns');
  season.value = 'spring';
  await season.dispatch('change');
  assert.deepEqual(shown(), [], 'a season picked by hand is plain to see already');
});

// A folded row in a small window said only a word; it shows the chosen picture beside it.
test("a folded atmosphere row shows the chosen one's picture with its word", async t => {
  const { nodes, box } = climate(t);
  const current = () => box.querySelectorAll('.atmosphere-current')[2];
  assert.equal(current().dataset.choice, 'auto');
  nodes.get('weather').value = 'snow';
  await nodes.get('weather').dispatch('change');
  assert.equal(current().dataset.choice, 'snow');
  assert.equal(box.querySelectorAll('.atmosphere-choice')[2].dataset.for, 'weather');
});

test('the yard tells each choice what Auto shows now', async () => {
  const sky = await readFile('src/yard/sky.js', 'utf8');
  for (const id of ['scene-season', 'period', 'weather']) assert.ok(sky.includes(`'${id}'`), id);
  assert.match(sky, /dataset\.now = /);
  assert.match(sky, /new Event\('now'\)/);
});

test('every choice and its folded row have a picture, Auto weather included', async () => {
  const css = await caption();
  for (const [scope, art] of [
    ['scene-season', 'calendar'],
    ['period', 'hourglass'],
    ['weather', 'weather-auto'],
  ])
    assert.match(
      css,
      new RegExp(
        `\\[data-for="${scope}"\\] \\[data-choice="auto"\\]::before\\{[^}]*url\\("\\.\\./art/ui/${art}\\.webp"\\)`,
      ),
      scope,
    );
  for (const art of [
    'spring',
    'summer',
    'autumn',
    'winter',
    'morning',
    'day',
    'evening',
    'night',
    'clear',
    'rain',
    'snow',
  ])
    assert.match(
      css,
      new RegExp(`\\[data-choice="${art}"\\]::before\\{[^}]*url\\("\\.\\./art/ui/${art}\\.webp"\\)`),
      art,
    );
  assert.match(css, /body\.compact \.atmosphere-current::before\{[^}]*width:18px/);
  const tag = css.match(/(?:^|\})\.atmosphere-now\{([^}]*)\}/)?.[1] || '';
  assert.match(tag, /position:absolute/);
  assert.match(tag, /color:var\(--garden-peer-ink\)/, "the album's Now green");
});

// In a small window the section names are hidden, so Import and the studio floated alone over the
// places; the pictures come first and the two actions follow them. And the sound's name lined up
// 7px inside the other rows' names.
test('a small window shows the places first, and the sound lines up with the rows above', async () => {
  const css = await caption();
  // .dock-section is a column already (shell.css)
  assert.match(css, /body\.compact \.scene-places>\.dock-section-head\{[^}]*order:1/);
  assert.match(css, /\.scene-sound #sound-button\{[^}]*padding-left:2px/);
});
