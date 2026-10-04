<script setup lang="ts">
// Scene 16/17 feedback section (support group) - opens the intake
// dialog owned by the panel.
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import SettingsSectionFrame from './SettingsSectionFrame.vue'

const emit = defineEmits<{ open: [] }>()
const { t } = useI18n()
</script>

<template>
  <SettingsSectionFrame
    class="settings-panel__feedback"
    :title="t('panels.settings.sections.feedback')"
    :label="t('panels.settings.sections.feedbackAria')"
    data-hk-region="feedback"
  >
    <p class="settings-panel__section-note">{{ t('panels.settings.feedback.note') }}</p>

    <GameButton variant="secondary" data-testid="settings-feedback-button" @click="emit('open')">
      {{ t('panels.settings.actions.feedback') }}
    </GameButton>
  </SettingsSectionFrame>
</template>

<style scoped>
.settings-panel__section-note {
  margin: 0 0 10px;
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
}
</style>
