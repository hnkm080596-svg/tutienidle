<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import PcPaperScene from '@/components/common/PcPaperScene.vue'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import PcPaperButton from '@/components/common/PcPaperButton.vue'
import PcPaperDialog from '@/components/common/PcPaperDialog.vue'
import { pcPaperResourceUrl, type PcPaperResource } from '@/presentation/assets/PcPaperControls'
import { useDialogFocus } from '@/composables/useDialogFocus'
import type { ArchitectureBuildingModel, ArchitectureCost } from '@/core/game/ArchitectureReadModel'
import ArchitectureBuildingCard from './ArchitectureBuildingCard.vue'

type ProductionModel = ReturnType<typeof import('@/core/game/ArchitectureReadModel').getArchitectureProductionModels>[number]
type ResourceModel = ReturnType<typeof import('@/core/game/ArchitectureReadModel').getArchitectureResourceModels>[number]

const props = defineProps<{
  buildings: readonly ArchitectureBuildingModel[]
  productionSites: readonly ProductionModel[]
  resources: readonly ResourceModel[]
  selectedBuildingId: string | null
  notice: string
}>()
const emit = defineEmits<{
  back: []
  details: [buildingId: string]
  closeDetails: []
  upgradeBuilding: [buildingId: string]
  upgradeSite: [siteId: string]
}>()
const { t } = useI18n()
const selectedBuilding = computed(() => props.buildings.find(building => building.id === props.selectedBuildingId) ?? null)
const detailRef = ref<HTMLElement | null>(null)
useDialogFocus(detailRef, () => selectedBuilding.value !== null, { onEscape: () => emit('closeDetails') })
const artPath = (id: string) => `/assets/buildings/dong-fu/v2/${id}/base.png`
const formatNumber = (value: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value)
function reasonText(reason: string): string {
  return t(`architecture.productionReasons.${reason}`)
}
function costText(cost: ArchitectureCost): string {
  return t('architecture.costAmount', { owned: cost.owned, required: cost.required })
}
const RESOURCE_FALLBACK: Record<ResourceModel['category'], PcPaperResource> = {
  spirit_stone: 'crystal',
  wood: 'essence',
  ore: 'crystal',
  herb: 'essence',
}
function resourceIcon(resource: ResourceModel): string {
  return resource.icon ?? pcPaperResourceUrl(RESOURCE_FALLBACK[resource.category])
}
</script>

<template>
  <SceneDesignCanvas overlay :width="1440" :height="900">
   <PcPaperScene class="architecture-scene" :title="t('architecture.title')">
    <template #actions>
      <PcPaperButton variant="secondary" data-testid="architecture-back" @click="emit('back')">{{ t('architecture.back') }}</PcPaperButton>
    </template>
    <template #tabs>
      <div class="architecture-resources" :aria-label="t('architecture.resources')">
        <strong class="architecture-resources__count">{{ t('architecture.buildingCount', { built: buildings.filter(building => building.instanceId).length, total: buildings.length }) }}</strong>
        <div v-for="resource in resources" :key="resource.category" class="architecture-resource" :data-testid="`architecture-resource-${resource.category}`">
          <img :src="resourceIcon(resource)" alt="" @error="($event.target as HTMLImageElement).hidden = true">
          <span>{{ t(`architecture.resourceCategories.${resource.category}`) }}</span>
          <strong>{{ formatNumber(resource.amount) }}</strong>
        </div>
      </div>
    </template>

    <div class="architecture-workspace">
      <div class="architecture-grid">
        <ArchitectureBuildingCard
          v-for="building in buildings"
          :key="building.id"
          :model="building"
          :art-url="artPath(building.id)"
          @details="emit('details', building.id)"
          @upgrade="emit('upgradeBuilding', building.id)"
        />
      </div>
      <p v-if="notice" class="architecture-notice" role="status" aria-live="polite">{{ notice }}</p>
    </div>

    <div v-if="selectedBuilding" ref="detailRef" class="architecture-detail-scrim" data-testid="architecture-detail-scrim" tabindex="-1" @click.self="emit('closeDetails')">
      <PcPaperDialog :title="selectedBuilding.name" :width="selectedBuilding.id === 'gathering_outpost' ? 990 : 760">
        <template #body>
          <div class="architecture-detail">
            <p class="architecture-detail__description">{{ selectedBuilding.description }}</p>
            <section class="architecture-detail__effects">
              <h2>{{ t('architecture.current') }} · {{ t('architecture.level', { level: selectedBuilding.level, max: selectedBuilding.maxLevel }) }}</h2>
              <ul><li v-for="effect in selectedBuilding.currentEffects" :key="effect.key">{{ t(`architecture.effects.${effect.key}`) }} <strong>{{ formatNumber(effect.value) }} {{ t(`architecture.units.${effect.unit}`) }}</strong></li></ul>
              <p v-if="selectedBuilding.artOnly">{{ t('architecture.artOnly') }}</p>
              <p v-else-if="selectedBuilding.maxed">{{ t('architecture.maximum') }}</p>
              <p v-else>{{ t('architecture.next') }} · {{ t('architecture.level', { level: selectedBuilding.level + 1, max: selectedBuilding.maxLevel }) }}</p>
              <ul v-if="selectedBuilding.nextEffects.length"><li v-for="effect in selectedBuilding.nextEffects" :key="effect.key">{{ t(`architecture.effects.${effect.key}`) }} <strong>{{ formatNumber(effect.value) }} {{ t(`architecture.units.${effect.unit}`) }}</strong></li></ul>
            </section>
            <section v-if="selectedBuilding.id === 'gathering_outpost'" class="architecture-sites">
              <h2>{{ t('architecture.productionTitle') }}</h2>
              <article v-for="site in productionSites" :key="site.id" class="architecture-site" :data-site-id="site.id">
                <div class="architecture-site__heading"><div><h3>{{ site.name }}</h3><p>{{ site.description }}</p></div><span>{{ t('architecture.level', { level: site.level, max: site.maxLevel }) }}</span></div>
                <p class="architecture-site__speed">{{ t('architecture.siteSpeed', { current: formatNumber(site.currentSpeed), next: site.nextSpeed === null ? t('architecture.maximum') : formatNumber(site.nextSpeed) }) }}</p>
                <ul v-if="site.costs.length" class="architecture-site__costs"><li v-for="cost in site.costs" :key="cost.id">{{ cost.name || t('architecture.unknownMaterial') }} <strong>{{ costText(cost) }}</strong></li></ul>
                <ul v-if="site.reasons.length" class="architecture-site__reasons"><li v-for="reason in site.reasons" :key="reason">{{ reasonText(reason) }}</li></ul>
                <PcPaperButton v-if="site.level < site.maxLevel" data-testid="architecture-site-upgrade" @click="emit('upgradeSite', site.id)">{{ t('architecture.upgradeSite') }}</PcPaperButton>
                <span v-else class="architecture-card__maximum">{{ t('architecture.maximum') }}</span>
              </article>
            </section>
          </div>
        </template>
        <template #footer><PcPaperButton variant="secondary" data-testid="architecture-close-details" @click="emit('closeDetails')">{{ t('architecture.close') }}</PcPaperButton></template>
      </PcPaperDialog>
    </div>
   </PcPaperScene>
  </SceneDesignCanvas>
