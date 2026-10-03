import { computed, type Ref } from 'vue'
import { useGameManager, useStateVersion } from './useGameState'

// Doi tu BuildingPanelHeader.vue (2026-08-30, bug report: building header
// cu chiem han 1 dai rieng phia duoi title bar OverlayPanel, tao cam giac
// 2 tang thong tin). Gio FunctionOverlayPanel.vue bom thang anh+ten+cap
// vao slot #heading cua CHINH title bar OverlayPanel, nut Nang cap vao
// #header-actions -- chi con MOT dai header duy nhat cho moi building panel.
export function useBuildingHeaderState(buildingId: Ref<string | undefined>) {
  const gameManager = useGameManager()
  const { stateVersion } = useStateVersion()

  const template = computed(() => {
    stateVersion.value

    if (!buildingId.value) return undefined

    return gameManager.buildingOps.getBuildingDefinitions().find((entry) => entry.id === buildingId.value)
  })

  const instance = computed(() => {
    stateVersion.value

    if (!buildingId.value) return undefined

    const current = gameManager.buildingManager.getByBuildingId(buildingId.value)

    return current ? { ...current } : undefined
  })

  // v2 art bundle -- same convention as dongFuBuildingAssetUrls()
  // (presentation/background/DongFuBuildingArt.ts): the flat
  // dong-fu/<id>.png never shipped for vendor/chi_hien_quan, so the old
  // flat path 404'd into a broken-image icon (audit H4). Every building
  // mapped in FunctionOverlayPanel has a v2/<id>/base.png.
  const artPath = computed(() => `/assets/buildings/dong-fu/v2/${buildingId.value}/base.png`)

  // Upgrade rules live in BuildingSystem.quoteUpgrade (via buildingOps) -
  // the header consumes the quote and keeps label formatting only.
  const quote = computed(() => {
    stateVersion.value

    if (!instance.value) return null

    return gameManager.buildingOps.quoteBuildingUpgrade(instance.value.instanceId)
  })

  const nextUpgradeCost = computed(() => quote.value?.nextUpgradeCost ?? [])

  const upgradeCostLabel = computed(() =>
    nextUpgradeCost.value
      .map((cost) => {
        const name = gameManager.materialRegistry.has(cost.materialId)
          ? gameManager.materialRegistry.get(cost.materialId).name
          : cost.materialId

        return `${name} ${gameManager.materialBag.getAmount(cost.materialId)}/${cost.amount}`
      })
      .join(' · '),
  )

  // Nut Nang cap dung chung viet qua useBuildingNavigation().upgradeBuilding
  // (1 write path) - header nay chi giu READ model (quote + nhan cost).
  return {
    template,
    instance,
    artPath,
    nextUpgradeCost,
    upgradeCostLabel,
  }
}
