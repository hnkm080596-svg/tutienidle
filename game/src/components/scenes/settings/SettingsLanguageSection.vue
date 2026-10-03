<script setup lang="ts">
// Scene 16/17 language section (ref's Ngon Ngu - CORRECTED to the real
// locale chips; ref's voice-language dropdown is INVALID).
import { useI18n } from 'vue-i18n'
import Chip from '@/components/common/primitives/Chip.vue'
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
      <Chip
        v-for="option in LOCALE_OPTIONS"
        :key="option"
        class="settings-panel__language-option"
        :active="locale === option"
        :data-testid="`settings-locale-${option}`"
        @click="emit('select', option)"
      >
        {{ t(`panels.settings.language.names.${option}`) }}
      </Chip>
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
.settings-panel__language-option {
  padding: 0 var(--space-4);
  border-color: var(--paper-line);
  color: var(--paper-text);
  font-size: var(--text-sm);
  --chip-active-bg: color-mix(in srgb, var(--chrome-300) 12%, transparent);
}
.settings-panel__language-option:hover {
  border-color: var(--chrome-500);
}
</style>
