<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import EquipmentArtCard from '@/components/common/art/EquipmentArtCard.vue'
import EquipmentArtButton from '@/components/common/art/EquipmentArtButton.vue'
import EquipmentEnergyTube from '@/components/common/art/EquipmentEnergyTube.vue'
import SlotView from '@/components/common/SlotView.vue'
import { useGameManager } from '@/composables/useGameState'
import { createMaterialTooltipBuilder } from '@/composables/useMaterialTooltip'
import type { BodyPaperModel, BodyPaperUnit } from './bodyUi'

const props = defineProps<{ model: BodyPaperModel; unit: BodyPaperUnit | null; notice: string }>()
const emit = defineEmits<{ invest: [] }>()
const { t } = useI18n()
const gameManager = useGameManager()

// Material rows follow the Trang Bi standard (owner ruling 2026-10-09):
// icon + owned/need only, the name/info lives in the hover tooltip.
// Same .has() guard as the hall tabs - a missing material must degrade
// to no tooltip, not crash the card.
const MATERIAL_CATEGORY_ART: Record<string, string> = {
  essence: '/assets/ui/tien-hiep-2026-10/controls/resource-essence-v1.png',
  spirit_stone: '/assets/ui/tien-hiep-2026-10/controls/resource-crystal-v1.png',
}

function materialIcon(materialId: string): string | undefined {
  const material = gameManager.materialRegistry.has(materialId)
    ? gameManager.materialRegistry.get(materialId)
    : undefined
  const art = material?.icon ?? (material?.category ? MATERIAL_CATEGORY_ART[material.category] : undefined)
  return art ? resolveAssetUrl(art) : undefined
}

const buildMaterialTooltip = createMaterialTooltipBuilder(t)

function materialTooltip(materialId: string, owned: number) {
  return gameManager.materialRegistry.has(materialId)
    ? buildMaterialTooltip(gameManager.materialRegistry.get(materialId), { owned })
    : undefined
}

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
      <div class="body-progress-value">
        <span>{{ unit.progressLabel ?? model.progressLabel }}</span>
      </div>
      <EquipmentEnergyTube :fill="unit.progressPct ?? model.progress" color="#eec76c" />
      <div class="body-scroll">
        <dl class="body-stat-list">
          <div v-for="row in model.totalRows" :key="row.label"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div>
          <p v-if="!model.totalRows.length" class="body-empty-row">{{ t('body.noGains') }}</p>
        </dl>
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
      <!-- Materials sit pinned right above the CTA (owner ruling
           2026-10-09). -->
      <h3 class="body-material-title">{{ t('body.material') }}</h3>
      <div class="body-materials">
        <div
          v-for="cost in unit.costs"
          :key="cost.id"
          v-tooltip="materialTooltip(cost.id, cost.have)"
          class="equipment-material"
          :class="{ 'is-missing': !cost.met }"
        >
          <div class="equipment-material-icon">
            <SlotView variant="equipment" static :item="null" :icon="cost.icon ?? materialIcon(cost.id)" :label="cost.name" />
          </div>
          <div>
            <b>{{ cost.amountLabel }}</b>
          </div>
        </div>
        <p v-if="!unit.costs.length" class="body-empty-row">{{ t('body.noCost') }}</p>
      </div>
      <!-- Submit states = the Trang Bi machine (owner ruling 2026-10-09):
           dark filter-art pill while locked, gold selected art once the
           unit is investable. -->
      <EquipmentArtButton v-if="unit.actionLabel" filter-art class="body-invest" :gold="!unit.actionDisabled" :disabled="unit.actionDisabled" @click="emit('invest')">{{ unit.actionLabel }}</EquipmentArtButton>
    </template>
    <template v-else>
      <p class="body-empty-row">{{ model.lockHint ?? t('body.empty') }}</p>
    </template>
    <p class="body-notice" role="status" aria-live="polite">{{ notice }}</p>
  </EquipmentArtCard>
</template>
<style scoped>
/* Grow the card into the free space around it (owner ruling
   2026-10-09): negative margins let it reach ~10px off the
   silhouette and the panel edge. */
.body-card { height:100%; min-height:0; display:flex; flex-direction:column; padding:14px 14px 28px; margin-left:-10px; margin-right:-8px; }
.body-card-title { display:flex; align-items:center; gap:8px; flex:none; }
.body-card-title img { width:48px; height:48px; object-fit:contain; }
.body-card-title h2 { margin:0; font-size:23px; color:#f3e4c4; }
.body-card h3 { font-size:14px; margin:6px 0 4px; color:#ebd49e; flex:none; }
.body-progress-value { display:flex; justify-content:flex-end; font-size:13px; margin-bottom:6px; color:#e8d8b8; flex:none; }
.body-card :deep(.equipment-energy-tube) { flex:none; }
.body-scroll { flex:1; min-height:0; overflow-y:auto; scrollbar-width:thin; scrollbar-color:#8a7444 transparent; }
.body-stat-list { margin:0; }
.body-stat-list > div { display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #b28a4333; font:700 13px/1.3 var(--pc-font-body, Georgia, serif); align-items:center; }
.body-stat-list dd { margin:0; color:#a3d793; }
.body-material-title { margin-top:4px; }
.body-materials { display:flex; flex-wrap:wrap; gap:10px; flex:none; }
.body-materials .equipment-material { display:flex; align-items:center; gap:6px; font-size:12px; color:#a3d793; }
.body-materials .equipment-material-icon { width:40px; height:40px; flex:none; align-self:center; }
.body-materials .equipment-material-icon :deep(.slot-view) { width:100%; height:100%; }
.body-materials .equipment-material b { font-weight:700; }
.body-materials .equipment-material.is-missing b { color:#d98a6f; }
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
/* Same Cường Hóa submit (owner ruling 2026-10-09): fixed-width
   filter-art pill, the 1225/324 ratio grows the frame with the
   text - smaller size + centered per his live review. */
.body-invest { width:220px; flex:none; font-size:18px; padding:0; margin:8px auto 0; }
.body-notice { position:absolute; left:14px; right:14px; bottom:6px; margin:0; font-size:11px; color:#c9a95f; min-height:14px; text-align:center; }
</style>
