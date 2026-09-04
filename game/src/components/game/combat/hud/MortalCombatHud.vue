<script setup lang="ts">
// Slice 7 (master plan Task 8, 2026-09-04) — Phàm Nhân: đúng 3 slot cố
// định basic/special/ultimate qua useCombatSkillPresentation (bản cũ
// render 1 slot từ N-slot loadout model đã retire). Bấm chọn skill khi
// là lượt player paused (manual mode).
import CombatSkillSlot from './CombatSkillSlot.vue'
import { useCombatSkillPresentation } from '@/composables/useCombatSkillPresentation'

const { basic, special, ultimate, chooseSkill } = useCombatSkillPresentation()
</script>

<template>
  <div class="mortal-combat-hud">
    <CombatSkillSlot
      v-if="basic && basic.skillId"
      class="mortal-combat-hud__slot"
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
      class="mortal-combat-hud__slot"
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
      class="mortal-combat-hud__slot"
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
</template>

<style scoped>
.mortal-combat-hud {
  display: flex;
  gap: var(--space-2);
}

.mortal-combat-hud__slot {
  width: 88px;
}
</style>
