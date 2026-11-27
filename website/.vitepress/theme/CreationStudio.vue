<script setup>
import { withBase } from 'vitepress';
import { computed, onMounted, ref } from 'vue';
import { BACKGROUND_REFERENCES, backgroundSheet } from '../../../scripts/background-specs.mjs';
import { STUDIO_REFERENCES, kitEntries, kitFromQuery, kitSpec, petManifest } from '../../../scripts/creator-specs.mjs';
import generated from '../generated.json';
import { petDownload } from '../../../scripts/site-content.mjs';
import { creationCopy } from './creation-copy.js';
import { creationRequest, creationZip, kitRequest, requestEntries, saveCreationFile } from './creation-kit.mjs';
import StudioNav from './StudioNav.vue';
import { installCommand } from './skill-install.mjs';
import { sceneSrcset, sceneryUrl } from './scenery';
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
// The workbench hangs under a painting of where its work ends up: the garden workshop where friends
// are made, or the hill garden a new place joins.
const banner = props.kind === 'pet' ? 'workshop' : 'green';
// A card shows the reference's small copy; the 3 MB PNG is fetched only into a kit.
const sceneName = id => BACKGROUND_REFERENCES[id].split('/').at(-1).replace('.png', '');
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
      const references = await Promise.all(
        STUDIO_REFERENCES.map(async ([source, target]) => ({
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
        {
          name: 'references/scene-reference.png',
          bytes: await bytes(`/creator-kit/skill/${data.starter}.png?rev=${generated.creatorSkillRevision}`),
        },
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
  <header class="creation-heading">
    <div class="creation-painting"><img :src="sceneryUrl(banner)" :srcset="sceneSrcset(banner)" sizes="(max-width: 1100px) 100vw, 1040px" alt="" width="1536" height="1024"></div>
    <div class="creation-label"><h2>{{ kind==='pet'?t.petTitle:t.backgroundTitle }}</h2><p>{{ t.intro }}</p></div>
  </header>
  <ol class="creation-steps" :aria-label="t.stepsLabel"><li v-for="(step,i) in t.steps" :key="step"><b aria-hidden="true">{{ i+1 }}</b><span>{{ step }}</span></li></ol>
  <div class="creation-workbench">
    <div class="creation-compose">
      <fieldset :disabled="busy"><legend><b aria-hidden="true">1</b>{{ kind==='pet'?t.choosePet:t.chooseBackground }}</legend>
        <div v-if="kind==='pet'" class="creation-pets"><button v-for="entry in kitEntries" :key="entry.id" type="button" :aria-pressed="starter===entry.id" @click="choose(entry.id)"><VisibleSprite :pet="entry.pet" :scale=".48" equal-height /><strong>{{ entry.name }}</strong></button><button type="button" class="creation-own" :aria-pressed="starter==='custom'" @click="choose('custom')"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 9v30M9 24h30"/></svg><strong>{{ t.own }}</strong></button></div>
        <div v-else class="creation-places"><button v-for="(id,i) in layouts" :key="id" type="button" :aria-pressed="starter===id" @click="choose(id)"><img :src="sceneryUrl(sceneName(id)) || withBase(`/creator-kit/skill/${id}.png`)" :srcset="sceneSrcset(sceneName(id))" sizes="(max-width: 640px) 33vw, 240px" alt="" width="768" height="512"><strong>{{ t.backgroundNames[i] }}</strong><span>{{ t.backgroundHints[i] }}</span></button></div>
        <p v-if="kind==='pet'&&starter==='custom'" class="creation-note">{{ t.ownHint }}</p>
      </fieldset>
      <fieldset class="creation-fields" :disabled="busy"><legend><b aria-hidden="true">2</b>{{ t.customize }}</legend><label>{{ t.name }}<input v-model="name" maxlength="60" :placeholder="kind === 'pet' ? t.petNamePlaceholder : t.namePlaceholder"></label><label>{{ t.brief }}<textarea v-model="brief" maxlength="1000" rows="3" :placeholder="kind === 'pet' ? t.petBriefPlaceholder : t.briefPlaceholder" /></label><label class="creation-season"><input v-model="seasonal" type="checkbox">{{ kind === 'pet' ? t.petSeasonal : t.seasonal }}</label></fieldset>
      <fieldset class="creation-get"><legend><b aria-hidden="true">3</b>{{ t.steps[2] }}</legend>
        <div class="creation-actions"><button class="creation-primary" type="button" :disabled="!ready||busy" @click="download">{{ busy?t.busy:t.download }} <span aria-hidden="true">↓</span></button><button type="button" :disabled="!ready||busy" @click="copy">{{ t.copy }}</button></div>
        <p class="creation-status" :role="error?'alert':'status'" aria-live="polite">{{ notice }}</p>
        <details class="creation-request" :open="showRequest" @toggle="showRequest=$event.target.open"><summary>{{ t.prompt }}</summary><pre tabindex="0"><code>{{ prompt }}</code></pre></details>
      </fieldset>
    </div>
    <aside class="creation-takeaway">
      <h3>{{ t.contents }}</h3><ul><li v-for="item in t.included" :key="item">{{ item }}</li></ul>
      <h3 class="creation-finish"><b aria-hidden="true">4</b>{{ t.steps[3] }}</h3>
      <p v-if="kind==='background'&&request.layout?.water" class="creation-capability">{{ t.coordinates }}</p>
      <p class="creation-output">{{ kind==='pet'?t.petOutput:t.backgroundOutput }}</p>
      <a class="creation-guide" :href="withBase(`/${prefix}guide/import`)">{{ t.import }} ↗</a>
      <p class="creation-capability">{{ t.capability }}</p>
      <p class="creation-files"><a :href="withBase(`/creator-kit/skill/playpets-creator.zip?rev=${generated.creatorSkillRevision}`)" download>{{ t.skill }} ↓</a><a :href="withBase(`/creator-kit/skill/playpets-creator-plugin.zip?rev=${generated.creatorSkillRevision}`)" download>{{ t.plugin }} ↓</a></p>
    </aside>
  </div>
  <details class="creation-install"><summary>{{ t.installTitle }}</summary><p>{{ t.installHint }}</p><div v-for="agent in ['codex','claude-code']" :key="agent"><h3>{{ agent==='codex'?'Codex':'Claude Code' }}</h3><pre tabindex="0"><code>{{ installCommand(agent) }}</code></pre><button type="button" :disabled="!ready" @click="copyInstall(agent)">{{ t.installCopy }}</button></div><p>{{ t.installScope }}</p><p>{{ t.installPending }}</p><p><a href="https://github.com/vercel-labs/skills">skills CLI</a>, <a href="https://developers.openai.com/codex/skills/">Codex</a>, <a href="https://code.claude.com/docs/en/skills">Claude Code</a></p></details>
  <details v-if="kind==='pet' &&starter!=='custom'" class="creation-ready"><summary>{{ t.ready }}</summary><p>{{ t.readyHint }}</p><a :href="withBase(petDownload(starter))" download>{{ t.readyDownload }} ↓</a></details>
</section>
</template>
<style scoped>
/* The studio is a workbench in the app's own materials: a painting of the place in a honey-wood frame,
   cream paper to write on, a framed note of what the kit holds, and the honey button of the app's main
   action. The colours are the site's tokens (style.css), so the lamplit paper after dark comes with them. */
.creation-studio{--creation-line:var(--pp-line,var(--vp-c-divider));--creation-paper:var(--vp-c-bg-elv);margin-bottom:36px;color:var(--vp-c-text-1)}
.creation-heading{margin:28px 0 0;position:relative}
.creation-painting{border:var(--pp-frame-border,0);border-width:8px;border-radius:16px;background:var(--pp-wood-grain,var(--vp-c-bg-soft)) border-box;box-shadow:var(--pp-frame-shadow,none);overflow:hidden;line-height:0}
.creation-painting img{width:100%;aspect-ratio:3/1;object-fit:cover;object-position:50% 62%;border-radius:8px;background:var(--pp-sky,var(--vp-c-bg-soft))}
.creation-label{position:relative;margin:-64px 0 0 28px;max-width:640px;padding:18px 24px 20px;border:var(--pp-frame-border,1px solid var(--creation-line));border-radius:14px;background:var(--pp-frame,var(--creation-paper));box-shadow:var(--pp-frame-shadow,none)}
.creation-label h2{margin:0 0 8px;padding:0;border:0;font-family:var(--pp-display,inherit);font-size:clamp(24px,3.2vw,32px);letter-spacing:-.02em;line-height:1.3;color:var(--pp-ink,var(--vp-c-text-1))}
.creation-label p{color:var(--vp-c-text-2);font-size:15px;line-height:1.8;margin:0}
.creation-steps{list-style:none;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:28px 0 30px;padding:0;counter-reset:none}
.creation-steps li{display:flex;align-items:center;gap:10px;margin:0;padding:10px 14px;border:1px solid var(--creation-line);border-radius:999px;background:var(--creation-paper);font-size:13px;font-weight:600;line-height:1.4;color:var(--vp-c-text-1)}
.creation-studio b{flex:none;display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--pp-honey,var(--vp-c-brand-soft));color:var(--pp-on-honey,var(--vp-c-text-1));border:1px solid var(--pp-wood-edge,var(--creation-line));font-size:13px;font-weight:800;line-height:1;box-shadow:inset 0 -2px 0 var(--pp-honey-deep,transparent)}
.creation-workbench{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(260px,.8fr);gap:28px;align-items:start}
.creation-compose{min-width:0;padding:26px 26px 10px;border:1px solid var(--creation-line);border-radius:18px;background:var(--creation-paper);box-shadow:0 1px 0 var(--creation-line),0 10px 24px -14px var(--pp-shadow,rgba(0,0,0,.2))}
fieldset{padding:0;margin:0 0 26px;border:0;min-width:0}
legend{display:flex;align-items:center;gap:10px;padding:0;margin-bottom:14px;font-size:15px;font-weight:700;color:var(--vp-c-text-1)}
.creation-pets{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
.creation-pets button,.creation-places button{border:1px solid var(--creation-line);border-radius:14px;background:var(--vp-c-bg-soft);cursor:pointer;color:var(--vp-c-text-2);font:inherit;transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease}
.creation-pets button{display:flex;flex-direction:column;align-items:center;justify-content:end;min-height:150px;padding:12px 4px;gap:10px}
.creation-pets button:hover,.creation-places button:hover{transform:translateY(-2px);border-color:var(--pp-wood,var(--vp-c-brand-3))}
.creation-pets strong{font-size:13px;font-weight:700;text-align:center;text-wrap:balance;word-break:keep-all}
.creation-pets button[aria-pressed=true],.creation-places button[aria-pressed=true]{border-color:var(--pp-accent,var(--vp-c-brand-1));background:var(--vp-c-brand-soft);color:var(--vp-c-text-1);box-shadow:inset 0 0 0 1.5px var(--pp-accent,var(--vp-c-brand-1)),0 6px 14px -8px var(--pp-shadow,transparent)}
.creation-pets :deep(.sprite){--display-scale:.48}
.creation-pets :deep(.sprite i){animation:none}
.creation-pets button[aria-pressed=true] :deep(.sprite i){animation:sprite-row var(--loop) steps(var(--frames)) infinite}
.creation-own svg{width:48px;height:96px;stroke:currentColor;stroke-width:1.4;fill:none}
.creation-places{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.creation-places button{padding:0 0 12px;overflow:hidden;text-align:left;color:var(--vp-c-text-1)}
.creation-places img{width:100%;aspect-ratio:1.5;object-fit:cover;background:var(--pp-sky,var(--vp-c-bg-soft))}
.creation-places strong,.creation-places span{display:block;padding:0 12px}
.creation-places strong{font-size:14px;margin-top:10px}
.creation-places span{font-size:12px;line-height:1.6;color:var(--vp-c-text-2);margin-top:4px}
.creation-fields{display:grid;gap:16px;border-top:1px dashed var(--creation-line);padding-top:22px}
.creation-fields legend{float:left;width:100%;margin:0}
label{display:flex;flex-direction:column;gap:7px;font-size:13px;font-weight:600;color:var(--vp-c-text-1)}
input:not([type=checkbox]),textarea{width:100%;min-height:44px;border:1px solid var(--creation-line);border-radius:10px;background:var(--vp-c-bg);color:var(--vp-c-text-1);padding:10px 12px;font:inherit;font-size:14px;font-weight:400;line-height:1.7}
input:not([type=checkbox]):focus,textarea:focus{border-color:var(--pp-wood,var(--vp-c-brand-1))}
textarea{resize:vertical}
.creation-season{flex-direction:row;align-items:center;gap:10px;min-height:44px;font-weight:400;color:var(--vp-c-text-2)}
.creation-season input{width:18px;height:18px;accent-color:var(--pp-accent,var(--vp-c-brand-1))}
.creation-get{border-top:1px dashed var(--creation-line);padding-top:22px}
.creation-get legend{float:left;width:100%}
.creation-actions{clear:both;display:flex;flex-wrap:wrap;gap:10px}
.creation-actions button{display:flex;align-items:center;justify-content:center;gap:14px;min-height:48px;padding:10px 20px;border:1px solid var(--creation-line);border-radius:12px;background:var(--vp-c-bg);color:var(--vp-c-text-1);font:inherit;font-size:14px;font-weight:700;cursor:pointer}
.creation-actions button:hover:not(:disabled){border-color:var(--pp-wood,var(--vp-c-brand-1))}
.creation-actions .creation-primary{background:var(--pp-honey,var(--vp-c-brand-1));border-color:var(--pp-wood-edge,var(--vp-c-brand-1));color:var(--pp-on-honey,var(--vp-c-bg));box-shadow:inset 0 -3px 0 var(--pp-honey-deep,transparent),0 4px 10px -6px var(--pp-shadow,transparent)}
.creation-actions .creation-primary:hover:not(:disabled){background:var(--pp-honey-light,var(--vp-c-brand-2));border-color:var(--pp-wood-edge,var(--vp-c-brand-1))}
button:disabled{opacity:.6;cursor:wait}
.creation-status{font-size:13px;line-height:1.8;color:var(--vp-c-text-2);margin:12px 0 0}
.creation-status:empty{margin:0}
.creation-status[role=alert]{color:var(--vp-c-danger-1)}
.creation-takeaway{position:sticky;top:90px;min-width:0;padding:20px 22px;border:var(--pp-frame-border,1px solid var(--creation-line));border-radius:16px;background:var(--pp-frame,var(--creation-paper));box-shadow:var(--pp-frame-shadow,none)}
.creation-takeaway h3{margin:0 0 12px;font-size:15px;font-weight:700}
.creation-takeaway ul{padding-left:18px;margin:0 0 20px;font-size:13px;line-height:1.7;color:var(--vp-c-text-2)}
.creation-takeaway li{margin:6px 0}
.creation-finish{display:flex;align-items:center;gap:10px;border-top:1px dashed var(--creation-line);padding-top:18px}
.creation-output{font-size:13px;line-height:1.85;margin:0 0 10px}
.creation-takeaway a{font-size:13px;font-weight:600;color:var(--vp-c-brand-1)}
.creation-capability,.creation-note{font-size:12px;line-height:1.85;color:var(--vp-c-text-2)}
.creation-capability{margin-top:18px}
.creation-files{display:flex;flex-wrap:wrap;gap:6px 16px;margin:0}
.creation-request{margin-top:6px}
.creation-ready{border-top:1px solid var(--creation-line);margin-top:20px;padding-top:8px}
summary{min-height:44px;display:flex;align-items:center;cursor:pointer;color:var(--vp-c-brand-1);font-size:13px;font-weight:600}
summary::before{content:'+';margin-right:10px}details[open]>summary::before{content:'−'}
pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:380px;overflow:auto;font-size:12px;line-height:1.8;padding:14px;border-radius:10px;background:var(--vp-code-block-bg,var(--vp-c-bg-soft))}
.creation-ready p,.creation-ready a{font-size:13px}
:focus-visible{outline:3px solid var(--vp-c-brand-1);outline-offset:3px}
@media(prefers-reduced-motion:reduce){.creation-pets button,.creation-places button{transition:none}.creation-pets button:hover,.creation-places button:hover{transform:none}.creation-pets button[aria-pressed=true] :deep(.sprite i){animation:none}}
@media(max-width:960px){.creation-steps{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:820px){.creation-workbench{grid-template-columns:1fr;gap:22px}.creation-takeaway{position:static}}
@media(max-width:640px){.creation-painting{border-width:6px;border-radius:12px}.creation-painting img{aspect-ratio:2/1}.creation-label{margin:-28px 8px 0;padding:14px 16px 16px}.creation-label p{font-size:14px}.creation-steps{gap:8px;margin:20px 0 22px}.creation-steps li{padding:8px 10px;border-radius:12px;font-size:12px;gap:8px}.creation-compose{padding:18px 14px 4px;border-radius:14px}.creation-takeaway{padding:16px}}
@media(max-width:480px){.creation-pets{grid-template-columns:repeat(2,minmax(0,1fr))}.creation-pets .creation-own{grid-column:1/-1;min-height:60px;flex-direction:row;justify-content:center}.creation-own svg{height:36px;width:36px}.creation-places{gap:6px}.creation-places span{display:none}.creation-places strong{padding:0 8px;font-size:12px}.creation-actions{flex-direction:column}.creation-heading{margin-top:20px}}
</style>

<style scoped>
.creation-install{border-top:1px solid var(--pp-line,var(--vp-c-divider));padding-top:20px;margin:28px 0 24px;color:var(--vp-c-text-2);font-size:14px;line-height:1.8}
.creation-install summary{cursor:pointer;font-weight:700;color:var(--vp-c-text-1)}
.creation-install pre{overflow:auto;padding:14px;border-radius:10px;background:var(--vp-code-block-bg,var(--vp-c-bg-soft));font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}
.creation-install button{border:1px solid var(--pp-line,var(--vp-c-divider));background:var(--vp-c-bg-elv);padding:7px 12px;border-radius:8px;cursor:pointer;color:var(--vp-c-text-1);font:inherit;font-weight:600}
.creation-install button:focus-visible{outline:2px solid var(--vp-c-brand-1);outline-offset:3px}
</style>
