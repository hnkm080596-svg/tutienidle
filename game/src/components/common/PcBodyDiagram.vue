<script setup lang="ts">
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import '../../../art/vfx/pc-paper-meridian/acupoint-aura.css'
const diagram = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/body-diagram-v1.png')
const points = [{ x: 586, y: 158 }, { x: 585, y: 515 }, { x: 585, y: 775 }]
</script>

<template>
  <div class="pc-body-diagram" aria-hidden="true">
    <img :src="diagram" alt="">
    <svg viewBox="0 0 1174 1178" preserveAspectRatio="xMidYMid meet" fill="none">
      <path class="pc-body-diagram__trace" d="M586 98L586 158 585 295 585 411 585 515 585 627 585 775 585 881" stroke="#fff0ba" stroke-width="1.5" />
      <foreignObject v-for="(point,index) in points" :key="index" :x="point.x - 32" :y="point.y - 32" width="64" height="64"><div xmlns="http://www.w3.org/1999/xhtml" class="pc-acupoint-aura" :style="{ animationDelay: `${index * -.65}s` }" /></foreignObject>
    </svg>
  </div>
</template>

<style scoped>
.pc-body-diagram { pointer-events: none; }
.pc-body-diagram > img, .pc-body-diagram > svg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
.pc-body-diagram__trace { opacity: 0; stroke-dasharray: 90 700; stroke-dashoffset: 90; animation: pc-meridian-trace 18s linear infinite; }
.pc-body-diagram .pc-acupoint-aura { left: 32px; top: 32px; }
@keyframes pc-meridian-trace { 0%, 70%, 100% { opacity: 0; } 6%, 48% { opacity: .45; } 0% { stroke-dashoffset: 90; } 70%, 100% { stroke-dashoffset: -790; } }
@media (prefers-reduced-motion: reduce) { .pc-body-diagram__trace { animation: none; opacity: 0; } }
</style>
