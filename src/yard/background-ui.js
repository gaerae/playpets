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
export function setupBackgrounds() {
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
