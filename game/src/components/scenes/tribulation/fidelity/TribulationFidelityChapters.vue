<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type { TribulationChapterDisplay } from './tribulationUi'
const props = defineProps<{ chapters: readonly TribulationChapterDisplay[]; current: string }>()
const { t } = useI18n()
const index = computed(() => props.chapters.findIndex(chapter => chapter.id === props.current))
const ring = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/runtime/orb-frame.png')
</script>
<template><ol class="chapter-tracker" :aria-label="t('chapters')"><li v-for="(chapter, i) in chapters" :key="chapter.id" :class="{ current: chapter.id === current, complete: i < index }" :aria-current="chapter.id === current ? 'step' : undefined"><span class="chapter-medallion"><img class="chapter-ring" :src="ring" alt=""><img class="chapter-symbol" :src="chapter.icon" alt=""></span><strong>{{ i + 1 }}. {{ chapter.name }}</strong><span class="chapter-hint">{{ chapter.hint }}</span></li></ol></template>
<style scoped>
.chapter-tracker { position:absolute; left:411px; top:18px; width:630px; margin:0; padding:0; display:flex; list-style:none; }.chapter-tracker::before { content:''; position:absolute; top:35px; left:50px; right:50px; height:4px; background:linear-gradient(#cfb776,#52452e,#e3ca83); box-shadow:0 2px 3px #000; }.chapter-tracker li { position:relative; flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; gap:4px; text-align:center; color:#b7b4aa; }.chapter-medallion { position:relative; width:72px; height:72px; border-radius:50%; background:radial-gradient(#303830,#0b1310 65%); }.chapter-ring { position:absolute; inset:0; width:100%; height:100%; opacity:.45; filter:grayscale(1); }.chapter-symbol { position:absolute; inset:22%; width:56%; height:56%; filter:invert(.75); }.chapter-tracker strong { font-size:17px; text-shadow:0 2px 4px #000; }.chapter-hint { font-size:12px; text-shadow:0 1px 4px #000; }.current { color:#ffe2a1!important; }.current .chapter-ring,.complete .chapter-ring { opacity:1; filter:drop-shadow(0 0 7px #d6a53b88); }.current .chapter-symbol,.complete .chapter-symbol { filter:invert(.85) sepia(.8) saturate(2); }.complete { color:#d2bd80!important; }
.chapter-tracker { padding-bottom:8px; background:linear-gradient(90deg,transparent,#101718ad 15%,#101718ad 85%,transparent); }.chapter-hint { color:#d1c6a7; }.current .chapter-hint { color:#f2d59a; }
</style>
