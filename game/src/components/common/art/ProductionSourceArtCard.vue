<script setup lang="ts">
// Production source card - the LANDSCAPE preview shape shared by the
// design preview and the canonical San Xuat panel (2026-10-11 port;
// was index-based preview i18n). Presentation only: every label and
// state flag arrives through props so each caller keeps its own domain
// reads - nothing here touches the game state.
import EquipmentArtButton from './EquipmentArtButton.vue'
import EquipmentEnergyTube from './EquipmentEnergyTube.vue'
withDefaults(defineProps<{
  icon: string
  landscape: string
  name: string
  typeLabel: string
  description: string
  statLines?: readonly string[]
  rewardLine?: string
  fill?: number
  statusLabel?: string
  autoLabel: string
  autoChecked: boolean
  costLines?: readonly { text: string; missing?: boolean }[]
  upgradeLabel: string
  upgradeDisabled?: boolean
  showUpgrade?: boolean
}>(), {
  statLines: () => [],
  rewardLine: '',
  fill: 0,
  statusLabel: '',
  costLines: () => [],
  upgradeDisabled: false,
  showUpgrade: true,
})
defineEmits<{toggle:[];upgrade:[]}>()
</script>
<template><article class="production-source-card"><div class="source-landscape" :style="{backgroundImage:`url('${landscape}')`}"><div class="source-medallion"><img :src="icon" alt=""></div></div><div class="source-title"><h2>{{name}}</h2><span>{{typeLabel}}</span></div><div class="source-body"><p>{{description}}</p><strong v-for="(line,i) in statLines" :key="i">{{line}}</strong><p v-if="rewardLine" class="site-card__reward">{{rewardLine}}</p><EquipmentEnergyTube :fill="fill" color="#6bbd92"/><small v-if="statusLabel">{{statusLabel}}</small><label><input type="checkbox" :checked="autoChecked" @change="$emit('toggle')">{{autoLabel}}</label><div v-if="showUpgrade" class="source-costs"><span v-for="(cost,i) in costLines" :key="i" :class="{'is-missing':cost.missing}">{{cost.text}}</span></div><EquipmentArtButton v-if="showUpgrade" gold :disabled="upgradeDisabled" @click="$emit('upgrade')">{{upgradeLabel}}</EquipmentArtButton></div></article></template>
<style scoped>
.production-source-card{min-height:0;display:flex;flex-direction:column;border:3px double #b58a42;background:#f2e4c8 url('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png') center/cover;color:#30271b;box-shadow:0 1px 4px #241a1530;}.source-landscape{position:relative;flex:none;height:110px;background-position:center;background-size:cover;display:grid;place-items:center;}.source-medallion{width:78px;height:78px;display:grid;place-items:center;background:#171a15;border:3px double #c6a154;border-radius:50%;box-shadow:0 0 8px #e8bd6860;}.source-medallion img{width:62px;height:62px;object-fit:contain;}.source-title{display:flex;align-items:center;justify-content:space-between;gap:5px;padding:7px 10px;background:#24251e;color:#efdcb8;border-block:1px solid #b28a43;}.source-title h2{font:700 19px var(--pc-font-body);margin:0;}.source-title span{font-size:10px;border:1px solid #a98a52;padding:2px 6px;border-radius:8px;white-space:nowrap;}.source-body{display:flex;flex-direction:column;gap:8px;flex:1;min-height:0;padding:11px 12px;}.source-body p{margin:0;font-size:13px;line-height:1.45;min-height:40px;}.source-body strong{font-size:13px;color:#468358;font-weight:400;}.source-body small{font-size:12px;}.source-body label{display:flex;align-items:center;gap:7px;font-size:13px;}.source-body input{accent-color:#987237;width:16px;height:16px;}.source-costs{display:grid;gap:3px;color:#8a6a45;font-size:12px;}.source-costs .is-missing{color:#b74d37;font-weight:700;}.site-card__reward{min-height:0;font-size:12px;color:#8a7450;}.source-body button{margin-top:auto;height:37px;flex:none;font-size:16px;padding:0;}.source-body :deep(.equipment-energy-tube){flex:none;min-height:10px;}
</style>
