<!-- A coding session replayed beside a friend: the terminal runs one agent's steps and the friend
     changes state and speaks as the app does for each event that agent's hooks send. -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { LANDING_PETS } from '../../../scripts/site-content.mjs';
import { AGENT_DEMOS } from './agent-demo.mjs';
import VisibleSprite from './VisibleSprite.vue';

type Step = { kind?: string; line?: string; ask?: string; state?: string; say?: string; tool?: string };
const props = defineProps<{
  words: {
    agentLabel: string;
    agentPlay: string;
    agentReplay: string;
    agentPrompt: string;
    agentReply: string;
    agentAsk: string;
    agentAllow: string;
    agentNote: string;
    agentStatus: Record<string, string>;
  };
  paused: boolean;
}>();
const stage = ref<HTMLElement | null>(null);
const visible = ref(false);
const agent = ref(0);
const typed = ref(0);
const done = ref(0);
const asking = ref(false);
const finished = ref(false);
const started = ref(false);
const friendState = ref('idle');
const status = ref<Step>({});
let observer: IntersectionObserver | undefined;
let stepTimer: ReturnType<typeof setTimeout> | undefined;
const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const demo = computed(() => AGENT_DEMOS[agent.value]);
const friend = computed(() => LANDING_PETS.find(pet => pet.id === demo.value.pet));
const fill = (text: string, name = '') => text.replace('{name}', name);
const bubble = computed(() =>
  status.value.say ? fill(props.words.agentStatus[status.value.say], status.value.tool) : '',
);
// Everything after the prompt that has happened so far, in terminal order.
const log = computed(() => (demo.value.steps as Step[]).slice(1, done.value));

function stop() {
  clearTimeout(stepTimer);
  typed.value = 0;
  done.value = 0;
  asking.value = false;
  finished.value = false;
  friendState.value = 'idle';
  status.value = {};
}
function type() {
  const length = props.words.agentPrompt.length;
  if (typed.value >= length || reducedMotion()) {
    typed.value = length;
    stepTimer = setTimeout(advance, 500);
    return;
  }
  typed.value += 1;
  stepTimer = setTimeout(type, 45);
}
function advance() {
  const step = demo.value.steps[done.value] as Step | undefined;
  if (!step) return;
  done.value += 1;
  if (step.state) {
    friendState.value = step.state;
    status.value = step;
  }
  if (step.kind === 'ask') {
    // Waits for the visitor, as the agent waits for its person; carries on by itself after a while.
    asking.value = true;
    stepTimer = setTimeout(allow, 7000);
  } else if (step.kind === 'reply') {
    finished.value = true;
    stepTimer = setTimeout(() => {
      friendState.value = 'idle';
    }, 2600);
  } else stepTimer = setTimeout(advance, 1300);
}
function allow() {
  if (!asking.value) return;
  clearTimeout(stepTimer);
  asking.value = false;
  advance();
}
function play() {
  stop();
  started.value = true;
  type();
}
function choose(index: number) {
  agent.value = index;
  play();
}
onMounted(() => {
  if (!stage.value || !globalThis.IntersectionObserver) return;
  observer = new IntersectionObserver(
    entries => {
      visible.value = entries.some(entry => entry.isIntersecting);
      // Starts once by itself; never for paused or reduced motion, where the button starts it.
      if (visible.value && !started.value && !props.paused && !reducedMotion()) play();
    },
    { threshold: 0.6 },
  );
  observer.observe(stage.value);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  clearTimeout(stepTimer);
});
</script>
<template>
  <figure class="agent-demo">
    <div class="agent-tabs" role="group" :aria-label="words.agentLabel">
      <button v-for="(entry, index) in AGENT_DEMOS" :key="entry.id" type="button" :aria-pressed="agent === index" @click="choose(index)">{{ entry.name }}</button>
    </div>
    <div ref="stage" class="agent-desk" :class="{ 'preview-paused': paused || !visible }">
      <div class="agent-friend">
        <div class="agent-bubble" :class="{ quiet: !bubble }" aria-live="polite">{{ bubble }}</div>
        <VisibleSprite equal-height :pet="demo.pet" :state="friendState" :scale="0.6" />
        <span class="agent-tag">{{ friend?.displayName }} × {{ demo.name }}</span>
      </div>
      <div class="agent-window">
        <div class="agent-bar" aria-hidden="true"><i /><i /><i /><span>{{ demo.name }}</span></div>
        <div class="agent-log">
          <div class="agent-prompt"><span aria-hidden="true">›</span> {{ words.agentPrompt.slice(0, typed) }}<i v-if="started && !done" class="agent-caret" aria-hidden="true" /></div>
          <template v-for="(step, index) in log" :key="index">
            <div v-if="step.line" class="agent-line">{{ step.line }}</div>
            <div v-else-if="step.kind === 'ask'" class="agent-ask">
              <span>? {{ fill(words.agentAsk, step.ask) }}</span>
              <button v-if="asking && index === log.length - 1" type="button" class="agent-allow" @click="allow">{{ words.agentAllow }}</button>
              <span v-else class="agent-allowed">✓ {{ words.agentAllow }}</span>
            </div>
            <div v-else-if="step.kind === 'reply'" class="agent-reply">{{ words.agentReply }}</div>
          </template>
        </div>
      </div>
    </div>
    <figcaption class="demo-controls">
      <button type="button" class="demo-button" :disabled="started && !finished" @click="play">{{ started ? words.agentReplay : words.agentPlay }}</button>
      <span>{{ words.agentNote }}</span>
    </figcaption>
  </figure>
</template>
