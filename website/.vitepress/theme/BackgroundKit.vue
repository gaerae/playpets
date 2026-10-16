<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { backgroundPrompt, backgroundSheet } from '../../../scripts/background-specs.mjs';
import {
  MAX_BACKGROUND_BYTES,
  validateBackgroundGeometry,
  validateBackgroundPack,
} from '../../../src/yard/background-pack.js';
import { backgroundCopy } from './background-copy.js';
import { studioCopy } from './studio-copy.js';
import {
  backgroundPackageSize,
  backgroundPreviewFrame,
  downloadStudioFile,
  readStudioImage,
  studioSeasons,
} from './studio-files.mjs';

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
const seasons = studioSeasons;
const waterShape = reactive({ from: 0.4, to: 0.68, center: 0.6, radius: 0.025 });
const fishingSpot = reactive({ x: 0.43, y: 0.74 });
const windows = ref([{ x: 0.26, y: 0.12, width: 0.52, height: 0.36 }]);
const placement = ref('water'),
  guides = ref(true),
  crop = ref(0);
const aspects = [1.5, 1.6, 4 / 3, 3 / 4];
const ready = ref(false);
onMounted(() => {
  ready.value = true;
});
let active = true;
onBeforeUnmount(() => {
  active = false;
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
  if (crop.value !== 0 || !water.value || indoor.value || geometryError.value) return;
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
<section class="background-kit" :aria-label="c.title">
  <h2>{{ c.title }}</h2><p>{{ c.lead }}</p>
  <p class="background-note">{{ t.local }}</p>
  <label class="background-reopen">{{ t.bgOpen }}<input type="file" accept="application/json,.json" :disabled="!ready || busy" @change="reopen"></label>
  <h3>{{ t.bgSteps[0] }}</h3>
  <div class="background-grid">
    <div class="background-form">
      <label>{{ c.name }}<input v-model="name" maxlength="60" :aria-describedby="!name.trim() ? 'background-name-help' : undefined"></label>
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
    <div class="background-preview-panel">
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
      <p v-if="geometryError" role="alert" class="background-error">{{ geometryError }}</p>
    </div>
  </div>
  <h3>{{ c.prompt }}</h3><textarea :value="geometryError ? '' : prompt" readonly rows="7" :aria-label="c.prompt" />
  <div class="background-buttons"><button type="button" :disabled="!ready || !!geometryError" @click="copy">{{ c.copy }}</button><button type="button" :disabled="!ready || !!geometryError" @click="downloadPrompt">{{ t.bgPromptDownload }}</button></div>
  <h3>{{ t.bgSteps[1] }}</h3>
  <p id="background-format" class="background-note">{{ t.bgFormat }}</p>
  <div class="background-files" :aria-busy="busy">
    <div v-for="(key,i) in ['base', ...seasons]" :key="key" class="background-file">
      <label :for="`background-file-${key}`">{{ key === 'base' ? c.base : c.labels[i-1] }}</label>
      <input :id="`background-file-${key}`" type="file" accept="image/png,.png" :disabled="!ready || busy" :aria-invalid="!!errors[key]" :aria-describedby="errors[key] ? `background-error-${key}` : 'background-format'" @change="upload($event,key)">
      <div v-if="images[key]" class="background-file-result"><span>{{ filenames[key] }}</span><button type="button" :disabled="!ready || busy" @click="remove(key)">{{ t.remove }}</button></div>
      <p v-if="errors[key]" :id="`background-error-${key}`" role="alert" class="background-error">{{ errors[key] }}</p>
    </div>
  </div>
  <p v-if="busy" role="status">{{ t.checking }}</p>
  <h3>{{ t.bgSteps[2] }}</h3>
  <p class="background-note">{{ t.bgReview }}</p>
  <p class="background-note">{{ t.bgBudget }} · {{ (packageBytes / 1024 / 1024).toFixed(1) }} / 32 MiB</p>
  <p v-if="packageBytes > MAX_BACKGROUND_BYTES" class="background-error" role="alert">{{ t.bgBudgetError }}</p>
  <p v-if="!images.base" class="background-note">{{ t.bgMissing }}</p>
  <div class="background-buttons"><button type="button" :disabled="!images.base || !name.trim() || busy || !!geometryError || packageBytes > MAX_BACKGROUND_BYTES" @click="save">{{ c.save }}</button></div>
  <p class="background-note">{{ c.ready }}</p>
  <p class="background-note">{{ c.limits }}</p>
  <p role="status" aria-live="polite">{{ status }}</p>
</section>
</template>
<style scoped>
.background-kit { margin: 32px 0; min-width: 0; }
.background-grid { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: 28px; }
.background-form { display: grid; gap: 15px; align-content: start; }
.background-kit label { display: grid; gap: 6px; font-size: 14px; font-weight: 600; }
.background-kit .background-check { display: flex; align-items: center; gap: 10px; }
.background-kit input:not([type=checkbox]):not([type=range]), .background-kit select, .background-kit textarea { width: 100%; min-height: 44px; padding: 10px; border: 1px solid var(--vp-c-divider); border-radius: 10px; background: var(--vp-c-bg); color: var(--vp-c-text-1); font: inherit; }
.background-kit input[type=file] { font-size: 12px !important; }
.background-kit input[type=checkbox], .background-kit input[type=range] { accent-color: var(--vp-c-brand-1); }
.background-kit input[type=range] { min-height: 32px; width: 100%; }
.background-kit textarea { font-size: 13px; line-height: 1.7; resize: vertical; margin-bottom: 12px; }
.background-preview-panel { min-width: 0; }
.background-preview-controls { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; flex-wrap: wrap; }
.background-preview { position: relative; border: 1px solid var(--vp-c-divider); border-radius: 14px; overflow: hidden; background: #d5e7eb; }
.background-art { position: absolute; }
.background-art img, .background-art svg { position: absolute; inset: 0; width: 100%; height: 100%; max-width: none; }
.background-preview > p { position: relative; padding: 20px; color: #244049; font-size: 14px; }
.background-note { font-size: 13px; line-height: 1.7; color: var(--vp-c-text-2); margin: 8px 0 14px; }
.background-buttons { display: flex; gap: 10px; flex-wrap: wrap; }
.background-kit button { min-height: 44px; border: 1px solid var(--vp-c-divider); border-radius: 10px; padding: 10px 16px; background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); font-size: 14px; font-weight: 600; cursor: pointer; }
.background-kit button:disabled { opacity: .45; cursor: default; }
.background-kit :focus-visible { outline: 3px solid var(--vp-c-brand-1); outline-offset: 3px; }
.geometry-editor { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; margin: 18px 0; padding: 0; border: 0; min-width: 0; }
.geometry-editor legend { margin-bottom: 10px; font-weight: 600; }
.geometry-editor label { font-size: 12px; }
.background-files { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.background-file { min-width: 0; padding: 16px; background: var(--vp-c-bg-soft); border-radius: 12px; }
.background-file label { margin-bottom: 8px; }
.background-file-result { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 8px; font-size: 12px; overflow-wrap: anywhere; }
.background-file-result button { padding: 6px 10px; }
.background-error { color: var(--vp-c-danger-1); font-size: 13px; }
.background-reopen { max-width: 480px; margin: 24px 0; }
@media (max-width: 700px) { .background-grid, .background-files { grid-template-columns: minmax(0, 1fr); } }
</style>
