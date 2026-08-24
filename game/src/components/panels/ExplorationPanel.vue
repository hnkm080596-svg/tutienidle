<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import type { ExplorationRewardTier } from '@/core/exploration/ExplorationReward'
import BuildingConstructionGate from './BuildingConstructionGate.vue'

const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()

// Chỉ để ép Vue re-render đồng hồ đếm tiến độ mỗi giây — không có
// nguồn reactive nào khác báo "thời gian vừa trôi" cho panel này
// (khác battleView, ExplorationManager không tự có ref). Panel này
// bị unmount mỗi khi đóng (v-if ở RightPanel.vue) nên phải tự dọn
// interval, không thì mỗi lần mở lại panel sẽ rò rỉ 1 interval mới.
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

const maxConcurrent = computed(() => {
  stateVersion.value
  return gameManager.getMaxConcurrentExplorations(player.$state)
})

const runningCount = computed(() => {
  stateVersion.value
  return gameManager.getRunningExplorationCount()
})

// Logic tính progress/claimableRuns giữ NGUYÊN 100% — chỉ đổi cách
// trình bày (từ list ngang cuộn sang master-detail 2 cột).
const rows = computed(() => {
  stateVersion.value

  const time = nowSeconds.value

  return gameManager.getExplorationDefinitions().map(entry => {
    const { exploration, rewards } = entry

    const active = gameManager.explorationManager.get(exploration.id)

    const elapsedSeconds = active ? Math.max(0, time - active.startedAt) : 0

    const totalRuns = active
      ? Math.min(Math.floor(elapsedSeconds / exploration.duration), exploration.maxRuns)
      : 0

    const claimableRuns = active ? Math.max(0, totalRuns - active.claimedRuns) : 0

    const progress = active ? Math.min(1, elapsedSeconds / (exploration.duration * exploration.maxRuns)) : 0

    return {
      exploration,
      rewards,
      isRunning: active !== undefined,
      progress,
      claimableRuns,
    }
  })
})

// Chọn 1 địa điểm để xem chi tiết bên phải — mặc định địa điểm ĐẦU
// TIÊN trong danh sách, không tự đổi theo trạng thái running (chọn
// thủ công, giữ nguyên lựa chọn của người chơi giữa các tick).
const selectedExplorationId = ref<string | null>(null)

const selectedRow = computed(() => {
  const rowsValue = rows.value

  const found = rowsValue.find(row => row.exploration.id === selectedExplorationId.value)

  return found ?? rowsValue[0] ?? null
})

function selectExploration(id: string) {
  selectedExplorationId.value = id
}

// "Hiệu Suất" — kỳ vọng nhận được mỗi giờ, tính THUẦN HIỂN THỊ từ
// chance/minAmount/maxAmount/duration đã có sẵn (không đổi
// ExplorationSystem.collect() — vẫn roll random thật lúc thu hoạch,
// đây chỉ là số kỳ vọng để người chơi so sánh giữa các địa điểm).
const outputRows = computed(() => {
  if (!selectedRow.value) {
    return []
  }

  const { exploration, rewards } = selectedRow.value

  return rewards.map(reward => {
    const material = gameManager.materialRegistry.has(reward.materialId)
      ? gameManager.materialRegistry.get(reward.materialId)
      : null

    const expectedPerRun = reward.chance * ((reward.minAmount + reward.maxAmount) / 2)

    const perHour = expectedPerRun * (3600 / exploration.duration)

    return {
      materialId: reward.materialId,

      label: material?.name ?? reward.materialId,

      perHour: Math.round(perHour * 10) / 10,

      tier: reward.tier,
    }
  })
})

// Common/Rare/Regional (MASTER SPEC Mục IV) — tái dùng token màu sẵn
// có, không thêm token mới.
const TIER_LABELS: Record<ExplorationRewardTier, string> = {
  common: 'Thường',
  rare: 'Hiếm',
  regional: 'Đặc Khu',
}

function start(explorationId: string) {
  if (gameManager.startExploration(explorationId, player.$state)) {
    bumpState()
  }
}

