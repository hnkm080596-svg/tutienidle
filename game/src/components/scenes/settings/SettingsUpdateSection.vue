<script setup lang="ts">
// Scene 16/17 update section (ref's Cap Nhat - electron/feed builds
// only): phase-aware status line + download/cancel/install/check.
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import SettingsSectionFrame from './SettingsSectionFrame.vue'

defineProps<{
  currentVersion: string
  phase: string | null
  candidateVersion: string | undefined
  progressPercent: number
}>()
const emit = defineEmits<{ download: []; cancel: []; install: []; check: [] }>()
const { t } = useI18n()
</script>

<template>
  <SettingsSectionFrame
    class="settings-panel__update"
    :title="t('panels.settings.update.title')"
    :label="t('panels.settings.sections.updateAria')"
    data-hk-region="update"
  >
    <p class="settings-panel__section-note">
      {{ t('panels.settings.update.note', { version: currentVersion }) }}
    </p>

    <p v-if="phase === 'available'" class="settings-panel__update-status" data-testid="update-status">
      {{ t('panels.settings.update.statusAvailable', { version: candidateVersion }) }}
    </p>
    <p v-else-if="phase === 'downloading'" class="settings-panel__update-status" data-testid="update-status">
      {{ t('updates.downloading', { percent: progressPercent }) }}
    </p>
    <p v-else-if="phase === 'downloaded'" class="settings-panel__update-status" data-testid="update-status">
      {{ t('updates.ready', { version: candidateVersion }) }}
    </p>
    <p v-else-if="phase === 'checking'" class="settings-panel__update-status" data-testid="update-status">
      {{ t('panels.settings.update.statusChecking') }}
    </p>
    <p v-else-if="phase === 'unavailable'" class="settings-panel__update-status" data-testid="update-status">
      {{ t('panels.settings.update.statusUpToDate') }}
    </p>
    <p v-else-if="phase === 'error'" class="settings-panel__update-status" data-testid="update-status">
      {{ t('updates.failed') }}
    </p>

    <div class="settings-panel__actions">
      <GameButton
        v-if="phase === 'available'"
        size="md"
        variant="primary"
        data-testid="update-download"
        @click="emit('download')"
      >
        {{ t('updates.download') }}
      </GameButton>
      <GameButton
        v-else-if="phase === 'downloading'"
        size="md"
        variant="secondary"
        data-testid="update-cancel"
        @click="emit('cancel')"
      >
        {{ t('updates.cancel') }}
      </GameButton>
      <GameButton
        v-else-if="phase === 'downloaded'"
        size="md"
        variant="primary"
        data-testid="update-install"
        @click="emit('install')"
      >
        {{ t('updates.install') }}
      </GameButton>
      <GameButton
        v-else
        size="md"
        variant="secondary"
        :disabled="phase === 'checking' || phase === 'installing'"
        data-testid="update-check"
        @click="emit('check')"
      >
        {{ t('updates.check') }}
      </GameButton>
    </div>
  </SettingsSectionFrame>
</template>

<style scoped>
.settings-panel__section-note {
  margin: 0 0 10px;
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
}
.settings-panel__actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.settings-panel__actions > .game-button {
  width: 100%;
}
</style>
