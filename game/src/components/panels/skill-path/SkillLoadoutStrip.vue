<script setup lang="ts">
// Trích từ LoadoutManager.vue's khối TRÊN của tab 'skill' (2026-08-20)
// — dời NGUYÊN VẸN vào SkillPathPanel.vue (cả 2 nhánh phap_tu/kiem_tu
// đều cần dải Loadout này, xem PhapTuPanel plan mục 13 "PHÁP THUẬT
// ĐANG VẬN HÀNH"), tách thành component riêng thay vì lặp lại markup ở
// 2 chỗ trong SkillPathPanel.vue.
import { computed, ref } from 'vue'
import SlotView from '../../common/SlotView.vue'
import Chip from '../../common/primitives/Chip.vue'
import RadialSkillSelector from '../loadout-sections/RadialSkillSelector.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useLoadoutActions } from '@/composables/useLoadoutActions'
import { usePlayerStore } from '@/stores/player'
import { getSkillLoadoutSlotCount, MAX_SKILL_LOADOUT_SLOTS } from '@/core/skill/SkillLoadoutSlots'

const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion } = useStateVersion()
const { selectSkillSpecialization } = useLoadoutActions()

const skillLoadoutSlotCount = computed(() => {
  stateVersion.value

  return getSkillLoadoutSlotCount(player.realmId)
})

const skillLoadoutSlots = computed(() => {
  stateVersion.value

  return Array.from({ length: MAX_SKILL_LOADOUT_SLOTS }, (_, index) => ({
    index,
    locked: index >= skillLoadoutSlotCount.value,
    skill: gameManager.skillManager.getEquippedInSlot(index),
  }))
})

const openSlotIndex = ref<number | null>(null)

function openSlot(index: number) {
  openSlotIndex.value = index
}

// Execution policy rework (plan §8.6) — KHÔNG còn "Đòn Cơ Bản" hiện
// riêng: Trảm/Ngự Kiếm đều là loadout skill ở slot 0 như mọi skill khác.

</script>

<template>
  <div class="skill-loadout-strip">
    <div v-if="skillLoadoutSlotCount > 0" class="skill-loadout">
      <button
        v-for="slot in skillLoadoutSlots"
        :key="slot.index"
        type="button"
        class="skill-loadout__slot"
        :class="{ 'is-locked': slot.locked }"
        :disabled="slot.locked"
        @click="openSlot(slot.index)"
      >
        <SlotView
          class="loadout-card__icon"
          :item="slot.skill ?? null"
          :label="slot.skill?.name ?? `Ô ${slot.index + 1}`"
        />

        <span v-if="slot.locked" class="skill-loadout__slot-lock">Khóa</span>

        <template v-else-if="slot.skill">
          <span class="loadout-card__level-label">Lv. {{ slot.skill.level }}/{{ slot.skill.maxLevel }}</span>
        </template>

        <span v-else class="loadout-card__empty">Trống</span>
      </button>
    </div>

    <p v-else class="skill-loadout-strip__passive-summary">
      Trảm — đòn đánh cơ bản duy nhất khi chưa nhập môn.
    </p>

    <!-- Core Loop Foundation checklist (Mục SKILL) — "behavior-
         changing node" của skill đang ở slot ĐANG MỞ. -->
    <div
      v-if="openSlotIndex !== null && skillLoadoutSlots[openSlotIndex]?.skill?.specializations?.length"
      class="loadout-specializations"
    >
      <Chip
        v-for="spec in skillLoadoutSlots[openSlotIndex]!.skill!.specializations"
        :key="spec.id"
        class="loadout-specializations__btn"
        :active="skillLoadoutSlots[openSlotIndex]!.skill!.selectedSpecializationId === spec.id"
        v-tooltip="{ title: spec.name, description: spec.description }"
        @click="selectSkillSpecialization(skillLoadoutSlots[openSlotIndex]!.skill!.id, spec.id)"
      >
        {{ spec.name }}
      </Chip>
    </div>

    <RadialSkillSelector
      v-if="openSlotIndex !== null"
      :slot-index="openSlotIndex"
      @close="openSlotIndex = null"
    />
  </div>
</template>

<style scoped>
.skill-loadout-strip {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skill-loadout-strip__passive-summary {
  margin: 0;
  padding: 8px;
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
}

.loadout-card__icon {
  width: 100%;
}

.loadout-card__level-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.loadout-card__empty {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.skill-loadout {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.skill-loadout__slot {
  flex: 1 1 30%;
  min-width: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 4px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
  color: var(--text-primary);
}

.skill-loadout__slot:hover:not(.is-locked) {
  border-color: var(--chrome-300);
}

.skill-loadout__slot.is-locked {
  opacity: 0.45;
  cursor: not-allowed;
}

.skill-loadout__slot-lock {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.loadout-specializations {
  display: flex;
  gap: 4px;
  padding: 0 8px 6px;
}

.loadout-specializations__btn {
  flex: 1 1 auto;
  padding: 3px 6px;
  --chip-active-bg: var(--ink-700);
}

.loadout-specializations__btn.is-active {
  color: var(--paper-50);
}
</style>
