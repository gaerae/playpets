<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { backgroundPrompt, backgroundSheet } from '../../../scripts/background-specs.mjs';
import { validateBackgroundGeometry, validateBackgroundPack } from '../../../src/yard/background-pack.js';
import { backgroundCopy } from './background-copy.js';

const props = defineProps({ lang: { type: String, default: 'en' } });
const c = computed(() => backgroundCopy[props.lang] || backgroundCopy.en);
const name = ref(''),
  setting = ref(''),
  indoor = ref(false),
  weather = ref(true),
  ambient = ref(false),
  water = ref(false),
  floor = ref(0.67),
  season = ref('summer'),
  images = ref({}),
  status = ref(''),
  busy = ref(false);
const seasons = ['spring', 'summer', 'autumn', 'winter'];
const prompt = computed(() =>
  backgroundPrompt({
    setting: setting.value || 'a cozy lakeside garden',
    indoor: indoor.value,
    season: season.value,
    floor: floor.value,
    water: water.value && !indoor.value ? waterShape : null,
    fishingSpot,
    pane: indoor.value && weather.value ? pane : null,
  }),
);
const waterShape = reactive({ from: 0.4, to: 0.68, center: 0.6, radius: 0.025 });
const fishingSpot = reactive({ x: 0.43, y: 0.74 });
watch(floor, value => {
  fishingSpot.y = Math.max(value, fishingSpot.y);
});
const placement = ref('water');
const pane = reactive({ x: 0.26, y: 0.12, width: 0.52, height: 0.36 });
const geometryError = computed(() => {
  try {
    validateBackgroundGeometry({
      floor: floor.value,
      water: water.value && !indoor.value ? waterShape : null,
      fishingSpot: water.value && !indoor.value ? fishingSpot : null,
      windows: indoor.value && weather.value ? [pane] : [],
    });
    return '';
  } catch (error) {
    return c.value.geometryErrors[error.message] || c.value.invalid;
  }
});
function place(event) {
  if (!water.value || indoor.value) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const x = Math.max(0.02, Math.min(0.98, (event.clientX - rect.left) / rect.width));
  const y = (event.clientY - rect.top) / rect.height;
  if (placement.value === 'stand') {
    fishingSpot.x = x;
    fishingSpot.y = Math.max(floor.value, Math.min(0.94, y));
  } else {
    const width = waterShape.to - waterShape.from;
    const cx = Math.max(width / 2, Math.min(1 - width / 2, x));
    waterShape.from = cx - width / 2;
    waterShape.to = cx + width / 2;
    waterShape.center = Math.max(waterShape.radius, Math.min(floor.value - waterShape.radius, y));
  }
}
async function upload(event, key) {
  const file = event.target.files?.[0];
  if (!file) {
    delete images.value[key];
    return;
  }
  busy.value = true;
  status.value = '';
  try {
    if (file.size > 6 * 1024 * 1024) throw Error();
    const url = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    const img = new Image();
    img.src = url;
    await img.decode();
    if (img.naturalWidth !== 1536 || img.naturalHeight !== 1024 || !url.startsWith('data:image/png;base64,'))
      throw Error();
    images.value[key] = url;
  } catch {
    delete images.value[key];
    event.target.value = '';
    status.value = c.value.invalid;
  } finally {
    busy.value = false;
  }
}
function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function sheet() {
  if (geometryError.value) return;
  try {
    const blob = new Blob(
      [
        backgroundSheet({
          floor: floor.value,
          indoor: indoor.value,
          water: water.value && !indoor.value ? waterShape : null,
          fishingSpot,
          pane: indoor.value && weather.value ? pane : null,
        }),
      ],
      { type: 'image/svg+xml' },
    );
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 1536;
    canvas.height = 1024;
    canvas.getContext('2d').drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob(b => {
      if (b) download(b, 'playpets-layout.png');
    });
  } catch {
    status.value = c.value.invalid;
  }
}
function save() {
  if (geometryError.value) return;
  try {
    const pack = validateBackgroundPack({
      format: 'playpets-background',
      version: 1,
      name: name.value,
      images: images.value,
      floor: floor.value,
      sky: !indoor.value,
      weather: weather.value,
      ambient: ambient.value && !indoor.value,
      water: water.value && !indoor.value ? waterShape : null,
      fishingSpot: water.value && !indoor.value ? fishingSpot : null,
      windows: indoor.value && weather.value ? [pane] : [],
    });
    download(new Blob([JSON.stringify(pack)], { type: 'application/json' }), 'playpets-background.json');
    status.value = c.value.ready;
  } catch {
    status.value = c.value.invalid;
  }
}
async function copy() {
  if (geometryError.value) return;
  try {
    await navigator.clipboard.writeText(prompt.value);
    status.value = c.value.copied;
  } catch {
    status.value = c.value.fallback;
  }
}
</script>
<template>
<section class="background-kit">
  <h2>{{c.title}}</h2><p>{{c.lead}}</p>
  <div class="background-grid">
    <div class="background-form">
      <label>{{c.name}}<input v-model="name" maxlength="60"></label>
      <label>{{c.setting}}<input v-model="setting" maxlength="300"></label>
      <label class="background-check"><input type="checkbox" v-model="indoor">{{c.indoor}}</label>
      <label class="background-check"><input type="checkbox" v-model="weather">{{c.weather}}</label>
      <label class="background-check"><input type="checkbox" v-model="ambient" :disabled="indoor">{{c.ambient}}</label>
      <label class="background-check"><input type="checkbox" v-model="water" :disabled="indoor">{{c.water}}</label>
      <label>{{c.floor}} · {{Math.round(floor*100)}}%<input type="range" min="0.65" max="0.80" step="0.01" v-model.number="floor"></label>
      <label>{{c.base}}<input type="file" accept="image/png" @change="upload($event,'base')" :disabled="busy"></label>
      <details><summary>{{c.seasons}}</summary><label v-for="(s,i) in seasons" :key="s">{{c.labels[i]}}<input type="file" accept="image/png" @change="upload($event,s)" :disabled="busy"></label></details>
    </div>
    <div>
      <div class="background-preview" :aria-label="c.preview" @pointerdown="place">
        <img v-if="images.base" :src="images[season] || images.base" :alt="c.preview">
        <p v-else>{{c.empty}}</p>
        <svg viewBox="0 0 1536 1024" aria-hidden="true"><rect :y="floor*1024" width="1536" :height="1024-floor*1024" fill="#9cdb9c55" stroke="#2f7c4f" stroke-width="4"/><rect v-if="indoor&&weather" :x="pane.x*1536" :y="pane.y*1024" :width="pane.width*1536" :height="pane.height*1024" fill="#80c9eb55" stroke="#326581" stroke-width="3"/><ellipse v-if="water&&!indoor" :cx="(waterShape.from+waterShape.to)*768" :cy="waterShape.center*1024" :rx="(waterShape.to-waterShape.from)*768" :ry="waterShape.radius*1024" fill="#80c9eb88" stroke="#326581" stroke-width="3"/><circle v-if="water&&!indoor" :cx="fishingSpot.x*1536" :cy="fishingSpot.y*1024" r="18" fill="#d96b42" stroke="white" stroke-width="4"/></svg>
      </div>
      <p class="background-note">{{c.panes}}</p>
      <div v-if="water&&!indoor" class="geometry-editor">
        <label>{{c.placement}}<select v-model="placement"><option value="water">{{c.waterPosition}}</option><option value="stand">{{c.stand}}</option></select></label>
        <label v-for="(key,i) in ['from','to','center','radius']" :key="key">{{c.waterFields[i]}}<input type="number" min="0" max="1" step=".005" v-model.number="waterShape[key]"></label>
        <label>{{c.stand}} X<input type="number" min=".02" max=".98" step=".01" v-model.number="fishingSpot.x"></label><label>{{c.stand}} Y<input type="number" :min="floor" max=".94" step=".01" v-model.number="fishingSpot.y"></label>
      </div>
      <div v-if="indoor&&weather" class="geometry-editor"><label v-for="(key,i) in ['x','y','width','height']" :key="key">{{c.windowFields[i]}}<input type="number" min="0" max="1" step=".01" v-model.number="pane[key]"></label></div>
      <p v-if="geometryError" role="alert">{{geometryError}}</p>
      <div class="background-buttons"><button @click="sheet" :disabled="!!geometryError">{{c.sheet}}</button><button @click="save" :disabled="!images.base||!name.trim()||busy||!!geometryError">{{c.save}}</button></div>
      <p>{{c.ready}}</p>
    </div>
  </div>
  <p class="background-note">{{c.limits}}</p>
  <label class="background-season">{{c.seasonPrompt}}<select v-model="season"><option v-for="(s,i) in seasons" :key="s" :value="s">{{c.labels[i]}}</option></select></label>
  <h3>{{c.prompt}}</h3><textarea :value="geometryError ? '' : prompt" readonly rows="9" :aria-label="c.prompt"></textarea>
  <button @click="copy" :disabled="!!geometryError">{{c.copy}}</button><p role="status" aria-live="polite">{{status}}</p>
