<script setup lang="ts">
// Scene 16/17 save section ("general" group - ref's Luu Tru block):
// warning note + save/reload/export/import/reset actions.
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import GameActionButton from '@/components/common/GameActionButton.vue'
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

const importInput = ref<HTMLInputElement>()</script>

<template>
  <p class="settings-panel__warning">
    {{ t('panels.settings.autosaveNote') }}
  </p>

  <SettingsSectionFrame :title="t('panels.settings.sections.save')" :label="t('panels.settings.sections.saveAria')" data-hk-region="save">
    <div class="settings-panel__actions">
      <GameActionButton data-testid="settings-save-button" @click="emit('save')">{{ t('panels.settings.actions.save') }}</GameActionButton>

      <GameActionButton @click="emit('load')">{{ t('panels.settings.actions.reload') }}</GameActionButton>

      <GameActionButton @click="emit('export')">{{ t('panels.settings.actions.export') }}</GameActionButton>

      <GameActionButton @click="importInput?.click()">
        {{ t('panels.settings.actions.import') }}
      </GameActionButton>
      <input
        ref="importInput"
        class="settings-panel__import-input"
        type="file"
        accept="application/json"
        @change="(e) => emit('importFile', e)"
      />

      <GameActionButton class="settings-panel__danger" @click="emit('reset')">
        {{ remoteAuthoritative ? t('panels.settings.actions.resetCloud') : t('panels.settings.actions.reset') }}
      </GameActionButton>
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
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.settings-panel__actions > .game-action-button {
  width: 100%;
  height: 44px;
  font-size: 16px;
}
.settings-panel__danger { grid-column: 1 / -1; color: #e5a08b; }
.settings-panel__import-input {
  display: none;
}
</style>
