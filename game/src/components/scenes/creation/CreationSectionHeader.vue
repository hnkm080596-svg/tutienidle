<script setup lang="ts">
import HuyenKimSymbol from '@/components/common/HuyenKimSymbol.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import type { StableSymbolId } from '@/presentation/huyenKim/StableSceneArt'
defineProps<{ icon: StableSymbolId; title: string }>()
</script>

<template>
  <header class="creation-section-header">
    <InkNineSlice chrome-id="section-plaque" layer="surface" />
    <HuyenKimSymbol class="creation-section-header__symbol" :name="icon" />
    <h2 class="creation-section-header__title">{{ title }}</h2>
    <span class="creation-section-header__hint"><slot name="hint" /></span>
  </header>
</template>

<style scoped>
/* wave B chrome: drawn section-plaque band (240x56, dark parchment
   banner) carries the header row; height clears the plaque's 16px caps
   and the text flips light to sit on the dark art. */
.creation-section-header { position: relative; display: flex; align-items: center; gap: 7px; height: 34px; margin-bottom: 5px; padding: 0 14px; }
.creation-section-header > :not(.ink-nine-slice) { position: relative; z-index: 2; }
.creation-section-header__symbol { color: #d8c290; font-size: 17px; }
.creation-section-header__title { margin: 0; color: #efe4c2; font: 600 17px var(--hk-font-display, Georgia, serif); }
.creation-section-header__hint { margin-left: auto; color: #b6a67e; font-size: 11px; }
</style>
