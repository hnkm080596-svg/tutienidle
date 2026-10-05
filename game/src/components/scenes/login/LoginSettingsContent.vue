<script setup lang="ts">
import { ref } from 'vue'
import { loadUiScale, saveUiScale } from '@/composables/uiScale'
import SettingsAudioSection from '@/components/scenes/settings/SettingsAudioSection.vue'
import SettingsUiScaleSection from '@/components/scenes/settings/SettingsUiScaleSection.vue'
const uiScale = ref(loadUiScale())
function selectScale(scale: number) { saveUiScale(scale); uiScale.value = scale }
</script>

<template>
  <div class="login-settings-content">
    <SettingsAudioSection />
    <SettingsUiScaleSection :ui-scale="uiScale" @select="selectScale" />
  </div>
</template>

<style scoped>
.login-settings-content { display: grid; gap: 24px; --paper-text: #30271b; --paper-text-soft: #705a38; --paper-line: #b69862; --gold: #ac8038; }
.login-settings-content :deep(.settings-panel__section) { border-radius: 0; padding: 20px 16px; background: #ead7af40; }
.login-settings-content :deep(h4) { font-size: 23px; margin-bottom: 20px; }
.login-settings-content :deep(.settings-panel__plaque) { display: none; }
.login-settings-content :deep(.settings-panel__audio-row) { flex-direction: column; align-items: stretch; gap: 20px; margin-bottom: 20px; }
.login-settings-content :deep(.settings-panel__audio-volume) { display: grid; grid-template-columns: 95px 1fr 45px; font-size: 17px; }
.login-settings-content :deep(input[type='range']) { width: 100%; }
.login-settings-content :deep(.chip) { border-radius: 0; min-height: 40px; }
</style>
