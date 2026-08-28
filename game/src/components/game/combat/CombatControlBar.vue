<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager } from '@/composables/useGameState'
import { batKiemTickSeconds } from '@/composables/useCombatSkillPresentation'
import GameButton from '@/components/common/GameButton.vue'

// Combat UI Redesign mục 11 — pause đã bị loại bỏ (game idle, 2026-08-27);
// chỉ còn "Thoát Trận" cho trận Stage. Auto Battle cấu hình TRƯỚC trận ở
// StageSelectPanel.vue, không tốc độ (mục 11-12 — hard rule).
const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()

// Task 7 (task-7-brief.md §1) — slider tụ lực Bạt Kiếm, 3-9s. Chỉ hiện
// khi route hiện tại là 'bat_kiem' (setKiemTuRoute, Task 6). Cố ý
// KHÔNG persist giá trị chọn giữa các trận (dev-phase, "đơn giản: không
// nhớ, mặc định 3 mỗi trận") — mount lại mỗi lần vào trận (component
// này chỉ sống trong CombatSceneOverlay) nên reset về 3 VÀ đồng bộ lại
// override bên BattleSystem (nó không tự reset giữa các trận).
onMounted(() => {
  if (player.kiemTuRoute === 'bat_kiem') {
    batKiemTickSeconds.value = 3

    gameManager.battleSystem.setChannelTickSeconds('bat_kiem_thuat', 3)
  }
})

function onTuLucTickInput(event: Event) {
  const seconds = Number((event.target as HTMLInputElement).value)

  batKiemTickSeconds.value = seconds

  gameManager.battleSystem.setChannelTickSeconds('bat_kiem_thuat', seconds)
}

// "Thoát Trận" (2026-08-21) — force về Động Phủ giữa chừng, có xác
// nhận trước (showExitConfirm). CHỈ hiện cho trận Stage — Tribulation
// (Đột Phá) có luồng thắng/thua riêng (useTribulation.ts), thoát ngang
// giữa trận Kiếp dễ để lại state dở dang không đúng chỗ nào xử lý, xem
// GameManager.abandonBattle()'s ghi chú.
const showExitConfirm = ref(false)

function confirmExit() {
  gameManager.abandonBattle()

  ui.battleRunMode = 'manual'
  ui.exitCombatScene()
  gameManager.eventBus.emit('combat_scene_exit', undefined)

  showExitConfirm.value = false
}
</script>

<template>
  <div class="combat-control-bar">
    <GameButton
      v-if="ui.combatOrigin === 'stage'"
      class="combat-control-bar__exit"
      variant="secondary"
      @click="showExitConfirm = true"
    >
      ✕ Thoát Trận
    </GameButton>

    <div v-if="player.kiemTuRoute === 'bat_kiem'" class="combat-control-bar__tu-luc">
      <label class="combat-control-bar__tu-luc-label" for="tu-luc-tick-slider">
        Nhịp Tụ Lực: {{ batKiemTickSeconds }}s
      </label>

      <input
        id="tu-luc-tick-slider"
        type="range"
        min="3"
        max="9"
        step="1"
        class="combat-control-bar__tu-luc-slider"
        :value="batKiemTickSeconds"
        @input="onTuLucTickInput"
      />
    </div>

    <div v-if="showExitConfirm" class="combat-control-bar__confirm-overlay" @click.self="showExitConfirm = false">
      <div class="combat-control-bar__confirm">
        <p class="combat-control-bar__confirm-text">Thoát trận và về Động Phủ? Trận đấu hiện tại sẽ bị huỷ.</p>

        <div class="combat-control-bar__confirm-actions">
          <GameButton class="combat-control-bar__confirm-cancel" variant="secondary" size="sm" @click="showExitConfirm = false">Ở Lại</GameButton>
          <GameButton class="combat-control-bar__confirm-ok" variant="danger" size="sm" @click="confirmExit">Thoát Trận</GameButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.combat-control-bar {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--ink-950);
  border-top: 1px solid var(--ink-line);
  pointer-events: auto;
}

.combat-control-bar__exit {
  padding: 8px 20px;
}

.combat-control-bar__exit:hover {
  border-color: var(--crimson);
  color: var(--crimson);
}

.combat-control-bar__tu-luc {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
}

.combat-control-bar__tu-luc-label {
  font-family: var(--font-body);
  font-weight: 700;
  font-size: var(--text-sm);
  color: var(--gold-300);
  white-space: nowrap;
}

.combat-control-bar__tu-luc-slider {
  width: 120px;
  accent-color: var(--gold-500);
  cursor: pointer;
}

.combat-control-bar__confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scrim);
}

.combat-control-bar__confirm {
  box-sizing: border-box;
  width: min(320px, calc(100vw - 32px));
  padding: 20px;
  background: var(--ink-900);
  border: 1px solid var(--crimson);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-panel);
  text-align: center;
  font-family: var(--font-body);
}

.combat-control-bar__confirm-text {
  margin: 0 0 16px;
  font-size: var(--text-body);
  color: var(--text-secondary);
  line-height: 1.4;
}

.combat-control-bar__confirm-actions {
  display: flex;
  gap: 8px;
}

.combat-control-bar__confirm-cancel,
.combat-control-bar__confirm-ok {
  flex: 1 1 auto;
  padding: 8px;
}
</style>
