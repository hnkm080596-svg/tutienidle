<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import ProductionSourceArtCard from '@/components/common/art/ProductionSourceArtCard.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { formatDuration } from '@/core/format/formatDuration'
const props = defineProps<{ nowMs: number }>()
const { t } = useI18n()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const view = computed(() => {
  stateVersion.value
  const instance = gameManager.buildingManager.getByBuildingId('gathering_outpost')
  return instance ? gameManager.buildingOps.getAutomaticProductionView(instance.instanceId, props.nowMs / 1000) : undefined
})
const stats = computed(() => {
  stateVersion.value
  const instance = gameManager.buildingManager.getByBuildingId('gathering_outpost')
  return view.value && instance ? [t('panels.production.level', { level: instance.level, max: 9 }), t('panels.production.cycleDuration', { seconds: view.value.seconds })] : []
})
const reward = computed(() => view.value ? t('panels.production.stoneRate', { amount: (view.value.amount / view.value.seconds).toLocaleString('vi-VN', { maximumFractionDigits: 3 }) }) : '')
const status = computed(() => view.value ? t('panels.production.statusProducing', { time: formatDuration(Math.ceil(view.value.seconds * (1 - view.value.progress))) }) : '')
</script>
<template>
  <ProductionSourceArtCard v-if="view"
    :icon="resolveAssetUrl('/assets/materials/spirit_stone_ha_pham.png')"
    :landscape="resolveAssetUrl('/assets/ui/tien-hiep-2026-10/production/spirit-vein-v1.png')"
    :name="t('panels.production.linMach.title')"
    :type-label="t('panels.production.resources.vein')"
    :description="t('panels.production.descriptions.vein')" :stat-lines="stats" :reward-line="reward" :fill="view.progress * 100" :status-label="status"
    auto-label="" :auto-checked="true" :show-auto="false" upgrade-label="" :show-upgrade="false"
  />
</template>
