<script setup lang="ts">
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { playUiButtonClick } from '@/presentation/audio/buttonClickAudio'

const props = withDefaults(
  defineProps<{
    selected?: boolean
    locked?: boolean
    disabled?: boolean
    sound?: boolean
    silent?: boolean
  }>(),
  {
    selected: false,
    locked: false,
    disabled: false,
    sound: true,
    silent: false,
  },
)
const emit = defineEmits<{ click: [event: MouseEvent] }>()

function handleClick(event: MouseEvent) {
  playUiButtonClick({ sound: props.sound, silent: props.silent })
  emit('click', event)
}
</script>

<template>
  <button
    type="button"
    class="game-tab-button"
    :class="{ selected, locked }"
    :aria-pressed="selected"
    :disabled="disabled || locked"
    @click="handleClick"
  >
    <InkNineSlice :chrome-id="'button-compact'" layer="surface" />
    <span class="game-tab-button__label"><slot /></span>
  </button>
</template>

<style scoped>
.game-tab-button {
  position: relative;
  isolation: isolate;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 6px 14px;
  border: 0;
  background: transparent;
  color: #f1e2c0;
  font: 700 14px/1.15 var(--pc-font-body, 'PC Paper Serif', Georgia, serif);
  white-space: nowrap;
  cursor: pointer;
}
.game-tab-button > :not(.ink-nine-slice) {
  position: relative;
  z-index: 2;
}
.game-tab-button__label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.game-tab-button:not(:disabled):not(.locked) .game-tab-button__label {
  color: #f8ecc8;
  font-weight: 700;
  text-shadow: 0 1px 2px #1c1508;
}
.game-tab-button:not(:disabled):not(.locked) :deep(.ink-nine-slice) {
  transition: filter 0.15s ease;
}
.game-tab-button:not(:disabled):not(.locked):not(.selected):not([aria-pressed='true']):hover :deep(.ink-nine-slice) {
  filter: brightness(1.18);
}
.game-tab-button:is(.selected, [aria-pressed='true']) :deep(.ink-nine-slice) {
  filter: brightness(1.45);
}
.game-tab-button:is(.selected, [aria-pressed='true'])::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  box-shadow: inset 0 0 16px rgba(255, 223, 138, 0.9), inset 0 0 5px rgba(255, 236, 190, 0.7);
}
.game-tab-button:is(.selected, [aria-pressed='true']) .game-tab-button__label {
  color: #2f2415;
  text-shadow: none;
}
@media (prefers-reduced-motion: no-preference) {
  .game-tab-button:is(.selected, [aria-pressed='true']) .game-tab-button__label {
    background: linear-gradient(100deg, #e8cf9e 36%, #ffffff 50%, #e8cf9e 64%);
    background-size: 300% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    -webkit-text-stroke: 0.7px #e8cf9e;
    animation: game-tab-glow-sweep 3.2s linear infinite;
  }
}
@keyframes game-tab-glow-sweep {
  0% { background-position: 130% 0; }
  100% { background-position: -30% 0; }
}
.game-tab-button:not(:disabled):active {
  transform: translateY(1px);
}
.game-tab-button:focus,
.game-tab-button:focus-visible {
  outline: none;
}
.game-tab-button:is(:disabled, .locked) {
  cursor: default;
}
.game-tab-button:is(:disabled, .locked) :deep(.ink-nine-slice) {
  opacity: 0.45;
}
.game-tab-button:is(:disabled, .locked) .game-tab-button__label {
  color: #8a7c56;
  text-shadow: none;
}
</style>

