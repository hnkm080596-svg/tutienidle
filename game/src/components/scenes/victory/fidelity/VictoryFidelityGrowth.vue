<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { VictoryGrowthDisplay } from './victoryUi'
import CombatFidelityMeter from '@/components/scenes/combat/fidelity/CombatFidelityMeter.vue'
defineProps<{ growth: readonly VictoryGrowthDisplay[] }>()
const { t } = useI18n()
</script>
<template><section class="victory-growth" :aria-label="t('growth')"><h2>{{ t('growth') }}</h2><div class="growth-cards"><article v-for="entry in growth" :key="entry.id" :style="{ '--growth-tone': entry.tone }"><header><img :src="entry.icon" alt=""><span>{{ entry.label }}</span><strong>{{ entry.value }}</strong></header><CombatFidelityMeter :label="entry.label" :value="entry.detail" :percent="entry.progress" tone="ward" /></article></div><p v-if="!growth.length">{{ t('emptyGrowth') }}</p></section></template>
<style scoped>
.victory-growth h2 { width:250px; margin:0 auto 14px; padding:5px 15px; border:1px solid #9a7c40; color:#f9e5b5; background:linear-gradient(#293a29,#132018); text-align:center; font-size:16px; font-weight:500; clip-path:polygon(12px 0,calc(100% - 12px) 0,100% 50%,calc(100% - 12px) 100%,12px 100%,0 50%); }.growth-cards { display:flex; gap:14px; overflow:auto; padding:3px 0 8px; scrollbar-width:thin; }.growth-cards article { flex:1 0 218px; padding:11px 12px 12px; background:linear-gradient(130deg,#2a382a,#0d1e15); border:1px solid #a88c52; border-radius:3px; box-shadow:inset 0 0 0 2px #cfb4771a; color:#e9d5a7; }.growth-cards header { display:flex; align-items:center; gap:8px; margin-bottom:10px; font-size:13px; }.growth-cards img { width:25px; height:25px; filter:invert(.8) sepia(.7); }.growth-cards strong { margin-left:auto; color:var(--growth-tone); font-size:14px; }.victory-growth p { text-align:center; color:#6e5937; font-size:13px; }
.victory-growth h2 { margin-bottom:8px; padding:3px 15px; font-size:15px; }.growth-cards { padding-bottom:3px; }.growth-cards article { padding:8px 12px; }.growth-cards header { margin-bottom:6px; }.growth-cards img { width:21px; height:21px; }
</style>
