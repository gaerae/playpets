<!-- Download buttons. With a version: that release's files. Without one: the latest release,
     with whatever the page puts in the slot (a second action) beside the main button;
     read from the GitHub API in the browser. When that fails the button leads to the releases page:
     a 404 means nothing is released yet; anything else (a rate limit, no network) only says where the files are. -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import generated from '../generated.json';
import { forgetRelease, latestRelease, watchRelease } from './site-runtime.mjs';
import { FILES, useWords } from './words';

const props = defineProps<{ version?: string; compact?: boolean }>();
const { words } = useWords();
const version = ref(props.version ?? '');
const available = ref<string[] | null>(null);
// 'missing': the API said 404, so there is no release yet; 'error': the lookup failed some other way.
const lookup = ref<'pending' | 'ready' | 'missing' | 'error'>('pending');
let detach: (() => void) | undefined;
let active = true;
const os = ref<'macOS' | 'Windows' | 'Linux'>('macOS');
// An ARM PC gets the arm64 file: the x64 one runs there only through emulation.
const arm = ref(false);
const releases = `https://github.com/${generated.slug}/releases`;
const url = (file: string) => `${releases}/download/v${version.value}/PlayPets_${version.value}_${file}`;
const primaryFile = computed(() =>
  os.value === 'Windows'
    ? `windows-${arm.value ? 'arm64' : 'x64'}-setup.exe`
    : os.value === 'Linux'
      ? `linux-${arm.value ? 'arm64' : 'x64'}.AppImage`
      : 'macos-universal.dmg',
);
const hasPrimary = computed(() => available.value === null || available.value.includes(primaryFile.value));
const others = computed(() =>
  FILES.filter(f => f !== primaryFile.value && (available.value === null || available.value.includes(f))),
);
const releaseUrl = computed(() => (version.value ? `${releases}/tag/v${version.value}` : releases));
const showRelease = (result: { version: string; files: string[]; status: 'ready' | 'missing' | 'error' }) => {
  if (!active) return;
  version.value = result.version;
  available.value = FILES.filter(f => result.files.includes(`PlayPets_${result.version}_${f}`));
  lookup.value = result.status;
};
const loadRelease = async () => {
  lookup.value = 'pending';
  showRelease(await latestRelease(generated.slug));
};
const retry = () => {
  forgetRelease(generated.slug);
  void loadRelease();
};

onMounted(async () => {
  const p = navigator.platform.toLowerCase();
  os.value = p.includes('win') ? 'Windows' : p.includes('linux') ? 'Linux' : 'macOS';
  // Linux names the CPU in navigator.platform ("Linux aarch64"); Windows only tells Chromium-based
  // browsers, through the client hints.
  arm.value = /arm|aarch64/.test(p);
  const hints = (
    navigator as Navigator & {
      userAgentData?: { getHighEntropyValues(keys: string[]): Promise<{ architecture?: string }> };
    }
  ).userAgentData;
  if (!arm.value && os.value === 'Windows' && hints)
    arm.value = await hints
      .getHighEntropyValues(['architecture'])
      .then(v => v.architecture === 'arm')
      .catch(() => false);
  if (props.version || !active) return;
  detach = watchRelease(generated.slug, showRelease);
  await loadRelease();
});
onBeforeUnmount(() => {
  active = false;
  detach?.();
});
</script>

<template>
  <div class="downloads" :class="{ compact }" :aria-busy="lookup === 'pending' && !version">
    <template v-if="version">
      <div class="dl-row">
        <a class="dl-primary" :href="hasPrimary ? url(primaryFile) : releaseUrl">
          <span>{{ hasPrimary ? words.downloadFor(os) : words.releases }}</span>
          <small>{{ hasPrimary ? words.files[primaryFile] : 'GitHub' }} · {{ version }}</small>
        </a>
        <slot />
      </div>
      <details class="dl-others">
        <summary>{{ words.otherPlatforms }}</summary>
        <ul>
          <li v-for="f in others" :key="f"><a :href="url(f)">{{ words.files[f] }}</a></li>
          <li><a :href="`${releases}/tag/v${version}`">{{ words.allFiles }}</a></li>
        </ul>
      </details>
    </template>
    <template v-else>
      <div class="dl-row">
        <a class="dl-primary" :href="releases">
          <span>{{ words.releases }}</span>
          <small>{{ lookup === 'missing' ? words.preparing : 'GitHub' }}</small>
        </a>
        <slot />
      </div>
      <p v-if="lookup === 'missing'" class="dl-note" role="status">{{ words.unreleased }}</p>
      <p v-else-if="lookup === 'error'" class="dl-note" role="status">
        {{ words.lookupFailed }}<a :href="releases">{{ words.releases }}</a>{{ words.lookupFailedEnd }}
        <button type="button" class="dl-retry" @click="retry">{{ words.retry }}</button>
      </p>
    </template>
    <p v-if="!compact" class="dl-free">{{ words.free }}</p>
  </div>
</template>
