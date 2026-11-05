<!-- The first screen as one moment on someone's desktop: the four friends in the yard, and a coding
     agent at work in a small terminal beside it. When the agent finishes, the friend who keeps it
     company says so and the others cheer. The terminal's steps are Claude Code's from the replay
     further down (agent-demo.mjs); the yard to play with is in the play section. -->
<script setup lang="ts">
import { withBase } from 'vitepress';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { LANDING_PETS } from '../../../scripts/site-content.mjs';
import { AGENT_DEMOS } from './agent-demo.mjs';
import { sceneryUrl } from './scenery';
import VisibleSprite from './VisibleSprite.vue';

type Step = { kind?: string; line?: string; state?: string };
const props = defineProps<{
  words: { agentPrompt: string; agentReply: string; agentStatus: Record<string, string>; places: string[] };
  paused: boolean;
}>();

const demo = AGENT_DEMOS[0];
// The terminal keeps its tool lines; the question in the middle belongs to the replay below.
const lines = (demo.steps as Step[]).filter(step => step.line).map(step => step.line as string);
const helper = demo.pet;
// The agent's friend stands nearest the terminal; the others keep their places along the grass.
const friends = [...LANDING_PETS].sort((a, b) => Number(b.id === helper) - Number(a.id === helper));

const stage = ref<HTMLElement | null>(null);
const visible = ref(false);
// How far the session has got: the prompt's letters, then each line, then the reply.
const typed = ref(0);
const shown = ref(0);
const finished = ref(false);
const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const still = computed(() => props.paused || !visible.value);
let timer: ReturnType<typeof setTimeout> | undefined;

// The others look up when the job is done: one jumps, one waves, one keeps resting.
const cheer = ['jump', 'wave', 'idle'];
function stateOf(index: number) {
  if (index === 0) return finished.value ? 'done' : typed.value ? 'working' : 'idle';
  return finished.value ? cheer[index - 1] : 'idle';
}

// The finished moment: what a paused page, reduced motion and the first paint all show.
function settle() {
  clearTimeout(timer);
  typed.value = props.words.agentPrompt.length;
  shown.value = lines.length;
  finished.value = true;
}
function reset() {
  typed.value = 0;
  shown.value = 0;
  finished.value = false;
}
const after = (ms: number, step: () => void) => {
  timer = setTimeout(step, ms);
};
function type() {
  if (typed.value >= props.words.agentPrompt.length) return after(700, line);
  typed.value += 1;
  after(42, type);
}
function line() {
  if (shown.value >= lines.length) {
    finished.value = true;
    // The payoff holds, then the next task starts in the same terminal.
    return after(5200, () => {
      reset();
      after(900, type);
    });
  }
  shown.value += 1;
  after(shown.value === lines.length - 1 ? 1500 : 1200, line);
}
function play() {
  clearTimeout(timer);
  if (still.value || reducedMotion()) return settle();
  reset();
  after(600, type);
}
let observer: IntersectionObserver | undefined;
watch(still, now => (now ? settle() : play()));
onMounted(() => {
  settle();
  if (!stage.value || !globalThis.IntersectionObserver) return;
  observer = new IntersectionObserver(entries => {
    visible.value = entries.some(entry => entry.isIntersecting);
  });
  observer.observe(stage.value);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  clearTimeout(timer);
});
</script>
<template>
  <div ref="stage" class="hero-desk">
    <div class="desk-yard">
      <div class="desk-titlebar" aria-hidden="true"><i /><i /><i /><span>PlayPets</span></div>
      <div class="desk-scene">
        <img :src="sceneryUrl('lakeside-spring')" :alt="words.places[2]" width="1536" height="1024" fetchpriority="high" draggable="false" />
        <div v-for="(pet, index) in friends" :key="pet.id" class="desk-friend" :class="`desk-friend-${index}`">
          <span v-if="index === 0" class="desk-bubble" :class="{ quiet: !finished }" aria-live="polite">{{ words.agentStatus.done }}</span>
          <VisibleSprite equal-height :pet="pet.id" :state="stateOf(index)" :scale="0.48" />
          <span class="desk-name">{{ pet.displayName }}</span>
        </div>
      </div>
    </div>
    <div class="desk-terminal">
      <div class="desk-titlebar" aria-hidden="true"><i /><i /><i /><span>{{ demo.name }}</span></div>
      <div class="desk-log">
        <div class="desk-prompt"><span aria-hidden="true">›</span> {{ words.agentPrompt.slice(0, typed) }}</div>
        <div v-for="(text, index) in lines" :key="text" class="desk-line" :class="{ 'desk-later': index >= shown, 'desk-pass': text.includes('✓') }">{{ text }}</div>
        <div class="desk-reply" :class="{ 'desk-later': !finished }">{{ words.agentReply }}</div>
      </div>
    </div>
    <div class="desk-dock" aria-hidden="true"><i /><img :src="withBase('/icon.png')" alt="" width="24" height="24" /><i /><i /></div>
  </div>
</template>
