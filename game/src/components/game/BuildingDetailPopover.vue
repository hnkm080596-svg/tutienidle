<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import StatRow from '@/components/common/primitives/StatRow.vue'
import Eyebrow from '@/components/common/primitives/Eyebrow.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { usePlayerStore } from '@/stores/player'
import { useUiStore, type LeftPanelMode } from '@/stores/ui'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { isBetaBuildingSurface } from '@/core/betaScopeSurface'

const props = defineProps<{ buildingId: string }>()

const player = usePlayerStore()

const ui = useUiStore()

const gameManager = useGameManager()

const { t } = useI18n()

const { stateVersion, bumpState } = useStateVersion()

const isBusy = ref(false)

const template = computed(() => {
  stateVersion.value

  return isBetaBuildingSurface(props.buildingId)
    ? gameManager.buildingOps.getBuildingDefinitions().find((entry) => entry.id === props.buildingId)
    : undefined
})

const instance = computed(() => {
  stateVersion.value

  const manager = gameManager.buildingManager
  const current = manager.getByBuildingId(props.buildingId)

  // BuildingManager mutate level tai cho. Tra cung object reference khien
  // computed khong phat update du stateVersion da bump, nen popover van hien
  // cap/cost cu sau khi nang. Snapshot moi buoc Vue render lai dung state.
  return current ? { ...current } : undefined
})

const canBuild = computed(() => {
  stateVersion.value

  return !instance.value && gameManager.buildingOps.canBuildBuilding(props.buildingId, player.$state)
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
    const wasBuilt = gameManager.buildingOps.buildBuilding(props.buildingId, player.$state, Date.now() / 1000)

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
    <InkNineSlice asset-id="surface-m-paper" layer="surface" />
    <InkNineSlice asset-id="frame-m-seal-corner" layer="frame" />

    <div class="building-popover__scroll scrollfade">
      <div class="building-popover__header">
        <div>
          <h3 class="building-popover__title">{{ template.name }}</h3>

          <p class="building-popover__description">{{ template.description }}</p>
        </div>
      </div>

      <div class="building-popover__section">
        <Eyebrow as="h4">{{ t('panels.buildingPopover.costTitle') }}</Eyebrow>

        <ul class="building-popover__costs">
          <StatRow
            v-for="cost in costRows(buildCost)"
            :key="cost.materialId"
            :label="cost.name"
            :tone="cost.owned < cost.amount ? 'negative' : 'default'"
          >
            {{ cost.owned }} / {{ cost.amount }}
          </StatRow>
        </ul>
      </div>
    </div>

    <!-- Nut hanh dong co dinh NGOAI vung scroll (2026-08-30, bug report:
         popup nhieu chi phi day nut "Xay dung" xuong duoi, phai cuon moi
         bam duoc) - luon hien du noi dung chi phi dai co nao. -->
    <GameButton class="building-popover__action" variant="primary" :disabled="!canBuild" @click="build">{{ t('panels.buildingPopover.build') }}</GameButton>
  </div>
</template>

<style scoped>
.building-popover {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 14px;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
  color: var(--paper-text);
  font-family: var(--font-body);
  min-width: 260px;
  max-width: 320px;
  max-height: calc(100vh - 48px);
}

.building-popover__scroll {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow-y: auto;
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
  font-size: var(--text-lg);
  color: var(--paper-text);
}

.building-popover__description {
  margin: 4px 0 0;
  font-size: var(--text-xs);
  color: var(--paper-text-soft);
}

.building-popover__section h4 {
  margin: 0 0 6px;
}

.building-popover__costs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: var(--text-xs);
}

.building-popover__action {
  flex: 0 0 auto;
  margin-top: 10px;
}

</style>
