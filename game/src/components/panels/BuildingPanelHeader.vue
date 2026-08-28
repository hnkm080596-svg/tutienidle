<script setup lang="ts">
import { computed } from 'vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { getRealmIdForTier, getRealmTier } from '@/core/realm/RealmTierMap'
import { getCurrentRealm } from '@/core/realm/realmSystem'
import GameButton from '@/components/common/GameButton.vue'

const props = defineProps<{ buildingId: string }>()

const gameManager = useGameManager()
const player = usePlayerStore()

const { stateVersion, bumpState } = useStateVersion()

const template = computed(() => {
  stateVersion.value

  return gameManager.getBuildingDefinitions().find((entry) => entry.id === props.buildingId)
})

const instance = computed(() => {
  stateVersion.value

  const current = gameManager.buildingManager.getByBuildingId(props.buildingId)

  return current ? { ...current } : undefined
})

const artPath = computed(() => `/assets/buildings/dong-fu/${props.buildingId}.png`)

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
</script>

<template>
  <header v-if="template && instance" class="building-panel-header">
    <img class="building-panel-header__art" :src="artPath" alt="" />

    <div class="building-panel-header__identity">
      <small>CÔNG TRÌNH ĐỘNG PHỦ</small>
      <h2>{{ template.name }}</h2>
      <p>Cấp {{ instance.level }} / {{ template.maxLevel }}</p>
    </div>

    <div class="building-panel-header__upgrade-area">
      <GameButton
        v-if="hasNextLevel"
        class="building-panel-header__upgrade"
        size="sm"
        :disabled="!meetsRealmRequirement || !canAffordUpgrade"
        :title="!meetsRealmRequirement ? `Cần đạt ${requiredRealmName}` : upgradeCostLabel || 'Không có chi phí nâng cấp được cấu hình'"
        @click="upgrade"
      >
        Nâng công trình
      </GameButton>

      <small v-if="hasNextLevel" class="building-panel-header__cost">
        <template v-if="!meetsRealmRequirement">Cần đạt {{ requiredRealmName }}</template>
        <template v-else-if="upgradeCostLabel">{{ upgradeCostLabel }}</template>
      </small>
    </div>
  </header>
</template>

<style scoped>
.building-panel-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 88px;
  padding: 10px 18px;
  border-bottom: 1px solid color-mix(in srgb, var(--chrome-500) 30%, transparent);
  background: linear-gradient(90deg, color-mix(in srgb, var(--ink-900) 97%, transparent), color-mix(in srgb, var(--ink-950) 94%, transparent));
}

.building-panel-header__art {
  width: 74px;
  height: 64px;
  object-fit: cover;
  border: 1px solid color-mix(in srgb, var(--chrome-500) 40%, transparent);
  border-radius: 50% 50% var(--radius-sm) var(--radius-sm);
  background: var(--ink-900);
  filter: saturate(.9) contrast(1.08);
  box-shadow: 0 0 18px color-mix(in srgb, var(--chrome-500) 14%, transparent);
}

.building-panel-header__identity { min-width: 0; margin-right: auto; }
.building-panel-header__identity small { color: var(--chrome-500); font-size: var(--text-xs); letter-spacing: .17em; }
.building-panel-header__upgrade-area { display: flex; max-width: 45%; flex-direction: column; align-items: flex-end; gap: 5px; }

.building-panel-header h2,
.building-panel-header p {
  margin: 0;
}

.building-panel-header h2 {
  color: var(--chrome-100);
  font: 700 var(--text-title) var(--font-display);
}

.building-panel-header p {
  color: var(--jade);
  font-size: var(--text-sm);
}

.building-panel-header__upgrade {
  margin-top: 3px;
  padding: 7px 14px;
  border: 1px solid var(--chrome-300);
}

.building-panel-header__upgrade:disabled {
  border-color: var(--ink-line);
  background: var(--ink-700);
  color: var(--text-muted);
}

.building-panel-header__cost {
  text-align: right;
  color: var(--text-muted);
  font-size: var(--text-xs);
}

@container overlay-panel (max-width: 640px) {
  .building-panel-header { align-items: flex-start; flex-wrap: wrap; }
  .building-panel-header__upgrade-area { max-width: 100%; align-items: flex-start; }
  .building-panel-header__cost { text-align: left; }
}
</style>
