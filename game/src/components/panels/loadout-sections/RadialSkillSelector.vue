<script setup lang="ts">
import { computed } from 'vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useLoadoutActions } from '@/composables/useLoadoutActions'
import type { Skill } from '@/core/skill/Skill'

// PLAN HOÀN CHỈNH mục 9 — Radial Skill Selection: bấm 1 ô Skill
// Loadout mở ra 1 vòng tròn các kỹ năng VIABLE (đã học qua Skill Tree,
// KHÔNG phải đòn cơ bản — isBasicAttack tự chạy theo timer riêng,
// không set vào Loadout được) xếp quanh tâm, bấm 1 cái để gắn vào
// slotIndex đang mở. "Viable" ở đây = MỌI skill active đã unlocked
// (không lọc theo hành/branch cụ thể — SkillManager không phân biệt
// "thuộc profession nào", chỉ có unlocked hay chưa, đúng kiến trúc
// Node Tree chung hiện có).
const props = defineProps<{ slotIndex: number }>()

const emit = defineEmits<{ close: [] }>()

const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const { setSkillLoadoutSlot } = useLoadoutActions()

const viableSkills = computed<Skill[]>(() => {
  stateVersion.value

  return gameManager.skillManager.getAll().filter(
    skill => skill.type === 'active' && skill.unlocked && !skill.isBasicAttack,
  )
})

const currentSkill = computed(() => {
  stateVersion.value

  return gameManager.skillManager.getEquippedInSlot(props.slotIndex)
})

const RADIUS_PX = 108

function positionFor(index: number, total: number) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2

  return {
    left: `calc(50% + ${Math.cos(angle) * RADIUS_PX}px)`,
    top: `calc(50% + ${Math.sin(angle) * RADIUS_PX}px)`,
  }
}

function choose(skillId: string) {
  setSkillLoadoutSlot(props.slotIndex, skillId)
  emit('close')
}

function clear() {
  setSkillLoadoutSlot(props.slotIndex, null)
  emit('close')
}
</script>

<template>
  <div class="radial-skill-selector" @click.self="emit('close')">
    <div class="radial-skill-selector__stage">
      <div class="radial-skill-selector__center">
        <span class="radial-skill-selector__center-label">{{ currentSkill?.name ?? `Ô ${slotIndex + 1} — Trống` }}</span>

        <button v-if="currentSkill" type="button" class="radial-skill-selector__clear" @click="clear">Gỡ</button>
      </div>

      <button
        v-for="(skill, index) in viableSkills"
        :key="skill.id"
        type="button"
        class="radial-skill-selector__item"
        :class="{ 'is-current': skill.id === currentSkill?.id }"
        :style="positionFor(index, viableSkills.length)"
        v-tooltip="skill.description"
        @click="choose(skill.id)"
      >
        {{ skill.name }}
      </button>

      <p v-if="viableSkills.length === 0" class="radial-skill-selector__empty">
        Chưa học kỹ năng nào — mở Skill Tree để học trước.
      </p>
    </div>
  </div>
</template>

<style scoped>
.radial-skill-selector {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(5, 5, 8, 0.72);
}

.radial-skill-selector__stage {
  position: relative;
  width: 280px;
  height: 280px;
}

.radial-skill-selector__center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background: var(--ink-900);
  border: 2px solid var(--gold-500);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px;
  text-align: center;
  box-shadow: var(--shadow-glow-gold);
}

.radial-skill-selector__center-label {
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.radial-skill-selector__clear {
  padding: 1px 8px;
  font-size: var(--text-xs);
  background: var(--ink-800);
  color: var(--crimson);
  border: 1px solid var(--crimson);
  border-radius: 999px;
  cursor: pointer;
}

.radial-skill-selector__item {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--ink-800);
  color: var(--text-primary);
  border: 1px solid var(--ink-line-soft);
  font-size: var(--text-xs);
  font-weight: 600;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  line-height: 1.15;
}

.radial-skill-selector__item:hover {
  border-color: var(--gold-500);
  color: var(--gold-500);
}

.radial-skill-selector__item.is-current {
  border-color: var(--jade);
  color: var(--jade);
}

.radial-skill-selector__empty {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 12px;
  width: 220px;
  text-align: center;
  font-size: var(--text-sm);
  color: var(--text-muted);
}
</style>
