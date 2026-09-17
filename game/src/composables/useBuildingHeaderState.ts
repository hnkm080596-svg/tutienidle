import { computed, type Ref } from 'vue'
import { useGameManager, useStateVersion } from './useGameState'
import { getCurrentRealm } from '@/core/realm/realmSystem'

// Dời từ BuildingPanelHeader.vue (2026-08-30, bug report: building header
// cũ chiếm hẳn 1 dải riêng phía dưới title bar OverlayPanel, tạo cảm giác
// 2 tầng thông tin). Giờ FunctionOverlayPanel.vue bơm thẳng ảnh+tên+cấp
// vào slot #heading của CHÍNH title bar OverlayPanel, nút Nâng cấp vào
// #header-actions — chỉ còn MỘT dải header duy nhất cho mọi building panel.
export function useBuildingHeaderState(buildingId: Ref<string | undefined>) {
  const gameManager = useGameManager()
  const { stateVersion, bumpState } = useStateVersion()

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

  const artPath = computed(() => `/assets/buildings/dong-fu/${buildingId.value}.png`)

  // Upgrade rules live in BuildingSystem.quoteUpgrade (via buildingOps) —
  // the header consumes the quote and keeps label formatting only.
  const quote = computed(() => {
    stateVersion.value

    if (!instance.value) return null

    return gameManager.buildingOps.quoteBuildingUpgrade(instance.value.instanceId)
  })

  const nextUpgradeCost = computed(() => quote.value?.nextUpgradeCost ?? [])

  const canAffordUpgrade = computed(() => quote.value?.canAfford ?? false)

  const hasNextLevel = computed(() => quote.value?.hasNextLevel ?? false)

  const meetsRealmRequirement = computed(() => quote.value?.meetsRealmRequirement ?? false)

  const requiredRealmName = computed(() => {
    if (!quote.value) return ''
    return getCurrentRealm(quote.value.requiredRealmId).name
  })

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

  function upgrade() {
    if (!instance.value || !hasNextLevel.value || !meetsRealmRequirement.value || !canAffordUpgrade.value) {
      return
    }

    if (gameManager.buildingOps.upgradeBuilding(instance.value.instanceId)) {
      bumpState()
    }
  }

  return {
    template,
    instance,
    artPath,
    nextUpgradeCost,
    canAffordUpgrade,
    hasNextLevel,
    meetsRealmRequirement,
    requiredRealmName,
    upgradeCostLabel,
    upgrade,
  }
}
