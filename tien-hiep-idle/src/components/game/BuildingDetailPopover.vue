<script setup lang="ts">
// Thám Hiểm rework — popover 1 Building duy nhất, mở từ icon trong
// HomeBuildingIcons.vue. Thay thế phần "Đã Xây"/"Có Thể Xây" của
// BuildingPanel.vue cũ (đã xoá — mỗi Building giờ có icon+popover
// riêng thay vì 1 danh sách phẳng). Chỉ dùng cho Building KHÔNG phải
// crafting_station (Farm/Mine/Smelter...) — 4 building crafting_station
// (Đan Phòng/Trận Đài/Phù Viện/Khí Đường) mở thẳng panel thật của
// chúng (đã có BuildingConstructionGate.vue riêng), không qua đây.
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { formatNumber } from '@/core/format/NumberFormatter'

const props = defineProps<{ buildingId: string }>()

const emit = defineEmits<{ close: [] }>()

const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()

const nowSeconds = ref(Date.now() / 1000)

let progressTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  progressTimer = setInterval(() => {
    nowSeconds.value = Date.now() / 1000
  }, 1000)
})

onUnmounted(() => {
  if (progressTimer) {
    clearInterval(progressTimer)
  }
})

const template = computed(() => gameManager.buildingRegistry.get(props.buildingId))

const instance = computed(() => {
  stateVersion.value

  return gameManager.buildingManager.getByBuildingId(props.buildingId)
})

const buildCost = computed(() => template.value.upgradeCost[0] ?? [])

const canBuild = computed(() =>
  gameManager.buildingSystem.canBuild(
    props.buildingId,
    gameManager.buildingRegistry,
    gameManager.buildingManager,
    player.$state,
    gameManager.materialBag,
  ),
)

const nextUpgradeCost = computed(() => {
  const current = instance.value

  if (!current) {
    return null
  }

  return template.value.upgradeCost[current.level] ?? null
})

const canUpgrade = computed(() => {
  const current = instance.value

  return current !== undefined && current.level < template.value.maxLevel
})

// Sản lượng tích luỹ — CHỈ có ý nghĩa cho resource/processing building
// (producesMaterialId hoặc processingRecipeId), crafting_station không
// tự sản xuất gì nên stored luôn 0 (BuildingSystem.getStoredAmount()
// tự trả 0 nếu không khớp 2 field đó, xem core/building/BuildingSystem.ts).
const stored = computed(() => {
  const current = instance.value

  if (!current) {
    return 0
  }

  return Math.floor(gameManager.getBuildingStoredAmount(current.instanceId, nowSeconds.value))
})

const capacity = computed(() => {
  const current = instance.value

  if (!current) {
    return 0
  }

  return Math.round(template.value.baseStorageCapacity * (1 + (current.level - 1) * 0.2))
})

const producesSomething = computed(() => Boolean(template.value.producesMaterialId || template.value.producesSpiritStone || template.value.processingRecipeId))

function materialLabel(materialId: string): string {
  return gameManager.materialRegistry.has(materialId) ? gameManager.materialRegistry.get(materialId).name : materialId
}

// Linh Thảo Viên rework — 9 ô vuông, hiện đè LÊN block "stored/collect"
// generic ở trên (producesSomething tự false cho building này, không
// đụng gì tới template.value.producesMaterialId/processingRecipeId,
// xem Building.ts's ghi chú "3 kiểu building loại trừ nhau").
const isGarden = computed(() => Boolean(template.value.gardenSeedMaterialId))

const gardenPlots = computed(() => {
  stateVersion.value

  const current = instance.value

  if (!current) {
    return []
  }

  return gameManager.getGardenPlots(current.instanceId, nowSeconds.value)
})

const seedAmount = computed(() => {
  stateVersion.value

  return template.value.gardenSeedMaterialId ? gameManager.materialBag.getAmount(template.value.gardenSeedMaterialId) : 0
})

const hasReadyPlot = computed(() => gardenPlots.value.some(plot => plot.status === 'ready'))

function plotLabel(plot: (typeof gardenPlots.value)[number]): string {
  switch (plot.status) {
    case 'locked':
      return 'Khoá'
    case 'empty':
      return 'Trống'
    case 'ready':
      return 'Đã Chín'
    case 'growing':
      return `${Math.ceil(plot.remainingSeconds / 60)}p`
  }
}

function clickPlot(plotIndex: number) {
  const current = instance.value

  if (!current) {
    return
  }

  const plot = gardenPlots.value[plotIndex]

  if (plot?.status === 'empty') {
    gameManager.plantGardenSeed(current.instanceId, plotIndex)

    bumpState()

    return
  }

  if (plot?.status === 'ready') {
    gameManager.harvestGardenPlot(current.instanceId, plotIndex)

    bumpState()
  }
}

function harvestAllPlots() {
  const current = instance.value

  if (!current) {
    return
  }

  gameManager.harvestAllGardenPlots(current.instanceId)

  bumpState()
}

function build() {
  const costLabel = buildCost.value.map(c => `${materialLabel(c.materialId)} x${formatNumber(c.amount)}`).join(', ') || 'miễn phí'

  const confirmed = window.confirm(`Xây ${template.value.name}? Sẽ tốn ${costLabel}.`)

  if (!confirmed) {
    return
  }

  if (gameManager.buildBuilding(props.buildingId, player.$state)) {
    bumpState()
  }
}

function upgrade() {
  const current = instance.value

  if (current && gameManager.upgradeBuilding(current.instanceId)) {
    bumpState()
  }
}

