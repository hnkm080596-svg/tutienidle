<script setup lang="ts">
// Kiếm Thế / Kiếm Ý (spec 2026-08-29-kiem-the-kiem-y mục 5/6) — mỗi
// route Kiếm Tu ĐÚNG 1 active skill duy nhất ở slot 0 (Kiếm Trận tiến
// hóa hoặc Bạt Kiếm Thức), KHÔNG còn chain slot 1/2/4 (bộ 3-skill kit
// cũ + slot Kiếm Trận riêng đã dỡ). Ult là nút manual riêng trong
// CombatControlBar, không phải loadout slot.
import { computed } from 'vue'
import CombatSkillSlot from './CombatSkillSlot.vue'
import { useCombatSkillPresentation } from '@/composables/useCombatSkillPresentation'
import { useCadenceSmoothing } from '@/composables/useCadenceSmoothing'
import { useGameManager } from '@/composables/useGameState'
import { isBattleInProgress } from '@/core/battle/BattleTypes'

const { loadout, skillFor, tuLucState } = useCombatSkillPresentation()

const primary = computed(() => loadout.value.find(entry => entry.slotIndex === 0))

// Bạt Kiếm dùng execution 'channel' — slot 0 không tự hiện tiến độ tụ
// lực qua buildLoadoutPresentation() nên vẽ riêng progress bar đọc
// tuLucState (CombatEntity.tuLucElapsed/tuLucActive + nhịp UI slider).
const tuLucPercent = computed(() => {
  const state = tuLucState.value

  if (!state || !state.active || state.tickSeconds <= 0) {
    return 0
  }

  return Math.min(100, (state.elapsed / state.tickSeconds) * 100)
})

// Audit P1-4 — smoothing chỉ-presentation cho ô chính (cadence KT),
// cùng lớp dùng chung với Mortal HUD.
const gameManager = useGameManager()

const cadenceRemaining = useCadenceSmoothing(
  () => ({
    remaining: primary.value?.cadenceRemaining ?? 0,
    total: primary.value?.cadenceTotal ?? 0,
  }),
  () => {
    const battle = gameManager.getBattle()

    return battle !== null && isBattleInProgress(battle.state)
  },
)
</script>

<template>
  <div class="kiem-tu-combat-hud">
    <div class="kiem-tu-combat-hud__row">
      <CombatSkillSlot
        v-if="primary && primary.skillId"
        class="kiem-tu-combat-hud__basic"
        :skill="skillFor(primary)"
        :remaining="cadenceRemaining"
        :total="primary.cadenceTotal ?? 0"
        :is-masked="cadenceRemaining > 0"
        :is-out-of-range="primary.state === 'out_of_range'"
      />
    </div>

    <div v-if="tuLucState" class="kiem-tu-combat-hud__tu-luc">
      <div class="kiem-tu-combat-hud__tu-luc-fill" :style="{ width: `${tuLucPercent}%` }" />
      <span class="kiem-tu-combat-hud__tu-luc-label">Tụ Lực {{ tuLucState.elapsed.toFixed(1) }}/{{ tuLucState.tickSeconds }}s</span>
    </div>
  </div>
</template>

<style scoped>
.kiem-tu-combat-hud {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kiem-tu-combat-hud__row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.kiem-tu-combat-hud__basic {
  width: 88px;
}

.kiem-tu-combat-hud__chain {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* WS7 — slot chain 56px quá nhỏ; 72px cho khớp ô skill của Pháp Tu. */
.kiem-tu-combat-hud__slot {
  width: 72px;
}

.kiem-tu-combat-hud__link {
  color: var(--chrome-300);
  font-size: var(--text-body);
}

.kiem-tu-combat-hud__tu-luc {
  position: relative;
  width: 100%;
  height: 14px;
  overflow: hidden;
  background: var(--ink-950);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
}

.kiem-tu-combat-hud__tu-luc-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: linear-gradient(90deg, var(--jade), var(--gold-500));
  transition: width 0.1s linear;
}

.kiem-tu-combat-hud__tu-luc-label {
  position: relative;
  z-index: 1;
  display: grid;
  height: 100%;
  place-items: center;
  font-size: 9px;
  font-weight: 700;
  color: var(--text-primary);
  text-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
}
</style>
