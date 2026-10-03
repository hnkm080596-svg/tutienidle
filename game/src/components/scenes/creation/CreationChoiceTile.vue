<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import HuyenKimSymbol from '@/components/common/HuyenKimSymbol.vue'
import type { StableSymbolId } from '@/presentation/huyenKim/StableSceneArt'
import type { PlainTooltipContent } from '@/composables/useTooltip'
import { vTooltip } from '@/directives/tooltip'
const props = defineProps<{
  name: string; icon?: string; symbol: StableSymbolId; tooltip: PlainTooltipContent
  selected: boolean; disabled?: boolean
}>()
defineEmits<{ select: [] }>()
const imageFailed = shallowRef(false)
watch(() => props.icon, () => { imageFailed.value = false })
</script>

<template>
  <button v-tooltip="tooltip" class="creation-choice-tile" :class="{ selected }" type="button"
    :aria-pressed="selected" :disabled="disabled" @click="$emit('select')">
    <span class="creation-choice-tile__icon" aria-hidden="true">
      <slot name="icon">
      <img v-if="icon && !imageFailed" :src="icon" alt="" draggable="false" @error="imageFailed = true" />
      <HuyenKimSymbol v-else :name="symbol" />
      </slot>
    </span>
    <span class="creation-choice-tile__name">{{ name }}</span>
    <svg v-if="selected" class="creation-choice-tile__check" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>
  </button>
</template>

<style scoped>
.creation-choice-tile { position: relative; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; width: 100%; aspect-ratio: 1; min-width: 0; padding: 12px 5px 8px; border: 1px solid #9c885e; border-radius: 3px; background: radial-gradient(ellipse at 50% 36%, #53635355, transparent 68%), linear-gradient(145deg, #263930, #131e1c); box-shadow: inset 0 0 0 3px #182a24, inset 0 0 0 4px #8872485e, 0 3px 6px #2c281b26; color: #d8c79c; cursor: pointer; transition: border-color 150ms, box-shadow 150ms, filter 150ms; }
.creation-choice-tile:hover { border-color: #c2a461; filter: brightness(1.13); }
.creation-choice-tile.selected { border: 2px solid #ab7934; padding: 11px 4px 7px; background: radial-gradient(ellipse at 50% 32%, #547d526e, transparent 70%), linear-gradient(145deg, #254f40, #122c27); box-shadow: inset 0 0 0 2px #193b30, inset 0 0 0 3px #d7ba6c, 0 0 10px #ac945343; color: #ffedb8; }
.creation-choice-tile:focus-visible { outline: 2px solid #386b57; outline-offset: 3px; }
.creation-choice-tile:disabled { opacity: .6; cursor: wait; }
.creation-choice-tile__icon { width: 52px; height: 52px; display: grid; place-items: center; font-size: 39px; color: #d2bb79; }
.creation-choice-tile__icon img { width: 100%; height: 100%; object-fit: contain; border-radius: 4px; }
.creation-choice-tile__name { display: flex; align-items: center; justify-content: center; height: 30px; max-width: 100%; font: 500 13px/1.15 var(--hk-font-display, Georgia, serif); text-align: center; }
.creation-choice-tile__check { position: absolute; top: 5px; right: 5px; width: 12px; height: 12px; fill: none; stroke: #f0d995; stroke-width: 2; }
@media (prefers-reduced-motion: reduce) { .creation-choice-tile { transition: none; } }
</style>
