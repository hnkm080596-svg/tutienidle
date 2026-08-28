<script setup lang="ts">
// skill-insight-and-auto-combat-hud-plan.md mục 7 + execution policy
// rework (combat-gate-teleport-autocast plan §11.3) — Kiếm Tu KHÔNG sao
// chép dải 5 ô của Pháp Tu. Ngự Kiếm Thuật (slot 0, policy 'attack_speed'
// — đọc cadence từ scheduler thống nhất) đứng riêng, 2 kỹ năng còn lại
// của kit (slot 1/2 — Thái Hư Nhất Kiếm/tuyệt kỹ) nối tiếp thành chuỗi
// "vận kiếm" — mỹ thuật chi tiết (kiếm trận/quỹ đạo thật) để phase thiết
// kế Kiếm Tu sau chốt, ở đây chỉ đảm bảo CONTRACT dữ liệu hiển thị đúng.
import { computed } from 'vue'
import CombatSkillSlot from './CombatSkillSlot.vue'
import { useCombatSkillPresentation } from '@/composables/useCombatSkillPresentation'
import { useCadenceSmoothing } from '@/composables/useCadenceSmoothing'
import { useGameManager } from '@/composables/useGameState'
import { isBattleInProgress } from '@/core/battle/BattleTypes'

const { loadout, skillFor, tuLucState } = useCombatSkillPresentation()

const primary = computed(() => loadout.value.find(entry => entry.slotIndex === 0))

// Task 7 (task-7-brief.md §3) — Bạt Kiếm dùng execution 'channel' (Task
// 3/4), KHÔNG có cadenceRemaining/Total qua buildLoadoutPresentation()
// (policy đó chỉ tính attack_speed/attack_speed_cast) nên slot 1 (chain
// đầu tiên) không tự hiện tiến độ tụ lực — vẽ riêng progress bar đọc
// tuLucState (CombatEntity.tuLucElapsed/tuLucActive + nhịp UI đang áp
// dụng từ CombatControlBar's slider).
const tuLucPercent = computed(() => {
  const state = tuLucState.value

  if (!state || !state.active || state.tickSeconds <= 0) {
    return 0
  }

  return Math.min(100, (state.elapsed / state.tickSeconds) * 100)
})

// Audit P1-4 — smoothing chỉ-presentation cho ô Ngự Kiếm (cadence),
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

// Kiếm Tu kit chỉ dùng slot 0 (Ngự Kiếm, hiện riêng)/1/2 — bỏ qua 2 slot
// cuối vốn dành cho Pháp Tu's 5-ô build (kit Kiếm Tu không cấp).
const chainEntries = computed(() => loadout.value.filter(entry => entry.slotIndex !== undefined && entry.slotIndex >= 1 && entry.slotIndex <= 2))
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

      <div class="kiem-tu-combat-hud__chain">
        <template v-for="(entry, index) in chainEntries" :key="entry.slotIndex">
          <span v-if="index > 0" class="kiem-tu-combat-hud__link">→</span>

          <CombatSkillSlot
            class="kiem-tu-combat-hud__slot"
            :skill="skillFor(entry)"
            :remaining="entry.cooldownRemaining"
            :total="entry.cooldownTotal"
            :is-masked="entry.state === 'cooldown'"
            :cast-remaining="entry.castRemaining"
            :cast-total="entry.castTotal"
            :is-casting="entry.state === 'casting'"
            :resource-cost="entry.resourceCost"
            :is-insufficient-resource="entry.state === 'blocked_resource'"
            :is-out-of-range="entry.state === 'out_of_range'"
            :is-unreleased="entry.state === 'unreleased'"
          />
        </template>
      </div>
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
  gap: 14px;
}

.kiem-tu-combat-hud__basic {
  width: 88px;
}

.kiem-tu-combat-hud__chain {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* WS7 — slot chain 56px quá nhỏ, bump 68px. */
.kiem-tu-combat-hud__slot {
  width: 68px;
}

.kiem-tu-combat-hud__link {
  color: var(--gold-500);
  font-size: 0.9rem;
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
