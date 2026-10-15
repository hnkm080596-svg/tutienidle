<script setup lang="ts">
import { ref } from 'vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import GameCardTitle from './GameCardTitle.vue'
withDefaults(defineProps<{ title?: string; frameSrc?: string; as?: 'div' | 'section' | 'article' | 'aside' | 'button' | 'ul' }>(), { as: 'section' })
const element = ref<HTMLElement | null>(null)
const frame = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/character-card-nine-slice-v2.png')
defineExpose({ element })
</script>
<template>
  <component :is="as" ref="element" class="game-card game-panel__card" :class="{ 'game-card--titled': !!title || !!$slots.title }">
    <component :is="as === 'ul' ? 'li' : 'span'" class="game-card__fill" aria-hidden="true" />
    <component :is="as === 'ul' ? 'li' : 'span'" class="game-card__frame" :style="{ borderImageSource: `url('${frameSrc ?? frame}')` }" aria-hidden="true" />
    <slot />
    <div v-if="$slots.viewport" class="game-card__viewport"><slot name="viewport" /></div>
    <div v-if="title || $slots.title" class="game-card__title"><slot name="title"><GameCardTitle :label="title ?? ''" /></slot></div>
  </component>
</template>
<style scoped>
.game-card {
  --game-card-frame-top: 0px;
  --game-card-inner-top: calc(var(--game-card-frame-top) + 7px);
  --game-card-inner-side: 4px;
  --game-card-inner-bottom: 8px;
  box-sizing: border-box;
  position: relative;
  isolation: isolate;
  min-width: 0;
  min-height: 0;
  padding: 14px 16px;
  border: 0;
  background: transparent;
  color: #f3e4c4;
  clip-path: inset(5.1px 2.1px 5.7px 2.2px round 6px);
}
.game-card > .game-card__frame {
  box-sizing: border-box;
  position: absolute;
  inset: var(--game-card-frame-top) 0 0;
  z-index: -1;
  pointer-events: none;
  clip-path: inset(5.1px 2.1px 5.7px 2.2px round 6px);
  border: 15px solid transparent;
  border-image-slice: var(--game-card-frame-slice, 160);
  border-image-width: var(--game-card-frame-width, 15px);
  border-image-repeat: stretch;
}
.game-card > .game-card__fill {
  position: absolute;
  inset: var(--game-card-inner-top) var(--game-card-inner-side) var(--game-card-inner-bottom);
  z-index: -2;
  pointer-events: none;
  background: rgba(9, 14, 11, .88);
  clip-path: polygon(9px 0, calc(100% - 9px) 0, 100% 9px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0 calc(100% - 9px), 0 9px);
}
.game-card--titled { --game-card-frame-top: 12px; clip-path: none; padding-top: 42px; }
.game-card__title { position: absolute; top: 18px; left: 50%; transform: translate(-50%, -50%); z-index: 1; max-width: calc(100% - 24px); }
.game-card__viewport {
  position: absolute;
  inset: var(--game-card-inner-top) var(--game-card-inner-side) var(--game-card-inner-bottom);
  min-width: 0;
  min-height: 0;
  overflow: clip;
  clip-path: inset(0 round 5px);
}
</style>
