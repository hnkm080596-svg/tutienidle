<script setup lang="ts">
// Slice 7 (master plan Task 7, 2026-09-04) — rewrite HOÀN TOÀN: script cũ
// xoay quanh real-time battleSystem/UltimateSystem.ts/N-slot loadout đã
// retire từ Slice 6 cutover (nút Ult + slider Nhịp Tụ Lực gọi hệ chết —
// quyết định người dùng 2026-09-04: gỡ bỏ hẳn). Giờ render đúng 3 slot
// cố định basic/special/ultimate qua useCombatSkillPresentation (bấm
// chọn skill khi là lượt player paused, manual mode).
//
// Gap hiển thị đã ghi nhận (không âm thầm bỏ qua): TurnSkillDefinition
// không phải Skill object sống nên icon/name/tooltip thật của từng skill
// là follow-up content-wiring — hiện hiển thị nhãn role cố định.
import { useCombatSkillPresentation } from '@/composables/useCombatSkillPresentation'
import CombatSkillSlot from './CombatSkillSlot.vue'

const { basic, special, ultimate, chooseSkill } = useCombatSkillPresentation()
</script>

<template>
  <div class="kiem-tu-combat-hud">
    <div class="kiem-tu-combat-hud__row">
      <CombatSkillSlot
        v-if="basic && basic.skillId"
        class="kiem-tu-combat-hud__slot"
        :empty-label="basic.skillId"
        :remaining="basic.cooldownRemaining"
        :total="basic.cooldownTotal"
        :is-masked="basic.state === 'cooldown'"
        :resource-cost="basic.resourceCost"
        :is-insufficient-resource="basic.state === 'blocked_resource'"
        :is-tappable="basic.state === 'ready'"
        @click="chooseSkill('basic')"
      />

      <CombatSkillSlot
        v-if="special && special.skillId"
        class="kiem-tu-combat-hud__slot"
        :empty-label="special.skillId"
        :remaining="special.cooldownRemaining"
        :total="special.cooldownTotal"
        :is-masked="special.state === 'cooldown'"
        :resource-cost="special.resourceCost"
        :is-insufficient-resource="special.state === 'blocked_resource'"
        :is-tappable="special.state === 'ready'"
        @click="chooseSkill('special')"
      />

      <CombatSkillSlot
        v-if="ultimate && ultimate.skillId"
        class="kiem-tu-combat-hud__slot"
        :empty-label="ultimate.skillId"
        :remaining="ultimate.cooldownRemaining"
        :total="ultimate.cooldownTotal"
        :is-masked="ultimate.state === 'cooldown'"
        :resource-cost="ultimate.resourceCost"
        :is-insufficient-resource="ultimate.state === 'blocked_resource'"
        :is-tappable="ultimate.state === 'ready'"
        @click="chooseSkill('ultimate')"
      />
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

.kiem-tu-combat-hud__slot {
  width: 88px;
}
</style>
