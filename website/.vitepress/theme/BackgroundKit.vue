<script setup>
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
} from 'reka-ui';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { backgroundPrompt, backgroundSheet } from '../../../scripts/background-specs.mjs';
import {
  MAX_BACKGROUND_BYTES,
  validateBackgroundGeometry,
  validateBackgroundPack,
} from '../../../src/yard/background-pack.js';
import { backgroundCopy } from './background-copy.js';
import StudioFile from './StudioFile.vue';
import { studioCopy } from './studio-copy.js';
import {
  backgroundPackageSize,
  backgroundPreviewFrame,
  downloadStudioFile,
  readStudioImage,
  studioSeasons,
} from './studio-files.mjs';
import { backgroundReadiness, backgroundStarter, replaceStudioHash, studioPanelForHash } from './studio-flow.mjs';

const props = defineProps({ lang: { type: String, default: 'en' } });
const c = computed(() => backgroundCopy[props.lang] || backgroundCopy.en);
const t = computed(() => studioCopy[props.lang] || studioCopy.en);
const name = ref(''),
  setting = ref(''),
  indoor = ref(false),
  weather = ref(true),
  ambient = ref(false),
  water = ref(false),
  floor = ref(0.67),
  season = ref('summer'),
  images = ref({}),
  filenames = ref({}),
  errors = ref({}),
  status = ref(''),
  busy = ref(false);
const phase = ref('layout');
const advanced = ref(false);
const starter = ref('');
const showSeasons = ref(false);
const starterIds = ['garden', 'lakeside', 'interior'];
function applyStarter(id) {
  const layout = backgroundStarter(id);
  starter.value = id;
  indoor.value = !layout.sky;
  weather.value = layout.weather;
  ambient.value = layout.ambient;
  water.value = !!layout.water;
  floor.value = layout.floor;
  if (layout.water) Object.assign(waterShape, layout.water);
  if (layout.fishingSpot) Object.assign(fishingSpot, layout.fishingSpot);
  windows.value = layout.windows;
  status.value = t.value.starterApplied;
}
const phases = ['layout', 'images', 'export'];
const seasons = studioSeasons;
const waterShape = reactive({ from: 0.4, to: 0.68, center: 0.6, radius: 0.025 });
const fishingSpot = reactive({ x: 0.43, y: 0.74 });
const windows = ref([{ x: 0.26, y: 0.12, width: 0.52, height: 0.36 }]);
const placement = ref('water'),
  guides = ref(true),
  crop = ref(0);
