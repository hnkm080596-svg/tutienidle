<script setup lang="ts">
import { useId } from 'vue'
const identity = useId()
const radiance = `${identity}-radiance`
const glow = `${identity}-glow`
const nodes = [[50, 15], [50, 28], [50, 40], [50, 53], [50, 67], [37, 36], [63, 36], [30, 48], [70, 48], [22, 62], [78, 62], [36, 74], [64, 74], [29, 85], [71, 85]]
</script>

<template>
  <svg class="pc-body-meridians" viewBox="0 0 100 100" fill="none" aria-hidden="true">
    <defs><radialGradient :id="radiance"><stop stop-color="#fff4ae" stop-opacity=".8" /><stop offset=".28" stop-color="#e8b954" stop-opacity=".5" /><stop offset="1" stop-color="#dca143" stop-opacity="0" /></radialGradient><filter :id="glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation=".8" /></filter></defs>
    <ellipse cx="50" cy="41" rx="17" ry="19" :fill="`url(#${radiance})`" /><ellipse cx="50" cy="62" rx="18" ry="18" :fill="`url(#${radiance})`" />
    <g stroke="#e6bd65" stroke-width=".8"><path d="M50 15V67M50 28L37 36 30 48 22 62M50 28L63 36 70 48 78 62M50 53L36 74 29 85M50 53L64 74 71 85M37 36Q50 48 63 36M36 74Q50 82 64 74" /><path d="M47 19Q40 39 47 61M53 19Q60 39 53 61" stroke-width=".35" /></g>
    <g v-for="(node,index) in nodes" :key="index"><circle :cx="node[0]" :cy="node[1]" r="2.4" fill="#ffc864" :filter="`url(#${glow})`" /><circle :cx="node[0]" :cy="node[1]" r=".9" fill="#fff1b1" stroke="#f3cb76" stroke-width=".3" /></g>
  </svg>
</template>

<style scoped>
.pc-body-meridians { pointer-events: none; width: 100%; height: 100%; }
</style>
