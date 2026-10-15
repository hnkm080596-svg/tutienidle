<script setup lang="ts">
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { playUiButtonClick } from '@/presentation/audio/buttonClickAudio'

const props = withDefaults(
  defineProps<{ selected?: boolean; disabled?: boolean; sound?: boolean; silent?: boolean }>(),
  {
    selected: false,
    disabled: false,
    sound: true,
    silent: false,
  },
)
const emit = defineEmits<{ click: [event: MouseEvent] }>()
const normalFrame = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/button-secondary-v1.png')
const selectedFrame = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/button-primary-v1.png')

function handleClick(event: MouseEvent) {
  playUiButtonClick({ sound: props.sound, silent: props.silent })
  emit('click', event)
}
</script>

<template>
  <button type="button" class="game-tab-button" :aria-pressed="selected" :disabled="disabled"
    :style="{ '--tab-frame': `url('${normalFrame}')`, '--tab-selected-art': `url('${selectedFrame}')` }"
    @click="handleClick">
    <img class="game-tab-button__glow" :src="selected ? selectedFrame : normalFrame" alt="" aria-hidden="true">
    <slot />
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
  height: 32px;
  padding: 0 14px;
  border: 0;
  background: transparent;
  color: #f3dfb5;
  font: 700 14px/1 var(--pc-font-body, Georgia, serif);
  white-space: nowrap;
  cursor: pointer;
}
.game-tab-button::before {
  content: '';
  position: absolute;
  inset: 1px;
  z-index: -1;
  background: rgba(9, 14, 11, .88);
  clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px);
}
.game-tab-button::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border: 8px solid transparent;
  border-image: var(--tab-frame) 21.4% 3.22% / 8px stretch;
  pointer-events: none;
}
.game-tab-button[aria-pressed='true'] { color: #30210e; }
.game-tab-button[aria-pressed='true']::before { background: transparent; }
.game-tab-button[aria-pressed='true']::after {
  border: 0;
  border-image: none;
  background: var(--tab-selected-art) center / 100% 100% no-repeat;
}
.game-tab-button__glow {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: -2;
  opacity: 0;
  pointer-events: none;
  filter: brightness(1.2) drop-shadow(0 0 4px #efc364);
}
.game-tab-button:not(:disabled):hover .game-tab-button__glow { opacity: 1; }
.game-tab-button:not(:disabled):active { transform: translateY(1px); }
.game-tab-button:not(:disabled):active::before { filter: brightness(.8); }
.game-tab-button:focus-visible { outline: 2px solid #d6ad5d; outline-offset: 2px; }
.game-tab-button:disabled { opacity: .42; cursor: default; }
</style>
