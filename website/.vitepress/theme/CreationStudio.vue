<script setup>
import { withBase } from 'vitepress';
import { computed, onMounted, ref } from 'vue';
import { backgroundSheet } from '../../../scripts/background-specs.mjs';
import { kitEntries, kitFromQuery, kitSpec, petManifest } from '../../../scripts/creator-specs.mjs';
import generated from '../generated.json';
import { creationCopy } from './creation-copy.js';
import { creationRequest, creationZip, kitRequest, requestEntries, saveCreationFile } from './creation-kit.mjs';
import StudioNav from './StudioNav.vue';
import { installCommand } from './skill-install.mjs';
import VisibleSprite from './VisibleSprite.vue';

const props = defineProps({ lang: { type: String, default: 'en' }, kind: { type: String, required: true } });
const t = computed(() => creationCopy[props.lang] || creationCopy.en);
const starter = ref(props.kind === 'pet' ? 'clover' : 'garden'),
  name = ref(''),
  brief = ref(''),
  seasonal = ref(false);
const ready = ref(false),
  busy = ref(false),
  notice = ref(''),
  error = ref(false),
  showRequest = ref(false);
const request = computed(() =>
  kitRequest({
    kind: props.kind,
    starter: starter.value,
    name: name.value,
    brief: brief.value,
    seasonal: seasonal.value,
  }),
);
const prompt = computed(() => creationRequest(request.value));
const prefix = computed(() => (props.lang === 'en' ? '' : `${props.lang}/`));
const layouts = ['garden', 'lakeside', 'interior'];
onMounted(() => {
  ready.value = true;
  if (props.kind === 'pet') {
    if (location.hash === '#custom-prompts') starter.value = 'custom';
    else if (new URLSearchParams(location.search).has('kit')) starter.value = kitFromQuery(location.search);
  }
});
function choose(id) {
  starter.value = id;
  notice.value = '';
  error.value = false;
  if (props.kind === 'pet') {
    const url = new URL(location.href);
    url.searchParams.set('kit', id);
    url.hash = id === 'custom' ? 'custom-prompts' : 'official-kit';
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }
}
async function copy() {
  try {
    await navigator.clipboard.writeText(prompt.value);
    notice.value = t.value.copied;
    error.value = false;
  } catch {
    notice.value = t.value.failed;
    showRequest.value = true;
    error.value = true;
  }
}
async function copyInstall(agent) {
  try {
    await navigator.clipboard.writeText(installCommand(agent));
    notice.value = t.value.installCopied;
    error.value = false;
  } catch {
    notice.value = t.value.failed;
    error.value = true;
  }
}
async function bytes(path) {
  const result = await fetch(withBase(path), { redirect: 'error' });
  if (!result.ok) throw Error('download');
  const data = new Uint8Array(await result.arrayBuffer());
  if (data.length > 32 * 1024 * 1024) throw Error('size');
  return data;
}
async function download() {
  busy.value = true;
  notice.value = t.value.busy;
  error.value = false;
  const data = request.value;
  try {
    const result = await fetch(withBase(`/creator-kit/skill/files.json?rev=${generated.creatorSkillRevision}`), {
      redirect: 'error',
    });
    if (!result.ok) throw Error('download');
    const bundle = await result.json();
    if (bundle.version !== 1 || !Array.isArray(bundle.files)) throw Error('format');
    const encoder = new TextEncoder();
    const entries = [
      ...bundle.files.map(f => ({ name: f.name, bytes: encoder.encode(f.text) })),
      ...requestEntries(data),
    ];
    if (data.kind === 'pet' && data.starter !== 'custom') {
      const sources = [
        ['identity-reference.png', 'identity-reference.png'],
        ['turnaround.png', 'turnaround.png'],
        ['face-detail.png', 'face-detail.png'],
        ['identity.json', 'identity.json'],
        ['spritesheet.png', 'original-atlas.png'],
      ];
      const references = await Promise.all(
        sources.map(async ([source, target]) => ({
          name: `references/${target}`,
          bytes: await bytes(`/creator-kit/${data.starter}/${source}`),
        })),
      );
      entries.push(...references, {
        name: 'references/source.json',
        bytes: encoder.encode(JSON.stringify(petManifest(kitSpec(data.starter)).source, null, 2)),
      });
    } else if (data.kind === 'background') {
      entries.push(
        {
          name: 'references/layout.json',
          bytes: encoder.encode(JSON.stringify({ name: data.name, ...data.layout }, null, 2)),
        },
        {
          name: 'references/layout.svg',
          bytes: encoder.encode(backgroundSheet({ indoor: !data.layout.sky, ...data.layout })),
        },
        { name: 'references/scene-reference.png', bytes: await bytes(`/creator-kit/skill/${data.starter}.png`) },
      );
    }
    if (entries.reduce((total, f) => total + f.bytes.length, 0) > 64 * 1024 * 1024) throw Error('size');
    const archive = creationZip(entries.map(entry => ({ ...entry, name: `playpets-creator/${entry.name}` })));
    saveCreationFile(new Blob([archive], { type: 'application/zip' }), `${data.id}-creation-kit.zip`);
    notice.value = t.value.downloaded;
  } catch {
    notice.value = t.value.error;
    error.value = true;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
<section class="creation-studio">
  <StudioNav :lang="lang" :current="kind" />
  <header class="creation-heading"><h2>{{ kind==='pet'?t.petTitle:t.backgroundTitle }}</h2><p>{{ t.intro }}</p></header>
  <div class="creation-workbench">
    <div class="creation-compose">
      <fieldset :disabled="busy"><legend>{{ kind==='pet'?t.choosePet:t.chooseBackground }}</legend>
        <div v-if="kind==='pet'" class="creation-pets"><button v-for="entry in kitEntries" :key="entry.id" type="button" :aria-pressed="starter===entry.id" @click="choose(entry.id)"><VisibleSprite :pet="entry.pet" :scale=".48" equal-height /><strong>{{ entry.name }}</strong></button><button type="button" class="creation-own" :aria-pressed="starter==='custom'" @click="choose('custom')"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 9v30M9 24h30"/></svg><strong>{{ t.own }}</strong></button></div>
        <div v-else class="creation-places"><button v-for="(id,i) in layouts" :key="id" type="button" :aria-pressed="starter===id" @click="choose(id)"><img :src="withBase(`/creator-kit/skill/${id}.png`)" alt=""><strong>{{ t.backgroundNames[i] }}</strong><span>{{ t.backgroundHints[i] }}</span></button></div>
        <p v-if="kind==='pet'&&starter==='custom'" class="creation-note">{{ t.ownHint }}</p>
      </fieldset>
      <fieldset class="creation-fields" :disabled="busy"><legend>{{ t.customize }}</legend><label>{{ t.name }}<input v-model="name" maxlength="60" :placeholder="t.namePlaceholder"></label><label>{{ t.brief }}<textarea v-model="brief" maxlength="1000" rows="3" :placeholder="t.briefPlaceholder" /></label><label class="creation-season"><input v-model="seasonal" type="checkbox">{{ kind === 'pet' ? t.petSeasonal : t.seasonal }}</label></fieldset>
      <div class="creation-actions"><button class="creation-primary" type="button" :disabled="!ready||busy" @click="download">{{ busy?t.busy:t.download }} <span aria-hidden="true">↓</span></button><button type="button" :disabled="!ready||busy" @click="copy">{{ t.copy }}</button></div>
      <p class="creation-status" :role="error?'alert':'status'" aria-live="polite">{{ notice }}</p>
      <details class="creation-request" :open="showRequest" @toggle="showRequest=$event.target.open"><summary>{{ t.prompt }}</summary><pre tabindex="0"><code>{{ prompt }}</code></pre></details>
    </div>
    <aside class="creation-takeaway"><h3>{{ t.contents }}</h3><ul><li v-for="item in t.included" :key="item">{{ item }}</li></ul><ol><li v-for="step in t.steps" :key="step">{{ step }}</li></ol><p v-if="kind==='background'" class="creation-capability">{{ t.coordinates }}</p><p class="creation-output">{{ kind==='pet'?t.petOutput:t.backgroundOutput }}</p><a :href="withBase(`/${prefix}guide/import`)">{{ t.import }} ↗</a><p class="creation-capability">{{ t.capability }}</p><a :href="withBase(`/creator-kit/skill/playpets-creator.zip?rev=${generated.creatorSkillRevision}`)" download>{{ t.skill }} ↓</a><br><a :href="withBase(`/creator-kit/skill/playpets-creator-plugin.zip?rev=${generated.creatorSkillRevision}`)" download>{{ t.plugin }} ↓</a></aside>
  </div>
  <details class="creation-install"><summary>{{ t.installTitle }}</summary><p>{{ t.installHint }}</p><div v-for="agent in ['codex','claude-code']" :key="agent"><h3>{{ agent==='codex'?'Codex':'Claude Code' }}</h3><pre tabindex="0"><code>{{ installCommand(agent) }}</code></pre><button type="button" :disabled="!ready" @click="copyInstall(agent)">{{ t.installCopy }}</button></div><p>{{ t.installScope }}</p><p>{{ t.installPending }}</p><p><a href="https://github.com/vercel-labs/skills">skills CLI</a> · <a href="https://developers.openai.com/codex/skills/">Codex</a> · <a href="https://code.claude.com/docs/en/skills">Claude Code</a></p></details>
  <details v-if="kind==='pet' &&starter!=='custom'" class="creation-ready"><summary>{{ t.ready }}</summary><p>{{ t.readyHint }}</p><a :href="withBase(`/creator-kit/${starter}/importable-pet.zip`)" download>{{ t.readyDownload }} ↓</a></details>
</section>
</template>
<style scoped>
.creation-studio{--creation-line:var(--vp-c-divider);margin-bottom:36px}
.creation-heading{margin:32px 0;max-width:76ch}
.creation-heading h2{margin:0 0 12px;padding:0;border:0;font-size:clamp(24px,3.5vw,34px);letter-spacing:-.035em;line-height:1.3}
.creation-heading p{color:var(--vp-c-text-2);font-size:15px;line-height:1.9;margin:0}
.creation-workbench{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(250px,.8fr);gap:40px;align-items:start}
.creation-compose{min-width:0}
fieldset{padding:0;margin:0 0 28px;border:0;min-width:0}
legend{padding:0;margin-bottom:14px;font-size:14px;font-weight:600;color:var(--vp-c-text-1)}
.creation-pets{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.creation-pets button{display:flex;flex-direction:column;align-items:center;justify-content:end;min-height:150px;padding:12px 4px;gap:10px;border:1px solid var(--creation-line);border-radius:12px;background:var(--vp-c-bg-soft);cursor:pointer;color:var(--vp-c-text-2);font:inherit}
.creation-pets strong{font-size:13px;font-weight:600}
.creation-pets button[aria-pressed=true],.creation-places button[aria-pressed=true]{border-color:var(--vp-c-brand-1);background:var(--vp-c-brand-soft);color:var(--vp-c-brand-1);box-shadow:inset 0 0 0 1px var(--vp-c-brand-1)}
.creation-pets :deep(.sprite){--display-scale:.48}
.creation-pets :deep(.sprite i){animation:none}
.creation-own svg{width:48px;height:96px;stroke:currentColor;stroke-width:1.2;fill:none}
.creation-places{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.creation-places button{padding:0 0 12px;border:1px solid var(--creation-line);border-radius:12px;background:var(--vp-c-bg-soft);overflow:hidden;text-align:left;font:inherit;cursor:pointer;color:var(--vp-c-text-1)}
.creation-places img{width:100%;aspect-ratio:1.5;object-fit:cover;background:linear-gradient(#d7e6ea,#f0f3eb)}
.creation-places strong,.creation-places span{display:block;padding:0 12px}
.creation-places strong{font-size:14px;margin-top:10px}
.creation-places span{font-size:11px;line-height:1.7;color:var(--vp-c-text-2);margin-top:4px}
.creation-fields{display:grid;gap:16px;border-top:1px solid var(--creation-line);padding-top:22px}
.creation-fields legend{float:left;width:100%;margin:0}
label{display:flex;flex-direction:column;gap:7px;font-size:13px;color:var(--vp-c-text-1)}
input:not([type=checkbox]),textarea{width:100%;min-height:44px;border:1px solid var(--creation-line);border-radius:8px;background:var(--vp-c-bg);color:var(--vp-c-text-1);padding:10px 12px;font:inherit;font-size:14px;line-height:1.7}
textarea{resize:vertical}
.creation-season{flex-direction:row;align-items:center;gap:10px;min-height:44px;color:var(--vp-c-text-2)}
.creation-season input{accent-color:var(--vp-c-brand-1)}
.creation-actions{display:flex;flex-wrap:wrap;gap:10px}
.creation-actions button{display:flex;align-items:center;justify-content:center;gap:16px;min-height:46px;padding:10px 18px;border:1px solid var(--creation-line);border-radius:8px;background:var(--vp-c-bg-soft);color:var(--vp-c-text-1);font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.creation-actions .creation-primary{background:var(--vp-c-brand-1);border-color:var(--vp-c-brand-1);color:var(--vp-c-bg)}
button:disabled{opacity:.6;cursor:wait}
.creation-status{font-size:13px;line-height:1.8;color:var(--vp-c-text-2);margin:12px 0}
.creation-status[role=alert]{color:var(--vp-c-danger-1)}
.creation-takeaway{border-left:1px solid var(--creation-line);padding-left:28px;position:sticky;top:90px;min-width:0}
.creation-takeaway h3{margin:0 0 14px;font-size:15px}
.creation-takeaway ul{padding-left:17px;margin:0 0 24px;font-size:13px;line-height:1.8;color:var(--vp-c-text-2)}
.creation-takeaway ol{padding-left:20px;margin:0 0 24px;font-size:13px;line-height:1.8}
.creation-takeaway li{margin:8px 0}
.creation-output{font-size:13px;line-height:1.9;border-top:1px solid var(--creation-line);padding-top:18px}
.creation-takeaway a{font-size:12px}
.creation-capability,.creation-note{font-size:12px;line-height:1.9;color:var(--vp-c-text-2)}
.creation-capability{margin-top:22px}
.creation-request,.creation-ready{border-top:1px solid var(--creation-line);margin-top:20px;padding-top:8px}
summary{min-height:44px;display:flex;align-items:center;cursor:pointer;color:var(--vp-c-brand-1);font-size:13px}
summary::before{content:'+';margin-right:10px}details[open]>summary::before{content:'−'}
pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:380px;overflow:auto;font-size:12px;line-height:1.8}
.creation-ready p,.creation-ready a{font-size:13px}
:focus-visible{outline:3px solid var(--vp-c-brand-1);outline-offset:3px}
@media(max-width:820px){.creation-workbench{grid-template-columns:1fr;gap:28px}.creation-takeaway{position:static;border-left:0;border-top:1px solid var(--creation-line);padding:22px 0 0}.creation-takeaway ul{display:grid;grid-template-columns:1fr 1fr;gap:0 24px}}
@media(max-width:480px){.creation-pets{grid-template-columns:repeat(2,minmax(0,1fr))}.creation-pets .creation-own{grid-column:1/-1;min-height:60px;flex-direction:row;justify-content:center}.creation-own svg{height:36px;width:36px}.creation-places{gap:6px}.creation-places span{display:none}.creation-places strong{padding:0 8px;font-size:12px}.creation-actions{flex-direction:column}.creation-heading{margin:24px 0}.creation-takeaway ul{display:block}}
</style>

<style scoped>
.creation-install{border-top:1px solid var(--vp-c-divider);padding-top:20px;margin:24px 0;color:var(--vp-c-text-2);font-size:14px;line-height:1.8}
.creation-install summary{cursor:pointer;font-weight:600;color:var(--vp-c-text-1)}
.creation-install pre{overflow:auto;padding:14px;border-radius:8px;background:var(--vp-c-bg-soft);font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}
.creation-install button{border:1px solid var(--vp-c-divider);padding:7px 12px;border-radius:6px;cursor:pointer;color:var(--vp-c-text-1);font:inherit}
.creation-install button:focus-visible{outline:2px solid var(--vp-c-brand-1);outline-offset:3px}
</style>
