<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
const mode = defineModel<'login' | 'register'>({ required: true })
const { t } = useI18n()
function switchTab(target: 'login' | 'register') {
  mode.value = target
  document.getElementById(`auth-tab-${target}`)?.focus()
}
</script>

<template>
  <div class="auth-tabs" role="tablist" :aria-label="t('onboarding.auth.eyebrow')" data-hk-region="mode-tabs">
    <button
      v-for="tab in (['login', 'register'] as const)"
      :id="`auth-tab-${tab}`" :key="tab" role="tab" type="button"
      class="auth-tabs__tab" :class="{ active: mode === tab }"
      :aria-selected="mode === tab" :tabindex="mode === tab ? 0 : -1"
      aria-controls="auth-credential-panel"
      @click="mode = tab"
      @keydown.right.prevent="switchTab(tab === 'login' ? 'register' : 'login')"
      @keydown.left.prevent="switchTab(tab === 'login' ? 'register' : 'login')"
    ><InkNineSlice chrome-id="tab-seal" layer="surface" :tint-var="mode === tab ? '--hk-gold' : undefined" /><span class="auth-tabs__label">{{ t(`onboarding.auth.tabs.${tab}`) }}</span></button>
  </div>
</template>

<style scoped>
/* wave B chrome: each tab consumes the drawn tab-seal slice (grayscale
   sheet, gold tint on the open tab); no hand clip-path/gradient shell. */
.auth-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .6cqw;
}
.auth-tabs__tab {
  position: relative;
  min-height: 7.5cqw;
  border: 0;
  padding: 1cqw 2cqw;
  color: #c7c0ab;
  background: transparent;
  font: 500 3.1cqw var(--hk-font-display, Georgia, serif);
  cursor: pointer;
  transition: color 150ms;
}
.auth-tabs__tab.active {
  color: var(--hk-ivory, #ede6d6);
  text-shadow: 0 1px 3px #000;
}
.auth-tabs__label { position: relative; z-index: 2; }
.auth-tabs__tab:hover { color: #fff0bd; }
.auth-tabs__tab:focus-visible { outline: 2px solid #ffe4a2; outline-offset: -4px; }
</style>
