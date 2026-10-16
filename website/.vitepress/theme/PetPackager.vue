<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { animationSpec, frameAt } from '../../../src/core/animation.js';
import { studioCopy } from './studio-copy.js';
import {
  downloadStudioFile,
  petPackageEntries,
  petStates,
  readStudioImage,
  studioSeasons,
  studioZip,
} from './studio-files.mjs';

const props = defineProps({ lang: { type: String, default: 'en' } });
const t = computed(() => studioCopy[props.lang] || studioCopy.en);
const meta = ref({ id: '', name: '', description: '', kind: 'animal' });
const sheets = ref({}),
  errors = ref({}),
  busy = ref(false),
  notice = ref('');
const ready = ref(false);
const showSeasons = ref(false);
const selected = ref('base'),
  action = ref('idle'),
  frame = ref(0),
  playing = ref(false),
  mini = ref(false),
  canvas = ref(null);
const current = computed(() => sheets.value[selected.value]);
const states = [...petStates, 'gaze'];
const frames = computed(() => (action.value === 'gaze' ? 16 : animationSpec(action.value).frames));
const validMeta = computed(() => /^[a-z0-9][a-z0-9_-]{0,63}$/.test(meta.value.id) && !!meta.value.name.trim());
let active = true,
  timer,
  media,
  reduced = ref(false),
  started = 0;
function paint() {
  const context = canvas.value?.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, 192, 208);
  if (!current.value) return;
  const position =
    action.value === 'gaze'
      ? { row: 9 + Math.floor(frame.value / 8), column: frame.value % 8 }
      : { row: animationSpec(action.value).row, column: frame.value };
  context.drawImage(current.value.image, position.column * 192, position.row * 208, 192, 208, 0, 0, 192, 208);
}
function stop() {
  playing.value = false;
  clearTimeout(timer);
}
function tick() {
  if (!active || !playing.value || reduced.value) return stop();
  frame.value =
    action.value === 'gaze'
      ? Math.floor((performance.now() - started) / 160) % 16
      : frameAt(action.value, performance.now() - started).column;
  paint();
  timer = setTimeout(tick, 50);
}
function toggle() {
  if (playing.value) return stop();
  if (reduced.value) return;
  playing.value = true;
  started = performance.now();
  tick();
}
watch([action, selected], () => {
  stop();
  frame.value = 0;
  paint();
});
watch(frame, paint);
async function upload(event, key) {
  const input = event.target,
    file = input.files?.[0];
  if (!file) return;
  stop();
  busy.value = true;
  errors.value[key] = '';
  notice.value = '';
  try {
    const result = await readStudioImage(file, 'pet');
    if (!active) return;
    sheets.value[key] = { ...result, filename: file.name };
    selected.value = key;
    paint();
  } catch (error) {
    if (active) errors.value[key] = t.value.errors[error.message] || t.value.errors.decode;
  } finally {
    input.value = '';
    if (active) busy.value = false;
  }
}
function remove(key) {
  stop();
  delete sheets.value[key];
  delete errors.value[key];
  if (selected.value === key) selected.value = 'base';
  paint();
}
function save() {
  notice.value = '';
  try {
    const entries = petPackageEntries(
      meta.value,
      Object.fromEntries(Object.entries(sheets.value).map(([key, value]) => [key, value.bytes])),
    );
    downloadStudioFile(new Blob([studioZip(entries)], { type: 'application/zip' }), `${meta.value.id}.zip`);
    notice.value = t.value.exported;
  } catch {
    notice.value = t.value.identity;
  }
}
onMounted(() => {
  ready.value = true;
  media = matchMedia('(prefers-reduced-motion: reduce)');
  motion();
  media.addEventListener('change', motion);
  document.addEventListener('visibilitychange', visibility);
  paint();
});
function visibility() {
  if (document.hidden) stop();
}
function motion() {
  reduced.value = media.matches;
  if (reduced.value) stop();
}
onBeforeUnmount(() => {
  active = false;
  stop();
  media?.removeEventListener('change', motion);
  document.removeEventListener('visibilitychange', visibility);
});
</script>

