<!-- Download buttons. With a version: that release's files. Without one: the latest release,
     with whatever the page puts in the slot (a second action) beside the main button;
     read from the GitHub API in the browser. When that fails the button leads to the releases page:
     a 404 means nothing is released yet; anything else (a rate limit, no network) only says where the files are. -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import generated from '../generated.json';
import { FILES, useWords } from './words';

const props = defineProps<{ version?: string; compact?: boolean }>();
const { words } = useWords();
const version = ref(props.version ?? '');
// 'missing': the API said 404, so there is no release yet; 'error': the lookup failed some other way.
const lookup = ref<'pending' | 'missing' | 'error'>('pending');
const os = ref<'macOS' | 'Windows' | 'Linux'>('macOS');
const releases = `https://github.com/${generated.slug}/releases`;
const url = (file: string) => `${releases}/download/v${version.value}/PlayPets_${version.value}_${file}`;
const primaryFile = computed(() =>
  os.value === 'Windows'
    ? 'windows-x64-setup.exe'
    : os.value === 'Linux'
      ? 'linux-x64.AppImage'
      : 'macos-universal.dmg',
);
const others = computed(() => FILES.filter(f => f !== primaryFile.value));

onMounted(async () => {
  const p = navigator.platform.toLowerCase();
  os.value = p.includes('win') ? 'Windows' : p.includes('linux') ? 'Linux' : 'macOS';
  if (props.version) return;
  try {
    const r = await fetch(`https://api.github.com/repos/${generated.slug}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (r.status === 404) {
      lookup.value = 'missing';
      return;
    }
    if (!r.ok) throw new Error(String(r.status));
    version.value = String((await r.json()).tag_name).replace(/^v/, '');
  } catch {
    lookup.value = 'error';
  }
});
</script>

<template>
  <div class="downloads" :class="{ compact }">
    <template v-if="version">
      <div class="dl-row">
        <a class="dl-primary" :href="url(primaryFile)">
          <span>{{ words.downloadFor(os) }}</span>
          <small>{{ words.files[primaryFile] }} · {{ version }}</small>
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
      <p v-if="lookup === 'missing'" class="dl-note">{{ words.unreleased }}</p>
      <p v-else-if="lookup === 'error'" class="dl-note">
        {{ words.lookupFailed }}<a :href="releases">{{ words.releases }}</a>{{ words.lookupFailedEnd }}
      </p>
    </template>
    <p v-if="!compact" class="dl-free">{{ words.free }}</p>
  </div>
</template>
