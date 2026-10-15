<script setup lang="ts">
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
defineProps<{ label: string }>()
const frame = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/button-secondary-v1.png')
</script>
<template>
  <h2 class="game-card-title" :style="{ '--title-frame': `url('${frame}')` }"><span>{{ label }}</span></h2>
</template>
<style scoped>
.game-card-title {
  position: relative;
  isolation: isolate;
  width: 180px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0 18px;
  border: 0;
  color: #f3dfb5;
  font: 700 16px/1 var(--pc-font-body, Georgia, serif);
  text-align: center;
  white-space: nowrap;
}
.game-card-title::before {
  content: '';
  position: absolute;
  inset: 1px;
  z-index: -1;
  background: rgba(9, 14, 11, .96);
  clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px);
}
.game-card-title::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border: 8px solid transparent;
  border-image: var(--title-frame) 21.4% 3.22% / 8px stretch;
  pointer-events: none;
}
</style>
