<script setup lang="ts">
// Scene 13 chapter-tracker region (spec: 536/44/600/66, node family,
// dao-luan-node - delivered). Sequential pips: done / current states;
// chaptersTotal dynamic, NOT selectable.
import { computed } from 'vue'
import { hkChromeUrl } from '@/ui/huyenKimChrome'

const props = defineProps<{
  chapterNames: readonly string[]
  chapterIndex: number
  label: string
}>()
const nodeUrl = hkChromeUrl('dao-luan-node')
const names = computed(() => props.chapterNames)
</script>

<template>
  <ol class="tribulation-ui__tracker" data-hk-region="chapter-tracker" :aria-label="label">
    <li
      v-for="(name, index) in names"
      :key="index"
      class="tribulation-ui__tracker-pip"
      :class="{ 'is-done': index < chapterIndex, 'is-current': index === chapterIndex }"
    >
      <img v-if="nodeUrl" :src="nodeUrl" alt="" aria-hidden="true" />
      <span>{{ name }}</span>
    </li>
  </ol>
</template>

<style scoped>
/* Spec 14 chapter-tracker 536/44/600/66: centered 600px band at
   4.68% top - clear of the title band (12.75%) and the realm card
   moved there, so the top row no longer collides. */
.tribulation-ui__tracker { position:absolute; top:4.68%; left:50%; transform:translateX(-50%); width:min(35.89vw, 600px); justify-content:center; display:flex; gap:18px; margin:0; padding:0; list-style:none; }
.tribulation-ui__tracker-pip { position:relative; display:grid; place-items:center; min-width:64px; padding:4px 10px; font-family:var(--font-display); font-size:var(--text-xs); letter-spacing:.12em; color:var(--scene-tribulation-text-soft); opacity:.55; }
/* The medallion overhangs the pip and its dark center used to swallow
   the phase label; keep it inside the pip bounds and under the text. */
.tribulation-ui__tracker-pip img { position:absolute; inset:-2px; width:calc(100% + 4px); height:calc(100% + 4px); object-fit:fill; opacity:.35; pointer-events:none; z-index:0; }
.tribulation-ui__tracker-pip span { position:relative; z-index:1; padding:0 6px; border-radius:8px; background:color-mix(in srgb, var(--scene-tribulation-deep, #08101e) 62%, transparent); }
.tribulation-ui__tracker-pip.is-done { opacity:.8; color:var(--scene-tribulation-text); }
.tribulation-ui__tracker-pip.is-current { opacity:1; color:var(--chrome-100); text-shadow:0 0 10px var(--scene-tribulation-glow); }
.tribulation-ui__tracker-pip.is-current img { opacity:1; filter:drop-shadow(0 0 8px var(--scene-tribulation-glow)); }
</style>
