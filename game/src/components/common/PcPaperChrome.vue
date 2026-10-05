<script setup lang="ts">
import '@/assets/pc-paper-scene.css'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
const paper = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png')
</script>

<template>
  <div class="pc-paper-chrome" :style="{ '--pc-chrome-paper': `url('${paper}')` }" aria-hidden="true"><div class="pc-paper-scene__frame" /></div>
</template>

<style scoped>
.pc-paper-chrome { position:absolute;inset:0;z-index:-1;pointer-events:none; }
.pc-paper-chrome::before { content:'';position:absolute;inset:5px;background:var(--pc-chrome-paper) center/100% 100% no-repeat; }
</style>
