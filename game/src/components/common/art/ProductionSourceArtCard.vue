<script setup lang="ts">
import GameCard from "@/components/common/GameCard.vue"
import SlotView from '@/components/common/SlotView.vue'
// Production source card - the LANDSCAPE preview shape shared by the
// design preview and the canonical San Xuat panel (2026-10-11 port;
// was index-based preview i18n). Presentation only: every label and
// state flag arrives through props so each caller keeps its own domain
// reads - nothing here touches the game state.
import EquipmentArtButton from './EquipmentArtButton.vue'
import EquipmentEnergyTube from './EquipmentEnergyTube.vue'
withDefaults(defineProps<{
  icon: string
  resourceVariant?: 'bag' | 'preview'
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
  showAuto?: boolean
  showUpgrade?: boolean
}>(), {
  statLines: () => [],
  resourceVariant: 'bag',
  rewardLine: '',
  fill: 0,
  statusLabel: '',
  costLines: () => [],
  upgradeDisabled: false,
  showUpgrade: true,
  showAuto: true,
})
defineEmits<{toggle:[];upgrade:[]}>()
</script>
<template>
  <GameCard as="article" class="production-source-card" :title="name">
    <template #viewport><div class="source-landscape" :style="{ backgroundImage:`url('${landscape}')` }" /></template>
    <div class="source-content">
      <div class="source-emblem"><SlotView class="source-resource-slot" static static-tooltip :variant="resourceVariant" :item="null" :icon="icon" :label="typeLabel" :accessible-label="typeLabel" :tooltip="{title:typeLabel,description}" /><span>{{ typeLabel }}</span></div>
      <p class="source-description">{{ description }}</p>
      <div class="source-stats"><strong v-for="(line,i) in statLines" :key="i">{{ line }}</strong></div>
      <p class="source-reward">{{ rewardLine }}</p>
      <div class="source-progress"><EquipmentEnergyTube :fill="fill" color="#6bbd92"/><small>{{ statusLabel }}</small></div>
      <label v-if="showAuto"><input type="checkbox" :checked="autoChecked" @change="$emit('toggle')">{{autoLabel}}</label>
      <div v-if="showUpgrade" class="source-costs"><span v-for="(cost,i) in costLines" :key="i" :class="{'is-missing':cost.missing}">{{cost.text}}</span></div>
      <EquipmentArtButton v-if="showUpgrade" gold :disabled="upgradeDisabled" @click="$emit('upgrade')">{{upgradeLabel}}</EquipmentArtButton>
    </div>
  </GameCard>
</template>
<style scoped>
.production-source-card { min-width:0; min-height:0; display:flex; flex-direction:column; margin-top:12px; height:calc(100% - 12px); }
.source-landscape { position:absolute; inset:0; background:center / cover no-repeat; opacity:.8; pointer-events:none; }
.source-landscape::after { content:''; position:absolute; inset:0; background:linear-gradient(transparent 15%,rgba(7,12,10,.55) 45%,rgba(7,12,10,.9) 75%); }
.source-content { position:relative; z-index:1; display:flex; flex-direction:column; flex:1; min-height:0; gap:12px; text-shadow:0 1px 3px #000; }
.source-emblem { height:170px; flex:none; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; gap:8px; }
.source-resource-slot { width:56px; height:56px; flex:0 0 56px; }
.source-emblem span { font-size:14px; color:#efdbac; }
.source-description { margin:0; height:60px; flex:none; font-size:13px; line-height:1.5; color:#e0d2b8; }
.source-stats { min-height:44px; flex:none; display:grid; align-content:start; gap:6px; }
.source-stats strong { font-size:13px; font-weight:400; color:#c4dfb7; }
.source-reward { margin:0; height:36px; flex:none; font-size:12px; line-height:1.5; color:#dac9a3; }
.source-progress { margin-top:auto; flex:none; display:grid; gap:8px; }
.source-progress small { min-height:32px; font-size:12px; color:#e4d8bd; }
.source-costs { display:grid; gap:3px; font-size:12px; }
.source-costs .is-missing { color:#d98a6f; }
</style>
