<script setup lang="ts">
// Scene 09 scaffold - the four challenge-mode toggles (ref checkboxes
// render below the CTA; chips keep the `.stage-select__mode .chip`
// contract order manual/repeat/progress/perfect_farm).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BattleRunMode } from '@/stores/ui'
import Chip from '@/components/common/primitives/Chip.vue'

const props = defineProps<{
  modelValue: BattleRunMode
  perfectClear: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', mode: BattleRunMode): void
}>()

const { t } = useI18n()

const MODES: BattleRunMode[] = ['manual', 'repeat', 'progress', 'perfect_farm']

const MODE_LABEL_KEYS: Record<BattleRunMode, string> = {
  manual: 'panels.stageSelect.modes.manual',
  repeat: 'panels.stageSelect.modes.repeat',
  progress: 'panels.stageSelect.modes.progress',
  perfect_farm: 'panels.stageSelect.modes.perfectFarm',
}

const hint = computed(() => {
  const keys: Record<BattleRunMode, string> = {
    manual: 'panels.stageSelect.modeHints.manual',
    repeat: 'panels.stageSelect.modeHints.repeat',
    progress: 'panels.stageSelect.modeHints.progress',
    perfect_farm: 'panels.stageSelect.modeHints.perfectFarm',
  }
  return t(keys[props.modelValue])
})

function pick(mode: BattleRunMode) {
  if (mode === 'perfect_farm' && !props.perfectClear) {
    return
  }
  emit('update:modelValue', mode)
}
</script>

<template>
  <div class="exploration-modes">
    <div class="stage-select__mode">
      <Chip
        v-for="mode in MODES"
        :key="mode"
        :active="props.modelValue === mode"
        :disabled="mode === 'perfect_farm' && !props.perfectClear"
        @click="pick(mode)"
      >{{ t(MODE_LABEL_KEYS[mode]) }}</Chip>
    </div>
    <p class="stage-select__mode-hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.exploration-modes { display: flex; flex-direction: column; gap: 4px; }

.stage-select__mode {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
  margin-top: 4px;
}

.stage-select__mode :deep(.chip) {
  padding: 6px;
  font-size: var(--text-sm);
}

.stage-select__mode-hint {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--paper-text-muted);
}
</style>
