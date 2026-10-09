<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { loadUiScale, saveUiScale } from '@/composables/uiScale'
import { saveLocale, type AppLocale } from '@/composables/locale'
import SettingsAudioSection from '@/components/scenes/settings/SettingsAudioSection.vue'
import SettingsUiScaleSection from '@/components/scenes/settings/SettingsUiScaleSection.vue'
import SettingsLanguageSection from '@/components/scenes/settings/SettingsLanguageSection.vue'
const { locale } = useI18n()
const uiScale = ref(loadUiScale())
function selectScale(scale: number) { saveUiScale(scale); uiScale.value = scale }
function selectLanguage(next: AppLocale) { saveLocale(next) }
</script>

<template>
  <div class="login-settings-content">
    <SettingsAudioSection />
    <SettingsUiScaleSection :ui-scale="uiScale" @select="selectScale" />
    <SettingsLanguageSection :locale="(locale as AppLocale)" @select="selectLanguage" />
  </div>
</template>

<style scoped>
/* Dark-card retheme (2026-10-07): no section backdrop/frame at all - one
   hairline separates parts; paper/gold vars flip to readable light-on-ink
   tones; the seal-chip slice (renders a stray ring on dark) is replaced
   by a flat bordered pill. */
.login-settings-content { display: grid; gap: 0; --paper-text: #e6d5ac; --paper-text-soft: #c4b088; --paper-line: #8f784455; --gold: #d4a94e; --hk-text-secondary: #d8c89e; --hk-text-primary: #fff0bd; }
.login-settings-content :deep(.settings-panel__section) { border: 0; border-radius: 0; padding: 20px 4px; background: transparent; }
.login-settings-content :deep(.settings-panel__section + .settings-panel__section) { border-top: 1px solid #8f784455; }
.login-settings-content :deep(h4) { font-size: 23px; margin-bottom: 20px; }
.login-settings-content :deep(.settings-panel__plaque) { display: none; }
.login-settings-content :deep(.settings-panel__audio-row) { flex-direction: column; align-items: stretch; gap: 20px; margin-bottom: 20px; }
.login-settings-content :deep(.settings-panel__audio-volume) { display: grid; grid-template-columns: 95px 1fr 45px; font-size: 17px; }
.login-settings-content :deep(input[type='range']) { width: 100%; }
/* Slider thumb reads dim over the dark card - lift it with a gold fill
   behind the ring art plus a stronger glow. */
.login-settings-content :deep(.has-hk-slider input[type='range']::-webkit-slider-thumb) { background: var(--hk-slider-thumb) center / contain no-repeat, radial-gradient(circle, #d4a94e88 30%, transparent 68%); filter: brightness(1.55) saturate(1.2) drop-shadow(0 0 6px #e8c56a); }
.login-settings-content :deep(.has-hk-slider input[type='range']::-moz-range-thumb) { background: var(--hk-slider-thumb) center / contain no-repeat, radial-gradient(circle, #d4a94e88 30%, transparent 68%); filter: brightness(1.55) saturate(1.2) drop-shadow(0 0 6px #e8c56a); }
.login-settings-content :deep(.chip) { border-radius: 0; min-height: 40px; border: 1px solid #8f7844; background: #1d150c; color: #d8c89e; }
.login-settings-content :deep(.chip .ink-nine-slice) { display: none; }
.login-settings-content :deep(.chip.is-active) { border-color: #c9a66a; background: #2c2110; color: #ffdf8e; }
</style>

<style>
/* Unscoped: tien-hiep-ui.css pins .chip text dark via :is(#app,body)
   id-level specificity - scoped rules cannot win, so the drawer-dark
   chip colors must be declared at the same global specificity. */
:is(#app, body) .login-settings-content .chip.chip { color: #d8c89e; }
:is(#app, body) .login-settings-content .chip.chip.is-active { color: #ffdf8e; }
</style>
