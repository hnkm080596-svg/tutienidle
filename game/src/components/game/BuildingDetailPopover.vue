<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useUiStore, type LeftPanelMode } from '@/stores/ui'
import { useGameManager, useStateVersion } from '@/composables/useGameState'

const props = defineProps<{ buildingId: string }>()

const emit = defineEmits<{ close: [] }>()

const player = usePlayerStore()

const ui = useUiStore()

const gameManager = useGameManager()

const { stateVersion, bumpState } = useStateVersion()

const isBusy = ref(false)

const template = computed(() => {
  stateVersion.value

  return gameManager.getBuildingDefinitions().find((entry) => entry.id === props.buildingId)
})

const instance = computed(() => {
  stateVersion.value

  const manager = gameManager.buildingManager
  const current = manager.getByBuildingId(props.buildingId)

  // BuildingManager mutate level tại chỗ. Trả cùng object reference khiến
  // computed không phát update dù stateVersion đã bump, nên popover vẫn hiện
  // cấp/cost cũ sau khi nâng. Snapshot mới buộc Vue render lại đúng state.
  return current ? { ...current } : undefined
})

const canBuild = computed(() => {
  stateVersion.value

  return !instance.value && gameManager.canBuildBuilding(props.buildingId, player.$state)
})

const buildCost = computed(() => template.value?.upgradeCost[0] ?? [])

const costRows = computed(() => {
  return (cost: Array<{ materialId: string; amount: number }>) =>
    cost.map((entry) => ({
      ...entry,

      name: gameManager.materialRegistry.has(entry.materialId)
        ? gameManager.materialRegistry.get(entry.materialId).name
        : entry.materialId,

      owned: gameManager.materialBag.getAmount(entry.materialId),
    }))
})

async function build() {
  if (isBusy.value) {
    return
  }

  isBusy.value = true

  try {
    const wasBuilt = gameManager.buildBuilding(props.buildingId, player.$state, Date.now() / 1000)

    if (wasBuilt && template.value?.functionType) {
      ui.openLeftPanel(template.value.functionType as Exclude<LeftPanelMode, null>)
    }
  } finally {
    isBusy.value = false

    bumpState()
  }
}

</script>

<template>
  <div v-if="template && !instance" class="building-popover">
    <div class="building-popover__header">
      <div>
        <h3 class="building-popover__title">{{ template.name }}</h3>

        <p class="building-popover__description">{{ template.description }}</p>
      </div>

      <button type="button" class="building-popover__close" @click="emit('close')">✕</button>
    </div>

    <div class="building-popover__section">
      <h4>Chi phí xây dựng</h4>

      <ul class="building-popover__costs">
        <li
          v-for="cost in costRows(buildCost)"
          :key="cost.materialId"
          :class="{ 'is-missing': cost.owned < cost.amount }"
        >
          <span>{{ cost.name }}</span>

          <span>{{ cost.owned }} / {{ cost.amount }}</span>
        </li>
      </ul>

      <button
        type="button"
        class="building-popover__action"
        :disabled="!canBuild"
        @click="build"
      >
        Xây dựng
      </button>
    </div>
  </div>
</template>

<style scoped>
.building-popover {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: var(--ink-900);
  border: 1px solid var(--ink-line);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: var(--font-body);
  min-width: 260px;
  max-width: 320px;
}

.building-popover__header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: flex-start;
}

.building-popover__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1rem;
  color: var(--gold-500);
}

.building-popover__description {
  margin: 4px 0 0;
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.building-popover__close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.9rem;
}

.building-popover__section h4 {
  margin: 0 0 6px;
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--gold-500);
}

.building-popover__costs {
  list-style: none;
  margin: 0 0 8px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: var(--text-xs);
}

.building-popover__costs li {
  display: flex;
  justify-content: space-between;
  gap: 6px;
}

.building-popover__costs li.is-missing {
  color: var(--danger, #e05d5d);
}

.building-popover__action {
  padding: 7px 10px;
  background: var(--gold-500);
  color: var(--gold-ink);
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 700;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: var(--text-sm);
}

.building-popover__action:disabled {
  background: var(--ink-700);
  color: var(--text-muted);
  cursor: not-allowed;
}

</style>
