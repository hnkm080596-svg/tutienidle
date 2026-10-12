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
import { PILL_FAMILIES } from '@/data/pill/PillFamilies'
import { betaRecipeFamilyOfId } from '@/core/betaScope'
import { formatStat } from '@/core/stats/StatLabels'
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
    landscape: '/assets/ui/tien-hiep-2026-10/source/world-vista-warm-v1.png',
  },
  mine: {
    icon: '/assets/materials/linh_khoang.png',
    landscape: '/assets/ui/tien-hiep-2026-10/realm/landscape-3-v1.png',
  },
  grotto: {
    icon: '/assets/materials/herbs/tu_linh_thao/decade.png',
    landscape: '/assets/ui/tien-hiep-2026-10/source/opening-vista-warm-v1.png',
  },
}

const art = computed(() => KIND_ART[props.row.kind] ?? KIND_ART.forest!)

const iconUrl = computed(() => resolveAssetUrl(art.value.icon))

const landscapeUrl = computed(() => resolveAssetUrl(art.value.landscape))

const statLines = computed(() => {
  const speed = `×${formatStat('productionSpeedMultiplier', props.row.productionSpeedMultiplier)} ${t('panels.production.speedSuffix')}`

  const next = props.row.nextProductionSpeedMultiplier
    ? ` · ${t('panels.production.nextSpeedPrefix')}${formatStat('productionSpeedMultiplier', props.row.nextProductionSpeedMultiplier)}`
    : ''

  const lines = [
    `${t('panels.production.level', { level: props.row.level, max: props.row.maxLevel })} · ${speed}${next}`,
  ]

  return lines
})

// CONSUMER-01: the grotto advertises only beta-admitted families - the
// grotto can never produce a scope-hidden recipe, so
// PILL_FAMILIES.length would overstate the card against the alchemy
// authority seam. (Moved verbatim from the panel.)
const rewardLine = computed(() => {
  if (props.row.kind === 'forest') {
    return t('panels.production.rewards.forest')
  }

  if (props.row.kind === 'mine') {
    return t('panels.production.rewards.mine')
  }

  return t('panels.production.rewards.grotto', {
    count: PILL_FAMILIES.filter((family) => betaRecipeFamilyOfId(family.id) !== null).length,
  })
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
    :name="row.name"
    :type-label="row.kindLabel"
    :description="row.description"
    :stat-lines="statLines"
    :reward-line="rewardLine"
    :fill="fill"
    :status-label="statusLabel"
    :auto-label="t('panels.production.autoRepeat')"
    :auto-checked="row.autoRestart"
    upgrade-label=""
    :show-upgrade="false"
    @toggle="toggleAuto"
  />
</template>
