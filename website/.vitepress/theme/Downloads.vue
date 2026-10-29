<!-- Download buttons. With a version: that release's files. Without one: the latest release,
     with whatever the page puts in the slot (a second action) beside the main button;
     read from the GitHub API in the browser. When that fails the button leads to the releases page:
     a 404 means nothing is released yet; anything else (a rate limit, no network) only says where the files are. -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import generated from '../generated.json';
import { forgetRelease, latestRelease, taggedRelease, watchRelease } from './site-runtime.mjs';
import { FILES, useWords } from './words';

const props = defineProps<{ version?: string; compact?: boolean }>();
const { words } = useWords();
const resolvedVersion = ref('');
const available = ref<string[] | null>(null);
// 'missing': the API said 404, so there is no release yet; 'error': the lookup failed some other way.
const lookup = ref<'pending' | 'ready' | 'missing' | 'error'>('pending');
let detach: (() => void) | undefined;
let active = true;
const os = ref<'macOS' | 'Windows' | 'Linux'>('macOS');
// An ARM PC gets the arm64 file: the x64 one runs there only through emulation.
const arm = ref(false);
const releases = `https://github.com/${generated.slug}/releases`;
// Windows gets the Store first: Microsoft signs that package and the Store keeps it updated, while
// the GitHub installer is not code-signed yet. winget's msstore source installs the same package.
// Visitors on another system see the Store first in the other-platforms list, for the same reason.
const STORE = 'https://apps.microsoft.com/detail/9NSKXQ6R187M';
const COMMANDS: Partial<Record<'macOS' | 'Windows' | 'Linux', string>> = {
  macOS: 'brew install gaerae/tap/playpets',
  Windows: 'winget install --id 9NSKXQ6R187M --source msstore',
};
const store = computed(() => !props.version && os.value === 'Windows');
const command = computed(() => (props.version ? undefined : COMMANDS[os.value]));
const url = (file: string) =>
  `${releases}/download/v${resolvedVersion.value}/PlayPets_${resolvedVersion.value}_${file}`;
const primaryFile = computed(() =>
  os.value === 'Windows'
    ? `windows-${arm.value ? 'arm64' : 'x64'}-setup.exe`
    : os.value === 'Linux'
      ? `linux-${arm.value ? 'arm64' : 'x64'}.AppImage`
      : 'macos-universal.dmg',
);
const hasPrimary = computed(() => available.value === null || available.value.includes(primaryFile.value));
const others = computed(() =>
  FILES.filter(
    f => (store.value || f !== primaryFile.value) && (available.value === null || available.value.includes(f)),
  ),
);
const releaseUrl = computed(() => (resolvedVersion.value ? `${releases}/tag/v${resolvedVersion.value}` : releases));
const showRelease = (result: { version: string; files: string[]; status: 'ready' | 'missing' | 'error' }) => {
  if (!active) return;
  resolvedVersion.value = result.version;
  available.value = FILES.filter(f => result.files.includes(`PlayPets_${result.version}_${f}`));
  lookup.value = result.status;
};
const loadRelease = async () => {
  lookup.value = 'pending';
  showRelease(await (props.version ? taggedRelease(generated.slug, props.version) : latestRelease(generated.slug)));
};
const retry = () => {
  forgetRelease(generated.slug, props.version);
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
  if (!active) return;
  detach = watchRelease(generated.slug, showRelease, props.version);
  await loadRelease();
});
onBeforeUnmount(() => {
  active = false;
  detach?.();
});
</script>

<template>
  <div class="downloads" :class="{ compact }" :aria-busy="lookup === 'pending' && !resolvedVersion">
    <template v-if="resolvedVersion && lookup === 'ready'">
      <div class="dl-row">
        <a v-if="store" class="dl-primary" :href="STORE">
          <span>{{ words.storeFor }}</span>
          <small>{{ words.storeNote }}</small>
        </a>
        <a v-else class="dl-primary" :href="hasPrimary ? url(primaryFile) : releaseUrl">
          <span>{{ hasPrimary ? words.downloadFor(os) : words.releases }}</span>
          <small>{{ hasPrimary ? words.files[primaryFile] : 'GitHub' }}, {{ resolvedVersion }}</small>
        </a>
        <slot />
      </div>
      <p v-if="command && words.commands" class="dl-command"><span>{{ words.commands[os] }}</span><code><template v-for="(word, index) in command.split(' ')" :key="index">{{ index ? ' ' : '' }}<span class="dl-word">{{ word }}</span></template></code></p>
      <details class="dl-others">
        <summary>{{ store ? words.otherDownloads : words.otherPlatforms }}</summary>
        <ul>
          <li v-if="!version && os !== 'Windows'"><a :href="STORE">{{ words.storeOther }}</a></li>
          <li v-for="f in others" :key="f"><a :href="url(f)">{{ words.files[f] }}</a></li>
          <li><a :href="`${releases}/tag/v${resolvedVersion}`">{{ words.allFiles }}</a></li>
        </ul>
      </details>
      <!-- Wherever the GitHub installer is offered on Windows: SmartScreen warns about an unsigned one. -->
      <p v-if="os === 'Windows'" class="dl-note">
        {{ words.unsigned }}<a :href="words.unsignedGuide">{{ words.unsignedHow }}</a>
      </p>
    </template>
    <template v-else>
      <div class="dl-row">
        <a v-if="store" class="dl-primary" :href="STORE">
          <span>{{ words.storeFor }}</span>
          <small>{{ words.storeNote }}</small>
        </a>
        <a v-else class="dl-primary" :href="releases">
          <span>{{ words.download }}</span>
          <small>{{ lookup === 'pending' ? words.checkingRelease : lookup === 'missing' ? words.preparing : 'GitHub' }}</small>
        </a>
        <slot />
      </div>
      <p v-if="command && words.commands" class="dl-command"><span>{{ words.commands[os] }}</span><code><template v-for="(word, index) in command.split(' ')" :key="index">{{ index ? ' ' : '' }}<span class="dl-word">{{ word }}</span></template></code></p>
      <p v-if="lookup === 'missing'" class="dl-note" role="status">{{ words.unreleased }}</p>
      <p v-else-if="lookup === 'error'" class="dl-note" role="status">
        {{ words.lookupFailed }}<a :href="releases">{{ words.releases }}</a>{{ words.lookupFailedEnd }}
        <button type="button" class="dl-retry" @click="retry">{{ words.retry }}</button>
      </p>
    </template>
    <p v-if="!compact" class="dl-free">{{ words.free }}</p>
  </div>
</template>
