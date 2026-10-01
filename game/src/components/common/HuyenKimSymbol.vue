<script setup lang="ts">
// HuyenKimSymbol — tintable stable-art glyph (huyen-kim-ui-symbol-set).
// Renders via CSS mask so `color`/`currentColor` owns the tint; runtime
// keeps hover/selected/disabled state styling per the symbol contract.
// Decorative by default — callers provide the accessible label on the
// owning control, never on this glyph.
import { computed } from 'vue'
import { stableSymbolUrl, type StableSymbolId } from '@/presentation/huyenKim/StableSceneArt'

const props = defineProps<{ name: StableSymbolId }>()

const maskUrl = computed(() => `url("${stableSymbolUrl(props.name)}")`)
</script>

<template>
  <span class="hk-symbol" aria-hidden="true" :data-symbol="name" />
</template>

<style scoped>
.hk-symbol {
  display: inline-block;
  width: 1.15em;
  height: 1.15em;
  flex: 0 0 auto;
  background-color: currentColor;
  -webkit-mask-image: v-bind(maskUrl);
  mask-image: v-bind(maskUrl);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}
</style>
