<script setup lang="ts">
import type { EquipmentDisplay } from './equipmentUi'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
defineProps<{ item: EquipmentDisplay }>()
const paper = resolveAssetUrl('/assets/ui/huyen-kim/scene/dong-fu-v2/panel-nine-slice.png')
</script>
<template>
  <aside id="equipment-tooltip" role="tooltip" class="gear-tooltip" :style="{ borderImageSource: `url('${paper}')`, '--gear-tone': item.tone }">
    <header class="tooltip-heading"><img :src="item.icon" alt=""><div><h2>{{ item.name }}</h2><p>{{ item.grade }}</p></div></header>
    <p class="tooltip-meta">{{ item.slot }} · {{ item.level }} <strong>{{ item.enhancement }}</strong></p>
    <dl class="tooltip-stats"><div v-for="stat in item.stats" :key="stat.label"><dt>{{ stat.label }}</dt><dd>{{ stat.value }}</dd></div></dl>
    <p class="tooltip-description">{{ item.description }}</p>
  </aside>
</template>
<style scoped>
.gear-tooltip { position:absolute; z-index:20; left:716px; top:264px; width:306px; min-height:285px; padding:28px; border:0 solid transparent; border-image-slice:360 fill; border-image-width:30px; border-image-repeat:stretch; filter:drop-shadow(0 8px 12px #17150db3); color:#ede0bf; pointer-events:none; }
.tooltip-heading { display:flex; align-items:center; gap:12px; padding-bottom:13px; border-bottom:1px solid #b899505c; }.tooltip-heading img { width:55px; height:55px; object-fit:contain; filter:drop-shadow(0 2px 3px #000); }.tooltip-heading h2 { margin:0 0 5px; font-size:21px; line-height:1.2; color:#f5d390; text-shadow:0 2px 3px #000; }.tooltip-heading p { margin:0; font-size:12px; color:var(--gear-tone); font-weight:700; }.tooltip-meta { font-size:12px; margin:12px 0; color:#d5c59f; }.tooltip-meta strong { float:right; color:#96d6ab; }.tooltip-stats { margin:15px 0; }.tooltip-stats div { display:flex; justify-content:space-between; gap:12px; margin:9px 0; font-size:14px; }.tooltip-stats dd { margin:0; color:#97d7ac; font-weight:600; }.tooltip-description { margin:15px 0 0; padding-top:12px; border-top:1px solid #b8995055; font-size:12px; line-height:1.65; color:#c7ba99; }
</style>
