import assert from 'node:assert/strict';
import test from 'node:test';
import { setupAtmosphereChoices } from '../src/yard/background-ui.js';
import { element, installDom } from './support/dom.mjs';

test('atmosphere radios preserve scene changes and programmatic selection', async t => {
  const { nodes } = installDom(t, { anyId: true });
  const climate = element();
  const choices = {
    'scene-season': ['auto', 'spring', 'summer', 'autumn', 'winter'],
    period: ['auto', 'morning', 'day', 'evening', 'night'],
    weather: ['auto', 'clear', 'rain', 'snow'],
  };
  let changes = 0;
  for (const [id, values] of Object.entries(choices)) {
    const select = document.getElementById(id);
    select.options = values.map(value => ({ value, dataset: { i18n: `choice.${value}` } }));
    select.value = values[1];
    select.dispatchEvent = () => {
      changes++;
      return select.dispatch('change');
    };
    climate.append(select);
  }
  setupAtmosphereChoices();
  setupAtmosphereChoices();
  const groups = climate.querySelectorAll('fieldset');
  assert.equal(groups.length, 3);
  assert.equal(climate.querySelector('summary').children[0].dataset.i18n, 'settings.season');
  const inputs = groups[0].querySelectorAll('input');
  assert.deepEqual(
    inputs.map(input => input.value),
    choices['scene-season'],
  );
  assert.ok(inputs.every(input => input.type === 'radio' && input.name === 'scene-season-choice'));
  assert.equal(inputs.find(input => input.checked)?.value, 'spring');
  inputs[4].checked = true;
  await inputs[4].dispatch('change');
  assert.equal(nodes.get('scene-season').value, 'winter');
  assert.equal(changes, 1);
  nodes.get('scene-season').value = 'auto';
  await nodes.get('scene-season').dispatch('change');
  assert.equal(inputs.find(input => input.checked)?.value, 'auto');
  nodes.get('weather').disabled = true;
  await document.getElementById('world').dispatch('change');
  assert.equal(groups[2].disabled, true, 'places without weather disable the complete group');
  nodes.get('weather').disabled = false;
  await nodes.get('world').dispatch('change');
  assert.equal(groups[2].disabled, false);
  assert.equal(nodes.get('scene-season').hidden, true);
  assert.equal(nodes.get('scene-season').getAttribute('aria-hidden'), 'true');
});

test('compact atmosphere keeps three summaries visible and opens only one option group', async t => {
  const { nodes } = installDom(t, { anyId: true });
  document.body.classList.add('compact');
  const climate = element();
  for (const id of ['scene-season', 'period', 'weather']) {
    const select = document.getElementById(id);
    select.options = ['auto', 'first', 'second'].map(value => ({ value, dataset: { i18n: `choice.${value}` } }));
    select.value = 'auto';
    select.dispatchEvent = () => select.dispatch('change');
    climate.append(select);
  }
  setupAtmosphereChoices();
  const page = element('div', { rect: { top: 0, bottom: 100 } });
  page.className = 'scene-page';
  page.scrollTop = 0;
  page.append(climate);
  const details = climate.querySelectorAll('details');
  assert.equal(details.length, 3);
  assert.ok(details.every(group => !group.open));
  details[0].open = true;
  await details[0].dispatch('toggle');
  details[1].getBoundingClientRect = () => ({ top: 80, bottom: 170 });
  details[1].open = true;
  await details[1].dispatch('toggle');
  assert.equal(page.scrollTop, 70, 'opening reveals its choices inside the scene scroller');
  assert.equal(details[0].open, false);
  const radio = details[1].querySelectorAll('input')[1];
  radio.checked = true;
  await radio.dispatch('change');
  assert.equal(details[1].open, false);
  assert.equal(page.scrollTop, 0, 'a choice restores the three-row overview');
  assert.equal(document.activeElement, details[1].querySelector('summary'));
  assert.equal(details[1].querySelector('summary').children[1].dataset.i18n, 'choice.first');
  assert.equal(nodes.get('period').value, 'first');
});
