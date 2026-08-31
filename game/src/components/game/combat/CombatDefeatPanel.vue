<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager } from '@/composables/useGameState'
import { useBattleActions } from '@/composables/useBattleActions'
import { useAutoRetryCountdown } from '@/composables/useAutoRetryCountdown'
import { useUiStore } from '@/stores/ui'
import GameButton from '@/components/common/GameButton.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import InkWashBackdrop from '@/components/common/InkWashBackdrop.vue'
import RewardList from './RewardList.vue'

// Combat UI Redesign mục 18/23, mở rộng 2026-08-22 — trước đây CHỈ 1
// nút "Về Động Phủ" (không đánh lại). Giờ thêm "Tái Chiến" (LUÔN đánh
// lại ĐÚNG stage vừa thua — KHÔNG advance sang Màn kế tiếp như
// CombatVictoryPanel.vue lúc thắng, vì thua thì không có lý do "tiến
// bộ" sang stage mới):
//   - ui.isAuto && explorationMode==='repeat' (Lặp Lại Khiêu Chiến) →
//     tự đếm 3s rồi Tái Chiến, y hệt cơ chế Auto-refight của
//     CombatVictoryPanel.vue.
//   - ui.isAuto && explorationMode==='auto' (Tự Động Thám Hiểm) →
//     KHÔNG tự đếm 3s (tránh auto-thua-lặp-lại mà người chơi không để
//     ý) — chỉ hiện 2 lựa chọn, chờ bấm tay.
//   - Cả 2 trường hợp trên đều có fallback: 10 giây không bấm gì thì
//     tự về Động Phủ (khác 3s auto-refight — dùng setTimeout riêng,
//     chỉ chạy khi nhánh 3s KHÔNG chạy).
// Nút "Về Động Phủ" LUÔN hiện (khác Victory panel ẩn "Tiếp Tục" khi
// isAuto) — người chơi phải huỷ được auto-countdown bất cứ lúc nào.
const RETRY_COUNTDOWN_SECONDS = 3

const gameManager = useGameManager()
const ui = useUiStore()
const { t } = useI18n({ useScope: 'local' })
const { startBattle } = useBattleActions()

const summary = computed(() => gameManager.getBattleRewardSummary())

const hasAnyReward = computed(() =>
  summary.value.techniqueInsight > 0 || summary.value.skillInsight > 0 || summary.value.artifactInsight > 0 || summary.value.spiritStone > 0 || summary.value.items.length > 0,
)

const isAutoRetrying = ref(false)

function refight() {
  if (!ui.selectedStageId) {
    return
  }

  const stage = gameManager.getStage(ui.selectedStageId)

  if (!stage) {
    return
  }

  startBattle(stage)
}

const { remaining: retryCountdown, start: startAutoRetryCountdown, stop: stopAutoRetryCountdown } = useAutoRetryCountdown(RETRY_COUNTDOWN_SECONDS, refight)

function clearTimers() {
  stopAutoRetryCountdown()
}

function retryNow() {
  clearTimers()
  refight()
}

function returnHome() {
  clearTimers()
  ui.battleRunMode = 'manual'
  ui.exitCombatScene()
  gameManager.eventBus.emit('combat_scene_exit', undefined)
}

onMounted(() => {
  if (ui.battleRunMode === 'repeat') {
    isAutoRetrying.value = true
    startAutoRetryCountdown()
  }
})
</script>

<template>
  <div class="combat-defeat-panel">
    <InkWashBackdrop left-mountain bottom-mist :right-mountain="false" />
    <InkNineSlice asset-id="surface-xl-paper-scroll" layer="surface" />
    <InkNineSlice asset-id="frame-xl-ceremony" layer="frame" tint-var="--cinnabar" />
    <h2 class="combat-defeat-panel__title">{{ t('combat.defeat.title') }}</h2>

    <RewardList v-if="hasAnyReward" :summary="summary" class="combat-defeat-panel__rewards scrollfade" />

    <div class="combat-defeat-panel__actions">
      <GameButton
        class="combat-defeat-panel__retry"
        variant="danger"
        :class="{ 'is-disabled': isAutoRetrying }"
        :disabled="isAutoRetrying"
        @click="retryNow"
      >
        {{ t('combat.defeat.retry') }}<template v-if="isAutoRetrying"> {{ t('combat.defeat.retryCountdown', { seconds: retryCountdown }) }}</template>
      </GameButton>

      <GameButton class="combat-defeat-panel__return" variant="secondary" @click="returnHome">{{ t('combat.defeat.returnHome') }}</GameButton>
    </div>
  </div>
</template>

<style scoped>
.combat-defeat-panel {
  position: relative;
  isolation: isolate;
  box-sizing: border-box;
  width: min(420px, calc(100vw - 32px));
  padding: 28px 32px;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  text-align: center;
  font-family: var(--font-body);
}

.combat-defeat-panel > :not(.ink-nine-slice):not(.ink-wash-backdrop) {
  position: relative;
  z-index: 3;
}

.combat-defeat-panel__title {
  margin: 0 0 16px;
  font-family: var(--font-display);
  color: var(--crimson);
  font-size: var(--text-panel-title);
}

.combat-defeat-panel__rewards {
  margin-bottom: 20px;
}

.combat-defeat-panel__actions {
  display: flex;
  gap: 10px;
}

.combat-defeat-panel__actions button {
  flex: 1;
  padding: 10px;
}

.combat-defeat-panel__retry.is-disabled {
  background: var(--ink-700);
  color: var(--text-muted);
}

.combat-defeat-panel__return:hover {
  border-color: var(--crimson);
  color: var(--crimson);
}
</style>