</section>
</template>
<style scoped>
.geometry-editor{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px}.geometry-editor label{font-size:12px}.geometry-editor input{width:100%;padding:6px;border:1px solid var(--vp-c-divider);border-radius:6px}.background-kit{margin:32px 0;padding:28px;border:1px solid var(--vp-c-divider);border-radius:20px;background:var(--vp-c-bg-soft)}
.background-grid{display:grid;grid-template-columns:minmax(220px,1fr) minmax(0,1.5fr);gap:28px}.background-form{display:grid;gap:15px}.background-form label{display:grid;gap:6px;font-size:14px;font-weight:600}.background-form .background-check{display:flex;align-items:center;gap:10px}.background-kit input:not([type=checkbox]):not([type=range]),.background-kit select,.background-kit textarea{width:100%;padding:10px;border:1px solid var(--vp-c-divider);border-radius:8px;background:var(--vp-c-bg);color:var(--vp-c-text-1);font:inherit}.background-kit input[type=file]{font-size:12px!important}.background-kit textarea{font-size:13px;line-height:1.6;resize:vertical;margin-bottom:12px}.background-preview{position:relative;aspect-ratio:3/2;border-radius:12px;overflow:hidden;background:#d5e7eb}.background-preview img,.background-preview svg{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}.background-preview p{padding:20px;color:#244049}.background-note{font-size:13px;line-height:1.7;color:var(--vp-c-text-2)}.background-buttons{display:flex;gap:10px;flex-wrap:wrap}.background-kit button{border-radius:9px;padding:10px 16px;background:var(--vp-c-brand-1);color:var(--vp-c-white);font-size:13px;font-weight:600;cursor:pointer}.background-kit button:disabled{opacity:.45;cursor:default}.background-kit :focus-visible{outline:2px solid var(--vp-c-brand-1);outline-offset:3px}.background-season{display:flex;align-items:center;gap:12px}.background-season select{width:auto}summary{cursor:pointer}details label{margin-top:12px}@media(max-width:700px){.background-kit{padding:18px}.background-grid{grid-template-columns:1fr}}
</style>
