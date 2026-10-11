<script setup lang="ts">
// Canonical per-source card inside ProductionPanel (2026-10-11
// landscape port): renders one buildingOps.getProductionViews row
// through the shared ProductionSourceArtCard - the preview-shaped art
// card. Domain calls mirror the panel's old handlers verbatim:
// toggle -> setProductionAutoRestart, upgrade -> upgradeProductionSite
// gated by the same quoteProductionUpgrade read, then bumpState.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import ProductionSourceArtCard from '@/components/common/art/ProductionSourceArtCard.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { SPIRIT_STONE_LABEL } from '@/core/presentation/labels'
import { PILL_FAMILIES } from '@/data/pill/PillFamilies'
import { betaRecipeFamilyOfId, betaSurfaceVisible } from '@/core/betaScope'
import { formatStat } from '@/core/stats/StatLabels'
import type { ProductionSiteRow } from './productionViewTypes'

const props = defineProps<{ row: ProductionSiteRow }>()

const { t } = useI18n()

const player = usePlayerStore()

const gameManager = useGameManager()

const { stateVersion, bumpState } = useStateVersion()

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

// FINAL POLICY (sec.4C): the manual workforce surface is entirely
// scope-hidden under beta - the workers stat reads the ONE flag.
const workerSurfaceVisible = betaSurfaceVisible('manualWorkforce')

const statLines = computed(() => {
  const speed = `×${formatStat('productionSpeedMultiplier', props.row.productionSpeedMultiplier)} ${t('panels.production.speedSuffix')}`

  const next = props.row.nextProductionSpeedMultiplier
    ? ` · ${t('panels.production.nextSpeedPrefix')}${formatStat('productionSpeedMultiplier', props.row.nextProductionSpeedMultiplier)}`
    : ''

  const lines = [
    `${t('panels.production.level', { level: props.row.level, max: props.row.maxLevel })} · ${speed}${next}`,
  ]

  if (workerSurfaceVisible) {
    lines.push(t('panels.production.workers', { count: props.row.activeWorkerSlots }))
  }

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

// R9 (AR-23): the domain quote owns costs + gate; the card only renders
// it (same read the panel ran before the port).
const upgradeQuote = computed(() => {
  stateVersion.value

  return gameManager.buildingOps.quoteProductionUpgrade(props.row.siteId, player.$state)
})

const costLines = computed(() => {
  const cost = upgradeQuote.value.cost

  if (!cost) {
    return []
  }

  const woodLabel = gameManager.materialRegistry.has(cost.woodMaterialId)
    ? gameManager.materialRegistry.get(cost.woodMaterialId).name
    : cost.woodMaterialId

  const spiritStoneId = cost.spiritStoneId

  const stoneLabel = gameManager.materialRegistry.has(spiritStoneId)
    ? gameManager.materialRegistry.get(spiritStoneId).name
    : SPIRIT_STONE_LABEL

  return [
    { label: woodLabel, owned: gameManager.materialBag.getAmount(cost.woodMaterialId), amount: cost.woodAmount },
    { label: stoneLabel, owned: gameManager.materialBag.getAmount(spiritStoneId), amount: cost.spiritStone },
  ].map((entry) => ({
    text: `${entry.label}: ${entry.owned}/${entry.amount}`,
    missing: entry.owned < entry.amount,
  }))
})

const upgradable = computed(() => upgradeQuote.value.upgradable)

const showUpgrade = computed(() => props.row.level < props.row.maxLevel)

function toggleAuto() {
  gameManager.buildingOps.setProductionAutoRestart(props.row.siteId, !props.row.autoRestart)

  bumpState()
}

function upgrade() {
  if (gameManager.buildingOps.upgradeProductionSite(props.row.siteId, player.$state)) {
    bumpState()
  }
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
    :cost-lines="costLines"
    :upgrade-label="t('panels.production.upgrade')"
    :upgrade-disabled="!upgradable"
    :show-upgrade="showUpgrade"
    @toggle="toggleAuto"
    @upgrade="upgrade"
  />
</template>
