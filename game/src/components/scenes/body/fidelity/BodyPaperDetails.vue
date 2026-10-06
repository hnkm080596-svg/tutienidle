<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import EquipmentArtCard from '@/ui-preview/equipment/EquipmentArtCard.vue'
import EquipmentArtButton from '@/ui-preview/equipment/EquipmentArtButton.vue'
import EquipmentEnergyTube from '@/ui-preview/equipment/EquipmentEnergyTube.vue'
import type { BodyPaperModel, BodyPaperUnit } from './bodyUi'

const props = defineProps<{ model: BodyPaperModel; unit: BodyPaperUnit | null; notice: string }>()
const emit = defineEmits<{ invest: [] }>()
const { t } = useI18n()

// Same ren/khai/dan art mapping the scene nav uses.
const NAV_ART: Record<string, string> = { refinement: 'ren', meridian: 'khai', cycle: 'dan' }
const navIcon = resolveAssetUrl(
  `/assets/ui/tien-hiep-2026-10/body/navigation-${NAV_ART[props.model.chapter] ?? 'ren'}-lit-v1.png`,
)
</script>
<template>
  <EquipmentArtCard class="body-card body-paper-details">
    <div class="body-card-title">
      <img :src="navIcon" alt="">
      <h2>{{ unit?.title ?? model.chapterLabel }}</h2>
    </div>
    <template v-if="unit">
      <p class="body-description">{{ unit.description }}</p>
      <h3>{{ t('body.progress') }}</h3>
      <div class="body-progress-value">
        <span>{{ unit.progressLabel ?? model.progressLabel }}</span>
        <span>{{ t(`body.state.${unit.state}`) }}</span>
      </div>
      <EquipmentEnergyTube :fill="unit.progressPct ?? model.progress" color="#eec76c" />
      <div class="body-scroll">
        <h3>{{ t('body.gains') }}</h3>
        <dl class="body-stat-list">
          <div v-for="row in unit.rows" :key="row.label"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div>
          <p v-if="!unit.rows.length" class="body-empty-row">{{ t('body.noGains') }}</p>
        </dl>
        <h3>{{ t('body.material') }}</h3>
        <div class="body-materials">
          <div v-for="cost in unit.costs" :key="cost.id" :class="{ unmet: !cost.met }">
            <img v-if="cost.icon" :src="cost.icon" alt="">
            <span>{{ cost.name }}</span>
            <strong>{{ cost.amountLabel }}</strong>
          </div>
          <p v-if="!unit.costs.length" class="body-empty-row">{{ t('body.noCost') }}</p>
        </div>
        <p v-for="(gate, i) in unit.gates" :key="i" class="body-gate">{{ gate }}</p>
        <div v-if="model.extra" class="body-extra" :class="{ done: model.extra.done }">
          <div class="body-extra__head"><span>{{ model.extra.title }}</span><em>{{ model.extra.stateLabel }}</em></div>
          <p>{{ model.extra.description }}</p>
          <div v-if="model.extra.progressMax" class="body-extra__bar">
            <span :style="{ width: `${Math.min(100, (model.extra.progress ?? 0) / model.extra.progressMax * 100)}%` }" />
          </div>
          <p v-if="model.extra.progressLabel" class="body-extra__count">{{ model.extra.progressLabel }}</p>
        </div>
      </div>
      <EquipmentArtButton v-if="unit.actionLabel" gold class="body-invest" :disabled="unit.actionDisabled" @click="emit('invest')">{{ unit.actionLabel }}</EquipmentArtButton>
    </template>
    <template v-else>
      <p class="body-empty-row">{{ model.lockHint ?? t('body.empty') }}</p>
    </template>
    <p class="body-notice" role="status" aria-live="polite">{{ notice }}</p>
  </EquipmentArtCard>
</template>
<style scoped>
.body-card { height:100%; min-height:0; display:flex; flex-direction:column; padding:14px; }
.body-card-title { display:flex; align-items:center; gap:8px; flex:none; }
.body-card-title img { width:48px; height:48px; object-fit:contain; }
.body-card-title h2 { margin:0; font-size:23px; color:#f3e4c4; }
.body-description { font-size:12px; line-height:1.4; min-height:32px; margin:3px 0 4px; padding-bottom:5px; border-bottom:1px solid #b28a4377; color:#d8c49a; flex:none; }
.body-card h3 { font-size:14px; margin:6px 0 4px; color:#ebd49e; flex:none; }
.body-progress-value { display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px; color:#e8d8b8; flex:none; }
.body-card :deep(.equipment-energy-tube) { flex:none; }
.body-scroll { flex:1; min-height:0; overflow-y:auto; scrollbar-width:thin; scrollbar-color:#8a7444 transparent; }
.body-stat-list { margin:0; }
.body-stat-list > div { display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #b28a4333; font-size:13px; align-items:center; }
.body-stat-list dd { margin:0; color:#a3d793; }
.body-materials { display:flex; flex-wrap:wrap; gap:6px; }
.body-materials > div { display:flex; flex-direction:column; align-items:center; gap:3px; font-size:11px; color:#a3d793; flex:1; min-width:0; }
.body-materials img { width:32px; height:32px; object-fit:contain; }
.body-materials strong { font-weight:400; }
.body-materials .unmet, .body-materials .unmet strong { color:#d98a6f; }
.body-gate { margin:5px 0; font-size:12px; color:#d98a6f; }
.body-empty-row { font-size:13px; color:#9a8562; font-style:italic; }
.body-extra { margin-top:10px; padding:8px 10px; border:1px solid #3f7a5c88; border-radius:6px; background:#0f201855; }
.body-extra__head { display:flex; justify-content:space-between; align-items:baseline; font-size:14px; color:#9fd4a8; }
.body-extra__head em { font-style:normal; font-size:10px; text-transform:uppercase; letter-spacing:.4px; }
.body-extra p { margin:5px 0 0; font-size:12px; color:#b6a87e; }
.body-extra__bar { margin-top:7px; height:8px; border:1px solid #8a7444; border-radius:5px; background:#151715; overflow:hidden; }
.body-extra__bar span { display:block; height:100%; background:linear-gradient(90deg,#466c4b,#c6a047); }
.body-extra__count { font-size:11px; color:#b6a87e; }
.body-extra.done { border-color:#7fae62; }
.body-invest { width:100%; height:44px; flex:none; font-size:20px; padding:0; margin-top:8px; }
.body-notice { position:absolute; left:14px; right:14px; bottom:6px; margin:0; font-size:11px; color:#c9a95f; min-height:14px; text-align:center; }
</style>