</template>

<style scoped>
.architecture-scene :deep(.pc-paper-button--secondary) { color:#f4e4c0; text-shadow:0 1px #17140e; }
.architecture-scene :deep(.pc-paper-button--secondary::before) { border-image-slice:35 fill; border-width:8px; }
.architecture-resources { display:grid; grid-template-columns:1.25fr repeat(4,minmax(112px,1fr)); align-items:center; height:100%; padding:4px 11px; border:1px solid #a9813e88; background:linear-gradient(90deg,#fff7e4dd,#ead5abcc); box-shadow:inset 0 0 0 3px #fff9; }
.architecture-scene { pointer-events:auto; }
.architecture-scene :deep(.pc-paper-scene__actions .pc-paper-button--secondary) { color:#f4e4c0; text-shadow:0 1px #17140e; }
.architecture-resources__count { padding:0 12px; color:#4b381c; font-size:16px; }
.architecture-resource { display:grid; grid-template-columns:30px minmax(0,1fr); align-items:center; gap:0 7px; min-width:0; padding:0 12px; border-left:1px solid #a9813e66; font-size:12px; color:#735b31; }
.architecture-resource img { grid-row:span 2; width:30px; height:30px; object-fit:contain; }
.architecture-resource span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.architecture-resource strong { color:#342816; font-size:15px; }
.architecture-workspace { position:absolute; inset:0; }
.architecture-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); grid-template-rows:repeat(2,minmax(0,1fr)); gap:13px; width:100%; height:100%; }
.architecture-notice { position:absolute; right:8px; bottom:-58px; z-index:7; max-width:70%; margin:0; padding:9px 15px; border:1px solid #a9813e; background:#fff2d9; color:#793722; box-shadow:0 2px 8px #24190e33; }
.architecture-detail-scrim { position:absolute; inset:0; z-index:9; background:#17140ec2; pointer-events:auto; }
.architecture-detail { color:#403019; }
.architecture-detail__description { margin:0 0 16px; color:#705a32; line-height:1.5; }
.architecture-detail__effects { padding:10px 14px; border:1px solid #a9813e66; background:#f6e9ccaa; }
.architecture-detail__effects h2,.architecture-sites h2 { margin:0 0 9px; font:700 20px var(--pc-font-title); }
.architecture-detail__effects ul,.architecture-site__costs,.architecture-site__reasons { margin:0; padding-left:20px; }
.architecture-detail__effects li { display:flex; justify-content:space-between; gap:18px; padding:4px 0; }
.architecture-sites { margin-top:18px; }
.architecture-site { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:7px 20px; align-items:center; padding:12px 0; border-top:1px solid #a9813e66; }
.architecture-site__heading { display:flex; justify-content:space-between; gap:12px; grid-column:1/-1; }
.architecture-site__heading h3 { margin:0; font:700 17px var(--pc-font-title); }
.architecture-site__heading p { margin:3px 0 0; font-size:12px; color:#715d3b; }
.architecture-site__heading span,.architecture-site__speed { color:#70542a; font-weight:700; }
.architecture-site__speed { margin:0; font-size:13px; }
.architecture-site__costs,.architecture-site__reasons { grid-column:1/-1; display:flex; flex-wrap:wrap; gap:7px 20px; font-size:12px; }
.architecture-site__costs strong { color:#49371c; }
.architecture-site__reasons { color:#93412e; }
.architecture-site :deep(.pc-paper-button) { justify-self:end; grid-column:2; font-size:16px; }
@media (max-width:900px) { .architecture-resources { grid-template-columns:repeat(4,minmax(0,1fr)); } .architecture-resources__count { grid-column:1/-1; padding:2px 3px; } .architecture-resource { padding:3px 4px; } .architecture-resource img { width:24px;height:24px; } .architecture-grid { gap:7px; } }
</style>