function collect() {
  const current = instance.value

  if (!current) {
    return
  }

  gameManager.collectBuilding(current.instanceId, player.$state)
  bumpState()
}
</script>

<template>
  <div class="building-popover-backdrop" @click.self="emit('close')">
    <div class="building-popover">
      <button type="button" class="building-popover__close" @click="emit('close')">×</button>

      <div class="building-popover__icon">{{ template.name.charAt(0) }}</div>

      <h3 class="building-popover__name">{{ template.name }}</h3>
      <p class="building-popover__description">{{ template.description }}</p>

      <template v-if="!instance">
        <p class="building-popover__cost">
          Cần: {{ buildCost.map(c => `${materialLabel(c.materialId)} x${formatNumber(c.amount)}`).join(', ') || 'Miễn phí' }}
        </p>

        <button type="button" class="building-popover__action" :disabled="!canBuild" @click="build">
          Xây Dựng
        </button>
      </template>

      <template v-else>
        <p class="building-popover__level">Lv.{{ instance.level }}/{{ template.maxLevel }}</p>

        <template v-if="isGarden">
          <p class="building-popover__cost">Hạt giống trong túi: {{ formatNumber(seedAmount) }}</p>

          <div class="garden-grid">
            <button
              v-for="plot in gardenPlots"
              :key="plot.index"
              type="button"
              class="garden-plot"
              :class="`garden-plot--${plot.status}`"
              :disabled="plot.status === 'locked' || (plot.status === 'empty' && seedAmount <= 0)"
              @click="clickPlot(plot.index)"
            >
              {{ plotLabel(plot) }}
            </button>
          </div>

          <div class="building-popover__actions">
            <button v-if="hasReadyPlot" type="button" @click="harvestAllPlots">
              Thu Hoạch Tất Cả
            </button>

            <button
              v-if="canUpgrade"
              type="button"
              v-tooltip="nextUpgradeCost ? { title: 'Nâng Cấp', description: nextUpgradeCost.map(c => `${materialLabel(c.materialId)} x${formatNumber(c.amount)}`).join(', ') } : undefined"
              @click="upgrade"
            >
              Nâng Cấp
            </button>
          </div>
        </template>

        <template v-else>
          <div v-if="producesSomething" class="building-popover__stored">
            <div class="building-popover__stored-bar">
              <div class="building-popover__stored-fill" :style="{ width: `${capacity > 0 ? Math.min(100, (stored / capacity) * 100) : 0}%` }" />
            </div>
            <span>{{ formatNumber(stored) }} / {{ formatNumber(capacity) }}</span>
          </div>

          <div class="building-popover__actions">
            <button v-if="producesSomething" type="button" :disabled="stored <= 0" @click="collect">
              Thu Hoạch
            </button>

            <button
              v-if="canUpgrade"
              type="button"
              v-tooltip="nextUpgradeCost ? { title: 'Nâng Cấp', description: nextUpgradeCost.map(c => `${materialLabel(c.materialId)} x${formatNumber(c.amount)}`).join(', ') } : undefined"
              @click="upgrade"
            >
              Nâng Cấp
            </button>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.building-popover-backdrop {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(5, 5, 8, 0.6);
}

.building-popover {
  position: relative;
  width: 320px;
  padding: 20px;
  background: var(--ink-900);
  border: 1px solid var(--gold-500);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-panel);
  text-align: center;
  font-family: var(--font-body);
  color: var(--text-primary);
}

.building-popover__close {
  position: absolute;
  top: 6px;
  right: 10px;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1.2rem;
  cursor: pointer;
}

.building-popover__icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 8px;
  border-radius: 50%;
  border: 1px solid var(--gold-500);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  color: var(--gold-500);
  font-size: 1.1rem;
}

.building-popover__name {
  margin: 0 0 4px;
  font-family: var(--font-display);
  color: var(--gold-500);
  font-size: 1rem;
}

.building-popover__description {
  margin: 0 0 10px;
  color: var(--text-secondary);
  font-size: 0.78rem;
}

.building-popover__cost,
.building-popover__level {
  margin: 0 0 10px;
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.building-popover__stored {
  margin-bottom: 10px;
  font-size: 0.72rem;
  color: var(--text-secondary);
}

.building-popover__stored-bar {
  height: 8px;
  border-radius: 4px;
  background: var(--ink-900);
  border: 1px solid var(--ink-line);
  overflow: hidden;
  margin-bottom: 4px;
}

.building-popover__stored-fill {
  height: 100%;
  background: var(--gold-500);
}

.building-popover__action {
  padding: 8px 20px;
  background: var(--gold-500);
  color: var(--gold-ink);
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 700;
  cursor: pointer;
}

.building-popover__action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.garden-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-bottom: 10px;
}

.garden-plot {
  aspect-ratio: 1;
  padding: 4px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 0.68rem;
  cursor: pointer;
}

.garden-plot--locked {
  opacity: 0.35;
  cursor: not-allowed;
}

.garden-plot--empty:hover:not(:disabled) {
  border-color: var(--gold-500);
  color: var(--gold-500);
}

.garden-plot--empty:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.garden-plot--growing {
  color: var(--jade);
  border-color: var(--jade);
}

.garden-plot--ready {
  color: var(--gold-500);
  border-color: var(--gold-500);
  background: var(--ink-700);
  box-shadow: var(--shadow-glow-gold);
}

.building-popover__actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.building-popover__actions button {
  padding: 6px 14px;
  background: var(--ink-800);
  color: var(--text-primary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.78rem;
}

.building-popover__actions button:hover:not(:disabled) {
  border-color: var(--gold-500);
  color: var(--gold-500);
}

.building-popover__actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
