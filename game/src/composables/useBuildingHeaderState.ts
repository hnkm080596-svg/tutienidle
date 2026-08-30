import { computed, type Ref } from 'vue'
import { useGameManager, useStateVersion } from './useGameState'
import { usePlayerStore } from '@/stores/player'
import { getRealmIdForTier, getRealmTier } from '@/core/realm/RealmTierMap'
import { getCurrentRealm } from '@/core/realm/realmSystem'

// Dời từ BuildingPanelHeader.vue (2026-08-30, bug report: building header
// cũ chiếm hẳn 1 dải riêng phía dưới title bar OverlayPanel, tạo cảm giác
// 2 tầng thông tin). Giờ FunctionOverlayPanel.vue bơm thẳng ảnh+tên+cấp
// vào slot #heading của CHÍNH title bar OverlayPanel, nút Nâng cấp vào
// #header-actions — chỉ còn MỘT dải header duy nhất cho mọi building panel.
export function useBuildingHeaderState(buildingId: Ref<string | undefined>) {
  const gameManager = useGameManager()
  const player = usePlayerStore()
  const { stateVersion, bumpState } = useStateVersion()

  const template = computed(() => {
    stateVersion.value

    if (!buildingId.value) return undefined

    return gameManager.getBuildingDefinitions().find((entry) => entry.id === buildingId.value)
  })

  const instance = computed(() => {
    stateVersion.value

    if (!buildingId.value) return undefined

    const current = gameManager.buildingManager.getByBuildingId(buildingId.value)

    return current ? { ...current } : undefined
  })

  const artPath = computed(() => `/assets/buildings/dong-fu/${buildingId.value}.png`)

  const nextUpgradeCost = computed(() => {
    if (!template.value || !instance.value) {
      return []
    }

    return template.value.upgradeCost[instance.value.level] ?? []
  })

  const canAffordUpgrade = computed(() =>
    nextUpgradeCost.value.every(
      (cost) => gameManager.materialBag.getAmount(cost.materialId) >= cost.amount,
    ),
  )

  const hasNextLevel = computed(() =>
    Boolean(template.value && instance.value && instance.value.level < template.value.maxLevel),
  )

  const meetsRealmRequirement = computed(() =>
    Boolean(instance.value && instance.value.level + 1 <= getRealmTier(player.realmId)),
  )

  const requiredRealmName = computed(() => {
    if (!instance.value) return ''
    return getCurrentRealm(getRealmIdForTier(instance.value.level + 1)).name
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

    if (gameManager.upgradeBuilding(instance.value.instanceId)) {
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
