<script setup lang="ts">
// Scene 16/17 display section (ref's Hien Thi - CORRECTED to the real
// ui-scale control only; ref's resolution/graphics rows are INVALID).
import { useI18n } from 'vue-i18n'
import Chip from '@/components/common/primitives/Chip.vue'
import { UI_SCALE_OPTIONS } from '@/composables/uiScale'
import SettingsSectionFrame from './SettingsSectionFrame.vue'

defineProps<{
  uiScale: number
}>()
const emit = defineEmits<{ select: [scale: number] }>()
const { t } = useI18n()
</script>

<template>
  <SettingsSectionFrame
    class="settings-panel__ui-scale"
    :title="t('panels.settings.sections.uiScale')"
    :label="t('panels.settings.sections.uiScaleAria')"
    data-hk-region="ui-scale"
  >
    <div class="settings-panel__ui-scale-options">
      <Chip
        v-for="option in UI_SCALE_OPTIONS"
        :key="option"
        class="settings-panel__ui-scale-option"
        :active="uiScale === option"
        @click="emit('select', option)"
      >
        {{ Math.round(option * 100) }}%
      </Chip>
    </div>
  </SettingsSectionFrame>
</template>

<style scoped>
.settings-panel__ui-scale h4 {
  margin: 0 0 8px;
}
.settings-panel__ui-scale-options {
  display: flex;
  gap: var(--space-2);
}
.settings-panel__ui-scale-option {
  padding: 0 var(--space-4);
  border-color: var(--paper-line);
  color: var(--paper-text);
  font-size: var(--text-sm);
  --chip-active-bg: color-mix(in srgb, var(--chrome-300) 12%, transparent);
}
.settings-panel__ui-scale-option:hover {
  border-color: var(--chrome-500);
}
</style>
