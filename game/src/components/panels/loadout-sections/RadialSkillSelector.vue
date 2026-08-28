<script setup lang="ts">
import { computed } from 'vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useLoadoutActions } from '@/composables/useLoadoutActions'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import type { Skill } from '@/core/skill/Skill'

// PLAN HOÀN CHỈNH mục 9 — Radial Skill Selection: bấm 1 ô Skill
// Loadout mở ra 1 vòng tròn các kỹ năng VIABLE (đã học qua Skill Tree)
// xếp quanh tâm, bấm 1 cái để gắn vào slotIndex đang mở. "Viable" ở đây
// = MỌI skill active đã unlocked — execution policy rework (plan §8.6)
// KHÔNG còn loại đòn cơ bản riêng vì mọi active đều là loadout skill
// bình thường.
const props = defineProps<{ slotIndex: number }>()

const emit = defineEmits<{ close: [] }>()

const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const { setSkillLoadoutSlot } = useLoadoutActions()

const viableSkills = computed<Skill[]>(() => {
  stateVersion.value

  return gameManager.skillManager.getAll().filter(
    skill => skill.type === 'active' && skill.unlocked,
  )
})

const currentSkill = computed(() => {
  stateVersion.value

  return gameManager.skillManager.getEquippedInSlot(props.slotIndex)
})

const ITEM_SIZE_PX = 72
const MIN_RADIUS_PX = 108

// Bán kính phải đủ lớn để các nút 72px không chồng nhau khi thư viện
// skill đông (chord giữa 2 nút kề >= kích thước nút + khe hở), nhưng
// không vượt quá nửa cạnh ngắn viewport (tràn màn hình).
const radiusPx = computed(() => {
  const count = Math.max(3, viableSkills.value.length)
  const chordFit = (ITEM_SIZE_PX + 8) / (2 * Math.sin(Math.PI / count))
  const viewportCap = Math.min(window.innerWidth, window.innerHeight) / 2 - ITEM_SIZE_PX
  return Math.max(MIN_RADIUS_PX, Math.min(chordFit, viewportCap))
})

const stageSizePx = computed(() => (radiusPx.value + ITEM_SIZE_PX / 2 + 12) * 2)

function positionFor(index: number, total: number) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2

  return {
    left: `calc(50% + ${Math.cos(angle) * radiusPx.value}px)`,
    top: `calc(50% + ${Math.sin(angle) * radiusPx.value}px)`,
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
  <div class="radial-skill-selector" :style="{ zIndex: OVERLAY_LAYERS.panel }" @click.self="emit('close')">
    <div
      class="radial-skill-selector__stage"
      :style="{ width: `${stageSizePx}px`, height: `${stageSizePx}px` }"
    >
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
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scrim);
}

.radial-skill-selector__stage {
  position: relative;
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
  border: 2px solid var(--chrome-300);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px;
  text-align: center;
  box-shadow: var(--shadow-glow-chrome);
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
  border-color: var(--chrome-300);
  color: var(--chrome-100);
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
