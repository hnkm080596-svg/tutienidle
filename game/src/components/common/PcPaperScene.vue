<script setup lang="ts">
import '@/assets/pc-paper-scene.css'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { pcPaperControlStyles } from '@/presentation/assets/PcPaperControls'

defineProps<{ title: string; subtitle?: string; navigation?: boolean }>()
const paper = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png')
const titleCloud = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/shared-title-cloud-v1.png')
const controls = pcPaperControlStyles()
</script>

<template>
  <div class="pc-paper-scene" :class="{ 'pc-paper-scene--navigation': navigation }" :style="{ backgroundImage: `url('${paper}')`, ...controls }">
    <div class="pc-paper-scene__frame" aria-hidden="true" />
    <aside v-if="navigation" class="pc-paper-scene__navigation"><slot name="navigation" /></aside>
    <header class="pc-paper-scene__header">
      <div class="pc-paper-scene__heading"><h1>{{ title }}</h1><img class="pc-paper-scene__title-flourish pc-paper-scene__title-flourish--left" :src="titleCloud" alt="" aria-hidden="true"><img class="pc-paper-scene__title-flourish pc-paper-scene__title-flourish--right" :src="titleCloud" alt="" aria-hidden="true"></div>
      <p v-if="subtitle">{{ subtitle }}</p>
      <div v-if="$slots.actions" class="pc-paper-scene__actions"><slot name="actions" /></div>
    </header>
    <div class="pc-paper-scene__tabs"><slot name="tabs" /></div>
    <main class="pc-paper-scene__workspace"><slot /></main>
    <footer class="pc-paper-scene__footer"><slot name="footer" /></footer>
  </div>
</template>
