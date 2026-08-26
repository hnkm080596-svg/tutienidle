<script setup lang="ts">
import { computed } from 'vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'

const props = defineProps<{ buildingId: string }>()

const gameManager = useGameManager()

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

const canUpgrade = computed(() =>
  Boolean(
    template.value && instance.value && instance.value.level < template.value.maxLevel,
  ),
)

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
  if (!instance.value || !canUpgrade.value || !canAffordUpgrade.value) {
    return
  }

  if (gameManager.upgradeBuilding(instance.value.instanceId)) {
    bumpState()
  }
}
</script>

<template>
  <header v-if="template && instance" class="building-panel-header">
    <h2>{{ template.name }}</h2>

    <p>Cấp {{ instance.level }} / {{ template.maxLevel }}</p>

    <button
      v-if="canUpgrade"
      type="button"
      class="building-panel-header__upgrade"
      :disabled="!canAffordUpgrade"
      :title="upgradeCostLabel || 'Không có chi phí nâng cấp được cấu hình'"
      @click="upgrade"
    >
      Nâng cấp
    </button>

    <small v-if="canUpgrade && upgradeCostLabel" class="building-panel-header__cost">
      {{ upgradeCostLabel }}
    </small>
  </header>
</template>

<style scoped>
.building-panel-header {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  padding: 16px 18px 14px;
  border-bottom: 1px solid var(--ink-line);
  background: color-mix(in srgb, var(--ink-800) 84%, transparent);
}

.building-panel-header h2,
.building-panel-header p {
  margin: 0;
}

.building-panel-header h2 {
  color: var(--gold-500);
  font: 700 1.15rem var(--font-display);
}

.building-panel-header p {
  color: var(--jade);
  font-size: var(--text-sm);
}

.building-panel-header__upgrade {
  margin-top: 3px;
  padding: 7px 14px;
  border: 1px solid var(--gold-500);
  border-radius: var(--radius-sm);
  background: var(--gold-500);
  color: var(--gold-ink);
  font: 700 var(--text-sm) var(--font-body);
  cursor: pointer;
}

.building-panel-header__upgrade:disabled {
  border-color: var(--ink-line);
  background: var(--ink-700);
  color: var(--text-muted);
  cursor: not-allowed;
}

.building-panel-header__cost {
  color: var(--text-muted);
  font-size: var(--text-xs);
}
</style>
