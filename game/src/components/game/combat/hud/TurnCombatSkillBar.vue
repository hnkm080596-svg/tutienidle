<script setup lang="ts">
// Slice 7 (Completion Task 10) — 3 nút cố định basic/special/ultimate cho
// turn-based manual cast. Tái dùng CombatSkillSlot.vue thuần presentational
// (icon/mask/resource badge — props remaining/total unit-agnostic, ở đây là
// LƯỢT không phải giây). Slot không sẵn sàng bị DISABLE (chặn trước, spec
// Slice 7 §4 — không cho bấm rồi xử lý lỗi ở engine).
//
// Targeting vẫn hoàn toàn tự động (spec gốc §4.5) — bấm chỉ chọn SKILL.
import { computed } from 'vue'
import CombatSkillSlot from './CombatSkillSlot.vue'
import { useTurnCombatManual } from '@/composables/useTurnCombatManual'
import type { TurnSkillPresentationState } from '@/core/combat/CombatSkillPresentation'

const { slots, isAwaitingChoice, isManualMode, isBattleFighting, chooseSlot, setManualMode } =
  useTurnCombatManual()

const visible = computed(() => isBattleFighting.value)

function tapSlot(entry: TurnSkillPresentationState): void {
  if (!entry.isTappable) {
    return
  }

  chooseSlot(entry.role)
}
</script>

<template>
  <div v-if="visible" class="turn-combat-skill-bar">
    <div class="turn-combat-skill-bar__slots">
      <button
        v-for="entry in slots"
        :key="entry.role"
        type="button"
        class="turn-combat-skill-bar__slot-button"
        :class="{ 'is-tappable': entry.isTappable }"
        :disabled="!entry.isTappable"
        :aria-label="`Dùng ${entry.role}`"
        @click="tapSlot(entry)"
      >
        <CombatSkillSlot
          :remaining="entry.cooldownRemaining"
          :total="entry.cooldownTotal"
          :is-masked="entry.state === 'cooldown'"
          :resource-cost="entry.resourceCost"
          :is-insufficient-resource="entry.state === 'blocked_resource'"
        />
      </button>
    </div>

    <label class="turn-combat-skill-bar__mode-toggle">
      <input
        type="checkbox"
        :checked="isManualMode"
        @change="setManualMode(($event.target as HTMLInputElement).checked)"
      />
      <span>Thủ công</span>
    </label>

    <span v-if="isAwaitingChoice" class="turn-combat-skill-bar__awaiting">Đến lượt bạn — chọn kỹ năng</span>
  </div>
</template>

<style scoped>
.turn-combat-skill-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: auto;
}

.turn-combat-skill-bar__slots {
  display: flex;
  gap: 8px;
}

.turn-combat-skill-bar__slot-button {
  position: relative;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}

.turn-combat-skill-bar__slot-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.turn-combat-skill-bar__slot-button.is-tappable {
  outline: 2px solid var(--jade, #4caf50);
  outline-offset: 2px;
}

.turn-combat-skill-bar__mode-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-xs, 12px);
  color: var(--text-muted, #999);
  cursor: pointer;
}

.turn-combat-skill-bar__awaiting {
  font-size: var(--text-xs, 12px);
  color: var(--jade, #4caf50);
}
</style>
