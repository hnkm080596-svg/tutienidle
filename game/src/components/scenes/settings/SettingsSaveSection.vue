<script setup lang="ts">
// Scene 16/17 save section ("general" group - ref's Luu Tru block):
// warning note + save/reload/export/import/reset actions.
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import SettingsSectionFrame from './SettingsSectionFrame.vue'

defineProps<{
  remoteAuthoritative: boolean
}>()
const emit = defineEmits<{
  save: []
  load: []
  export: []
  importFile: [event: Event]
  reset: []
}>()
const { t } = useI18n()
</script>

<template>
  <p class="settings-panel__warning">
    {{ t('panels.settings.autosaveNote') }}
  </p>

  <SettingsSectionFrame :title="t('panels.settings.sections.save')" :label="t('panels.settings.sections.saveAria')" data-hk-region="save">
    <div class="settings-panel__actions">
      <GameButton variant="secondary" data-testid="settings-save-button" @click="emit('save')">{{ t('panels.settings.actions.save') }}</GameButton>

      <GameButton variant="secondary" @click="emit('load')">{{ t('panels.settings.actions.reload') }}</GameButton>

      <GameButton variant="secondary" @click="emit('export')">{{ t('panels.settings.actions.export') }}</GameButton>

      <label class="settings-panel__import">
        {{ t('panels.settings.actions.import') }}
        <input type="file" accept="application/json" @change="(e) => emit('importFile', e)" />
      </label>

      <GameButton class="settings-panel__danger" variant="danger" @click="emit('reset')">
        {{ remoteAuthoritative ? t('panels.settings.actions.resetCloud') : t('panels.settings.actions.reset') }}
      </GameButton>
    </div>
  </SettingsSectionFrame>
</template>

<style scoped>
.settings-panel__warning {
  color: var(--paper-text-soft);
  border: 1px solid var(--paper-line);
  background: color-mix(in srgb, var(--paper-100) 45%, transparent);
  border-radius: 2px;
  padding: 8px;
  margin: 0 0 12px;
}
.settings-panel__actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.settings-panel__actions > .game-button,
.settings-panel__actions > .settings-panel__import {
  width: 100%;
}
/* The cinnabar-tinted danger slice turns the whole face dark red; the
   label was inheriting the same tone and read as dark-red-on-red. Keep
   the label on the light primary tone so it stays legible. */
.settings-panel__danger,
.settings-panel__danger :deep(.game-button__label) {
  color: var(--hk-text-primary, #ede6d6);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
}
.settings-panel__import {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--tap-min);
  padding: 8px 14px;
  overflow: hidden;
  text-align: center;
  border: 1px solid var(--ink-line);
  border-radius: var(--radius-sm);
  cursor: pointer;
  background: var(--ink-800);
  color: var(--text-primary);
}
.settings-panel__import input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
</style>
