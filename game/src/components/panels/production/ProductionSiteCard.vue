<script setup lang="ts">
// Canonical per-source card inside ProductionPanel (2026-10-11
// landscape port): renders one buildingOps.getProductionViews row
// through the shared ProductionSourceArtCard - the preview-shaped art
// card. Domain calls mirror the panel's old handlers verbatim:
// toggle -> setProductionAutoRestart, upgrade -> upgradeProductionSite
// gated by the same quoteProductionUpgrade read, then bumpState.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import ProductionSourceArtCard from '@/components/common/art/ProductionSourceArtCard.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { formatNumber } from '@/core/format/NumberFormatter'
import type { ProductionSiteRow } from './productionViewTypes'

const props = defineProps<{ row: ProductionSiteRow }>()

const { t } = useI18n()

const gameManager = useGameManager()

const { bumpState } = useStateVersion()

// Kind -> preview art pair (same picks the preview indexed by slot:
// forest/mine/grotto in catalog order). Unknown kinds keep the forest
// pair so a future site never renders a broken medallion.
const KIND_ART: Record<string, { icon: string; landscape: string }> = {
  forest: {
    icon: '/assets/materials/linh_moc.png',
    landscape: '/assets/ui/tien-hiep-2026-10/production/blessed-forest-v1.png',
  },
  mine: {
    icon: '/assets/materials/linh_khoang.png',
    landscape: '/assets/ui/tien-hiep-2026-10/production/spirit-mine-v1.png',
  },
  grotto: {
    icon: '/assets/materials/herbs/tu_linh_thao/decade.png',
    landscape: '/assets/ui/tien-hiep-2026-10/production/herb-grotto-v1.png',
  },
}

const art = computed(() => KIND_ART[props.row.kind] ?? KIND_ART.forest!)

const iconUrl = computed(() => resolveAssetUrl(art.value.icon))

const landscapeUrl = computed(() => resolveAssetUrl(art.value.landscape))

const statLines = computed(() => {
  const lines = [
    t('panels.production.level', { level: props.row.level, max: props.row.maxLevel }),
    t('panels.production.cycleDuration', { seconds: formatNumber(props.row.cycleSeconds) }),
  ]

  return lines
})

const rewardLine = computed(() => {
  const range = props.row.baseOutputPerSecond
  if (!range) return ''
  const formatRate = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 3 })
  const amount = range.min === range.max ? formatRate(range.min) : `${formatRate(range.min)}–${formatRate(range.max)}`
  return t('panels.production.resourceRate', { amount, resource: t(`panels.production.resources.${props.row.kind}`) })
})
const statusLabel = computed(() =>
  props.row.isProducing
    ? t('panels.production.statusProducing', { time: props.row.remainingLabel })
    : '',
)

const fill = computed(() => (props.row.isProducing ? props.row.progress * 100 : 0))

function toggleAuto() {
  gameManager.buildingOps.setProductionAutoRestart(props.row.siteId, !props.row.autoRestart)

  bumpState()
}

</script>

<template>
  <ProductionSourceArtCard
    class="site-card"
    :data-kind="row.kind"
    :icon="iconUrl"
    :landscape="landscapeUrl"
    :name="t(`panels.production.sourceNames.${row.kind}`)"
    :type-label="t(`panels.production.resources.${row.kind}`)"
    :description="t(`panels.production.descriptions.${row.kind}`)"
    :stat-lines="statLines"
    :reward-line="rewardLine"
    :fill="fill"
    :status-label="statusLabel"
    :auto-label="t('panels.production.autoRepeat')"
    :auto-checked="row.autoRestart"
    upgrade-label=""
    :show-upgrade="false"
    :show-auto="false"
    @toggle="toggleAuto"
  />
</template>
