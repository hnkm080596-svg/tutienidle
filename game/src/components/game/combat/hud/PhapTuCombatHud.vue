<script setup lang="ts">
// skill-insight-and-auto-combat-hud-plan.md mục 7 — Pháp Tu: năm ô là
// trung tâm build HUD, LUÔN dựng đủ 5 vị trí (trống/khóa hiện rõ ràng
// qua CombatSkillSlot/SlotView, không ẩn đi).
import CombatSkillSlot from './CombatSkillSlot.vue'
import { useCombatSkillPresentation } from '@/composables/useCombatSkillPresentation'

const { loadout, skillFor } = useCombatSkillPresentation()
</script>

<template>
  <div class="phap-tu-combat-hud">
    <CombatSkillSlot
      v-for="entry in loadout"
      :key="entry.slotIndex"
      class="phap-tu-combat-hud__slot"
      :skill="skillFor(entry)"
      :empty-label="entry.state === 'locked' ? 'Chưa Mở' : 'Trống'"
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
      :is-locked="entry.state === 'locked'"
    />
  </div>
</template>

<style scoped>
.phap-tu-combat-hud {
  display: flex;
  gap: var(--space-2);
}

/* WS7 — slot 60px quá nhỏ khi đọc trong chuyển động sau khi bỏ global
   scale; 72px giữ tổng bề ngang 5 slot hợp lý (~400px). */
.phap-tu-combat-hud__slot {
  width: 72px;
}
</style>
