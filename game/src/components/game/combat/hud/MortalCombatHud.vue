<script setup lang="ts">
// skill-insight-and-auto-combat-hud-plan.md mục 7 + execution policy
// rework (combat-gate-teleport-autocast plan §11.3) — Phàm Nhân CHỈ có
// đúng 1 ô lớn cho Trảm, giờ ĐỌC TỪ scheduler thống nhất (slot 0 của
// loadout — Trảm được gán slot mặc định, xem SkillLoadoutSlots/App.vue).
// KHÔNG dựng 5 ô trống, KHÔNG hiện slot khóa.
//
// Ô này thể hiện NHỊP CADENCE theo Attack Speed (policy 'attack_speed'),
// không phải hồi chiêu Skill.cooldown.
import { computed } from 'vue'
import CombatSkillSlot from './CombatSkillSlot.vue'
import { useCombatSkillPresentation } from '@/composables/useCombatSkillPresentation'
import { useCadenceSmoothing } from '@/composables/useCadenceSmoothing'
import { useGameManager } from '@/composables/useGameState'
import { isBattleInProgress } from '@/core/battle/BattleTypes'

const { loadout, skillFor } = useCombatSkillPresentation()

const primary = computed(() => loadout.value.find(entry => entry.slotIndex === 0))

// Audit P1-4 — mask/số đếm nội suy mượt giữa hai snapshot thay vì nhảy
// theo nhịp tick; đóng băng khi không có trận đang chạy.
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
  <div class="mortal-combat-hud">
    <CombatSkillSlot
      v-if="primary && primary.skillId"
      class="mortal-combat-hud__slot"
      :skill="skillFor(primary)"
      :remaining="cadenceRemaining"
      :total="primary.cadenceTotal ?? 0"
      :is-masked="cadenceRemaining > 0"
    />
  </div>
</template>

<style scoped>
/* WS7 — phóng slot đòn thường (đọc cadence trong chuyển động). */
.mortal-combat-hud {
  width: 96px;
}

.mortal-combat-hud__slot {
  width: 96px;
}
</style>
