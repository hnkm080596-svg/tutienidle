<script setup lang="ts">
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import '@/assets/rail-panel-layout.css'
defineProps<{ title: string }>()
const paper = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png')
</script>
<template>
  <div class="game-panel rail-panel-chrome" :style="{ backgroundImage: `url('${paper}')` }">
    <header class="game-panel__header">
      <div class="game-panel__heading"><h1 class="game-panel__title">{{ title }}</h1></div>
      <div class="game-panel__line" aria-hidden="true" />
    </header>
    <div class="game-panel__content"><slot /></div>
  </div>
</template>