const aspects = [1.5, 1.6, 4 / 3, 3 / 4];
const ready = ref(false);
const restorePhase = () => {
  phase.value = studioPanelForHash(location.hash, 'background');
};
function goPhase(value) {
  phase.value = value;
  nextTick(() => document.querySelector('.background-kit .studio-tab[data-state="active"]')?.focus());
}
watch(phase, value => {
  if (typeof window !== 'undefined') replaceStudioHash(`#studio-${value}`);
});
onMounted(() => {
  ready.value = true;
  restorePhase();
  window.addEventListener('hashchange', restorePhase);
});
let active = true;
onBeforeUnmount(() => {
  active = false;
  window.removeEventListener('hashchange', restorePhase);
});
const geometry = computed(() => ({
  floor: floor.value,
  water: water.value && !indoor.value ? waterShape : null,
  fishingSpot: water.value && !indoor.value ? fishingSpot : null,
  windows: indoor.value ? windows.value : [],
}));
const packageInput = computed(() => ({
  format: 'playpets-background',
  version: 1,
  name: name.value,
  images: images.value,
  ...geometry.value,
  sky: !indoor.value,
  weather: weather.value,
  ambient: ambient.value && !indoor.value,
}));
const packageBytes = computed(() => backgroundPackageSize(packageInput.value));
const checks = computed(() =>
  backgroundReadiness({
    name: name.value,
    base: images.value.base,
    geometryError: geometryError.value,
    bytes: packageBytes.value,
    maxBytes: MAX_BACKGROUND_BYTES,
  }),
);
const geometryError = computed(() => {
  if (indoor.value && weather.value && !windows.value.length) return t.value.bgNoWindows;
  try {
    validateBackgroundGeometry(geometry.value);
    return '';
  } catch (error) {
    return c.value.geometryErrors[error.message] || c.value.invalid;
  }
});
const promptOptions = computed(() => ({
  ...geometry.value,
  indoor: indoor.value,
  season: season.value,
  setting: setting.value || (indoor.value ? 'a cozy living room' : 'a cozy lakeside garden'),
  pane: null,
  windows: indoor.value && weather.value ? windows.value : [],
}));
const prompt = computed(() => backgroundPrompt(promptOptions.value));
const artworkStyle = computed(() => {
  const h = 1024,
    w = h * aspects[crop.value],
    frame = backgroundPreviewFrame(w, h, floor.value);
  return {
    left: `${(frame.x / w) * 100}%`,
    top: `${(frame.y / h) * 100}%`,
    width: `${(frame.width / w) * 100}%`,
    height: `${(frame.height / h) * 100}%`,
  };
});
watch(floor, value => {
  fishingSpot.y = Math.max(value, fishingSpot.y);
});
function place(event) {
  if (!advanced.value || crop.value !== 0 || !water.value || indoor.value || geometryError.value) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const x = Math.max(0.02, Math.min(0.98, (event.clientX - rect.left) / rect.width)),
    y = (event.clientY - rect.top) / rect.height;
  if (placement.value === 'stand') {
    fishingSpot.x = x;
    fishingSpot.y = Math.max(floor.value, Math.min(0.94, y));
  } else {
    const width = waterShape.to - waterShape.from,
      cx = Math.max(width / 2, Math.min(1 - width / 2, x));
    waterShape.from = cx - width / 2;
    waterShape.to = cx + width / 2;
    waterShape.center = Math.max(waterShape.radius, Math.min(floor.value - waterShape.radius, y));
  }
}
async function upload(event, key) {
  const input = event.target,
    file = input.files?.[0];
  if (!file) return;
  busy.value = true;
  errors.value[key] = '';
  status.value = '';
  try {
    const result = await readStudioImage(file, 'background');
    if (active) {
      images.value[key] = result.dataUrl;
      filenames.value[key] = file.name;
    }
  } catch (error) {
    if (active) errors.value[key] = t.value.errors[error.message] || t.value.errors.decode;
  } finally {
    input.value = '';
    if (active) busy.value = false;
  }
}
function remove(key) {
  delete images.value[key];
  delete filenames.value[key];
  delete errors.value[key];
}
async function reopen(event) {
  const input = event.target,
    file = input.files?.[0];
  if (!file) return;
  busy.value = true;
  status.value = '';
  try {
    if (file.size > MAX_BACKGROUND_BYTES) throw Error();
    const pack = validateBackgroundPack(JSON.parse(await file.text()));
    // Validate every image before replacing the current draft; failed imports preserve the workbench.
    for (const dataUrl of Object.values(pack.images)) {
      const bytes = Uint8Array.from(atob(dataUrl.slice(22)), c => c.charCodeAt(0));
      await readStudioImage(new Blob([bytes], { type: 'image/png' }), 'background');
    }
    if (!active) return;
    name.value = pack.name;
    indoor.value = !pack.sky;
    weather.value = pack.weather;
    ambient.value = pack.ambient;
    water.value = !!pack.water;
    floor.value = pack.floor;
    if (pack.water) Object.assign(waterShape, pack.water);
    Object.assign(fishingSpot, pack.fishingSpot || { x: 0.43, y: Math.max(pack.floor, 0.74) });
    windows.value = pack.windows.map(pane => ({ ...pane }));
    images.value = pack.images;
    filenames.value = Object.fromEntries(Object.keys(pack.images).map(key => [key, `${key}.png`]));
    errors.value = {};
    setting.value = '';
    phase.value = 'images';
    status.value = t.value.bgOpened;
  } catch {
    if (active) status.value = t.value.bgError;
  } finally {
    input.value = '';
    if (active) busy.value = false;
  }
}
async function sheet() {
  if (geometryError.value) return;
  let url;
  try {
    const blob = new Blob([backgroundSheet(promptOptions.value)], { type: 'image/svg+xml' });
    url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 1536;
    canvas.height = 1024;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const result = await new Promise(resolve => canvas.toBlob(resolve));
    if (!result) throw Error();
    downloadStudioFile(result, 'playpets-layout.png');
  } catch {
    status.value = c.value.invalid;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}
function save() {
  if (geometryError.value || busy.value) return;
  try {
    const pack = validateBackgroundPack(packageInput.value);
    downloadStudioFile(new Blob([JSON.stringify(pack)], { type: 'application/json' }), 'playpets-background.json');
    status.value = t.value.bgSuccess;
  } catch {
    status.value = c.value.invalid;
  }
}
async function copy() {
  try {
    await navigator.clipboard.writeText(prompt.value);
    status.value = c.value.copied;
  } catch {
    status.value = c.value.fallback;
  }
}
function downloadPrompt() {
  downloadStudioFile(new Blob([prompt.value], { type: 'text/plain;charset=utf-8' }), 'playpets-background-prompt.txt');
}
</script>

<template>
<section class="background-kit studio-workspace" :aria-label="c.title">
  <div class="background-toolbar"><p class="background-note">{{ t.local }}</p>
  <details class="background-resume"><summary>{{ t.openSaved }} <span aria-hidden="true">↗</span></summary><StudioFile id="background-reopen" :label="t.bgOpen" :lang="lang" accept="application/json,.json" :disabled="!ready || busy" @change="reopen" /></details></div>
  <TabsRoot v-model="phase">
    <TabsList class="studio-tabs" :aria-label="c.title"><TabsTrigger v-for="(item,i) in phases" :key="item" :value="item" class="studio-tab"><strong><span class="studio-step" aria-hidden="true">{{ i + 1 }}</span>{{ t.bgPhases[i] }}</strong><span>{{ t.bgPhaseHints[i] }}</span></TabsTrigger></TabsList>
    <div class="background-grid" :class="{ 'background-has-art': !!images.base, 'background-exporting': phase === 'export' }">
      <div class="background-editor">
        <TabsContent value="layout" force-mount :hidden="phase !== 'layout'" class="studio-tab-panel">
          <fieldset class="background-starters"><legend>{{ t.starterTitle }}</legend>
            <button v-for="(id,i) in starterIds" :key="id" type="button" :aria-pressed="starter === id" @click="applyStarter(id)">
              <svg viewBox="0 0 120 64" aria-hidden="true"><path d="M8 46h104M8 52h104"/><template v-if="id === 'interior'"><rect x="28" y="8" width="64" height="30" rx="2"/><path d="M60 8v30M28 23h64"/></template><template v-else><path d="M8 36 30 19 52 36 78 14 112 36"/><circle cx="24" cy="10" r="5"/><ellipse v-if="id === 'lakeside'" cx="70" cy="39" rx="20" ry="4"/></template></svg>
              <strong>{{ t.starterNames[i] }}</strong><span>{{ t.starterHints[i] }}</span>
            </button>
          </fieldset>
          <p class="background-note">{{ t.starterHelp }}</p>
          <div class="background-form">      <label>{{ c.name }}<input v-model="name" maxlength="60" :aria-describedby="!name.trim() ? 'background-name-help' : undefined"></label>
      <p v-if="!name.trim()" id="background-name-help" class="background-note">{{ t.bgName }}</p>
      <label>{{ c.setting }}<textarea v-model="setting" maxlength="300" rows="2" /></label>
      <label class="background-check"><input v-model="indoor" type="checkbox">{{ c.indoor }}</label>
      <label class="background-check"><input v-model="weather" type="checkbox">{{ c.weather }}</label>
      <label class="background-check"><input v-model="ambient" type="checkbox" :disabled="indoor">{{ c.ambient }}</label>
      <label class="background-check"><input v-model="water" type="checkbox" :disabled="indoor">{{ c.water }}</label>
      <label>{{ c.floor }} · {{ Math.round(floor*100) }}%<input v-model.number="floor" type="range" min="0.5" max="0.80" step="0.01"></label>
      <label>{{ c.seasonPrompt }}<select v-model="season"><option v-for="(s,i) in seasons" :key="s" :value="s">{{ c.labels[i] }}</option></select></label>
      <div class="background-buttons"><button type="button" :disabled="!ready || !!geometryError" @click="sheet">{{ c.sheet }}</button></div>
      <p class="background-note">{{ t.bgNoUpload }}</p>
</div>
            <details class="background-prompt"><summary>{{ t.promptDetails }}</summary><textarea :value="geometryError ? '' : prompt" readonly rows="8" :aria-label="c.prompt" /></details>
  <div class="background-buttons"><button type="button" :disabled="!ready || !!geometryError" @click="copy">{{ c.copy }}</button><button type="button" :disabled="!ready || !!geometryError" @click="downloadPrompt">{{ t.bgPromptDownload }}</button></div>

          <button type="button" class="studio-primary" @click="goPhase('images')">{{ t.nextImages }} <span aria-hidden="true">→</span></button>
        </TabsContent>
        <TabsContent value="images" force-mount :hidden="phase !== 'images'" class="studio-tab-panel" id="studio-images">
            <p id="background-format" class="background-note">{{ t.bgFormat }}</p>
  <div class="background-files" :aria-busy="busy">
    <div v-for="key in ['base', ...(showSeasons ? seasons : [])]" :key="key" class="background-file">
      <StudioFile :id="`background-file-${key}`" :label="key === 'base' ? c.base : c.labels[seasons.indexOf(key)]" :lang="lang" accept="image/png,.png" :disabled="!ready || busy" :invalid="!!errors[key]" :describedby="errors[key] ? `background-error-${key}` : 'background-format'" @change="upload($event,key)" />
      <div v-if="images[key]" class="background-file-result"><span>{{ filenames[key] }}</span><button type="button" :disabled="!ready || busy" @click="remove(key)">{{ t.remove }}</button></div>
      <p v-if="errors[key]" :id="`background-error-${key}`" role="alert" class="background-error">{{ errors[key] }}</p>
    </div>
  </div>
  <button type="button" class="background-season-toggle" :aria-expanded="showSeasons" @click="showSeasons = !showSeasons">{{ t.seasonExtras }} <span v-if="seasons.some(key => images[key])">· {{ seasons.filter(key => images[key]).length }} / 4</span><span aria-hidden="true">{{ showSeasons ? '−' : '+' }}</span></button>
  <p v-if="busy" role="status">{{ t.checking }}</p>

          <button type="button" class="studio-primary" @click="goPhase('export')">{{ t.nextExport }} <span aria-hidden="true">→</span></button>
        </TabsContent>
        <TabsContent value="export" force-mount :hidden="phase !== 'export'" class="studio-tab-panel" id="studio-export">
            <h3 class="background-check-title">{{ t.exportChecks }}</h3>
            <ul class="background-readiness"><li v-for="(check,i) in checks" :key="check.key" :data-ready="check.ok"><span role="img" :aria-label="check.ok ? t.checkPassed : t.checkNeeded">{{ check.ok ? '✓' : '○' }}</span><span>{{ t.checkLabels[i] }}</span><button v-if="!check.ok" type="button" @click="goPhase(check.phase)">{{ t.bgPhases[phases.indexOf(check.phase)] }} <span aria-hidden="true">→</span></button></li></ul>
            <p class="background-note">{{ t.bgReview }}</p>
  <p class="background-note">{{ t.bgBudget }} · {{ (packageBytes / 1024 / 1024).toFixed(1) }} / 32 MiB</p>
  <p v-if="packageBytes > MAX_BACKGROUND_BYTES" class="background-error" role="alert">{{ t.bgBudgetError }}</p>
  <p v-if="!images.base" class="background-note">{{ t.bgMissing }}</p>
  <p v-if="!name.trim()" class="background-note">{{ t.bgName }}</p>
  <div class="background-buttons"><button type="button" class="studio-primary" :disabled="busy || !checks.every(check => check.ok)" @click="save">{{ c.save }}</button></div>
  <p class="background-note">{{ c.ready }}</p>
  <p class="background-note">{{ c.limits }}</p>

          <button type="button" @click="goPhase('layout')">{{ t.backLayout }}</button>
        </TabsContent>
      </div>
      <aside class="background-preview-panel">
        <h3 class="background-preview-title">{{ t.previewTitle }}</h3>
              <div class="background-preview-controls">
        <label>{{ t.bgCrop }}<select v-model="crop" :aria-label="t.bgCrop"><option v-for="(label,i) in t.bgCrops" :key="label" :value="i">{{ label }}</option></select></label>
        <label class="background-check"><input v-model="guides" type="checkbox">{{ t.bgGuide }}</label>
      </div>
      <div class="background-preview" :style="{aspectRatio: aspects[crop]}" :aria-label="c.preview" @pointerdown="place">
        <div class="background-art" :style="artworkStyle">
          <img v-if="images.base" :src="images[season] || images.base" :alt="c.preview">
          <svg v-if="guides" viewBox="0 0 1536 1024" aria-hidden="true">
            <rect :y="floor*1024" width="1536" :height="1024-floor*1024" fill="#9cdb9c55" stroke="#2f7c4f" stroke-width="4"/>
            <template v-if="indoor && weather"><rect v-for="(pane,index) in windows" :key="index" :x="pane.x*1536" :y="pane.y*1024" :width="pane.width*1536" :height="pane.height*1024" fill="#80c9eb55" stroke="#326581" stroke-width="3"/></template>
            <ellipse v-if="water && !indoor" :cx="(waterShape.from+waterShape.to)*768" :cy="waterShape.center*1024" :rx="(waterShape.to-waterShape.from)*768" :ry="waterShape.radius*1024" fill="#80c9eb88" stroke="#326581" stroke-width="3"/>
            <circle v-if="water && !indoor" :cx="fishingSpot.x*1536" :cy="fishingSpot.y*1024" r="18" fill="#d96b42" stroke="white" stroke-width="4"/>
          </svg>
        </div>
        <p v-if="!images.base">{{ c.empty }}</p>
      </div>
        <CollapsibleRoot v-model:open="advanced" class="studio-advanced">
          <CollapsibleTrigger class="studio-disclosure">{{ t.advanced }} <span aria-hidden="true">{{ advanced ? '−' : '+' }}</span></CollapsibleTrigger>
          <CollapsibleContent>
      <p class="background-note">{{ t.bgCropHelp }}</p>
      <p v-if="images.base && !images[season]" class="background-note">{{ t.bgFallback }}</p>
      <p class="background-note">{{ c.panes }}</p>

      <div v-if="water && !indoor" class="geometry-editor">
        <label>{{ c.placement }}<select v-model="placement"><option value="water">{{ c.waterPosition }}</option><option value="stand">{{ c.stand }}</option></select></label>
        <label v-for="(key,i) in ['from','to','center','radius']" :key="key">{{ c.waterFields[i] }}<input v-model.number="waterShape[key]" type="number" min="0" max="1" step=".005"></label>
        <label>{{ c.stand }} X<input v-model.number="fishingSpot.x" type="number" min=".02" max=".98" step=".01"></label><label>{{ c.stand }} Y<input v-model.number="fishingSpot.y" type="number" :min="floor" max=".94" step=".01"></label>
      </div>
      <div v-if="indoor">
        <fieldset v-for="(pane,index) in windows" :key="index" class="geometry-editor"><legend>{{ t.bgWindow }} {{ index+1 }}</legend>
          <label v-for="(key,i) in ['x','y','width','height']" :key="key">{{ c.windowFields[i] }}<input v-model.number="pane[key]" type="number" min="0" max="1" step=".01"></label>
          <button type="button" :disabled="!ready || busy" @click="windows.splice(index,1)">{{ t.bgRemoveWindow }}</button>
        </fieldset>
        <button type="button" :disabled="windows.length >= 12 || busy" @click="windows.push({x: .26,y: .12,width: .2,height: .3})">{{ t.bgAddWindow }}</button>
      </div>
</CollapsibleContent>
        </CollapsibleRoot>
        <p v-if="geometryError" role="alert" class="background-error">{{ geometryError }}</p>
      </aside>
    </div>
  </TabsRoot>
  <p role="status" aria-live="polite">{{ status }}</p>
</section>
</template>

<style scoped>
.background-kit { margin: 32px 0; min-width: 0; }
.background-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 32px; }
.background-form { display: grid; gap: 14px; align-content: start; padding-top: 16px; border-top: 1px solid var(--vp-c-divider); }
.background-kit label { display: grid; gap: 6px; font-size: 14px; font-weight: 600; }
.background-kit .background-check { min-height: 44px; display: flex; align-items: center; gap: 10px; }
.background-kit input:not([type=checkbox]):not([type=range]), .background-kit select, .background-kit textarea { width: 100%; min-height: 44px; padding: 10px; border: 1px solid var(--vp-c-divider); border-radius: var(--studio-radius, 10px); background: var(--vp-c-bg); color: var(--vp-c-text-1); font: inherit; }
.background-kit input[type=file] { font-size: 14px; }
.background-kit input[type=checkbox], .background-kit input[type=range] { accent-color: var(--vp-c-brand-1); }
.background-kit input[type=range] { min-height: 32px; width: 100%; }
.background-kit textarea { font-size: 13px; line-height: 1.7; resize: vertical; margin-bottom: 12px; }
.background-preview-panel { min-width: 0; align-self: start; position: sticky; top: 88px; }
.background-editor { min-width: 0; }
.background-preview-controls { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; flex-wrap: wrap; }
.background-preview { position: relative; border: 1px solid var(--vp-c-divider); border-radius: 14px; overflow: hidden; background: #d5e7eb; }
.background-art { position: absolute; }
.background-art img, .background-art svg { position: absolute; inset: 0; width: 100%; height: 100%; max-width: none; }
.background-preview > p { position: relative; padding: 20px; color: #244049; font-size: 14px; }
.background-note { font-size: 13px; line-height: 1.7; color: var(--vp-c-text-2); margin: 8px 0 14px; }
.background-buttons { display: flex; gap: 10px; flex-wrap: wrap; }
.background-kit :where(button:not(.studio-tab)) { min-height: 44px; border: 1px solid var(--vp-c-divider); border-radius: var(--studio-radius, 10px); padding: 10px 16px; background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); font-size: 14px; font-weight: 600; cursor: pointer; }
.background-kit button:disabled { opacity: .45; cursor: default; }
.background-kit :focus-visible { outline: 3px solid var(--vp-c-brand-1); outline-offset: 3px; }
.geometry-editor { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; margin: 18px 0; padding: 0; border: 0; min-width: 0; }
.geometry-editor legend { margin-bottom: 10px; font-weight: 600; }
.geometry-editor label { font-size: 12px; }
.background-files { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
.background-file { min-width: 0; padding: 16px; background: var(--vp-c-bg-soft); border-radius: 12px; }
.background-file label { margin-bottom: 8px; }
.background-file-result { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 8px; font-size: 12px; overflow-wrap: anywhere; }
.background-file-result button { padding: 6px 10px; }
.background-error { color: var(--vp-c-danger-1); font-size: 13px; }

.background-toolbar { display: flex; align-items: start; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
.background-toolbar > p { max-width: 54ch; margin: 0; }
.background-resume { flex: 0 0 auto; max-width: 45%; }
.background-resume summary, .background-prompt summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; gap: 8px; color: var(--vp-c-brand-1); font-weight: 600; font-size: 13px; margin: 0; }
.background-resume[open] { max-width: 340px; }
.background-resume :deep(.studio-file-control) { margin-top: 12px; }
.background-starters { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; border: 0; margin: 0; padding: 0; min-width: 0; }
.background-starters legend { font-size: 16px; font-weight: 600; margin-bottom: 12px; }
.background-kit .background-starters button { padding: 10px 8px; text-align: left; min-width: 0; background: var(--vp-c-bg); }
.background-kit .background-starters button[aria-pressed=true] { border-color: var(--vp-c-brand-1); background: var(--vp-c-brand-soft); box-shadow: inset 0 0 0 1px var(--vp-c-brand-1); }
.background-starters svg { display: block; width: 100%; height: 52px; fill: none; stroke: var(--vp-c-brand-1); stroke-width: 1.8; }
.background-starters strong { display: block; font-size: 14px; }
.background-starters span { display: block; font-size: 11px; line-height: 1.5; font-weight: 400; color: var(--vp-c-text-2); margin-top: 4px; word-break: keep-all; overflow-wrap: anywhere; }
.background-kit .background-preview-title { font-size: 15px; margin: 0 0 16px; border: 0; }
.background-preview-controls label { font-size: 12px; }
.background-kit .background-check-title { margin-top: 0; }
.background-readiness { list-style: none; padding: 0; margin: 16px 0 24px; }
.background-readiness li { display: flex; align-items: center; gap: 10px; min-height: 52px; border-bottom: 1px solid var(--vp-c-divider); font-size: 14px; }
.background-readiness li > span:first-child { color: var(--vp-c-text-2); }
.background-readiness li[data-ready=true] > span:first-child { color: var(--vp-c-brand-1); }
.background-kit .background-readiness button { margin-left: auto; padding: 8px; font-size: 12px; background: none; border: 0; }
.background-prompt { margin: 20px 0 12px; border-top: 1px solid var(--vp-c-divider); }
.background-prompt textarea { margin-top: 12px; }
.background-kit .background-season-toggle { display: flex; align-items: center; justify-content: space-between; width: 100%; margin-top: 16px; background: none; }
@media (max-width: 700px) { .background-toolbar { flex-direction: column; gap: 4px; } .background-resume { max-width: 100%; } .background-preview-panel { padding-bottom: 20px; border-bottom: 1px solid var(--vp-c-divider); } }

@media (max-width: 700px) { .background-preview-panel { position: static; grid-row: 2; } .background-editor { grid-row: 1; } .background-has-art:not(.background-exporting) .background-preview-panel { grid-row: 1; } .background-has-art:not(.background-exporting) .background-editor { grid-row: 2; } .background-grid, .background-files { grid-template-columns: minmax(0, 1fr); } }
</style>
