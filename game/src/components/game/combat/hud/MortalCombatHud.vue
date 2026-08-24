<script setup lang="ts">
// skill-insight-and-auto-combat-hud-plan.md mục 7 — Phàm Nhân CHỈ có
// đúng 1 ô lớn cho Trảm. KHÔNG dựng 5 ô trống, KHÔNG hiện slot khóa.
//
// electron-combat-timing-smoothing-plan.md mục 7/8 — ô này thể hiện
// NHỊP ĐÁNH (cadenceRemaining/cadenceTotal, mượt qua rAF resync ở
// useBasicAttackCadence.ts), KHÔNG PHẢI Skill.cooldown.
import CombatSkillSlot from './CombatSkillSlot.vue'
import { useBasicAttackCadence } from '@/composables/useBasicAttackCadence'

const { basicAttack, basicAttackSkill, displayRemaining } = useBasicAttackCadence()
</script>

<template>
  <div v-if="basicAttack" class="mortal-combat-hud">
    <CombatSkillSlot
      class="mortal-combat-hud__slot"
      :skill="basicAttackSkill"
      :remaining="displayRemaining"
      :total="basicAttack.cadenceTotal"
      :is-masked="displayRemaining > 0"
      :tooltip-override="basicAttackSkill ? {
        title: basicAttackSkill.name,
        description: 'Nhịp đánh — đòn tự động theo tốc độ đánh, không phải hồi chiêu kỹ năng.',
      } : undefined"
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
