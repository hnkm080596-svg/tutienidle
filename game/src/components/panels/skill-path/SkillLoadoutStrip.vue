<script setup lang="ts">
// Trích từ LoadoutManager.vue's khối TRÊN của tab 'skill' (2026-08-20)
// — dời NGUYÊN VẸN vào SkillPathPanel.vue (cả 2 nhánh phap_tu/kiem_tu
// đều cần dải Loadout này, xem PhapTuPanel plan mục 13 "PHÁP THUẬT
// ĐANG VẬN HÀNH"), tách thành component riêng thay vì lặp lại markup ở
// 2 chỗ trong SkillPathPanel.vue.
import { computed, ref } from 'vue'
import SlotView from '../../common/SlotView.vue'
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

// Đòn cơ bản (isBasicAttack) hiện RIÊNG, KHÔNG chiếm 1 trong 5 ô
// Loadout (chạy theo attackSpeed timer, xem BattleSystem.
// updatePlayerAttack()) — vẫn đáng hiện ở đây để người chơi biết đòn
// thường hiện tại là gì.
const basicAttackSkill = computed(() => {
  stateVersion.value

  return gameManager.skillManager.getBasicAttackSkill()
})

function levelPercent(level: number, maxLevel: number): number {
  return maxLevel > 0 ? Math.min(100, (level / maxLevel) * 100) : 0
}
</script>

<template>
  <div class="skill-loadout-strip">
    <div v-if="skillLoadoutSlotCount > 0" class="skill-loadout">
      <button
        v-if="basicAttackSkill"
        type="button"
        class="skill-loadout__basic"
        v-tooltip="basicAttackSkill.description"
      >
        <SlotView class="loadout-card__icon" :item="basicAttackSkill" :label="basicAttackSkill.name" />
        <span class="skill-loadout__basic-label">Đòn Cơ Bản</span>
      </button>

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
          <div class="loadout-card__level-bar">
            <div class="loadout-card__level-fill" :style="{ width: `${levelPercent(slot.skill.level, slot.skill.maxLevel)}%` }" />
          </div>

          <span class="loadout-card__level-label">Lv. {{ slot.skill.level }}/{{ slot.skill.maxLevel }}</span>
        </template>

        <span v-else class="loadout-card__empty">Trống</span>
      </button>
    </div>

    <p v-else class="skill-loadout-strip__passive-summary">
      {{ basicAttackSkill?.name ?? 'Trảm' }} — đòn đánh cơ bản duy nhất khi chưa nhập môn.
    </p>

    <!-- Core Loop Foundation checklist (Mục SKILL) — "behavior-
         changing node" của skill đang ở slot ĐANG MỞ. -->
    <div
      v-if="openSlotIndex !== null && skillLoadoutSlots[openSlotIndex]?.skill?.specializations?.length"
      class="loadout-specializations"
    >
      <button
        v-for="spec in skillLoadoutSlots[openSlotIndex]!.skill!.specializations"
        :key="spec.id"
        type="button"
        class="loadout-specializations__btn"
        :class="{ 'is-active': skillLoadoutSlots[openSlotIndex]!.skill!.selectedSpecializationId === spec.id }"
        v-tooltip="{ title: spec.name, description: spec.description }"
        @click="selectSkillSpecialization(skillLoadoutSlots[openSlotIndex]!.skill!.id, spec.id)"
      >
        {{ spec.name }}
      </button>
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
  color: var(--gold-500);
  font-size: 0.75rem;
}

.loadout-card__icon {
  flex: 0 0 15%;
  width: 15%;
}

.loadout-card__level-bar {
  height: 4px;
  border-radius: 2px;
  background: var(--ink-700);
  overflow: hidden;
}

.loadout-card__level-fill {
  height: 100%;
  background: var(--gold-500);
}

.loadout-card__level-label {
  font-size: 0.6rem;
  color: var(--text-muted);
}

.loadout-card__empty {
  font-size: 0.62rem;
  color: var(--text-muted);
}

.skill-loadout {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.skill-loadout__basic,
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

.skill-loadout__basic {
  border-color: var(--gold-500);
  cursor: default;
}

.skill-loadout__basic-label {
  font-size: 0.56rem;
  color: var(--gold-500);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.skill-loadout__slot:hover:not(.is-locked) {
  border-color: var(--gold-500);
}

.skill-loadout__slot.is-locked {
  opacity: 0.45;
  cursor: not-allowed;
}

.skill-loadout__slot-lock {
  font-size: 0.58rem;
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
  font-size: 0.6rem;
  background: var(--ink-800);
  color: var(--text-secondary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.loadout-specializations__btn.is-active {
  border-color: var(--gold-500);
  color: var(--gold-500);
  background: var(--ink-700);
}
</style>