<template>
  <section class="pet-packager" aria-labelledby="pet-package-title">
    <h2 id="pet-package-title">{{ t.petTitle }}</h2>
    <p>{{ t.petLead }}</p>
    <p class="studio-local">{{ t.local }}</p>
    <div class="pet-package-grid">
      <div class="pet-package-fields">
        <label>{{ t.name }}<input v-model="meta.name" maxlength="60" autocomplete="off"></label>
        <label>{{ t.id }}<input v-model="meta.id" maxlength="64" pattern="[a-z0-9][a-z0-9_-]{0,63}" autocomplete="off" aria-describedby="pet-id-help"></label>
        <p id="pet-id-help" class="studio-help">{{ t.idHelp }}</p>
        <label>{{ t.kind }}<select v-model="meta.kind"><option v-for="(kind,i) in ['person','animal','other']" :key="kind" :value="kind">{{ t.kinds[i] }}</option></select></label>
        <label>{{ t.description }}<textarea v-model="meta.description" maxlength="300" rows="2" aria-describedby="pet-description-help" /></label>
        <p id="pet-description-help" class="studio-help">{{ t.descriptionHelp }} · {{ meta.description.length }} / 300</p>
        <p id="pet-file-format" class="studio-help">{{ t.format }}</p>
        <button type="button" :aria-expanded="showSeasons" @click="showSeasons = !showSeasons">{{ t.seasonFiles }}</button>
        <div v-for="key in ['base', ...(showSeasons ? studioSeasons : [])]" :key="key" class="pet-file">
          <label :for="`pet-file-${key}`">{{ key === 'base' ? t.base : t.seasons[studioSeasons.indexOf(key)] }}</label>
          <input :id="`pet-file-${key}`" type="file" accept="image/png,.png" :disabled="!ready || busy" :aria-invalid="!!errors[key]" :aria-describedby="errors[key] ? `pet-error-${key}` : 'pet-file-format'" @change="upload($event,key)">
          <div v-if="sheets[key]" class="pet-file-result"><span>{{ sheets[key].filename }}</span><button type="button" :disabled="!ready || busy" @click="remove(key)">{{ t.remove }}</button></div>
          <p v-if="errors[key]" :id="`pet-error-${key}`" role="alert" class="studio-error">{{ errors[key] }}</p>
        </div>
      </div>
      <div class="pet-package-preview" :aria-busy="busy">
        <div class="pet-preview-stage" :class="{ mini }"><canvas ref="canvas" width="192" height="208" role="img" :aria-label="t.preview" /><p v-if="!current">{{ t.emptyPreview }}</p></div>
        <template v-if="current">
          <label>{{ t.sheet }}<select v-model="selected"><option v-for="key in Object.keys(sheets)" :key="key" :value="key">{{ key === 'base' ? t.baseLabel : t.seasons[studioSeasons.indexOf(key)] }}</option></select></label>
          <label>{{ t.action }}<select v-model="action"><option v-for="(state,i) in states" :key="state" :value="state">{{ t.actions[i] }}</option></select></label>
          <label>{{ t.frame }} · {{ frame + 1 }} / {{ frames }}<input v-model.number="frame" type="range" min="0" :max="frames-1" step="1" @pointerdown="stop" @keydown="stop"></label>
          <div class="pet-playback"><button type="button" :disabled="reduced" @click="toggle">{{ playing ? t.pause : t.play }}</button><label><input v-model="mini" type="checkbox">{{ t.mini }}</label></div>
          <p v-if="reduced" class="studio-help">{{ t.reduced }}</p>
          <p class="studio-checked">{{ t.checked }}</p>
          <p v-if="current.report.edges.length" class="studio-help">{{ t.edge }} {{ current.report.edges.join(', ') }}</p>
        </template>
        <p v-if="busy" role="status">{{ t.checking }}</p>
        <p class="studio-help">{{ t.quality }}</p>
        <button type="button" class="pet-export" :disabled="!sheets.base || !validMeta || busy" @click="save">{{ t.export }}</button>
        <p role="status" aria-live="polite">{{ notice }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pet-packager { margin: 48px 0; min-width: 0; }
.studio-local { padding: 14px 18px; border-left: 3px solid var(--vp-c-brand-1); background: var(--vp-c-bg-soft); font-size: 14px; }
.pet-package-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 28px; margin-top: 24px; }
.pet-package-fields, .pet-package-preview { display: grid; align-content: start; gap: 14px; min-width: 0; }
label { display: grid; gap: 6px; font-size: 14px; font-weight: 600; }
input:not([type=checkbox]):not([type=range]), select, textarea { width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid var(--vp-c-divider); border-radius: 10px; background: var(--vp-c-bg); color: var(--vp-c-text-1); font: inherit; }
input[type=file] { font-size: 12px !important; }
input[type=checkbox], input[type=range] { accent-color: var(--vp-c-brand-1); }
input[type=range] { width: 100%; min-height: 32px; }
textarea { resize: vertical; }
.studio-help { color: var(--vp-c-text-2); font-size: 13px; line-height: 1.7; margin: 0; }
.pet-file { padding-top: 12px; border-top: 1px solid var(--vp-c-divider); }
.pet-file > label { margin-bottom: 8px; }
.pet-file-result { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; overflow-wrap: anywhere; }
.pet-file-result button { padding: 6px 10px; }
.pet-preview-stage { position: relative; min-height: 280px; display: grid; place-items: center; padding: 24px; border: 1px solid var(--vp-c-divider); border-radius: 20px; background: repeating-conic-gradient(var(--vp-c-bg-soft) 0% 25%, var(--vp-c-bg) 0% 50%) 0 0 / 24px 24px; }
.pet-preview-stage canvas { width: 176px; height: auto; max-width: 100%; }
.pet-preview-stage.mini canvas { width: 96px; }
.pet-preview-stage p { position: absolute; padding: 20px; text-align: center; color: var(--vp-c-text-2); }
.pet-playback { display: flex; gap: 20px; align-items: center; }
.pet-playback label { display: flex; align-items: center; gap: 8px; }
button { min-height: 44px; padding: 10px 16px; border: 1px solid var(--vp-c-divider); border-radius: 10px; background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); font: inherit; cursor: pointer; }
button:disabled { opacity: .5; cursor: default; }
.pet-export { background: var(--vp-c-brand-1); color: var(--vp-c-bg); font-weight: 600; }
.studio-error { color: var(--vp-c-danger-1); font-size: 13px; }
.studio-checked { color: var(--vp-c-text-1); font-size: 13px; border-left: 3px solid var(--vp-c-brand-1); padding-left: 12px; }
:focus-visible { outline: 3px solid var(--vp-c-brand-1); outline-offset: 3px; }
@media (max-width: 640px) { .pet-package-grid { grid-template-columns: minmax(0, 1fr); } }
</style>
