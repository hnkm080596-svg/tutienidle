<script setup lang="ts">
import { useI18n } from 'vue-i18n'
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
    >{{ t(`onboarding.auth.tabs.${tab}`) }}</button>
  </div>
</template>

<style scoped>
.auth-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 1px;
  background: #897247;
  clip-path: polygon(2% 0, 98% 0, 100% 50%, 98% 100%, 2% 100%, 0 50%);
}
.auth-tabs__tab {
  min-height: 7.5cqw;
  border: 0;
  padding: 1cqw 2cqw;
  color: #c7c0ab;
  background: linear-gradient(150deg, #373830, #242823);
  font: 500 3.1cqw var(--hk-font-display, Georgia, serif);
  cursor: pointer;
  transition: color 150ms, background 150ms;
}
.auth-tabs__tab.active {
  color: var(--hk-ivory, #ede6d6);
  background: radial-gradient(ellipse at bottom, #246859, #092f2b);
  box-shadow: inset 0 0 0 1px #b99a55, inset 0 0 0 3px #163a32;
  text-shadow: 0 1px 3px #000;
}
.auth-tabs__tab:hover { color: #fff0bd; }
.auth-tabs__tab:focus-visible { outline: 2px solid #ffe4a2; outline-offset: -4px; }
</style>
