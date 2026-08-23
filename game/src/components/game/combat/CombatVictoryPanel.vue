<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useGameManager } from '@/composables/useGameState'
import { useBattleActions } from '@/composables/useBattleActions'
import { useAutoRetryCountdown } from '@/composables/useAutoRetryCountdown'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { formatNumber } from '@/core/format/NumberFormatter'
import { resolveNextProgressStage } from '@/core/stage/ProgressStageResolver'

// Combat UI Redesign mục 14-19 — thắng thì hiện reward tích luỹ cả
// trận (xem GameManager.getBattleRewardSummary()). Auto Battle OFF:
// "Đánh Lại"/"Tiếp Tục" bấm tay. Auto Battle ON: "Đánh Lại" tối màu +
// đếm ngược 3s rồi TỰ bắt đầu trận mới — thắng + explorationMode
// 'auto' thì leo lên Màn kế tiếp trong Địa Giới (y hệt logic
// Auto-refight cũ của App.vue's tick(), chỉ dời trigger từ "ngay tick
// đó" sang "hết đếm ngược" — xem plan mục 15/19).
const COUNTDOWN_SECONDS = 3

const gameManager = useGameManager()
const ui = useUiStore()
const player = usePlayerStore()
const { startBattle } = useBattleActions()

const summary = computed(() => gameManager.getBattleRewardSummary())

function refight(): boolean {
  if (!ui.selectedStageId) {
    return false
  }

  const stage = gameManager.getStage(ui.selectedStageId)

  if (!stage) {
    return false
  }

  return startBattle(stage)
}

function retryNow() {
  refight()
}

function continueToStageSelect() {
  ui.exitCombatScene()
  gameManager.eventBus.emit('combat_scene_exit', undefined)
}

const { remaining: countdown, start: startAutoRefightCountdown } = useAutoRetryCountdown(COUNTDOWN_SECONDS, () => {
  // Tự Động Thám Hiểm — chỉ tiến khi resolver xác nhận màn kế đã mở. Màn
  // tồn tại nhưng bị gate bởi tu vi là trạng thái dừng auto hợp lệ, không
  // được gọi startStage() mù rồi để modal victory kẹt ở 0s.
  if (ui.battleRunMode === 'progress' && ui.selectedZoneId && ui.selectedStageId) {
    const resolution = resolveNextProgressStage(
      gameManager,
      player.$state,
      ui.selectedZoneId,
      ui.selectedStageId,
    )

    if (resolution.status === 'ready') {
      const nextStageId = resolution.stage.id

      if (!gameManager.isStageUnlocked(nextStageId, player.$state)) {
        // Có màn kế tiếp nhưng progression hiện tại chưa mở nó (vd thắng 1.5
        // khi mới ở cảnh giới tầng 5). Kết thúc auto bằng UI thủ công thay vì
        // gọi startStage() thất bại rồi kẹt modal victory ở countdown 0s.
        ui.battleRunMode = 'manual'

        return
      }

      const previousStageId = ui.selectedStageId
      ui.selectedStageId = nextStageId

      if (!refight()) {
        ui.selectedStageId = previousStageId
        ui.battleRunMode = 'manual'
      }

      return
    } else {
      // Đã hoàn tất tuyến hiện tại: progress phải dừng, không được âm thầm
      // biến thành repeat ở tầng cuối. Cùng nhánh này xử lý stage kế bị khóa
      // hoặc dữ liệu đích không hợp lệ để modal trở lại tương tác được.
      ui.battleRunMode = 'manual'

      return
    }
  }

  if (!refight()) {
    ui.battleRunMode = 'manual'
  }
})

onMounted(() => {
  if (ui.battleRunMode !== 'manual') {
    startAutoRefightCountdown()
  }
})
</script>

<template>
  <div class="combat-victory-panel">
    <h2 class="combat-victory-panel__title">★ THẮNG ★</h2>

    <div class="combat-victory-panel__rewards">
      <p v-if="summary.experience > 0">Cảm ngộ <span>+{{ formatNumber(summary.experience) }}</span></p>
      <p v-if="summary.spiritStone > 0">Linh Thạch <span>+{{ formatNumber(summary.spiritStone) }}</span></p>
      <p v-if="summary.cultivation > 0">Tu Vi <span>+{{ formatNumber(summary.cultivation) }}</span></p>
      <p v-for="item in summary.items" :key="`${item.kind}-${item.itemId}`">{{ item.name }} <span>+{{ formatNumber(item.amount) }}</span></p>
    </div>

    <div class="combat-victory-panel__actions">
      <button
        type="button"
        class="combat-victory-panel__retry"
        :class="{ 'is-disabled': ui.battleRunMode !== 'manual' }"
        :disabled="ui.battleRunMode !== 'manual'"
        @click="retryNow"
      >
        Đánh Lại<template v-if="ui.battleRunMode !== 'manual'"> {{ countdown }}s</template>
      </button>

      <button v-if="ui.battleRunMode === 'manual'" type="button" class="combat-victory-panel__continue" @click="continueToStageSelect">
        Tiếp Tục
      </button>
    </div>
  </div>
</template>

<style scoped>
.combat-victory-panel {
  width: 420px;
  padding: 28px 32px;
  background: var(--ink-900);
  border: 1px solid var(--gold-500);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-panel);
  text-align: center;
  font-family: var(--font-body);
}

.combat-victory-panel__title {
  margin: 0 0 16px;
  font-family: var(--font-display);
  color: var(--gold-500);
  font-size: 1.3rem;
}

.combat-victory-panel__rewards {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 20px;
}

.combat-victory-panel__rewards p {
  margin: 0;
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.combat-victory-panel__rewards p span {
  color: var(--jade);
  font-weight: 700;
}

.combat-victory-panel__actions {
  display: flex;
  gap: 10px;
}

.combat-victory-panel__actions button {
  flex: 1;
  padding: 10px;
  border-radius: var(--radius-sm);
  border: none;
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
}

.combat-victory-panel__retry {
  background: var(--gold-500);
  color: var(--gold-ink);
}

.combat-victory-panel__retry.is-disabled {
  background: var(--ink-700);
  color: var(--text-muted);
  cursor: not-allowed;
}

.combat-victory-panel__continue {
  background: var(--ink-800);
  color: var(--text-primary);
  border: 1px solid var(--ink-line-soft);
}
</style>
