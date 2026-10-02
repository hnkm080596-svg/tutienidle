<script setup lang="ts">
// Scene 13 hp-cluster region (spec: 616/736/440/84, hud family,
// entity-bar frame — delivered). Audit CORRECTED: single canonical HP
// bar + strikes counter (second resource bar INVALID). The resolve
// caption under the bar is the ref's bottom flavor line.
import { useI18n } from 'vue-i18n'
import Bar from '@/components/common/primitives/Bar.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { formatNumber } from '@/core/format/NumberFormatter'

defineProps<{
  hp: number
  maxHp: number
}>()
const { t } = useI18n()
</script>

<template>
  <div class="tribulation-ui__hp-cluster" data-hk-region="hp-cluster">
    <div class="tribulation-ui__hp-frame">
      <InkNineSlice chrome-id="entity-bar" layer="frame" />
      <Bar class="tribulation-ui__hp-track" :value="hp" :max="maxHp" :height="14" />
    </div>
    <div class="tribulation-ui__hp">{{ t('tribulation.overlay.hp', { hp: formatNumber(Math.ceil(hp)), max: formatNumber(maxHp) }) }}</div>
    <div class="tribulation-ui__resolve">{{ t('tribulation.overlay.resolve') }}</div>
  </div>
</template>

<style scoped>
.tribulation-ui__hp-cluster { position:absolute; top:calc(62% + 84px); left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; width:min(340px, 80vw); }
.tribulation-ui__hp-frame { position:relative; width:100%; padding:2px 4px; }
.tribulation-ui__hp-track { width:100%; border-radius:4px; --bar-track: var(--scene-tribulation-deep); --bar-from: var(--scene-tribulation-hp); --bar-to: var(--scene-tribulation-hp); }
.tribulation-ui__hp { margin-top:6px; font-size:var(--text-xs); text-shadow:0 1px 3px #000; }
.tribulation-ui__resolve { margin-top:8px; font-size:var(--text-xs); font-style:italic; color:var(--hk-gold-muted, #b99a55); text-shadow:0 1px 3px #000; }
</style>
