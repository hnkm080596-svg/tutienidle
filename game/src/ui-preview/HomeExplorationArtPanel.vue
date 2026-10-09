<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import PaperSceneDesigns from './PaperSceneDesigns.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
const { t } = useI18n()
const paper = { backgroundImage: `url('${resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png')}')` }
</script>
<template>
  <section class="home-map-art" :style="paper" data-testid="home-map-panel">
    <header><h1>{{ t('map') }}</h1></header>
    <div class="home-map-content"><PaperSceneDesigns kind="map" /></div>
  </section>
</template>
<style scoped>
.home-map-art { position:absolute;left:24%;top:12.5%;width:74%;height:75%;z-index:20;background:#f2e4c8 center/cover no-repeat;border:3px double #b28a43;box-sizing:border-box;padding:12px 24px 18px;color:#30271b; }
header { position:relative;inset:auto;height:52px;border-bottom:1px solid #b28b4680; }
h1 { margin:0;font:700 38px/1.2 var(--pc-font-body); }
.home-map-content { height:calc(100% - 66px);padding-top:14px; }
.home-map-content :deep(.paper-map-scene) { grid-template-columns:145px minmax(0,1fr) 235px;gap:14px; }
.home-map-content :deep(.paper-map-scene__chapters) { overflow-y:auto;scrollbar-width:none; }
.home-map-content :deep(.paper-map-scene__chapters::-webkit-scrollbar) { display:none; }
.home-map-content :deep(.paper-map-scene__chapters button) { font-size:15px;padding:10px 6px;gap:4px; }
.home-map-content :deep(h2) { font-size:21px; }
.home-map-content :deep(.paper-scene-inspector) { min-height:0;padding:14px;font-size:15px; }
.home-map-content :deep(.paper-scene-inspector h3) { font-size:18px;margin:18px 0 10px; }
.home-map-content :deep(.paper-map-scene__rewards) { gap:8px; }
.home-map-content :deep(.paper-map-scene__rewards .pc-paper-slot) { width:56px;height:56px; }
.home-map-content :deep(.paper-map-scene__landscape > h2) { left:8px;padding:5px;font-size:20px; }
.home-map-content :deep(.paper-map-scene__landscape > p) { font-size:13px;padding:8px; }
.home-map-content :deep(.paper-scene-inspector) { border:14px solid transparent;border-image:url('/assets/ui/tien-hiep-2026-10/controls/character-card-nine-slice-v2.png') 160 stretch;clip-path:inset(4.7px 1.8px 5.3px 1.9px round 5px);box-sizing:border-box;color:#efdfb9;overflow:hidden;display:flex;flex-direction:column;gap:8px;background:linear-gradient(#000000d9,#000000d9) border-box 2px 5px/calc(100% - 4px) calc(100% - 10px) no-repeat;}
.home-map-content :deep(.paper-scene-inspector h2),.home-map-content :deep(.paper-scene-inspector h3) { margin:0;padding:4px 0; }
.home-map-content :deep(.paper-scene-inspector p) { margin:0;font-size:14px;line-height:1.35; }
.home-map-content :deep(.paper-scene-inspector dl) { margin:0;font-size:13px; }
.home-map-content :deep(.paper-scene-inspector dl div) { display:flex;justify-content:space-between;gap:5px;padding:8px 0; }
.home-map-content :deep(.paper-scene-inspector dd) { margin:0; }
.home-map-content :deep(.paper-map-scene__rewards) { padding-top:0; }
.home-map-content :deep(.paper-scene-inspector .pc-paper-button) { margin-top:auto;min-height:40px;font-size:18px;background:url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-normal-v2.png') center/100% 100% no-repeat;color:#efdcb6; }
</style>

