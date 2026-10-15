<script setup lang="ts">
// Scene 16/17 language section (ref's Ngon Ngu - CORRECTED to the real
// locale chips; ref's voice-language dropdown is INVALID).
import { useI18n } from 'vue-i18n'
import GameTabButton from '@/components/common/GameTabButton.vue'
import { LOCALE_OPTIONS, type AppLocale } from '@/composables/locale'
import SettingsSectionFrame from './SettingsSectionFrame.vue'

defineProps<{
  locale: AppLocale
}>()
const emit = defineEmits<{ select: [locale: AppLocale] }>()
const { t } = useI18n()
</script>

<template>
  <SettingsSectionFrame
    class="settings-panel__language"
    :title="t('panels.settings.sections.language')"
    :label="t('panels.settings.sections.languageAria')"
    data-hk-region="language"
  >
    <p class="settings-panel__section-note">{{ t('panels.settings.language.note') }}</p>

    <div class="settings-panel__language-options">
      <GameTabButton
        v-for="option in LOCALE_OPTIONS"
        :key="option"
        class="settings-panel__language-option"
        :selected="locale === option"
        :aria-pressed="locale === option"
        :data-testid="`settings-locale-${option}`"
        @click="emit('select', option)"
      >
        {{ t(`panels.settings.language.names.${option}`) }}
      </GameTabButton>
    </div>
  </SettingsSectionFrame>
</template>

<style scoped>
.settings-panel__section-note {
  margin: 0 0 10px;
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
}
.settings-panel__language-options {
  display: flex;
  gap: var(--space-2);
}
.settings-panel__language-option.game-tab-button {
  width: 140px;
  height: 44px;
  font-size: 17px;
}
</style>
