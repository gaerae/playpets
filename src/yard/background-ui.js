import { confirmAction } from '../core/confirm.js';
import { language, t } from '../core/i18n.js';
import { projectLinks } from '../core/project.js';
import { $, call, data, guard, toast } from '../core/state.js';
import { MAX_BACKGROUND_BYTES } from './background-pack.js';
import { removeBackground, saveBackground } from './background-store.js';
import { environmentLook } from './environment.js';
import { worldFor, worlds } from './worlds.js';

function options(selected) {
  $('world').replaceChildren(
    ...worlds.map(world => {
      const option = document.createElement('option');
      option.value = world.id;
      option.textContent = world.name || t(world.label);
      return option;
    }),
  );
  $('world').value = selected;
  $('world').dispatchEvent(new Event('change'));
}
/** Daylight thumbnails let the person recognize a place before entering it. */
export function backgroundPreview(world) {
  if (world.imageSources) return world.imageSources.base;
  const { art } = environmentLook({ world: world.id, season: 'summer', period: 'day', weather: 'clear' });
  return new URL(`../art/environments/${art}.png`, import.meta.url).href;
}
function renderGallery() {
  $('background-gallery').replaceChildren(
    ...worlds.map(world => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'background-card';
      button.dataset.world = world.id;
      button.setAttribute('aria-pressed', String(world.id === $('world').value));
      const image = document.createElement('img');
      image.src = backgroundPreview(world);
      image.alt = '';
      image.loading = 'lazy';
      const name = document.createElement('span');
      name.textContent = world.name || t(world.label);
      button.append(image, name);
      button.addEventListener('click', () => {
        $('world').value = world.id;
        $('world').dispatchEvent(new Event('change'));
      });
      return button;
    }),
  );
}
/** Compact disclosures keep all climate settings reachable; native radios own their choices. */
export function setupAtmosphereChoices() {
  const disclosures = [];
  let compact = document.body.classList.contains('compact');
  for (const [id, title] of [
    ['scene-season', 'settings.season'],
    ['period', 'period.label'],
    ['weather', 'weather.label'],
  ]) {
    const select = $(id);
    if (!select?.parentNode || !select.options?.length || select.dataset.atmosphereReady) continue;
    select.dataset.atmosphereReady = 'true';
    const disclosure = document.createElement('details');
    disclosure.className = 'atmosphere-choice';
    disclosure.open = !compact;
    const summary = document.createElement('summary');
    summary.tabIndex = compact ? 0 : -1;
    summary.addEventListener('click', event => {
      if (!compact) event.preventDefault();
    });
    const heading = document.createElement('span');
    heading.dataset.i18n = title;
    heading.textContent = t(title);
    const current = document.createElement('span');
    current.className = 'atmosphere-current';
    summary.append(heading, current);
    const group = document.createElement('fieldset');
    group.className = 'atmosphere-segments';
    group.dataset.i18nAriaLabel = title;
    group.setAttribute('aria-label', t(title));
    const radios = [];
    for (const option of select.options) {
      const label = document.createElement('label');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `${id}-choice`;
      radio.value = option.value;
      const text = document.createElement('span');
      text.dataset.i18n = option.dataset.i18n;
      text.textContent = t(option.dataset.i18n);
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        select.value = radio.value;
        select.dispatchEvent(new Event('change'));
        if (compact) {
          // The choice folds back and its summary stays in view; the places above it are not jumped to.
          disclosure.open = false;
          summary.focus({ preventScroll: true });
          summary.scrollIntoView?.({ block: 'nearest' });
        }
      });
      label.append(radio, text);
      if (option.value === 'auto') label.className = 'atmosphere-auto';
      group.append(label);
      radios.push(radio);
    }
    group.style.setProperty('--climate-columns', String(radios.length));
    group.style.setProperty('--climate-manual-options', String(radios.length - 1));
    const refresh = () => {
      group.disabled = !!select.disabled;
      summary.setAttribute('aria-disabled', String(!!select.disabled));
      for (const radio of radios) radio.checked = radio.value === select.value;
      const option = [...select.options].find(option => option.value === select.value);
      current.dataset.i18n = option?.dataset.i18n || '';
      current.textContent = option ? t(option.dataset.i18n) : '';
    };
    select.addEventListener('change', refresh);
    $('world').addEventListener('change', refresh);
    refresh();
    select.hidden = true;
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    disclosure.append(summary, group);
    disclosure.addEventListener('toggle', () => {
      if (!compact || !disclosure.open) return;
      for (const other of disclosures) if (other !== disclosure) other.open = false;
      const page = disclosure.closest('.scene-page');
      if (page)
        page.scrollTop += Math.max(0, disclosure.getBoundingClientRect().bottom - page.getBoundingClientRect().bottom);
    });
    disclosures.push(disclosure);
    select.parentNode.insertBefore(disclosure, select);
  }
  if (disclosures.length)
    globalThis.window?.addEventListener('resize', () => {
      const next = document.body.classList.contains('compact');
      if (next === compact) return;
      compact = next;
      for (const disclosure of disclosures) {
        disclosure.open = !compact;
        disclosure.querySelector('summary').tabIndex = compact ? 0 : -1;
      }
    });
}
export function setupBackgrounds() {
  setupAtmosphereChoices();
  const input = $('background-file'),
    button = $('background-import'),
    remove = $('background-remove');
  const refresh = () => {
    remove.hidden = !worldFor($('world').value).custom;
    if ($('background-gallery').children.length !== worlds.length) renderGallery();
    for (const card of $('background-gallery').children) {
      card.setAttribute('aria-pressed', String(card.dataset.world === $('world').value));
    }
  };
  $('world').addEventListener('change', refresh);
  button.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    button.disabled = true;
    try {
      if (file.size > MAX_BACKGROUND_BYTES) throw new Error('background.invalid');
      let pack;
      try {
        pack = JSON.parse(await file.text());
      } catch {
        throw new Error('background.invalid');
      }
      const id = await saveBackground(pack);
      options(id);
      toast(t('background.imported'));
    } catch (error) {
      toast(t(error?.message === 'background.invalid' ? 'background.invalid' : 'background.storage_error'));
    } finally {
      button.disabled = false;
    }
  });
  remove.addEventListener('click', async () => {
    const id = $('world').value;
    if (!worldFor(id).custom) return;
    const confirmed = await confirmAction({
      title: t('background.remove'),
      body: t('background.remove_confirm'),
      action: t('background.remove'),
      danger: true,
    });
    // The dialog sits outside the chooser, so its pointer events can close the dropdown.
    $('scene-menu').hidden = false;
    $('scene-button').setAttribute('aria-expanded', 'true');
    if (!confirmed) {
      remove.focus();
      return;
    }
    remove.disabled = true;
    try {
      await removeBackground(id);
      options('woodland');
    } catch {
      toast(t('background.storage_error'));
    } finally {
      remove.disabled = false;
      $('background-gallery').querySelector('[aria-pressed="true"]')?.focus();
    }
  });
  $('background-create').addEventListener(
    'click',
    guard(() => call('openExternal', `${projectLinks(data.project, language()).guide}background-kit`)),
  );
  refresh();
}
