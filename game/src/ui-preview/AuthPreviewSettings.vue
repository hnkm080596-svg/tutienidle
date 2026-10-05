<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import PcPaperButton from '@/components/common/PcPaperButton.vue'
import SettingsUiScaleSection from '@/components/scenes/settings/SettingsUiScaleSection.vue'
import SettingsLanguageSection from '@/components/scenes/settings/SettingsLanguageSection.vue'
import type { AppLocale } from '@/composables/locale'

const { t, locale } = useI18n()
const settings = defineModel<{ enabled: boolean; master: number; music: number; sfx: number; ui: number; reducedShake: boolean; uiScale: number; language: AppLocale }>({ required: true })
const channels = [
  { key: 'volume', field: 'master' }, { key: 'musicVolume', field: 'music' },
  { key: 'sfxVolume', field: 'sfx' }, { key: 'uiVolume', field: 'ui' },
] as const
function selectLanguage(value: AppLocale) { settings.value.language = value; locale.value = value }
</script>

<template>
  <div class="auth-preview-settings">
    <section class="preview-preference-group">
      <header><h3>{{ t('panels.settings.sections.audio') }}</h3><PcPaperButton :variant="settings.enabled ? 'primary' : 'secondary'" :aria-pressed="settings.enabled" @click="settings.enabled = !settings.enabled">{{ t(settings.enabled ? 'panels.settings.audio.on' : 'panels.settings.audio.off') }}</PcPaperButton></header>
      <label v-for="channel in channels" :key="channel.key">{{ t(`panels.settings.audio.${channel.key}`) }}<input v-model="settings[channel.field]" type="range" min="0" max="100" :disabled="!settings.enabled" :data-testid="`preview-audio-${channel.key}`"><output>{{ settings[channel.field] }}%</output></label>
    </section>
    <section class="preview-preference-group">
      <h3>{{ t('authPreview.display') }}</h3>
      <label class="preview-preference-toggle"><input v-model="settings.reducedShake" type="checkbox">{{ t('panels.settings.audio.reducedShake') }}</label>
      <SettingsUiScaleSection :ui-scale="settings.uiScale" @select="settings.uiScale = $event" />
    </section>
    <SettingsLanguageSection :locale="settings.language" @select="selectLanguage" />
  </div>
</template>

<style scoped>
.auth-preview-settings { display: grid; gap: 26px; --paper-text: #30271b; --paper-text-soft: #705a38; --paper-line: #b69862; }
.preview-preference-group { display: grid; gap: 20px; }
.preview-preference-group header { display: flex; align-items: center; justify-content: space-between; }
.preview-preference-group header button { min-height: 38px; min-width: 78px; font-size: 17px; }
.preview-preference-group h3 { margin: 0; font-size: 24px; }
.preview-preference-group > label { display: grid; grid-template-columns: 90px 1fr 42px; align-items: center; gap: 12px; font-size: 17px; }
.preview-preference-group input[type='range'] { width: 100%; accent-color: #ab803c; }
.preview-preference-group .preview-preference-toggle { display: flex; gap: 12px; }
.auth-preview-settings :deep(.settings-panel__section) { background: #ead4a22b; border-radius: 0; padding: 16px; }
.auth-preview-settings :deep(.settings-panel__plaque) { display: none; }
.auth-preview-settings :deep(h4) { font-size: 21px; }
.auth-preview-settings :deep(.chip) { min-height: 38px; font-size: 16px; border-radius: 0; }
.auth-preview-settings :deep(.settings-panel__ui-scale-options), .auth-preview-settings :deep(.settings-panel__language-options) { gap: 10px; flex-wrap: wrap; }
.auth-preview-settings :deep(.chip) { padding: 9px 14px; min-width: 64px; border: 1px solid #b69250; background: #e9d2a442; font-family: var(--pc-font-body); }
.auth-preview-settings :deep(.chip.is-active) { background: #dcb46980; color: #352612; }
.auth-preview-settings :deep(.ink-nine-slice) { display: none; }
</style>
