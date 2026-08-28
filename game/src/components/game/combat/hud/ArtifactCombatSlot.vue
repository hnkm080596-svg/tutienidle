<script setup lang="ts">
// Bản Mệnh Pháp Bảo — HUD combat (doc §12.2). SIBLING của
// CombatSkillSlot.vue, KHÔNG giả làm nó (skill slot đại diện 1 skill
// người chơi chủ động chọn; artifact tự vận hành, không có action nào
// ở đây) — markup/cooldown-ring riêng.
import { computed } from 'vue'
import { ELEMENT_LABELS, ELEMENT_COLOR_VARS } from '@/core/element/ElementLabels'
import type { ArtifactCombatPresentationState } from '@/core/artifact/ArtifactCombatPresentation'

const props = defineProps<{ state: ArtifactCombatPresentationState }>()

const cooldownPercent = computed(() => {
  if (props.state.cooldownTotal <= 0) {
    return 0
  }

  return Math.max(0, Math.min(100, (props.state.cooldownRemaining / props.state.cooldownTotal) * 100))
})

const elementLabel = computed(() =>
  props.state.nextElement ? ELEMENT_LABELS[props.state.nextElement] : 'Trung Tính',
)

const elementColor = computed(() =>
  props.state.nextElement ? ELEMENT_COLOR_VARS[props.state.nextElement] : 'var(--text-muted)',
)
</script>

<template>
  <div
    v-if="state.hasArtifact"
    class="artifact-combat-slot"
    :style="{ '--el-color': elementColor }"
    v-tooltip="{ title: 'Ngũ Hành Châu', description: `Hành kế: ${elementLabel}` }"
  >
    <span class="artifact-combat-slot__icon" aria-hidden="true">珠</span>

    <div class="artifact-combat-slot__mask" :style="{ height: `${cooldownPercent}%` }" />

    <span class="artifact-combat-slot__element-dot" />

    <span
      v-if="state.controlStacksOnPrimaryTarget !== undefined && state.controlStacksOnPrimaryTarget > 0"
      class="artifact-combat-slot__stacks"
    >
      {{ state.controlStacksOnPrimaryTarget }}
    </span>

    <span v-else-if="state.activationsUntilFifth === 0" class="artifact-combat-slot__stacks artifact-combat-slot__stacks--ready">
      ★
    </span>
  </div>
</template>

<style scoped>
.artifact-combat-slot {
  position: relative;
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--ink-800);
  border: 1px solid var(--el-color, var(--ink-line));
  overflow: hidden;
  pointer-events: auto;
}

.artifact-combat-slot__icon {
  position: relative;
  z-index: 1;
  font-family: var(--font-display);
  font-size: 18px;
  color: var(--el-color, var(--gold-300));
}

.artifact-combat-slot__mask {
  position: absolute;
  inset: 0 0 auto 0;
  top: auto;
  bottom: 0;
  width: 100%;
  background: rgba(10, 10, 13, 0.72);
  transition: height 0.1s linear;
}

.artifact-combat-slot__element-dot {
  position: absolute;
  bottom: 3px;
  left: 50%;
  transform: translateX(-50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color, var(--gold-300));
  box-shadow: 0 0 4px var(--el-color, transparent);
  z-index: 2;
}

.artifact-combat-slot__stacks {
  position: absolute;
  top: -2px;
  right: -2px;
  z-index: 3;
  min-width: 16px;
  padding: 0 3px;
  border-radius: 8px;
  background: var(--crimson);
  color: var(--text-primary);
  font-size: 10px;
  font-weight: 700;
  text-align: center;
  line-height: 16px;
}

.artifact-combat-slot__stacks--ready {
  background: var(--gold-500);
  color: var(--gold-ink);
}
</style>