function collect(explorationId: string) {
  const result = gameManager.collectExploration(explorationId)

  if (result && result.materials.length > 0) {
    console.log('Thu hoạch:', result.materials)
  }

  bumpState()
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours} giờ${minutes > 0 ? ` ${minutes} phút` : ''}`
  }

  return `${minutes} phút`
}
</script>

<template>
  <BuildingConstructionGate building-id="gathering_outpost">
  <div class="exploration-panel">
    <div class="exploration-panel__list">
      <p class="exploration-panel__summary">Đang thám hiểm: {{ runningCount }} / {{ maxConcurrent }}</p>

      <button
        v-for="row in rows"
        :key="row.exploration.id"
        type="button"
        class="exploration-card"
        :class="{ 'is-selected': selectedRow?.exploration.id === row.exploration.id }"
        @click="selectExploration(row.exploration.id)"
      >
        <div class="exploration-card__icon">
          <span class="exploration-card__monogram">{{ row.exploration.name.charAt(0) }}</span>

          <span v-if="row.isRunning" class="exploration-card__badge">Đang chạy</span>
        </div>

        <div class="exploration-card__info">
          <span class="exploration-card__name">{{ row.exploration.name }}</span>

          <div v-if="row.isRunning" class="exploration-card__progress-bar">
            <div class="exploration-card__progress-fill" :style="{ width: `${row.progress * 100}%` }" />
          </div>
        </div>

        <span v-if="row.claimableRuns > 0" class="exploration-card__claimable">{{ row.claimableRuns }}</span>
      </button>
    </div>

    <div v-if="selectedRow" class="exploration-detail">
      <h3 class="exploration-detail__name">{{ selectedRow.exploration.name }}</h3>

      <p class="exploration-detail__description">{{ selectedRow.exploration.description }}</p>

      <div class="exploration-detail__section">
        <h4>Yêu Cầu</h4>

        <div class="exploration-detail__row">
          <span>Thời gian/lượt</span>
          <span>{{ formatDuration(selectedRow.exploration.duration) }}</span>
        </div>

        <div class="exploration-detail__row">
          <span>Số lượt tối đa</span>
          <span>{{ selectedRow.exploration.maxRuns }}</span>
        </div>
      </div>

      <div class="exploration-detail__section">
        <h4>Hiệu Suất</h4>

        <div v-for="output in outputRows" :key="output.materialId" class="exploration-detail__row">
          <span class="exploration-detail__output-label">
            {{ output.label }}
            <span class="tier-chip" :class="`tier-chip--${output.tier}`">{{ TIER_LABELS[output.tier] }}</span>
          </span>
          <span class="exploration-detail__output-value">+{{ output.perHour }}/giờ</span>
        </div>
      </div>

      <div v-if="selectedRow.isRunning" class="exploration-detail__progress">
        <div class="exploration-detail__progress-bar">
          <div class="exploration-detail__progress-fill" :style="{ width: `${selectedRow.progress * 100}%` }" />
        </div>

        <button
          type="button"
          class="exploration-detail__action"
          :disabled="selectedRow.claimableRuns <= 0"
          @click="collect(selectedRow.exploration.id)"
        >
          Thu hoạch ({{ selectedRow.claimableRuns }})
        </button>
      </div>

      <button
        v-else
        type="button"
        class="exploration-detail__action"
        :disabled="!selectedRow.exploration.enabled || runningCount >= maxConcurrent"
        @click="start(selectedRow.exploration.id)"
      >
        Bắt đầu
      </button>
    </div>
  </div>
  </BuildingConstructionGate>
</template>

<style scoped>
.exploration-panel {
  display: flex;
  height: 100%;
  min-height: 0;
  color: var(--text-primary);
  font-family: var(--font-body);
}

.exploration-panel__list {
  flex: 0 0 42%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  overflow-y: auto;
  border-right: 1px solid var(--ink-line);
}

.exploration-panel__summary {
  margin: 0 0 4px;
  color: var(--gold-500);
  font-size: var(--text-sm);
}

.exploration-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
  font-family: var(--font-body);
  color: var(--text-primary);
}

.exploration-card.is-selected {
  border-color: var(--gold-500);
}

.exploration-card__icon {
  position: relative;
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--ink-700);
  display: flex;
  align-items: center;
  justify-content: center;
}

.exploration-card__monogram {
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--gold-500);
}

.exploration-card__badge {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  padding: 0 4px;
  border-radius: 6px;
  background: var(--jade);
  color: var(--ink-950);
  font-size: var(--text-xs);
  white-space: nowrap;
}

.exploration-card__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.exploration-card__name {
  font-size: var(--text-sm);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.exploration-card__progress-bar {
  height: 4px;
  border-radius: 2px;
  background: var(--ink-700);
  overflow: hidden;
}

.exploration-card__progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--jade), var(--gold-500));
}

.exploration-card__claimable {
  flex: 0 0 auto;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--gold-500);
  color: var(--gold-ink);
  font-size: var(--text-xs);
  font-weight: 700;
}

.exploration-detail {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  overflow-y: auto;
}

.exploration-detail__name {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1rem;
  color: var(--text-primary);
}

.exploration-detail__description {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.exploration-detail__section h4 {
  margin: 0 0 4px;
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--gold-500);
}

.exploration-detail__row {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  padding: 2px 0;
  font-size: var(--text-sm);
  border-bottom: 1px solid var(--ink-line-soft);
}

.exploration-detail__output-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.exploration-detail__output-value {
  color: var(--jade);
}

.tier-chip {
  padding: 0 5px;
  border-radius: 6px;
  font-size: var(--text-xs);
  font-weight: 600;
}

.tier-chip--common {
  background: var(--ink-700);
  color: var(--text-secondary);
}

.tier-chip--rare {
  background: rgba(91, 155, 213, 0.18);
  color: var(--azure);
}

.tier-chip--regional {
  background: rgba(255, 213, 79, 0.18);
  color: var(--gold-500);
}

.exploration-detail__progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.exploration-detail__progress-bar {
  height: 8px;
  border-radius: 4px;
  background: var(--ink-700);
  overflow: hidden;
}

.exploration-detail__progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--jade), var(--gold-500));
}

.exploration-detail__action {
  padding: 8px;
  background: var(--gold-500);
  color: var(--gold-ink);
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 700;
  cursor: pointer;
  font-family: var(--font-body);
}

.exploration-detail__action:disabled {
  background: var(--ink-700);
  color: var(--text-muted);
  cursor: not-allowed;
}
</style>
