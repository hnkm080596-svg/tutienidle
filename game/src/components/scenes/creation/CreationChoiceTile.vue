<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import HuyenKimSymbol from '@/components/common/HuyenKimSymbol.vue'
import type { StableSymbolId } from '@/presentation/huyenKim/StableSceneArt'
import type { PlainTooltipContent } from '@/composables/useTooltip'
import { vTooltip } from '@/directives/tooltip'
const props = defineProps<{
  name: string; icon?: string; symbol: StableSymbolId; tooltip: PlainTooltipContent
  selected: boolean; disabled?: boolean
  /** radio: single-choice card inside a radiogroup (talent pick).
   *  display: cosmetic preview card - no control semantics, no events.
   *  locked: dimmed unavailable option (display cards only). */
  radio?: boolean; display?: boolean; locked?: boolean
}>()
defineEmits<{ select: [] }>()
const imageFailed = shallowRef(false)
watch(() => props.icon, () => { imageFailed.value = false })
</script>

<template>
  <div v-if="display" v-tooltip="tooltip" class="creation-choice-tile creation-choice-tile--display" :class="{ 'creation-choice-tile--locked': locked }">
    <span class="creation-choice-tile__icon" aria-hidden="true">
      <slot name="icon">
        <img v-if="icon && !imageFailed" :src="icon" alt="" draggable="false" @error="imageFailed = true" />
        <HuyenKimSymbol v-else :name="symbol" />
      </slot>
    </span>
    <span class="creation-choice-tile__name"><span class="creation-choice-tile__name-text">{{ name }}</span></span>
  </div>
  <button
    v-else v-tooltip="tooltip" class="creation-choice-tile" :class="{ selected }" type="button"
    :role="radio ? 'radio' : undefined" :aria-checked="radio ? selected : undefined"
    :aria-pressed="radio ? undefined : selected" :disabled="disabled" @click="$emit('select')"
  >
    <span class="creation-choice-tile__icon" aria-hidden="true">
      <slot name="icon">
        <img v-if="icon && !imageFailed" :src="icon" alt="" draggable="false" @error="imageFailed = true" />
        <HuyenKimSymbol v-else :name="symbol" />
      </slot>
    </span>
    <span class="creation-choice-tile__name"><span class="creation-choice-tile__name-text">{{ name }}</span></span>
    <svg v-if="selected" class="creation-choice-tile__check" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>
  </button>
</template>

<style scoped>
/* Fixed regions: the ratio-sized box never grows (grid-item auto
   min-height would otherwise let a long name stretch it, pushing the
   row below), and the icon/name slots keep identical sizes per tile. */
.creation-choice-tile { position: relative; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; width: 100%; aspect-ratio: 176 / 112; min-width: 0; min-height: 0; overflow: hidden; padding: 7px 5px 6px; border: 1px solid #9c885e; border-radius: 3px; background: radial-gradient(ellipse at 50% 36%, #53635355, transparent 68%), linear-gradient(145deg, #263930, #131e1c); box-shadow: inset 0 0 0 3px #182a24, inset 0 0 0 4px #8872485e, 0 3px 6px #2c281b26; color: #d8c79c; cursor: pointer; transition: border-color 150ms, box-shadow 150ms, filter 150ms; }
.creation-choice-tile--display { cursor: default; }
.creation-choice-tile--locked { opacity: .55; filter: saturate(.3); }
.creation-choice-tile:not(.creation-choice-tile--display):hover { border-color: #c2a461; filter: brightness(1.13); }
.creation-choice-tile.selected { border: 2px solid #ab7934; padding: 6px 4px 5px; background: radial-gradient(ellipse at 50% 32%, #547d526e, transparent 70%), linear-gradient(145deg, #254f40, #122c27); box-shadow: inset 0 0 0 2px #193b30, inset 0 0 0 3px #d7ba6c, 0 0 10px #ac945343; color: #ffedb8; }
.creation-choice-tile:focus-visible { outline: 2px solid #386b57; outline-offset: 3px; }
.creation-choice-tile:disabled { opacity: .6; cursor: wait; }
.creation-choice-tile__icon { flex: none; width: 30px; height: 30px; overflow: hidden; display: grid; place-items: center; font-size: 24px; color: #d2bb79; }
.creation-choice-tile__icon > :deep(*) { max-width: 100%; max-height: 100%; }
.creation-choice-tile__icon img { width: 100%; height: 100%; object-fit: contain; border-radius: 4px; }
.creation-choice-tile__name { flex: none; display: flex; align-items: center; justify-content: center; height: 28px; min-height: 0; max-width: 100%; overflow: hidden; font: 500 12px/1.15 var(--hk-font-display, Georgia, serif); text-align: center; }
.creation-choice-tile__name-text { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.creation-choice-tile__check { position: absolute; top: 4px; right: 4px; width: 11px; height: 11px; fill: none; stroke: #f0d995; stroke-width: 2; }
@media (prefers-reduced-motion: reduce) { .creation-choice-tile { transition: none; } }
</style>
