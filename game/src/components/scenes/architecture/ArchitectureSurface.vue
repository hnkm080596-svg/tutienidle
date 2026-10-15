<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import ArchitectureFidelityScene from './ArchitectureFidelityScene.vue'
import { getArchitectureBuildingModels, getArchitectureProductionModels } from '@/core/game/ArchitectureReadModel'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'

const gameManager = useGameManager()
const player = usePlayerStore()
const ui = useUiStore()
const { stateVersion, bumpState } = useStateVersion()
const { t } = useI18n()
const notice = shallowRef('')

const buildings = computed(() => {
  stateVersion.value
  return getArchitectureBuildingModels(gameManager, player.$state)
})
const productionSites = computed(() => {
  stateVersion.value
  return getArchitectureProductionModels(gameManager, player.$state)
})

function buildingFailureMessage(instanceId: string): string {
  const quote = gameManager.buildingOps.quoteBuildingUpgrade(instanceId)
  if (!quote?.hasNextLevel) return t('architecture.reasons.maxLevel')
  if (!quote.meetsRealmRequirement) return t('architecture.reasons.realmGate')
  if (!quote.canAfford) return t('architecture.reasons.missingMaterials')
  return t('architecture.reasons.changed')
}

function upgradeBuilding(buildingId: string) {
  notice.value = ''
  const building = buildings.value.find(model => model.id === buildingId)
  if (!building?.instanceId || building.maxed || building.artOnly) {
    notice.value = t(building?.artOnly ? 'architecture.reasons.artOnly' : 'architecture.reasons.missingBuilding')
    return
  }
  const quote = gameManager.buildingOps.quoteBuildingUpgrade(building.instanceId)
  if (!quote?.hasNextLevel || !quote.meetsRealmRequirement || !quote.canAfford) {
    notice.value = buildingFailureMessage(building.instanceId)
    return
  }
  if (!gameManager.buildingOps.upgradeBuilding(building.instanceId)) {
    notice.value = buildingFailureMessage(building.instanceId)
    return
  }
  bumpState()
  notice.value = t('architecture.reasons.buildingSuccess')
}

function siteFailureMessage(siteId: string): string {
  const quote = gameManager.buildingOps.quoteProductionUpgrade(siteId, player.$state)
  const reason = quote.reasons[0]
  return t(reason ? `architecture.productionReasons.${reason}` : 'architecture.reasons.changed')
}

function upgradeSite(siteId: string) {
  notice.value = ''
  const quote = gameManager.buildingOps.quoteProductionUpgrade(siteId, player.$state)
  if (!quote.upgradable) {
    notice.value = siteFailureMessage(siteId)
    return
  }
  if (!gameManager.buildingOps.upgradeProductionSite(siteId, player.$state)) {
    notice.value = siteFailureMessage(siteId)
    return
  }
  bumpState()
  notice.value = t('architecture.reasons.siteSuccess')
}

function close() {
  ui.architectureFocusBuildingId = null
  ui.closeHomeOverlays()
}
</script>

<template>
  <ArchitectureFidelityScene
    :buildings="buildings"
    :production-sites="productionSites"
    :notice="notice"
    @back="close"
    @upgrade-building="upgradeBuilding"
    @upgrade-site="upgradeSite"
  />
</template>
