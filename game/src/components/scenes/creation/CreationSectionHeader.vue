<script setup lang="ts">
import HuyenKimSymbol from '@/components/common/HuyenKimSymbol.vue'
import type { StableSymbolId } from '@/presentation/huyenKim/StableSceneArt'
defineProps<{ icon: StableSymbolId; title: string }>()
</script>

<template>
  <header class="creation-section-header">
    <HuyenKimSymbol class="creation-section-header__symbol" :name="icon" />
    <h2 class="creation-section-header__title">{{ title }}</h2>
    <span class="creation-section-header__hint"><slot name="hint" /></span>
  </header>
</template>

<style scoped>
.creation-section-header { display: flex; align-items: center; gap: 7px; height: 25px; margin-bottom: 5px; }
.creation-section-header__symbol { color: #70613c; font-size: 17px; }
.creation-section-header__title { margin: 0; color: #37372b; font: 600 17px var(--hk-font-display, Georgia, serif); }
.creation-section-header__hint { margin-left: auto; color: #766a53; font-size: 11px; }
</style>
